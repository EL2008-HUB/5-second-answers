import pool from './pool';

const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_answer_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    lang_code VARCHAR(10) DEFAULT 'en',
    category VARCHAR(100),
    is_daily BOOLEAN DEFAULT FALSE,
    daily_date DATE,
    created_by UUID REFERENCES users(id),
    view_count INTEGER DEFAULT 0,
    answer_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 5,
    sentiment VARCHAR(50),
    like_count INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS answer_likes (
    answer_id UUID REFERENCES answers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (answer_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `INSERT INTO users (username, display_name, email) 
   VALUES ('demo_user', 'Demo User', 'demo@example.com') 
   ON CONFLICT (username) DO NOTHING`,
  `INSERT INTO questions (text, lang_code, category, is_daily, daily_date)
   VALUES 
     ('What would you do with an extra hour each day?', 'en', 'lifestyle', TRUE, CURRENT_DATE),
     ('What is the most important lesson you have learned in life?', 'en', 'wisdom', FALSE, NULL),
     ('If you could visit any place in the world, where would you go?', 'en', 'travel', FALSE, NULL)
   ON CONFLICT DO NOTHING`
];

export async function runMigrations() {
  const client = await pool.connect();
  try {
    for (const migration of migrations) {
      await client.query(migration);
    }
    console.log('Database migrations are up to date');
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  } finally {
    client.release();
  }
}
