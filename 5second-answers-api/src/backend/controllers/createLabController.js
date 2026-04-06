const { ensureUser } = require("../data/helpers");
const createLabService = require("../services/createLabService");

const sanitizePayload = (body = {}) => ({
  id: body.id || null,
  title: body.title,
  prompt: body.prompt,
  category: body.categoryId || body.category || "general",
  angle: body.angle || "",
  intent: body.intent,
  source: body.source || "create_lab",
  questionId: body.questionId || null,
  creatorUsername: body.creatorUsername || null,
  askMode: body.askMode || null,
  action: body.action || null,
  metadata: body.metadata || {},
});

exports.getWorkspace = async (req, res) => {
  const { userId, savedLimit, historyLimit } = req.query;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const workspace = await createLabService.loadWorkspace(actor.id, {
      savedLimit,
      historyLimit,
    });

    res.json(workspace);
  } catch (error) {
    console.error("Get Create Lab workspace error:", error);
    res.status(500).json({ error: "Failed to load Create Lab workspace" });
  }
};

exports.saveConcept = async (req, res) => {
  try {
    const actor = await ensureUser(req.body.userId || "demo_user");
    const payload = sanitizePayload(req.body);

    if (!String(payload.prompt || "").trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const item = await createLabService.saveConcept(actor.id, payload);
    res.json(item);
  } catch (error) {
    console.error("Save Create Lab concept error:", error);
    res.status(500).json({ error: "Failed to save concept" });
  }
};

exports.logDraftHistory = async (req, res) => {
  try {
    const actor = await ensureUser(req.body.userId || "demo_user");
    const payload = sanitizePayload(req.body);

    if (!String(payload.prompt || "").trim()) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const item = await createLabService.logDraftHistory(actor.id, payload);
    res.json(item);
  } catch (error) {
    console.error("Log Create Lab history error:", error);
    res.status(500).json({ error: "Failed to log draft history" });
  }
};

exports.deleteWorkspaceItem = async (req, res) => {
  try {
    const actor = await ensureUser(req.body.userId || req.query.userId || "demo_user");
    const deletedItem = await createLabService.deleteWorkspaceItem(actor.id, req.params.id);

    if (!deletedItem) {
      return res.status(404).json({ error: "Create Lab item not found" });
    }

    res.json({
      ok: true,
      item: deletedItem,
    });
  } catch (error) {
    console.error("Delete Create Lab item error:", error);
    res.status(500).json({ error: "Failed to delete Create Lab item" });
  }
};
