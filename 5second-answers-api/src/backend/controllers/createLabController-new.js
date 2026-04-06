const { creations, users } = require("../data/db");
const { v4: uuid } = require("uuid");

// 🧪 CREATE LAB CONTROLLERS
exports.createCreation = (req, res) => {
  const { userId, type, title, content, metadata } = req.body;

  if (!userId || !type || !title) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Validate creation type
  const validTypes = ["meme", "quote", "explanation", "hot_take"];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: "Invalid creation type" });
  }

  const creation = {
    id: uuid(),
    userId: userId || "demo_user",
    type,
    title: title.trim(),
    content: {
      imageUrl: content?.imageUrl || null,
      text: content?.text || null,
      stickers: content?.stickers || [],
      template: content?.template || null
    },
    interactions: {
      likes: 0,
      shares: 0,
      saves: 0
    },
    metadata: {
      editorMode: metadata?.editorMode || "meme",
      tools: metadata?.tools || [],
      isBold: metadata?.isBold || false
    },
    status: "published",
    createdAt: new Date()
  };

  creations.push(creation);
  res.json(creation);
};

exports.getCreations = (req, res) => {
  const { userId, type, limit = 20 } = req.query;
  
  let filtered = [...creations];
  
  // Filter by user
  if (userId) {
    filtered = filtered.filter(c => c.userId === userId);
  }
  
  // Filter by type
  if (type && type !== "all") {
    filtered = filtered.filter(c => c.type === type);
  }
  
  // Sort by creation date (newest first)
  filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  // Add user info
  filtered = filtered.map(creation => {
    const user = users.find(u => u.id === creation.userId);
    return {
      ...creation,
      user: {
        username: user?.username || "anonymous",
        avatar: user?.avatar || null
      }
    };
  });
  
  // Limit results
  const limited = filtered.slice(0, parseInt(limit));
  
  res.json(limited);
};

exports.getCreationById = (req, res) => {
  const { id } = req.params;
  
  const creation = creations.find(c => c.id === id);
  
  if (!creation) {
    return res.status(404).json({ error: "Creation not found" });
  }
  
  // Add user info
  const user = users.find(u => u.id === creation.userId);
  
  res.json({
    ...creation,
    user: {
      username: user?.username || "anonymous",
      avatar: user?.avatar || null
    }
  });
};

exports.interactWithCreation = (req, res) => {
  const { id } = req.params;
  const { type, userId } = req.body; // like, share, save
  
  if (!type || !["like", "share", "save"].includes(type)) {
    return res.status(400).json({ error: "Invalid interaction type" });
  }
  
  const creation = creations.find(c => c.id === id);
  
  if (!creation) {
    return res.status(404).json({ error: "Creation not found" });
  }
  
  // Update interaction count
  if (type === "like") {
    creation.interactions.likes += 1;
  } else if (type === "share") {
    creation.interactions.shares += 1;
  } else if (type === "save") {
    creation.interactions.saves += 1;
  }
  
  res.json({ 
    [type]: true, 
    [`${type}s`]: creation.interactions[type === "like" ? "likes" : type === "share" ? "shares" : "saves"] 
  });
};

// 💡 IDEA GENERATOR
exports.getRandomIdea = (req, res) => {
  const ideas = [
    "Explain Time Travel in 5s",
    "Hot Take: Money is everything", 
    "POV: You are WiFi signal",
    "Life hack in 5 seconds",
    "Unpopular opinion",
    "Quick tutorial",
    "Myth vs Fact",
    "Before vs After",
    "Explain quantum computing simply",
    "Why cats are superior",
    "Coffee addiction is real",
    "Monday motivation",
    "Tech life hacks",
    "Relationship advice in 5s",
    "Cooking tips for beginners"
  ];
  
  const randomIndex = Math.floor(Math.random() * ideas.length);
  const idea = ideas[randomIndex];
  
  res.json({
    idea,
    timestamp: new Date(),
    totalIdeas: ideas.length
  });
};

// 🎨 TEMPLATES
exports.getTemplates = (req, res) => {
  const templates = [
    {
      id: "meme-template-1",
      name: "Classic Meme",
      preview: "https://via.placeholder.com/300x200/ff4444/ffffff?text=MEME",
      category: "meme"
    },
    {
      id: "quote-template-1", 
      name: "Inspiration Quote",
      preview: "https://via.placeholder.com/300x200/4444ff/ffffff?text=QUOTE",
      category: "quote"
    },
    {
      id: "explanation-template-1",
      name: "Knowledge Card", 
      preview: "https://via.placeholder.com/300x200/44ff44/ffffff?text=EXPLAIN",
      category: "explanation"
    },
    {
      id: "hot-take-template-1",
      name: "Hot Take",
      preview: "https://via.placeholder.com/300x200/ff8800/ffffff?text=HOT",
      category: "hot_take"
    }
  ];
  
  res.json(templates);
};

// 🔥 STICKERS
exports.getStickers = (req, res) => {
  const stickers = [
    { id: "fire", emoji: "🔥", category: "trending", name: "Fire" },
    { id: "mind_blown", emoji: "😳", category: "reaction", name: "Mind Blown" },
    { id: "brain", emoji: "🧠", category: "smart", name: "Brain" },
    { id: "hundred", emoji: "💯", category: "perfect", name: "100" },
    { id: "target", emoji: "🎯", category: "focus", name: "Target" },
    { id: "lightning", emoji: "⚡", category: "energy", name: "Lightning" },
    { id: "rocket", emoji: "🚀", category: "success", name: "Rocket" },
    { id: "diamond", emoji: "💎", category: "premium", name: "Diamond" },
    { id: "crystal", emoji: "🔮", category: "magic", name: "Crystal" },
    { id: "palette", emoji: "🎨", category: "creative", name: "Palette" }
  ];
  
  res.json(stickers);
};
