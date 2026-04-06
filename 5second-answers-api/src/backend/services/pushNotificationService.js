const { db } = require("../data/db");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

const LIMITS = {
  approved: 2,
  daily_question_live: 1,
  emotion_score_shared: 4,
  expert_answer: 2,
  expert_request: 2,
  friend_answered_about_you: 5,
  group_pressure: 2,
  hot_question: 3,
  new_answer: 3,
  new_follower: 2,
  streak_at_risk: 1,
  top_answer: 2,
};

const chunkArray = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size)
  );

const getTodayStartIso = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString();
};

const isExpoPushToken = (value = "") =>
  /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(String(value).trim());

const registerDeviceToken = async ({
  userId,
  expoPushToken,
  platform = null,
  deviceName = null,
  appVersion = null,
}) => {
  if (!userId || !isExpoPushToken(expoPushToken)) {
    return null;
  }

  const [row] = await db("user_push_tokens")
    .insert({
      user_id: userId,
      expo_push_token: expoPushToken,
      platform,
      device_name: deviceName,
      app_version: appVersion,
      is_active: true,
      last_registered_at: db.fn.now(),
    })
    .onConflict("expo_push_token")
    .merge({
      user_id: userId,
      platform,
      device_name: deviceName,
      app_version: appVersion,
      is_active: true,
      last_registered_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning("*");

  return row || null;
};

const getActiveTokensForUsers = async (userIds = []) => {
  if (!userIds.length) {
    return new Map();
  }

  const rows = await db("user_push_tokens")
    .whereIn("user_id", userIds)
    .andWhere({ is_active: true })
    .select("user_id", "expo_push_token");

  return rows.reduce((accumulator, row) => {
    const existing = accumulator.get(row.user_id) || [];
    existing.push(row.expo_push_token);
    accumulator.set(row.user_id, existing);
    return accumulator;
  }, new Map());
};

const canSendPush = async ({ userId, type }) => {
  const limit = LIMITS[type] || 3;

  const result = await db("notification_delivery_log")
    .where({
      user_id: userId,
      type,
      channel: "push",
    })
    .andWhere("sent_at", ">=", getTodayStartIso())
    .count("* as count")
    .first();

  return Number(result?.count || 0) < limit;
};

const logPushDelivery = async ({
  userId,
  type,
  notificationId = null,
  metadata = {},
  status = "sent",
}) =>
  db("notification_delivery_log").insert({
    user_id: userId,
    notification_id: notificationId,
    type,
    channel: "push",
    status,
    metadata,
    sent_at: db.fn.now(),
  });

const postExpoMessages = async (messages) => {
  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(payload?.errors?.[0]?.message || text || "Expo push send failed");
  }

  return payload;
};

const deliverPushToUsers = async ({
  userIds = [],
  title,
  body,
  type,
  data = {},
  notificationIdsByUserId = new Map(),
}) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueUserIds.length || !title || !body || !type) {
    return { queuedUsers: 0, queuedMessages: 0 };
  }

  const tokensByUserId = await getActiveTokensForUsers(uniqueUserIds);
  const approvedUsers = [];
  const messages = [];

  for (const userId of uniqueUserIds) {
    const tokens = tokensByUserId.get(userId) || [];
    if (!tokens.length) {
      continue;
    }

    const allowed = await canSendPush({ userId, type });
    if (!allowed) {
      continue;
    }

    approvedUsers.push(userId);

    for (const token of tokens) {
      messages.push({
        to: token,
        sound: "default",
        title,
        body,
        priority: "high",
        channelId: "default",
        data: {
          type,
          ...data,
        },
      });
    }
  }

  if (!messages.length) {
    return { queuedUsers: 0, queuedMessages: 0 };
  }

  for (const batch of chunkArray(messages, 100)) {
    await postExpoMessages(batch);
  }

  await Promise.all(
    approvedUsers.map((userId) =>
      logPushDelivery({
        userId,
        type,
        notificationId: notificationIdsByUserId.get(userId) || null,
        metadata: data,
      })
    )
  );

  return {
    queuedUsers: approvedUsers.length,
    queuedMessages: messages.length,
  };
};

module.exports = {
  LIMITS,
  canSendPush,
  deliverPushToUsers,
  getActiveTokensForUsers,
  isExpoPushToken,
  registerDeviceToken,
};
