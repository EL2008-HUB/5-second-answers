/**
 * Ranking Service - 5 SECOND CORE / 10 SECOND MAX feed logic
 */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getDurationSeconds = (answer) =>
  clamp(Number(answer?.duration || answer?.performance?.duration || 5), 1, 10);

const getCreatorScore = (userId, answers) => {
  const userAnswers = answers.filter((answer) => answer.userId === userId);
  const totalLikes = userAnswers.reduce(
    (sum, answer) => sum + (answer.interactions?.likes || 0),
    0
  );
  const totalViews = userAnswers.reduce(
    (sum, answer) => sum + (answer.interactions?.views || 0),
    0
  );
  const totalSaves = userAnswers.reduce(
    (sum, answer) => sum + (answer.interactions?.saves || 0),
    0
  );
  const totalShares = userAnswers.reduce(
    (sum, answer) => sum + (answer.interactions?.shares || 0),
    0
  );

  const baseScore = Math.min(
    (totalLikes * 2 + totalViews + totalSaves * 2 + totalShares * 3) / 1400,
    1
  );
  const experienceBonus = userAnswers.length > 10 ? 0.1 : 0;
  const qualityBonus = baseScore > 0.5 ? 0.05 : 0;

  return Math.min(baseScore + experienceBonus + qualityBonus, 1);
};

const getRecencyScore = (createdAt) => {
  const now = Date.now();
  const ageMs = now - new Date(createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  return Math.pow(0.5, ageHours / 24);
};

const getEngagementScore = (answer) => {
  const likes = answer.interactions?.likes || 0;
  const views = answer.interactions?.views || 0;
  const saves = answer.interactions?.saves || 0;
  const shares = answer.interactions?.shares || 0;
  const engagementValue = likes * 3 + views * 0.45 + saves * 2.4 + shares * 3.2;

  return Math.min(engagementValue / 120, 1.2);
};

const getBattleBoost = (answer) => {
  const votes = answer.battle?.votes || answer.battleStats?.votes || 0;
  return Math.min(votes / 12, 1);
};

const getAIConfidencePenalty = (answer) => {
  if (!answer.aiReview) {
    return 0;
  }

  if (!answer.aiReview.approved) {
    return -0.2;
  }

  if (answer.aiReview.score < 0.6) {
    return -0.1 * (1 - answer.aiReview.score);
  }

  return 0;
};

const getAdaptiveAiBoost = (answer) =>
  clamp(Number(answer?.aiOptimization?.rankingBoost || 0), -0.08, 0.18);

const getProfileSignal = (profile, answerId) => {
  if (!profile?.answerSignals?.get) {
    return null;
  }

  return profile.answerSignals.get(answerId) || null;
};

const isViralSpike = (answer) => Boolean(answer.performance?.viralSpike);

const isShortPriority = (answer) =>
  getDurationSeconds(answer) <= 5 || isViralSpike(answer);

const getSpeedBonus = (answer) => (isShortPriority(answer) ? 1.25 : 1);

const getCompletionRate = (answer, signal = null) => {
  if (signal?.viewCount) {
    return clamp(signal.completedViews / Math.max(signal.viewCount, 1), 0, 1.35);
  }

  return clamp(answer.performance?.completionRate || 0.45, 0, 1.35);
};

const getWatchDepth = (answer, signal = null) => {
  if (signal?.viewCount && signal?.duration) {
    return clamp(
      signal.totalWatchMs / (Math.max(signal.viewCount, 1) * signal.duration * 1000),
      0,
      1.6
    );
  }

  return clamp(answer.performance?.averageWatchRatio || 0.6, 0, 1.6);
};

const getLoopBoost = (answer, signal = null) => {
  if (signal) {
    const hasPerfectLoop =
      (signal.replayCount || 0) >= 1 && getWatchDepth(answer, signal) >= 0.9;
    return hasPerfectLoop ? 0.95 : Math.min((signal.replayCount || 0) * 0.3, 0.7);
  }

  return clamp(answer.performance?.loopBoost || 0, 0, 1.2);
};

const getRetentionWeightedScore = (answer, signal = null) => {
  const completionRate = getCompletionRate(answer, signal);
  const watchDepth = getWatchDepth(answer, signal);
  const engagement = getEngagementScore(answer);

  return clamp(
    completionRate * getSpeedBonus(answer) * (0.55 + engagement * 0.25 + watchDepth * 0.2),
    0,
    2
  );
};

const getDeepModeBonus = (answer, profile = {}) => {
  const mode = profile?.behavior?.mode || "balanced";
  const deepCategories = profile?.behavior?.deepCategories || new Set();
  const category = answer.question?.category || "general";
  const isLong = getDurationSeconds(answer) > 5;

  if (mode === "deep" && isLong) {
    return deepCategories.has(category) ? 0.18 : 0.1;
  }

  if (mode === "speed" && isShortPriority(answer)) {
    return 0.15;
  }

  return isLong && deepCategories.has(category) ? 0.08 : 0;
};

const qualifiesForDepthInjection = (answer) => {
  if (getDurationSeconds(answer) <= 7) {
    return false;
  }

  if (isViralSpike(answer)) {
    return true;
  }

  return Boolean(answer.performance?.isDepthQualified);
};

exports.scoreAnswer = (answer, allAnswers) => {
  try {
    const W_RETENTION = 0.32;
    const W_ENGAGEMENT = 0.16;
    const W_RECENCY = 0.14;
    const W_CREATOR = 0.12;
    const W_LOOP = 0.08;
    const W_AI = 0.1;
    const W_BATTLE = 0.04;
    const W_DEPTH = 0.04;

    const retention = getRetentionWeightedScore(answer);
    const engagement = getEngagementScore(answer);
    const recency = getRecencyScore(answer.createdAt);
    const creator = getCreatorScore(answer.userId, allAnswers);
    const battle = getBattleBoost(answer);
    const loopBoost = getLoopBoost(answer);
    const depthQuality = clamp(answer.performance?.depthQuality || 0, 0, 1.35);
    const aiPenalty = getAIConfidencePenalty(answer);
    const adaptiveAiBoost = getAdaptiveAiBoost(answer);
    const speedBoost = getSpeedBonus(answer) - 1;
    const viralOverride = isViralSpike(answer) ? 0.12 : 0;

    const score =
      W_RETENTION * retention +
      W_ENGAGEMENT * engagement +
      W_RECENCY * recency +
      W_CREATOR * creator +
      W_LOOP * loopBoost +
      W_AI * Math.max(0, (answer.aiReview?.score || 0.7) + aiPenalty) +
      W_BATTLE * battle +
      W_DEPTH * depthQuality +
      adaptiveAiBoost +
      speedBoost * 0.08 +
      viralOverride;

    return {
      score: Math.max(0, score),
      breakdown: {
        retention,
        engagement,
        recency,
        creator,
        battle,
        loopBoost,
        depthQuality,
        speedBonus: getSpeedBonus(answer),
        viralOverride,
        aiPenalty,
        adaptiveAiBoost,
      },
    };
  } catch (error) {
    console.error("Scoring error:", error);
    return { score: 0, breakdown: {} };
  }
};

exports.scorePersonalizedAnswer = (answer, allAnswers, profile = {}) => {
  const signal = getProfileSignal(profile, answer.id);
  const base = exports.scoreAnswer(answer, allAnswers);
  const categoryAffinity =
    profile.categoryAffinity?.[answer.question?.category || "general"] || 0;
  const followedBoost = profile.followedCreatorIds?.has?.(answer.userId) ? 1 : 0;
  const creatorAffinity = Math.max(
    profile.creatorAffinity?.[answer.userId] || 0,
    followedBoost
  );
  const directInterest = Math.min(
    (signal?.completedViews || 0) * 0.18 +
      (signal?.replayCount || 0) * 0.24 +
      (signal?.saveCount || 0) * 0.32 +
      (signal?.shareCount || 0) * 0.36,
    1
  );
  const repeatPenalty = signal
    ? Math.max(
        0.32,
        1 -
          Math.min(signal.viewCount || 0, 4) * 0.12 -
          Math.min((signal.totalWatchMs || 0) / 20000, 0.22) +
          Math.min(
            ((signal.replayCount || 0) +
              (signal.saveCount || 0) +
              (signal.shareCount || 0)) *
              0.1,
            0.28
          )
      )
    : 1;

  const personalizedScore =
    0.38 * base.score +
    0.18 * categoryAffinity +
    0.2 * creatorAffinity +
    0.1 * directInterest +
    0.08 * getDeepModeBonus(answer, profile) +
    0.06 * getLoopBoost(answer, signal);

  return {
    score: Math.max(0, personalizedScore * repeatPenalty),
    breakdown: {
      ...base.breakdown,
      categoryAffinity,
      creatorAffinity,
      directInterest,
      repeatPenalty,
      behaviorMode: profile?.behavior?.mode || "balanced",
    },
  };
};

const takeNext = (source) => {
  const next = source.shift();
  return next || null;
};

const mixFeedByDuration = (answers, profile = {}, limit = 50) => {
  const mode = profile?.behavior?.mode || "balanced";
  const targetShortRatio = mode === "speed" ? 0.8 : mode === "deep" ? 0.55 : 0.7;
  const injectionFrequency = mode === "deep" ? 3 : mode === "speed" ? 5 : 4;

  const shortPool = answers.filter(isShortPriority);
  const depthPool = answers.filter(
    (answer) => !isShortPriority(answer) && qualifiesForDepthInjection(answer)
  );
  const longPool = answers.filter(
    (answer) => !isShortPriority(answer) && !qualifiesForDepthInjection(answer)
  );

  const mixed = [];
  let shortCount = 0;

  while (
    mixed.length < limit &&
    (shortPool.length || depthPool.length || longPool.length)
  ) {
    const nextIndex = mixed.length + 1;
    const shouldInjectDepth =
      nextIndex % injectionFrequency === 0 && (depthPool.length || longPool.length);

    let selected = null;

    if (shouldInjectDepth) {
      selected = takeNext(depthPool) || takeNext(longPool);
    } else {
      const projectedShortRatio =
        mixed.length === 0 ? 0 : shortCount / Math.max(mixed.length, 1);
      const wantsShort = projectedShortRatio < targetShortRatio;

      if (wantsShort) {
        selected = takeNext(shortPool) || takeNext(depthPool) || takeNext(longPool);
      } else {
        selected = takeNext(depthPool) || takeNext(longPool) || takeNext(shortPool);
      }
    }

    if (!selected) {
      break;
    }

    if (isShortPriority(selected)) {
      shortCount += 1;
    }

    mixed.push(selected);
  }

  return mixed;
};

exports.rankAnswers = (answers, sortBy = "top") => {
  if (!answers || answers.length === 0) {
    return [];
  }

  if (sortBy === "top") {
    return answers
      .map((answer) => ({
        ...answer,
        rankingScore: exports.scoreAnswer(answer, answers).score,
      }))
      .sort((left, right) => right.rankingScore - left.rankingScore);
  }

  if (sortBy === "newest") {
    return [...answers].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  if (sortBy === "trending") {
    return answers
      .map((answer) => {
        const { retention, engagement, recency, creator, battle, speedBonus, viralOverride, adaptiveAiBoost } =
          exports.scoreAnswer(answer, answers).breakdown;
        const trendingScore =
          0.32 * retention +
          0.26 * engagement +
          0.22 * recency +
          0.1 * creator +
          0.06 * battle +
          adaptiveAiBoost +
          (speedBonus - 1) * 0.05 +
          viralOverride * 0.08;

        return { ...answer, rankingScore: trendingScore };
      })
      .sort((left, right) => right.rankingScore - left.rankingScore);
  }

  return answers;
};

exports.getPersonalizedFeed = (
  answers,
  profile = {},
  { limit = 50, recentlyViewed = [] } = {}
) => {
  if (!answers || answers.length === 0) {
    return [];
  }

  const hiddenIds = new Set([
    ...recentlyViewed,
    ...(profile.recentlySeenIds ? Array.from(profile.recentlySeenIds) : []),
  ]);

  const candidates = answers.filter((answer) => {
    if (!hiddenIds.has(answer.id)) {
      return true;
    }

    const signal = getProfileSignal(profile, answer.id);
    return Boolean(signal?.saveCount || signal?.replayCount || signal?.shareCount);
  });

  const source = candidates.length ? candidates : answers;
  const scored = source
    .map((answer) => {
      const personalized = exports.scorePersonalizedAnswer(answer, answers, profile);
      const explorationBoost = 0.95 + Math.random() * 0.1;

      return {
        ...answer,
        rankingScore: personalized.score * explorationBoost,
        rankingBreakdown: personalized.breakdown,
      };
    })
    .sort((left, right) => right.rankingScore - left.rankingScore);

  return mixFeedByDuration(scored, profile, limit).slice(0, limit);
};

exports.getFYP = (answers, { profile = null, recentlyViewed = [], limit = 50 } = {}) => {
  if (!answers || answers.length === 0) {
    return [];
  }

  if (profile?.hasSignals || profile?.followedCreatorIds?.size) {
    return exports.getPersonalizedFeed(answers, profile, { limit, recentlyViewed });
  }

  const scored = answers
    .map((answer) => ({
      ...answer,
      rankingScore: exports.scoreAnswer(answer, answers).score * (0.95 + Math.random() * 0.1),
    }))
    .sort((left, right) => right.rankingScore - left.rankingScore);

  return mixFeedByDuration(scored, { behavior: { mode: "balanced" } }, limit).slice(0, limit);
};
