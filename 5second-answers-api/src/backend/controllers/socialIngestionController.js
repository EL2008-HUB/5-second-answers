const socialIngestionService = require("../services/socialIngestionService");

exports.importPosts = async (req, res) => {
  const { provider } = req.params;
  const { posts = [], sourceType = "manual", metadata = {} } = req.body || {};

  try {
    const result = await socialIngestionService.importPosts({
      provider,
      posts,
      sourceType,
      metadata,
    });

    return res.status(201).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Import social posts error:", error);
    return res.status(400).json({ error: error.message || "Failed to import posts" });
  }
};

exports.receiveWebhook = async (req, res) => {
  const { provider } = req.params;
  const posts = Array.isArray(req.body?.posts) ? req.body.posts : [];

  try {
    const result = await socialIngestionService.importPosts({
      provider,
      posts,
      sourceType: "webhook",
      metadata: {
        receivedAt: new Date().toISOString(),
      },
    });

    return res.json({
      received: true,
      ...result,
    });
  } catch (error) {
    console.error("Webhook social ingest error:", error);
    return res.status(400).json({ error: error.message || "Failed to ingest webhook posts" });
  }
};
