const express = require("express");
const router = express.Router();
const controller = require("../controllers/gamificationController");

// 🎮 GAMIFICATION ROUTES
router.get("/stats/:userId", controller.getUserStats);
router.get("/badges/:userId", controller.getBadges);
router.get("/challenges/:userId", controller.getChallenges);
router.get("/leaderboard", controller.getLeaderboard);
router.post("/daily-reward/:userId", controller.claimDailyReward);
router.post("/progress/:userId", controller.updateProgress);

module.exports = router;
