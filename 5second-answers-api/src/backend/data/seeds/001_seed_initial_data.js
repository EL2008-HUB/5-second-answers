// src/backend/data/seeds/001_seed_initial_data.js
// Initial seed data for development/testing

exports.seed = async (knex) => {
  // Delete existing records (for idempotency)
  if (await knex.schema.hasTable('story_sessions')) {
    await knex('story_sessions').del();
  }
  if (await knex.schema.hasTable('story_questions')) {
    await knex('story_questions').del();
  }
  if (await knex.schema.hasTable('story_packs')) {
    await knex('story_packs').del();
  }
  await knex('user_badges').del();
  await knex('interactions').del();
  await knex('answers').del();
  await knex('questions').del();
  await knex('users').del();
  await knex('badges').del();

  // Insert badges first (referenced by other tables)
  const badges = [
    {
      id: 'five_second',
      name: '5s Flash',
      emoji: '⚡',
      description: 'Posted an answer inside the 5 second window',
      category: 'speed',
      criteria: JSON.stringify({ firstFastAnswer: 1 }),
      order: 0
    },
    {
      id: 'ten_second',
      name: '10s Turtle',
      emoji: '🐢',
      description: 'Used the extra 5 seconds and still posted',
      category: 'speed',
      criteria: JSON.stringify({ firstSlowAnswer: 1 }),
      order: 1
    },
    {
      id: 'star',
      name: '⭐ Star',
      emoji: '⭐',
      description: 'Received 50+ likes',
      category: 'engagement',
      criteria: JSON.stringify({ likesReceived: 50 }),
      order: 1
    },
    {
      id: 'active',
      name: '🚀 Active',
      emoji: '🚀',
      description: 'Answered 20+ questions',
      category: 'contributor',
      criteria: JSON.stringify({ answersGiven: 20 }),
      order: 2
    },
    {
      id: 'vip',
      name: '👑 VIP',
      emoji: '👑',
      description: 'Received 500+ total views',
      category: 'impact',
      criteria: JSON.stringify({ viewsReceived: 500 }),
      order: 3
    },
    {
      id: 'rapid_fire',
      name: '⚡ Rapid Fire',
      emoji: '⚡',
      description: 'Answered 5+ questions in one day',
      category: 'streak',
      criteria: JSON.stringify({ answersInOneDay: 5 }),
      order: 4
    },
    {
      id: 'perfect_score',
      name: '🎯 Perfect Score',
      emoji: '🎯',
      description: '10+ answers with 100% AI approval',
      category: 'quality',
      criteria: JSON.stringify({ perfectAnswers: 10 }),
      order: 5
    },
    {
      id: 'influencer',
      name: '🌟 Influencer',
      emoji: '🌟',
      description: '1000+ followers',
      category: 'influence',
      criteria: JSON.stringify({ followers: 1000 }),
      order: 6
    },
    {
      id: 'beta_tester',
      name: '🧪 Beta Tester',
      emoji: '🧪',
      description: 'Joined during MVP phase',
      category: 'special',
      criteria: JSON.stringify({ manual: true }),
      order: 7
    },
    {
      id: 'expert',
      name: '🎓 Expert',
      emoji: '🎓',
      description: '100+ helpful answers with high quality',
      category: 'mastery',
      criteria: JSON.stringify({ expertAnswers: 100 }),
      order: 8
    }
  ];

  await knex('badges').insert(badges);

  // Insert demo users
  const users = await knex('users').insert([
    {
      username: 'demo_user',
      email: 'demo@5second.app',
      avatar: null,
      home_country: 'AL',
      stats: JSON.stringify({
        answersGiven: 5,
        likesReceived: 12,
        questionsAsked: 2
      }),
      followers: 5,
      ranking: 100
    },
    {
      username: 'dev_expert',
      email: 'expert@5second.app',
      avatar: null,
      home_country: 'US',
      stats: JSON.stringify({
        answersGiven: 25,
        likesReceived: 145,
        questionsAsked: 8
      }),
      followers: 450,
      ranking: 1
    },
    {
      username: 'tech_guru',
      email: 'guru@5second.app',
      avatar: null,
      home_country: 'GB',
      stats: JSON.stringify({
        answersGiven: 18,
        likesReceived: 87,
        questionsAsked: 5
      }),
      followers: 250,
      ranking: 2
    }
  ]).returning('*');

  const userId = users[0].id;
  const userId2 = users[1].id;

  // Insert demo questions
  const questions = await knex('questions').insert([
    {
      text: 'How do I fix TypeScript errors?',
      category: 'tech',
      country: 'AL',
      user_id: userId,
      views: 150,
      status: 'active',
      ai_reviewed: true,
      metadata: JSON.stringify({ language: 'en', difficulty: 'easy' })
    },
    {
      text: 'What is the best way to learn React?',
      category: 'tech',
      country: 'US',
      user_id: userId2,
      views: 89,
      status: 'active',
      ai_reviewed: true,
      metadata: JSON.stringify({ language: 'en', difficulty: 'beginner' })
    },
    {
      text: 'How do I make perfect coffee?',
      category: 'lifestyle',
      country: 'GB',
      user_id: userId,
      views: 45,
      status: 'active',
      ai_reviewed: false,
      metadata: JSON.stringify({ language: 'en', difficulty: 'easy' })
    }
  ]).returning('*');

  const questionId = questions[0].id;
  const questionId2 = questions[1].id;

  // Insert demo answers
  const answers = await knex('answers').insert([
    {
      question_id: questionId,
      user_id: userId2,
      country: 'AL',
      type: 'video',
      content_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      text: null,
      duration: 5,
      interactions: JSON.stringify({
        likes: 42,
        views: 156,
        saves: 8
      }),
      ai_review: JSON.stringify({
        approved: true,
        feedback: 'Clear and concise',
        score: 0.85,
        shortSummary: 'Check type definitions and use strict mode'
      }),
      status: 'approved'
    },
    {
      question_id: questionId,
      user_id: userId,
      country: 'AL',
      type: 'text',
      content_url: null,
      text: 'Use strict TypeScript mode',
      duration: null,
      interactions: JSON.stringify({
        likes: 8,
        views: 32,
        saves: 1
      }),
      ai_review: JSON.stringify({
        approved: true,
        feedback: 'Clear and accurate',
        score: 0.92
      }),
      status: 'approved'
    },
    {
      question_id: questionId2,
      user_id: userId,
      country: 'US',
      type: 'video',
      content_url: 'https://www.w3schools.com/html/mov_bbb.mp4',
      text: null,
      duration: 5,
      interactions: JSON.stringify({
        likes: 15,
        views: 67,
        saves: 3
      }),
      ai_review: JSON.stringify({
        approved: true,
        feedback: 'Informative',
        score: 0.78
      }),
      status: 'approved'
    }
  ]).returning('*');

  // Award badges to demo users
  await knex('user_badges').insert([
    {
      user_id: users[1].id,
      badge_id: 'star',
      awarded_by: 'system'
    },
    {
      user_id: users[1].id,
      badge_id: 'active',
      awarded_by: 'system'
    },
    {
      user_id: users[1].id,
      badge_id: 'beta_tester',
      awarded_by: 'admin'
    }
  ]);

  console.log('✅ Seed data inserted successfully');
};
