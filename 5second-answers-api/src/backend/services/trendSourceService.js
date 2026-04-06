const axios = require("axios");
const { db } = require("../data/db");
const rssService = require("./rssService");
const aiService = require("./aiService");
const {
  DEFAULT_COUNTRY_CODE,
  resolveCountryCode,
  resolveCountryLanguage,
} = require("../config/countryConfig");

const DEFAULT_LIMIT_PER_SOURCE = Math.max(
  2,
  Math.min(20, Number(process.env.TREND_SOURCE_LIMIT_PER_SOURCE || 6))
);
const DEFAULT_TOTAL_LIMIT = Math.max(
  5,
  Math.min(40, Number(process.env.TREND_SOURCE_TOTAL_LIMIT || 20))
);
const SOURCE_CACHE_TTL_MS = Math.max(
  30_000,
  Number(process.env.TREND_SOURCE_CACHE_TTL_MS || 120_000)
);
const AI_ENRICH_LIMIT = Math.max(
  1,
  Math.min(10, Number(process.env.TREND_SOURCE_AI_ENRICH_LIMIT || 5))
);
const USER_AGENT =
  process.env.TREND_SOURCE_USER_AGENT ||
  process.env.RSS_NEWS_USER_AGENT ||
  "Mozilla/5.0 (compatible; 5SecondAnswerBot/1.0; +https://5second.app)";

const sourceCache = new Map();

const NEWSAPI_SUPPORTED_COUNTRIES = new Set([
  "AR",
  "AT",
  "AU",
  "BE",
  "BG",
  "BR",
  "CA",
  "CH",
  "CN",
  "CO",
  "CU",
  "CZ",
  "DE",
  "EG",
  "FR",
  "GB",
  "GR",
  "HK",
  "HU",
  "ID",
  "IE",
  "IL",
  "IN",
  "IT",
  "JP",
  "LT",
  "LV",
  "MA",
  "MX",
  "MY",
  "NG",
  "NL",
  "NO",
  "NZ",
  "PH",
  "PL",
  "PT",
  "RO",
  "RS",
  "RU",
  "SA",
  "SE",
  "SG",
  "SI",
  "SK",
  "TH",
  "TR",
  "TW",
  "UA",
  "US",
  "VE",
  "ZA",
]);

const clamp = (value, min = 0, max = 10) =>
  Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));

const normalizeText = (value = "") =>
  String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const normalizeComparable = (value = "") =>
  normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const toIsoString = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeUrl = (value = "") => {
  try {
    const url = new URL(String(value || "").trim());
    url.hash = "";
    [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "feature",
      "fbclid",
      "gclid",
    ].forEach((key) => url.searchParams.delete(key));
    return url.toString();
  } catch (_error) {
    return String(value || "").trim() || null;
  }
};

const buildFingerprint = (item = {}) => {
  const normalizedUrl = normalizeUrl(item.url || item.link || "");
  if (normalizedUrl) {
    return `url:${normalizedUrl.toLowerCase()}`;
  }

  return `title:${normalizeComparable(item.title).slice(0, 220)}`;
};

const tokenize = (value = "") =>
  normalizeComparable(value)
    .split(" ")
    .filter((token) => token.length >= 3);

const jaccardSimilarity = (leftTokens = [], rightTokens = []) => {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  if (!left.size || !right.size) {
    return 0;
  }

  let intersection = 0;
  left.forEach((token) => {
    if (right.has(token)) {
      intersection += 1;
    }
  });

  const union = new Set([...left, ...right]).size || 1;
  return intersection / union;
};

const computeRecencyScore = (publishedAt, now = new Date()) => {
  if (!publishedAt) {
    return 4;
  }

  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) {
    return 4;
  }

  const diffMinutes = Math.max(0, Math.floor((now.getTime() - published.getTime()) / 60_000));

  if (diffMinutes <= 30) {
    return 10;
  }

  if (diffMinutes <= 120) {
    return 8;
  }

  if (diffMinutes <= 360) {
    return 6;
  }

  if (diffMinutes <= 720) {
    return 5;
  }

  if (diffMinutes <= 1440) {
    return 4;
  }

  return 3;
};

const normalizeApproxTraffic = (value = "") => {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) {
    return 0;
  }

  const numeric = Number(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  if (raw.includes("M")) {
    return Math.round(numeric * 1_000_000);
  }

  if (raw.includes("K")) {
    return Math.round(numeric * 1_000);
  }

  return Math.round(numeric);
};

const normalizeEngagementScore = ({ sourceType, metrics = {} }) => {
  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const withSourceBias = (score) => {
    const sourceBias =
      sourceType === "rss" || sourceType === "google_trends" || sourceType === "newsapi" || sourceType === "youtube"
        ? 1.12
        : 0.92;
    return clamp(score * sourceBias, 0, 10);
  };

  switch (sourceType) {
    case "reddit": {
      const value = toNumber(metrics.score) + toNumber(metrics.comments) * 2;
      return withSourceBias(Math.log10(value + 1) * 1.8);
    }
    case "youtube": {
      const value =
        toNumber(metrics.views) +
        toNumber(metrics.likes) * 15 +
        toNumber(metrics.comments) * 40;
      return withSourceBias(Math.log10(value + 1) * 1.35);
    }
    case "hackernews": {
      const value = toNumber(metrics.score) * 20 + toNumber(metrics.comments) * 40;
      return withSourceBias(Math.log10(value + 1) * 1.6);
    }
    case "google_trends": {
      const value = toNumber(metrics.traffic);
      return withSourceBias(value ? Math.log10(value + 1) * 1.5 : 6.5);
    }
    case "newsapi":
      return withSourceBias(5.8);
    case "rss":
      return withSourceBias(5.2);
    default:
      return withSourceBias(5);
  }
};

const normalizeSourceItem = ({
  country,
  sourceType,
  sourceName,
  externalId = null,
  title,
  url,
  publishedAt,
  metrics = {},
  metadata = {},
}) => {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) {
    return null;
  }

  const safeUrl = normalizeUrl(url);
  const safePublishedAt = toIsoString(publishedAt);

  const item = {
    country: resolveCountryCode(country, DEFAULT_COUNTRY_CODE),
    externalId: externalId ? String(externalId) : null,
    fingerprint: buildFingerprint({ title: normalizedTitle, url: safeUrl }),
    link: safeUrl,
    metadata,
    metrics,
    provider: sourceName,
    publishedAt: safePublishedAt,
    source: sourceName,
    sourceName,
    sourceType,
    title: normalizedTitle,
    url: safeUrl,
  };

  item.engagementScore = Number(
    normalizeEngagementScore({
      sourceType,
      metrics,
    }).toFixed(2)
  );

  return item;
};

const getCachedValue = (key) => {
  const entry = sourceCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.storedAt > SOURCE_CACHE_TTL_MS) {
    sourceCache.delete(key);
    return null;
  }

  return entry.value;
};

const setCachedValue = (key, value) => {
  sourceCache.set(key, {
    storedAt: Date.now(),
    value,
  });

  return value;
};

const mapCountryCodeForSource = (sourceType, country) => {
  const resolved = resolveCountryCode(country, DEFAULT_COUNTRY_CODE);

  if (sourceType === "youtube" || sourceType === "google_trends") {
    if (resolved === "XK") {
      return "AL";
    }
    return resolved;
  }

  if (sourceType === "newsapi") {
    if (NEWSAPI_SUPPORTED_COUNTRIES.has(resolved)) {
      return resolved.toLowerCase();
    }
    return null;
  }

  return resolved;
};

const fetchRedditTrends = async ({ country, limit }) => {
  const response = await axios.get("https://www.reddit.com/r/all/top.json", {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    params: {
      limit,
      raw_json: 1,
      t: "day",
    },
    timeout: 15_000,
  });

  const items = (response.data?.data?.children || [])
    .map((entry) => entry?.data)
    .filter(Boolean)
    .map((post) =>
      normalizeSourceItem({
        country,
        sourceType: "reddit",
        sourceName: `Reddit r/${post.subreddit || "all"}`,
        externalId: post.id,
        title: post.title,
        url: post.permalink ? `https://www.reddit.com${post.permalink}` : post.url_overridden_by_dest,
        publishedAt: post.created_utc ? post.created_utc * 1000 : null,
        metrics: {
          comments: post.num_comments,
          score: post.score,
        },
        metadata: {
          author: post.author || null,
          comments: Number(post.num_comments || 0),
          over18: Boolean(post.over_18),
          score: Number(post.score || 0),
          subreddit: post.subreddit || "all",
        },
      })
    )
    .filter(Boolean);

  return {
    items,
    sourceName: "Reddit",
    sourceType: "reddit",
    success: true,
  };
};

const fetchHackerNewsTrends = async ({ country, limit }) => {
  const idsResponse = await axios.get("https://hacker-news.firebaseio.com/v0/topstories.json", {
    timeout: 15_000,
  });
  const ids = Array.isArray(idsResponse.data) ? idsResponse.data.slice(0, Math.max(limit * 2, 20)) : [];
  const stories = await Promise.all(
    ids.map((id) =>
      axios
        .get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
          timeout: 15_000,
        })
        .then((response) => response.data)
        .catch(() => null)
    )
  );

  const items = stories
    .filter((story) => story && story.type === "story" && story.title)
    .slice(0, limit)
    .map((story) =>
      normalizeSourceItem({
        country,
        sourceType: "hackernews",
        sourceName: "Hacker News",
        externalId: story.id,
        title: story.title,
        url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
        publishedAt: story.time ? story.time * 1000 : null,
        metrics: {
          comments: story.descendants,
          score: story.score,
        },
        metadata: {
          author: story.by || null,
          comments: Number(story.descendants || 0),
          score: Number(story.score || 0),
        },
      })
    )
    .filter(Boolean);

  return {
    items,
    sourceName: "Hacker News",
    sourceType: "hackernews",
    success: true,
  };
};

const extractRssBlocks = (xml = "") =>
  [...String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);

const extractFirstTag = (block = "", tagName = "") => {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = String(block || "").match(pattern);
  return match?.[1] ? normalizeText(match[1]) : null;
};

const fetchGoogleTrends = async ({ country, limit }) => {
  const geo = mapCountryCodeForSource("google_trends", country);
  const response = await axios.get("https://trends.google.com/trending/rss", {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "User-Agent": USER_AGENT,
    },
    params: {
      geo,
    },
    responseType: "text",
    timeout: 15_000,
  });

  const items = extractRssBlocks(response.data)
    .slice(0, limit)
    .map((block) =>
      normalizeSourceItem({
        country,
        sourceType: "google_trends",
        sourceName: "Google Trends",
        title: extractFirstTag(block, "title"),
        url: extractFirstTag(block, "link"),
        publishedAt: extractFirstTag(block, "pubDate"),
        metrics: {
          traffic: normalizeApproxTraffic(extractFirstTag(block, "ht:approx_traffic")),
        },
        metadata: {
          approxTraffic: extractFirstTag(block, "ht:approx_traffic"),
        },
      })
    )
    .filter(Boolean);

  return {
    items,
    sourceName: "Google Trends",
    sourceType: "google_trends",
    success: true,
  };
};

const fetchYoutubeTrending = async ({ country, limit }) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return {
      items: [],
      reason: "missing_api_key",
      sourceName: "YouTube Trending",
      sourceType: "youtube",
      success: false,
    };
  }

  const regionCode = mapCountryCodeForSource("youtube", country);
  const response = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
    params: {
      chart: "mostPopular",
      key: apiKey,
      maxResults: limit,
      part: "snippet,statistics",
      regionCode,
    },
    timeout: 20_000,
  });

  const items = (response.data?.items || [])
    .map((video) =>
      normalizeSourceItem({
        country,
        sourceType: "youtube",
        sourceName: "YouTube Trending",
        externalId: video.id,
        title: video.snippet?.title,
        url: video.id ? `https://www.youtube.com/watch?v=${video.id}` : null,
        publishedAt: video.snippet?.publishedAt,
        metrics: {
          comments: Number(video.statistics?.commentCount || 0),
          likes: Number(video.statistics?.likeCount || 0),
          views: Number(video.statistics?.viewCount || 0),
        },
        metadata: {
          channelTitle: video.snippet?.channelTitle || null,
          commentCount: Number(video.statistics?.commentCount || 0),
          likeCount: Number(video.statistics?.likeCount || 0),
          viewCount: Number(video.statistics?.viewCount || 0),
        },
      })
    )
    .filter(Boolean);

  return {
    items,
    sourceName: "YouTube Trending",
    sourceType: "youtube",
    success: true,
  };
};

const fetchNewsApiTrending = async ({ country, limit }) => {
  const apiKey = process.env.NEWSAPI_API_KEY;
  if (!apiKey) {
    return {
      items: [],
      reason: "missing_api_key",
      sourceName: "NewsAPI",
      sourceType: "newsapi",
      success: false,
    };
  }

  const newsApiCountry = mapCountryCodeForSource("newsapi", country);
  if (!newsApiCountry) {
    return {
      items: [],
      reason: "unsupported_country",
      sourceName: "NewsAPI",
      sourceType: "newsapi",
      success: false,
    };
  }

  const response = await axios.get("https://newsapi.org/v2/top-headlines", {
    headers: {
      "X-Api-Key": apiKey,
    },
    params: {
      country: newsApiCountry,
      pageSize: limit,
    },
    timeout: 20_000,
  });

  const items = (response.data?.articles || [])
    .map((article, index) =>
      normalizeSourceItem({
        country,
        sourceType: "newsapi",
        sourceName: article.source?.name || "NewsAPI",
        externalId: article.url || `newsapi_${index}`,
        title: article.title,
        url: article.url,
        publishedAt: article.publishedAt,
        metadata: {
          author: article.author || null,
          description: normalizeText(article.description || ""),
          source: article.source?.name || "NewsAPI",
        },
      })
    )
    .filter(Boolean);

  return {
    items,
    sourceName: "NewsAPI",
    sourceType: "newsapi",
    success: true,
  };
};

const fetchRssTrends = async ({ country, limit }) => {
  const result = await rssService.fetchNewsFromFeeds({
    country,
    limitPerFeed: Math.max(2, Math.ceil(limit / 2)),
    totalLimit: Math.max(limit, 8),
  });

  const items = (result.items || [])
    .slice(0, limit)
    .map((item) =>
      normalizeSourceItem({
        country,
        sourceType: "rss",
        sourceName: item.source || item.provider || "RSS",
        externalId: item.url || item.link || item.title,
        title: item.title,
        url: item.url || item.link,
        publishedAt: item.publishedAt,
        metadata: {
          provider: item.provider || item.source || "RSS",
          sourceUrl: item.sourceUrl || null,
        },
      })
    )
    .filter(Boolean);

  return {
    items,
    raw: result,
    sourceName: "RSS",
    sourceType: "rss",
    success: true,
  };
};

const dedupeTrendItems = (items = []) => {
  const unique = new Map();

  items.forEach((item) => {
    const existing = unique.get(item.fingerprint);
    if (!existing) {
      unique.set(item.fingerprint, item);
      return;
    }

    const currentRank =
      Number(existing.engagementScore || 0) +
      Number(existing.metadata?.commentCount || existing.metadata?.comments || 0) * 0.01;
    const nextRank =
      Number(item.engagementScore || 0) +
      Number(item.metadata?.commentCount || item.metadata?.comments || 0) * 0.01;

    if (nextRank > currentRank) {
      unique.set(item.fingerprint, item);
    }
  });

  return [...unique.values()];
};

const withUniquenessScores = (items = []) =>
  items.map((item, index) => {
    const currentTokens = tokenize(item.title);
    let maxSimilarity = 0;

    items.forEach((candidate, candidateIndex) => {
      if (candidateIndex === index) {
        return;
      }

      maxSimilarity = Math.max(maxSimilarity, jaccardSimilarity(currentTokens, tokenize(candidate.title)));
    });

    const uniquenessScore = Number(clamp((1 - maxSimilarity) * 10, 2.5, 10).toFixed(2));

    return {
      ...item,
      uniquenessScore,
    };
  });

const sortForSelection = (items = [], now = new Date()) =>
  [...items].sort((left, right) => {
    const leftRank =
      Number(left.engagementScore || 0) * 0.65 +
      computeRecencyScore(left.publishedAt, now) * 0.25 +
      Number(left.uniquenessScore || 0) * 0.1;
    const rightRank =
      Number(right.engagementScore || 0) * 0.65 +
      computeRecencyScore(right.publishedAt, now) * 0.25 +
      Number(right.uniquenessScore || 0) * 0.1;

    return rightRank - leftRank;
  });

const persistTrendItems = async (items = [], options = {}) => {
  const resolvedCountry = resolveCountryCode(options.country, DEFAULT_COUNTRY_CODE);
  const rows = items
    .filter((item) => item && item.fingerprint && item.title)
    .map((item) => ({
      ai_action: item.decisionBrief?.action || item.aiAction || null,
      ai_insight: item.decisionBrief?.summary || item.aiInsight || null,
      ai_question: item.generatedQuestion || item.aiQuestion || null,
      ai_risk: item.decisionBrief?.risk || item.aiRisk || null,
      category_id: item.categoryId || null,
      country: resolvedCountry,
      emotion_score: Number(item.factors?.emotion || item.emotionScore || 0),
      engagement_score: Number(item.factors?.engagement || item.engagementScore || 0),
      external_id: item.externalId || null,
      fingerprint: item.fingerprint,
      last_seen_at: new Date().toISOString(),
      metadata: {
        ...item.metadata,
        decisionBrief: item.decisionBrief || null,
        finalScore: item.finalScore ?? null,
        langCode: item.langCode || null,
        metrics: item.metrics || {},
        sentiment: item.sentiment || null,
        sourceType: item.sourceType || null,
      },
      published_at: item.publishedAt || null,
      recency_score: Number(item.factors?.recency || item.recencyScore || 0),
      source_name: item.sourceName || item.source || "Trend Source",
      source_type: item.sourceType || "unknown",
      title: item.title,
      uniqueness_score: Number(item.factors?.uniqueness || item.uniquenessScore || 0),
      updated_at: new Date().toISOString(),
      url: item.url || null,
      viral_score: Number(item.viralScore || 0),
    }));

  if (!rows.length) {
    return {
      saved: 0,
    };
  }

  await db("trend_source_items")
    .insert(rows)
    .onConflict(["country", "fingerprint"])
    .merge([
      "source_type",
      "source_name",
      "external_id",
      "title",
      "url",
      "published_at",
      "category_id",
      "engagement_score",
      "emotion_score",
      "recency_score",
      "uniqueness_score",
      "viral_score",
      "ai_question",
      "ai_insight",
      "ai_action",
      "ai_risk",
      "metadata",
      "last_seen_at",
      "updated_at",
    ]);

  return {
    saved: rows.length,
  };
};

const enrichTopTrendItems = async (items = [], options = {}) => {
  const resolvedCountry = resolveCountryCode(options.country, DEFAULT_COUNTRY_CODE);
  const langCode = resolveCountryLanguage(resolvedCountry, "en");
  const targetItems = [...items]
    .sort((left, right) => (right.finalScore || right.viralScore || 0) - (left.finalScore || left.viralScore || 0))
    .slice(0, AI_ENRICH_LIMIT);

  if (!targetItems.length) {
    return items;
  }

  const enriched = await Promise.all(
    targetItems.map(async (item) => {
      const [questionResult, decisionBrief] = await Promise.all([
        aiService
          .generateQuestionFromNews(item.title, langCode)
          .catch(() => ({ langCode, question: null })),
        aiService
          .generateNewsDecisionBrief({
            title: item.title,
            category: item.categoryLabel || item.categoryId || "general",
            country: resolvedCountry,
            langCode,
            sentiment: item.sentiment || null,
            viralScore: item.finalScore || item.viralScore || 0,
          })
          .catch(() => null),
      ]);

      return {
        ...item,
        aiInsight: decisionBrief?.summary || null,
        decisionBrief: decisionBrief || null,
        generatedQuestion: questionResult?.question || null,
        langCode,
      };
    })
  );

  const enrichedByFingerprint = new Map(enriched.map((item) => [item.fingerprint, item]));
  return items.map((item) => enrichedByFingerprint.get(item.fingerprint) || item);
};

const fetchTrendUniverse = async ({
  country = DEFAULT_COUNTRY_CODE,
  limitPerSource = DEFAULT_LIMIT_PER_SOURCE,
  totalLimit = DEFAULT_TOTAL_LIMIT,
} = {}) => {
  const resolvedCountry = resolveCountryCode(country, DEFAULT_COUNTRY_CODE);
  const safeLimitPerSource = Math.max(2, Math.min(20, Number(limitPerSource) || DEFAULT_LIMIT_PER_SOURCE));
  const safeTotalLimit = Math.max(5, Math.min(40, Number(totalLimit) || DEFAULT_TOTAL_LIMIT));
  const cacheKey = JSON.stringify({
    country: resolvedCountry,
    limitPerSource: safeLimitPerSource,
    totalLimit: safeTotalLimit,
  });
  const cached = getCachedValue(cacheKey);

  if (cached) {
    return {
      ...cached,
      cacheHit: true,
    };
  }

  const sourceTasks = [
    () => fetchRssTrends({ country: resolvedCountry, limit: safeLimitPerSource }),
    () => fetchRedditTrends({ country: resolvedCountry, limit: safeLimitPerSource }),
    () => fetchGoogleTrends({ country: resolvedCountry, limit: safeLimitPerSource }),
    () => fetchHackerNewsTrends({ country: resolvedCountry, limit: safeLimitPerSource }),
    () => fetchYoutubeTrending({ country: resolvedCountry, limit: safeLimitPerSource }),
    () => fetchNewsApiTrending({ country: resolvedCountry, limit: safeLimitPerSource }),
  ];

  const settled = await Promise.allSettled(sourceTasks.map((task) => task()));
  const sourceHealth = settled.map((result, index) => {
    const sourceNames = ["rss", "reddit", "google_trends", "hackernews", "youtube", "newsapi"];
    const sourceType = sourceNames[index];

    if (result.status === "fulfilled") {
      const value = result.value;
      return {
        count: value.items?.length || 0,
        reason: value.reason || null,
        sourceName: value.sourceName || sourceType,
        sourceType: value.sourceType || sourceType,
        success: Boolean(value.success),
      };
    }

    return {
      count: 0,
      reason: result.reason?.message || "source_failed",
      sourceName: sourceType,
      sourceType,
      success: false,
    };
  });

  const rawItems = settled.flatMap((result) =>
    result.status === "fulfilled" && Array.isArray(result.value.items) ? result.value.items : []
  );
  const deduped = dedupeTrendItems(rawItems);
  const withUniqueness = withUniquenessScores(deduped);
  const selected = sortForSelection(withUniqueness).slice(0, safeTotalLimit);

  await persistTrendItems(selected, { country: resolvedCountry });

  const payload = {
    cacheHit: false,
    country: resolvedCountry,
    deduplicated: rawItems.length - deduped.length,
    items: selected,
    sourceHealth,
    totalItems: selected.length,
    totalSources: sourceHealth.filter((item) => item.success).length,
  };

  return setCachedValue(cacheKey, payload);
};

module.exports = {
  AI_ENRICH_LIMIT,
  DEFAULT_LIMIT_PER_SOURCE,
  DEFAULT_TOTAL_LIMIT,
  computeRecencyScore,
  enrichTopTrendItems,
  fetchTrendUniverse,
  persistTrendItems,
};
