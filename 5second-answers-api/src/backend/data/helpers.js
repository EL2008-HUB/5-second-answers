const { db } = require("./db");
const { DEFAULT_COUNTRY_CODE } = require("../config/countryConfig");

const DEFAULT_STATS = {
  answersGiven: 0,
  likesReceived: 0,
  questionsAsked: 0,
  xp: 0,
  battleVotesReceived: 0,
  currentStreak: 0,
  bestStreak: 0,
  missionsCompleted: 0,
};

const DEFAULT_INTERACTIONS = {
  likes: 0,
  views: 0,
  saves: 0,
  shares: 0,
};

const DEFAULT_AI_REVIEW = {
  approved: false,
  feedback: null,
  score: 0,
  shortSummary: null,
  transcript: null,
  fact: null,
};

const DEFAULT_BATTLE_STATS = {
  votes: 0,
};

const parseMaybeJson = (value, fallback) => {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  return value;
};

const QUESTION_META_PAREN_PATTERN = /\(([^()]*)\)/g;

const sanitizeQuestionText = (value) => {
  let text = String(value || "")
    .replace(/\*\*/g, "")
    .replace(/[_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  let previous = null;
  while (previous !== text) {
    previous = text;
    text = text.replace(QUESTION_META_PAREN_PATTERN, (match, inner) => {
      const meta = String(inner || "").trim();
      if (
        /\b(emotional|emotionale|provokuese|provocative|provok|fjale|words?|shqip|english|deutsch|francais|italiano|espanol|portugues|japanese|vetem|reply|respond|answer|question|max|tone|style|output)\b/i.test(
          meta
        )
      ) {
        return "";
      }

      return match;
    });
  }

  return text
    .replace(/\s+\?/g, "?")
    .replace(/\s+\!/g, "!")
    .replace(/\s+\./g, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .trim();
};

const formatBadge = (row) => ({
  id: row.id || row.badge_id,
  name: row.name,
  emoji: row.emoji,
  description: row.description || "",
  category: row.category,
  criteria: parseMaybeJson(row.criteria, {}),
  order: row.order || 0,
  awardedBy: row.awarded_by || row.awardedBy || null,
  unlockedAt:
    row.unlocked_at || row.unlockedAt || row.created_at || row.createdAt || null,
});

const formatUser = (row, badges = []) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  avatar: row.avatar || null,
  homeCountry: row.home_country || row.homeCountry || DEFAULT_COUNTRY_CODE,
  followers: Number(row.followers || 0),
  ranking: Number(row.ranking || 0),
  stats: {
    ...DEFAULT_STATS,
    ...parseMaybeJson(row.stats, DEFAULT_STATS),
  },
  badges,
  createdAt: row.created_at || row.createdAt || null,
  updatedAt: row.updated_at || row.updatedAt || null,
});

const formatQuestion = (row, extras = {}) => ({
  id: row.id,
  text: sanitizeQuestionText(row.text),
  category: row.category || "general",
  country: row.country || DEFAULT_COUNTRY_CODE,
  userId: row.user_id || row.userId,
  views: Number(row.views || 0),
  status: row.status || "active",
  aiReviewed: Boolean(row.ai_reviewed ?? row.aiReviewed ?? false),
  metadata: parseMaybeJson(row.metadata, {}),
  createdAt: row.created_at || row.createdAt || null,
  updatedAt: row.updated_at || row.updatedAt || null,
  ...extras,
});

const formatAnswer = (row, extras = {}) => ({
  id: row.id,
  questionId: row.question_id || row.questionId,
  userId: row.user_id || row.userId,
  country: row.country || DEFAULT_COUNTRY_CODE,
  type: row.type,
  contentUrl: row.content_url || row.contentUrl || null,
  text: row.text || null,
  duration: row.duration ?? null,
  lang: row.lang || row.language || "en",
  timeMode: row.time_mode || row.timeMode || "5s",
  responseTime:
    row.response_time === null || row.response_time === undefined
      ? null
      : Number(row.response_time),
  penaltyApplied: Boolean(row.penalty_applied ?? row.penaltyApplied ?? false),
  interactions: {
    ...DEFAULT_INTERACTIONS,
    ...parseMaybeJson(row.interactions, DEFAULT_INTERACTIONS),
  },
  aiReview: {
    ...DEFAULT_AI_REVIEW,
    ...parseMaybeJson(row.ai_review || row.aiReview, DEFAULT_AI_REVIEW),
  },
  battleStats: {
    ...DEFAULT_BATTLE_STATS,
    ...parseMaybeJson(
      row.battle_stats || row.battleStats,
      DEFAULT_BATTLE_STATS
    ),
  },
  status: row.status || "pending",
  newBadges: parseMaybeJson(row.new_badges || row.newBadges, []),
  createdAt: row.created_at || row.createdAt || null,
  updatedAt: row.updated_at || row.updatedAt || null,
  ...extras,
});

const formatNotification = (row, extras = {}) => ({
  id: row.id,
  userId: row.user_id || row.userId,
  actorUserId: row.actor_user_id || row.actorUserId || null,
  type: row.type,
  entityType: row.entity_type || row.entityType || null,
  entityId: row.entity_id || row.entityId || null,
  title: row.title,
  message: row.message,
  metadata: parseMaybeJson(row.metadata, {}),
  read: Boolean(row.read_at || row.readAt),
  readAt: row.read_at || row.readAt || null,
  createdAt: row.created_at || row.createdAt || null,
  updatedAt: row.updated_at || row.updatedAt || null,
  actor:
    row.actor_user_id || row.actorUserId
      ? {
          id: row.actor_user_id || row.actorUserId,
          username: row.actor_username || row.actorUsername || null,
          avatar: row.actor_avatar || row.actorAvatar || null,
        }
      : null,
  ...extras,
});

const getUserBadgeRows = async (userId) =>
  db("user_badges as ub")
    .join("badges as b", "b.id", "ub.badge_id")
    .where("ub.user_id", userId)
    .select("b.*", "ub.awarded_by", "ub.created_at as unlocked_at")
    .orderBy("b.order", "asc");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => UUID_PATTERN.test(String(value || ""));

const findUserRowByIdentifier = async (identifier) => {
  if (!identifier) {
    return db("users").orderBy("created_at", "asc").first();
  }

  if (isUuid(identifier)) {
    const byId = await db("users").where({ id: identifier }).first();
    if (byId) {
      return byId;
    }
  }

  return db("users").where({ username: identifier }).first();
};

const findUserByIdentifier = async (identifier) => {
  const row = await findUserRowByIdentifier(identifier);
  if (!row) {
    return null;
  }

  const badges = (await getUserBadgeRows(row.id)).map(formatBadge);
  return formatUser(row, badges);
};

const sanitizeUsername = (value) => {
  const fallback = `user_${Date.now()}`;
  const username = String(value || fallback).trim().replace(/\s+/g, "_");
  return username || fallback;
};

const toLocalEmail = (username) => {
  const safe = username.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
  return `${safe}@local.5second`;
};

const ensureUser = async (identifier) => {
  const existing = await findUserByIdentifier(identifier || "demo_user");
  if (existing) {
    return existing;
  }

  const username = sanitizeUsername(identifier || "demo_user");
  const [inserted] = await db("users")
    .insert({
      username,
      email: toLocalEmail(username),
      avatar: null,
      stats: DEFAULT_STATS,
      followers: 0,
      ranking: 1000,
      home_country: DEFAULT_COUNTRY_CODE,
    })
    .returning("*");

  return findUserByIdentifier(inserted.id);
};

const updateUserStats = async (userId, updater) => {
  const row = await db("users").where({ id: userId }).first();
  if (!row) {
    return null;
  }

  const currentStats = {
    ...DEFAULT_STATS,
    ...parseMaybeJson(row.stats, DEFAULT_STATS),
  };

  const nextStats = updater({ ...currentStats });

  await db("users").where({ id: userId }).update({
    stats: nextStats,
    updated_at: db.fn.now(),
  });

  return findUserByIdentifier(userId);
};

const persistBadges = async (userId, badges = [], awardedBy = "system") => {
  if (!badges.length) {
    return;
  }

  await db("user_badges")
    .insert(
      badges.map((badge) => ({
        user_id: userId,
        badge_id: badge.id,
        awarded_by: awardedBy,
      }))
    )
    .onConflict(["user_id", "badge_id"])
    .ignore();
};

const loadAnswersByUser = async (userId, options = {}) => {
  let query = db("answers").where({ user_id: userId });

  if (options.status) {
    query = query.andWhere({ status: options.status });
  }

  const rows = await query.orderBy("created_at", "desc");
  return rows.map(formatAnswer);
};

module.exports = {
  DEFAULT_AI_REVIEW,
  DEFAULT_BATTLE_STATS,
  DEFAULT_INTERACTIONS,
  DEFAULT_STATS,
  ensureUser,
  findUserByIdentifier,
  formatAnswer,
  formatBadge,
  formatNotification,
  formatQuestion,
  formatUser,
  getUserBadgeRows,
  isUuid,
  loadAnswersByUser,
  parseMaybeJson,
  persistBadges,
  sanitizeQuestionText,
  updateUserStats,
  UUID_PATTERN,
};


