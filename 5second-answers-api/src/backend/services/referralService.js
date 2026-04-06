const { db } = require("../data/db");
const {
  ensureUser,
  findUserByIdentifier,
  parseMaybeJson,
  updateUserStats,
} = require("../data/helpers");
const notificationService = require("./notificationService");

const SHARE_HOST = process.env.REFERRAL_SHARE_HOST || "https://5secondanswer.app";

const MILESTONES = [
  { target: 1, label: "1 mik aktiv" },
  { target: 3, label: "3 miq aktiv" },
  { target: 5, label: "5 miq aktiv" },
  { target: 10, label: "10 miq aktiv" },
];

const normalizeInviteCode = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);

const baseFromUsername = (username) =>
  String(username || "FIVE")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6) || "FIVE";

const buildCandidate = (username) =>
  `${baseFromUsername(username)}${Math.floor(1000 + Math.random() * 9000)}`;

const ensureInviteCode = async (userId) => {
  const userRow = await db("users").where({ id: userId }).first();
  if (!userRow) {
    return null;
  }

  if (userRow.invite_code) {
    return userRow.invite_code;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = buildCandidate(userRow.username);
    const existing = await db("users").where({ invite_code: candidate }).first("id");

    if (!existing) {
      await db("users").where({ id: userId }).update({
        invite_code: candidate,
        updated_at: db.fn.now(),
      });
      return candidate;
    }
  }

  const fallback = `${baseFromUsername(userRow.username)}${Date.now().toString().slice(-4)}`;
  await db("users").where({ id: userId }).update({
    invite_code: fallback,
    updated_at: db.fn.now(),
  });
  return fallback;
};

const buildShareAssets = (inviteCode) => {
  const shareLink = `${SHARE_HOST}/join?ref=${encodeURIComponent(inviteCode)}`;
  return {
    shareLink,
    shareMessage: `Hyr te 5 Second Answer me kodin ${inviteCode}. 5 sekonda, pyetje reale, pergjigje qe mbahen mend. ${shareLink}`,
  };
};

const decorateInvite = (row) => ({
  id: row.id,
  code: row.code,
  source: row.source || "share",
  status: row.status,
  rewardPoints: Number(row.reward_points || 0),
  createdAt: row.created_at || null,
  activatedAt: row.activated_at || null,
  invitedUser: row.invited_user_id
    ? {
        id: row.invited_user_id,
        username: row.invited_username || "new_user",
      }
    : null,
  metadata: parseMaybeJson(row.metadata, {}),
});

const getReferralSummary = async (userIdentifier) => {
  const actor = await ensureUser(userIdentifier || "demo_user");
  const inviteCode = await ensureInviteCode(actor.id);
  const inviteRows = await db("referral_invites as r")
    .leftJoin("users as invited", "invited.id", "r.invited_user_id")
    .where("r.inviter_user_id", actor.id)
    .select("r.*", "invited.username as invited_username")
    .orderBy("r.created_at", "desc");

  const stats = inviteRows.reduce(
    (accumulator, row) => {
      accumulator.sentCount += 1;
      if (row.status === "joined" || row.status === "activated") {
        accumulator.joinedCount += 1;
      }
      if (row.status === "activated") {
        accumulator.activatedCount += 1;
      }
      accumulator.earnedPoints += Number(row.reward_points || 0);
      return accumulator;
    },
    {
      activatedCount: 0,
      earnedPoints: 0,
      joinedCount: 0,
      sentCount: 0,
    }
  );

  const milestones = MILESTONES.map((milestone) => ({
    ...milestone,
    current: stats.activatedCount,
    progress: Math.min(1, stats.activatedCount / milestone.target),
    reached: stats.activatedCount >= milestone.target,
  }));

  return {
    code: inviteCode,
    milestones,
    recentInvites: inviteRows.slice(0, 8).map(decorateInvite),
    stats,
    ...buildShareAssets(inviteCode),
  };
};

const trackInviteShare = async ({ source = "share", userIdentifier }) => {
  const actor = await ensureUser(userIdentifier || "demo_user");
  const inviteCode = await ensureInviteCode(actor.id);

  const [row] = await db("referral_invites")
    .insert({
      inviter_user_id: actor.id,
      code: inviteCode,
      source,
      status: "sent",
      metadata: {
        trackedAt: new Date().toISOString(),
      },
    })
    .returning("*");

  return decorateInvite(row);
};

const redeemInviteCode = async ({ inviteCode, invitedUserIdentifier, source = "organic" }) => {
  const normalizedCode = normalizeInviteCode(inviteCode);
  if (!normalizedCode) {
    throw new Error("Invite code is required");
  }

  const actor = await ensureUser(invitedUserIdentifier || "demo_user");
  const inviterRow = await db("users").where({ invite_code: normalizedCode }).first();

  if (!inviterRow) {
    throw new Error("Invite code not found");
  }

  if (inviterRow.id === actor.id) {
    throw new Error("You cannot redeem your own code");
  }

  const existing = await db("referral_invites").where({ invited_user_id: actor.id }).first();
  if (existing) {
    throw new Error("This user already redeemed a referral code");
  }

  const [inviteRow] = await db("referral_invites")
    .insert({
      inviter_user_id: inviterRow.id,
      invited_user_id: actor.id,
      code: normalizedCode,
      source,
      status: "joined",
      reward_points: 100,
      metadata: {
        joinedAt: new Date().toISOString(),
      },
    })
    .returning("*");

  await updateUserStats(inviterRow.id, (stats) => ({
    ...stats,
    xp: (stats.xp || 0) + 100,
  }));

  await notificationService.createNotification({
    userId: inviterRow.id,
    actorUserId: actor.id,
    type: "referral_joined",
    title: `${actor.username} u bashkua me kodin tend`,
    message: "Referrals po fillojne te kthehen ne users reale.",
    entityType: "referral_invite",
    entityId: inviteRow.id,
    metadata: {
      referralInviteId: inviteRow.id,
      referralCode: normalizedCode,
    },
    sendPush: true,
  });

  return decorateInvite(inviteRow);
};

const activateReferralForUser = async (userIdentifier) => {
  const user = await findUserByIdentifier(userIdentifier);
  if (!user) {
    return null;
  }

  const invite = await db("referral_invites").where({
    invited_user_id: user.id,
    status: "joined",
  }).first();

  if (!invite) {
    return null;
  }

  const rewardPoints = Math.max(Number(invite.reward_points || 0), 250);

  await db("referral_invites").where({ id: invite.id }).update({
    status: "activated",
    reward_points: rewardPoints,
    activated_at: db.fn.now(),
    updated_at: db.fn.now(),
  });

  await updateUserStats(invite.inviter_user_id, (stats) => ({
    ...stats,
    missionsCompleted: (stats.missionsCompleted || 0) + 1,
    xp: (stats.xp || 0) + 150,
  }));

  await notificationService.createNotification({
    userId: invite.inviter_user_id,
    actorUserId: user.id,
    type: "referral_activated",
    title: `${user.username} u aktivizua`,
    message: "Referral-i yt dha answer-in e pare. Ky eshte growth real.",
    entityType: "referral_invite",
    entityId: invite.id,
    metadata: {
      referralInviteId: invite.id,
      referralCode: invite.code,
    },
    sendPush: true,
  });

  return db("referral_invites").where({ id: invite.id }).first();
};

module.exports = {
  activateReferralForUser,
  getReferralSummary,
  redeemInviteCode,
  trackInviteShare,
};
