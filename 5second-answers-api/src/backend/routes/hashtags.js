const express = require("express");
const controller = require("../controllers/hashtagController");

const router = express.Router();

router.get("/trending", controller.getTrending);
router.get("/feed/:hashtag", controller.getFeed);
router.post("/tag-answer", controller.tagAnswer);
router.post("/challenges", controller.createChallenge);

module.exports = router;
