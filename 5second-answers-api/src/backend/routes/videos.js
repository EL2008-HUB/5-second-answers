const express = require("express");
const router = express.Router();
const videoController = require("../controllers/videoController");
const shareVideoController = require("../controllers/shareVideoController");

router.get("/", videoController.getVideos);
router.post("/export-share", shareVideoController.exportAnswerVideo);
router.post("/:id/like", videoController.likeVideo);

module.exports = router;
