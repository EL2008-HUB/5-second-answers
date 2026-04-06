// src/backend/routes/admin.js
const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");

// Get all users with badge info
router.get("/users", adminController.getAllUsers);

// Get specific user with full badge status
router.get("/users/:userId/badges", adminController.getUserBadgeStatus);

// Get all available badge definitions
router.get("/badges", adminController.getAllBadges);

// Get badge statistics (how many users have each badge)
router.get("/badges/stats", adminController.getBadgeStats);

// Award badge to user
router.post("/badges/award", adminController.awardBadge);

// Revoke badge from user
router.post("/badges/revoke", adminController.revokeBadge);

// Force badge check for user (trigger unlock if criteria met)
router.post("/users/:userId/check-badges", adminController.checkAndUnlockBadges);

// Get leaderboard by badge count
router.get("/leaderboard", adminController.getLeaderboard);

module.exports = router;
