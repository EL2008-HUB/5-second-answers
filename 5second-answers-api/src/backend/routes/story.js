const express = require("express");
const controller = require("../controllers/storyController");

const router = express.Router();

router.get("/pack/:category", controller.getPack);
router.post("/complete", controller.complete);

module.exports = router;
