const referralService = require("../services/referralService");

exports.getSummary = async (req, res) => {
  try {
    const summary = await referralService.getReferralSummary(req.query.userId || "demo_user");
    return res.json(summary);
  } catch (error) {
    console.error("Get referral summary error:", error);
    return res.status(500).json({ error: "Failed to load referral summary" });
  }
};

exports.trackShare = async (req, res) => {
  try {
    const invite = await referralService.trackInviteShare({
      source: req.body?.source || "share",
      userIdentifier: req.body?.userId || "demo_user",
    });

    return res.status(201).json({ invite });
  } catch (error) {
    console.error("Track referral share error:", error);
    return res.status(400).json({ error: error.message || "Failed to track referral share" });
  }
};

exports.redeem = async (req, res) => {
  try {
    const invite = await referralService.redeemInviteCode({
      inviteCode: req.body?.inviteCode,
      invitedUserIdentifier: req.body?.userId || "demo_user",
      source: req.body?.source || "app",
    });

    return res.status(201).json({ invite });
  } catch (error) {
    console.error("Redeem referral code error:", error);
    return res.status(400).json({ error: error.message || "Failed to redeem referral code" });
  }
};
