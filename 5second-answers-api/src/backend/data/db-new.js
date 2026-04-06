// src/backend/data/db.js
const { v4: uuid } = require("uuid");

// 🧱 ENTITETET KRYESORE (V1 – MVP i fortë)
const users = [
  {
    id: uuid(),
    username: "demo_user",
    email: "demo@5second.app",
    avatar: null,
    stats: {
      answersGiven: 0,
      likesReceived: 0,
      questionsAsked: 0
    },
    badges: [],
    ranking: 1,
    createdAt: new Date()
  }
];

const questions = [
  {
    id: uuid(),
    text: "How do you make coffee?",
    category: "lifestyle",
    userId: users[0].id,
    views: 0,
    status: "active", // active, closed, moderated
    aiReviewed: true,
    metadata: {
      language: "en",
      difficulty: "easy"
    },
    createdAt: new Date()
  }
];

const answers = [
  {
    id: uuid(),
    questionId: questions[0].id,
    userId: users[0].id,
    type: "video", // video, audio, text
    contentUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    text: null,
    duration: 5, // seconds
    interactions: {
      likes: 0,
      views: 0,
      saves: 0
    },
    aiReview: {
      approved: true,
      feedback: "Good explanation",
      score: 0.9
    },
    status: "approved", // pending, approved, rejected
    createdAt: new Date()
  }
];

// 🧪 CREATE LAB - Krijimet e reja
const creations = [
  {
    id: uuid(),
    userId: users[0].id,
    type: "meme", // meme, quote, explanation, hot_take
    title: "When coffee hits different",
    content: {
      imageUrl: null,
      text: "POV: You just had your first coffee of the day",
      stickers: ["⚡", "🔥"],
      template: "meme-template-1"
    },
    interactions: {
      likes: 0,
      shares: 0,
      saves: 0
    },
    metadata: {
      editorMode: "meme",
      tools: ["text", "stickers"],
      isBold: true
    },
    status: "published",
    createdAt: new Date()
  }
];

const interactions = []; // likes, saves, shares
const comments = [];

module.exports = {
  users,
  questions,
  answers,
  creations,
  interactions,
  comments
};
