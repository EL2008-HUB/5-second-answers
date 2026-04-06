const { db } = require("../data/db");
const { parseMaybeJson } = require("../data/helpers");
const learningService = require("./learningService");

const MAX_SAVED_ITEMS = 8;
const MAX_HISTORY_ITEMS = 8;

const normalizeText = (value) => String(value || "").trim();
const normalizeCategory = (value) => normalizeText(value).toLowerCase() || "general";
const normalizeIntent = (value) => (value === "answer" ? "answer" : "ask");
const normalizeAskMode = (value) =>
  value === "expert" || value === "community" ? value : null;
const normalizeAction = (value) =>
  ["upload", "ask_community", "ask_expert"].includes(value) ? value : null;
const normalizeItemKind = (value) =>
  value === "draft_history" ? "draft_history" : "saved_concept";
const clampLimit = (value, fallback) => Math.max(1, Math.min(12, Number(value || fallback) || fallback));

const addNullableWhere = (query, column, value) => {
  if (value) {
    return query.andWhere(column, value);
  }

  return query.whereNull(column);
};

const formatWorkspaceItem = (row) => {
  const metadata = parseMaybeJson(row.metadata, {});
  const categoryId = row.category || "general";

  return {
    id: row.id,
    kind: normalizeItemKind(row.item_kind),
    title: row.title,
    prompt: row.prompt,
    categoryId,
    categoryLabel: learningService.getCategoryLabel(categoryId),
    angle: row.angle || "",
    intent: normalizeIntent(row.intent),
    source: row.source || "create_lab",
    questionId: row.question_id || null,
    creatorUsername: row.creator_username || null,
    askMode: normalizeAskMode(row.ask_mode),
    action: normalizeAction(row.action),
    usageCount: Number(row.usage_count || 1),
    metadata,
    lastUsedAt: row.last_used_at || row.updated_at || row.created_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
};

const findExistingWorkspaceItem = async ({
  userId,
  itemId = null,
  itemKind,
  prompt,
  category,
  questionId = null,
  askMode = null,
  action = null,
}) => {
  if (itemId) {
    return db("create_lab_items")
      .where({
        id: itemId,
        user_id: userId,
        item_kind: itemKind,
      })
      .first();
  }

  let query = db("create_lab_items")
    .where({
      user_id: userId,
      item_kind: itemKind,
      prompt,
      category,
    })
    .orderBy("last_used_at", "desc");

  query = addNullableWhere(query, "question_id", questionId);

  if (itemKind === "draft_history") {
    query = addNullableWhere(query, "ask_mode", askMode);
    query = addNullableWhere(query, "action", action);
  }

  return query.first();
};

const saveWorkspaceItem = async ({
  userId,
  id = null,
  itemKind = "saved_concept",
  title,
  prompt,
  category = "general",
  angle = "",
  intent = "ask",
  source = "create_lab",
  questionId = null,
  creatorUsername = null,
  askMode = null,
  action = null,
  metadata = {},
}) => {
  const normalizedPrompt = normalizeText(prompt);
  const normalizedTitle = normalizeText(title) || "Create Lab idea";
  const normalizedItemKind = normalizeItemKind(itemKind);
  const normalizedCategory = normalizeCategory(category);
  const normalizedIntent = normalizeIntent(intent);
  const normalizedAskMode = normalizeAskMode(askMode);
  const normalizedAction = normalizeAction(action);

  if (!normalizedPrompt) {
    throw new Error("Prompt is required");
  }

  const existing = await findExistingWorkspaceItem({
    userId,
    itemId: id,
    itemKind: normalizedItemKind,
    prompt: normalizedPrompt,
    category: normalizedCategory,
    questionId,
    askMode: normalizedAskMode,
    action: normalizedAction,
  });

  const payload = {
    user_id: userId,
    item_kind: normalizedItemKind,
    title: normalizedTitle,
    prompt: normalizedPrompt,
    category: normalizedCategory,
    angle: normalizeText(angle) || null,
    intent: normalizedIntent,
    source: normalizeText(source) || "create_lab",
    question_id: questionId || null,
    creator_username: normalizeText(creatorUsername) || null,
    ask_mode: normalizedAskMode,
    action: normalizedAction,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    last_used_at: db.fn.now(),
    updated_at: db.fn.now(),
  };

  let row = null;
  if (existing) {
    const [updated] = await db("create_lab_items")
      .where({ id: existing.id })
      .update({
        ...payload,
        usage_count: Number(existing.usage_count || 1) + 1,
      })
      .returning("*");
    row = updated;
  } else {
    const [inserted] = await db("create_lab_items")
      .insert(payload)
      .returning("*");
    row = inserted;
  }

  return formatWorkspaceItem(row);
};

async function loadWorkspace(userId, { savedLimit = MAX_SAVED_ITEMS, historyLimit = MAX_HISTORY_ITEMS } = {}) {
  const rows = await db("create_lab_items")
    .where({ user_id: userId })
    .orderBy("last_used_at", "desc")
    .orderBy("created_at", "desc");

  const items = rows.map(formatWorkspaceItem);

  return {
    savedConcepts: items
      .filter((item) => item.kind === "saved_concept")
      .slice(0, clampLimit(savedLimit, MAX_SAVED_ITEMS)),
    draftHistory: items
      .filter((item) => item.kind === "draft_history")
      .slice(0, clampLimit(historyLimit, MAX_HISTORY_ITEMS)),
  };
}

async function saveConcept(userId, payload = {}) {
  return saveWorkspaceItem({
    userId,
    itemKind: "saved_concept",
    ...payload,
  });
}

async function logDraftHistory(userId, payload = {}) {
  return saveWorkspaceItem({
    userId,
    itemKind: "draft_history",
    ...payload,
  });
}

async function deleteWorkspaceItem(userId, itemId) {
  if (!itemId) {
    return null;
  }

  const existing = await db("create_lab_items")
    .where({
      id: itemId,
      user_id: userId,
    })
    .first();

  if (!existing) {
    return null;
  }

  await db("create_lab_items")
    .where({
      id: itemId,
      user_id: userId,
    })
    .del();

  return formatWorkspaceItem(existing);
}

module.exports = {
  loadWorkspace,
  saveConcept,
  logDraftHistory,
  deleteWorkspaceItem,
};
