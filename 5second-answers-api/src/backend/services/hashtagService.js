const { db } = require("../data/db");
const { formatAnswer } = require("../data/helpers");
const engagementNotificationService = require("./engagementNotificationService");
const socialIngestionService = require("./socialIngestionService");

const DEFAULT_PAGE_SIZE = 20;

const normalizeHashtag = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_\u00c0-\u017f]/gi, "");

const extractHashtags = (text = "") => {
  const matches = String(text || "").match(/#[\w\u00C0-\u017F]+/g) || [];
  return [...new Set(matches.map((entry) => normalizeHashtag(entry)).filter(Boolean))];
};

const parseHashtagContext = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return [...new Set(value.map((entry) => normalizeHashtag(entry)).filter(Boolean))];
  }

  return [...new Set(String(value).split(/[,\s]+/).map((entry) => normalizeHashtag(entry)).filter(Boolean))];
};

const incrementChallengeEntries = async (hashtag) => {
  await db("challenges")
    .where({ hashtag, is_active: true })
    .andWhere((builder) => {
      builder.whereNull("ends_at").orWhere("ends_at", ">", new Date().toISOString());
    })
    .increment("entry_count", 1)
    .update({
      updated_at: db.fn.now(),
    });
};

const ensureHashtag = async (name) => {
  const [row] = await db("hashtags")
    .insert({
      name,
      post_count: 0,
    })
    .onConflict("name")
    .ignore()
    .returning("*");

  if (row) {
    return row;
  }

  return db("hashtags").where({ name }).first();
};

const attachHashtagsToAnswer = async ({ answerId, text, hashtagContext }) => {
  const tags = [
    ...new Set([...extractHashtags(text), ...parseHashtagContext(hashtagContext)]),
  ];

  if (!answerId || !tags.length) {
    return [];
  }

  const attachedTags = [];

  for (const tag of tags) {
    const hashtag = await ensureHashtag(tag);
    if (!hashtag?.id) {
      continue;
    }

    const inserted = await db("answer_hashtags")
      .insert({
        answer_id: answerId,
        hashtag_id: hashtag.id,
      })
      .onConflict(["answer_id", "hashtag_id"])
      .ignore();

    const insertedCount = Array.isArray(inserted) ? inserted.length : Number(inserted || 0);
    if (insertedCount === 0) {
      continue;
    }

    await db("hashtags")
      .where({ id: hashtag.id })
      .increment("post_count", 1)
      .update({
        updated_at: db.fn.now(),
      });

    await incrementChallengeEntries(tag);
    attachedTags.push(tag);
  }

  return attachedTags;
};

const getTrendingHashtags = async ({ limit = 10 } = {}) => {
  const rows = await db("hashtags")
    .select("id", "name", "post_count", "created_at")
    .orderBy("post_count", "desc")
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(25, Number(limit) || 10)));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    postCount: Number(row.post_count || 0),
    createdAt: row.created_at || null,
  }));
};

const getActiveChallenges = async () => {
  const rows = await db("challenges")
    .where({ is_active: true })
    .andWhere((builder) => {
      builder.whereNull("ends_at").orWhere("ends_at", ">", new Date().toISOString());
    })
    .orderBy("entry_count", "desc")
    .orderBy("ends_at", "asc");

  return rows.map((row) => ({
    description: row.description || "",
    endsAt: row.ends_at || null,
    entryCount: Number(row.entry_count || 0),
    hashtag: row.hashtag,
    id: row.id,
    isActive: Boolean(row.is_active),
    startsAt: row.starts_at || null,
    title: row.title,
  }));
};

const getHashtagStats = async (hashtag) => {
  const normalized = normalizeHashtag(hashtag);
  if (!normalized) {
    return null;
  }

  const row = await db("hashtags").where({ name: normalized }).first();
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    postCount: Number(row.post_count || 0),
  };
};

const getHashtagFeed = async ({ hashtag, page = 0, limit = DEFAULT_PAGE_SIZE }) => {
  const normalized = normalizeHashtag(hashtag);
  const safeLimit = Math.max(1, Math.min(30, Number(limit) || DEFAULT_PAGE_SIZE));
  const safePage = Math.max(0, Number(page) || 0);

  if (!normalized) {
    return [];
  }

  const rows = await db("answer_hashtags as ah")
    .join("hashtags as h", "h.id", "ah.hashtag_id")
    .join("answers as a", "a.id", "ah.answer_id")
    .leftJoin("users as u", "u.id", "a.user_id")
    .leftJoin("questions as q", "q.id", "a.question_id")
    .where("h.name", normalized)
    .andWhere("a.status", "approved")
    .select(
      "a.*",
      "u.username",
      "u.avatar",
      "u.followers",
      "q.text as question_text",
      "q.category as question_category"
    )
    .orderBy("a.created_at", "desc")
    .limit(safeLimit * 2)
    .offset(safePage * safeLimit);

  const nativeAnswers = rows.map((row) =>
    formatAnswer(row, {
      source: "native",
      question: row.question_id
        ? {
            id: row.question_id,
            text: row.question_text || "(deleted)",
            category: row.question_category || "general",
          }
        : undefined,
      user: {
        username: row.username || "anonymous",
        avatar: row.avatar || null,
        followers: Number(row.followers || 0),
      },
    })
  );

  const importedPosts = await socialIngestionService.getImportedPostsByHashtag({
    hashtag: normalized,
    page: safePage,
    limit: safeLimit * 2,
  });

  return [...nativeAnswers, ...importedPosts]
    .sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, safeLimit);
};

const createChallenge = async ({
  hashtag,
  title,
  description = "",
  durationHours = 24,
}) => {
  const normalizedHashtag = normalizeHashtag(hashtag);
  if (!normalizedHashtag || !title) {
    throw new Error("Challenge hashtag and title are required");
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + Math.max(1, Number(durationHours) || 24) * 60 * 60 * 1000);

  const [row] = await db("challenges")
    .insert({
      hashtag: normalizedHashtag,
      title,
      description,
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      is_active: true,
      entry_count: 0,
    })
    .returning("*");

  await ensureHashtag(normalizedHashtag);

  await engagementNotificationService.notifyHotQuestion({
    questionId: null,
    challenge: {
      hashtag: normalizedHashtag,
      title,
    },
    expiresInMinutes: Math.round((endsAt.getTime() - now.getTime()) / 60000),
  });

  return {
    id: row.id,
    hashtag: row.hashtag,
    title: row.title,
    description: row.description || "",
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    entryCount: Number(row.entry_count || 0),
    isActive: Boolean(row.is_active),
  };
};

module.exports = {
  attachHashtagsToAnswer,
  createChallenge,
  extractHashtags,
  getActiveChallenges,
  getHashtagFeed,
  getHashtagStats,
  getTrendingHashtags,
  normalizeHashtag,
  parseHashtagContext,
};
