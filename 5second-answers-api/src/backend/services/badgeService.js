const nowIso = () => new Date().toISOString();

const countFastAnswers = (answers = []) =>
  answers.filter((answer) => answer.timeMode !== "10s" && !answer.penaltyApplied).length;

const countSlowAnswers = (answers = []) =>
  answers.filter((answer) => answer.timeMode === "10s" || answer.penaltyApplied).length;

const BADGE_DEFINITIONS = {
  FIVE_SECOND: {
    id: "five_second",
    name: "5s Flash",
    description: "Posted an answer inside the 5 second window",
    emoji: "⚡",
    category: "speed",
    criteria: { firstFastAnswer: 1 },
    order: 0,
  },
  TEN_SECOND: {
    id: "ten_second",
    name: "10s Turtle",
    description: "Used the extra 5 seconds and still posted",
    emoji: "🐢",
    category: "speed",
    criteria: { firstSlowAnswer: 1 },
    order: 1,
  },
  STAR: {
    id: "star",
    name: "Star",
    description: "Received 50+ likes",
    emoji: "⭐",
    category: "engagement",
    criteria: { likesReceived: 50 },
    order: 2,
  },
  ACTIVE: {
    id: "active",
    name: "Active",
    description: "Answered 20+ questions",
    emoji: "🚀",
    category: "contributor",
    criteria: { answersGiven: 20 },
    order: 3,
  },
  VIP: {
    id: "vip",
    name: "VIP",
    description: "Received 500+ total views",
    emoji: "👑",
    category: "impact",
    criteria: { viewsReceived: 500 },
    order: 4,
  },
  RAPID_FIRE: {
    id: "rapid_fire",
    name: "Rapid Fire",
    description: "Answered 5+ questions in one day",
    emoji: "⚡",
    category: "streak",
    criteria: { answersInOneDay: 5 },
    order: 5,
  },
  PERFECT_SCORE: {
    id: "perfect_score",
    name: "Perfect Score",
    description: "10+ answers with 100% AI approval",
    emoji: "🎯",
    category: "quality",
    criteria: { perfectAnswers: 10 },
    order: 6,
  },
  INFLUENCER: {
    id: "influencer",
    name: "Influencer",
    description: "1000+ followers",
    emoji: "🌟",
    category: "influence",
    criteria: { followers: 1000 },
    order: 7,
  },
  BETA_TESTER: {
    id: "beta_tester",
    name: "Beta Tester",
    description: "Joined during MVP phase (manually awarded)",
    emoji: "🧪",
    category: "special",
    criteria: { manual: true },
    order: 8,
  },
  EXPERT: {
    id: "expert",
    name: "Expert",
    description: "100+ helpful answers with high quality score",
    emoji: "🎓",
    category: "mastery",
    criteria: { expertAnswers: 100 },
    order: 9,
  },
};

exports.checkBadgeUnlock = (badge, user, answers = []) => {
  const criteria = badge.criteria;

  if (criteria.manual) {
    return false;
  }

  if (criteria.firstFastAnswer) {
    return countFastAnswers(answers) >= criteria.firstFastAnswer;
  }

  if (criteria.firstSlowAnswer) {
    return countSlowAnswers(answers) >= criteria.firstSlowAnswer;
  }

  if (criteria.likesReceived && user.stats?.likesReceived >= criteria.likesReceived) {
    return true;
  }

  if (criteria.answersGiven && user.stats?.answersGiven >= criteria.answersGiven) {
    return true;
  }

  if (criteria.viewsReceived) {
    const totalViews = answers.reduce((sum, answer) => sum + (answer.interactions?.views || 0), 0);
    if (totalViews >= criteria.viewsReceived) {
      return true;
    }
  }

  if (criteria.answersInOneDay) {
    const today = new Date().toDateString();
    const todayAnswers = answers.filter(
      (answer) => new Date(answer.createdAt).toDateString() === today
    ).length;
    if (todayAnswers >= criteria.answersInOneDay) {
      return true;
    }
  }

  if (criteria.perfectAnswers) {
    const perfectAnswers = answers.filter(
      (answer) => answer.aiReview?.approved && answer.aiReview?.score >= 0.9
    ).length;
    if (perfectAnswers >= criteria.perfectAnswers) {
      return true;
    }
  }

  if (criteria.followers && user.followers >= criteria.followers) {
    return true;
  }

  if (criteria.expertAnswers) {
    const expertAnswers = answers.filter(
      (answer) => answer.aiReview?.approved && answer.interactions?.views >= 50
    ).length;
    if (expertAnswers >= criteria.expertAnswers) {
      return true;
    }
  }

  return false;
};

exports.getUserBadges = (user, answers = []) => {
  const earned = [];
  const unearned = [];

  Object.values(BADGE_DEFINITIONS).forEach((badgeDef) => {
    const isEarned = user.badges.some((badge) => badge.id === badgeDef.id);

    if (isEarned) {
      const earnedBadge = user.badges.find((badge) => badge.id === badgeDef.id);
      earned.push({
        ...badgeDef,
        unlockedAt: earnedBadge.unlockedAt,
        earned: true,
        progress: 100,
      });
      return;
    }

    const progress = calculateBadgeProgress(badgeDef, user, answers);
    unearned.push({
      ...badgeDef,
      progress: progress.percentage,
      progressText: progress.text,
      earned: false,
    });
  });

  return {
    earned: earned.sort((left, right) => left.order - right.order),
    unearned: unearned.sort((left, right) => left.order - right.order),
  };
};

function calculateBadgeProgress(badgeDef, user, answers = []) {
  const criteria = badgeDef.criteria;

  if (criteria.firstFastAnswer) {
    const current = countFastAnswers(answers);
    const target = criteria.firstFastAnswer;
    return {
      percentage: Math.min(100, Math.round((current / target) * 100)),
      text: `${current}/${target} fast answers`,
    };
  }

  if (criteria.firstSlowAnswer) {
    const current = countSlowAnswers(answers);
    const target = criteria.firstSlowAnswer;
    return {
      percentage: Math.min(100, Math.round((current / target) * 100)),
      text: `${current}/${target} slow answers`,
    };
  }

  if (criteria.likesReceived) {
    const current = user.stats?.likesReceived || 0;
    const target = criteria.likesReceived;
    return {
      percentage: Math.min(100, Math.round((current / target) * 100)),
      text: `${current}/${target} likes`,
    };
  }

  if (criteria.answersGiven) {
    const current = user.stats?.answersGiven || 0;
    const target = criteria.answersGiven;
    return {
      percentage: Math.min(100, Math.round((current / target) * 100)),
      text: `${current}/${target} answers`,
    };
  }

  if (criteria.viewsReceived) {
    const current = answers.reduce((sum, answer) => sum + (answer.interactions?.views || 0), 0);
    const target = criteria.viewsReceived;
    return {
      percentage: Math.min(100, Math.round((current / target) * 100)),
      text: `${current}/${target} views`,
    };
  }

  if (criteria.answersInOneDay) {
    const today = new Date().toDateString();
    const current = answers.filter(
      (answer) => new Date(answer.createdAt).toDateString() === today
    ).length;
    const target = criteria.answersInOneDay;
    return {
      percentage: Math.min(100, Math.round((current / target) * 100)),
      text: `${current}/${target} today`,
    };
  }

  if (criteria.perfectAnswers) {
    const current = answers.filter(
      (answer) => answer.aiReview?.approved && answer.aiReview?.score >= 0.9
    ).length;
    const target = criteria.perfectAnswers;
    return {
      percentage: Math.min(100, Math.round((current / target) * 100)),
      text: `${current}/${target} perfect`,
    };
  }

  if (criteria.followers) {
    const current = user.followers || 0;
    const target = criteria.followers;
    return {
      percentage: Math.min(100, Math.round((current / target) * 100)),
      text: `${current}/${target} followers`,
    };
  }

  if (criteria.expertAnswers) {
    const current = answers.filter(
      (answer) => answer.aiReview?.approved && answer.interactions?.views >= 50
    ).length;
    const target = criteria.expertAnswers;
    return {
      percentage: Math.min(100, Math.round((current / target) * 100)),
      text: `${current}/${target} expert`,
    };
  }

  return { percentage: 0, text: "Unknown" };
}

exports.unlockNewBadges = (user, answers = []) => {
  const newBadges = [];

  Object.values(BADGE_DEFINITIONS).forEach((badgeDef) => {
    if (user.badges.some((badge) => badge.id === badgeDef.id)) {
      return;
    }

    if (!exports.checkBadgeUnlock(badgeDef, user, answers)) {
      return;
    }

    const unlockedAt = nowIso();
    const badge = {
      id: badgeDef.id,
      name: badgeDef.name,
      emoji: badgeDef.emoji,
      unlockedAt,
    };

    newBadges.push(badge);
    user.badges.push(badge);
  });

  return newBadges;
};

exports.awardBadge = (user, badgeId) => {
  const badgeDef = Object.values(BADGE_DEFINITIONS).find((badge) => badge.id === badgeId);

  if (!badgeDef) {
    return { error: "Badge not found" };
  }

  if (user.badges.some((badge) => badge.id === badgeId)) {
    return { error: "Badge already earned" };
  }

  const badge = {
    id: badgeDef.id,
    name: badgeDef.name,
    emoji: badgeDef.emoji,
    awardedBy: "admin",
    awardedAt: nowIso(),
    unlockedAt: nowIso(),
  };

  user.badges.push(badge);
  return { success: true, badge };
};

exports.revokeBadge = (user, badgeId) => {
  const index = user.badges.findIndex((badge) => badge.id === badgeId);
  if (index === -1) {
    return { error: "Badge not found on user" };
  }

  user.badges.splice(index, 1);
  return { success: true };
};

exports.getAllBadges = () => Object.values(BADGE_DEFINITIONS);

exports.getBadgeById = (badgeId) =>
  Object.values(BADGE_DEFINITIONS).find((badge) => badge.id === badgeId);
