const aiService = require("./aiService");
const engagementNotificationService = require("./engagementNotificationService");
const { db } = require("../data/db");
const { ensureUser, findUserByIdentifier } = require("../data/helpers");
const {
  SUPPORTED_COUNTRIES,
  getCountryConfig,
  resolveCountryCode,
  resolveCountryLanguage,
} = require("../config/countryConfig");
const trendSourceService = require("./trendSourceService");

const HOT_NEWS_SOURCE = "hot-news";
const GENERATED_QUESTION_CACHE_TTL_MS = Math.max(
  60_000,
  Number(process.env.TRENDING_QUESTION_CACHE_TTL_MS || 6 * 60 * 60 * 1000)
);
const NEWS_AI_SCORE_CACHE_TTL_MS = Math.max(
  60_000,
  Number(process.env.TRENDING_NEWS_AI_CACHE_TTL_MS || 30 * 60 * 1000)
);
const hotQuestionCache = new Map();
const generatedQuestionCache = new Map();
const newsAiScoreCache = new Map();
const dailyBrainCache = new Map();
const liveNewsCache = new Map();
const DAILY_BRAIN_CACHE_TTL_MS = Math.max(
  60_000,
  Number(process.env.DAILY_BRAIN_CACHE_TTL_MS || 10 * 60 * 1000)
);
const LIVE_NEWS_CACHE_TTL_MS = Math.max(
  15_000,
  Number(process.env.LIVE_NEWS_CACHE_TTL_MS || 90_000)
);
const PERSISTED_TREND_MAX_AGE_MS = Math.max(
  60_000,
  Number(process.env.PERSISTED_TREND_MAX_AGE_MS || 30 * 60 * 1000)
);
const MIN_PERSISTED_TREND_ITEMS = Math.max(
  3,
  Number(process.env.MIN_PERSISTED_TREND_ITEMS || 6)
);

const WEIGHTS = {
  engagement: 0.4,
  emotion: 0.3,
  recency: 0.2,
  uniqueness: 0.1,
};

const EMOTION_WORDS = [
  "vdiq",
  "vdes",
  "vras",
  "vrau",
  "aksident",
  "sulm",
  "skandal",
  "trondit",
  "tradhti",
  "dram",
  "hero",
  "hetim",
  "krim",
  "arrest",
  "burg",
  "humb",
  "largon nga puna",
  "pushon nga puna",
  "masakr",
  "shok",
  "horror",
  "killed",
  "dies",
  "death",
  "crash",
  "attack",
  "scandal",
  "betrayal",
  "shocking",
  "drama",
  "hero",
  "investigation",
  "arrested",
  "fired",
];

const RELATABLE_TOPICS = [
  "dashuri",
  "tradhti",
  "familje",
  "para",
  "pune",
  "punë",
  "puna",
  "shkoll",
  "femij",
  "fëmij",
  "prind",
  "taks",
  "martes",
  "divorc",
  "femije",
  "pun",
  "relationship",
  "love",
  "family",
  "money",
  "marriage",
  "divorce",
  "dating",
  "job",
];

const CURIOSITY_WORDS = [
  "mister",
  "nuk dihet",
  "ende s'dihet",
  "sekret",
  "pse",
  "si ka mundesi",
  "mystery",
  "unknown",
  "secret",
  "why",
  "how",
];

const BLACKLIST = [
  "politikë e rëndë",
  "raport ekonomik",
  "statistik",
  "inflacion",
  "interest rate",
  "market report",
  "economic report",
  "earnings report",
  "quarterly report",
];

const CATEGORY_PRIORITY = [
  "politics",
  "crime",
  "sports",
  "technology",
  "entertainment",
  "drama",
  "economy",
  "health",
  "education",
  "lifestyle",
  "world",
  "general",
];

const NEWS_CATEGORY_RULES = {
  politics: {
    color: "#FF6B57",
    label: "Politike",
    keywords: [
      "politik",
      "qeveri",
      "kryeminist",
      "minister",
      "ministr",
      "president",
      "parlament",
      "parti",
      "ps",
      "pd",
      "zgjedh",
      "opozit",
      "deputet",
      "bashki",
      "senat",
      "congress",
      "government",
      "prime minister",
      "white house",
      "policy",
      "diplomat",
      "erdogan",
      "netanyahu",
      "trump",
      "biden",
    ],
  },
  drama: {
    color: "#FF4D8D",
    label: "Drame",
    keywords: [
      "drame",
      "dram",
      "tradhti",
      "ndarje",
      "divorc",
      "romance",
      "romanc",
      "xheloz",
      "skandal",
      "perplasje",
      "konflikt",
      "confession",
      "relationship",
      "betrayal",
      "breakup",
      "affair",
    ],
  },
  crime: {
    color: "#FF8A00",
    label: "Krim",
    keywords: [
      "krim",
      "vras",
      "vrau",
      "arrest",
      "polici",
      "prokuror",
      "gjykat",
      "burg",
      "hetim",
      "sulm",
      "masakr",
      "vrasj",
      "crime",
      "murder",
      "attack",
      "arrested",
      "investigation",
      "court",
      "prison",
    ],
  },
  sports: {
    color: "#2ECC71",
    label: "Sport",
    keywords: [
      "sport",
      "futboll",
      "gol",
      "ndeshj",
      "kombetar",
      "kombëtar",
      "trajner",
      "liga",
      "kampionat",
      "basket",
      "tenis",
      "champions",
      "uefa",
      "fifa",
      "nba",
      "nfl",
      "match",
      "coach",
      "player",
      "stadium",
      "galatasaray",
      "barcelona",
      "real madrid",
    ],
  },
  technology: {
    color: "#4AA8FF",
    label: "Teknologji",
    keywords: [
      "teknologj",
      "ai",
      "artificial intelligence",
      "openai",
      "chatgpt",
      "groq",
      "apple",
      "google",
      "meta",
      "microsoft",
      "iphone",
      "android",
      "robot",
      "startup",
      "app",
      "software",
      "chip",
      "tesla",
    ],
  },
  entertainment: {
    color: "#B16CFF",
    label: "Showbiz",
    keywords: [
      "film",
      "serial",
      "aktor",
      "aktore",
      "kengetar",
      "artist",
      "show",
      "festival",
      "netflix",
      "hollywood",
      "tiktok",
      "instagram",
      "album",
      "music",
      "celebrity",
      "reality show",
    ],
  },
  economy: {
    color: "#F1C40F",
    label: "Ekonomi",
    keywords: [
      "ekonomi",
      "bank",
      "finance",
      "financ",
      "biznes",
      "investim",
      "cmim",
      "çmim",
      "naft",
      "lek",
      "euro",
      "dollar",
      "market",
      "treg",
      "inflacion",
      "tax",
      "tarif",
    ],
  },
  health: {
    color: "#16A085",
    label: "Shendet",
    keywords: [
      "shendet",
      "shëndet",
      "spital",
      "mjek",
      "virus",
      "semund",
      "sëmund",
      "vaksin",
      "kurim",
      "health",
      "hospital",
      "doctor",
      "medical",
      "vaccine",
      "disease",
    ],
  },
  education: {
    color: "#8E6B3B",
    label: "Edukimi",
    keywords: [
      "shkoll",
      "universitet",
      "student",
      "provim",
      "arsim",
      "matur",
      "school",
      "university",
      "education",
      "teacher",
      "exam",
      "classroom",
    ],
  },
  lifestyle: {
    color: "#E67E22",
    label: "Lifestyle",
    keywords: [
      "jetes",
      "jetë",
      "ushq",
      "food",
      "udhet",
      "udhët",
      "travel",
      "mot",
      "weather",
      "style",
      "fashion",
      "home",
      "cafe",
      "coffee",
    ],
  },
  world: {
    color: "#5D6D7E",
    label: "Bote",
    keywords: [
      "ukraine",
      "rusi",
      "gaza",
      "izrael",
      "luft",
      "eu",
      "nato",
      "war",
      "global",
      "international",
      "world",
      "brussels",
      "kosove",
      "kosov",
      "serbi",
    ],
  },
  general: {
    color: "#7F8C8D",
    label: "Tjera",
    keywords: [],
  },
};

const CATEGORY_LABELS = {
  sq: {
    politics: "Politike",
    drama: "Drame",
    crime: "Krim",
    sports: "Sport",
    technology: "Teknologji",
    entertainment: "Showbiz",
    economy: "Ekonomi",
    health: "Shendet",
    education: "Edukimi",
    lifestyle: "Lifestyle",
    world: "Bote",
    general: "Tjera",
  },
  en: {
    politics: "Politics",
    drama: "Drama",
    crime: "Crime",
    sports: "Sports",
    technology: "Technology",
    entertainment: "Entertainment",
    economy: "Economy",
    health: "Health",
    education: "Education",
    lifestyle: "Lifestyle",
    world: "World",
    general: "General",
  },
  de: {
    politics: "Politik",
    drama: "Drama",
    crime: "Kriminalitat",
    sports: "Sport",
    technology: "Technologie",
    entertainment: "Unterhaltung",
    economy: "Wirtschaft",
    health: "Gesundheit",
    education: "Bildung",
    lifestyle: "Lifestyle",
    world: "Welt",
    general: "Allgemein",
  },
  fr: {
    politics: "Politique",
    drama: "Drame",
    crime: "Crime",
    sports: "Sport",
    technology: "Technologie",
    entertainment: "Divertissement",
    economy: "Economie",
    health: "Sante",
    education: "Education",
    lifestyle: "Lifestyle",
    world: "Monde",
    general: "General",
  },
  it: {
    politics: "Politica",
    drama: "Dramma",
    crime: "Crimine",
    sports: "Sport",
    technology: "Tecnologia",
    entertainment: "Spettacolo",
    economy: "Economia",
    health: "Salute",
    education: "Istruzione",
    lifestyle: "Lifestyle",
    world: "Mondo",
    general: "Generale",
  },
  es: {
    politics: "Politica",
    drama: "Drama",
    crime: "Crimen",
    sports: "Deportes",
    technology: "Tecnologia",
    entertainment: "Entretenimiento",
    economy: "Economia",
    health: "Salud",
    education: "Educacion",
    lifestyle: "Lifestyle",
    world: "Mundo",
    general: "General",
  },
  tr: {
    politics: "Politika",
    drama: "Dram",
    crime: "Suc",
    sports: "Spor",
    technology: "Teknoloji",
    entertainment: "Magazin",
    economy: "Ekonomi",
    health: "Saglik",
    education: "Egitim",
    lifestyle: "Yasam",
    world: "Dunya",
    general: "Genel",
  },
  pt: {
    politics: "Politica",
    drama: "Drama",
    crime: "Crime",
    sports: "Esportes",
    technology: "Tecnologia",
    entertainment: "Entretenimento",
    economy: "Economia",
    health: "Saude",
    education: "Educacao",
    lifestyle: "Lifestyle",
    world: "Mundo",
    general: "Geral",
  },
  ja: {
    politics: "政治",
    drama: "ドラマ",
    crime: "事件",
    sports: "スポーツ",
    technology: "テクノロジー",
    entertainment: "エンタメ",
    economy: "経済",
    health: "健康",
    education: "教育",
    lifestyle: "ライフ",
    world: "国際",
    general: "一般",
  },
};

const localizeCategoryLabel = (categoryId, countryCode, fallbackLabel = null) => {
  const resolvedLanguage = resolveCountryLanguage(countryCode, "en");
  const localized = CATEGORY_LABELS[resolvedLanguage]?.[categoryId];

  if (localized) {
    return localized;
  }

  if (fallbackLabel) {
    return fallbackLabel;
  }

  return CATEGORY_LABELS.en[categoryId] || NEWS_CATEGORY_RULES[categoryId]?.label || "General";
};

const clamp = (value, min = 0, max = 10) => Math.max(min, Math.min(max, value));

const normalizeTitle = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeComparableText = (value) =>
  normalizeTitle(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const legacyBuildFingerprint = (title) =>
  normalizeTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9çë]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const getCachedValue = (cache, key, ttlMs) => {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.storedAt > ttlMs) {
    cache.delete(key);
    return null;
  }

  return entry.value;
};

const setCachedValue = (cache, key, value) => {
  cache.set(key, {
    storedAt: Date.now(),
    value,
  });

  return value;
};

const getCachedLiveNews = (key) => getCachedValue(liveNewsCache, key, LIVE_NEWS_CACHE_TTL_MS);

const setCachedLiveNews = (key, value) => setCachedValue(liveNewsCache, key, value);

const buildLiveNewsCacheKey = ({
  country,
  limitPerCategory,
  limitPerFeed,
  preferredCategories,
  totalLimit,
}) =>
  [
    resolveCountryCode(country),
    Number(limitPerCategory) || 2,
    Number(limitPerFeed) || 5,
    Number(totalLimit) || 20,
    uniqueList(
      Array.isArray(preferredCategories)
        ? preferredCategories.map((item) => String(item || "").trim()).filter(Boolean)
        : []
    )
      .sort()
      .join("|"),
  ].join("::");

const classifyNewsCategory = (item = {}, options = {}) => {
  const resolvedCountry = resolveCountryCode(options.country);
  const comparable = normalizeComparableText(
    [item.title, item.source, item.provider].filter(Boolean).join(" ")
  );

  if (!comparable) {
    return {
      categoryColor: NEWS_CATEGORY_RULES.general.color,
      categoryConfidence: 0,
      categoryId: "general",
      categoryLabel: localizeCategoryLabel("general", resolvedCountry, NEWS_CATEGORY_RULES.general.label),
      categoryMatches: [],
    };
  }

  const ranked = CATEGORY_PRIORITY.map((categoryId) => {
    const rule = NEWS_CATEGORY_RULES[categoryId];
    const matches = rule.keywords.filter((keyword) => comparable.includes(keyword));

    return {
      categoryId,
      matches,
      score: matches.length,
    };
  }).sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return CATEGORY_PRIORITY.indexOf(left.categoryId) - CATEGORY_PRIORITY.indexOf(right.categoryId);
  });

  const top = ranked[0];
  if (!top || top.score === 0) {
    return {
      categoryColor: NEWS_CATEGORY_RULES.general.color,
      categoryConfidence: 0,
      categoryId: "general",
      categoryLabel: localizeCategoryLabel("general", resolvedCountry, NEWS_CATEGORY_RULES.general.label),
      categoryMatches: [],
    };
  }

  const second = ranked[1] || { score: 0 };
  const rule = NEWS_CATEGORY_RULES[top.categoryId];

  return {
    categoryColor: rule.color,
    categoryConfidence: Number(
      Math.min(1, 0.45 + top.score * 0.15 + Math.max(0, top.score - second.score) * 0.1).toFixed(2)
    ),
    categoryId: top.categoryId,
    categoryLabel: localizeCategoryLabel(top.categoryId, resolvedCountry, rule.label),
    categoryMatches: top.matches,
  };
};

const normalizeNewsItem = (item = {}, options = {}) => {
  const title = normalizeTitle(item.title);
  const publishedAt =
    item.publishedAt || item.published_time || item.time || item.createdAt || null;
  const category = classifyNewsCategory(item, options);

  return {
    ...item,
    ...category,
    publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
    title,
  };
};

const countKeywordHits = (title, words) => {
  const lower = normalizeComparableText(title);
  return words.reduce((count, word) => (lower.includes(word) ? count + 1 : count), 0);
};

const emotionScore = (title) => clamp(countKeywordHits(title, EMOTION_WORDS) * 2);

const curiosityScore = (title) => {
  const normalized = normalizeTitle(title);
  const lower = normalized.toLowerCase();
  let score = 0;

  if (normalized.includes("?")) {
    score += 2;
  }

  if (CURIOSITY_WORDS.some((word) => lower.includes(word))) {
    score += 3;
  }

  if (normalized.includes(":")) {
    score += 1;
  }

  if (/["“”]/.test(normalized)) {
    score += 1;
  }

  if (normalized.split(" ").length < 10) {
    score += 2;
  }

  if (/[A-ZÇË][a-zçë]+(?:\s+[A-ZÇË][a-zçë]+)+/.test(normalized)) {
    score += 2;
  }

  if (/\b(kush|cfare|çfarë|why|who|what)\b/i.test(normalized)) {
    score += 1;
  }

  return clamp(score);
};

const relatabilityScore = (title) => clamp(countKeywordHits(title, RELATABLE_TOPICS) * 3);

const speedScore = (publishedAt, now = new Date()) => {
  if (!publishedAt) {
    return 3;
  }

  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) {
    return 3;
  }

  const diffMinutes = Math.max(0, Math.floor((now.getTime() - published.getTime()) / 60000));

  if (diffMinutes < 30) {
    return 10;
  }

  if (diffMinutes < 120) {
    return 7;
  }

  if (diffMinutes < 360) {
    return 5;
  }

  return 3;
};

const simplicityScore = (title) => {
  const words = normalizeTitle(title).split(" ").filter(Boolean).length;

  if (words <= 8) {
    return 10;
  }

  if (words <= 12) {
    return 7;
  }

  return 4;
};

const isViralCandidate = (title) => {
  const lower = normalizeComparableText(title);
  if (!lower) {
    return false;
  }

  return !BLACKLIST.some((word) => lower.includes(word));
};

const getEngagementFactor = (item = {}) =>
  clamp(item.engagementScore ?? item.engagement_score ?? item.metrics?.engagement ?? 4.5);

const getUniquenessFactor = (item = {}) =>
  clamp(item.uniquenessScore ?? item.uniqueness_score ?? 6);

const scoreNewsItem = (item, now = new Date(), options = {}) => {
  const news = normalizeNewsItem(item, options);
  const factors = {
    engagement: getEngagementFactor(news),
    emotion: emotionScore(news.title),
    curiosity: curiosityScore(news.title),
    recency: trendSourceService.computeRecencyScore(news.publishedAt, now),
    relatability: relatabilityScore(news.title),
    speed: trendSourceService.computeRecencyScore(news.publishedAt, now),
    simplicity: simplicityScore(news.title),
    uniqueness: getUniquenessFactor(news),
  };

  const viralScore = Number(
    (
      factors.engagement * WEIGHTS.engagement +
      factors.emotion * WEIGHTS.emotion +
      factors.recency * WEIGHTS.recency +
      factors.uniqueness * WEIGHTS.uniqueness
    ).toFixed(2)
  );

  return {
    ...news,
    factors,
    viralScore,
    viralCandidate: isViralCandidate(news.title),
  };
};

const scoreNewsList = (newsList = [], now = new Date(), options = {}) =>
  newsList.map((item) => scoreNewsItem(item, now, options));

const computeAiScoreFromSentiment = (sentiment = {}) =>
  Number(
    Math.max(
      0,
      Math.min(
        10,
        Number(
          (
            Number(sentiment.intensity || 0) * 4.5 +
            Number(sentiment.debate_score || 0) * 3.5 +
            Number(sentiment.relatability || 0) * 2
          ).toFixed(2)
        )
      )
    ).toFixed(2)
  );

const scoreNewsItemWithAi = async (item, now = new Date(), options = {}) => {
  const base = scoreNewsItem(item, now, options);
  const fingerprint = buildFingerprint(base.title);
  const cached = getCachedValue(newsAiScoreCache, fingerprint, NEWS_AI_SCORE_CACHE_TTL_MS);

  if (cached) {
    return {
      ...base,
      ...cached,
    };
  }

  const resolvedLanguage = resolveCountryLanguage(options.country, "en");
  const sentiment = await aiService.analyzeSentiment({
    langCode: resolvedLanguage,
    text: base.title,
    timeMode: "5s",
  });
  const aiEmotionScore = computeAiScoreFromSentiment(sentiment);
  const finalViralScore = Number(
    (
      base.factors.engagement * WEIGHTS.engagement +
      aiEmotionScore * WEIGHTS.emotion +
      base.factors.recency * WEIGHTS.recency +
      base.factors.uniqueness * WEIGHTS.uniqueness
    ).toFixed(2)
  );
  const finalScore = Number(Math.max(0, Math.min(1, finalViralScore / 10)).toFixed(2));
  const aiLayer = {
    aiScore: Number(Math.max(0, Math.min(1, aiEmotionScore / 10)).toFixed(2)),
    emotionScore: aiEmotionScore,
    finalScore,
    keywordScore: Number(Math.max(0, Math.min(1, base.viralScore / 10)).toFixed(2)),
    sentiment,
    viralScore: finalViralScore,
  };

  setCachedValue(newsAiScoreCache, fingerprint, aiLayer);

  return {
    ...base,
    ...aiLayer,
  };
};

const scoreNewsListWithAi = async (newsList = [], now = new Date(), options = {}) =>
  Promise.all(newsList.map((item) => scoreNewsItemWithAi(item, now, options)));

const buildCategoryBuckets = (newsList = [], options = {}) => {
  const now = options.now ? new Date(options.now) : new Date();
  const limitPerCategory = Math.max(1, Math.min(8, Number(options.limitPerCategory) || 2));
  const preferredCategorySet = new Set(
    Array.isArray(options.preferredCategories)
      ? options.preferredCategories.map((item) => String(item || "").trim()).filter(Boolean)
      : []
  );
  const scored = scoreNewsList(newsList, now, { country: options.country }).filter((item) =>
    preferredCategorySet.size ? preferredCategorySet.has(item.categoryId) : true
  );
  const grouped = new Map();

  scored.forEach((item) => {
    const current = grouped.get(item.categoryId) || {
      categoryId: item.categoryId,
      color: item.categoryColor,
      label: item.categoryLabel,
      total: 0,
      items: [],
    };

    current.total += 1;
    current.items.push(item);
    grouped.set(item.categoryId, current);
  });

  return [...grouped.values()]
    .map((bucket) => ({
      ...bucket,
      items: bucket.items
        .sort(
          (left, right) =>
            (right.finalScore || right.viralScore || 0) - (left.finalScore || left.viralScore || 0)
        )
        .slice(0, limitPerCategory),
    }))
    .sort((left, right) => {
      const topLeft = left.items[0]?.finalScore || left.items[0]?.viralScore || 0;
      const topRight = right.items[0]?.finalScore || right.items[0]?.viralScore || 0;

      if (topRight !== topLeft) {
        return topRight - topLeft;
      }

      return right.total - left.total;
    });
};

const pickHotNews = (newsList = [], options = {}) => {
  const scoredList =
    newsList.length && (newsList[0]?.finalScore !== undefined || newsList[0]?.viralScore !== undefined)
      ? newsList
      : scoreNewsList(newsList, options.now ? new Date(options.now) : new Date(), {
          country: options.country,
        });
  const limit = Math.max(1, Math.min(1, Number(options.limit) || 1));
  const threshold = Number.isFinite(Number(options.threshold))
    ? Number(options.threshold)
    : 0.58;

  return scoredList
    .filter((item) => item.viralCandidate)
    .sort(
      (left, right) =>
        (right.finalScore || right.viralScore || 0) - (left.finalScore || left.viralScore || 0)
    )
    .slice(0, limit)
    .filter((item) => (item.finalScore || Math.max(0, Math.min(1, (item.viralScore || 0) / 10))) > threshold);
};

const pickHotNewsWithAdaptiveFallback = (newsList = [], options = {}) => {
  const selected = pickHotNews(newsList, options);
  if (selected.length) {
    return {
      adaptiveFallbackUsed: false,
      selected,
    };
  }

  const adaptiveFloor = Number.isFinite(Number(options.adaptiveFloor))
    ? Number(options.adaptiveFloor)
    : 2.5;
  const limit = Math.max(1, Math.min(1, Number(options.limit) || 1));
  const scoredList =
    newsList.length && (newsList[0]?.finalScore !== undefined || newsList[0]?.viralScore !== undefined)
      ? newsList
      : scoreNewsList(newsList, options.now ? new Date(options.now) : new Date(), {
          country: options.country,
        });
  const fallbackSelected = scoredList
    .filter((item) => item.viralCandidate)
    .sort(
      (left, right) =>
        (right.finalScore || right.viralScore || 0) - (left.finalScore || left.viralScore || 0)
    )
    .slice(0, limit)
    .filter((item) => {
      const comparableScore = item.finalScore || Math.max(0, Math.min(1, (item.viralScore || 0) / 10));
      return comparableScore >= adaptiveFloor / 10 && (item.factors.curiosity > 0 || item.factors.emotion > 0);
    });

  return {
    adaptiveFallbackUsed: fallbackSelected.length > 0,
    selected: fallbackSelected,
  };
};

const buildFingerprint = (title) =>
  normalizeTitle(title)
    .toLowerCase()
    .replace(/[^a-z0-9çë]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const findCurrentHotQuestion = async (countryCode) => {
  const resolvedCountry = resolveCountryCode(countryCode);
  const cacheKey = `active:${resolvedCountry}`;
  const cached = getCachedValue(hotQuestionCache, cacheKey, 30_000);
  if (cached) {
    return cached;
  }

  const activeHot = await db("questions")
    .where({ country: resolvedCountry })
    .where("expires_at", ">", new Date().toISOString())
    .andWhereRaw("metadata @> ?::jsonb", [JSON.stringify({ source: HOT_NEWS_SOURCE })])
    .orderBy("expires_at", "asc")
    .first();

  if (activeHot) {
    setCachedValue(hotQuestionCache, cacheKey, activeHot);
  }

  return activeHot || null;
};

const findRecentHotQuestionByFingerprint = async (fingerprint, countryCode) => {
  const resolvedCountry = resolveCountryCode(countryCode);
  const rows = await db("questions")
    .where("created_at", ">=", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .andWhere({ country: resolvedCountry })
    .whereRaw("metadata @> ?::jsonb", [JSON.stringify({ source: HOT_NEWS_SOURCE })])
    .select("id", "text", "metadata")
    .orderBy("created_at", "desc");

  return rows.find((row) => row.metadata?.newsFingerprint === fingerprint) || null;
};

const resolveCachedGeneratedQuestion = async (fingerprint, title, langCode = "sq") => {
  const cached = getCachedValue(generatedQuestionCache, fingerprint, GENERATED_QUESTION_CACHE_TTL_MS);
  if (cached) {
    return cached;
  }

  const generated = await aiService.generateQuestionFromNews(title, langCode);
  return setCachedValue(generatedQuestionCache, fingerprint, generated);
};

const createHotQuestionFromNews = async (newsItem, options = {}) => {
  const resolvedCountry = resolveCountryCode(options.country);
  const normalized =
    newsItem?.finalScore !== undefined || newsItem?.viralScore !== undefined
      ? newsItem
      : await scoreNewsItemWithAi(newsItem, new Date(), { country: resolvedCountry });
  if (!normalized.title) {
    throw new Error("News title is required");
  }

  const countryConfig = getCountryConfig(resolvedCountry);
  const activeHotQuestion = await findCurrentHotQuestion(resolvedCountry);
  if (activeHotQuestion) {
    return {
      created: false,
      hotAlreadyActive: true,
      news: normalized,
      question: activeHotQuestion,
    };
  }

  const fingerprint = buildFingerprint(normalized.title);
  const existing = await findRecentHotQuestionByFingerprint(fingerprint, resolvedCountry);

  if (existing) {
    return {
      created: false,
      news: normalized,
      question: existing,
    };
  }

  const systemUser = await ensureUser("mirror_news");
  const generated = await resolveCachedGeneratedQuestion(
    fingerprint,
    normalized.title,
    options.langCode || resolveCountryLanguage(resolvedCountry, "en")
  );

  const [question] = await db("questions")
    .insert({
      country: resolvedCountry,
      text: generated.question,
      category: options.category || normalized.categoryId || "trending",
      user_id: systemUser.id,
      views: 0,
      status: "active",
      ai_reviewed: true,
      expires_at: new Date(Date.now() + (options.expiresInMinutes || 180) * 60000).toISOString(),
      is_daily: false,
      metadata: {
        aiScore: normalized.aiScore || 0,
        finalScore: normalized.finalScore || 0,
        keywordScore: normalized.keywordScore || 0,
        langCode: generated.langCode,
        countryCode: resolvedCountry,
        countryLabel: countryConfig.label,
        newsFingerprint: fingerprint,
        newsCategoryColor: normalized.categoryColor,
        newsCategoryId: normalized.categoryId,
        newsCategoryLabel: normalized.categoryLabel,
        newsSource: normalized.source || normalized.provider || "news",
        publishedAt: normalized.publishedAt,
        sentiment: normalized.sentiment || null,
        source: HOT_NEWS_SOURCE,
        title: normalized.title,
        url: normalized.url || null,
      },
    })
    .returning("*");

  setCachedValue(hotQuestionCache, `active:${resolvedCountry}`, question);

  if (options.sendNotification !== false) {
    await engagementNotificationService.notifyHotQuestion({
      expiresInMinutes: options.expiresInMinutes || 120,
      questionId: question.id,
    });
  }

  return {
    created: true,
    news: normalized,
    question,
  };
};

const detectAndCreateHotQuestions = async (newsList = [], options = {}) => {
  const resolvedCountry = resolveCountryCode(options.country);
  const activeHotQuestion = await findCurrentHotQuestion(resolvedCountry);
  const scoredNews = await scoreNewsListWithAi(newsList, options.now ? new Date(options.now) : new Date(), {
    country: resolvedCountry,
  });
  const { adaptiveFallbackUsed, selected } = pickHotNewsWithAdaptiveFallback(scoredNews, options);
  const created = [];

  if (activeHotQuestion) {
    return {
      adaptiveFallbackUsed: false,
      activeHotQuestion,
      created,
      selected: [],
      totalCandidates: newsList.length,
      totalSelected: 0,
    };
  }

  for (const item of selected) {
    const result = await createHotQuestionFromNews(item, options);
    created.push({
      ...result,
      factors: item.factors,
      finalScore: item.finalScore,
      keywordScore: item.keywordScore,
      sentiment: item.sentiment,
      viralScore: item.viralScore,
    });
  }

  return {
    adaptiveFallbackUsed,
    selected,
    totalCandidates: newsList.length,
    totalSelected: selected.length,
    created,
  };
};

const REACTION_STOP_WORDS = new Set([
  "dhe",
  "eshte",
  "është",
  "kjo",
  "nje",
  "një",
  "per",
  "për",
  "nga",
  "por",
  "apo",
  "the",
  "and",
  "that",
  "this",
  "with",
  "nga",
  "very",
  "too",
  "just",
]);

const analyzeResponses = (responses = []) => {
  const counts = new Map();
  const samples = [];

  responses.forEach((response) => {
    const normalized = String(response || "").trim();
    if (!normalized) {
      return;
    }

    if (samples.length < 3) {
      samples.push(normalized);
    }

    const words = normalized.match(/\b[\p{L}\p{N}]{3,}\b/gu) || [];
    words.forEach((word) => {
      const lower = word.toLowerCase();
      if (REACTION_STOP_WORDS.has(lower)) {
        return;
      }
      counts.set(lower, (counts.get(lower) || 0) + 1);
    });
  });

  const topWords = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([word, count]) => ({ count, word }));

  return {
    responseSample: samples,
    topReactions: topWords.map((item) => item.word),
    topWords,
    totalResponses: responses.length,
  };
};

const getHotQuestionInsights = async (questionId) => {
  const rows = await db("answers")
    .where({ question_id: questionId, status: "approved" })
    .select("text", "ai_review");

  const responses = rows
    .map((row) => row.text || row.ai_review?.transcript || null)
    .filter(Boolean);

  return analyzeResponses(responses);
};

const fetchDetectAndCreateFromFeeds = async (options = {}) => {
  const resolvedCountry = resolveCountryCode(options.country);
  const feedResult = await trendSourceService.fetchTrendUniverse({
    country: resolvedCountry,
    limitPerSource: options.limitPerFeed || 5,
    totalLimit: options.totalLimit || 20,
  });
  const scoredItems = await trendSourceService.enrichTopTrendItems(
    await scoreNewsListWithAi(feedResult.items, options.now ? new Date(options.now) : new Date(), {
      country: resolvedCountry,
    }),
    {
      country: resolvedCountry,
    }
  );
  await trendSourceService.persistTrendItems(scoredItems, { country: resolvedCountry });
  const trendingResult = await detectAndCreateHotQuestions(scoredItems, options);

  return {
    ...trendingResult,
    categorized: buildCategoryBuckets(scoredItems, {
      country: resolvedCountry,
      limitPerCategory: options.limitPerCategory || 2,
      now: options.now,
    }),
    deduplicated: feedResult.deduplicated || 0,
    feedHealth: feedResult.sourceHealth,
    fetchedItems: feedResult.items,
    country: resolvedCountry,
    totalSources: feedResult.totalSources,
    pipeline: {
      ai: "FAST/SMART/BRAIN",
      stored: true,
      sources: feedResult.sourceHealth,
    },
  };
};

const fetchAndScoreNewsFromFeeds = async (options = {}) => {
  const resolvedCountry = resolveCountryCode(options.country);
  const preferredCategories = Array.isArray(options.preferredCategories)
    ? options.preferredCategories
    : [];
  const cacheKey = buildLiveNewsCacheKey({
    country: resolvedCountry,
    limitPerCategory: options.limitPerCategory,
    limitPerFeed: options.limitPerFeed,
    preferredCategories,
    totalLimit: options.totalLimit,
  });

  if (options.forceRefresh !== true) {
    const cached = getCachedLiveNews(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const persistedItems = options.usePersisted !== false
    ? await loadPersistedTrendItems({
        country: resolvedCountry,
        totalLimit: options.totalLimit || 20,
      })
    : [];

  if (persistedItems.length >= Math.min(Number(options.totalLimit) || 20, MIN_PERSISTED_TREND_ITEMS)) {
    const persistedResult = await buildLiveNewsResult(persistedItems, {
      country: resolvedCountry,
      limitPerCategory: options.limitPerCategory,
      now: options.now,
      preferredCategories,
      pipeline: {
        ai: "persisted fast path",
        stored: true,
        sources: [{ sourceType: "db_cache", success: true, count: persistedItems.length }],
        viralFormula: "engagement*0.4 + emotion*0.3 + recency*0.2 + uniqueness*0.1",
      },
      totalFetched: persistedItems.length,
    });

    return setCachedLiveNews(cacheKey, persistedResult);
  }

  const feedResult = await trendSourceService.fetchTrendUniverse({
    country: resolvedCountry,
    limitPerSource: options.limitPerFeed || 5,
    totalLimit: options.totalLimit || 20,
  });
  const scoredList = scoreNewsList(feedResult.items, options.now ? new Date(options.now) : new Date(), {
    country: resolvedCountry,
  });
  const result = await buildLiveNewsResult(scoredList, {
    country: resolvedCountry,
    deduplicated: feedResult.deduplicated || 0,
    feedHealth: feedResult.sourceHealth,
    limitPerCategory: options.limitPerCategory,
    now: options.now,
    preferredCategories,
    pipeline: {
      ai: "lightweight local scoring",
      stored: true,
      sources: feedResult.sourceHealth,
      viralFormula: "engagement*0.4 + emotion*0.3 + recency*0.2 + uniqueness*0.1",
    },
    totalFetched: feedResult.totalItems,
    totalSources: feedResult.totalSources,
  });

  return setCachedLiveNews(cacheKey, result);
};

const getCachedDailyBrain = (key) => getCachedValue(dailyBrainCache, key, DAILY_BRAIN_CACHE_TTL_MS);

const setCachedDailyBrain = (key, value) =>
  setCachedValue(dailyBrainCache, key, value);

const parseListInput = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

const uniqueList = (items = []) => [...new Set(items.filter(Boolean))];

const decodeHtmlEntities = (value = '') =>
  String(value || '')
    .replace(/&#(\d+);/g, (_, code) => {
      const numeric = Number(code);
      return Number.isFinite(numeric) ? String.fromCharCode(numeric) : '';
    })
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const mapPersistedTrendRowToItem = (row, countryCode) => {
  const resolvedCountry = resolveCountryCode(countryCode);
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const normalized = normalizeNewsItem(
    {
      provider: row.source_name,
      publishedAt: row.published_at,
      source: row.source_name,
      title: decodeHtmlEntities(row.title),
      url: row.url,
    },
    { country: resolvedCountry }
  );
  const categoryId = row.category_id || metadata.categoryId || normalized.categoryId || "general";
  const categoryRule = NEWS_CATEGORY_RULES[categoryId] || NEWS_CATEGORY_RULES.general;
  const decisionBrief =
    metadata.decisionBrief && typeof metadata.decisionBrief === "object"
      ? metadata.decisionBrief
      : {
          action: row.ai_action || null,
          risk: row.ai_risk || null,
          summary: row.ai_insight || null,
        };
  const viralScore = Number(row.viral_score || 0);

  return {
    ...normalized,
    aiAction: row.ai_action || decisionBrief.action || null,
    aiInsight: row.ai_insight || decisionBrief.summary || null,
    aiRisk: row.ai_risk || decisionBrief.risk || null,
    aiScore: Number(metadata.aiScore || 0),
    categoryColor: categoryRule.color,
    categoryId,
    categoryLabel: localizeCategoryLabel(categoryId, resolvedCountry, categoryRule.label),
    decisionBrief,
    engagementScore: Number(row.engagement_score || 0),
    emotionScore: Number(row.emotion_score || 0),
    externalId: row.external_id || null,
    finalScore: Number(
      metadata.finalScore || Math.max(0, Math.min(1, viralScore > 1 ? viralScore / 10 : viralScore))
    ),
    fingerprint: row.fingerprint,
    generatedQuestion: row.ai_question || null,
    langCode: metadata.langCode || resolveCountryLanguage(resolvedCountry, "en"),
    metadata,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : normalized.publishedAt,
    recencyScore: Number(row.recency_score || 0),
    sentiment: metadata.sentiment || null,
    source: row.source_name || "Trend Source",
    sourceName: row.source_name || "Trend Source",
    sourceType: row.source_type || metadata.sourceType || "unknown",
    uniquenessScore: Number(row.uniqueness_score || 0),
    url: row.url || null,
    viralScore,
  };
};

const loadPersistedTrendItems = async (options = {}) => {
  const resolvedCountry = resolveCountryCode(options.country);
  const safeTotalLimit = Math.max(5, Math.min(40, Number(options.totalLimit) || 20));
  const cutoff = new Date(Date.now() - PERSISTED_TREND_MAX_AGE_MS).toISOString();
  const rows = await db("trend_source_items")
    .where({ country: resolvedCountry })
    .andWhere("last_seen_at", ">=", cutoff)
    .orderBy("viral_score", "desc")
    .orderBy("published_at", "desc")
    .orderBy("updated_at", "desc")
    .limit(safeTotalLimit);

  return rows.map((row) => mapPersistedTrendRowToItem(row, resolvedCountry));
};

const buildLiveNewsResult = async (items = [], options = {}) => {
  const resolvedCountry = resolveCountryCode(options.country);
  const preferredCategories = Array.isArray(options.preferredCategories)
    ? options.preferredCategories
    : [];
  const [currentHot] = await Promise.all([findCurrentHotQuestion(resolvedCountry)]);
  const scored = items.filter((item) =>
    preferredCategories.length ? preferredCategories.includes(item.categoryId) : true
  );
  const uniqueSourceTypes = new Set(
    items.map((item) => String(item.sourceType || item.metadata?.sourceType || "unknown").trim()).filter(Boolean)
  );

  return {
    categorized: buildCategoryBuckets(items, {
      country: resolvedCountry,
      limitPerCategory: options.limitPerCategory || 2,
      now: options.now,
      preferredCategories,
    }),
    country: resolvedCountry,
    currentHot,
    deduplicated: options.deduplicated || 0,
    feedHealth: options.feedHealth || [],
    fetchedItems: items,
    pipeline: options.pipeline || {
      ai: "fast persisted read",
      stored: true,
      sources: options.feedHealth || [],
      viralFormula: "engagement*0.4 + emotion*0.3 + recency*0.2 + uniqueness*0.1",
    },
    scored,
    totalFetched: options.totalFetched || items.length,
    totalSources: options.totalSources || uniqueSourceTypes.size,
  };
};

const loadUserHistoryCategories = async (userId, countryCode) => {
  if (!String(userId || "").trim()) {
    return [];
  }

  const actor = await findUserByIdentifier(userId);
  if (!actor?.id) {
    return [];
  }

  const rows = await db("answers as a")
    .join("questions as q", "q.id", "a.question_id")
    .where("a.user_id", actor.id)
    .andWhere("a.country", resolveCountryCode(countryCode))
    .select("q.category")
    .orderBy("a.created_at", "desc")
    .limit(12);

  const counts = new Map();
  rows.forEach((row) => {
    const category = String(row.category || "").trim();
    if (!category) {
      return;
    }

    counts.set(category, (counts.get(category) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([category]) => category);
};

const buildDailyBrainCacheKey = ({
  country,
  userId,
  preferredCategories,
  historyCategories,
  interests,
}) =>
  [
    resolveCountryCode(country),
    String(userId || '').trim() || 'anon',
    uniqueList(preferredCategories).sort().join('|'),
    uniqueList(historyCategories).sort().join('|'),
    uniqueList(interests).sort().join('|'),
  ].join('::');

const buildDecisionFallback = (item, langCode) => {
  const language = String(langCode || 'en').trim().toLowerCase() || 'en';
  if (language === 'sq') {
    return {
      summary: 'Ky lajm po fiton shpejt rendesi.',
      implication: 'Mund te preke menyren si mendon ose vepron sot.',
      action: 'Shiko nje update tjeter para se te reagosh forte.',
      risk: 'medium',
      why_now: 'Po ngjall vemendje dhe debat ne kete moment.',
    };
  }

  if (language === 'ja') {
    return {
      summary: 'このニュースは急に重みを増しています。',
      implication: '今日の判断や空気感に影響する可能性があります。',
      action: 'もう一つ確かな更新を確認するまで急いで動かないでください。',
      risk: 'medium',
      why_now: '今まさに注目が集まり、流れが変わりやすいです。',
    };
  }

  if (language === 'de') {
    return {
      summary: 'Diese Nachricht gewinnt gerade schnell an Gewicht.',
      implication: 'Sie kann heutige Entscheidungen oder Erwartungen beeinflussen.',
      action: 'Warte auf noch ein klares Update, bevor du reagierst.',
      risk: 'medium',
      why_now: 'Das Thema zieht gerade Aufmerksamkeit und Debatte an.',
    };
  }

  if (language === 'fr') {
    return {
      summary: 'Cette info prend vite de l importance.',
      implication: 'Elle peut influencer tes decisions ou ton attention aujourd hui.',
      action: 'Attends encore une mise a jour claire avant de reagir fort.',
      risk: 'medium',
      why_now: 'Le sujet attire vite l attention et le debat.',
    };
  }

  if (language === 'it') {
    return {
      summary: 'Questa notizia sta pesando sempre di piu.',
      implication: 'Puo influenzare decisioni o aspettative gia oggi.',
      action: 'Aspetta un altro aggiornamento chiaro prima di reagire forte.',
      risk: 'medium',
      why_now: 'Il tema sta attirando attenzione e discussione in fretta.',
    };
  }

  if (language === 'es') {
    return {
      summary: 'Esta noticia esta ganando peso muy rapido.',
      implication: 'Puede influir en decisiones o expectativas de hoy.',
      action: 'Espera una actualizacion mas clara antes de reaccionar fuerte.',
      risk: 'medium',
      why_now: 'El tema esta atrayendo atencion y debate ahora mismo.',
    };
  }

  if (language === 'tr') {
    return {
      summary: 'Bu haber hizla agirlik kazaniyor.',
      implication: 'Bugunku kararlarini veya beklentilerini etkileyebilir.',
      action: 'Guclu tepki vermeden once bir net guncelleme daha bekle.',
      risk: 'medium',
      why_now: 'Konu su an hizla dikkat ve tartisma topluyor.',
    };
  }

  if (language === 'pt') {
    return {
      summary: 'Esta noticia esta a ganhar peso muito depressa.',
      implication: 'Pode mexer com decisoes ou expectativas de hoje.',
      action: 'Espera por mais uma atualizacao clara antes de reagires forte.',
      risk: 'medium',
      why_now: 'O tema esta a puxar atencao e debate agora.',
    };
  }

  return {
    summary: 'This story is gaining importance quickly.',
    implication: 'It may affect how you think or act today.',
    action: 'Check one more update before reacting strongly.',
    risk: 'medium',
    why_now: 'It is building attention and debate right now.',
  };
};

const getPersonalizedDailyBrain = async (options = {}) => {
  const resolvedCountry = resolveCountryCode(options.country);
  const preferredCategories = uniqueList(parseListInput(options.preferredCategories));
  const interests = uniqueList(parseListInput(options.interests));
  const historyCategories = uniqueList(
    await loadUserHistoryCategories(options.userId, resolvedCountry)
  );
  const mergedCategories = uniqueList([...preferredCategories, ...historyCategories]).slice(0, 5);
  const cacheKey = buildDailyBrainCacheKey({
    country: resolvedCountry,
    userId: options.userId,
    preferredCategories,
    historyCategories,
    interests,
  });
  const cached = getCachedDailyBrain(cacheKey);

  if (cached) {
    return cached;
  }

  let feedResult = await fetchAndScoreNewsFromFeeds({
    country: resolvedCountry,
    limitPerCategory: 3,
    limitPerFeed: 4,
    preferredCategories: mergedCategories,
  });
  const needsFallbackToAllNews = !(feedResult.scored || []).length;

  if (needsFallbackToAllNews) {
    feedResult = await fetchAndScoreNewsFromFeeds({
      country: resolvedCountry,
      limitPerCategory: 3,
      limitPerFeed: 4,
      preferredCategories: [],
    });
  }

  const sortedNews = [...(feedResult.scored || [])].sort(
    (left, right) =>
      (right.finalScore || right.viralScore || 0) - (left.finalScore || left.viralScore || 0)
  );
  const selectedNews = sortedNews.slice(0, 3);
  const langCode = resolveCountryLanguage(resolvedCountry, 'en');
  const cards = selectedNews.map((item, index) => {
    const fallback = buildDecisionFallback(item, langCode);
    const cleanTitle = decodeHtmlEntities(item.title);
    const storedBrief =
      item.decisionBrief && typeof item.decisionBrief === "object" ? item.decisionBrief : {};

    return {
      id: `${item.categoryId || 'news'}_${index}`,
      title: cleanTitle,
      source: item.source || item.provider || 'News',
      categoryId: item.categoryId || 'general',
      categoryLabel: item.categoryLabel || 'News',
      summary: storedBrief.summary || item.aiInsight || fallback.summary,
      implication: storedBrief.implication || fallback.implication,
      action: storedBrief.action || item.aiAction || fallback.action,
      risk: storedBrief.risk || item.aiRisk || fallback.risk,
      whyNow: storedBrief.why_now || fallback.why_now,
      viralScore: Number(item.finalScore || item.viralScore || 0),
    };
  });

  const topBucket = (feedResult.categorized || [])[0] || null;
  const trendHeadline = topBucket?.items?.[0] || selectedNews[0] || null;
  const decisionCard =
    cards
      .slice()
      .sort((left, right) => {
        const rank = { high: 3, medium: 2, low: 1 };
        return (rank[right.risk] || 0) - (rank[left.risk] || 0);
      })[0] || null;

  const result = {
    country: resolvedCountry,
    generatedAt: new Date().toISOString(),
    basedOn: {
      interests,
      preferredCategories,
      historyCategories,
    },
    knowToday: cards,
    risingTrend: trendHeadline
      ? {
          categoryId: topBucket?.categoryId || trendHeadline.categoryId || 'general',
          categoryLabel: topBucket?.label || trendHeadline.categoryLabel || 'News',
          title: decodeHtmlEntities(trendHeadline.title),
          momentum: Number(trendHeadline.finalScore || trendHeadline.viralScore || 0).toFixed(2),
        }
      : null,
    decision:
      decisionCard
        ? {
            title: decodeHtmlEntities(decisionCard.title),
            action: decisionCard.action,
            risk: decisionCard.risk,
            implication: decisionCard.implication,
          }
        : null,
  };

  return setCachedDailyBrain(cacheKey, result);
};

const resolveWarmCountryList = (input = null) => {
  const configured = String(input || process.env.TRENDING_WARM_COUNTRIES || "AL,XK,US,GB")
    .split(",")
    .map((item) => resolveCountryCode(item))
    .filter(Boolean);

  return [...new Set(configured)].filter((code) =>
    SUPPORTED_COUNTRIES.some((country) => country.code === code)
  );
};

const warmTrendingCountryCache = async (countryCode, options = {}) => {
  const resolvedCountry = resolveCountryCode(countryCode);
  const live = await fetchAndScoreNewsFromFeeds({
    country: resolvedCountry,
    limitPerCategory: options.limitPerCategory || 3,
    limitPerFeed: options.limitPerFeed || 3,
    totalLimit: options.totalLimit || 12,
    forceRefresh: options.forceRefresh === true,
    preferredCategories: [],
    usePersisted: options.usePersisted !== false,
  });
  const brain = await getPersonalizedDailyBrain({
    country: resolvedCountry,
    interests: [],
    preferredCategories: [],
    userId: options.userId || null,
  });

  return {
    brainCards: Array.isArray(brain?.knowToday) ? brain.knowToday.length : 0,
    country: resolvedCountry,
    liveItems: Array.isArray(live?.scored) ? live.scored.length : 0,
  };
};

const warmTrendingCaches = async (options = {}) => {
  const countries = resolveWarmCountryList(options.countries);
  const results = [];

  for (const country of countries) {
    try {
      const result = await warmTrendingCountryCache(country, options);
      results.push({
        ...result,
        success: true,
      });
    } catch (error) {
      results.push({
        country,
        error: error.message || "warm_failed",
        success: false,
      });
    }
  }

  return {
    results,
    totalCountries: results.length,
    totalSuccessful: results.filter((item) => item.success).length,
  };
};

const runMultiCountryTrendingJob = async (options = {}) => {
  const results = [];

  for (const country of SUPPORTED_COUNTRIES) {
    const result = await fetchDetectAndCreateFromFeeds({
      ...options,
      country: country.code,
    });

    results.push({
      activeHotQuestion: result.activeHotQuestion || null,
      country: country.code,
      createdCount: Array.isArray(result.created) ? result.created.filter((item) => item.created).length : 0,
      totalFetched: result.fetchedItems?.length || 0,
      totalSources: result.totalSources || 0,
    });
  }

  return {
    results,
    totalCountries: results.length,
    totalCreated: results.reduce((sum, item) => sum + item.createdCount, 0),
  };
};

module.exports = {
  WEIGHTS,
  analyzeResponses,
  buildCategoryBuckets,
  classifyNewsCategory,
  createHotQuestionFromNews,
  curiosityScore,
  detectAndCreateHotQuestions,
  emotionScore,
  fetchAndScoreNewsFromFeeds,
  fetchDetectAndCreateFromFeeds,
  findCurrentHotQuestion,
  getHotQuestionInsights,
  isViralCandidate,
  normalizeNewsItem,
  pickHotNews,
  pickHotNewsWithAdaptiveFallback,
  relatabilityScore,
  scoreNewsItemWithAi,
  scoreNewsItem,
  scoreNewsList,
  scoreNewsListWithAi,
  simplicityScore,
  speedScore,
  runMultiCountryTrendingJob,
  getPersonalizedDailyBrain,
  localizeCategoryLabel,
  resolveWarmCountryList,
  warmTrendingCountryCache,
  warmTrendingCaches,
};
