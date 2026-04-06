const { db } = require("../data/db");
const { ensureUser } = require("../data/helpers");
const aiService = require("../services/aiService");
const engagementNotificationService = require("../services/engagementNotificationService");
const {
  DEFAULT_LANGUAGE,
  normalizeLanguageCode,
} = require("../config/languageConfig");

const STORY_RESULT_COLORS = {
  savage: "#FF3B30",
  funny: "#FF9500",
  emotional: "#5856D6",
  mysterious: "#30D158",
  chaotic: "#FF2D55",
};

const hasMeaningfulStoryAnswer = (value) => {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return false;
  }

  return normalized.replace(/[.\s?,_\-!?;:()[\]{}"']/g, "").length > 0;
};

const normalizeCategory = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

const buildShareCard = (emotionScore) => ({
  title: emotionScore.badge,
  subtitle: emotionScore.summary,
  primaryEmotion: emotionScore.primary,
  accentColor:
    STORY_RESULT_COLORS[emotionScore.primary] || STORY_RESULT_COLORS.chaotic,
});

exports.getPack = async (req, res) => {
  const category = normalizeCategory(req.params.category);
  const langCode = normalizeLanguageCode(req.query.lang || req.query.langCode, "sq");

  if (!category) {
    return res.status(400).json({ error: "Story category required" });
  }

  try {
    const pack = await db("story_packs")
      .where({ category, is_active: true })
      .orderByRaw("RANDOM()")
      .first();

    if (!pack) {
      return res.status(404).json({ error: "No active story pack found" });
    }

    let questionRows = await db("story_questions")
      .where({ pack_id: pack.id, lang: langCode })
      .orderBy("order_index", "asc");

    if (questionRows.length < 5) {
      questionRows = await db("story_questions")
        .where({ pack_id: pack.id })
        .orderBy("order_index", "asc");
    }

    const questions = questionRows.slice(0, 5).map((row) => ({
      id: row.id,
      question: row.question,
      orderIndex: row.order_index,
      lang: row.lang || langCode,
    }));

    if (questions.length < 5) {
      return res.status(422).json({ error: "Story pack is incomplete" });
    }

    return res.json({
      packId: pack.id,
      title: pack.title,
      description: pack.description || "",
      category: pack.category,
      langCode,
      questions,
    });
  } catch (error) {
    console.error("Story pack load error:", error);
    return res.status(500).json({ error: "Failed to load story pack" });
  }
};

exports.complete = async (req, res) => {
  const {
    userId,
    packId,
    answers = [],
    langCode = DEFAULT_LANGUAGE,
  } = req.body || {};

  if (!packId || !Array.isArray(answers) || answers.length !== 5) {
    return res.status(400).json({
      error: "packId and exactly 5 answers are required",
    });
  }

  try {
    const [user, pack] = await Promise.all([
      ensureUser(userId || "demo_user"),
      db("story_packs").where({ id: packId, is_active: true }).first(),
    ]);

    if (!pack) {
      return res.status(404).json({ error: "Story pack not found" });
    }

    const normalizedAnswers = answers
      .slice(0, 5)
      .map((entry, index) => ({
        questionId: String(entry?.questionId || "").trim() || null,
        question: String(entry?.question || "").replace(/\s+/g, " ").trim(),
        answer: String(entry?.answer || "").replace(/\s+/g, " ").trim(),
        seconds: Math.max(0, Math.min(10, Number(entry?.seconds || 0))),
        orderIndex: index + 1,
      }));

    const answeredCount = normalizedAnswers.filter((entry) => hasMeaningfulStoryAnswer(entry.answer)).length;

    if (!answeredCount) {
      return res.status(422).json({
        error: "Per Story Mode duhet te pakten nje pergjigje reale.",
      });
    }

    const emotionScore = await aiService.generateStoryEmotionScore({
      answers: normalizedAnswers,
      langCode,
    });

    const [session] = await db("story_sessions")
      .insert({
        user_id: user.id,
        pack_id: pack.id,
        answers: JSON.stringify(normalizedAnswers),
        emotion_score: JSON.stringify(emotionScore.breakdown),
        primary_emotion: emotionScore.primary,
        lang: emotionScore.langCode || normalizeLanguageCode(langCode, DEFAULT_LANGUAGE),
        completed: true,
      })
      .returning("*");

    await engagementNotificationService.notifyFriendsOfEmotionScore({
      userId: user.id,
      badge: emotionScore.badge,
      primaryEmotion: emotionScore.primary,
      sessionId: session.id,
    });

    return res.json({
      sessionId: session.id,
      emotionScore,
      shareCard: buildShareCard(emotionScore),
    });
  } catch (error) {
    console.error("Story complete error:", error);

    if (error?.message === "At least one real answer is required for Story Mode analysis") {
      return res.status(422).json({
        error: "Per Story Mode duhet te pakten nje pergjigje reale.",
      });
    }

    return res.status(500).json({ error: "Failed to complete story session" });
  }
};
