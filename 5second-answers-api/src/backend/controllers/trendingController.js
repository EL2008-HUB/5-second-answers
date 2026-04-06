const { v4: uuid } = require("uuid");
const { db } = require("../data/db");
const { ensureUser, formatQuestion } = require("../data/helpers");
const { DEFAULT_COUNTRY_CODE, resolveCountryCode } = require("../config/countryConfig");
const newsTrendingService = require("../services/newsTrendingService");
const aiCopilotService = require("../services/aiCopilotService");

// 🔥 TRENDING CONTROLLERS

// Mock data for trending topics
const TRENDING_TOPICS = [
  {
    id: "tech_life",
    title: "Tech Life Hacks",
    description: "Quick tech tips that save time",
    participants: 15420,
    growth: "+23%",
    icon: "💻",
    color: "#00bcd4",
    posts: 342,
    trending: true,
    category: "technology"
  },
  {
    id: "coffee_talk",
    title: "Coffee Talk",
    description: "Everything about coffee culture",
    participants: 12350,
    growth: "+18%",
    icon: "☕",
    color: "#8b4513",
    posts: 289,
    trending: true,
    category: "lifestyle"
  },
  {
    id: "5s_learning",
    title: "5-Second Learning",
    description: "Learn anything in 5 seconds",
    participants: 28930,
    growth: "+45%",
    icon: "🎯",
    color: "#ff4444",
    posts: 567,
    trending: true,
    category: "education"
  },
  {
    id: "meme_battle",
    title: "Meme Battle",
    description: "Best memes win the day",
    participants: 45620,
    growth: "+67%",
    icon: "😂",
    color: "#ff00ff",
    posts: 892,
    trending: true,
    category: "entertainment"
  }
];

// Mock data for viral challenges
const VIRAL_CHALLENGES = [
  {
    id: "explain_like_im_5",
    title: "Explain Like I'm 5",
    description: "Break down complex topics simply",
    hashtag: "#ExplainLikeIm5",
    participants: 8934,
    daysLeft: 3,
    prize: "🏆 Viral Creator Badge",
    difficulty: "Easy",
    entries: [
      { username: "TechGuru", content: "Quantum computing is like magic math", likes: 234 },
      { username: "ScienceKid", content: "Black holes are cosmic vacuum cleaners", likes: 189 }
    ],
    status: "active",
    category: "education"
  },
  {
    id: "hot_take_challenge",
    title: "Hot Take Challenge",
    description: "Share your most controversial opinions",
    hashtag: "#HotTakeChallenge",
    participants: 15670,
    daysLeft: 5,
    prize: "💎 500 Points",
    difficulty: "Medium",
    entries: [
      { username: "TruthTeller", content: "Pineapple belongs on pizza", likes: 567 },
      { username: "RebelMind", content: "Meetings are a waste of time", likes: 423 }
    ],
    status: "active",
    category: "opinion"
  },
  {
    id: "speed_create",
    title: "Speed Create",
    description: "Create something amazing in 5 seconds",
    hashtag: "#SpeedCreate",
    participants: 23450,
    daysLeft: 2,
    prize: "⚡ Speed Demon Badge",
    difficulty: "Hard",
    entries: [
      { username: "QuickArtist", content: "Drew a masterpiece in 5s", likes: 892 },
      { username: "FlashThinker", content: "Solved riddle instantly", likes: 756 }
    ],
    status: "active",
    category: "creative"
  }
];

// Get trending topics
exports.getTrendingTopics = (req, res) => {
  const { category, limit = 20 } = req.query;
  
  let filtered = [...TRENDING_TOPICS];
  
  if (category && category !== "all") {
    filtered = filtered.filter(topic => topic.category === category);
  }
  
  // Sort by participants and growth
  filtered.sort((a, b) => {
    const scoreA = a.participants * (1 + parseInt(a.growth) / 100);
    const scoreB = b.participants * (1 + parseInt(b.growth) / 100);
    return scoreB - scoreA;
  });
  
  res.json({
    topics: filtered.slice(0, parseInt(limit)),
    total: filtered.length
  });
};

// Get viral challenges
exports.getViralChallenges = (req, res) => {
  const { status = "active", difficulty, limit = 20 } = req.query;
  
  let filtered = [...VIRAL_CHALLENGES];
  
  if (status !== "all") {
    filtered = filtered.filter(challenge => challenge.status === status);
  }
  
  if (difficulty && difficulty !== "all") {
    filtered = filtered.filter(challenge => challenge.difficulty === difficulty);
  }
  
  // Sort by participants
  filtered.sort((a, b) => b.participants - a.participants);
  
  res.json({
    challenges: filtered.slice(0, parseInt(limit)),
    total: filtered.length
  });
};

// Join a challenge
exports.joinChallenge = (req, res) => {
  const { challengeId } = req.params;
  const { userId } = req.body;
  
  const challenge = VIRAL_CHALLENGES.find(c => c.id === challengeId);
  
  if (!challenge) {
    return res.status(404).json({ error: "Challenge not found" });
  }
  
  // Simulate joining challenge
  challenge.participants += 1;
  
  res.json({
    success: true,
    challenge: {
      id: challenge.id,
      title: challenge.title,
      hashtag: challenge.hashtag,
      joinedAt: new Date()
    }
  });
};

// Submit challenge entry
exports.submitChallengeEntry = (req, res) => {
  const { challengeId } = req.params;
  const { userId, content, type } = req.body;
  
  const challenge = VIRAL_CHALLENGES.find(c => c.id === challengeId);
  
  if (!challenge) {
    return res.status(404).json({ error: "Challenge not found" });
  }
  
  const entry = {
    id: uuid(),
    userId,
    username: "demo_user", // Would get from user data
    content,
    type: type || "text",
    likes: 0,
    createdAt: new Date(),
    status: "submitted"
  };
  
  challenge.entries.push(entry);
  
  res.json({
    success: true,
    entry,
    challenge: {
      id: challenge.id,
      title: challenge.title
    }
  });
};

// Get trending content
exports.getTrendingContent = (req, res) => {
  const { type, category, timeRange = "day", limit = 50 } = req.query;
  
  // Mock trending content data
  const trendingContent = [
    {
      id: "1",
      type: "video",
      title: "How to code in 5 seconds",
      creator: "CodeMaster",
      creatorId: "user1",
      thumbnail: "https://via.placeholder.com/300x400/333/fff?text=CODE",
      views: 45670,
      likes: 2340,
      shares: 567,
      trend: "🔥 Trending #1",
      category: "Tech",
      hashtags: ["#coding", "#tech", "#5seconds"],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      growth: "+125%"
    },
    {
      id: "2",
      type: "meme",
      title: "When coffee kicks in",
      creator: "MemeLord",
      creatorId: "user2",
      thumbnail: "https://via.placeholder.com/300x400/8b4513/fff?text=COFFEE",
      views: 38920,
      likes: 1923,
      shares: 445,
      trend: "📈 Rising Fast",
      category: "Lifestyle",
      hashtags: ["#coffee", "#memes", "#relatable"],
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      growth: "+89%"
    },
    {
      id: "3",
      type: "text",
      title: "Life hack that changed everything",
      creator: "LifeGuru",
      creatorId: "user3",
      thumbnail: "https://via.placeholder.com/300x400/4caf50/fff?text=LIFE",
      views: 29840,
      likes: 1567,
      shares: 234,
      trend: "⚡ Viral",
      category: "Life",
      hashtags: ["#lifehack", "#tips", "#productivity"],
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      growth: "+67%"
    },
    {
      id: "4",
      type: "video",
      title: "Quantum physics explained simply",
      creator: "ScienceKid",
      creatorId: "user4",
      thumbnail: "https://via.placeholder.com/300x400/2196f3/fff?text=SCIENCE",
      views: 23450,
      likes: 1234,
      shares: 189,
      trend: "🧠 Smart Content",
      category: "Education",
      hashtags: ["#science", "#physics", "#learning"],
      createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      growth: "+45%"
    }
  ];
  
  let filtered = [...trendingContent];
  
  if (type && type !== "all") {
    filtered = filtered.filter(content => content.type === type);
  }
  
  if (category && category !== "all") {
    filtered = filtered.filter(content => content.category === category);
  }
  
  // Sort by engagement (likes + shares + views/10)
  filtered.sort((a, b) => {
    const scoreA = a.likes + a.shares + a.views / 10;
    const scoreB = b.likes + b.shares + b.views / 10;
    return scoreB - scoreA;
  });
  
  res.json({
    content: filtered.slice(0, parseInt(limit)),
    total: filtered.length,
    timeRange
  });
};

// Get challenge details
exports.getChallengeDetails = (req, res) => {
  const { challengeId } = req.params;
  
  const challenge = VIRAL_CHALLENGES.find(c => c.id === challengeId);
  
  if (!challenge) {
    return res.status(404).json({ error: "Challenge not found" });
  }
  
  // Add additional details
  const challengeDetails = {
    ...challenge,
    rules: [
      "Content must be original",
      "Must follow the theme exactly",
      "Maximum 5 seconds for videos",
      "Maximum 10 words for text",
      "No inappropriate content"
    ],
    prizes: [
      { type: "badge", name: challenge.prize, rarity: "epic" },
      { type: "points", amount: 100 },
      { type: "recognition", description: "Featured on trending page" }
    ],
    judgingCriteria: [
      "Creativity (40%)",
      "Engagement (30%)",
      "Originality (20%)",
      "Technical quality (10%)"
    ]
  };
  
  res.json(challengeDetails);
};

// Get topic details
exports.getTopicDetails = (req, res) => {
  const { topicId } = req.params;
  
  const topic = TRENDING_TOPICS.find(t => t.id === topicId);
  
  if (!topic) {
    return res.status(404).json({ error: "Topic not found" });
  }
  
  // Add additional details
  const topicDetails = {
    ...topic,
    description: "Everything you need to know about " + topic.title.toLowerCase(),
    topContributors: [
      { username: "ExpertUser", contributions: 45, likes: 2340 },
      { username: "ProCreator", contributions: 38, likes: 1890 },
      { username: "TopMind", contributions: 32, likes: 1567 }
    ],
    relatedTopics: TRENDING_TOPICS
      .filter(t => t.id !== topicId && t.category === topic.category)
      .slice(0, 3),
    hashtags: [`#${topic.title.replace(/\s+/g, '')}`, `#${topic.category}`, "#trending"]
  };
  
  res.json(topicDetails);
};

exports.detectHotNews = async (req, res) => {
  const { country, limit, news = [], threshold } = req.body || {};
  const resolvedCountry = resolveCountryCode(country, DEFAULT_COUNTRY_CODE);

  try {
    const scored = await newsTrendingService.scoreNewsListWithAi(news);
    const selected = newsTrendingService.pickHotNews(scored, {
      limit,
      threshold,
    });

    return res.json({
      country: resolvedCountry,
      currentHot: await newsTrendingService.findCurrentHotQuestion(resolvedCountry),
      selected,
      threshold: Number.isFinite(Number(threshold)) ? Number(threshold) : 0.58,
      totalCandidates: Array.isArray(news) ? news.length : 0,
      totalSelected: selected.length,
      scored,
    });
  } catch (error) {
    console.error("Detect hot news error:", error);
    return res.status(400).json({ error: error.message || "Failed to detect hot news" });
  }
};

exports.createHotQuestionsFromNews = async (req, res) => {
  const {
    category,
    country,
    expiresInMinutes,
    langCode,
    limit,
    news = [],
    sendNotification = true,
    threshold,
  } = req.body || {};
  const resolvedCountry = resolveCountryCode(country, DEFAULT_COUNTRY_CODE);

  try {
    const result = await newsTrendingService.detectAndCreateHotQuestions(news, {
      category,
      country: resolvedCountry,
      expiresInMinutes,
      langCode,
      limit,
      sendNotification,
      threshold,
    });

    void aiCopilotService
      .processEvent({
        eventType: "trending_scan",
        content: news,
        metadata: {
          expiresInMinutes,
          limit,
          threshold,
        },
      })
      .catch((copilotError) => {
        console.warn("[AI Copilot] trending_scan hook failed:", copilotError.message);
      });

    return res.status(201).json(result);
  } catch (error) {
    console.error("Create hot questions from news error:", error);
    return res.status(400).json({ error: error.message || "Failed to create hot questions" });
  }
};

exports.fetchLiveNews = async (req, res) => {
  const {
    country,
    limitPerCategory = 2,
    limitPerFeed = 5,
    limitPerSource,
    totalLimit,
    preferredCategories,
  } = req.query;
  const resolvedCountry = resolveCountryCode(country, DEFAULT_COUNTRY_CODE);

  try {
    const preferredCategoryList = String(preferredCategories || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const result = await newsTrendingService.fetchAndScoreNewsFromFeeds({
      country: resolvedCountry,
      limitPerCategory,
      limitPerFeed: limitPerSource || limitPerFeed,
      totalLimit,
      preferredCategories: preferredCategoryList,
    });

    return res.json(result);
  } catch (error) {
    console.error("Fetch live news error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch live news" });
  }
};

exports.getDailyBrain = async (req, res) => {
  const { country, interests, preferredCategories, userId = null } = req.query;
  const resolvedCountry = resolveCountryCode(country, DEFAULT_COUNTRY_CODE);

  try {
    const result = await newsTrendingService.getPersonalizedDailyBrain({
      country: resolvedCountry,
      interests,
      preferredCategories,
      userId,
    });

    return res.json(result);
  } catch (error) {
    console.error("Get daily brain error:", error);
    return res.status(500).json({ error: error.message || "Failed to build daily brain" });
  }
};

exports.runLiveNewsHotQuestionJob = async (req, res) => {
  const {
    country,
    expiresInMinutes,
    langCode,
    limit = 1,
    limitPerFeed = 5,
    limitPerSource,
    threshold = 5,
    totalLimit,
  } = req.body || {};
  const resolvedCountry = resolveCountryCode(country, DEFAULT_COUNTRY_CODE);

  try {
    const result = await newsTrendingService.fetchDetectAndCreateFromFeeds({
      country: resolvedCountry,
      expiresInMinutes,
      langCode,
      limit,
      limitPerFeed: limitPerSource || limitPerFeed,
      sendNotification: true,
      threshold,
      totalLimit,
    });

    void aiCopilotService
      .processEvent({
        eventType: "trending_scan",
        content: result.fetchedItems || [],
        metadata: {
          expiresInMinutes,
          from: "live_news_job",
          limit,
          limitPerFeed,
          threshold,
        },
      })
      .catch((copilotError) => {
        console.warn("[AI Copilot] live news hook failed:", copilotError.message);
      });

    return res.status(201).json(result);
  } catch (error) {
    console.error("Run live news hot question job error:", error);
    return res.status(500).json({ error: error.message || "Failed to run live news job" });
  }
};

exports.runMultiCountryHotQuestionJob = async (req, res) => {
  const {
    expiresInMinutes,
    langCode,
    limit = 1,
    limitPerFeed = 5,
    limitPerSource,
    threshold = 5,
    totalLimit,
  } = req.body || {};

  try {
    const result = await newsTrendingService.runMultiCountryTrendingJob({
      expiresInMinutes,
      langCode,
      limit,
      limitPerFeed: limitPerSource || limitPerFeed,
      sendNotification: true,
      threshold,
      totalLimit,
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error("Run multi-country live news job error:", error);
    return res.status(500).json({ error: error.message || "Failed to run multi-country live news job" });
  }
};

exports.getHotQuestionInsights = async (req, res) => {
  try {
    const insights = await newsTrendingService.getHotQuestionInsights(req.params.questionId);
    return res.json(insights);
  } catch (error) {
    console.error("Get hot question insights error:", error);
    return res.status(500).json({ error: error.message || "Failed to get hot question insights" });
  }
};

exports.getLaunchPack = async (req, res) => {
  try {
    const country = resolveCountryCode(req.query.country, DEFAULT_COUNTRY_CODE);
    const nowIso = new Date().toISOString();
    const [hotQuestion, dailyQuestion] = await Promise.all([
      newsTrendingService.findCurrentHotQuestion(country),
      db("questions")
        .where({ country, is_daily: true, status: "active" })
        .andWhere("expires_at", ">", nowIso)
        .orderBy("expires_at", "asc")
        .first(),
    ]);

    return res.json({
      country,
      dailyQuestion: dailyQuestion ? formatQuestion(dailyQuestion) : null,
      hotQuestion: hotQuestion ? formatQuestion(hotQuestion) : null,
      prompts: [
        "A e kuptove menjehere?",
        "A do ktheheshe?",
      ],
    });
  } catch (error) {
    console.error("Get launch pack error:", error);
    return res.status(500).json({ error: "Failed to load launch pack" });
  }
};

exports.submitLaunchFeedback = async (req, res) => {
  const {
    userId = null,
    hotQuestionId = null,
    dailyQuestionId = null,
    understoodImmediately = false,
    wouldReturn = false,
    notes = "",
  } = req.body || {};

  try {
    const actor = userId ? await ensureUser(userId) : null;
    const [row] = await db("launch_feedback")
      .insert({
        daily_question_id: dailyQuestionId,
        hot_question_id: hotQuestionId,
        notes: String(notes || "").trim() || null,
        understood_immediately: Boolean(understoodImmediately),
        user_id: actor?.id || null,
        would_return: Boolean(wouldReturn),
      })
      .returning("*");

    return res.status(201).json({
      feedback: row,
      success: true,
    });
  } catch (error) {
    console.error("Submit launch feedback error:", error);
    return res.status(500).json({ error: "Failed to save launch feedback" });
  }
};
