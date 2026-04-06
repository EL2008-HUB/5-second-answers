const { db } = require("../data/db");
const badgeService = require("../services/badgeService");
const {
  findUserByIdentifier,
  formatBadge,
  formatUser,
  loadAnswersByUser,
  persistBadges,
} = require("../data/helpers");

const ADMIN_KEY = process.env.ADMIN_KEY || "admin-secret-key-123";

const isAuthorized = (req) => req.headers["x-admin-key"] === ADMIN_KEY;

const loadAllUsersWithBadges = async () => {
  const userRows = await db("users").orderBy("created_at", "desc");
  const badgeRows = await db("user_badges as ub")
    .join("badges as b", "b.id", "ub.badge_id")
    .select("ub.user_id", "ub.awarded_by", "ub.created_at as unlocked_at", "b.*")
    .orderBy("b.order", "asc");

  const badgeMap = new Map();
  badgeRows.forEach((row) => {
    const existing = badgeMap.get(row.user_id) || [];
    existing.push(formatBadge(row));
    badgeMap.set(row.user_id, existing);
  });

  return userRows.map((row) => formatUser(row, badgeMap.get(row.id) || []));
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await loadAllUsersWithBadges();
    res.json(
      users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        stats: user.stats,
        badgesEarned: user.badges.length,
        badges: user.badges,
        createdAt: user.createdAt,
      }))
    );
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to get users" });
  }
};

exports.getUserBadgeStatus = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await findUserByIdentifier(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userAnswers = await loadAnswersByUser(user.id);
    const badges = badgeService.getUserBadges(user, userAnswers);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        stats: user.stats,
        followers: user.followers || 0,
      },
      earned: badges.earned,
      unearned: badges.unearned,
      answerCount: userAnswers.length,
      totalViews: userAnswers.reduce(
        (sum, answer) => sum + (answer.interactions?.views || 0),
        0
      ),
      totalLikes: userAnswers.reduce(
        (sum, answer) => sum + (answer.interactions?.likes || 0),
        0
      ),
    });
  } catch (error) {
    console.error("Get user badge status error:", error);
    res.status(500).json({ error: "Failed to get user badge status" });
  }
};

exports.awardBadge = async (req, res) => {
  const { userId, badgeId } = req.body;

  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const user = await findUserByIdentifier(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = badgeService.awardBadge(user, badgeId);
    if (result.error) {
      return res.status(400).json(result);
    }

    await persistBadges(user.id, [result.badge], "admin");

    res.json({
      success: true,
      message: `Awarded ${result.badge.emoji} ${result.badge.name} to ${user.username}`,
      badge: result.badge,
    });
  } catch (error) {
    console.error("Award badge error:", error);
    res.status(500).json({ error: "Failed to award badge" });
  }
};

exports.revokeBadge = async (req, res) => {
  const { userId, badgeId } = req.body;

  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const user = await findUserByIdentifier(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = badgeService.revokeBadge(user, badgeId);
    if (result.error) {
      return res.status(400).json(result);
    }

    await db("user_badges").where({ user_id: user.id, badge_id: badgeId }).del();

    res.json({
      success: true,
      message: `Revoked badge from ${user.username}`,
    });
  } catch (error) {
    console.error("Revoke badge error:", error);
    res.status(500).json({ error: "Failed to revoke badge" });
  }
};

exports.getAllBadges = async (req, res) => {
  try {
    const badgeRows = await db("badges").orderBy("order", "asc");
    const badges = badgeRows.length
      ? badgeRows.map(formatBadge)
      : badgeService.getAllBadges();
    res.json(badges);
  } catch (error) {
    console.error("Get badges error:", error);
    res.status(500).json({ error: "Failed to get badges" });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const users = await loadAllUsersWithBadges();
    const leaderboard = users
      .map((user) => ({
        id: user.id,
        username: user.username,
        badgesEarned: user.badges.length,
        answersCount: user.stats?.answersGiven || 0,
        likesCount: user.stats?.likesReceived || 0,
        badges: user.badges.map((badge) => badge.emoji),
      }))
      .sort((a, b) => {
        if (b.badgesEarned !== a.badgesEarned) {
          return b.badgesEarned - a.badgesEarned;
        }
        if (b.likesCount !== a.likesCount) {
          return b.likesCount - a.likesCount;
        }
        return b.answersCount - a.answersCount;
      })
      .slice(0, 20);

    res.json(leaderboard);
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
};

exports.getBadgeStats = async (req, res) => {
  try {
    const allBadges = await db("badges").orderBy("order", "asc");
    const users = await loadAllUsersWithBadges();
    const distribution = await db("user_badges")
      .select("badge_id")
      .count("* as count")
      .groupBy("badge_id");

    const distributionMap = new Map(
      distribution.map((row) => [row.badge_id, Number(row.count)])
    );

    const stats = allBadges.map((badge) => {
      const earnedCount = distributionMap.get(badge.id) || 0;
      const percentage = users.length ? (earnedCount / users.length) * 100 : 0;

      return {
        id: badge.id,
        name: badge.name,
        emoji: badge.emoji,
        earnedCount,
        earnedByPercentage: percentage.toFixed(1),
      };
    });

    res.json({
      totalUsers: users.length,
      totalBadges: allBadges.length,
      badgeStats: stats,
    });
  } catch (error) {
    console.error("Get badge stats error:", error);
    res.status(500).json({ error: "Failed to get badge stats" });
  }
};

exports.checkAndUnlockBadges = async (req, res) => {
  const { userId } = req.params;

  try {
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const user = await findUserByIdentifier(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userAnswers = await loadAnswersByUser(user.id);
    const newBadges = badgeService.unlockNewBadges(user, userAnswers);
    await persistBadges(user.id, newBadges);

    res.json({
      success: true,
      newBadgesUnlocked: newBadges,
      totalBadges: user.badges.length,
    });
  } catch (error) {
    console.error("Check and unlock badges error:", error);
    res.status(500).json({ error: "Failed to check badges" });
  }
};
