const { ensureUser, findUserByIdentifier, isUuid } = require("../data/helpers");
const duetService = require("../services/duetService");

exports.createChallenge = async (req, res) => {
  const {
    answer,
    answerId,
    questionId,
    questionText,
    seconds,
    user1Id,
    user2Id,
  } = req.body || {};

  try {
    const [challenger, target] = await Promise.all([
      ensureUser(user1Id || "demo_user"),
      findUserByIdentifier(user2Id),
    ]);

    if (!target) {
      return res.status(404).json({ error: "Target user not found" });
    }

    const duet = await duetService.createChallengeSession({
      questionId: isUuid(questionId) ? questionId : null,
      questionText,
      user1Id: challenger.id,
      user2Id: target.id,
      answer,
      answerId: isUuid(answerId) ? answerId : null,
      seconds,
    });

    return res.status(201).json({ duet });
  } catch (error) {
    console.error("Create duet challenge error:", error);
    return res.status(400).json({ error: error.message || "Failed to create duet challenge" });
  }
};

exports.respond = async (req, res) => {
  const { sessionId } = req.params;
  const { answer, answerId, seconds, userId } = req.body || {};

  try {
    const actor = await ensureUser(userId || "demo_user");
    const duet = await duetService.respondToSession({
      sessionId,
      userId: actor.id,
      answer,
      answerId: isUuid(answerId) ? answerId : null,
      seconds,
    });

    if (!duet) {
      return res.status(404).json({ error: "Session not found or already closed" });
    }

    return res.json({ duet });
  } catch (error) {
    console.error("Respond duet error:", error);
    return res.status(400).json({ error: error.message || "Failed to respond to duet" });
  }
};

exports.getSession = async (req, res) => {
  try {
    const duet = await duetService.getSession(req.params.sessionId);
    if (!duet) {
      return res.status(404).json({ error: "Duet session not found" });
    }

    return res.json({ duet });
  } catch (error) {
    console.error("Get duet session error:", error);
    return res.status(500).json({ error: "Failed to load duet session" });
  }
};

exports.react = async (req, res) => {
  try {
    const duet = await duetService.reactToSession({
      sessionId: req.params.sessionId,
      emoji: req.body?.emoji,
    });

    if (!duet) {
      return res.status(404).json({ error: "Duet session not found" });
    }

    return res.json({ duet });
  } catch (error) {
    console.error("React to duet error:", error);
    return res.status(400).json({ error: error.message || "Failed to react to duet" });
  }
};

exports.createRandomCompare = async (req, res) => {
  const {
    answer,
    answerId,
    questionId,
    questionText,
    seconds,
    userId,
  } = req.body || {};

  try {
    const actor = await ensureUser(userId || "demo_user");
    const duet = await duetService.createRandomComparison({
      questionId,
      questionText,
      myUserId: actor.id,
      myAnswer: answer,
      myAnswerId: isUuid(answerId) ? answerId : null,
      mySeconds: seconds,
    });

    if (!duet) {
      return res.status(404).json({ error: "No comparison answer available yet" });
    }

    return res.status(201).json({ duet });
  } catch (error) {
    console.error("Create random duet compare error:", error);
    return res.status(400).json({ error: error.message || "Failed to compare duet" });
  }
};

exports.createExpose = async (req, res) => {
  const {
    answer,
    answerId,
    opponentAnswer,
    opponentAnswerId,
    opponentSeconds,
    opponentUserId,
    questionId,
    questionText,
    seconds,
    userId,
  } = req.body || {};

  try {
    const [actor, opponent] = await Promise.all([
      ensureUser(userId || "demo_user"),
      findUserByIdentifier(opponentUserId),
    ]);

    if (!opponent) {
      return res.status(404).json({ error: "Opponent not found" });
    }

    const duet = await duetService.createExposeSession({
      questionId: isUuid(questionId) ? questionId : null,
      questionText,
      myUserId: actor.id,
      myAnswer: answer,
      myAnswerId: isUuid(answerId) ? answerId : null,
      mySeconds: seconds,
      opponentUserId: opponent.id,
      opponentAnswer,
      opponentAnswerId: isUuid(opponentAnswerId) ? opponentAnswerId : null,
      opponentSeconds,
    });

    return res.status(201).json({ duet });
  } catch (error) {
    console.error("Create expose duet error:", error);
    return res.status(400).json({ error: error.message || "Failed to create expose duet" });
  }
};

exports.getPending = async (req, res) => {
  const { userId } = req.query;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const pending = await duetService.listPendingForUser(actor.id);

    return res.json({
      count: pending.length,
      sessions: pending,
    });
  } catch (error) {
    console.error("Get pending duets error:", error);
    return res.status(500).json({ error: "Failed to load pending duets" });
  }
};
