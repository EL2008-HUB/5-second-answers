const express = require("express");
const router = express.Router();
const controller = require("../controllers/socialController");

router.get("/following", controller.getFollowing);
router.get("/home-summary", controller.getHomeSummary);
router.post("/follow", controller.followUser);
router.post("/unfollow", controller.unfollowUser);

module.exports = router;
