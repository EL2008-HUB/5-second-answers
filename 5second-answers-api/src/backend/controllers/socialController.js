const { db } = require("../data/db");
const { ensureUser, findUserByIdentifier, formatUser } = require("../data/helpers");
const growthService = require("../services/growthService");
const notificationService = require("../services/notificationService");

const loadFollowingRows = async (userId) =>
  db("user_follows as f")
    .join("users as u", "u.id", "f.followed_user_id")
    .where("f.follower_user_id", userId)
    .select("u.*", "f.created_at as followed_at")
    .orderBy("f.created_at", "desc");

const loadApprovedAnswerActivity = async (userIds) => {
  if (!userIds.length) {
    return new Map();
  }

  const rows = await db("answers")
    .whereIn("user_id", userIds)
    .andWhere({ status: "approved" })
    .select("user_id")
    .count("* as approved_answer_count")
    .max("created_at as latest_answer_at")
    .groupBy("user_id");

  return new Map(
    rows.map((row) => [
      row.user_id,
      {
        approvedAnswerCount: Number(row.approved_answer_count || 0),
        latestAnswerAt: row.latest_answer_at || null,
      },
    ])
  );
};

const enrichFollowingRows = async (rows) => {
  const activityMap = await loadApprovedAnswerActivity(rows.map((row) => row.id));

  return rows
    .map((row) => {
      const activity = activityMap.get(row.id) || {
        approvedAnswerCount: 0,
        latestAnswerAt: null,
      };

      return {
        ...formatUser(row, []),
        followedAt: row.followed_at || null,
        approvedAnswerCount: activity.approvedAnswerCount,
        latestAnswerAt: activity.latestAnswerAt,
      };
    })
    .sort((left, right) => {
      const rightTime = right.latestAnswerAt ? new Date(right.latestAnswerAt).getTime() : 0;
      const leftTime = left.latestAnswerAt ? new Date(left.latestAnswerAt).getTime() : 0;
      return rightTime - leftTime;
    });
};

exports.getFollowing = async (req, res) => {
  const { userId } = req.query;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const rows = await loadFollowingRows(actor.id);
    const following = await enrichFollowingRows(rows);

    res.json({
      count: following.length,
      following,
    });
  } catch (error) {
    console.error("Get following error:", error);
    res.status(500).json({ error: "Failed to get following list" });
  }
};

exports.getHomeSummary = async (req, res) => {
  const { userId } = req.query;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const [rows, daily] = await Promise.all([
      loadFollowingRows(actor.id),
      growthService.getDailyMissionState(actor.id),
    ]);
    const following = await enrichFollowingRows(rows);

    res.json({
      user: actor,
      daily,
      followingCount: following.length,
      following,
      followingHighlights: following.filter((item) => item.approvedAnswerCount > 0).slice(0, 8),
    });
  } catch (error) {
    console.error("Get home summary error:", error);
    res.status(500).json({ error: "Failed to get home summary" });
  }
};

exports.followUser = async (req, res) => {
  const { userId, targetUserId, targetUsername } = req.body;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const target = await findUserByIdentifier(targetUserId || targetUsername);

    if (!target) {
      return res.status(404).json({ error: "Target user not found" });
    }

    if (actor.id === target.id) {
      return res.status(400).json({ error: "You cannot follow yourself" });
    }

    const existing = await db("user_follows")
      .where({
        follower_user_id: actor.id,
        followed_user_id: target.id,
      })
      .first();

    if (!existing) {
      await db("user_follows").insert({
        follower_user_id: actor.id,
        followed_user_id: target.id,
      });

      await db("users").where({ id: target.id }).increment("followers", 1);
      await notificationService.notifyNewFollower({
        targetUser: target,
        actorUser: actor,
      });
    }

    const rows = await loadFollowingRows(actor.id);
    const followingUsers = await enrichFollowingRows(rows);

    res.json({
      following: true,
      count: followingUsers.length,
      followingUsers,
    });
  } catch (error) {
    console.error("Follow user error:", error);
    res.status(500).json({ error: "Failed to follow user" });
  }
};

exports.unfollowUser = async (req, res) => {
  const { userId, targetUserId, targetUsername } = req.body;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const target = await findUserByIdentifier(targetUserId || targetUsername);

    if (!target) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const existing = await db("user_follows")
      .where({
        follower_user_id: actor.id,
        followed_user_id: target.id,
      })
      .first();

    if (existing) {
      await db("user_follows").where({ id: existing.id }).del();
      await db("users")
        .where({ id: target.id })
        .update({
          followers: db.raw("GREATEST(followers - 1, 0)"),
          updated_at: db.fn.now(),
        });
    }

    const rows = await loadFollowingRows(actor.id);
    const followingUsers = await enrichFollowingRows(rows);

    res.json({
      following: false,
      count: followingUsers.length,
      followingUsers,
    });
  } catch (error) {
    console.error("Unfollow user error:", error);
    res.status(500).json({ error: "Failed to unfollow user" });
  }
};
