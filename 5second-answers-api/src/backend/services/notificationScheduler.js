const cron = require("node-cron");
const path = require("path");
const { fork } = require("child_process");
const engagementNotificationService = require("./engagementNotificationService");
const newsTrendingService = require("./newsTrendingService");
const { SUPPORTED_COUNTRIES } = require("../config/countryConfig");

let started = false;
const runningJobs = new Map();
const LIVE_NEWS_WORKER_TIMEOUT_MS = Math.max(
  60_000,
  Number(process.env.LIVE_NEWS_WORKER_TIMEOUT_MS || 6 * 60 * 1000)
);
const TRENDING_WARM_CRON = process.env.TRENDING_WARM_CRON || "*/5 * * * *";
const TRENDING_WARM_ON_START = process.env.TRENDING_WARM_ON_START !== "false";
const LIVE_NEWS_WORKER_SCRIPT = path.join(__dirname, "../../../scripts/live-news-worker.js");

const withJobGuard = (jobName, handler) => async () => {
  if (runningJobs.get(jobName)) {
    console.warn(`[Scheduler] Skipping ${jobName} because the previous run is still active`);
    return;
  }

  runningJobs.set(jobName, true);
  const startedAt = Date.now();

  try {
    await handler();
    const durationMs = Date.now() - startedAt;
    if (durationMs > 60_000) {
      console.warn(`[Scheduler] ${jobName} finished in ${durationMs}ms`);
    }
  } catch (error) {
    console.error(`[Scheduler] ${jobName} failed:`, error);
  } finally {
    runningJobs.delete(jobName);
  }
};

const runLiveNewsDetectionWorker = (payload = {}) =>
  new Promise((resolve, reject) => {
    const child = fork(LIVE_NEWS_WORKER_SCRIPT, [], {
      env: {
        ...process.env,
        LIVE_NEWS_WORKER_PAYLOAD: JSON.stringify(payload),
      },
      silent: true,
    });

    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Live news worker timed out after ${LIVE_NEWS_WORKER_TIMEOUT_MS}ms`));
    }, LIVE_NEWS_WORKER_TIMEOUT_MS);

    child.stdout?.on("data", (chunk) => {
      const message = String(chunk || "").trim();
      if (message) {
        console.log(message);
      }
    });

    child.stderr?.on("data", (chunk) => {
      const message = String(chunk || "").trim();
      if (message) {
        console.error(message);
      }
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Live news worker exited with code ${code}`));
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

const runTrendingWarmCacheJob = async (options = {}) => {
  const startedAt = Date.now();
  const result = await newsTrendingService.warmTrendingCaches({
    countries: options.countries,
    limitPerCategory: 3,
    limitPerFeed: 3,
    totalLimit: 12,
    usePersisted: true,
  });

  console.log("[Scheduler] Trending warm cache completed", {
    countries: result.totalCountries,
    durationMs: Date.now() - startedAt,
    successful: result.totalSuccessful,
  });
};

const runDailyQuestionLiveJob = async () => {
  const countries = SUPPORTED_COUNTRIES.map((country) => country.code);
  const results = await Promise.all(
    countries.map((countryCode) =>
      engagementNotificationService.notifyDailyQuestionLiveUsers({ countryCode })
    )
  );

  console.log("[Scheduler] Daily question live push completed", {
    countries: countries.length,
    sent: results.reduce((sum, item) => sum + Number(item?.sent || 0), 0),
  });
};

const startNotificationScheduler = () => {
  if (started) {
    return;
  }

  started = true;
  const timezone =
    process.env.APP_TIME_ZONE || process.env.APP_TIMEZONE || "America/Los_Angeles";

  cron.schedule(
    TRENDING_WARM_CRON,
    withJobGuard("trending-warm-cache", async () => {
      await runTrendingWarmCacheJob();
    }),
    { timezone }
  );

  cron.schedule(
    "*/10 * * * *",
    withJobGuard("live-news-detection", async () => {
      await runLiveNewsDetectionWorker({
        expiresInMinutes: 180,
        langCode: "sq",
        limit: 1,
        limitPerFeed: 5,
        sendNotification: true,
        threshold: 5,
      });
    }),
    { timezone }
  );

  cron.schedule(
    "0 * * * *",
    withJobGuard("group-pressure", async () => {
        await engagementNotificationService.notifyGroupPressureUsers();
    }),
    { timezone }
  );

  cron.schedule(
    "0 22 * * *",
    withJobGuard("streak-risk", async () => {
        await engagementNotificationService.notifyStreakAtRiskUsers();
    }),
    { timezone }
  );

  cron.schedule(
    "0 9 * * *",
    withJobGuard("daily-question-live", async () => {
      await runDailyQuestionLiveJob();
    }),
    { timezone }
  );

  if (TRENDING_WARM_ON_START) {
    void withJobGuard("trending-warm-cache-startup", async () => {
      await runTrendingWarmCacheJob();
    })();
  }

  console.log(`Notification scheduler active in ${timezone}`);
};

module.exports = {
  startNotificationScheduler,
};
