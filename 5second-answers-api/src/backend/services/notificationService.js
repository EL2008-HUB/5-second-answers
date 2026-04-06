const { db } = require("../data/db");
const { formatAnswer, formatNotification } = require("../data/helpers");
const rankingService = require("./rankingService");

const loadQuestionById = async (questionId) =>
  db("questions").where({ id: questionId }).first();

const loadAnswerById = async (answerId) =>
  db("answers").where({ id: answerId }).first();

const loadQuestionAnswers = async (questionId) => {
  const rows = await db("answers as a")
    .leftJoin("users as u", "u.id", "a.user_id")
    .where("a.question_id", questionId)
    .andWhere("a.status", "approved")
    .select("a.*", "u.username", "u.avatar")
    .orderBy("a.created_at", "desc");

  return rows.map((row) =>
    formatAnswer(row, {
      user: {
        username: row.username || "anonymous",
        avatar: row.avatar || null,
      },
    })
  );
};

const loadNotificationRows = async (userId, filter = "all") => {
  let query = db("notifications as n")
    .leftJoin("users as actor", "actor.id", "n.actor_user_id")
    .where("n.user_id", userId)
    .select(
      "n.*",
      "actor.username as actor_username",
      "actor.avatar as actor_avatar"
    )
    .orderBy("n.created_at", "desc");

  if (filter === "unread") {
    query = query.whereNull("n.read_at");
  }

  return query;
};

const buildNavigationMetadata = (metadata = {}) =>
  Object.entries(metadata || {}).reduce((accumulator, [key, value]) => {
    if (value !== undefined) {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});

const createNotification = async ({
  userId,
  actorUserId = null,
  type,
  title,
  message,
  entityType = null,
  entityId = null,
  metadata = {},
  dedupe = false,
  sendPush = false,
}) => {
  if (!userId || !type || !title || !message) {
    return null;
  }

  if (actorUserId && userId === actorUserId) {
    return null;
  }

  if (dedupe) {
    const existing = await db("notifications")
      .where({
        user_id: userId,
        type,
        entity_type: entityType,
        entity_id: entityId,
      })
      .modify((queryBuilder) => {
        if (actorUserId) {
          queryBuilder.andWhere({ actor_user_id: actorUserId });
        } else {
          queryBuilder.whereNull("actor_user_id");
        }
      })
      .first();

    if (existing) {
      return formatNotification(existing);
    }
  }

  const [row] = await db("notifications")
    .insert({
      user_id: userId,
      actor_user_id: actorUserId,
      type,
      entity_type: entityType,
      entity_id: entityId,
      title,
      message,
      metadata: buildNavigationMetadata(metadata),
    })
    .returning("*");

  const [decorated] = await db("notifications as n")
    .leftJoin("users as actor", "actor.id", "n.actor_user_id")
    .where("n.id", row.id)
    .select("n.*", "actor.username as actor_username", "actor.avatar as actor_avatar");

  const formatted = formatNotification(decorated || row);

  if (sendPush) {
    try {
      const pushNotificationService = require("./pushNotificationService");
      await pushNotificationService.deliverPushToUsers({
        userIds: [userId],
        title,
        body: message,
        type,
        data: {
          notificationId: formatted.id,
          ...buildNavigationMetadata(metadata),
        },
        notificationIdsByUserId: new Map([[userId, formatted.id]]),
      });
    } catch (error) {
      console.error("Push delivery error:", error);
    }
  }

  return formatted;
};

const listNotifications = async (userId, filter = "all") => {
  const rows = await loadNotificationRows(userId, filter);
  return rows.map(formatNotification);
};

const markNotificationRead = async (notificationId, userId) => {
  const [row] = await db("notifications")
    .where({ id: notificationId, user_id: userId })
    .update({
      read_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning("*");

  if (!row) {
    return null;
  }

  const [decorated] = await db("notifications as n")
    .leftJoin("users as actor", "actor.id", "n.actor_user_id")
    .where("n.id", row.id)
    .select("n.*", "actor.username as actor_username", "actor.avatar as actor_avatar");

  return formatNotification(decorated || row);
};

const markAllNotificationsRead = async (userId) => {
  await db("notifications")
    .where({ user_id: userId })
    .whereNull("read_at")
    .update({
      read_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
};

const getNotificationExperimentStats = async ({
  experimentName = "hot_question_push_v1",
  type = "hot_question",
} = {}) => {
  const rows = await db("notifications")
    .where({ type })
    .andWhere("created_at", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .select("id", "metadata", "read_at");

  const relevantRows = rows.filter(
    (row) => row.metadata?.experimentName === experimentName && row.metadata?.experimentVariant
  );
  const aggregate = new Map();

  relevantRows.forEach((row) => {
    const key = row.metadata?.experimentVariant;
    const current = aggregate.get(key) || { opened: 0, sent: 0, variant: key };
    current.sent += 1;
    if (row.read_at) {
      current.opened += 1;
    }
    aggregate.set(key, current);
  });

  const variants = [...aggregate.values()]
    .map((item) => ({
      ...item,
      openRate: item.sent ? Number((item.opened / item.sent).toFixed(2)) : 0,
    }))
    .sort((left, right) => right.openRate - left.openRate);

  return {
    experimentName,
    totalOpened: variants.reduce((sum, item) => sum + item.opened, 0),
    totalSent: variants.reduce((sum, item) => sum + item.sent, 0),
    variants,
  };
};

const notifyQuestionAnswered = async ({ question, actorUser, answer }) => {
  if (!question || !actorUser || !answer) {
    return null;
  }

  return createNotification({
    userId: question.user_id,
    actorUserId: actorUser.id,
    type: "new_answer",
    title: "Dikush iu pergjigj pyetjes tende",
    message: `@${actorUser.username} solli nje pergjigje te re te "${question.text}"`,
    entityType: "question",
    entityId: question.id,
    metadata: {
      questionId: question.id,
      answerId: answer.id,
      source: "question_answered",
    },
    sendPush: true,
  });
};

const notifyNewFollower = async ({ targetUser, actorUser }) => {
  if (!targetUser || !actorUser) {
    return null;
  }

  return createNotification({
    userId: targetUser.id,
    actorUserId: actorUser.id,
    type: "new_follower",
    title: "Ke nje ndjekes te ri",
    message: `@${actorUser.username} filloi te te ndjeke.`,
    entityType: "user",
    entityId: actorUser.id,
    metadata: {
      source: "follow",
    },
    dedupe: true,
    sendPush: true,
  });
};

const notifyAnswerApproved = async ({ answer, question }) => {
  if (!answer || !question) {
    return null;
  }

  return createNotification({
    userId: answer.user_id,
    type: "approved",
    title: "Pergjigjja jote u publikua",
    message: `Pergjigjja jote per "${question.text}" tashme eshte live.`,
    entityType: "answer",
    entityId: answer.id,
    metadata: {
      questionId: question.id,
      answerId: answer.id,
      source: "answer_approved",
    },
    dedupe: true,
    sendPush: true,
  });
};

const notifyPriorityExpertRequest = async ({
  question,
  requesterUser,
  expertUser,
  expertRequest,
}) => {
  if (!question || !requesterUser || !expertUser || !expertRequest) {
    return null;
  }

  return createNotification({
    userId: expertUser.id,
    actorUserId: requesterUser.id,
    type: "expert_request",
    title: "Pyetje prioritare nga Ask Experts",
    message: `@${requesterUser.username} te dergoi nje pyetje prioritare per ${expertRequest.priceLabel}: "${question.text}"`,
    entityType: "question",
    entityId: question.id,
    metadata: {
      questionId: question.id,
      source: "expert_request",
    },
    dedupe: true,
    sendPush: true,
  });
};

const notifyPriorityExpertAnswer = async ({
  question,
  actorUser,
  answer,
  expertRequest,
}) => {
  if (!question || !actorUser || !answer || !expertRequest) {
    return null;
  }

  return createNotification({
    userId: expertRequest.requesterUserId,
    actorUserId: actorUser.id,
    type: "expert_answer",
    title: "Pergjigjja e ekspertit mberriti",
    message: `@${actorUser.username} iu pergjigj pyetjes tende prioritare: "${question.text}"`,
    entityType: "answer",
    entityId: answer.id,
    metadata: {
      questionId: question.id,
      answerId: answer.id,
      source: "expert_answer",
    },
    dedupe: true,
    sendPush: true,
  });
};

const maybeNotifyCurrentTopAnswer = async ({ questionId, actorUserId = null }) => {
  if (!questionId) {
    return null;
  }

  const question = await loadQuestionById(questionId);
  if (!question) {
    return null;
  }

  const approvedAnswers = await loadQuestionAnswers(questionId);
  if (!approvedAnswers.length) {
    return null;
  }

  const [topAnswer] = rankingService.rankAnswers(approvedAnswers, "top");
  if (!topAnswer?.id || !topAnswer.userId) {
    return null;
  }

  return createNotification({
    userId: topAnswer.userId,
    actorUserId,
    type: "top_answer",
    title: "Pergjigjja jote eshte ne krye",
    message: `Pergjigjja jote po kryeson te "${question.text}"`,
    entityType: "answer",
    entityId: topAnswer.id,
    metadata: {
      questionId: question.id,
      answerId: topAnswer.id,
      source: "top_answer",
    },
    dedupe: true,
    sendPush: true,
  });
};

module.exports = {
  createNotification,
  getNotificationExperimentStats,
  listNotifications,
  loadAnswerById,
  loadQuestionById,
  markAllNotificationsRead,
  markNotificationRead,
  maybeNotifyCurrentTopAnswer,
  notifyAnswerApproved,
  notifyNewFollower,
  notifyPriorityExpertAnswer,
  notifyPriorityExpertRequest,
  notifyQuestionAnswered,
};
