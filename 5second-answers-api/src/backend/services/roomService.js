const { db } = require("../data/db");
const roomPresenceService = require("./roomPresenceService");

const MAX_ROOM_USERS = 6;
const DEFAULT_IDLE_MINUTES = Math.max(15, Number(process.env.ROOM_IDLE_MINUTES || 120));
const ACTIVE_PRESENCE_SECONDS = Math.max(15, Number(process.env.ROOM_ACTIVE_PRESENCE_SECONDS || 45));
const ROOM_STATUSES = {
  CLOSED: "closed",
  EXPIRED: "expired",
  LIVE: "live",
  WAITING: "waiting",
};

const normalizeText = (value, fallback = "") =>
  String(value || fallback)
    .replace(/\s+/g, " ")
    .trim();

const getNow = () => new Date();
const getNowIso = () => getNow().toISOString();

const toIso = (value) => (value ? new Date(value).toISOString() : null);

const clampMaxUsers = (value) => Math.max(2, Math.min(MAX_ROOM_USERS, Number(value) || MAX_ROOM_USERS));

const buildShareUrl = (inviteCode) => {
  const baseUrl = String(process.env.APP_SHARE_BASE_URL || "https://5secondanswer.app").replace(/\/+$/, "");
  return `${baseUrl}/room/${encodeURIComponent(inviteCode)}`;
};

const buildInviteCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};

const ensureInviteCode = async () => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = buildInviteCode();
    const exists = await db("rooms").where({ invite_code: candidate }).first("id");
    if (!exists) {
      return candidate;
    }
  }

  throw new Error("Failed to generate invite code");
};

const mapEntry = (entry = {}) => ({
  createdAt: toIso(entry.created_at || entry.createdAt),
  duration: Number(entry.duration || 0),
  id: entry.id,
  mediaUrl: entry.media_url || entry.mediaUrl || null,
  mimeType: entry.mime_type || entry.mimeType || null,
  text: entry.text || null,
  type: entry.type || "text",
  userId: entry.user_id || entry.userId,
  username: entry.username || entry.user_id || entry.userId,
});

const mapParticipant = (participant = {}, onlineUserIds = new Set()) => ({
  isOnline: onlineUserIds.has(participant.user_id || participant.userId),
  joinedAt: toIso(participant.joined_at || participant.joinedAt),
  lastSeenAt: toIso(participant.last_seen_at || participant.lastSeenAt),
  socketId: participant.socket_id || participant.socketId || null,
  status: participant.status || "active",
  userId: participant.user_id || participant.userId,
  username: participant.username || participant.user_id || participant.userId,
});

const mapRoomRow = (room = {}) => ({
  createdAt: toIso(room.created_at || room.createdAt),
  expiresAt: toIso(room.expires_at || room.expiresAt),
  hostUserId: room.host_user_id || room.hostUserId,
  id: room.id,
  inviteCode: room.invite_code || room.inviteCode,
  lastActivityAt: toIso(room.last_activity_at || room.lastActivityAt),
  maxUsers: Number(room.max_users || room.maxUsers || MAX_ROOM_USERS),
  metadata: room.metadata || {},
  questionText: room.question_text || room.questionText || "",
  shareUrl: buildShareUrl(room.invite_code || room.inviteCode),
  status: room.status || ROOM_STATUSES.WAITING,
  title: room.title || "Live Room",
  topic: room.topic || "general",
  updatedAt: toIso(room.updated_at || room.updatedAt),
});

const countActiveParticipants = async (roomId) => {
  const result = await db("room_participants")
    .where({ room_id: roomId, status: "active" })
    .count("* as count")
    .first();

  return Number(result?.count || 0);
};

const getRoomRow = async (roomId) => db("rooms").where({ id: roomId }).first();

const getRoomRowByInviteCode = async (inviteCode) =>
  db("rooms")
    .whereRaw("upper(invite_code) = ?", [String(inviteCode || "").trim().toUpperCase()])
    .first();

const buildRoomSnapshot = async (roomInput, { includeAnswers = true } = {}) => {
  const room = typeof roomInput === "string" ? await getRoomRow(roomInput) : roomInput;
  if (!room) {
    return null;
  }

  const [participants, answers, presenceUsers, typingUsers] = await Promise.all([
    db("room_participants")
      .where({ room_id: room.id, status: "active" })
      .orderBy("joined_at", "asc"),
    includeAnswers
      ? db("room_entries").where({ room_id: room.id }).orderBy("created_at", "desc").limit(50)
      : Promise.resolve([]),
    roomPresenceService.listPresence(room.id),
    roomPresenceService.listTyping(room.id),
  ]);

  const onlineUserIds = new Set(presenceUsers.map((item) => item.userId));
  const users = participants.map((participant) => mapParticipant(participant, onlineUserIds));

  return {
    ...mapRoomRow(room),
    answerCount: includeAnswers ? answers.length : Number(room.answer_count || 0),
    answers: includeAnswers ? answers.map(mapEntry) : [],
    presenceBackend: await roomPresenceService.getBackend(),
    presenceUsers: presenceUsers.map((item) => ({
      lastSeenAt: item.lastSeenAt || getNowIso(),
      socketId: item.socketId || null,
      userId: item.userId,
      username: item.username || item.userId,
    })),
    typingUsers: typingUsers.map((item) => ({
      userId: item.userId,
      username: item.username || item.userId,
    })),
    userCount: users.length,
    users,
  };
};

const refreshRoomStatus = async (roomId, { forceStatus = null, touchActivity = false } = {}) => {
  const activeCount = await countActiveParticipants(roomId);
  const nextStatus = forceStatus || (activeCount >= 2 ? ROOM_STATUSES.LIVE : ROOM_STATUSES.WAITING);
  const patch = {
    status: nextStatus,
    updated_at: getNow(),
  };

  if (touchActivity) {
    patch.last_activity_at = getNow();
  }

  await db("rooms").where({ id: roomId }).update(patch);
  return buildRoomSnapshot(roomId);
};

const createRoom = async ({
  hostUserId,
  maxUsers = MAX_ROOM_USERS,
  questionText = "",
  title = "",
  topic = "general",
} = {}) => {
  const inviteCode = await ensureInviteCode();
  const now = getNow();
  const [room] = await db("rooms")
    .insert({
      host_user_id: normalizeText(hostUserId, "demo_user"),
      invite_code: inviteCode,
      last_activity_at: now,
      max_users: clampMaxUsers(maxUsers),
      question_text: normalizeText(questionText, "What do you think?"),
      status: ROOM_STATUSES.WAITING,
      title: normalizeText(title, "Live Room"),
      topic: normalizeText(topic, "general"),
      updated_at: now,
    })
    .returning("*");

  return buildRoomSnapshot(room, { includeAnswers: false });
};

const listRooms = async () => {
  const rows = await db("rooms as r")
    .select(
      "r.*",
      db.raw(
        "(select count(*) from room_participants rp where rp.room_id = r.id and rp.status = 'active')::int as user_count"
      ),
      db.raw("(select count(*) from room_entries re where re.room_id = r.id)::int as answer_count")
    )
    .whereNotIn("r.status", [ROOM_STATUSES.EXPIRED, ROOM_STATUSES.CLOSED])
    .orderBy("r.last_activity_at", "desc")
    .limit(50);

  const presenceBackend = await roomPresenceService.getBackend();

  return rows.map((row) => ({
    ...mapRoomRow(row),
    answerCount: Number(row.answer_count || 0),
    answers: [],
    presenceBackend,
    presenceUsers: [],
    typingUsers: [],
    userCount: Number(row.user_count || 0),
    users: [],
  }));
};

const getRoom = async (roomId) => buildRoomSnapshot(roomId);

const getRoomByInviteCode = async (inviteCode) => {
  const room = await getRoomRowByInviteCode(inviteCode);
  return room ? buildRoomSnapshot(room.id) : null;
};

const joinRoom = async ({ roomId, socketId, userId, username }) => {
  const room = await getRoomRow(roomId);

  if (!room) {
    throw new Error("Room not found");
  }

  if ([ROOM_STATUSES.EXPIRED, ROOM_STATUSES.CLOSED].includes(room.status)) {
    throw new Error("Room is no longer active");
  }

  const normalizedUserId = normalizeText(userId, "guest");
  const normalizedUsername = normalizeText(username, normalizedUserId);
  const existing = await db("room_participants")
    .where({ room_id: roomId, user_id: normalizedUserId })
    .first();
  const activeCount = await countActiveParticipants(roomId);

  if (!existing && activeCount >= Number(room.max_users || MAX_ROOM_USERS)) {
    throw new Error("Room is full");
  }

  const now = getNow();

  await db("room_participants")
    .insert({
      joined_at: now,
      last_seen_at: now,
      metadata: {},
      room_id: roomId,
      socket_id: socketId || null,
      status: "active",
      updated_at: now,
      user_id: normalizedUserId,
      username: normalizedUsername,
    })
    .onConflict(["room_id", "user_id"])
    .merge({
      last_seen_at: now,
      left_at: null,
      socket_id: socketId || null,
      status: "active",
      updated_at: now,
      username: normalizedUsername,
    });

  await roomPresenceService.upsertPresence({
    roomId,
    socketId,
    userId: normalizedUserId,
    username: normalizedUsername,
  });

  await db("rooms")
    .where({ id: roomId })
    .update({
      last_activity_at: now,
      status: activeCount + (existing?.status === "active" ? 0 : 1) >= 2 ? ROOM_STATUSES.LIVE : ROOM_STATUSES.WAITING,
      updated_at: now,
    });

  return buildRoomSnapshot(roomId);
};

const leaveRoom = async ({ roomId, socketId, userId }) => {
  const room = await getRoomRow(roomId);
  if (!room) {
    return null;
  }

  const now = getNow();
  const normalizedUserId = normalizeText(userId);

  const query = db("room_participants").where({ room_id: roomId, status: "active" });
  if (normalizedUserId) {
    query.andWhere({ user_id: normalizedUserId });
  } else if (socketId) {
    query.andWhere({ socket_id: socketId });
  }

  const participants = await query.select("user_id");

  if (!participants.length) {
    return buildRoomSnapshot(roomId);
  }

  await db("room_participants")
    .where({ room_id: roomId, status: "active" })
    .modify((builder) => {
      if (normalizedUserId) {
        builder.andWhere({ user_id: normalizedUserId });
        return;
      }

      if (socketId) {
        builder.andWhere({ socket_id: socketId });
      }
    })
    .update({
      last_seen_at: now,
      left_at: now,
      socket_id: null,
      status: "left",
      updated_at: now,
    });

  for (const participant of participants) {
    await roomPresenceService.removePresence({ roomId, userId: participant.user_id });
    await roomPresenceService.clearTyping({ roomId, userId: participant.user_id });
  }

  return refreshRoomStatus(roomId, { touchActivity: true });
};

const addRoomAnswer = async ({
  roomId,
  userId,
  username,
  type = "text",
  text = "",
  mediaUrl = null,
  mimeType = null,
  duration = 0,
} = {}) => {
  const room = await getRoomRow(roomId);

  if (!room) {
    throw new Error("Room not found");
  }

  if ([ROOM_STATUSES.EXPIRED, ROOM_STATUSES.CLOSED].includes(room.status)) {
    throw new Error("Room is no longer active");
  }

  const now = getNow();
  const normalizedUserId = normalizeText(userId, "guest");
  const normalizedUsername = normalizeText(username, normalizedUserId);

  const [entry] = await db("room_entries")
    .insert({
      created_at: now,
      duration: Math.max(0, Math.round(Number(duration || 0))),
      media_url: mediaUrl || null,
      mime_type: mimeType || null,
      room_id: roomId,
      text: normalizeText(text) || null,
      type: normalizeText(type, "text"),
      updated_at: now,
      user_id: normalizedUserId,
      username: normalizedUsername,
    })
    .returning("*");

  await touchParticipant({
    roomId,
    socketId: null,
    userId: normalizedUserId,
    username: normalizedUsername,
    updateRoomActivity: true,
  });
  await roomPresenceService.clearTyping({ roomId, userId: normalizedUserId });

  return {
    entry: mapEntry(entry),
    room: await buildRoomSnapshot(roomId),
  };
};

const touchParticipant = async ({
  roomId,
  socketId,
  userId,
  username,
  updateRoomActivity = true,
} = {}) => {
  const normalizedUserId = normalizeText(userId, "guest");
  const normalizedUsername = normalizeText(username, normalizedUserId);
  const now = getNow();

  await db("room_participants")
    .insert({
      joined_at: now,
      last_seen_at: now,
      room_id: roomId,
      socket_id: socketId || null,
      status: "active",
      updated_at: now,
      user_id: normalizedUserId,
      username: normalizedUsername,
    })
    .onConflict(["room_id", "user_id"])
    .merge(
      {
        last_seen_at: now,
        left_at: null,
        status: "active",
        updated_at: now,
        username: normalizedUsername,
      }
    );

  if (socketId) {
    await db("room_participants")
      .where({ room_id: roomId, user_id: normalizedUserId })
      .update({
        socket_id: socketId,
        updated_at: now,
      });
  }

  await roomPresenceService.upsertPresence({
    roomId,
    socketId,
    userId: normalizedUserId,
    username: normalizedUsername,
  });

  if (updateRoomActivity) {
    await db("rooms")
      .where({ id: roomId })
      .update({
        last_activity_at: now,
        updated_at: now,
      });
  }

  return buildRoomSnapshot(roomId);
};

const updateTypingState = async ({ roomId, userId, username, isTyping, socketId }) => {
  if (isTyping) {
    await roomPresenceService.setTyping({
      roomId,
      userId: normalizeText(userId, "guest"),
      username: normalizeText(username, userId),
    });
  } else {
    await roomPresenceService.clearTyping({
      roomId,
      userId: normalizeText(userId, "guest"),
    });
  }

  await touchParticipant({
    roomId,
    socketId,
    updateRoomActivity: false,
    userId,
    username,
  });

  return buildRoomSnapshot(roomId);
};

const removeSocketFromRooms = async (socketId) => {
  const participants = await db("room_participants")
    .where({ socket_id: socketId, status: "active" })
    .select("room_id", "user_id");

  const updatedRooms = [];

  for (const participant of participants) {
    const snapshot = await leaveRoom({
      roomId: participant.room_id,
      socketId,
      userId: participant.user_id,
    });

    if (snapshot) {
      updatedRooms.push(snapshot);
    }
  }

  return updatedRooms;
};

const cleanupIdleRooms = async () => {
  const cutoff = new Date(Date.now() - DEFAULT_IDLE_MINUTES * 60 * 1000);
  const staleRooms = await db("rooms")
    .whereIn("status", [ROOM_STATUSES.WAITING, ROOM_STATUSES.LIVE])
    .andWhere("last_activity_at", "<", cutoff)
    .select("id", "invite_code");

  if (!staleRooms.length) {
    return [];
  }

  const staleRoomIds = staleRooms.map((room) => room.id);
  const now = getNow();

  await db("rooms")
    .whereIn("id", staleRoomIds)
    .update({
      expires_at: now,
      status: ROOM_STATUSES.EXPIRED,
      updated_at: now,
    });

  await db("room_participants")
    .whereIn("room_id", staleRoomIds)
    .andWhere({ status: "active" })
    .update({
      last_seen_at: now,
      left_at: now,
      socket_id: null,
      status: "left",
      updated_at: now,
    });

  for (const roomId of staleRoomIds) {
    await roomPresenceService.clearRoom(roomId);
  }

  return staleRooms.map((room) => ({
    id: room.id,
    inviteCode: room.invite_code,
    shareUrl: buildShareUrl(room.invite_code),
  }));
};

const seedRoomsIfEmpty = async () => {
  const existing = await db("rooms").count("* as count").first();
  if (Number(existing?.count || 0) > 0) {
    return;
  }

  await createRoom({
    hostUserId: "demo_user",
    questionText: "What would you say if nobody judged you?",
    title: "Late Night Truths",
    topic: "deep",
  });
  await createRoom({
    hostUserId: "mirror_news",
    questionText: "Who overreacted more in today's news?",
    title: "News Reactions",
    topic: "trending",
  });
};

module.exports = {
  ACTIVE_PRESENCE_SECONDS,
  DEFAULT_IDLE_MINUTES,
  addRoomAnswer,
  buildShareUrl,
  cleanupIdleRooms,
  createRoom,
  getRoom,
  getRoomByInviteCode,
  joinRoom,
  leaveRoom,
  listRooms,
  removeSocketFromRooms,
  seedRoomsIfEmpty,
  touchParticipant,
  updateTypingState,
};
