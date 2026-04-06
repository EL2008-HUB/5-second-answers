const { db } = require("../data/db");
const {
  DEFAULT_BATTLE_STATS,
  formatAnswer,
  parseMaybeJson,
  updateUserStats,
} = require("../data/helpers");

const DAILY_WATCH_TARGET = 5;
const DAILY_POST_TARGET = 1;
const XP_PER_BATTLE_VOTE = 15;
const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "America/Los_Angeles";

const DEFAULT_DAILY_ROW = {
  watchCount: 0,
  answersPosted: 0,
  watchTimeMs: 0,
  replayCount: 0,
  savesCount: 0,
  sharesCount: 0,
  likesGiven: 0,
  completedAnswers: 0,
};

const DEFAULT_SIGNAL_ROW = {
  viewCount: 0,
  completedViews: 0,
  replayCount: 0,
  totalWatchMs: 0,
  saveCount: 0,
  likeCount: 0,
  shareCount: 0,
  lastViewedAt: null,
  lastInteractionAt: null,
};

const numberValue = (value) => Number(value || 0);

const formatDateKey = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));

  const map = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });

  return `${map.year}-${map.month}-${map.day}`;
};

const addDaysToDateKey = (dateKey, days) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatDailyRow = (row) => ({
  activityDate:
    row.activity_date || row.activityDate
      ? formatDateKey(row.activity_date || row.activityDate)
      : null,
  watchCount: numberValue(row.watch_count ?? row.watchCount),
  answersPosted: numberValue(row.answers_posted ?? row.answersPosted),
  watchTimeMs: numberValue(row.watch_time_ms ?? row.watchTimeMs),
  replayCount: numberValue(row.replay_count ?? row.replayCount),
  savesCount: numberValue(row.saves_count ?? row.savesCount),
  sharesCount: numberValue(row.shares_count ?? row.sharesCount),
  likesGiven: numberValue(row.likes_given ?? row.likesGiven),
  completedAnswers: numberValue(row.completed_answers ?? row.completedAnswers),
});

const formatSignalRow = (row) => ({
  viewCount: numberValue(row.view_count ?? row.viewCount),
  completedViews: numberValue(row.completed_views ?? row.completedViews),
  replayCount: numberValue(row.replay_count ?? row.replayCount),
  totalWatchMs: numberValue(row.total_watch_ms ?? row.totalWatchMs),
  saveCount: numberValue(row.save_count ?? row.saveCount),
  likeCount: numberValue(row.like_count ?? row.likeCount),
  shareCount: numberValue(row.share_count ?? row.shareCount),
  lastViewedAt: row.last_viewed_at || row.lastViewedAt || null,
  lastInteractionAt: row.last_interaction_at || row.lastInteractionAt || null,
});

const getDailyStatsRow = async (userId, dateKey = formatDateKey()) =>
  db("user_daily_stats")
    .where({
      user_id: userId,
      activity_date: dateKey,
    })
    .first();

const upsertDailyStats = async (userId, updater, dateKey = formatDateKey()) => {
  const existing = await getDailyStatsRow(userId, dateKey);
  const current = {
    activityDate: dateKey,
    ...DEFAULT_DAILY_ROW,
    ...(existing ? formatDailyRow(existing) : {}),
  };
  const next = {
    ...current,
    ...updater({ ...current }),
    activityDate: dateKey,
  };

  const payload = {
    user_id: userId,
    activity_date: dateKey,
    watch_count: numberValue(next.watchCount),
    answers_posted: numberValue(next.answersPosted),
    watch_time_ms: numberValue(next.watchTimeMs),
    replay_count: numberValue(next.replayCount),
    saves_count: numberValue(next.savesCount),
    shares_count: numberValue(next.sharesCount),
    likes_given: numberValue(next.likesGiven),
    completed_answers: numberValue(next.completedAnswers),
    updated_at: db.fn.now(),
  };

  if (existing) {
    await db("user_daily_stats").where({ id: existing.id }).update(payload);
  } else {
    await db("user_daily_stats").insert(payload);
  }

  return next;
};

const getAnswerSignalRow = async (userId, answerId) =>
  db("user_answer_signals")
    .where({
      user_id: userId,
      answer_id: answerId,
    })
    .first();

const upsertUserAnswerSignal = async ({ userId, answer, updater }) => {
  const existing = await getAnswerSignalRow(userId, answer.id);
  const current = {
    ...DEFAULT_SIGNAL_ROW,
    ...(existing ? formatSignalRow(existing) : {}),
  };
  const next = {
    ...current,
    ...updater({ ...current }),
  };

  const payload = {
    user_id: userId,
    answer_id: answer.id,
    question_id: answer.questionId || null,
    creator_user_id: answer.userId || null,
    category: answer.question?.category || "general",
    view_count: numberValue(next.viewCount),
    completed_views: numberValue(next.completedViews),
    replay_count: numberValue(next.replayCount),
    total_watch_ms: numberValue(next.totalWatchMs),
    save_count: numberValue(next.saveCount),
    like_count: numberValue(next.likeCount),
    share_count: numberValue(next.shareCount),
    last_viewed_at: next.lastViewedAt || null,
    last_interaction_at: next.lastInteractionAt || null,
    updated_at: db.fn.now(),
  };

  if (existing) {
    await db("user_answer_signals").where({ id: existing.id }).update(payload);
  } else {
    await db("user_answer_signals").insert(payload);
  }

  return next;
};

const recordAnswerPosted = async (userId) =>
  upsertDailyStats(userId, (current) => ({
    ...current,
    answersPosted: current.answersPosted + 1,
  }));

const recordInteractionSignal = async ({ userId, answer, type }) => {
  if (!userId || !answer?.id || !["like", "save", "share"].includes(type)) {
    return null;
  }

  await upsertUserAnswerSignal({
    userId,
    answer,
    updater: (current) => ({
      ...current,
      saveCount: current.saveCount + (type === "save" ? 1 : 0),
      likeCount: current.likeCount + (type === "like" ? 1 : 0),
      shareCount: current.shareCount + (type === "share" ? 1 : 0),
      lastInteractionAt: new Date().toISOString(),
    }),
  });

  return upsertDailyStats(userId, (current) => ({
    ...current,
    savesCount: current.savesCount + (type === "save" ? 1 : 0),
    sharesCount: current.sharesCount + (type === "share" ? 1 : 0),
    likesGiven: current.likesGiven + (type === "like" ? 1 : 0),
  }));
};

const recordWatchSession = async ({
  userId,
  answer,
  watchTimeMs = 0,
  replayCount = 0,
  completed = false,
}) => {
  if (!userId || !answer?.id) {
    return null;
  }

  const safeWatchTimeMs = Math.max(0, Math.round(Number(watchTimeMs) || 0));
  const safeReplayCount = Math.max(0, Math.round(Number(replayCount) || 0));
  const shouldTrackView = safeWatchTimeMs > 0 || safeReplayCount > 0 || completed;

  if (!shouldTrackView) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const todayKey = formatDateKey(nowIso);
  let alreadyCountedToday = false;

  await upsertUserAnswerSignal({
    userId,
    answer,
    updater: (current) => {
      const lastViewedKey = current.lastViewedAt
        ? formatDateKey(current.lastViewedAt)
        : null;

      alreadyCountedToday = lastViewedKey === todayKey;

      return {
        ...current,
        viewCount: current.viewCount + 1,
        completedViews: current.completedViews + (completed ? 1 : 0),
        replayCount: current.replayCount + safeReplayCount,
        totalWatchMs: current.totalWatchMs + safeWatchTimeMs,
        lastViewedAt: nowIso,
        lastInteractionAt: nowIso,
      };
    },
  });

  return upsertDailyStats(userId, (current) => ({
    ...current,
    watchCount: current.watchCount + (alreadyCountedToday ? 0 : 1),
    watchTimeMs: current.watchTimeMs + safeWatchTimeMs,
    replayCount: current.replayCount + safeReplayCount,
    completedAnswers: current.completedAnswers + (completed ? 1 : 0),
  }));
};

const normalizeScoreMap = (scoreMap) => {
  const entries = Object.entries(scoreMap);
  if (!entries.length) {
    return {};
  }

  const maxScore = Math.max(...entries.map(([, value]) => Number(value || 0)), 0);
  if (!maxScore) {
    return {};
  }

  return Object.fromEntries(
    entries.map(([key, value]) => [key, Number(value || 0) / maxScore])
  );
};

const getSafeDurationSeconds = (duration) =>
  Math.min(10, Math.max(1, numberValue(duration) || 5));

const getDefaultPerformanceSnapshot = (duration = 5) => {
  const safeDuration = getSafeDurationSeconds(duration);

  return {
    duration: safeDuration,
    viewerCount: 0,
    totalViews: 0,
    completionRate: safeDuration <= 5 ? 0.58 : 0.46,
    averageWatchRatio: safeDuration <= 5 ? 0.72 : 0.62,
    replayRate: 0,
    saveRate: 0,
    shareRate: 0,
    loopBoost: 0,
    depthQuality: 0,
    recentActivity: 0,
    isDepthQualified: false,
    viralSpike: false,
  };
};

const buildPerformanceSnapshot = (row) => {
  const defaults = getDefaultPerformanceSnapshot(row.duration);
  const totalViews = numberValue(row.total_views);
  const completedViews = numberValue(row.completed_views);
  const replayCount = numberValue(row.replay_count);
  const totalWatchMs = numberValue(row.total_watch_ms);
  const saveCount = numberValue(row.save_count);
  const likeCount = numberValue(row.like_count);
  const shareCount = numberValue(row.share_count);
  const viewerCount = numberValue(row.viewer_count);
  const duration = defaults.duration;
  const completionRate = totalViews ? completedViews / totalViews : defaults.completionRate;
  const averageWatchRatio = totalViews
    ? Math.min(totalWatchMs / (totalViews * duration * 1000), 1.6)
    : defaults.averageWatchRatio;
  const replayRate = totalViews ? replayCount / totalViews : 0;
  const saveRate = totalViews ? saveCount / totalViews : 0;
  const shareRate = totalViews ? shareCount / totalViews : 0;
  const likeRate = totalViews ? likeCount / totalViews : 0;
  const lastInteractionAt = row.last_interaction_at || null;
  const hoursSinceLastInteraction = lastInteractionAt
    ? Math.max(
        1,
        (Date.now() - new Date(lastInteractionAt).getTime()) / (1000 * 60 * 60)
      )
    : 96;
  const recentActivity = Math.min(
    6,
    viewerCount / Math.max(hoursSinceLastInteraction, 6) + shareCount * 0.4
  );
  const depthQuality = Math.min(
    1.35,
    completionRate * 0.45 +
      Math.min(averageWatchRatio, 1.1) * 0.25 +
      Math.min(saveRate, 1) * 0.2 +
      Math.min(shareRate + likeRate * 0.5, 1) * 0.1
  );
  const loopBoost =
    duration <= 5
      ? Math.min(1.2, replayRate * 1.8 + (averageWatchRatio > 0.95 ? 0.18 : 0))
      : Math.min(0.8, replayRate * 0.9);
  const isDepthQualified =
    duration > 5 &&
    completionRate >= 0.65 &&
    (saveCount > 0 || shareCount > 0 || likeCount >= 2);
  const viralSpike =
    duration > 5 && shareRate >= 0.08 && (recentActivity >= 0.35 || saveRate >= 0.08);

  return {
    duration,
    viewerCount,
    totalViews,
    completionRate,
    averageWatchRatio,
    replayRate,
    saveRate,
    shareRate,
    loopBoost,
    depthQuality,
    recentActivity,
    isDepthQualified,
    viralSpike,
  };
};

const loadAnswerPerformanceMap = async (answerIds = []) => {
  if (!answerIds.length) {
    return new Map();
  }

  const rows = await db("user_answer_signals as s")
    .join("answers as a", "a.id", "s.answer_id")
    .whereIn("s.answer_id", answerIds)
    .select("s.answer_id", "a.duration")
    .countDistinct({ viewer_count: "s.user_id" })
    .sum({ total_views: "s.view_count" })
    .sum({ completed_views: "s.completed_views" })
    .sum({ replay_count: "s.replay_count" })
    .sum({ total_watch_ms: "s.total_watch_ms" })
    .sum({ save_count: "s.save_count" })
    .sum({ like_count: "s.like_count" })
    .sum({ share_count: "s.share_count" })
    .max({ last_interaction_at: "s.last_interaction_at" })
    .groupBy("s.answer_id", "a.duration");

  return new Map(rows.map((row) => [row.answer_id, buildPerformanceSnapshot(row)]));
};

const loadPersonalizationProfile = async (userId) => {
  if (!userId) {
    return {
      hasSignals: false,
      followedCreatorIds: new Set(),
      categoryAffinity: {},
      creatorAffinity: {},
      answerSignals: new Map(),
      recentlySeenIds: new Set(),
      behavior: {
        mode: "balanced",
        deepCategories: new Set(),
      },
    };
  }

  const [followRows, signalRows] = await Promise.all([
    db("user_follows")
      .where({ follower_user_id: userId })
      .select("followed_user_id"),
    db("user_answer_signals as s")
      .leftJoin("answers as a", "a.id", "s.answer_id")
      .where({ "s.user_id": userId })
      .select("s.*", "a.duration")
      .orderBy("s.last_interaction_at", "desc")
      .limit(500),
  ]);

  const followedCreatorIds = new Set(
    followRows.map((row) => row.followed_user_id).filter(Boolean)
  );
  const categoryScores = {};
  const creatorScores = {};
  const deepCategoryScores = {};
  const answerSignals = new Map();
  const recentlySeenIds = new Set();
  const now = Date.now();
  let speedBiasScore = 0;
  let deepBiasScore = 0;

  signalRows.forEach((row) => {
    const signal = formatSignalRow(row);
    const answerId = row.answer_id;
    const creatorUserId = row.creator_user_id;
    const category = row.category || "general";
    const duration = getSafeDurationSeconds(row.duration);
    const averageWatchRatio = signal.viewCount
      ? Math.min(signal.totalWatchMs / (signal.viewCount * duration * 1000), 1.6)
      : 0;
    const completionRate = signal.viewCount
      ? signal.completedViews / signal.viewCount
      : 0;

    const affinityScore = Math.min(
      signal.totalWatchMs / 5000 +
        signal.completedViews * 0.7 +
        signal.replayCount * 1.4 +
        signal.saveCount * 2.2 +
        signal.shareCount * 2.4 +
        signal.likeCount * 0.8,
      12
    );

    categoryScores[category] = (categoryScores[category] || 0) + affinityScore;

    if (creatorUserId) {
      creatorScores[creatorUserId] = (creatorScores[creatorUserId] || 0) + affinityScore;
    }

    answerSignals.set(answerId, {
      ...signal,
      answerId,
      creatorUserId,
      category,
      duration,
      averageWatchRatio,
      completionRate,
    });

    if (signal.lastViewedAt) {
      const hoursSinceViewed =
        (now - new Date(signal.lastViewedAt).getTime()) / (1000 * 60 * 60);

      if (hoursSinceViewed < 18 && signal.saveCount === 0 && signal.replayCount === 0) {
        recentlySeenIds.add(answerId);
      }
    }

    if (duration <= 5) {
      speedBiasScore +=
        Math.min(1.4, signal.viewCount * 0.22 + averageWatchRatio * 0.75) +
        signal.replayCount * 0.35 +
        (averageWatchRatio < 0.55 && signal.viewCount >= 2 ? 0.8 : 0);
    } else {
      const deepContribution =
        completionRate * 1.4 +
        averageWatchRatio +
        signal.saveCount * 0.8 +
        signal.shareCount * 1.1 +
        signal.likeCount * 0.35;

      deepBiasScore += deepContribution;
      deepCategoryScores[category] = (deepCategoryScores[category] || 0) + deepContribution;
    }
  });

  const deepCategories = new Set(
    Object.entries(deepCategoryScores)
      .filter(([, score]) => Number(score || 0) >= 1.15)
      .map(([category]) => category)
  );
  const mode =
    deepBiasScore > speedBiasScore * 1.18
      ? "deep"
      : speedBiasScore > deepBiasScore * 1.15
        ? "speed"
        : "balanced";

  return {
    hasSignals: signalRows.length > 0 || followedCreatorIds.size > 0,
    followedCreatorIds,
    categoryAffinity: normalizeScoreMap(categoryScores),
    creatorAffinity: normalizeScoreMap(creatorScores),
    answerSignals,
    recentlySeenIds,
    behavior: {
      mode,
      deepCategories,
    },
  };
};

const getDailyMissionState = async (userId) => {
  const todayKey = formatDateKey();
  const rows = (
    await db("user_daily_stats")
      .where({ user_id: userId })
      .orderBy("activity_date", "desc")
      .limit(120)
  ).map(formatDailyRow);

  const todayRow =
    rows.find((row) => row.activityDate === todayKey) || {
      activityDate: todayKey,
      ...DEFAULT_DAILY_ROW,
    };

  const activeRows = rows.filter(
    (row) => row.watchCount > 0 || row.answersPosted > 0
  );
  const activeDates = new Set(activeRows.map((row) => row.activityDate));
  const yesterdayKey = addDaysToDateKey(todayKey, -1);

  let streakAnchor = null;
  if (activeDates.has(todayKey)) {
    streakAnchor = todayKey;
  } else if (activeDates.has(yesterdayKey)) {
    streakAnchor = yesterdayKey;
  }

  let currentStreak = 0;
  if (streakAnchor) {
    let cursor = streakAnchor;
    while (activeDates.has(cursor)) {
      currentStreak += 1;
      cursor = addDaysToDateKey(cursor, -1);
    }
  }

  let bestStreak = 0;
  const orderedDates = [...activeDates].sort();
  let previousDate = null;
  let runningStreak = 0;

  orderedDates.forEach((dateKey) => {
    if (previousDate && addDaysToDateKey(previousDate, 1) === dateKey) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
    }

    bestStreak = Math.max(bestStreak, runningStreak);
    previousDate = dateKey;
  });

  const watchProgress = Math.min(todayRow.watchCount, DAILY_WATCH_TARGET);
  const postProgress = Math.min(todayRow.answersPosted, DAILY_POST_TARGET);
  const completedMissionCount =
    Number(watchProgress >= DAILY_WATCH_TARGET) +
    Number(postProgress >= DAILY_POST_TARGET);

  return {
    date: todayKey,
    streak: {
      current: currentStreak,
      best: bestStreak,
      activeToday: activeDates.has(todayKey),
      atRisk: !activeDates.has(todayKey) && activeDates.has(yesterdayKey),
      lastActiveDate: activeRows[0]?.activityDate || null,
    },
    totals: {
      watchCount: todayRow.watchCount,
      answersPosted: todayRow.answersPosted,
      watchTimeMs: todayRow.watchTimeMs,
      replayCount: todayRow.replayCount,
    },
    progressRatio:
      watchProgress / DAILY_WATCH_TARGET / 2 + postProgress / DAILY_POST_TARGET / 2,
    completedMissionCount,
    missions: [
      {
        id: "watch-five",
        label: "Watch 5 answers today",
        progress: watchProgress,
        target: DAILY_WATCH_TARGET,
        completed: watchProgress >= DAILY_WATCH_TARGET,
      },
      {
        id: "post-one",
        label: "Post 1 answer today",
        progress: postProgress,
        target: DAILY_POST_TARGET,
        completed: postProgress >= DAILY_POST_TARGET,
      },
    ],
  };
};

const loadBattleCandidates = async (questionId) => {
  const rows = await db("answers as a")
    .leftJoin("users as u", "u.id", "a.user_id")
    .where("a.question_id", questionId)
    .andWhere("a.status", "approved")
    .select("a.*", "u.username", "u.avatar", "u.followers")
    .orderBy("a.created_at", "desc");

  const rankingService = require("./rankingService");
  const answers = rows.map((row) =>
    formatAnswer(row, {
      user: {
        username: row.username || "anonymous",
        avatar: row.avatar || null,
        followers: numberValue(row.followers),
      },
    })
  );

  return rankingService.rankAnswers(answers, "top").slice(0, 2);
};

const buildBattleSnapshot = async (questionId, userId = null, candidates = null) => {
  const participants = candidates?.length ? candidates.slice(0, 2) : await loadBattleCandidates(questionId);

  if (participants.length < 2) {
    return {
      available: false,
      questionId,
      participants: [],
      totalVotes: 0,
      leaderAnswerId: null,
      userVoteAnswerId: null,
      xpReward: XP_PER_BATTLE_VOTE,
    };
  }

  const [voteRows, userVoteRow] = await Promise.all([
    db("answer_battle_votes")
      .where({ question_id: questionId })
      .select("answer_id")
      .count("* as votes")
      .groupBy("answer_id"),
    userId
      ? db("answer_battle_votes")
          .where({ question_id: questionId, user_id: userId })
          .first()
      : Promise.resolve(null),
  ]);

  const voteMap = new Map(
    voteRows.map((row) => [row.answer_id, numberValue(row.votes)])
  );
  const totalVotes = [...voteMap.values()].reduce((sum, value) => sum + value, 0);
  const maxVotes = Math.max(...participants.map((answer) => voteMap.get(answer.id) || 0), 0);

  const enrichedParticipants = participants.map((answer) => {
    const fallbackVotes = numberValue(
      parseMaybeJson(answer.battleStats, DEFAULT_BATTLE_STATS).votes
    );
    const votes = voteMap.get(answer.id) ?? fallbackVotes;

    return {
      ...answer,
      battle: {
        votes,
        isLeading: totalVotes > 0 && votes === maxVotes && votes > 0,
      },
    };
  });

  const leader = enrichedParticipants
    .slice()
    .sort((left, right) => (right.battle?.votes || 0) - (left.battle?.votes || 0))[0];

  return {
    available: true,
    questionId,
    participants: enrichedParticipants,
    totalVotes,
    leaderAnswerId: totalVotes > 0 ? leader?.id || null : null,
    userVoteAnswerId: userVoteRow?.answer_id || null,
    xpReward: XP_PER_BATTLE_VOTE,
  };
};

const voteBattle = async ({ questionId, answerId, userId }) => {
  const participants = await loadBattleCandidates(questionId);

  if (participants.length < 2) {
    return {
      ok: false,
      status: 400,
      error: "Battle needs at least 2 approved answers",
    };
  }

  const selectedAnswer = participants.find((answer) => answer.id === answerId);
  const opponent = participants.find((answer) => answer.id !== answerId);

  if (!selectedAnswer) {
    return {
      ok: false,
      status: 400,
      error: "Selected answer is not in the current battle",
    };
  }

  const existingVote = await db("answer_battle_votes")
    .where({
      question_id: questionId,
      user_id: userId,
    })
    .first();

  if (existingVote) {
    return {
      ok: true,
      alreadyVoted: true,
      snapshot: await buildBattleSnapshot(questionId, userId, participants),
    };
  }

  await db("answer_battle_votes").insert({
    question_id: questionId,
    answer_id: answerId,
    competitor_answer_id: opponent?.id || null,
    user_id: userId,
  });

  const currentBattleStats = {
    ...DEFAULT_BATTLE_STATS,
    ...parseMaybeJson(selectedAnswer.battleStats, DEFAULT_BATTLE_STATS),
  };

  await db("answers")
    .where({ id: answerId })
    .update({
      battle_stats: {
        ...currentBattleStats,
        votes: numberValue(currentBattleStats.votes) + 1,
      },
      updated_at: db.fn.now(),
    });

  await updateUserStats(selectedAnswer.userId, (stats) => ({
    ...stats,
    xp: numberValue(stats.xp) + XP_PER_BATTLE_VOTE,
    battleVotesReceived: numberValue(stats.battleVotesReceived) + 1,
  }));

  return {
    ok: true,
    alreadyVoted: false,
    snapshot: await buildBattleSnapshot(questionId, userId, participants),
  };
};

module.exports = {
  DAILY_POST_TARGET,
  DAILY_WATCH_TARGET,
  XP_PER_BATTLE_VOTE,
  buildBattleSnapshot,
  formatDateKey,
  getDefaultPerformanceSnapshot,
  getDailyMissionState,
  loadAnswerPerformanceMap,
  loadPersonalizationProfile,
  recordAnswerPosted,
  recordInteractionSignal,
  recordWatchSession,
  voteBattle,
};
