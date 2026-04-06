const { db } = require("../data/db");
const { resolveCountryCode } = require("../config/countryConfig");
const { normalizeLanguageCode } = require("../config/languageConfig");

const DEFAULT_TASK_TYPE = "general";
const DEFAULT_SOURCE_TYPE = "manual";
const DEFAULT_LOOKBACK_DAYS = 14;

const SIGNAL_SCORES = {
  like: 1,
  save: 1.35,
  share: 1.6,
  apply: 1.5,
  complete: 1.1,
  open: 0.45,
  view: 0.2,
  dismiss: -0.75,
  dislike: -1.25,
  skip: -0.6,
};

const POSITIVE_SIGNALS = new Set(["like", "save", "share", "apply", "complete", "open"]);
const NEGATIVE_SIGNALS = new Set(["dismiss", "dislike", "skip"]);

const POSITIVE_TAG_HINTS = {
  actionable: "Prefer practical next steps over abstract advice.",
  concise: "Keep outputs tighter and instantly scannable.",
  human: "Use warmer, more natural phrasing.",
  specific: "Be more concrete and less generic.",
  viral: "Lead with a stronger hook or tension point.",
  clear: "Choose simpler wording with one obvious takeaway.",
  bold: "Keep the energy sharp and confident.",
};

const NEGATIVE_TAG_HINTS = {
  too_generic: "Avoid generic filler and name the concrete point faster.",
  too_long: "Trim the response and front-load the core line.",
  too_robotic: "Sound more human and less scripted.",
  too_harsh: "Keep the edge, but reduce unnecessary aggression.",
  too_vague: "Use one specific detail or action instead of broad wording.",
  confusing: "Make the structure easier to scan on first read.",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeTags = (tags = []) =>
  (Array.isArray(tags) ? tags : String(tags || "").split(","))
    .map((tag) =>
      String(tag || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_ -]+/g, "")
        .replace(/\s+/g, "_")
    )
    .filter(Boolean)
    .slice(0, 8);

const normalizeTaskType = (taskType) => String(taskType || DEFAULT_TASK_TYPE).trim() || DEFAULT_TASK_TYPE;

const normalizeSignal = (signal) => {
  const normalized = String(signal || "").trim().toLowerCase();
  return normalized && Object.prototype.hasOwnProperty.call(SIGNAL_SCORES, normalized)
    ? normalized
    : "view";
};

const daysAgoIso = (days = DEFAULT_LOOKBACK_DAYS) =>
  new Date(Date.now() - Math.max(1, Number(days) || DEFAULT_LOOKBACK_DAYS) * 24 * 60 * 60 * 1000).toISOString();

const getSignalScore = (signal) => SIGNAL_SCORES[normalizeSignal(signal)] || 0;

const buildTagCounter = (rows = [], direction = "all") => {
  const counts = new Map();

  rows.forEach((row) => {
    const signal = normalizeSignal(row.signal);
    const isPositive = POSITIVE_SIGNALS.has(signal);
    const isNegative = NEGATIVE_SIGNALS.has(signal);

    if (direction === "positive" && !isPositive) {
      return;
    }

    if (direction === "negative" && !isNegative) {
      return;
    }

    const metadata =
      typeof row.metadata === "string" ? JSON.parse(row.metadata || "{}") : row.metadata || {};
    const tags = normalizeTags(metadata.tags || []);

    tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
};

exports.recordFeedback = async ({
  userId = null,
  answerId = null,
  taskType = DEFAULT_TASK_TYPE,
  signal,
  sourceType = DEFAULT_SOURCE_TYPE,
  sourceId = null,
  country = null,
  langCode = null,
  tags = [],
  metadata = {},
} = {}) => {
  const normalizedSignal = normalizeSignal(signal);
  const normalizedTaskType = normalizeTaskType(taskType);
  const normalizedCountry = country ? resolveCountryCode(country) : null;
  const normalizedLanguage = langCode ? normalizeLanguageCode(langCode, "en") : null;
  const normalizedTags = normalizeTags(tags);
  const score = getSignalScore(normalizedSignal);

  const [row] = await db("ai_feedback_events")
    .insert({
      user_id: userId || null,
      answer_id: answerId || null,
      task_type: normalizedTaskType,
      signal: normalizedSignal,
      source_type: String(sourceType || DEFAULT_SOURCE_TYPE).slice(0, 64),
      source_id: sourceId ? String(sourceId).slice(0, 128) : null,
      country: normalizedCountry,
      lang_code: normalizedLanguage,
      score,
      metadata: {
        ...metadata,
        tags: normalizedTags,
      },
    })
    .returning("*");

  return row;
};

exports.getPromptOptimizationHints = async ({
  taskType = DEFAULT_TASK_TYPE,
  country = null,
  langCode = null,
  days = DEFAULT_LOOKBACK_DAYS,
} = {}) => {
  const normalizedTaskType = normalizeTaskType(taskType);
  const normalizedCountry = country ? resolveCountryCode(country) : null;
  const normalizedLanguage = langCode ? normalizeLanguageCode(langCode, "en") : null;

  let query = db("ai_feedback_events")
    .where("task_type", normalizedTaskType)
    .andWhere("created_at", ">=", daysAgoIso(days))
    .orderBy("created_at", "desc")
    .limit(250);

  if (normalizedCountry) {
    query = query.andWhere((builder) => {
      builder.where("country", normalizedCountry).orWhereNull("country");
    });
  }

  if (normalizedLanguage) {
    query = query.andWhere((builder) => {
      builder.where("lang_code", normalizedLanguage).orWhereNull("lang_code");
    });
  }

  const rows = await query;
  if (!rows.length) {
    return {
      taskType: normalizedTaskType,
      totalEvents: 0,
      positiveRate: 0,
      hints: [],
      positiveTags: [],
      negativeTags: [],
    };
  }

  const positives = rows.filter((row) => POSITIVE_SIGNALS.has(normalizeSignal(row.signal)));
  const negatives = rows.filter((row) => NEGATIVE_SIGNALS.has(normalizeSignal(row.signal)));
  const positiveTags = buildTagCounter(rows, "positive");
  const negativeTags = buildTagCounter(rows, "negative");
  const hints = [];

  negativeTags.forEach(({ tag }) => {
    const hint = NEGATIVE_TAG_HINTS[tag];
    if (hint && !hints.includes(hint)) {
      hints.push(hint);
    }
  });

  positiveTags.forEach(({ tag }) => {
    const hint = POSITIVE_TAG_HINTS[tag];
    if (hint && !hints.includes(hint)) {
      hints.push(hint);
    }
  });

  return {
    taskType: normalizedTaskType,
    totalEvents: rows.length,
    positiveRate: Number((positives.length / Math.max(rows.length, 1)).toFixed(2)),
    hints: hints.slice(0, 3),
    positiveTags,
    negativeTags,
  };
};

exports.getAdaptiveRankingPolicy = async ({
  country = null,
  days = DEFAULT_LOOKBACK_DAYS,
} = {}) => {
  const normalizedCountry = country ? resolveCountryCode(country) : null;
  let query = db("answers as a")
    .leftJoin("answer_sentiments as s", "s.answer_id", "a.id")
    .where("a.status", "approved")
    .andWhere("a.created_at", ">=", daysAgoIso(days))
    .select(
      "a.id",
      "a.country",
      "a.time_mode",
      "a.interactions",
      "a.ai_review",
      "s.debate_score",
      "s.intensity",
      "s.emotion"
    );

  if (normalizedCountry) {
    query = query.andWhere("a.country", normalizedCountry);
  }

  const rows = await query;
  if (!rows.length) {
    return {
      country: normalizedCountry,
      sampleSize: 0,
      debateWeight: 0.08,
      intensityWeight: 0.05,
      speedBias: 0.025,
      depthBias: 0.012,
    };
  }

  let weightedDebate = 0;
  let weightedIntensity = 0;
  let weightedShort = 0;
  let totalWeight = 0;

  rows.forEach((row) => {
    const interactions =
      typeof row.interactions === "string"
        ? JSON.parse(row.interactions || "{}")
        : row.interactions || {};
    const weight =
      1 +
      Number(interactions.likes || 0) * 0.8 +
      Number(interactions.saves || 0) * 1.15 +
      Number(interactions.shares || 0) * 1.4 +
      Number(interactions.views || 0) * 0.04;

    const debate = Number(row.debate_score || 0.42);
    const intensity = Number(row.intensity || 0.45);
    const isShort = row.time_mode !== "10s";

    weightedDebate += debate * weight;
    weightedIntensity += intensity * weight;
    weightedShort += (isShort ? 1 : 0) * weight;
    totalWeight += weight;
  });

  const avgDebate = weightedDebate / Math.max(totalWeight, 1);
  const avgIntensity = weightedIntensity / Math.max(totalWeight, 1);
  const shortShare = weightedShort / Math.max(totalWeight, 1);

  return {
    country: normalizedCountry,
    sampleSize: rows.length,
    debateWeight: Number(clamp((avgDebate - 0.35) * 0.22, 0.03, 0.12).toFixed(3)),
    intensityWeight: Number(clamp((avgIntensity - 0.3) * 0.16, 0.02, 0.09).toFixed(3)),
    speedBias: Number(clamp(shortShare * 0.05, 0.01, 0.05).toFixed(3)),
    depthBias: Number(clamp((1 - shortShare) * 0.035, 0.005, 0.035).toFixed(3)),
  };
};

exports.decorateAnswersForRanking = async (answers = [], { country = null } = {}) => {
  if (!Array.isArray(answers) || !answers.length) {
    return [];
  }

  const policy = await exports.getAdaptiveRankingPolicy({ country });
  const answerIds = answers.map((answer) => answer.id).filter(Boolean);
  const sentimentRows = await db("answer_sentiments")
    .whereIn("answer_id", answerIds)
    .select("answer_id", "emotion", "intensity", "debate_score");
  const sentimentMap = new Map(
    sentimentRows.map((row) => [
      row.answer_id,
      {
        emotion: row.emotion || "calm",
        intensity: Number(row.intensity || 0),
        debate_score: Number(row.debate_score || 0),
      },
    ])
  );

  return answers.map((answer) => {
    const sentiment = sentimentMap.get(answer.id) || null;
    const aiReviewScore = Number(answer.aiReview?.score || 0.7);
    const rankingBoost = Number(
      clamp(
        (sentiment?.debate_score || 0.4) * policy.debateWeight +
          (sentiment?.intensity || 0.4) * policy.intensityWeight +
          (answer.timeMode === "10s" ? policy.depthBias : policy.speedBias) +
          (aiReviewScore - 0.7) * 0.04,
        -0.04,
        0.18
      ).toFixed(3)
    );

    return {
      ...answer,
      sentiment: sentiment || answer.sentiment || null,
      aiOptimization: {
        policy,
        rankingBoost,
      },
    };
  });
};

exports.getSelfImprovementSummary = async ({
  country = null,
  days = DEFAULT_LOOKBACK_DAYS,
} = {}) => {
  const normalizedCountry = country ? resolveCountryCode(country) : null;
  let query = db("ai_feedback_events")
    .where("created_at", ">=", daysAgoIso(days))
    .orderBy("created_at", "desc")
    .limit(400);

  if (normalizedCountry) {
    query = query.andWhere((builder) => {
      builder.where("country", normalizedCountry).orWhereNull("country");
    });
  }

  const rows = await query;
  const taskTypeSet = [...new Set(rows.map((row) => normalizeTaskType(row.task_type)))].slice(0, 8);
  const taskSummaries = await Promise.all(
    taskTypeSet.map(async (taskType) => exports.getPromptOptimizationHints({ taskType, country: normalizedCountry, days }))
  );

  return {
    country: normalizedCountry,
    days: Math.max(1, Number(days) || DEFAULT_LOOKBACK_DAYS),
    totalEvents: rows.length,
    positiveSignals: rows.filter((row) => POSITIVE_SIGNALS.has(normalizeSignal(row.signal))).length,
    negativeSignals: rows.filter((row) => NEGATIVE_SIGNALS.has(normalizeSignal(row.signal))).length,
    rankingPolicy: await exports.getAdaptiveRankingPolicy({ country: normalizedCountry, days }),
    tasks: taskSummaries,
  };
};
