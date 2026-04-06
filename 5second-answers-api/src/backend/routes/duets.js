const express = require("express");
const controller = require("../controllers/duetController");

const router = express.Router();

router.get("/pending", controller.getPending);
router.post("/create", controller.createChallenge);
router.post("/compare-random", controller.createRandomCompare);
router.post("/expose", controller.createExpose);
router.post("/respond/:sessionId", controller.respond);
router.post("/:sessionId/react", controller.react);
router.get("/:sessionId", controller.getSession);

module.exports = router;
