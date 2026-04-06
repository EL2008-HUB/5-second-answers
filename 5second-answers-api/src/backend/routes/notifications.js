const express = require("express");
const router = express.Router();
const controller = require("../controllers/notificationController");

router.get("/", controller.getNotifications);
router.post("/devices/register", controller.registerDevice);
router.post("/hot-question", controller.triggerHotQuestion);
router.get("/hot-question/stats", controller.getHotQuestionStats);
router.post("/jobs/daily-question-live", controller.runDailyQuestionLiveJob);
router.post("/jobs/streak-risk", controller.runStreakRiskJob);
router.post("/jobs/group-pressure", controller.runGroupPressureJob);
router.post("/read-all", controller.markAllAsRead);
router.post("/:id/read", controller.markAsRead);

module.exports = router;
