const express = require("express");
const router = express.Router();
const controller = require("../controllers/trendingController");

// 🔥 TRENDING ROUTES
router.get("/topics", controller.getTrendingTopics);
router.get("/topics/:topicId", controller.getTopicDetails);
router.get("/news/live", controller.fetchLiveNews);
router.get("/news/daily-brain", controller.getDailyBrain);
router.get("/news/insights/:questionId", controller.getHotQuestionInsights);
router.get("/launch/pack", controller.getLaunchPack);
router.post("/news/detect", controller.detectHotNews);
router.post("/news/hot-questions", controller.createHotQuestionsFromNews);
router.post("/news/live/run", controller.runLiveNewsHotQuestionJob);
router.post("/news/live/run-all", controller.runMultiCountryHotQuestionJob);
router.post("/launch/feedback", controller.submitLaunchFeedback);
router.get("/challenges", controller.getViralChallenges);
router.get("/challenges/:challengeId", controller.getChallengeDetails);
router.post("/challenges/:challengeId/join", controller.joinChallenge);
router.post("/challenges/:challengeId/submit", controller.submitChallengeEntry);
router.get("/content", controller.getTrendingContent);

module.exports = router;
