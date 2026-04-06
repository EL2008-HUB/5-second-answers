const { db } = require("../data/db");
const { findUserByIdentifier } = require("../data/helpers");
const notificationService = require("./notificationService");

const DEFAULT_REACTIONS = ["🔥", "😂", "😱", "💀", "❤️"];

const hashToColor = (input = "") => {
  const palette = ["#FF6B6B", "#FF8A00", "#3B82F6", "#14B8A6", "#E11D48", "#8B5CF6"];
  const value = String(input || "duet");
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return palette[Math.abs(hash) % palette.length];
};

const normalizeAnswerPreview = (value = "", fallback = "No answer") => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
};

const sanitizeSeconds = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.min(10, Math.round(parsed)));
};

const computeWinnerId = (session) => {
  const leftSeconds = sanitizeSeconds(session.user1_seconds);
  const rightSeconds = sanitizeSeconds(session.user2_seconds);

  if (leftSeconds === null || rightSeconds === null || leftSeconds === rightSeconds) {
    return null;
  }

  return leftSeconds < rightSeconds ? session.user1_id : session.user2_id;
};

const decorateParticipant = (user, answer, seconds) => ({
  answer: normalizeAnswerPreview(answer, "No answer submitted"),
  seconds: sanitizeSeconds(seconds),
  user: {
    avatarColor: hashToColor(user?.username || user?.id || "duet"),
    id: user?.id || null,
    name: user?.username || "anonymous",
  },
});

const loadDuetSessionRow = async (sessionId) =>
  db("duet_sessions as d")
    .leftJoin("users as u1", "u1.id", "d.user1_id")
    .leftJoin("users as u2", "u2.id", "d.user2_id")
    .where("d.id", sessionId)
    .select(
      "d.*",
      "u1.id as user1_ref_id",
      "u1.username as user1_username",
      "u2.id as user2_ref_id",
      "u2.username as user2_username"
    )
    .first();

const buildDuetData = (session) => {
  if (!session) {
    return null;
  }

  const user1 = {
    id: session.user1_ref_id || session.user1_id,
    username: session.user1_username || "user1",
  };
  const user2 = {
    id: session.user2_ref_id || session.user2_id,
    username: session.user2_username || "user2",
  };

  return {
    createdAt: session.created_at || null,
    expiresAt: session.expires_at || null,
    metadata: session.metadata || {},
    questionId: session.question_id || null,
    question: session.question_text,
    reactions: session.reaction_counts || {},
    sessionId: session.id,
    status: session.status,
    left: decorateParticipant(user1, session.user1_answer, session.user1_seconds),
    right: decorateParticipant(user2, session.user2_answer, session.user2_seconds),
    winnerId: session.winner_id || null,
  };
};

const notifyDuetChallenge = async ({ session, challenger, target }) => {
  if (!session || !challenger || !target) {
    return null;
  }

  return notificationService.createNotification({
    userId: target.id,
    actorUserId: challenger.id,
    type: "duet_challenge",
    title: `${challenger.username} te sfidoi`,
    message: "Ke 24 ore per t'u pergjigjur. Split-screen po te pret.",
    entityType: "duet_session",
    entityId: session.id,
    metadata: {
      duetSessionId: session.id,
      questionId: session.question_id || null,
      questionText: session.question_text,
      source: "duet_challenge",
    },
    sendPush: true,
  });
};

const notifyDuetComplete = async ({ session, responder }) => {
  if (!session || !responder || !session.user1_id) {
    return null;
  }

  return notificationService.createNotification({
    userId: session.user1_id,
    actorUserId: responder.id,
    type: "duet_complete",
    title: "Duet-i yt u kompletua",
    message: "Shiko krahasimin. Mund te dale screenshot i forte.",
    entityType: "duet_session",
    entityId: session.id,
    metadata: {
      duetSessionId: session.id,
      source: "duet_complete",
    },
    sendPush: true,
  });
};

const createChallengeSession = async ({
  questionId = null,
  questionText,
  user1Id,
  user2Id,
  answer,
  answerId = null,
  seconds,
}) => {
  if (!questionText || !user1Id || !user2Id) {
    throw new Error("Missing required duet fields");
  }

  const [row] = await db("duet_sessions")
    .insert({
      question_id: questionId,
      question_text: questionText,
      user1_id: user1Id,
      user1_answer_id: answerId,
      user1_answer: normalizeAnswerPreview(answer),
      user1_seconds: sanitizeSeconds(seconds),
      user2_id: user2Id,
      status: "pending",
      metadata: {
        mode: "challenge",
      },
    })
    .returning("*");

  const session = await loadDuetSessionRow(row.id);
  const [challenger, target] = await Promise.all([
    findUserByIdentifier(user1Id),
    findUserByIdentifier(user2Id),
  ]);

  await notifyDuetChallenge({ session, challenger, target });
  return buildDuetData(session);
};

const respondToSession = async ({
  sessionId,
  userId,
  answer,
  answerId = null,
  seconds,
}) => {
  const session = await db("duet_sessions")
    .where({
      id: sessionId,
      user2_id: userId,
      status: "pending",
    })
    .andWhere("expires_at", ">", new Date().toISOString())
    .first();

  if (!session) {
    return null;
  }

  const winnerId = computeWinnerId({
    ...session,
    user2_id: userId,
    user2_seconds: sanitizeSeconds(seconds),
  });

  await db("duet_sessions")
    .where({ id: sessionId })
    .update({
      user2_answer_id: answerId,
      user2_answer: normalizeAnswerPreview(answer),
      user2_seconds: sanitizeSeconds(seconds),
      status: "complete",
      winner_id: winnerId,
      updated_at: db.fn.now(),
    });

  const completed = await loadDuetSessionRow(sessionId);
  const responder = await findUserByIdentifier(userId);
  await notifyDuetComplete({ session: completed, responder });
  return buildDuetData(completed);
};

const createInstantComparison = async ({
  questionId = null,
  questionText,
  user1Id,
  user1Answer,
  user1AnswerId = null,
  user1Seconds,
  user2Id,
  user2Answer,
  user2AnswerId = null,
  user2Seconds,
  mode = "compare",
}) => {
  if (!questionText || !user1Id || !user2Id) {
    throw new Error("Missing required instant duet fields");
  }

  const winnerId = computeWinnerId({
    user1_id: user1Id,
    user1_seconds: sanitizeSeconds(user1Seconds),
    user2_id: user2Id,
    user2_seconds: sanitizeSeconds(user2Seconds),
  });

  const [row] = await db("duet_sessions")
    .insert({
      question_id: questionId,
      question_text: questionText,
      user1_id: user1Id,
      user1_answer_id: user1AnswerId,
      user1_answer: normalizeAnswerPreview(user1Answer),
      user1_seconds: sanitizeSeconds(user1Seconds),
      user2_id: user2Id,
      user2_answer_id: user2AnswerId,
      user2_answer: normalizeAnswerPreview(user2Answer),
      user2_seconds: sanitizeSeconds(user2Seconds),
      status: "complete",
      winner_id: winnerId,
      metadata: {
        mode,
      },
    })
    .returning("*");

  const session = await loadDuetSessionRow(row.id);
  return buildDuetData(session);
};

const createExposeSession = async ({
  questionId = null,
  questionText,
  myUserId,
  myAnswer,
  myAnswerId = null,
  mySeconds,
  opponentUserId,
  opponentAnswer,
  opponentAnswerId = null,
  opponentSeconds,
}) =>
  createInstantComparison({
    mode: "expose",
    questionId,
    questionText,
    user1Id: myUserId,
    user1Answer: myAnswer,
    user1AnswerId: myAnswerId,
    user1Seconds: mySeconds,
    user2Id: opponentUserId,
    user2Answer: opponentAnswer,
    user2AnswerId: opponentAnswerId,
    user2Seconds: opponentSeconds,
  });

const createRandomComparison = async ({
  questionId,
  questionText,
  myUserId,
  myAnswer,
  myAnswerId = null,
  mySeconds,
}) => {
  const opponentRow = await db("answers as a")
    .leftJoin("users as u", "u.id", "a.user_id")
    .where("a.question_id", questionId)
    .andWhere("a.status", "approved")
    .andWhereNot("a.user_id", myUserId)
    .select("a.*", "u.username")
    .orderByRaw("RANDOM()")
    .first();

  if (!opponentRow) {
    return null;
  }

  return createInstantComparison({
    mode: "random_compare",
    questionId,
    questionText,
    user1Id: myUserId,
    user1Answer: myAnswer,
    user1AnswerId: myAnswerId,
    user1Seconds: mySeconds,
    user2Id: opponentRow.user_id,
    user2Answer: opponentRow.text || `${opponentRow.type} answer`,
    user2AnswerId: opponentRow.id,
    user2Seconds: opponentRow.response_time || opponentRow.duration || 5,
  });
};

const getSession = async (sessionId) => {
  const session = await loadDuetSessionRow(sessionId);
  if (!session) {
    return null;
  }

  if (session.status === "pending" && session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
    await db("duet_sessions")
      .where({ id: sessionId })
      .update({
        status: "expired",
        updated_at: db.fn.now(),
      });

    const expired = await loadDuetSessionRow(sessionId);
    return buildDuetData(expired);
  }

  return buildDuetData(session);
};

const reactToSession = async ({ sessionId, emoji }) => {
  const reactionKey = String(emoji || "").trim();
  if (!DEFAULT_REACTIONS.includes(reactionKey)) {
    throw new Error("Invalid reaction");
  }

  const session = await db("duet_sessions").where({ id: sessionId }).first();
  if (!session) {
    return null;
  }

  const currentReactions = session.reaction_counts || {};
  const nextCount = Number(currentReactions[reactionKey] || 0) + 1;

  await db("duet_sessions")
    .where({ id: sessionId })
    .update({
      reaction_counts: {
        ...currentReactions,
        [reactionKey]: nextCount,
      },
      updated_at: db.fn.now(),
    });

  return getSession(sessionId);
};

const listPendingForUser = async (userId) => {
  const rows = await db("duet_sessions")
    .where({ user2_id: userId, status: "pending" })
    .andWhere("expires_at", ">", new Date().toISOString())
    .orderBy("created_at", "desc");

  const sessions = await Promise.all(rows.map((row) => getSession(row.id)));
  return sessions.filter(Boolean);
};

module.exports = {
  buildDuetData,
  createChallengeSession,
  createExposeSession,
  createRandomComparison,
  getSession,
  listPendingForUser,
  reactToSession,
  respondToSession,
};
