const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const newsTrendingService = require("../src/backend/services/newsTrendingService");
const { db } = require("../src/backend/data/db");

const parsePayload = () => {
  try {
    return JSON.parse(process.env.LIVE_NEWS_WORKER_PAYLOAD || "{}");
  } catch (_error) {
    return {};
  }
};

const run = async () => {
  const payload = parsePayload();
  const startedAt = Date.now();

  try {
    console.log("[LiveNewsWorker] started", {
      country: payload.country || "default",
      limitPerFeed: payload.limitPerFeed || 5,
      threshold: payload.threshold || 5,
    });

    const result = await newsTrendingService.fetchDetectAndCreateFromFeeds({
      expiresInMinutes: payload.expiresInMinutes || 180,
      langCode: payload.langCode || "sq",
      limit: payload.limit || 1,
      limitPerFeed: payload.limitPerFeed || 5,
      sendNotification: payload.sendNotification !== false,
      threshold: payload.threshold || 5,
      totalLimit: payload.totalLimit || 20,
      country: payload.country || undefined,
    });

    console.log("[LiveNewsWorker] completed", {
      country: result.country,
      created: Array.isArray(result.created) ? result.created.length : 0,
      durationMs: Date.now() - startedAt,
      fetched: result.fetchedItems?.length || 0,
      totalSources: result.totalSources || 0,
    });
  } catch (error) {
    console.error("[LiveNewsWorker] failed", error);
    process.exitCode = 1;
  } finally {
    try {
      await db.destroy();
    } catch (_error) {
      // noop
    }
  }
};

void run();
