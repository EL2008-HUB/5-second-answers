const { db } = require("../data/db");
const notificationService = require("./notificationService");
const { getCountryConfig, resolveCountryCode } = require("../config/countryConfig");

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getDateKey = (value = new Date()) => new Date(value).toISOString().slice(0, 10);

const getDayStartIso = (value = new Date()) => {
  const day = new Date(value);
  day.setHours(0, 0, 0, 0);
  return day.toISOString();
};

const getYesterdayKey = () => {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return getDateKey(yesterday);
};

const ensureDailyQuestionPayload = async (countryCode) => {
  const resolvedCountry = resolveCountryCode(countryCode);
  const nowIso = new Date().toISOString();

  const existingQuestion = await db("questions")
    .where({
      country: resolvedCountry,
      is_daily: true,
    })
    .andWhere("expires_at", ">", nowIso)
    .orderBy("expires_at", "asc")
    .first("id", "text", "category", "country");

  if (existingQuestion?.id) {
    return existingQuestion;
  }

  try {
    const port = process.env.PORT || 5000;
    const response = await fetch(
      `http://127.0.0.1:${port}/api/questions/daily?userId=mirror_daily&country=${resolvedCountry}`
    );
    const payload = await response.json();
    const question = payload?.question || null;

    if (!response.ok || !question?.id) {
      return null;
    }

    return {
      category: question.category || "general",
      country: question.country || resolvedCountry,
      id: question.id,
      text: question.text,
    };
  } catch (error) {
    console.error("Ensure daily question payload error:", error);
    return null;
  }
};

const hasNotificationToday = async (userId, type) => {
  const existing = await db("notifications")
    .where({ user_id: userId, type })
    .andWhere("created_at", ">=", getDayStartIso())
    .first("id");

  return Boolean(existing?.id);
};

const loadMentionedUsers = async (questionText = "") => {
  const normalizedText = String(questionText || "").trim();
  if (!normalizedText) {
    return [];
  }

  const users = await db("users").select("id", "username");

  return users.filter((user) => {
    const username = String(user.username || "").trim();
    if (username.length < 3) {
      return false;
    }

    const pattern = new RegExp(
      `(^|[^a-zA-Z0-9_])@?${escapeRegex(username)}([^a-zA-Z0-9_]|$)`,
      "i"
    );

    return pattern.test(normalizedText);
  });
};

const getStreakMessage = (streakDays) => {
  if (streakDays >= 30) {
    return {
      title: "Dita 30+ eshte ne rrezik",
      message: "Ke edhe pak kohe. Mos e le rekordin te bjere sonte.",
    };
  }

  if (streakDays >= 14) {
    return {
      title: `${streakDays} dite, sonte mund te bjere`,
      message: "Nje answer. 5 sekonda. Mjafton per ta mbajtur gjalle.",
    };
  }

  return {
    title: "Streak-u yt eshte ne rrezik",
    message: `Dita ${streakDays} po mbyllet. Pergjigju tani.`,
  };
};

const HOT_NOTIFICATION_VARIANTS = [
  {
    id: "variant_1",
    title: "🔴 Dicka ndodhi...",
    message: "HOT question eshte live tani. Hape dhe jep instinktin tend perpara se te ftohet.",
  },
  {
    id: "variant_2",
    title: "😳 Njerezit po reagojne TANI",
    message: "Pergjigjet po hyjne me shpejtesi. Futu tani nese do te jesh pjese e vales.",
  },
  {
    id: "variant_3",
    title: "⏰ Ke 5 sek per kete...",
    message: "Një HOT question po mbyllet me countdown. Jep pergjigjen para se te ike momenti.",
  },
];

const pickHotNotificationVariant = (userId = "", challenge = null, question = null) => {
  const seed = `${userId}:${challenge?.hashtag || question?.id || "hot"}`;
  const index = [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0)
    % HOT_NOTIFICATION_VARIANTS.length;
  return HOT_NOTIFICATION_VARIANTS[index];
};

const notifyFriendAnsweredAboutYou = async ({ question, actorUser, answer }) => {
  if (!question?.text || !actorUser?.id || !answer?.id) {
    return [];
  }

  const mentionedUsers = await loadMentionedUsers(question.text);
  const recipients = mentionedUsers.filter(
    (user) => user.id !== actorUser.id && user.id !== question.user_id
  );

  return Promise.all(
    recipients.map((user) =>
      notificationService.createNotification({
        userId: user.id,
        actorUserId: actorUser.id,
        type: "friend_answered_about_you",
        title: `${actorUser.username} u pergjigj rreth teje`,
        message: "Hap app-in per ta pare. Mund te mos te pelqeje.",
        entityType: "question",
        entityId: question.id,
        metadata: {
          answerId: answer.id,
          answererId: actorUser.id,
          questionId: question.id,
          source: "friend_answered_about_you",
        },
        dedupe: true,
        sendPush: true,
      })
    )
  );
};

const notifyStreakAtRiskUsers = async () => {
  const yesterdayKey = getYesterdayKey();
  const rows = await db("user_streaks")
    .where("current_streak", ">", 2)
    .andWhere("last_answer_date", yesterdayKey)
    .select("user_id", "current_streak");

  let sent = 0;

  for (const row of rows) {
    if (await hasNotificationToday(row.user_id, "streak_at_risk")) {
      continue;
    }

    const copy = getStreakMessage(Number(row.current_streak || 0));
    const notification = await notificationService.createNotification({
      userId: row.user_id,
      type: "streak_at_risk",
      title: copy.title,
      message: copy.message,
      metadata: {
        autoOpenQuestion: true,
        source: "streak_at_risk",
      },
      sendPush: true,
    });

    if (notification) {
      sent += 1;
    }
  }

  return { sent };
};

const notifyGroupPressureUsers = async () => {
  const todayKey = getDateKey();
  const followRows = await db("user_follows").select("follower_user_id", "followed_user_id");
  const streakRows = await db("user_streaks").select("user_id", "last_answer_date");
  const streakMap = new Map(streakRows.map((row) => [row.user_id, row.last_answer_date]));
  const followsByUser = new Map();

  for (const row of followRows) {
    const existing = followsByUser.get(row.follower_user_id) || [];
    existing.push(row.followed_user_id);
    followsByUser.set(row.follower_user_id, existing);
  }

  let sent = 0;

  for (const [userId, followedUserIds] of followsByUser.entries()) {
    if (followedUserIds.length < 2) {
      continue;
    }

    if (streakMap.get(userId) === todayKey) {
      continue;
    }

    const answeredCount = followedUserIds.filter(
      (followedUserId) => streakMap.get(followedUserId) === todayKey
    ).length;

    if (answeredCount < Math.ceil(followedUserIds.length / 2) || answeredCount >= followedUserIds.length) {
      continue;
    }

    if (await hasNotificationToday(userId, "group_pressure")) {
      continue;
    }

    const notification = await notificationService.createNotification({
      userId,
      type: "group_pressure",
      title: `${answeredCount}/${followedUserIds.length} nga rrethi yt u pergjigjen`,
      message: "Ti ende jo. Jep nje answer dhe futu ne loje.",
      metadata: {
        answeredCount,
        autoOpenQuestion: true,
        source: "group_pressure",
        totalFollowed: followedUserIds.length,
      },
      sendPush: true,
    });

    if (notification) {
      sent += 1;
    }
  }

  return { sent };
};

const notifyHotQuestion = async ({ questionId, challenge = null, expiresInMinutes = 120 }) => {
  let question = null;
  if (questionId) {
    question = await db("questions").where({ id: questionId }).first();
    if (!question) {
      throw new Error("Question not found");
    }
  }

  if (!question && !challenge?.hashtag) {
    return { sent: 0 };
  }

  const activeRows = await db("answers as a")
    .join("users as u", "u.id", "a.user_id")
    .distinct("a.user_id", "u.home_country")
    .where("a.created_at", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  const questionCountry = resolveCountryCode(question?.country || null);
  const countryLabel = getCountryConfig(questionCountry).label;
  let sent = 0;

  for (const row of activeRows) {
    const userId = row.user_id;
    const homeCountry = resolveCountryCode(row.home_country || null);
    const variant = pickHotNotificationVariant(userId, challenge, question);
    const isHomeCountryMatch = question && homeCountry === questionCountry;
    const title = question
      ? isHomeCountryMatch
        ? `🔴 Dicka ndodhi ne ${countryLabel}...`
        : "🌍 Bota po reagon tani..."
      : `${challenge.title} po ndizet tani`;
    const message = question
      ? isHomeCountryMatch
        ? "HOT question eshte live tani ne vendin tend. Hape dhe reago para se te ftohet."
        : `${countryLabel} po reagon fort tani. Hape dhe shiko si do pergjigjeshe ti.`
      : `Bashkohu ne #${challenge.hashtag} para se te mbyllet.`;
    const notification = await notificationService.createNotification({
      userId,
      type: "hot_question",
      title,
      message,
      entityType: question ? "question" : "challenge",
      entityId: question?.id || null,
      metadata: {
        category: question?.category || "challenge",
        countryCode: questionCountry,
        countryLabel,
        expiresInMinutes,
        experimentName: "hot_question_push_v1",
        experimentVariant: question
          ? `${variant.id}_${isHomeCountryMatch ? "local" : "global"}`
          : "challenge_default",
        hashtagContext: challenge?.hashtag || null,
        notificationScope: isHomeCountryMatch ? "local" : "global",
        questionId: question?.id || null,
        questionText: question?.text || challenge?.title || null,
        source: "hot_question",
      },
      dedupe: true,
      sendPush: true,
    });

    if (notification) {
      sent += 1;
    }
  }

  return { sent };
};

const notifyDailyQuestionLiveUsers = async ({
  countryCode = null,
  question = null,
  questionId = null,
} = {}) => {
  let resolvedQuestion = question;

  if (!resolvedQuestion?.id && questionId) {
    resolvedQuestion = await db("questions")
      .where({ id: questionId })
      .first("id", "text", "category", "country");
  }

  const resolvedCountry = resolveCountryCode(
    countryCode || resolvedQuestion?.country || null
  );

  if (!resolvedQuestion?.id) {
    resolvedQuestion = await ensureDailyQuestionPayload(resolvedCountry);
  }

  if (!resolvedQuestion?.id) {
    return { sent: 0 };
  }

  const recipientRows = await db("user_push_tokens as upt")
    .join("users as u", "u.id", "upt.user_id")
    .distinct("upt.user_id")
    .where({
      "upt.is_active": true,
      "u.home_country": resolvedCountry,
    });

  let sent = 0;

  for (const row of recipientRows) {
    if (await hasNotificationToday(row.user_id, "daily_question_live")) {
      continue;
    }

    const notification = await notificationService.createNotification({
      userId: row.user_id,
      type: "daily_question_live",
      title: "Daily question eshte live",
      message: `Sot: "${resolvedQuestion.text}"`,
      entityType: "question",
      entityId: resolvedQuestion.id,
      metadata: {
        autoOpenQuestion: true,
        category: resolvedQuestion.category || "general",
        countryCode: resolvedCountry,
        questionId: resolvedQuestion.id,
        questionText: resolvedQuestion.text,
        source: "daily_question_live",
      },
      dedupe: true,
      sendPush: true,
    });

    if (notification) {
      sent += 1;
    }
  }

  return {
    countryCode: resolvedCountry,
    questionId: resolvedQuestion.id,
    sent,
  };
};

const loadMutualFollowFriendIds = async (userId) => {
  const followingRows = await db("user_follows")
    .where({ follower_user_id: userId })
    .pluck("followed_user_id");

  if (!followingRows.length) {
    return [];
  }

  const mutualRows = await db("user_follows")
    .where({ followed_user_id: userId })
    .whereIn("follower_user_id", followingRows)
    .pluck("follower_user_id");

  return mutualRows;
};

const notifyFriendsOfEmotionScore = async ({
  userId,
  badge,
  primaryEmotion,
  sessionId = null,
}) => {
  if (!userId || !badge) {
    return { sent: 0 };
  }

  const user = await db("users").where({ id: userId }).first("id", "username");
  if (!user) {
    return { sent: 0 };
  }

  const friendIds = await loadMutualFollowFriendIds(userId);
  let sent = 0;

  for (const friendId of friendIds) {
    const notification = await notificationService.createNotification({
      userId: friendId,
      actorUserId: user.id,
      type: "emotion_score_shared",
      title: `${user.username} doli "${badge}"`,
      message: "Hap app-in dhe shiko nese je dakord me rezultatin.",
      entityType: "story_session",
      entityId: sessionId,
      metadata: {
        primaryEmotion,
        source: "emotion_score_shared",
        storySessionId: sessionId,
        userId: user.id,
      },
      sendPush: true,
    });

    if (notification) {
      sent += 1;
    }
  }

  return { sent };
};

module.exports = {
  notifyDailyQuestionLiveUsers,
  notifyFriendAnsweredAboutYou,
  notifyFriendsOfEmotionScore,
  notifyGroupPressureUsers,
  notifyHotQuestion,
  notifyStreakAtRiskUsers,
};
