const { ensureUser } = require("../data/helpers");
const notificationService = require("../services/notificationService");
const pushNotificationService = require("../services/pushNotificationService");
const engagementNotificationService = require("../services/engagementNotificationService");

exports.getNotifications = async (req, res) => {
  const { userId, filter = "all" } = req.query;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const notifications = await notificationService.listNotifications(actor.id, filter);

    res.json({
      unreadCount: notifications.filter((item) => !item.read).length,
      notifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
};

exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const notification = await notificationService.markNotificationRead(id, actor.id);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(notification);
  } catch (error) {
    console.error("Mark notification read error:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
};

exports.markAllAsRead = async (req, res) => {
  const { userId } = req.body;

  try {
    const actor = await ensureUser(userId || "demo_user");
    await notificationService.markAllNotificationsRead(actor.id);

    res.json({ success: true });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    res.status(500).json({ error: "Failed to update notifications" });
  }
};

exports.registerDevice = async (req, res) => {
  const { userId, expoPushToken, platform, deviceName, appVersion } = req.body || {};

  try {
    const actor = await ensureUser(userId || "demo_user");
    const token = await pushNotificationService.registerDeviceToken({
      userId: actor.id,
      expoPushToken,
      platform,
      deviceName,
      appVersion,
    });

    if (!token) {
      return res.status(400).json({ error: "Invalid Expo push token" });
    }

    return res.json({
      success: true,
      tokenId: token.id,
    });
  } catch (error) {
    console.error("Register device error:", error);
    return res.status(500).json({ error: "Failed to register device" });
  }
};

exports.triggerHotQuestion = async (req, res) => {
  const { questionId, expiresInMinutes } = req.body || {};

  try {
    const result = await engagementNotificationService.notifyHotQuestion({
      questionId,
      expiresInMinutes,
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Trigger hot question error:", error);
    return res.status(500).json({ error: error.message || "Failed to trigger hot question" });
  }
};

exports.runStreakRiskJob = async (_req, res) => {
  try {
    const result = await engagementNotificationService.notifyStreakAtRiskUsers();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("Run streak risk job error:", error);
    return res.status(500).json({ error: "Failed to run streak risk job" });
  }
};

exports.runGroupPressureJob = async (_req, res) => {
  try {
    const result = await engagementNotificationService.notifyGroupPressureUsers();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("Run group pressure job error:", error);
    return res.status(500).json({ error: "Failed to run group pressure job" });
  }
};

exports.runDailyQuestionLiveJob = async (req, res) => {
  const { country, questionId } = req.body || {};

  try {
    const result = await engagementNotificationService.notifyDailyQuestionLiveUsers({
      countryCode: country || null,
      questionId: questionId || null,
    });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("Run daily question live job error:", error);
    return res.status(500).json({ error: "Failed to run daily question live job" });
  }
};

exports.getHotQuestionStats = async (_req, res) => {
  try {
    const stats = await notificationService.getNotificationExperimentStats({
      experimentName: "hot_question_push_v1",
      type: "hot_question",
    });
    return res.json(stats);
  } catch (error) {
    console.error("Get hot question stats error:", error);
    return res.status(500).json({ error: "Failed to load hot question stats" });
  }
};
