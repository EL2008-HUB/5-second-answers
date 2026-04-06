const aiService = require("../services/aiService");
const aiCopilotService = require("../services/aiCopilotService");
const aiSelfImprovementService = require("../services/aiSelfImprovementService");
const { db } = require("../data/db");
const { formatAnswer, parseMaybeJson } = require("../data/helpers");
const { detectLanguageFast } = require("../services/languageDetector");

const normalizeQuestionText = (value) => {
  const cleaned = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[\-\:\.\,\s]+/, "")
    .trim();

  if (!cleaned) {
    return "";
  }

  const clipped = cleaned.slice(0, 200).trim();
  return /[?!.]$/.test(clipped) ? clipped : `${clipped}?`;
};

const buildAnswerPrompt = (answerRow) => {
  const review = parseMaybeJson(answerRow.ai_review, {});
  const transcript = String(review?.transcript || "").trim();
  const explicitText = String(answerRow.text || "").trim();

  if (explicitText) {
    return explicitText;
  }

  if (transcript && !transcript.startsWith("[Transcription unavailable")) {
    return transcript;
  }

  if (answerRow.type === "video") {
    return "Pergjigje me video";
  }

  if (answerRow.type === "audio") {
    return "Pergjigje me audio";
  }

  return "Pergjigje e shkurter";
};

exports.validate = async (req, res) => {
  try {
    const { answerId, type, contentUrl, text } = req.body;

    let payload = { type, contentUrl, text };
    if (answerId) {
      const answerRow = await db("answers").where({ id: answerId }).first();
      if (!answerRow) {
        return res.status(404).json({ error: "Answer not found" });
      }

      const answer = formatAnswer(answerRow);
      payload = {
        type: answer.type,
        contentUrl: answer.contentUrl,
        text: answer.text,
      };
    }

    res.json(await aiService.validateAnswer(payload));
  } catch (error) {
    console.error("AI validate error:", error);
    res.status(500).json({ error: "AI validation failed" });
  }
};

exports.health = async (req, res) => {
  try {
    res.json(await aiService.healthCheck());
  } catch (error) {
    console.error("AI health error:", error);
    res.status(500).json({ error: "AI health check failed" });
  }
};

exports.routePreview = async (req, res) => {
  try {
    const {
      answer = "",
      forceComplexity = null,
      prompt = "",
      question = "",
      taskType = "general",
      text = "",
      title = "",
    } = req.body || {};

    const preview = aiService.previewRoute({
      answer,
      forceComplexity,
      prompt,
      question,
      taskType,
      text,
      title,
    });

    res.json(preview);
  } catch (error) {
    console.error("AI route preview error:", error);
    res.status(500).json({ error: "AI route preview failed" });
  }
};

exports.transcribe = async (req, res) => {
  const { contentUrl } = req.body;

  if (!contentUrl) {
    return res.status(400).json({ error: "Audio contentUrl required" });
  }

  try {
    const transcript = await aiService.transcribe(contentUrl);

    if (!transcript || transcript.startsWith("[Transcription unavailable")) {
      return res.status(422).json({
        error:
          "Transkriptimi nuk u krye. Kontrollo AI konfigurimin ose provo perseri.",
      });
    }

    const suggestedQuestion =
      transcript.length <= 200
        ? transcript
        : await aiService.summarize(transcript, 20);

    res.json({
      transcript,
      suggestedQuestion: normalizeQuestionText(suggestedQuestion || transcript),
    });
  } catch (error) {
    console.error("AI transcribe error:", error);
    res.status(500).json({ error: "AI transcription failed" });
  }
};

exports.createLabIdeas = async (req, res) => {
  const { category = "general", contextQuestions = [], limit = 4 } = req.body || {};

  try {
    const ideas = await aiService.generateCreateLabIdeas({
      category,
      context: Array.isArray(contextQuestions) ? contextQuestions : [],
      limit,
    });

    res.json({
      category,
      ideas,
    });
  } catch (error) {
    console.error("AI create lab ideas error:", error);
    res.status(500).json({ error: "AI create lab idea generation failed" });
  }
};

exports.ideaExecutionEngine = async (req, res) => {
  const { query, country = null, langCode = null, limit = 3 } = req.body || {};

  if (!String(query || "").trim()) {
    return res.status(400).json({ error: "query required" });
  }

  try {
    const result = await aiService.generateIdeaExecutionPlan({
      query,
      country,
      langCode,
      limit,
    });

    res.json(result);
  } catch (error) {
    console.error("AI idea execution engine error:", error);
    res.status(500).json({ error: "AI idea execution engine failed" });
  }
};

exports.generateQuestion = async (req, res) => {
  const { title, langCode = null } = req.body || {};

  if (!title) {
    return res.status(400).json({ error: "News title required" });
  }

  try {
    const result = await aiService.generateQuestionFromNews(title, langCode);
    res.json(result);
  } catch (error) {
    console.error("AI generate question error:", error);
    res.status(500).json({ error: "AI question generation failed" });
  }
};

exports.analyzeSentiment = async (req, res) => {
  const { title, text, answer, question = null, timeMode = "5s", langCode = null } = req.body || {};
  const primaryText = title || text || answer;

  if (!primaryText) {
    return res.status(400).json({ error: "Text or answer required" });
  }

  try {
    const sentiment = await aiService.analyzeSentiment(
      {
        title,
        text,
        answer,
        question,
        timeMode,
        langCode,
      },
      langCode
    );
    res.json(sentiment);
  } catch (error) {
    console.error("AI sentiment error:", error);
    res.status(500).json({ error: "AI sentiment analysis failed" });
  }
};

exports.generateComment = async (req, res) => {
  const {
    answerId,
    question,
    answer,
    timeMode = "5s",
    langCode = null,
    aiReview = null,
    style = null,
  } = req.body || {};

  try {
    let payload = {
      question,
      answer,
      timeMode,
      langCode,
      aiReview,
      style,
    };

    if (answerId) {
      const row = await db("answers as a")
        .leftJoin("questions as q", "q.id", "a.question_id")
        .where("a.id", answerId)
        .select("a.*", "q.text as question_text")
        .first();

      if (!row) {
        return res.status(404).json({ error: "Answer not found" });
      }

      payload = {
        question: row.question_text || question || "",
        answer: buildAnswerPrompt(row),
        timeMode: row.time_mode || timeMode || "5s",
        langCode: row.lang || langCode || null,
        aiReview: parseMaybeJson(row.ai_review, null),
        style,
      };
    } else if (!payload.langCode) {
      payload.langCode = await detectLanguageFast(answer || question || "", {
        fallback: "en",
      });
    }

    const aiCommentMeta = await aiService.generateAICommentPayload(payload);
    res.json({
      aiComment: aiCommentMeta.comment,
      aiCommentMeta,
      langCode: aiCommentMeta.langCode || payload.langCode || "en",
    });
  } catch (error) {
    console.error("AI generate comment error:", error);
    res.status(500).json({ error: "AI comment generation failed" });
  }
};

exports.processEvent = async (req, res) => {
  const { event_type: eventType, content = null, metadata = {} } = req.body || {};

  if (!eventType) {
    return res.status(400).json({ error: "event_type required" });
  }

  try {
    const result = await aiCopilotService.processEvent({
      eventType,
      content,
      metadata,
    });
    res.json(result);
  } catch (error) {
    console.error("AI copilot process event error:", error);
    res.status(400).json({ error: error.message || "AI copilot event failed" });
  }
};

exports.assistant = async (req, res) => {
  const { query, userId = null, feature = null, context = {} } = req.body || {};

  if (!String(query || "").trim()) {
    return res.status(400).json({ error: "query required" });
  }

  try {
    const result = await aiCopilotService.createAssistantResponse({
      userId,
      query,
      feature,
      context,
    });
    res.json(result);
  } catch (error) {
    console.error("AI copilot assistant error:", error);
    res.status(500).json({ error: "AI assistant failed" });
  }
};

exports.featureGuide = async (req, res) => {
  const { feature = "mirror" } = req.body || {};

  try {
    const guide = aiCopilotService.getFeatureGuide(feature);
    res.json(guide);
  } catch (error) {
    console.error("AI copilot feature guide error:", error);
    res.status(500).json({ error: "Failed to load feature guide" });
  }
};

exports.monitor = async (req, res) => {
  try {
    const result = await aiCopilotService.monitorSystem({
      metadata: {
        requestedBy: req.query?.requestedBy || null,
      },
    });
    res.json(result);
  } catch (error) {
    console.error("AI copilot monitor error:", error);
    res.status(500).json({ error: "AI monitor failed" });
  }
};

exports.feedback = async (req, res) => {
  const {
    userId = null,
    answerId = null,
    taskType = "general",
    signal,
    sourceType = "manual",
    sourceId = null,
    country = null,
    langCode = null,
    tags = [],
    metadata = {},
  } = req.body || {};

  if (!String(signal || "").trim()) {
    return res.status(400).json({ error: "signal required" });
  }

  try {
    const actor = userId ? await ensureUser(userId) : null;
    const event = await aiSelfImprovementService.recordFeedback({
      userId: actor?.id || null,
      answerId,
      taskType,
      signal,
      sourceType,
      sourceId,
      country,
      langCode,
      tags,
      metadata,
    });

    res.status(201).json({
      event,
      ok: true,
    });
  } catch (error) {
    console.error("AI feedback error:", error);
    res.status(500).json({ error: "AI feedback failed" });
  }
};

exports.selfImprovement = async (req, res) => {
  const { country = null, days = 14 } = req.query || {};

  try {
    const summary = await aiSelfImprovementService.getSelfImprovementSummary({
      country,
      days,
    });

    res.json(summary);
  } catch (error) {
    console.error("AI self improvement summary error:", error);
    res.status(500).json({ error: "AI self improvement summary failed" });
  }
};
