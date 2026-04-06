const hashtagService = require("../services/hashtagService");

exports.getTrending = async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const [trending, challenges] = await Promise.all([
      hashtagService.getTrendingHashtags({ limit }),
      hashtagService.getActiveChallenges(),
    ]);

    return res.json({
      challenges,
      trending,
    });
  } catch (error) {
    console.error("Get hashtag trending error:", error);
    return res.status(500).json({ error: "Failed to load hashtag feed" });
  }
};

exports.getFeed = async (req, res) => {
  const { hashtag } = req.params;
  const { page = 0, limit = 20 } = req.query;

  try {
    const [feed, stats] = await Promise.all([
      hashtagService.getHashtagFeed({ hashtag, page, limit }),
      hashtagService.getHashtagStats(hashtag),
    ]);

    return res.json({
      hashtag: hashtagService.normalizeHashtag(hashtag),
      hasMore: feed.length === Math.max(1, Math.min(30, Number(limit) || 20)),
      postCount: stats?.postCount || 0,
      responses: feed,
    });
  } catch (error) {
    console.error("Get hashtag feed error:", error);
    return res.status(500).json({ error: "Failed to load hashtag responses" });
  }
};

exports.tagAnswer = async (req, res) => {
  const { answerId, text, hashtagContext } = req.body || {};

  try {
    const tags = await hashtagService.attachHashtagsToAnswer({
      answerId,
      text,
      hashtagContext,
    });

    return res.json({
      success: true,
      tags,
    });
  } catch (error) {
    console.error("Tag answer error:", error);
    return res.status(500).json({ error: "Failed to process hashtags" });
  }
};

exports.createChallenge = async (req, res) => {
  const { hashtag, title, description, durationHours } = req.body || {};

  try {
    const challenge = await hashtagService.createChallenge({
      hashtag,
      title,
      description,
      durationHours,
    });

    return res.status(201).json(challenge);
  } catch (error) {
    console.error("Create challenge error:", error);
    return res.status(400).json({ error: error.message || "Failed to create challenge" });
  }
};
