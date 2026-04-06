const express = require("express");
const router = express.Router();
const controller = require("../controllers/questionController");

router.post("/", controller.createQuestion);
router.get("/", controller.getQuestions);
router.get("/daily", controller.getDailyQuestion);
router.get("/feed", controller.getFeed);
router.get("/trending", controller.getTrending);
router.get("/surprise", controller.getSurpriseQuestion);
router.get("/experts", controller.getExperts);
router.get("/:id/compare-countries", controller.compareCountries);
router.get("/:id/battle", controller.getBattle);
router.post("/:id/battle/vote", controller.voteBattle);
router.get("/:id", controller.getQuestionById);

module.exports = router;
