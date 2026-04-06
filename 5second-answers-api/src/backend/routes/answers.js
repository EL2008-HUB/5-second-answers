const express = require("express");
const router = express.Router();
const controller = require("../controllers/answerController");

router.get("/", controller.listAnswers);
router.post("/", controller.addAnswer);
router.get("/pending", controller.getPendingAnswers);
router.get("/:answerId/ai-team", controller.getAnswerAiTeam);
router.get("/:questionId", controller.getAnswersByQuestion);
router.post("/:answerId/interact", controller.interactWithAnswer);
router.post("/:answerId/consume", controller.trackConsumption);
router.post("/:answerId/approve", controller.approveAnswer);
router.post("/:answerId/reject", controller.rejectAnswer);

module.exports = router;
