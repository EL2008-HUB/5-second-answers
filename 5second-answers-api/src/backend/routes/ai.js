const express = require("express");
const router = express.Router();
const controller = require("../controllers/aiController");

router.get("/health", controller.health);
router.post("/route-preview", controller.routePreview);
router.post("/validate", controller.validate);
router.post("/transcribe", controller.transcribe);
router.post("/create-lab-ideas", controller.createLabIdeas);
router.post("/idea-execution-engine", controller.ideaExecutionEngine);
router.post("/generate-question", controller.generateQuestion);
router.post("/analyze-sentiment", controller.analyzeSentiment);
router.post("/generate-comment", controller.generateComment);
router.post("/feedback", controller.feedback);
router.post("/process-event", controller.processEvent);
router.post("/assistant", controller.assistant);
router.get("/self-improvement", controller.selfImprovement);
router.post("/feature-guide", controller.featureGuide);
router.get("/monitor", controller.monitor);

module.exports = router;
