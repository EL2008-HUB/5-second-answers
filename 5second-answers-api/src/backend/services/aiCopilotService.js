const aiService = require("./aiService");
const newsTrendingService = require("./newsTrendingService");
const { db } = require("../data/db");
const { ensureUser, findUserByIdentifier, parseMaybeJson } = require("../data/helpers");

const SUPPORTED_EVENT_TYPES = [
  "new_answer",
  "trending_scan",
  "categorize_content",
  "user_query",
  "system_monitor",
  "hot_question_created",
];

const FEATURE_GUIDES = {
  mirror: {
    id: "mirror",
    title: "Mirror",
    summary: "Pergjigju nje pyetjeje ne 5 ose 10 sekonda dhe futu direkt ne feed.",
    steps: [
      "Hape pyetjen nga Home ose LIVE.",
      "Pergjigju shpejt pa e overthink-uar.",
      "Ruaje answer-in dhe zgjidh share, duet ose story mode.",
    ],
    suggestedActions: [
      { id: "open_mirror", label: "Open Mirror", target: "Mirror" },
      { id: "open_home", label: "Question of the Day", target: "Home" },
    ],
  },
  story_mode: {
    id: "story_mode",
    title: "Story Mode",
    summary: "Ben disa pergjigje radhazi dhe ne fund merr nje Emotion Score shareable.",
    steps: [
      "Hape Story Mode nga Home.",
      "Jep 5 pergjigje spontane.",
      "Shiko Emotion Score dhe ndaj rezultatin.",
    ],
    suggestedActions: [{ id: "open_story", label: "Open Story Mode", target: "StoryMode" }],
  },
  duet: {
    id: "duet",
    title: "Duet Split-Screen",
    summary: "Krahason dy pergjigje per te njejten pyetje dhe prodhon screenshot viral.",
    steps: [
      "Pergjigju nje pyetjeje ne Mirror.",
      "Zgjidh Sfido mikun ose Krahasohu me te huaj.",
      "Kur dy pergjigjet kompletohen, hape split-screen dhe ndaj screenshot-in.",
    ],
    suggestedActions: [{ id: "open_home", label: "Find a question", target: "Home" }],
  },
  live_news: {
    id: "live_news",
    title: "LIVE News",
    summary: "AI zgjedh lajmet me potencial viral dhe i kthen ne Hot Questions sipas kategorive qe preferon.",
    steps: [
      "Zgjidh kategorite e preferuara ne Home.",
      "Kur del nje lajm i forte, shfaqet si LIVE / Hot Question.",
      "Pergjigju shpejt perpara se te skadoje.",
    ],
    suggestedActions: [{ id: "open_home", label: "See LIVE categories", target: "Home" }],
  },
  hashtags: {
    id: "hashtags",
    title: "Challenges & Hashtags",
    summary: "Hyr ne challenge, pergjigju me hashtag dhe futu ne feed-in e trendit.",
    steps: [
      "Hape Explore dhe zgjidh challenge ose hashtag.",
      "Pergjigju nga Mirror me kontekstin e hashtag-ut.",
      "Ndaje answer-in me caption-in e gjeneruar.",
    ],
    suggestedActions: [{ id: "open_explore", label: "Open Explore", target: "Explore" }],
  },
  notifications: {
    id: "notifications",
    title: "Notifications",
    summary: "Njoftimet perdoren per streak risk, pressure social dhe hot questions.",
    steps: [
      "Prano push notifications ne hyrje.",
      "Hape bell icon ne Home per historikun.",
      "Kliko njoftimin dhe shko direkt te screen-i perkates.",
    ],
    suggestedActions: [{ id: "open_notifications", label: "Open Notifications", target: "Notifications" }],
  },
  rooms: {
    id: "rooms",
    title: "Rooms",
    summary: "Rooms jane hapesira live ku 2-6 users futen, chat-ojne dhe hedhin text, audio ose video takes.",
    steps: [
      "Hape Rooms dhe zgjidh nje room aktiv ose krijo nje te re.",
      "Futu ne room dhe jep answer me text, audio ose video.",
      "Socket-i mban sinkron user-at dhe answer-at ne kohe reale.",
    ],
    suggestedActions: [{ id: "open_rooms", label: "Open Rooms", target: "RoomsLobby" }],
  },
  referral: {
    id: "referral",
    title: "Referral",
    summary: "Fto miq, gjurmo joins dhe aktive referrals nga paneli yt.",
    steps: [
      "Hape Referral nga profili.",
      "Shperndaje kodin ose linkun tend.",
      "Shiko kur dikush hyn dhe aktivizohet me answer-in e pare.",
    ],
    suggestedActions: [{ id: "open_referral", label: "Open Referral", target: "Referral" }],
  },
  trending: {
    id: "trending",
    title: "Trending Engine",
    summary: "RSS + AI scoring + categorization zgjedhin cfare meriton te kthehet ne Hot Question.",
    steps: [
      "Feed-et lexohen ne backend.",
      "AI llogarit viral score dhe kategori.",
      "Kandidatet me te forte behen LIVE pyetje per 2-4 ore.",
    ],
    suggestedActions: [{ id: "open_home", label: "See LIVE now", target: "Home" }],
  },
};

const FEATURE_ALIASES = {
  mirror: "mirror",
  story: "story_mode",
  "story mode": "story_mode",
  duet: "duet",
  compare: "duet",
  challenge: "hashtags",
  challenges: "hashtags",
  hashtag: "hashtags",
  hashtags: "hashtags",
  room: "rooms",
  rooms: "rooms",
  referral: "referral",
  refer: "referral",
  notify: "notifications",
  notification: "notifications",
  notifications: "notifications",
  live: "live_news",
  news: "live_news",
  trending: "trending",
};

const APP_CAPABILITIES = [
  "Mirror quick answers",
  "Story Mode with emotion score",
  "Duet split-screen",
  "LIVE news categorization + Hot Questions",
  "Hashtags and challenges",
  "Push notifications and streak reminders",
  "Referral panel",
];

const normalizeText = (value) => String(value || "").replace(/\s+/g, " ").trim();

const normalizeFeatureId = (value) => {
  const raw = normalizeText(value).toLowerCase();
  return FEATURE_ALIASES[raw] || raw.replace(/\s+/g, "_");
};

const buildUnknownFeatureGuide = (featureId) => ({
  id: featureId || "general",
  title: "AI Copilot",
  summary: "Ky modul eshte gati per guide, por feature-i nuk eshte identifikuar sakte ende.",
  steps: [
    "Pyet AI me emer me specifik, p.sh. Story Mode ose Duet.",
    "Ose hape Home / Explore per te nisur nga flow-et kryesore.",
  ],
  suggestedActions: [{ id: "open_home", label: "Open Home", target: "Home" }],
});

const buildCopilotContext = (user, featureGuide = null) => {
  const stats = user?.stats || {};
  const streak = Number(stats.currentStreak || 0);
  const answersGiven = Number(stats.answersGiven || 0);
  const likesReceived = Number(stats.likesReceived || 0);

  return [
    `User: ${user?.username || "guest"}`,
    `Current streak: ${streak}`,
    `Answers given: ${answersGiven}`,
    `Likes received: ${likesReceived}`,
    `Features: ${APP_CAPABILITIES.join(", ")}`,
    featureGuide
      ? `Feature focus: ${featureGuide.title} - ${featureGuide.summary}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
};

const logCopilotOutput = async (type, input, output) => {
  try {
    await db("ai_outputs").insert({
      type,
      input: input || {},
      output: typeof output === "string" ? output : JSON.stringify(output || {}),
    });
  } catch (error) {
    console.warn(`[AI Copilot] Failed to persist ${type}: ${error.message}`);
  }
};

const loadUserSnapshot = async (userId) => {
  const user = userId ? await ensureUser(userId) : null;
  return user ? findUserByIdentifier(user.id) : null;
};

const getFeatureGuide = (feature) => {
  const featureId = normalizeFeatureId(feature);
  return FEATURE_GUIDES[featureId] || buildUnknownFeatureGuide(featureId);
};

const inferFeatureFromQuery = (query) => {
  const lower = normalizeText(query).toLowerCase();
  if (!lower) {
    return "mirror";
  }

  const matched = Object.keys(FEATURE_ALIASES).find((keyword) => lower.includes(keyword));
  return matched ? FEATURE_ALIASES[matched] : "mirror";
};

const buildSuggestedActions = (featureGuide, extraActions = []) => {
  const existing = Array.isArray(featureGuide?.suggestedActions)
    ? featureGuide.suggestedActions
    : [];

  return [...existing, ...extraActions].filter(
    (action, index, items) => action?.id && items.findIndex((item) => item.id === action.id) === index
  );
};

const createAssistantResponse = async ({
  userId = null,
  query,
  feature = null,
  context = {},
}) => {
  const user = await loadUserSnapshot(userId);
  const resolvedFeature = feature || inferFeatureFromQuery(query);
  const featureGuide = getFeatureGuide(resolvedFeature);
  const systemContext = buildCopilotContext(user, featureGuide);

  const assistant = await aiService.generateAssistantReply({
    prompt: `
User question: ${normalizeText(query)}
Context JSON: ${JSON.stringify(context || {})}

Pergjigju me:
- 1-2 fjali shpjegim
- 1 fjali me hapin tjeter konkret
    `.trim(),
    systemContext,
    langCode: context?.langCode || null,
    maxTokens: 160,
    temperature: 0.3,
  });

  const result = {
    featureGuide,
    featureId: featureGuide.id,
    reply: assistant.reply,
    suggestedActions: buildSuggestedActions(featureGuide),
    userSnapshot: user
      ? {
          id: user.id,
          username: user.username,
          stats: user.stats,
        }
      : null,
  };

  await logCopilotOutput("copilot_assistant", { feature: featureGuide.id, query, userId }, result);
  return result;
};

const createAnswerCoaching = async ({ content = "", metadata = {} }) => {
  const questionText = normalizeText(metadata.questionText);
  const answerText = normalizeText(content || metadata.answerText);
  const status = String(metadata.status || "approved");
  const timeMode = metadata.timeMode === "10s" ? "10s" : "5s";
  const userId = metadata.userId || null;

  let coachingLine = "Answer-i yt u ruajt. Hapi me i mire tani eshte share ose duet.";
  if (answerText && questionText) {
    const assistant = await aiService.generateAssistantReply({
      prompt: `
Pyetja: ${questionText}
Pergjigja: ${answerText}
Statusi: ${status}
Koha: ${timeMode}

Jep nje coaching line te shkurter per user-in pas postimit dhe sugjero veprimin me viral.
      `.trim(),
      systemContext:
        "Je AI coach i 5 Second Answer. Jep feedback te shkurter pas postimit dhe sugjero share, duet, story mode ose challenge sipas rastit.",
      langCode: metadata.langCode || null,
      maxTokens: 90,
      temperature: 0.35,
    });

    coachingLine = assistant.reply || coachingLine;
  }

  const suggestions = [
    { id: "share_card", label: "Open Share", target: "Share" },
    { id: "start_duet", label: "Create Duet", target: "Duet" },
    { id: "go_home", label: "Back to Home", target: "Home" },
  ];

  const result = {
    eventType: "new_answer",
    coachingLine,
    status,
    suggestedActions: suggestions,
    metadata: {
      answerId: metadata.answerId || null,
      questionId: metadata.questionId || null,
      timeMode,
      hashtags: Array.isArray(metadata.hashtags) ? metadata.hashtags : [],
    },
  };

  await logCopilotOutput("copilot_new_answer", metadata, result);
  return result;
};

const processTrendingScan = async ({ content, metadata = {} }) => {
  const items = Array.isArray(content) && content.length ? content : null;
  const preferredCategories = Array.isArray(metadata.preferredCategories)
    ? metadata.preferredCategories
    : [];

  const result = items
    ? {
        scored: newsTrendingService.scoreNewsList(items),
        selected: newsTrendingService.pickHotNewsWithAdaptiveFallback(items, {
          limit: metadata.limit || 2,
          threshold: metadata.threshold || 5,
        }),
        categorized: newsTrendingService.buildCategoryBuckets(items, {
          limitPerCategory: metadata.limitPerCategory || 3,
          preferredCategories,
        }),
      }
    : await newsTrendingService.fetchAndScoreNewsFromFeeds({
        limitPerCategory: metadata.limitPerCategory || 3,
        limitPerFeed: metadata.limitPerFeed || 5,
        preferredCategories,
      });

  const summary = {
    eventType: "trending_scan",
    totalCandidates: Array.isArray(result.scored) ? result.scored.length : 0,
    selectedCount: Array.isArray(result.selected) ? result.selected.length : 0,
    topCategory: Array.isArray(result.categorized) && result.categorized.length
      ? result.categorized[0].label
      : null,
    selected: Array.isArray(result.selected)
      ? result.selected.slice(0, 2).map((item) => ({
          title: item.title,
          viralScore: item.viralScore,
          categoryId: item.categoryId,
          categoryLabel: item.categoryLabel,
        }))
      : [],
  };

  await logCopilotOutput("copilot_trending_scan", metadata, summary);
  return {
    ...result,
    summary,
  };
};

const categorizeContent = ({ content = "", metadata = {} }) => {
  const title = normalizeText(
    typeof content === "string" ? content : content?.title || metadata?.title || ""
  );
  const classified = newsTrendingService.classifyNewsCategory({
    provider: metadata?.provider || null,
    source: metadata?.source || null,
    title,
  });

  const result = {
    eventType: "categorize_content",
    input: title,
    categoryId: classified.categoryId,
    categoryLabel: classified.categoryLabel,
    categoryColor: classified.categoryColor,
    confidence: classified.categoryConfidence,
    matches: classified.categoryMatches,
  };

  void logCopilotOutput("copilot_categorize", { title }, result);
  return result;
};

const monitorSystem = async ({ metadata = {} } = {}) => {
  const now = new Date();

  const [
    health,
    dbHeartbeat,
    pendingAnswersRow,
    activeHotQuestionRow,
    pendingDuetsRow,
    expiredDuetsRow,
    latestAiOutputRow,
  ] = await Promise.all([
    aiService.healthCheck(),
    db.raw("select 1 as ok"),
    db("answers").where({ status: "pending" }).count("* as count").first(),
    db("questions")
      .where("expires_at", ">", now.toISOString())
      .andWhereRaw("metadata @> ?::jsonb", [JSON.stringify({ source: "hot-news" })])
      .orderBy("expires_at", "asc")
      .first("id", "text", "expires_at"),
    db("duet_sessions").where({ status: "pending" }).count("* as count").first().catch(() => ({ count: 0 })),
    db("duet_sessions")
      .where({ status: "pending" })
      .andWhere("expires_at", "<", now.toISOString())
      .count("* as count")
      .first()
      .catch(() => ({ count: 0 })),
    db("ai_outputs").orderBy("created_at", "desc").first("type", "created_at"),
  ]);

  const pendingAnswers = Number(pendingAnswersRow?.count || 0);
  const pendingDuets = Number(pendingDuetsRow?.count || 0);
  const expiredDuets = Number(expiredDuetsRow?.count || 0);
  const alerts = [];
  const recommendations = [];

  if (!health.ready) {
    alerts.push({
      level: "critical",
      area: "ai",
      message: "AI provider nuk eshte gati. Assistant dhe categorization jane ne rrezik.",
    });
    recommendations.push({
      type: "config",
      message: "Kontrollo GROQ_API_KEY dhe health endpoint-in e AI.",
    });
  }

  if (pendingAnswers >= 20) {
    alerts.push({
      level: "warning",
      area: "moderation",
      message: `${pendingAnswers} answers po presin review/moderation.`,
    });
    recommendations.push({
      type: "moderation",
      message: "Rrit batch review ose shiko nese ka backlog ne moderation.",
    });
  }

  if (expiredDuets > 0) {
    alerts.push({
      level: "warning",
      area: "duets",
      message: `${expiredDuets} duet sessions duken te skaduara por ende pending.`,
    });
    recommendations.push({
      type: "cleanup",
      message: "Shto cleanup job per duet sessions te skaduara.",
    });
  }

  if (!activeHotQuestionRow) {
    alerts.push({
      level: "info",
      area: "trending",
      message: "Aktualisht nuk ka Hot Question LIVE.",
    });
    recommendations.push({
      type: "content",
      message: "Mund te ekzekutosh live news scan nese do momentum shtese.",
    });
  }

  if (!alerts.length) {
    alerts.push({
      level: "ok",
      area: "system",
      message: "AI copiloti nuk pa probleme kritike ne kete moment.",
    });
  }

  const result = {
    checkedAt: now.toISOString(),
    status: alerts.some((alert) => alert.level === "critical")
      ? "critical"
      : alerts.some((alert) => alert.level === "warning")
        ? "warning"
        : "healthy",
    health,
    metrics: {
      dbOk: Boolean(dbHeartbeat),
      pendingAnswers,
      pendingDuets,
      expiredPendingDuets: expiredDuets,
      hasLiveHotQuestion: Boolean(activeHotQuestionRow),
      latestAiOutput: latestAiOutputRow
        ? {
            type: latestAiOutputRow.type,
            createdAt: latestAiOutputRow.created_at,
          }
        : null,
    },
    alerts,
    recommendations,
    unsupportedModules: [
      "rooms monitoring not wired yet",
      "redis cache auto-healing not wired yet",
      "server restart automation intentionally manual",
    ],
    requestedBy: metadata.requestedBy || null,
  };

  await logCopilotOutput("copilot_monitor", metadata, result);
  return result;
};

const processEvent = async ({ eventType, content = null, metadata = {} }) => {
  const normalizedEventType = normalizeText(eventType).toLowerCase();

  if (!SUPPORTED_EVENT_TYPES.includes(normalizedEventType)) {
    throw new Error(`Unsupported event_type: ${normalizedEventType}`);
  }

  switch (normalizedEventType) {
    case "new_answer":
      return createAnswerCoaching({ content, metadata });
    case "trending_scan":
      return processTrendingScan({ content, metadata });
    case "categorize_content":
      return categorizeContent({ content, metadata });
    case "user_query":
      return createAssistantResponse({
        userId: metadata.userId || null,
        query: typeof content === "string" ? content : metadata.query || "",
        feature: metadata.feature || null,
        context: metadata.context || {},
      });
    case "system_monitor":
      return monitorSystem({ metadata });
    case "hot_question_created":
      await logCopilotOutput("copilot_hot_question", metadata, {
        createdAt: new Date().toISOString(),
        questionId: metadata.questionId || null,
        title: metadata.title || null,
        categoryId: metadata.categoryId || null,
      });
      return {
        eventType: "hot_question_created",
        status: "logged",
      };
    default:
      throw new Error(`Unhandled event_type: ${normalizedEventType}`);
  }
};

module.exports = {
  FEATURE_GUIDES,
  SUPPORTED_EVENT_TYPES,
  createAssistantResponse,
  getFeatureGuide,
  monitorSystem,
  processEvent,
};
