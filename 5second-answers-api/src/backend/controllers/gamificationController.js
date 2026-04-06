const { db } = require("../data/db");
const {
  findUserByIdentifier,
  loadAnswersByUser,
  parseMaybeJson,
  updateUserStats,
} = require("../data/helpers");
const badgeService = require("../services/badgeService");
const growthService = require("../services/growthService");
const streakService = require("../services/streakService");

const LEVEL_SIZE = 250;

const numberValue = (value) => Number(value || 0);

const toDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
};

const addDaysToDateKey = (dateKey, days) => {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
};

const formatDailyStatsRow = (row = {}) => ({
  activityDate: row.activity_date || row.activityDate || null,
  answersPosted: numberValue(row.answers_posted ?? row.answersPosted),
  completedAnswers: numberValue(row.completed_answers ?? row.completedAnswers),
  likesGiven: numberValue(row.likes_given ?? row.likesGiven),
  replayCount: numberValue(row.replay_count ?? row.replayCount),
  savesCount: numberValue(row.saves_count ?? row.savesCount),
  sharesCount: numberValue(row.shares_count ?? row.sharesCount),
  watchCount: numberValue(row.watch_count ?? row.watchCount),
  watchTimeMs: numberValue(row.watch_time_ms ?? row.watchTimeMs),
});

const getPeriodWindow = (period = "weekly") => {
  const normalizedPeriod = String(period || "weekly").trim().toLowerCase();
  const days =
    normalizedPeriod === "daily" ? 1 : normalizedPeriod === "monthly" ? 30 : 7;
  const endDateKey = growthService.formatDateKey();
  const startDateKey = addDaysToDateKey(endDateKey, -(days - 1));
  const previousEndDateKey = addDaysToDateKey(startDateKey, -1);
  const previousStartDateKey = addDaysToDateKey(previousEndDateKey, -(days - 1));

  return {
    days,
    endDateKey,
    period: normalizedPeriod,
    previousEndDateKey,
    previousStartDateKey,
    startDateKey,
  };
};

const isActiveRow = (row = {}) =>
  numberValue(row.answersPosted) > 0 || numberValue(row.watchCount) > 0;

const countActiveDays = (rows = []) => rows.filter(isActiveRow).length;

const calculatePeriodPoints = (rows = [], streak = 0) => {
  const totals = rows.reduce(
    (accumulator, row) => ({
      answersPosted: accumulator.answersPosted + numberValue(row.answersPosted),
      completedAnswers:
        accumulator.completedAnswers + numberValue(row.completedAnswers),
      likesGiven: accumulator.likesGiven + numberValue(row.likesGiven),
      savesCount: accumulator.savesCount + numberValue(row.savesCount),
      sharesCount: accumulator.sharesCount + numberValue(row.sharesCount),
      watchCount: accumulator.watchCount + numberValue(row.watchCount),
    }),
    {
      answersPosted: 0,
      completedAnswers: 0,
      likesGiven: 0,
      savesCount: 0,
      sharesCount: 0,
      watchCount: 0,
    }
  );

  const activeDays = countActiveDays(rows);
  const points =
    totals.answersPosted * 100 +
    activeDays * 30 +
    totals.watchCount * 8 +
    totals.completedAnswers * 6 +
    totals.likesGiven * 4 +
    totals.savesCount * 6 +
    totals.sharesCount * 14 +
    Math.min(50, numberValue(streak) * 5);

  return {
    activeDays,
    points,
    totals,
  };
};

const calculateLifetimePoints = ({ user, answers = [], streak = 0 }) => {
  const stats = parseMaybeJson(user?.stats, {});
  const answersGiven = numberValue(stats.answersGiven);
  const likesReceived = numberValue(stats.likesReceived);
  const questionsAsked = numberValue(stats.questionsAsked);
  const xp = numberValue(stats.xp);
  const missionsCompleted = numberValue(stats.missionsCompleted);
  const badgesEarned = Array.isArray(user?.badges) ? user.badges.length : 0;

  return (
    xp +
    answersGiven * 40 +
    likesReceived * 3 +
    questionsAsked * 8 +
    missionsCompleted * 25 +
    badgesEarned * 20 +
    Math.min(120, numberValue(streak) * 8) +
    answers.reduce(
      (sum, answer) =>
        sum +
        numberValue(answer?.interactions?.views) * 0.2 +
        numberValue(answer?.interactions?.shares) * 3 +
        numberValue(answer?.interactions?.saves) * 2,
      0
    )
  );
};

const getLevelState = (points = 0) => {
  const safePoints = Math.max(0, Math.round(points));
  return {
    currentLevelXP: safePoints % LEVEL_SIZE,
    level: Math.floor(safePoints / LEVEL_SIZE) + 1,
    nextLevelXP: LEVEL_SIZE,
  };
};

const loadDailyRowsForWindow = async (userIds = [], startDateKey, endDateKey) => {
  if (!userIds.length) {
    return [];
  }

  return db("user_daily_stats")
    .whereIn("user_id", userIds)
    .andWhere("activity_date", ">=", startDateKey)
    .andWhere("activity_date", "<=", endDateKey)
    .select("*");
};

const groupRowsByUserId = (rows = []) =>
  rows.reduce((accumulator, row) => {
    const existing = accumulator.get(row.user_id) || [];
    existing.push(formatDailyStatsRow(row));
    accumulator.set(row.user_id, existing);
    return accumulator;
  }, new Map());

const buildLeaderboardData = async ({ limit = 50, period = "weekly", viewerUserId = null }) => {
  const safeLimit = Math.max(3, Math.min(100, parseInt(limit, 10) || 50));
  const periodWindow = getPeriodWindow(period);
  const userRows = await db("users")
    .select("id", "username", "avatar", "stats")
    .orderBy("created_at", "asc");

  const streakRows = await db("user_streaks")
    .whereIn(
      "user_id",
      userRows.map((row) => row.id)
    )
    .select("user_id", "current_streak");

  const streakMap = new Map(
    streakRows.map((row) => [row.user_id, numberValue(row.current_streak)])
  );

  const [currentRows, previousRows] = await Promise.all([
    loadDailyRowsForWindow(
      userRows.map((row) => row.id),
      periodWindow.startDateKey,
      periodWindow.endDateKey
    ),
    loadDailyRowsForWindow(
      userRows.map((row) => row.id),
      periodWindow.previousStartDateKey,
      periodWindow.previousEndDateKey
    ),
  ]);

  const currentRowsByUser = groupRowsByUserId(currentRows);
  const previousRowsByUser = groupRowsByUserId(previousRows);
  const entries = userRows
    .map((row) => {
      const currentUserRows = currentRowsByUser.get(row.id) || [];
      const previousUserRows = previousRowsByUser.get(row.id) || [];
      const streak = streakMap.get(row.id) || 0;
      const current = calculatePeriodPoints(currentUserRows, streak);
      const previous = calculatePeriodPoints(previousUserRows, 0);
      const hasActivity = current.points > 0 || current.activeDays > 0;

      if (!hasActivity && row.id !== viewerUserId) {
        return null;
      }

      return {
        activeDays: current.activeDays,
        avatar: row.avatar || null,
        id: row.id,
        isCurrentUser: row.id === viewerUserId,
        period: periodWindow.period,
        points: current.points,
        previousPoints: previous.points,
        stats: {
          activeDays: current.activeDays,
          answers: current.totals.answersPosted,
          streak,
          watchCount: current.totals.watchCount,
        },
        trend:
          current.points > previous.points
            ? "up"
            : current.points < previous.points
              ? "down"
              : "same",
        username: row.username,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.points !== left.points) {
        return right.points - left.points;
      }
      if (right.stats.answers !== left.stats.answers) {
        return right.stats.answers - left.stats.answers;
      }
      return right.stats.activeDays - left.stats.activeDays;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  const currentUser =
    entries.find((entry) => entry.id === viewerUserId) ||
    (viewerUserId
      ? {
          activeDays: 0,
          avatar: null,
          id: viewerUserId,
          isCurrentUser: true,
          period: periodWindow.period,
          points: 0,
          previousPoints: 0,
          rank: entries.length + 1,
          stats: {
            activeDays: 0,
            answers: 0,
            streak: streakMap.get(viewerUserId) || 0,
            watchCount: 0,
          },
          trend: "same",
          username:
            userRows.find((row) => row.id === viewerUserId)?.username || "you",
        }
      : null);

  return {
    currentUser,
    generatedAt: new Date().toISOString(),
    leaderboard: entries.slice(0, safeLimit),
    period: periodWindow.period,
    window: {
      endDateKey: periodWindow.endDateKey,
      startDateKey: periodWindow.startDateKey,
    },
  };
};

const getTodayWindow = () => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return {
    endIso: end.toISOString(),
    startIso: start.toISOString(),
  };
};

exports.getUserStats = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await findUserByIdentifier(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const [answers, missionState, streak] = await Promise.all([
      loadAnswersByUser(user.id),
      growthService.getDailyMissionState(user.id),
      streakService.getUserStreak(user.id),
    ]);
    const weeklyWindow = getPeriodWindow("weekly");
    const weeklyRows = (await loadDailyRowsForWindow(
      [user.id],
      weeklyWindow.startDateKey,
      weeklyWindow.endDateKey
    )).map(formatDailyStatsRow);
    const weekly = calculatePeriodPoints(weeklyRows, streak.current);
    const totals = answers.reduce(
      (accumulator, answer) => ({
        likesReceived:
          accumulator.likesReceived + numberValue(answer?.interactions?.likes),
        savesReceived:
          accumulator.savesReceived + numberValue(answer?.interactions?.saves),
        sharesReceived:
          accumulator.sharesReceived + numberValue(answer?.interactions?.shares),
        viewsReceived:
          accumulator.viewsReceived + numberValue(answer?.interactions?.views),
      }),
      {
        likesReceived: 0,
        savesReceived: 0,
        sharesReceived: 0,
        viewsReceived: 0,
      }
    );
    const points = Math.round(
      calculateLifetimePoints({
        answers,
        streak: streak.current,
        user,
      })
    );
    const levelState = getLevelState(points);

    return res.json({
      currentLevelXP: levelState.currentLevelXP,
      level: levelState.level,
      missionState,
      nextLevelXP: levelState.nextLevelXP,
      points,
      stats: {
        activeDaysThisWeek: weekly.activeDays,
        answersGiven: numberValue(user.stats?.answersGiven),
        likesReceived: totals.likesReceived,
        questionsAsked: numberValue(user.stats?.questionsAsked),
        savesReceived: totals.savesReceived,
        sharesReceived: totals.sharesReceived,
        viewsReceived: totals.viewsReceived,
        weeklyPoints: weekly.points,
      },
      streak: streak.current,
      bestStreak: Math.max(
        numberValue(user.stats?.bestStreak),
        missionState.streak?.best || 0,
        streak.current
      ),
      user: {
        avatar: user.avatar,
        id: user.id,
        username: user.username,
      },
      weekly,
    });
  } catch (error) {
    console.error("Get gamification user stats error:", error);
    return res.status(500).json({ error: "Failed to load gamification stats" });
  }
};

exports.getBadges = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await findUserByIdentifier(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const answers = await loadAnswersByUser(user.id);
    const badgeState = badgeService.getUserBadges(user, answers);
    const allBadges = [...badgeState.earned, ...badgeState.unearned].sort(
      (left, right) => numberValue(left.order) - numberValue(right.order)
    );

    return res.json({
      allBadges,
      totalAvailable: allBadges.length,
      totalUnlocked: badgeState.earned.length,
      unlockedBadges: badgeState.earned,
    });
  } catch (error) {
    console.error("Get gamification badges error:", error);
    return res.status(500).json({ error: "Failed to load badges" });
  }
};

exports.getChallenges = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await findUserByIdentifier(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const missionState = await growthService.getDailyMissionState(user.id);
    const weeklyWindow = getPeriodWindow("weekly");
    const weeklyRows = (await loadDailyRowsForWindow(
      [user.id],
      weeklyWindow.startDateKey,
      weeklyWindow.endDateKey
    )).map(formatDailyStatsRow);
    const streak = await streakService.getUserStreak(user.id);
    const weekly = calculatePeriodPoints(weeklyRows, streak.current);
    const { startIso: dayStartIso, endIso: dayEndIso } = getTodayWindow();
    const weekEndDate = new Date(`${weeklyWindow.endDateKey}T23:59:59.999Z`);

    const challenges = [
      {
        color: "#ff6b57",
        description: "Nje answer sot e mban streak-un gjalle",
        expiresAt: dayEndIso,
        icon: "🔥",
        id: "daily-answer",
        progress: missionState.totals?.answersPosted || 0,
        reward: { amount: 40, type: "points" },
        title: "Ruaje streak-un sot",
        total: 1,
        type: "daily",
      },
      {
        color: "#ffb347",
        description: "Zero friction, vetem hyr dhe shiko ritmin e dites",
        expiresAt: dayEndIso,
        icon: "👀",
        id: "daily-watch",
        progress: missionState.totals?.watchCount || 0,
        reward: { amount: 30, type: "points" },
        title: "Shiko 5 answers sot",
        total: 5,
        type: "daily",
      },
      {
        color: "#22c55e",
        description: "Sa me shume dite aktive, aq me lart ngjitesh ne jave",
        expiresAt: weekEndDate.toISOString(),
        icon: "📅",
        id: "weekly-active-days",
        progress: weekly.activeDays,
        reward: { amount: 120, type: "points" },
        title: "Behu aktiv 5 dite kete jave",
        total: 5,
        type: "weekly",
      },
      {
        color: "#60a5fa",
        description: "Pike nga answers + aktivitet per leaderboard javor",
        expiresAt: weekEndDate.toISOString(),
        icon: "🏆",
        id: "weekly-points",
        progress: weekly.points,
        reward: { amount: 180, type: "points" },
        title: "Kap 400 pike kete jave",
        total: 400,
        type: "weekly",
      },
    ].map((challenge) => ({
      ...challenge,
      completed: challenge.progress >= challenge.total,
      progressRatio: Math.min(
        1,
        challenge.total > 0 ? challenge.progress / challenge.total : 0
      ),
    }));

    return res.json({
      active: challenges.filter((challenge) => !challenge.completed),
      completed: challenges.filter((challenge) => challenge.completed),
      expired: [],
      generatedAt: new Date().toISOString(),
      lastActiveDate: missionState.streak?.lastActiveDate || null,
      startedAt: dayStartIso,
    });
  } catch (error) {
    console.error("Get gamification challenges error:", error);
    return res.status(500).json({ error: "Failed to load challenges" });
  }
};

exports.getLeaderboard = async (req, res) => {
  const { userId, period = "weekly", limit = 50 } = req.query;

  try {
    let viewerUserId = null;
    if (userId) {
      const viewer = await findUserByIdentifier(userId);
      viewerUserId = viewer?.id || null;
    }

    return res.json(
      await buildLeaderboardData({
        limit,
        period,
        viewerUserId,
      })
    );
  } catch (error) {
    console.error("Get gamification leaderboard error:", error);
    return res.status(500).json({ error: "Failed to load leaderboard" });
  }
};

exports.claimDailyReward = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await findUserByIdentifier(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const missionState = await growthService.getDailyMissionState(user.id);
    if (
      !missionState.completedMissionCount &&
      !missionState.streak?.activeToday &&
      !numberValue(missionState.totals?.answersPosted)
    ) {
      return res.status(400).json({
        error: "Complete at least one action today before claiming the reward",
      });
    }

    const todayKey = growthService.formatDateKey();
    const existingClaim = await db("notification_delivery_log")
      .where({
        channel: "system",
        type: "daily_reward_claimed",
        user_id: user.id,
      })
      .andWhere("sent_at", ">=", `${todayKey}T00:00:00.000Z`)
      .first("id");

    if (existingClaim) {
      return res.status(400).json({
        error: "Daily reward already claimed",
        nextClaimTime: `${addDaysToDateKey(todayKey, 1)}T00:00:00.000Z`,
      });
    }

    const rewardAmount =
      40 +
      numberValue(missionState.completedMissionCount) * 20 +
      (missionState.streak?.activeToday ? 10 : 0);

    await updateUserStats(user.id, (stats) => ({
      ...stats,
      xp: numberValue(stats.xp) + rewardAmount,
    }));
    await db("notification_delivery_log").insert({
      channel: "system",
      metadata: {
        rewardAmount,
        source: "daily_reward_claimed",
      },
      status: "claimed",
      type: "daily_reward_claimed",
      user_id: user.id,
    });

    return res.json({
      claimedAt: new Date().toISOString(),
      nextClaimTime: `${addDaysToDateKey(todayKey, 1)}T00:00:00.000Z`,
      reward: {
        amount: rewardAmount,
        type: "points",
      },
      success: true,
    });
  } catch (error) {
    console.error("Claim daily reward error:", error);
    return res.status(500).json({ error: "Failed to claim daily reward" });
  }
};

exports.updateProgress = async (req, res) => {
  const { userId } = req.params;
  const { action, data = {} } = req.body || {};

  try {
    const user = await findUserByIdentifier(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const pointsAwarded =
      action === "challenge_completed"
        ? numberValue(data.reward || 100)
        : action === "daily_streak"
          ? 25
          : action === "content_liked"
            ? 10
            : action === "answer_created"
              ? 40
              : 5;

    const updatedUser = await updateUserStats(user.id, (stats) => ({
      ...stats,
      missionsCompleted:
        numberValue(stats.missionsCompleted) +
        (action === "challenge_completed" ? 1 : 0),
      xp: numberValue(stats.xp) + pointsAwarded,
    }));

    return res.json({
      badgeUnlocked: data.badgeId || null,
      newTotal: numberValue(updatedUser?.stats?.xp),
      pointsAwarded,
      success: true,
    });
  } catch (error) {
    console.error("Update gamification progress error:", error);
    return res.status(500).json({ error: "Failed to update progress" });
  }
};
