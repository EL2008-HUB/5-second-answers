const express = require("express");
const controller = require("../controllers/referralController");

const router = express.Router();

router.get("/summary", controller.getSummary);
router.post("/share", controller.trackShare);
router.post("/redeem", controller.redeem);

module.exports = router;
