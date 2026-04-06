const { db } = require("../data/db");

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

const normalizeImportedPost = (provider, post = {}) => {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const externalPostId = String(
    post.externalPostId || post.external_post_id || post.id || ""
  ).trim();
  const caption = String(post.caption || post.text || "").trim();
  const hashtags = [
    ...new Set([
      ...extractHashtags(caption),
      ...(Array.isArray(post.hashtags) ? post.hashtags.map((entry) => normalizeHashtag(entry)) : []),
    ].filter(Boolean)),
  ];

  return {
    provider: normalizedProvider,
    externalPostId,
    authorHandle: String(post.authorHandle || post.author_handle || post.username || "").trim() || null,
    authorName: String(post.authorName || post.author_name || "").trim() || null,
    caption: caption || null,
    canonicalUrl: String(post.canonicalUrl || post.canonical_url || post.url || "").trim(),
    thumbnailUrl: String(post.thumbnailUrl || post.thumbnail_url || "").trim() || null,
    mediaType: String(post.mediaType || post.media_type || "").trim() || null,
    postedAt: post.postedAt || post.posted_at || post.created_at || new Date().toISOString(),
    hashtags,
    metadata: typeof post.metadata === "object" && post.metadata ? post.metadata : {},
  };
};

const ensureHashtagsExist = async (hashtags = []) => {
  for (const hashtag of hashtags) {
    const [row] = await db("hashtags")
      .insert({
        name: hashtag,
        post_count: 0,
      })
      .onConflict("name")
      .ignore()
      .returning("*");

    if (!row) {
      continue;
    }
  }
};

const incrementHashtagCounts = async (hashtags = []) => {
  for (const hashtag of hashtags) {
    await db("hashtags")
      .where({ name: hashtag })
      .increment("post_count", 1)
      .update({
        updated_at: db.fn.now(),
      });
  }
};

const recordIngestionRun = async ({ provider, sourceType = "manual", status, importedCount, metadata }) =>
  db("social_ingestion_runs").insert({
    provider,
    source_type: sourceType,
    status,
    imported_count: importedCount,
    metadata: metadata || {},
  });

const importPosts = async ({ provider, posts = [], sourceType = "manual", metadata = {} }) => {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  if (!normalizedProvider) {
    throw new Error("Provider is required");
  }

  let importedCount = 0;
  const importedPosts = [];

  for (const rawPost of posts) {
    const post = normalizeImportedPost(normalizedProvider, rawPost);

    if (!post.externalPostId || !post.canonicalUrl) {
      continue;
    }

    const existing = await db("social_imported_posts")
      .where({
        provider: normalizedProvider,
        external_post_id: post.externalPostId,
      })
      .first("id");

    await ensureHashtagsExist(post.hashtags);

    if (!existing) {
      await db("social_imported_posts").insert({
        provider: normalizedProvider,
        external_post_id: post.externalPostId,
        author_handle: post.authorHandle,
        author_name: post.authorName,
        caption: post.caption,
        canonical_url: post.canonicalUrl,
        thumbnail_url: post.thumbnailUrl,
        media_type: post.mediaType,
        posted_at: post.postedAt,
        hashtags: JSON.stringify(post.hashtags),
        metadata: JSON.stringify(post.metadata),
      });

      await incrementHashtagCounts(post.hashtags);
      importedCount += 1;
    } else {
      await db("social_imported_posts")
        .where({ id: existing.id })
        .update({
          author_handle: post.authorHandle,
          author_name: post.authorName,
          caption: post.caption,
          canonical_url: post.canonicalUrl,
          thumbnail_url: post.thumbnailUrl,
          media_type: post.mediaType,
          posted_at: post.postedAt,
          hashtags: JSON.stringify(post.hashtags),
          metadata: JSON.stringify(post.metadata),
          updated_at: db.fn.now(),
        });
    }

    importedPosts.push(post);
  }

  await recordIngestionRun({
    provider: normalizedProvider,
    sourceType,
    status: "imported",
    importedCount,
    metadata,
  });

  return {
    importedCount,
    posts: importedPosts,
    provider: normalizedProvider,
  };
};

const getImportedPostsByHashtag = async ({ hashtag, page = 0, limit = 20 }) => {
  const normalized = normalizeHashtag(hashtag);
  const safeLimit = Math.max(1, Math.min(30, Number(limit) || 20));
  const safePage = Math.max(0, Number(page) || 0);

  if (!normalized) {
    return [];
  }

  const rows = await db("social_imported_posts")
    .whereRaw("(hashtags::jsonb) \\? ?", [normalized])
    .orderBy("posted_at", "desc")
    .limit(safeLimit)
    .offset(safePage * safeLimit);

  return rows.map((row) => ({
    createdAt: row.posted_at || row.created_at || null,
    externalUrl: row.canonical_url,
    id: `social:${row.id}`,
    provider: row.provider,
    question: null,
    source: "imported",
    text: row.caption || null,
    thumbnailUrl: row.thumbnail_url || null,
    type: row.media_type || "external",
    user: {
      username: row.author_handle || row.author_name || `${row.provider}_creator`,
    },
  }));
};

module.exports = {
  getImportedPostsByHashtag,
  importPosts,
  normalizeImportedPost,
};
