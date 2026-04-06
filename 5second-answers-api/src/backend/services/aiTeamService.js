const { db } = require("../data/db");
const aiService = require("./aiService");

const OUTPUT_TYPES = {
  SMART: "answer_team_smart",
  BRAIN: "answer_team_brain",
};

const TEAM_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
};

const persistStageOutput = async ({
  type,
  answerId,
  status,
  role,
  provider,
  payload = null,
  error = null,
}) => {
  await db("ai_outputs").insert({
    type,
    input: {
      answerId,
      provider,
      role,
      status,
    },
    output: JSON.stringify({
      status,
      provider,
      role,
      payload,
      error,
    }),
  });
};

const persistAnswerSentiment = async (answerId, sentiment) => {
  if (!answerId || !sentiment) {
    return null;
  }

  const payload = {
    answer_id: answerId,
    debate_score: Number(sentiment.debate_score || 0),
    emotion: String(sentiment.emotion || "neutral").slice(0, 32),
    intensity: Number(sentiment.intensity || 0),
  };

  const [row] = await db("answer_sentiments")
    .insert(payload)
    .onConflict("answer_id")
    .merge({
      ...payload,
      updated_at: db.fn.now(),
    })
    .returning("*");

  return row || payload;
};

const parseOutputRow = (row) => {
  if (!row) {
    return null;
  }

  try {
    return typeof row.output === "string" ? JSON.parse(row.output) : row.output;
  } catch (error) {
    return null;
  }
};

const loadLatestStageRows = async (answerId) => {
  const rows = await db("ai_outputs")
    .whereIn("type", Object.values(OUTPUT_TYPES))
    .andWhereRaw("input ->> 'answerId' = ?", [String(answerId)])
    .orderBy("created_at", "desc");

  const latest = new Map();
  for (const row of rows) {
    if (!latest.has(row.type)) {
      latest.set(row.type, row);
    }
  }

  return latest;
};

const buildStageResponse = (row, fallback) => {
  if (!row) {
    return fallback;
  }

  const parsed = parseOutputRow(row) || {};
  return {
    status: parsed.status || fallback.status,
    provider: parsed.provider || fallback.provider,
    role: parsed.role || fallback.role,
    payload: parsed.payload || null,
    error: parsed.error || null,
    updatedAt: row.created_at,
  };
};

const loadAnswerContext = async (answerId) => {
  const row = await db("answers as a")
    .leftJoin("questions as q", "q.id", "a.question_id")
    .where("a.id", answerId)
    .select(
      "a.id",
      "a.text",
      "a.type",
      "a.lang",
      "a.time_mode",
      "a.country",
      "a.ai_review",
      "q.text as question_text"
    )
    .first();

  if (!row) {
    return null;
  }

  let transcript = null;
  try {
    const aiReview =
      typeof row.ai_review === "string" ? JSON.parse(row.ai_review) : row.ai_review || {};
    transcript = String(aiReview?.transcript || "").trim() || null;
  } catch (error) {
    transcript = null;
  }

  const answerText =
    String(row.text || "").trim() ||
    (transcript && !transcript.startsWith("[Transcription unavailable") ? transcript : null) ||
    (row.type === "video"
      ? "Pergjigje me video"
      : row.type === "audio"
        ? "Pergjigje me audio"
        : "Pergjigje e shkurter");

  return {
    answerId: row.id,
    answerText,
    country: row.country || null,
    langCode: row.lang || null,
    questionText: String(row.question_text || "").trim(),
    timeMode: row.time_mode === "10s" ? "10s" : "5s",
  };
};

const runAnswerTeamFlow = async ({
  answerId,
  answerText,
  country = null,
  langCode = null,
  questionText,
  timeMode = "5s",
}) => {
  let smartPayload = null;

  try {
    const [smartInsight, sentiment] = await Promise.all([
      aiService.generateSmartAnswerInsight({
        question: questionText,
        answer: answerText,
        timeMode,
        langCode,
      }),
      aiService.analyzeSentiment({
        question: questionText,
        answer: answerText,
        timeMode,
        langCode,
      }),
    ]);

    const storedSentiment = await persistAnswerSentiment(answerId, sentiment);
    smartPayload = {
      summary: smartInsight.summary,
      takeaway: smartInsight.takeaway,
      feed_hook: smartInsight.feed_hook,
      sentiment: storedSentiment
        ? {
            debate_score: Number(storedSentiment.debate_score || sentiment?.debate_score || 0),
            emotion: storedSentiment.emotion || sentiment?.emotion || "neutral",
            intensity: Number(storedSentiment.intensity || sentiment?.intensity || 0),
            relatability: Number(sentiment?.relatability || 0),
          }
        : sentiment,
    };

    await persistStageOutput({
      type: OUTPUT_TYPES.SMART,
      answerId,
      status: TEAM_STATUS.COMPLETED,
      role: "smart",
      provider: "openrouter_mixtral",
      payload: smartPayload,
    });
  } catch (error) {
    await persistStageOutput({
      type: OUTPUT_TYPES.SMART,
      answerId,
      status: TEAM_STATUS.FAILED,
      role: "smart",
      provider: "openrouter_mixtral",
      error: error.message,
    });
  }

  try {
    const brainInsight = await aiService.generateBrainInsight({
      question: questionText,
      answer: answerText,
      timeMode,
      langCode,
      country,
    });

    await persistStageOutput({
      type: OUTPUT_TYPES.BRAIN,
      answerId,
      status: TEAM_STATUS.COMPLETED,
      role: "brain",
      provider: "nemotron_super",
      payload: {
        ...brainInsight,
        smartSummary: smartPayload?.summary || null,
      },
    });
  } catch (error) {
    await persistStageOutput({
      type: OUTPUT_TYPES.BRAIN,
      answerId,
      status: TEAM_STATUS.FAILED,
      role: "brain",
      provider: "nemotron_super",
      error: error.message,
    });
  }
};

exports.queueAnswerTeamFlow = async ({
  answerId,
  answerText,
  country = null,
  langCode = null,
  questionText,
  timeMode = "5s",
}) => {
  await Promise.all([
    persistStageOutput({
      type: OUTPUT_TYPES.SMART,
      answerId,
      status: TEAM_STATUS.PENDING,
      role: "smart",
      provider: "openrouter_mixtral",
    }),
    persistStageOutput({
      type: OUTPUT_TYPES.BRAIN,
      answerId,
      status: TEAM_STATUS.PENDING,
      role: "brain",
      provider: "nemotron_super",
    }),
  ]);

  void runAnswerTeamFlow({
    answerId,
    answerText,
    country,
    langCode,
    questionText,
    timeMode,
  }).catch((error) => {
    console.warn("[AI TEAM] background flow failed:", error.message);
  });

  return {
    answerId,
    fast: {
      status: TEAM_STATUS.COMPLETED,
      provider: "groq",
      role: "fast",
    },
    smart: {
      status: TEAM_STATUS.PENDING,
      provider: "openrouter_mixtral",
      role: "smart",
    },
    brain: {
      status: TEAM_STATUS.PENDING,
      provider: "nemotron_super",
      role: "brain",
    },
  };
};

exports.getAnswerTeamFlow = async (answerId) => {
  let latest = await loadLatestStageRows(answerId);

  const smart = buildStageResponse(latest.get(OUTPUT_TYPES.SMART), {
    status: TEAM_STATUS.PENDING,
    provider: "openrouter_mixtral",
    role: "smart",
    payload: null,
    error: null,
    updatedAt: null,
  });
  const brain = buildStageResponse(latest.get(OUTPUT_TYPES.BRAIN), {
    status: TEAM_STATUS.PENDING,
    provider: "nemotron_super",
    role: "brain",
    payload: null,
    error: null,
    updatedAt: null,
  });
  const smartDone = [TEAM_STATUS.COMPLETED, TEAM_STATUS.FAILED].includes(smart.status);
  const brainDone = [TEAM_STATUS.COMPLETED, TEAM_STATUS.FAILED].includes(brain.status);
  const overallStatus =
    smart.status === TEAM_STATUS.FAILED || brain.status === TEAM_STATUS.FAILED
      ? TEAM_STATUS.FAILED
      : smartDone && brainDone
        ? TEAM_STATUS.COMPLETED
        : TEAM_STATUS.PENDING;

  if (overallStatus === TEAM_STATUS.PENDING) {
    const context = await loadAnswerContext(answerId);
    if (context) {
      await runAnswerTeamFlow(context);
      latest = await loadLatestStageRows(answerId);
    }
  }

  const refreshedSmart = buildStageResponse(latest.get(OUTPUT_TYPES.SMART), {
    status: TEAM_STATUS.PENDING,
    provider: "openrouter_mixtral",
    role: "smart",
    payload: null,
    error: null,
    updatedAt: null,
  });
  const refreshedBrain = buildStageResponse(latest.get(OUTPUT_TYPES.BRAIN), {
    status: TEAM_STATUS.PENDING,
    provider: "nemotron_super",
    role: "brain",
    payload: null,
    error: null,
    updatedAt: null,
  });
  const refreshedSmartDone = [TEAM_STATUS.COMPLETED, TEAM_STATUS.FAILED].includes(
    refreshedSmart.status
  );
  const refreshedBrainDone = [TEAM_STATUS.COMPLETED, TEAM_STATUS.FAILED].includes(
    refreshedBrain.status
  );
  const refreshedOverallStatus =
    refreshedSmart.status === TEAM_STATUS.FAILED || refreshedBrain.status === TEAM_STATUS.FAILED
      ? TEAM_STATUS.FAILED
      : refreshedSmartDone && refreshedBrainDone
        ? TEAM_STATUS.COMPLETED
        : TEAM_STATUS.PENDING;

  return {
    answerId,
    overallStatus: refreshedOverallStatus,
    ready: refreshedOverallStatus === TEAM_STATUS.COMPLETED,
    fast: {
      status: TEAM_STATUS.COMPLETED,
      provider: "groq",
      role: "fast",
    },
    smart: refreshedSmart,
    brain: refreshedBrain,
  };
};
