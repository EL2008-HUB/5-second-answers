const { db } = require("../data/db");
const { findUserByIdentifier, formatUser, parseMaybeJson } = require("../data/helpers");
const learningService = require("./learningService");

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const formatPriceLabel = (priceCents) => `$${Math.max(1, Math.round(Number(priceCents || 0) / 100))}`;

const derivePriceCents = ({ expertise = {}, followers = 0 }) => {
  if (expertise.verified && (expertise.score >= 88 || followers >= 350)) {
    return 500;
  }

  if (expertise.score >= 72 || expertise.approvedAnswers >= 3) {
    return 300;
  }

  return 100;
};

const buildExpertise = ({
  userRow = {},
  category = "general",
  approvedAnswers = 0,
  totalApprovedAnswers = 0,
  badges = new Set(),
}) => {
  const stats = parseMaybeJson(userRow.stats, {});
  const likesReceived = Number(stats.likesReceived || 0);
  const xp = Number(stats.xp || 0);
  const followers = Number(userRow.followers || 0);
  const ranking = Number(userRow.ranking || 1000);
  const hasExpertBadge = badges.has("expert");
  const categoryLabel = learningService.getCategoryLabel(category);

  const score = clamp(
    18 +
      approvedAnswers * 14 +
      Math.min(16, Math.floor(likesReceived / 10)) +
      Math.min(12, Math.floor(xp / 80)) +
      Math.min(10, Math.floor((ranking - 1000) / 25)) +
      Math.min(12, Math.floor(followers / 80)) +
      Math.min(8, Math.floor(totalApprovedAnswers / 6)) +
      (hasExpertBadge ? 16 : 0),
    12,
    99
  );

  const verified =
    hasExpertBadge ||
    approvedAnswers >= 3 ||
    (approvedAnswers >= 2 && (likesReceived >= 12 || ranking >= 1125)) ||
    (totalApprovedAnswers >= 10 && followers >= 80);

  const reason = hasExpertBadge
    ? "Badge expert + histori e forte"
    : approvedAnswers > 0
      ? `${approvedAnswers} answers te aprovuara ne ${categoryLabel}`
      : totalApprovedAnswers > 0
        ? `${totalApprovedAnswers} answers te aprovuara ne platforme`
        : "Creator aktiv";

  return {
    verified,
    score,
    approvedAnswers,
    totalApprovedAnswers,
    category,
    categoryLabel,
    matchingCategory: approvedAnswers > 0,
    label: verified ? "Verified Expert" : "Trusted Creator",
    reason,
  };
};

const loadBadgeMap = async (userIds) => {
  if (!userIds.length) {
    return new Map();
  }

  const badgeRows = await db("user_badges").whereIn("user_id", userIds).select("user_id", "badge_id");
  const badgeMap = new Map();

  badgeRows.forEach((row) => {
    const existing = badgeMap.get(row.user_id) || new Set();
    existing.add(row.badge_id);
    badgeMap.set(row.user_id, existing);
  });

  return badgeMap;
};

const loadCountMap = async ({ userIds, category = null }) => {
  if (!userIds.length) {
    return new Map();
  }

  let query = db("answers as a")
    .join("questions as q", "q.id", "a.question_id")
    .whereIn("a.user_id", userIds)
    .andWhere("a.status", "approved")
    .select("a.user_id")
    .count("* as approved_count")
    .groupBy("a.user_id");

  if (category) {
    query = query.andWhere("q.category", category);
  }

  const rows = await query;
  return new Map(rows.map((row) => [row.user_id, Number(row.approved_count || 0)]));
};

const loadCandidateUsers = async (category = "general", limit = 12) => {
  const categoryRows = await db("answers as a")
    .join("questions as q", "q.id", "a.question_id")
    .join("users as u", "u.id", "a.user_id")
    .where("a.status", "approved")
    .andWhere("q.category", category)
    .select("u.*", "a.user_id")
    .count("a.id as approved_count")
    .groupBy("u.id", "a.user_id")
    .orderBy("approved_count", "desc")
    .limit(limit);

  const globalRows = await db("answers as a")
    .join("users as u", "u.id", "a.user_id")
    .where("a.status", "approved")
    .select("u.*", "a.user_id")
    .count("a.id as approved_count")
    .groupBy("u.id", "a.user_id")
    .orderBy("approved_count", "desc")
    .limit(limit);

  const badgeUserIds = await db("user_badges")
    .where({ badge_id: "expert" })
    .select("user_id");

  const extraBadgeUsers = badgeUserIds.length
    ? await db("users").whereIn(
        "id",
        badgeUserIds.map((row) => row.user_id)
      )
    : [];

  const mergedMap = new Map();
  [...categoryRows, ...globalRows, ...extraBadgeUsers].forEach((row) => {
    if (row?.id) {
      mergedMap.set(row.id, row);
    }
  });

  return Array.from(mergedMap.values());
};

const buildProfilesForUsers = async (userRows, category = "general") => {
  const uniqueRows = userRows.filter(Boolean);
  const userIds = [...new Set(uniqueRows.map((row) => row.id).filter(Boolean))];

  if (!userIds.length) {
    return new Map();
  }

  const [badgeMap, categoryCountMap, totalCountMap] = await Promise.all([
    loadBadgeMap(userIds),
    loadCountMap({ userIds, category }),
    loadCountMap({ userIds }),
  ]);

  return new Map(
    uniqueRows.map((row) => {
      const badges = badgeMap.get(row.id) || new Set();
      const expertise = buildExpertise({
        userRow: row,
        category,
        approvedAnswers: Number(categoryCountMap.get(row.id) || 0),
        totalApprovedAnswers: Number(totalCountMap.get(row.id) || 0),
        badges,
      });
      const pricing = {
        priceCents: derivePriceCents({
          expertise,
          followers: Number(row.followers || 0),
        }),
      };

      pricing.label = formatPriceLabel(pricing.priceCents);
      pricing.subtitle = "Priority 5-10s answer";

      return [
        row.id,
        {
          ...formatUser(row, []),
          expertise,
          pricing,
        },
      ];
    })
  );
};

const buildExpertRequest = async (row, categoryOverride = null) => {
  if (!row) {
    return null;
  }

  const expert = await getExpertProfile(
    row.expert_user_id,
    categoryOverride || row.category || "general"
  );

  return {
    id: row.id,
    questionId: row.question_id,
    requesterUserId: row.requester_user_id,
    expertUserId: row.expert_user_id,
    category: row.category || categoryOverride || "general",
    priority: Boolean(row.priority ?? true),
    priceCents: Number(row.price_cents || 0),
    priceLabel: formatPriceLabel(row.price_cents),
    maxAnswerSeconds: Number(row.max_answer_seconds || 10),
    status: row.status || "requested",
    paymentStatus: row.payment_status || "reserved",
    metadata: parseMaybeJson(row.metadata, {}),
    answeredAnswerId: row.answered_answer_id || null,
    answeredAt: row.answered_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    expert,
  };
};

async function getExpertDirectory({ category = "general", limit = 6 } = {}) {
  const candidateUsers = await loadCandidateUsers(category, Math.max(limit * 2, 12));
  const profileMap = await buildProfilesForUsers(candidateUsers, category);

  return Array.from(profileMap.values())
    .filter((profile) => profile.expertise.verified || profile.expertise.totalApprovedAnswers > 0)
    .sort((left, right) => {
      if (Number(right.expertise.matchingCategory) !== Number(left.expertise.matchingCategory)) {
        return Number(right.expertise.matchingCategory) - Number(left.expertise.matchingCategory);
      }

      if (Number(right.expertise.verified) !== Number(left.expertise.verified)) {
        return Number(right.expertise.verified) - Number(left.expertise.verified);
      }

      if (right.expertise.score !== left.expertise.score) {
        return right.expertise.score - left.expertise.score;
      }

      return Number(right.followers || 0) - Number(left.followers || 0);
    })
    .slice(0, limit);
}

async function getExpertProfile(identifier, category = "general") {
  const user = await findUserByIdentifier(identifier);
  if (!user) {
    return null;
  }

  const rows = await db("users").where({ id: user.id }).select("*");
  const profileMap = await buildProfilesForUsers(rows, category);
  return profileMap.get(user.id) || null;
}

async function createExpertRequest({
  questionId,
  requesterUserId,
  expertUserId,
  category = "general",
  priceCents = 100,
}) {
  const [row] = await db("expert_requests")
    .insert({
      question_id: questionId,
      requester_user_id: requesterUserId,
      expert_user_id: expertUserId,
      category,
      price_cents: priceCents,
      priority: true,
      max_answer_seconds: 10,
      status: "requested",
      payment_status: "reserved",
      metadata: {
        product: "ask_experts_fast_answer",
        priorityWindowHours: 24,
      },
    })
    .returning("*");

  return buildExpertRequest(row, category);
}

async function loadQuestionExpertRequest(questionId, category = "general") {
  if (!questionId) {
    return null;
  }

  const row = await db("expert_requests").where({ question_id: questionId }).first();
  return buildExpertRequest(row, category);
}

async function loadQuestionExpertRequestMap(questions = []) {
  const normalized = questions.filter((question) => question?.id);

  if (!normalized.length) {
    return new Map();
  }

  const rows = await db("expert_requests")
    .whereIn(
      "question_id",
      normalized.map((question) => question.id)
    )
    .select("*");

  if (!rows.length) {
    return new Map();
  }

  const categoryByQuestionId = new Map(
    normalized.map((question) => [question.id, question.category || "general"])
  );

  const entries = await Promise.all(
    rows.map(async (row) => [
      row.question_id,
      await buildExpertRequest(row, categoryByQuestionId.get(row.question_id) || "general"),
    ])
  );

  return new Map(entries);
}

async function finalizeExpertRequestForAnswer({ questionId, expertUserId, answerId }) {
  if (!questionId || !expertUserId || !answerId) {
    return null;
  }

  const existing = await db("expert_requests")
    .where({
      question_id: questionId,
      expert_user_id: expertUserId,
    })
    .whereNot({ status: "answered" })
    .first();

  if (!existing) {
    return null;
  }

  const [updated] = await db("expert_requests")
    .where({ id: existing.id })
    .update({
      status: "answered",
      payment_status: "captured",
      answered_answer_id: answerId,
      answered_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning("*");

  return buildExpertRequest(updated, existing.category || "general");
}

module.exports = {
  createExpertRequest,
  finalizeExpertRequestForAnswer,
  getExpertDirectory,
  getExpertProfile,
  loadQuestionExpertRequest,
  loadQuestionExpertRequestMap,
};
