const express = require("express");
const aiService = require("../services/aiService");

const router = express.Router();

const commentThreads = {
  "demo-answer-1": [
    {
      id: "c1",
      text: "Kjo ishte e forte 🔥",
      userId: "system_seed",
      moderation: {
        allowed: true,
        reason: "Seed engagement comment",
        sanitizedText: "Kjo ishte e forte 🔥",
        severity: "low",
        suggestedRewrite: null,
      },
      suggestedByAi: true,
      createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
  ],
};

const cleanText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const toThreadId = (value) => cleanText(value) || "default";

const buildContextFromRequest = (req) => ({
  answer: cleanText(req.body?.answer || req.query?.answer || ""),
  answerId: cleanText(req.body?.answerId || req.params?.videoId || ""),
  langCode: cleanText(req.body?.langCode || req.query?.langCode || "") || null,
  question: cleanText(req.body?.question || req.query?.question || ""),
  userId: cleanText(req.body?.userId || req.query?.userId || "") || "demo_user",
});

const getThread = (threadId) => {
  if (!commentThreads[threadId]) {
    commentThreads[threadId] = [];
  }

  return commentThreads[threadId];
};

const normalizeCommentResponse = (comment) => ({
  createdAt: comment.createdAt,
  id: comment.id,
  moderation: comment.moderation,
  suggestedByAi: Boolean(comment.suggestedByAi),
  text: comment.text,
  userId: comment.userId,
});

router.get("/:videoId", async (req, res) => {
  const threadId = toThreadId(req.params.videoId);
  const context = buildContextFromRequest(req);

  try {
    const thread = getThread(threadId).map(normalizeCommentResponse);
    const suggested = await aiService.suggestCommentReactions({
      answer: context.answer,
      langCode: context.langCode,
      limit: Number(req.query?.limit || 4),
      question: context.question,
    });

    res.json({
      comments: thread,
      suggestedReactions: suggested.suggestions,
      threadId,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ error: "Failed to load comments" });
  }
});

router.post("/:videoId", async (req, res) => {
  const threadId = toThreadId(req.params.videoId);
  const context = buildContextFromRequest(req);
  const text = cleanText(req.body?.text || "");

  if (!text) {
    return res.status(400).json({ error: "Comment text required" });
  }

  try {
    const moderation = await aiService.moderateComment({
      answer: context.answer,
      langCode: context.langCode,
      question: context.question,
      text,
    });

    const suggested = await aiService.suggestCommentReactions({
      answer: context.answer,
      langCode: context.langCode,
      limit: 4,
      question: context.question,
    });

    if (!moderation.allowed) {
      return res.status(422).json({
        allowed: false,
        moderation,
        suggestedReactions: suggested.suggestions,
      });
    }

    const thread = getThread(threadId);
    const newComment = {
      id: `c_${Date.now()}`,
      text: moderation.sanitizedText || text,
      userId: context.userId,
      moderation,
      suggestedByAi: false,
      createdAt: new Date().toISOString(),
    };

    thread.unshift(newComment);

    res.json({
      allowed: true,
      comment: normalizeCommentResponse(newComment),
      suggestedReactions: suggested.suggestions,
      threadId,
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

module.exports = router;
