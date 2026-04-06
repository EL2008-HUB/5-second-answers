const { db } = require("../data/db");
const aiService = require("../services/aiService");
const aiTeamService = require("../services/aiTeamService");
const aiSelfImprovementService = require("../services/aiSelfImprovementService");
const rankingService = require("../services/rankingService");
const badgeService = require("../services/badgeService");
const notificationService = require("../services/notificationService");
const growthService = require("../services/growthService");
const learningService = require("../services/learningService");
const expertService = require("../services/expertService");
const streakService = require("../services/streakService");
const engagementNotificationService = require("../services/engagementNotificationService");
const hashtagService = require("../services/hashtagService");
const referralService = require("../services/referralService");
const aiCopilotService = require("../services/aiCopilotService");
const { detectLanguageFast } = require("../services/languageDetector");
const {
  DEFAULT_LANGUAGE,
  normalizeLanguageCode,
} = require("../config/languageConfig");
const { DEFAULT_COUNTRY_CODE, resolveCountryCode } = require("../config/countryConfig");
const {
  ensureUser,
  findUserByIdentifier,
  formatAnswer,
  isUuid,
  loadAnswersByUser,
  parseMaybeJson,
  persistBadges,
  updateUserStats,
} = require("../data/helpers");

const simulateAIReview = () => {
  const score = Math.random() * 0.4 + 0.6;
  const approved = score > 0.7;

  return {
    approved,
    feedback: approved ? "Clear and concise" : "Too long or unclear",
    score,
  };
};

const getInteractionKey = (type) =>
  type === "like"
    ? "likes"
    : type === "view"
      ? "views"
      : type === "save"
        ? "saves"
        : "shares";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const buildInitialEngagementSeed = () => ({
  likes: 6 + Math.floor(Math.random() * 5),
  views: 34 + Math.floor(Math.random() * 28),
  saves: 1 + Math.floor(Math.random() * 3),
  shares: Math.floor(Math.random() * 2),
});

const normalizeBadgeTimestamp = (value) => {
  if (!value) {
    return new Date().toISOString();
  }

  const normalized = value instanceof Date ? value : new Date(value);
  return Number.isNaN(normalized.getTime())
    ? new Date().toISOString()
    : normalized.toISOString();
};

const sanitizeBadgeForStorage = (badge = {}) => ({
  id: badge.id || null,
  name: badge.name || "",
  emoji: badge.emoji || "",
  unlockedAt: normalizeBadgeTimestamp(badge.unlockedAt),
  ...(badge.awardedBy ? { awardedBy: badge.awardedBy } : {}),
  ...(badge.awardedAt
    ? { awardedAt: normalizeBadgeTimestamp(badge.awardedAt) }
    : {}),
});

const serializeBadgesForStorage = (badges = []) =>
  JSON.stringify(badges.map(sanitizeBadgeForStorage));

const decorateAnswerRows = (rows) =>
  rows.map((row) =>
    formatAnswer(row, {
      user: {
        username: row.username || "anonymous",
        avatar: row.avatar || null,
        followers: Number(row.followers || 0),
      },
      question: row.question_id
        ? {
            id: row.question_id,
            text: row.question_text || "(deleted)",
            category: row.question_category || "general",
          }
        : undefined,
    })
  );

const buildExpertiseMap = async (rows, category = "general") => {
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];

  if (!userIds.length) {
    return new Map();
  }

  const [userRows, badgeRows, categoryRows] = await Promise.all([
    db("users")
      .whereIn("id", userIds)
      .select("id", "stats", "ranking", "followers"),
    db("user_badges").whereIn("user_id", userIds).select("user_id", "badge_id"),
    db("answers as a")
      .join("questions as q", "q.id", "a.question_id")
      .whereIn("a.user_id", userIds)
      .andWhere("a.status", "approved")
      .andWhere("q.category", category)
      .select("a.user_id")
      .count("* as approved_count")
      .groupBy("a.user_id"),
  ]);

  const userMap = new Map(userRows.map((row) => [row.id, row]));
  const badgeMap = new Map();
  badgeRows.forEach((row) => {
    const existing = badgeMap.get(row.user_id) || new Set();
    existing.add(row.badge_id);
    badgeMap.set(row.user_id, existing);
  });
  const categoryCountMap = new Map(
    categoryRows.map((row) => [row.user_id, Number(row.approved_count || 0)])
  );

  const categoryLabel = learningService.getCategoryLabel(category);

  return new Map(
    userIds.map((userId) => {
      const userRow = userMap.get(userId) || {};
      const stats = parseMaybeJson(userRow.stats, {});
      const likesReceived = Number(stats.likesReceived || 0);
      const xp = Number(stats.xp || 0);
      const followers = Number(userRow.followers || 0);
      const ranking = Number(userRow.ranking || 1000);
      const approvedAnswers = Number(categoryCountMap.get(userId) || 0);
      const badges = badgeMap.get(userId) || new Set();
      const hasExpertBadge = badges.has("expert");

      const score = clamp(
        18 +
          approvedAnswers * 14 +
          Math.min(16, Math.floor(likesReceived / 10)) +
          Math.min(12, Math.floor(xp / 80)) +
          Math.min(10, Math.floor((ranking - 1000) / 25)) +
          Math.min(12, Math.floor(followers / 80)) +
          (hasExpertBadge ? 16 : 0),
        12,
        99
      );

      const verified =
        hasExpertBadge ||
        approvedAnswers >= 3 ||
        (approvedAnswers >= 2 && (likesReceived >= 12 || ranking >= 1125));

      const reason = hasExpertBadge
        ? "Badge expert + histori e forte"
        : approvedAnswers > 0
          ? `${approvedAnswers} answers te aprovuara ne ${categoryLabel}`
          : "Creator aktiv";

      return [
        userId,
        {
          verified,
          score,
          approvedAnswers,
          category,
          label: verified ? "Verified Expert" : "Trusted Creator",
          reason,
        },
      ];
    })
  );
};

const decorateAnswersWithExpertise = async (rows, category = "general") => {
  const expertiseMap = await buildExpertiseMap(rows, category);

  return rows.map((row) =>
    formatAnswer(row, {
      user: {
        username: row.username || "anonymous",
        avatar: row.avatar || null,
        followers: Number(row.followers || 0),
        expertise:
          expertiseMap.get(row.user_id) || {
            verified: false,
            score: 12,
            approvedAnswers: 0,
            category,
            label: "Trusted Creator",
            reason: "Creator aktiv",
          },
      },
      question: row.question_id
        ? {
            id: row.question_id,
            text: row.question_text || "(deleted)",
            category: row.question_category || "general",
          }
        : undefined,
    })
  );
};

const includeOwnPendingAnswers = (query, userId) => {
  if (!userId) {
    return query.andWhere("a.status", "approved");
  }

  return query.andWhere((builder) => {
    builder.where("a.status", "approved").orWhere((pendingBuilder) => {
      pendingBuilder.where("a.status", "pending").andWhere("a.user_id", userId);
    });
  });
};

const loadAnswerWithContext = async (answerId) => {
  const row = await db("answers as a")
    .leftJoin("users as u", "u.id", "a.user_id")
    .leftJoin("questions as q", "q.id", "a.question_id")
    .where("a.id", answerId)
    .select(
      "a.*",
      "u.username",
      "u.avatar",
      "u.followers",
      "q.text as question_text",
      "q.category as question_category"
    )
    .first();

  return row ? decorateAnswerRows([row])[0] : null;
};

const finalizePriorityExpertAnswer = async ({ question, actorUser, answer }) => {
  if (!question || !actorUser || !answer) {
    return null;
  }

  const completedRequest = await expertService.finalizeExpertRequestForAnswer({
    questionId: question.id,
    expertUserId: actorUser.id,
    answerId: answer.id,
  });

  if (!completedRequest) {
    return null;
  }

  await notificationService.notifyPriorityExpertAnswer({
    question,
    actorUser,
    answer,
    expertRequest: completedRequest,
  });

  return completedRequest;
};

const buildAnswerPrompt = ({ type, text, aiReview }) => {
  const explicitText = String(text || '').trim();
  if (explicitText) {
    return explicitText;
  }

  const transcript = String(aiReview?.transcript || '').trim();
  if (transcript && !transcript.startsWith('[Transcription unavailable')) {
    return transcript;
  }

  if (type === 'video') {
    return 'Pergjigje me video';
  }

  if (type === 'audio') {
    return 'Pergjigje me audio';
  }

  return 'Pergjigje e shkurter';
};

exports.listAnswers = async (req, res) => {
  const { status, userId } = req.query;

  try {
    let resolvedUserId = null;
    if (userId) {
      const user = await findUserByIdentifier(userId);
      if (!user) {
        return res.json([]);
      }
      resolvedUserId = user.id;
    }

    let query = db("answers as a")
      .leftJoin("users as u", "u.id", "a.user_id")
      .leftJoin("questions as q", "q.id", "a.question_id")
      .select(
        "a.*",
        "u.username",
        "u.avatar",
        "u.followers",
        "q.text as question_text",
        "q.category as question_category"
      )
      .orderBy("a.created_at", "desc");

    if (status) {
      query = query.where("a.status", status);
    }

    if (resolvedUserId) {
      query = query.andWhere("a.user_id", resolvedUserId);
    }

    res.json(decorateAnswerRows(await query));
  } catch (error) {
    console.error("List answers error:", error);
    res.status(500).json({ error: "Failed to get answers" });
  }
};

exports.addAnswer = async (req, res) => {
  const {
    countryContext = null,
    questionId,
    userId,
    type,
    contentUrl,
    text,
    duration,
    timeMode = "5s",
    responseTime,
    penaltyApplied = false,
    hashtagContext = null,
    seedInitialEngagement = false,
  } = req.body;

  if (!questionId || !type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    if (!isUuid(questionId)) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = await db("questions").where({ id: questionId }).first();
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (type === "video" && !contentUrl) {
      return res.status(400).json({ error: "Video URL required for video answers" });
    }

    if (type === "audio" && !contentUrl) {
      return res.status(400).json({ error: "Audio URL required for audio answers" });
    }

    const rawDuration = Math.round(Number(duration) || 5);
    const normalizedDuration =
      type === "text" ? null : Math.min(10, Math.max(1, rawDuration));
    const normalizedTimeMode = timeMode === "10s" ? "10s" : "5s";
    const normalizedResponseTime = Math.max(
      0,
      Math.min(10, Number(responseTime || normalizedDuration || 5))
    );
    const normalizedPenaltyApplied = Boolean(
      normalizedTimeMode === "10s" || penaltyApplied
    );

    if ((type === "video" || type === "audio") && rawDuration > 10) {
      return res.status(400).json({ error: "Answer too long (max 10 seconds)" });
    }

    if (!["5s", "10s"].includes(normalizedTimeMode)) {
      return res.status(400).json({ error: "Invalid time mode" });
    }

    if (type === "text" && (!text || text.trim().length === 0)) {
      return res.status(400).json({ error: "Text required for text answers" });
    }

    if (type === "text" && text.length > 70) {
      return res.status(400).json({ error: "Text too long (max 10 words)" });
    }

    const normalizedTextAnswer = String(text || "").trim();
    const isQuickTapAnswer =
      type === "text" && /^(po|jo|yes|no)$/i.test(normalizedTextAnswer);

    const actor = await ensureUser(userId || "demo_user");
    const resolvedCountry = resolveCountryCode(countryContext, question.country || actor.homeCountry || DEFAULT_COUNTRY_CODE);
    const existingAnswerCountRow = await db("answers")
      .where({ user_id: actor.id })
      .count("* as count")
      .first();
    const existingAnswerCount = Number(existingAnswerCountRow?.count || 0);
    const shouldSeedInitialEngagement =
      Boolean(seedInitialEngagement) && existingAnswerCount === 0;
    const seededInteractions = shouldSeedInitialEngagement
      ? buildInitialEngagementSeed()
      : {
          likes: 0,
          views: 0,
          saves: 0,
          shares: 0,
        };
    const questionMetadata = parseMaybeJson(question.metadata, {});
    const questionLanguage = normalizeLanguageCode(
      questionMetadata.language,
      DEFAULT_LANGUAGE
    );

    let aiResult;
    if (isQuickTapAnswer) {
      aiResult = {
        approved: true,
        fact: null,
        feedback: "Quick tap answer",
        score: 0.98,
        shortSummary: "Instant answer",
        transcript: normalizedTextAnswer,
      };
    } else {
      try {
        aiResult = await aiService.validateAnswer({
          type,
          contentUrl,
          text,
          questionText: question.text,
          langCode: questionLanguage,
        });
      } catch (error) {
        console.error("AI service error, falling back to simulated review:", error);
        aiResult = simulateAIReview();
      }
    }

    const transcript = String(aiResult?.transcript || "").trim();
    const answerLanguageSource = [
      question.text,
      type === "text"
        ? text
        : transcript && !transcript.startsWith("[Transcription unavailable")
          ? transcript
          : null,
    ]
      .filter(Boolean)
      .join(" ");
    const detectedLanguage = await detectLanguageFast(answerLanguageSource, {
      fallback: questionLanguage,
    });

    // MVP rule: answers should flow straight from Mirror into Feed.
    const approvedForFeed = true;

    const [createdRow] = await db("answers")
      .insert({
        question_id: questionId,
        user_id: actor.id,
        country: resolvedCountry,
        type,
        content_url: contentUrl || null,
        text: text || null,
        lang: detectedLanguage,
        time_mode: normalizedTimeMode,
        response_time: normalizedResponseTime,
        penalty_applied: normalizedPenaltyApplied,
        interactions: seededInteractions,
        battle_stats: {
          votes: 0,
        },
        ai_review: aiResult,
        duration: normalizedDuration,
        status: approvedForFeed ? "approved" : aiResult.approved ? "approved" : "pending",
        new_badges: "[]",
      })
      .returning("*");

    await updateUserStats(actor.id, (stats) => ({
      ...stats,
      answersGiven: (stats.answersGiven || 0) + 1,
      likesReceived: (stats.likesReceived || 0) + seededInteractions.likes,
    }));
    await growthService.recordAnswerPosted(actor.id);
    await referralService.activateReferralForUser(actor.id);

    const userWithBadges = await findUserByIdentifier(actor.id);
    const userAnswers = await loadAnswersByUser(actor.id);
    const newBadges = badgeService.unlockNewBadges(userWithBadges, userAnswers);
    await persistBadges(actor.id, newBadges);

    let answerRow = createdRow;
    const streak = await streakService.recordAnswerForUser(
      actor.id,
      createdRow.created_at || new Date()
    );

    await updateUserStats(actor.id, (stats) => ({
      ...stats,
      currentStreak: streak.current,
      bestStreak: Math.max(Number(stats.bestStreak || 0), streak.current),
    }));

    if (newBadges.length) {
      [answerRow] = await db("answers")
        .where({ id: createdRow.id })
        .update({
          new_badges: serializeBadgesForStorage(newBadges),
          updated_at: db.fn.now(),
        })
        .returning("*");
    }

    const attachedHashtags = await hashtagService.attachHashtagsToAnswer({
      answerId: answerRow.id,
      text: text || aiResult?.transcript || "",
      hashtagContext,
    });

    const completedExpertRequest =
      answerRow.status === "approved"
        ? await finalizePriorityExpertAnswer({
            question,
            actorUser: actor,
            answer: answerRow,
          })
        : null;

    if (question.user_id !== actor.id && !completedExpertRequest) {
      await notificationService.notifyQuestionAnswered({
        question,
        actorUser: actor,
        answer: answerRow,
      });
    }

    await engagementNotificationService.notifyFriendAnsweredAboutYou({
      question,
      actorUser: actor,
      answer: answerRow,
    });

    if (answerRow.status === "approved") {
      await notificationService.maybeNotifyCurrentTopAnswer({
        questionId,
        actorUserId: actor.id,
      });
    }

    const formattedAnswer = formatAnswer(answerRow, {
      user: {
        username: actor.username,
        avatar: actor.avatar,
        followers: actor.followers || 0,
      },
    });

    const answerPrompt = buildAnswerPrompt({
      type,
      text,
      aiReview: formattedAnswer.aiReview,
    });
    const aiCommentMeta = isQuickTapAnswer
      ? {
          comment: normalizedTextAnswer,
          emoji: normalizedTextAnswer.toLowerCase() === "po" ? "🔥" : "🧊",
          guardrail: false,
          langCode: detectedLanguage,
          style: "funny",
        }
      : await aiService.generateAICommentPayload({
          question: question.text,
          answer: answerPrompt,
          timeMode: normalizedTimeMode,
          langCode: detectedLanguage,
          aiReview: formattedAnswer.aiReview,
        });
    const aiTeam = isQuickTapAnswer
      ? null
      : await aiTeamService.queueAnswerTeamFlow({
          answerId: answerRow.id,
          answerText: answerPrompt,
          country: resolvedCountry,
          langCode: detectedLanguage,
          questionText: question.text,
          timeMode: normalizedTimeMode,
        });

    if (!isQuickTapAnswer) {
      void aiCopilotService
        .processEvent({
          eventType: "new_answer",
          content: text || formattedAnswer.aiReview?.transcript || "",
          metadata: {
            answerId: formattedAnswer.id,
            hashtags: attachedHashtags,
            langCode: detectedLanguage,
            questionId: question.id,
            questionText: question.text,
            country: resolvedCountry,
            status: formattedAnswer.status,
            timeMode: normalizedTimeMode,
            userId: actor.id,
          },
        })
        .catch((copilotError) => {
          console.warn("[AI Copilot] new_answer hook failed:", copilotError.message);
        });
    }

    res.json({
      ...formattedAnswer,
      hashtags: attachedHashtags,
      streak,
      aiComment: aiCommentMeta.comment,
      aiCommentMeta,
      sentiment: null,
      aiTeam,
      onboardingBoost: shouldSeedInitialEngagement ? seededInteractions : null,
    });
  } catch (error) {
    console.error("Add answer error:", error);
    res.status(500).json({ error: "Failed to create answer" });
  }
};

exports.getAnswersByQuestion = async (req, res) => {
  const { questionId } = req.params;
  const { sort = "top", userId, expertOnly } = req.query;

  try {
    if (!isUuid(questionId)) {
      return res.status(404).json({ error: "Question not found" });
    }

    let resolvedUserId = null;
    if (userId) {
      const user = await findUserByIdentifier(userId);
      resolvedUserId = user?.id || null;
    }

    const rows = await includeOwnPendingAnswers(
      db("answers as a")
        .leftJoin("users as u", "u.id", "a.user_id")
        .leftJoin("questions as q", "q.id", "a.question_id")
        .where("a.question_id", questionId)
        .select(
          "a.*",
          "u.username",
          "u.avatar",
          "u.followers",
          "q.text as question_text",
          "q.category as question_category"
        )
        .orderBy("a.created_at", "desc"),
      resolvedUserId
    );

    const category =
      rows[0]?.question_category ||
      (await db("questions").where({ id: questionId }).first("category"))?.category ||
      "general";

    let decorated = await decorateAnswersWithExpertise(rows, category);

    if (expertOnly === "true") {
      decorated = decorated.filter((answer) => answer.user?.expertise?.verified);
    }

    res.json(rankingService.rankAnswers(decorated, sort));
  } catch (error) {
    console.error("Get answers by question error:", error);
    res.status(500).json({ error: "Failed to get answers" });
  }
};

exports.getAnswerAiTeam = async (req, res) => {
  const { answerId } = req.params;

  try {
    if (!isUuid(answerId)) {
      return res.status(404).json({ error: "Answer not found" });
    }

    const answerExists = await db("answers").where({ id: answerId }).first("id");
    if (!answerExists) {
      return res.status(404).json({ error: "Answer not found" });
    }

    const teamFlow = await aiTeamService.getAnswerTeamFlow(answerId);
    res.json(teamFlow);
  } catch (error) {
    console.error("Get answer AI team error:", error);
    res.status(500).json({ error: "Failed to get answer AI team flow" });
  }
};

exports.interactWithAnswer = async (req, res) => {
  const { answerId } = req.params;
  const { type, userId } = req.body;

  if (!type || !["like", "view", "save", "share"].includes(type)) {
    return res.status(400).json({ error: "Invalid interaction type" });
  }

  try {
    const actor = await ensureUser(userId || "demo_user");
    const answerRow = await db("answers").where({ id: answerId }).first();
    if (!answerRow) {
      return res.status(404).json({ error: "Answer not found" });
    }

    const answer = formatAnswer(answerRow);
    const interactionKey = getInteractionKey(type);

    if (type === "share") {
      answer.interactions.shares = (answer.interactions.shares || 0) + 1;

      await db("answers").where({ id: answerId }).update({
        interactions: answer.interactions,
        updated_at: db.fn.now(),
      });

      await growthService.recordInteractionSignal({
        userId: actor.id,
        answer,
        type,
      });

      await aiSelfImprovementService.recordFeedback({
        userId: actor.id,
        answerId,
        taskType: "answer_ranking",
        signal: "share",
        sourceType: "answer_interaction",
        sourceId: answerId,
        country: answer.country,
        langCode: answer.lang,
        tags: [answer.timeMode === "10s" ? "deep" : "fast", "viral"],
        metadata: {
          category: answer.question?.category || null,
          questionId: answer.questionId,
        },
      });

      return res.json({
        share: true,
        shares: answer.interactions.shares,
      });
    }

    const existingInteraction = await db("interactions")
      .where({
        answer_id: answerId,
        user_id: actor.id,
        type,
      })
      .first();

    if (type === "like" && existingInteraction) {
      answer.interactions.likes = Math.max(0, answer.interactions.likes - 1);

      await db("interactions").where({ id: existingInteraction.id }).del();
      await db("answers").where({ id: answerId }).update({
        interactions: answer.interactions,
        updated_at: db.fn.now(),
      });

      await updateUserStats(answer.userId, (stats) => ({
        ...stats,
        likesReceived: Math.max(0, (stats.likesReceived || 0) - 1),
      }));

      await notificationService.maybeNotifyCurrentTopAnswer({
        questionId: answer.questionId,
        actorUserId: actor.id,
      });

      return res.json({ liked: false, likes: answer.interactions.likes });
    }

    if (existingInteraction) {
      return res.json({
        [type]: true,
        [interactionKey]: answer.interactions[interactionKey],
      });
    }

    answer.interactions[interactionKey] += 1;

    await db("answers").where({ id: answerId }).update({
      interactions: answer.interactions,
      updated_at: db.fn.now(),
    });

    await db("interactions").insert({
      answer_id: answerId,
      user_id: actor.id,
      type,
    });

    let newBadges = [];
    if (type === "like") {
      const author = await updateUserStats(answer.userId, (stats) => ({
        ...stats,
        likesReceived: (stats.likesReceived || 0) + 1,
      }));

      const userAnswers = await loadAnswersByUser(answer.userId);
      newBadges = badgeService.unlockNewBadges(author, userAnswers);
      await persistBadges(answer.userId, newBadges);

      await growthService.recordInteractionSignal({
        userId: actor.id,
        answer,
        type,
      });

      await aiSelfImprovementService.recordFeedback({
        userId: actor.id,
        answerId,
        taskType: "answer_ranking",
        signal: "like",
        sourceType: "answer_interaction",
        sourceId: answerId,
        country: answer.country,
        langCode: answer.lang,
        tags: [answer.timeMode === "10s" ? "deep" : "fast", "clear"],
        metadata: {
          category: answer.question?.category || null,
          questionId: answer.questionId,
        },
      });

      await notificationService.maybeNotifyCurrentTopAnswer({
        questionId: answer.questionId,
        actorUserId: actor.id,
      });
    }

    if (type === "save") {
      await growthService.recordInteractionSignal({
        userId: actor.id,
        answer,
        type,
      });

      await aiSelfImprovementService.recordFeedback({
        userId: actor.id,
        answerId,
        taskType: "answer_ranking",
        signal: "save",
        sourceType: "answer_interaction",
        sourceId: answerId,
        country: answer.country,
        langCode: answer.lang,
        tags: [answer.timeMode === "10s" ? "deep" : "fast", "actionable"],
        metadata: {
          category: answer.question?.category || null,
          questionId: answer.questionId,
        },
      });
    }

    res.json({
      [type]: true,
      [interactionKey]: answer.interactions[interactionKey],
      ...(newBadges.length ? { newBadges } : {}),
    });
  } catch (error) {
    console.error("Interact with answer error:", error);
    res.status(500).json({ error: "Failed to interact with answer" });
  }
};

exports.trackConsumption = async (req, res) => {
  const { answerId } = req.params;
  const { userId, watchTimeMs = 0, replayCount = 0, completed = false } = req.body;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const answer = await loadAnswerWithContext(answerId);

    if (!answer) {
      return res.status(404).json({ error: "Answer not found" });
    }

    await growthService.recordWatchSession({
      userId: actor.id,
      answer,
      watchTimeMs,
      replayCount,
      completed,
    });

    await aiSelfImprovementService.recordFeedback({
      userId: actor.id,
      answerId,
      taskType: "answer_ranking",
      signal: completed ? "complete" : "view",
      sourceType: "answer_consumption",
      sourceId: answerId,
      country: answer.country,
      langCode: answer.lang,
      tags: [answer.timeMode === "10s" ? "deep" : "fast"],
      metadata: {
        category: answer.question?.category || null,
        questionId: answer.questionId,
        replayCount: Math.max(0, Number(replayCount) || 0),
        watchTimeMs: Math.max(0, Number(watchTimeMs) || 0),
      },
    });

    res.json({ tracked: true });
  } catch (error) {
    console.error("Track consumption error:", error);
    res.status(500).json({ error: "Failed to track answer consumption" });
  }
};

exports.getPendingAnswers = async (req, res) => {
  try {
    const rows = await db("answers as a")
      .leftJoin("users as u", "u.id", "a.user_id")
      .leftJoin("questions as q", "q.id", "a.question_id")
      .where("a.status", "pending")
      .select(
        "a.*",
        "u.username",
        "u.avatar",
        "u.followers",
        "q.text as question_text",
        "q.category as question_category"
      )
      .orderBy("a.created_at", "desc");

    res.json(decorateAnswerRows(rows));
  } catch (error) {
    console.error("Get pending answers error:", error);
    res.status(500).json({ error: "Failed to get pending answers" });
  }
};

exports.approveAnswer = async (req, res) => {
  const { answerId } = req.params;

  try {
    const [answer] = await db("answers")
      .where({ id: answerId })
      .update({
        status: "approved",
        updated_at: db.fn.now(),
      })
      .returning("*");

    if (!answer) {
      return res.status(404).json({ error: "Answer not found" });
    }

    const question = await db("questions").where({ id: answer.question_id }).first();
    if (question) {
      const actorUser = await findUserByIdentifier(answer.user_id);
      await notificationService.notifyAnswerApproved({ answer, question });

      if (actorUser) {
        await finalizePriorityExpertAnswer({
          question,
          actorUser,
          answer,
        });
      }

      await notificationService.maybeNotifyCurrentTopAnswer({
        questionId: question.id,
      });
    }

    res.json({ approved: true, answer: formatAnswer(answer) });
  } catch (error) {
    console.error("Approve answer error:", error);
    res.status(500).json({ error: "Failed to approve answer" });
  }
};

exports.rejectAnswer = async (req, res) => {
  const { answerId } = req.params;

  try {
    const [answer] = await db("answers")
      .where({ id: answerId })
      .update({
        status: "rejected",
        updated_at: db.fn.now(),
      })
      .returning("*");

    if (!answer) {
      return res.status(404).json({ error: "Answer not found" });
    }

    res.json({ rejected: true, answer: formatAnswer(answer) });
  } catch (error) {
    console.error("Reject answer error:", error);
    res.status(500).json({ error: "Failed to reject answer" });
  }
};


