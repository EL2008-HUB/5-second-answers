const axios = require("axios");
const { DEFAULT_COUNTRY_CODE, resolveCountryCode } = require("../config/countryConfig");

const COUNTRY_FEEDS = {
  AL: [
    { source: "Panorama", url: "https://www.panorama.com.al/feed" },
    { source: "Top Channel", url: "https://www.top-channel.tv/feed/" },
    { source: "BalkanWeb", url: "https://www.balkanweb.com/feed/" },
  ],
  XK: [
    { source: "Gazeta Express", url: "https://www.gazetaexpress.com/feed/" },
    { source: "KOHA", url: "https://www.koha.net/rss/" },
    { source: "Telegrafi", url: "https://telegrafi.com/feed/" },
  ],
  GB: [
    { source: "BBC UK", url: "https://feeds.bbci.co.uk/news/rss.xml" },
    { source: "The Guardian UK", url: "https://www.theguardian.com/uk/rss" },
    { source: "Sky News", url: "https://feeds.skynews.com/feeds/rss/home.xml" },
  ],
  US: [
    { source: "CNN", url: "http://rss.cnn.com/rss/edition.rss" },
    { source: "NYTimes Home", url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml" },
    { source: "Fox News", url: "https://moxie.foxnews.com/google-publisher/latest.xml" },
  ],
  DE: [
    { source: "Tagesschau", url: "https://www.tagesschau.de/xml/rss2" },
    { source: "DW", url: "https://rss.dw.com/rdf/rss-en-all" },
    { source: "Spiegel", url: "https://www.spiegel.de/international/index.rss" },
  ],
  FR: [
    { source: "Le Monde", url: "https://www.lemonde.fr/en/rss/une.xml" },
    { source: "France24", url: "https://www.france24.com/en/rss" },
    { source: "Le Figaro", url: "https://www.lefigaro.fr/rss/figaro_actualites.xml" },
  ],
  IT: [
    { source: "ANSA", url: "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml" },
    { source: "La Repubblica", url: "https://www.repubblica.it/rss/homepage/rss2.0.xml" },
    { source: "Corriere", url: "https://xml2.corriereobjects.it/rss/homepage.xml" },
  ],
  ES: [
    { source: "El Pais", url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada" },
    { source: "20 Minutos", url: "https://www.20minutos.es/rss/" },
    { source: "El Mundo", url: "https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml" },
  ],
  TR: [
    { source: "Daily Sabah", url: "https://www.dailysabah.com/rss" },
    { source: "Hurriyet", url: "https://www.hurriyetdailynews.com/rss/homepage" },
    { source: "Anadolu", url: "https://www.aa.com.tr/en/rss/default?cat=guncel" },
  ],
  BR: [
    { source: "G1", url: "https://g1.globo.com/rss/g1/" },
    { source: "UOL", url: "https://rss.uol.com.br/feed/noticias.xml" },
    { source: "CNN Brasil", url: "https://www.cnnbrasil.com.br/feed/" },
  ],
  IN: [
    { source: "India Today", url: "https://www.indiatoday.in/rss/home" },
    { source: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories" },
    { source: "The Hindu", url: "https://www.thehindu.com/news/feeder/default.rss" },
  ],
  JP: [
    { source: "NHK World", url: "https://www3.nhk.or.jp/rss/news/cat0.xml" },
    { source: "Japan Times", url: "https://www.japantimes.co.jp/feed/topstories/" },
    { source: "Kyodo", url: "https://english.kyodonews.net/rss/news.xml" },
  ],
};

const DEFAULT_FEEDS = COUNTRY_FEEDS[DEFAULT_COUNTRY_CODE];

const USER_AGENT =
  process.env.RSS_NEWS_USER_AGENT ||
  "Mozilla/5.0 (compatible; 5SecondAnswerBot/1.0; +https://5second.app)";
const RSS_CACHE_TTL_MS = Math.max(30_000, Number(process.env.RSS_CACHE_TTL_MS || 120_000));
const RSS_TOTAL_LIMIT = Math.max(1, Math.min(20, Number(process.env.RSS_TOTAL_LIMIT || 20)));
const rssCache = new Map();

const getCountryFeeds = (countryCode) => COUNTRY_FEEDS[resolveCountryCode(countryCode)] || DEFAULT_FEEDS;

const decodeEntities = (value = "") =>
  String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const firstMatch = (pattern, text) => {
  const match = String(text || "").match(pattern);
  return match?.[1] ? decodeEntities(match[1]) : null;
};

const normalizeComparable = (value = "") =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildItemFingerprint = (item = {}) => {
  const urlKey = String(item.url || item.link || "").trim().toLowerCase();
  if (urlKey) {
    return `url:${urlKey}`;
  }

  return `title:${normalizeComparable(item.title)}`;
};

const buildRequestCacheKey = ({ feeds = [], limitPerFeed = 5, totalLimit = RSS_TOTAL_LIMIT }) =>
  JSON.stringify({
    feeds: feeds.map((feed) => `${feed.source}:${feed.url}`),
    limitPerFeed,
    totalLimit,
  });

const extractItems = (xml = "") => {
  const rssItems = [...String(xml).matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  if (rssItems.length) {
    return rssItems.map((block) => ({
      link:
        firstMatch(/<link>([\s\S]*?)<\/link>/i, block) ||
        firstMatch(/<guid[^>]*>([\s\S]*?)<\/guid>/i, block),
      publishedAt:
        firstMatch(/<pubDate>([\s\S]*?)<\/pubDate>/i, block) ||
        firstMatch(/<dc:date>([\s\S]*?)<\/dc:date>/i, block),
      title: firstMatch(/<title>([\s\S]*?)<\/title>/i, block),
    }));
  }

  const atomItems = [...String(xml).matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((match) => match[0]);
  return atomItems.map((block) => {
    const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);

    return {
      link: hrefMatch?.[1] ? decodeEntities(hrefMatch[1]) : null,
      publishedAt:
        firstMatch(/<updated>([\s\S]*?)<\/updated>/i, block) ||
        firstMatch(/<published>([\s\S]*?)<\/published>/i, block),
      title: firstMatch(/<title[^>]*>([\s\S]*?)<\/title>/i, block),
    };
  });
};

const normalizeFeedItem = (item, feed) => {
  const title = decodeEntities(item.title);
  if (!title) {
    return null;
  }

  const publishedDate = item.publishedAt ? new Date(item.publishedAt) : null;

  return {
    link: item.link || null,
    provider: feed.source,
    publishedAt:
      publishedDate && !Number.isNaN(publishedDate.getTime())
        ? publishedDate.toISOString()
        : null,
    source: feed.source,
    sourceUrl: feed.url,
    title,
    url: item.link || null,
  };
};

const fetchFeed = async (feed, limitPerFeed = 5) => {
  try {
    const response = await axios.get(feed.url, {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
        "User-Agent": USER_AGENT,
      },
      responseType: "text",
      timeout: 20_000,
    });

    const items = extractItems(response.data)
      .map((item) => normalizeFeedItem(item, feed))
      .filter(Boolean)
      .slice(0, Math.max(1, limitPerFeed));

    return {
      items,
      source: feed.source,
      success: true,
      url: feed.url,
    };
  } catch (error) {
    return {
      error: error.message,
      items: [],
      source: feed.source,
      success: false,
      url: feed.url,
    };
  }
};

const dedupeFeedItems = (items = []) => {
  const unique = new Map();

  items.forEach((item) => {
    const fingerprint = buildItemFingerprint(item);
    if (!fingerprint || unique.has(fingerprint)) {
      return;
    }

    unique.set(fingerprint, item);
  });

  return [...unique.values()];
};

const fetchNewsFromFeeds = async ({
  country = DEFAULT_COUNTRY_CODE,
  feeds,
  limitPerFeed = 5,
  totalLimit = RSS_TOTAL_LIMIT,
} = {}) => {
  const resolvedCountry = resolveCountryCode(country);
  const resolvedFeeds = Array.isArray(feeds) && feeds.length ? feeds : getCountryFeeds(resolvedCountry);
  const safeTotalLimit = Math.max(1, Math.min(RSS_TOTAL_LIMIT, Number(totalLimit) || RSS_TOTAL_LIMIT));
  const safeLimitPerFeed = Math.max(1, Math.min(8, Number(limitPerFeed) || 5));
  const cacheKey = buildRequestCacheKey({
    feeds: resolvedFeeds,
    limitPerFeed: safeLimitPerFeed,
    totalLimit: safeTotalLimit,
  });
  const cached = rssCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < RSS_CACHE_TTL_MS) {
    return {
      ...cached.payload,
      cacheHit: true,
    };
  }

  const results = await Promise.all(resolvedFeeds.map((feed) => fetchFeed(feed, safeLimitPerFeed)));
  const dedupedItems = dedupeFeedItems(results.flatMap((result) => result.items))
    .sort((left, right) => {
      const leftTime = left.publishedAt ? new Date(left.publishedAt).getTime() : 0;
      const rightTime = right.publishedAt ? new Date(right.publishedAt).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, safeTotalLimit);

  const payload = {
    cacheHit: false,
    country: resolvedCountry,
    deduplicated: results.flatMap((result) => result.items).length - dedupedItems.length,
    feeds: results,
    items: dedupedItems,
    totalItems: dedupedItems.length,
    totalSources: results.filter((result) => result.success).length,
  };

  rssCache.set(cacheKey, {
    fetchedAt: Date.now(),
    payload,
  });

  return payload;
};

module.exports = {
  COUNTRY_FEEDS,
  DEFAULT_FEEDS,
  fetchNewsFromFeeds,
  getCountryFeeds,
};
