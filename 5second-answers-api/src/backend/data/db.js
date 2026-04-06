// src/backend/data/db.js
// PostgreSQL connection with Knex.js ORM
const knex = require('knex');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const { v4: uuid } = require("uuid");

// Database configuration
const dbConfig = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || '5secondanswers'
  },
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    extension: 'js'
  },
  seeds: {
    directory: path.join(__dirname, 'seeds'),
    extension: 'js'
  }
};

// Initialize Knex connection
const db = knex(dbConfig);

// Test connection on startup
db.raw('SELECT 1')
  .then(() => console.log('✅ PostgreSQL connected successfully'))
  .catch(err => {
    console.error('❌ PostgreSQL connection failed:', err.message);
    process.exit(1);
  });

// Table queries - returning functions for lazy evaluation
const tables = {
  // Questions
  createQuestion: (data) => db('questions').insert(data).returning('*'),
  getQuestions: () => db('questions').orderBy('createdAt', 'desc'),
  getQuestionById: (id) => db('questions').where({ id }).first(),
  getQuestionsByCategory: (category) => db('questions').where({ category }).orderBy('createdAt', 'desc'),
  updateQuestion: (id, data) => db('questions').where({ id }).update(data).returning('*'),
  incrementQuestionViews: (id) => db('questions').where({ id }).increment('views', 1).returning('*'),

  // Answers
  createAnswer: (data) => db('answers').insert(data).returning('*'),
  getAnswers: () => db('answers').orderBy('createdAt', 'desc'),
  getAnswerById: (id) => db('answers').where({ id }).first(),
  getAnswersByQuestion: (questionId) => db('answers').where({ questionId, status: 'approved' }).orderBy('createdAt', 'desc'),
  getAnswersByUser: (userId) => db('answers').where({ userId }).orderBy('createdAt', 'desc'),
  getPendingAnswers: () => db('answers').where({ status: 'pending' }).orderBy('createdAt', 'asc'),
  updateAnswer: (id, data) => db('answers').where({ id }).update(data).returning('*'),
  updateAnswerStatus: (id, status) => db('answers').where({ id }).update({ status, updatedAt: new Date() }).returning('*'),

  // Users
  createUser: (data) => db('users').insert(data).returning('*'),
  getUsers: () => db('users').orderBy('createdAt', 'desc'),
  getUserById: (id) => db('users').where({ id }).first(),
  getUserByUsername: (username) => db('users').where({ username }).first(),
  updateUser: (id, data) => db('users').where({ id }).update(data).returning('*'),
  incrementUserStats: (userId, field, amount = 1) => 
    db('users').where({ id: userId }).increment(field, amount).returning('*'),

  // Interactions (likes, views, saves)
  createInteraction: (data) => db('interactions').insert(data).returning('*'),
  getInteractionsByAnswer: (answerId) => db('interactions').where({ answerId }),
  getInteractionsByUser: (userId) => db('interactions').where({ userId }),
  getInteraction: (answerId, userId, type) => 
    db('interactions').where({ answerId, userId, type }).first(),
  deleteInteraction: (id) => db('interactions').where({ id }).del(),
  getInteractionStats: (answerId) => 
    db('interactions')
      .where({ answerId })
      .select('type')
      .count('* as count')
      .groupBy('type'),

  // Badges
  createBadge: (data) => db('badges').insert(data).returning('*'),
  getBadges: () => db('badges').orderBy('order', 'asc'),
  getBadgeById: (id) => db('badges').where({ id }).first(),
  getUserBadges: (userId) => db('user_badges').where({ userId }).join('badges', 'badges.id', 'user_badges.badge_id'),
  awardBadge: (userId, badgeId) => db('user_badges').insert({ userId, badgeId, earnedAt: new Date() }).returning('*'),
  revokeBadge: (userId, badgeId) => db('user_badges').where({ userId, badge_id: badgeId }).del(),
  userHasBadge: (userId, badgeId) => db('user_badges').where({ userId, badge_id: badgeId }).first(),

  // Leaderboard
  getLeaderboard: (limit = 20) => 
    db('user_badges')
      .countDistinct('badge_id as badge_count')
      .join('users', 'users.id', 'user_badges.user_id')
      .select('users.id', 'users.username', 'user_badges.badge_count')
      .groupBy('users.id', 'users.username')
      .orderBy('badge_count', 'desc')
      .limit(limit),

  // Trending
  getTrendingQuestions: (limit = 20) => 
    db('questions as q')
      .select('q.*')
      .selectRaw('COUNT(DISTINCT a.id) as answer_count')
      .selectRaw('SUM(a.interactions->>\'views\')::INTEGER as total_views')
      .leftJoin('answers as a', 'a.question_id', 'q.id')
      .where('a.status', 'approved')
      .groupBy('q.id')
      .orderByRaw('answer_count * 2 + COALESCE(total_views, 0) DESC')
      .limit(limit)
};

// Export db instance and tables
module.exports = {
  db,
  ...tables
};
