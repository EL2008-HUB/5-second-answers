// src/backend/data/migrations/001_initial_schema.js
// PostgreSQL schema migration

exports.up = async (knex) => {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('username').notNullable().unique();
    table.string('email').notNullable().unique();
    table.string('avatar').nullable();
    table.jsonb('stats').defaultTo(JSON.stringify({
      answersGiven: 0,
      likesReceived: 0,
      questionsAsked: 0
    }));
    table.integer('followers').defaultTo(0);
    table.integer('ranking').defaultTo(1000);
    table.timestamps(true, true);
  });

  // Questions table
  await knex.schema.createTable('questions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.text('text').notNullable();
    table.string('category').defaultTo('general');
    table.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    table.integer('views').defaultTo(0);
    table.enum('status', ['active', 'closed', 'moderated']).defaultTo('active');
    table.boolean('ai_reviewed').defaultTo(false);
    table.jsonb('metadata').defaultTo(JSON.stringify({
      language: 'en',
      difficulty: 'easy'
    }));
    table.timestamps(true, true);
    table.index('category');
    table.index('user_id');
    table.index('created_at');
  });

  // Answers table
  await knex.schema.createTable('answers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('question_id').notNullable().references('questions.id').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    table.enum('type', ['video', 'audio', 'text']).notNullable();
    table.string('content_url').nullable();
    table.text('text').nullable();
    table.integer('duration').defaultTo(5); // seconds
    table.jsonb('interactions').defaultTo(JSON.stringify({
      likes: 0,
      views: 0,
      saves: 0
    }));
    table.jsonb('ai_review').defaultTo(JSON.stringify({
      approved: false,
      feedback: null,
      score: 0,
      shortSummary: null,
      transcript: null,
      fact: null
    }));
    table.enum('status', ['pending', 'approved', 'rejected']).defaultTo('pending');
    table.json('new_badges').defaultTo('[]');
    table.timestamps(true, true);
    table.index('question_id');
    table.index('user_id');
    table.index('status');
    table.index('created_at');
  });

  // Interactions table (for tracking likes, views, saves)
  await knex.schema.createTable('interactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('answer_id').notNullable().references('answers.id').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    table.enum('type', ['like', 'view', 'save']).notNullable();
    table.timestamps(true, true);
    table.unique(['answer_id', 'user_id', 'type']); // Prevent duplicate likes from same user
    table.index('answer_id');
    table.index('user_id');
  });

  // Badges table
  await knex.schema.createTable('badges', (table) => {
    table.string('id').primary();
    table.string('name').notNullable();
    table.string('emoji').notNullable();
    table.text('description');
    table.string('category').notNullable();
    table.jsonb('criteria').defaultTo('{}');
    table.integer('order').defaultTo(0);
    table.timestamps(true, true);
  });

  // User Badges (join table)
  await knex.schema.createTable('user_badges', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('users.id').onDelete('CASCADE');
    table.string('badge_id').notNullable().references('badges.id').onDelete('CASCADE');
    table.string('awarded_by').defaultTo('system'); // 'system' or 'admin'
    table.timestamps(true, true);
    table.unique(['user_id', 'badge_id']);
    table.index('user_id');
  });

  console.log('✅ Database schema created');
};

exports.down = async (knex) => {
  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('user_badges');
  await knex.schema.dropTableIfExists('badges');
  await knex.schema.dropTableIfExists('interactions');
  await knex.schema.dropTableIfExists('answers');
  await knex.schema.dropTableIfExists('questions');
  await knex.schema.dropTableIfExists('users');

  console.log('✅ Database schema dropped');
};
