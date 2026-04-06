const Redis = require("ioredis");

const PRESENCE_KEY_PREFIX = "rooms:presence:";
const TYPING_KEY_PREFIX = "rooms:typing:";
const FALLBACK_TTL_MS = 20 * 1000;

const presenceFallback = new Map();
const typingFallback = new Map();

let redisClient = null;
let redisReady = false;
let redisInitAttempted = false;

const getNowIso = () => new Date().toISOString();

const ensureMap = (store, roomId) => {
  if (!store.has(roomId)) {
    store.set(roomId, new Map());
  }

  return store.get(roomId);
};

const cleanupFallbackTyping = (roomId) => {
  const roomTyping = typingFallback.get(roomId);
  if (!roomTyping) {
    return;
  }

  const now = Date.now();
  for (const [userId, value] of roomTyping.entries()) {
    if (!value?.expiresAt || value.expiresAt <= now) {
      roomTyping.delete(userId);
    }
  }

  if (!roomTyping.size) {
    typingFallback.delete(roomId);
  }
};

const parseRedisHashValues = async (hashPromise) => {
  const payload = await hashPromise;
  return Object.values(payload || {})
    .map((value) => {
      try {
        return JSON.parse(value);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
};

const initRedisIfNeeded = async () => {
  if (redisInitAttempted) {
    return redisReady;
  }

  redisInitAttempted = true;

  if (!process.env.REDIS_URL) {
    return false;
  }

  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      enableReadyCheck: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    redisClient.on("error", (error) => {
      redisReady = false;
      console.warn("[Rooms] Redis unavailable, using fallback:", error.message);
    });

    await redisClient.connect();
    redisReady = true;
    console.log("[Rooms] Redis presence layer connected");
    return true;
  } catch (error) {
    redisReady = false;
    console.warn("[Rooms] Redis init failed, using fallback:", error.message);
    return false;
  }
};

const withRedis = async (callback, fallback) => {
  const enabled = await initRedisIfNeeded();
  if (!enabled || !redisClient || !redisReady) {
    return fallback();
  }

  try {
    return await callback(redisClient);
  } catch (error) {
    redisReady = false;
    console.warn("[Rooms] Redis op failed, using fallback:", error.message);
    return fallback();
  }
};

const sortUsers = (users = []) =>
  [...users].sort((left, right) =>
    String(left?.username || left?.userId || "").localeCompare(
      String(right?.username || right?.userId || "")
    )
  );

const upsertPresence = async ({ roomId, userId, username, socketId }) => {
  const record = {
    lastSeenAt: getNowIso(),
    roomId,
    socketId: socketId || null,
    userId,
    username,
  };

  return withRedis(
    async (client) => {
      const key = `${PRESENCE_KEY_PREFIX}${roomId}`;
      await client.hset(key, userId, JSON.stringify(record));
      await client.expire(key, 60 * 60 * 12);
      return record;
    },
    () => {
      ensureMap(presenceFallback, roomId).set(userId, record);
      return record;
    }
  );
};

const removePresence = async ({ roomId, userId }) =>
  withRedis(
    async (client) => {
      await client.hdel(`${PRESENCE_KEY_PREFIX}${roomId}`, userId);
    },
    () => {
      const roomPresence = presenceFallback.get(roomId);
      roomPresence?.delete(userId);
      if (roomPresence && !roomPresence.size) {
        presenceFallback.delete(roomId);
      }
    }
  );

const listPresence = async (roomId) =>
  withRedis(
    async (client) => sortUsers(await parseRedisHashValues(client.hgetall(`${PRESENCE_KEY_PREFIX}${roomId}`))),
    () => sortUsers([...ensureMap(presenceFallback, roomId).values()])
  );

const setTyping = async ({ roomId, userId, username }) => {
  const record = {
    expiresAt: Date.now() + FALLBACK_TTL_MS,
    roomId,
    userId,
    username,
  };

  return withRedis(
    async (client) => {
      const key = `${TYPING_KEY_PREFIX}${roomId}`;
      await client.hset(key, userId, JSON.stringify(record));
      await client.expire(key, 30);
      return record;
    },
    () => {
      ensureMap(typingFallback, roomId).set(userId, record);
      return record;
    }
  );
};

const clearTyping = async ({ roomId, userId }) =>
  withRedis(
    async (client) => {
      await client.hdel(`${TYPING_KEY_PREFIX}${roomId}`, userId);
    },
    () => {
      const roomTyping = typingFallback.get(roomId);
      roomTyping?.delete(userId);
      if (roomTyping && !roomTyping.size) {
        typingFallback.delete(roomId);
      }
    }
  );

const listTyping = async (roomId) =>
  withRedis(
    async (client) => {
      const key = `${TYPING_KEY_PREFIX}${roomId}`;
      const values = await parseRedisHashValues(client.hgetall(key));
      const now = Date.now();
      const active = values.filter((item) => Number(item?.expiresAt || 0) > now);

      const expiredUserIds = values
        .filter((item) => Number(item?.expiresAt || 0) <= now)
        .map((item) => item.userId)
        .filter(Boolean);

      if (expiredUserIds.length) {
        await client.hdel(key, ...expiredUserIds);
      }

      return sortUsers(active);
    },
    () => {
      cleanupFallbackTyping(roomId);
      return sortUsers([...ensureMap(typingFallback, roomId).values()]);
    }
  );

const clearRoom = async (roomId) =>
  withRedis(
    async (client) => {
      await client.del(`${PRESENCE_KEY_PREFIX}${roomId}`);
      await client.del(`${TYPING_KEY_PREFIX}${roomId}`);
    },
    () => {
      presenceFallback.delete(roomId);
      typingFallback.delete(roomId);
    }
  );

const getBackend = async () => ((await initRedisIfNeeded()) ? "redis" : "memory");

module.exports = {
  clearRoom,
  clearTyping,
  getBackend,
  listPresence,
  listTyping,
  removePresence,
  setTyping,
  upsertPresence,
};
