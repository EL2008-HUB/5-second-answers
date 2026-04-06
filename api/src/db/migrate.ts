import pool from './pool';

const migrations = [
  // ── PHASE 1: Core Tables (CREATE or ALTER safely) ──────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    avatar_url TEXT,
    country VARCHAR(10) DEFAULT 'ALL',
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_answer_date DATE,
    weekly_xp INTEGER DEFAULT 0,
    weekly_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  // Add new columns to existing users table if they don't exist
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'ALL'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_xp INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_reset_date DATE DEFAULT CURRENT_DATE`,
  `CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    lang_code VARCHAR(10) DEFAULT 'sq',
    category VARCHAR(100),
    tags TEXT[],
    country_code VARCHAR(10) DEFAULT 'ALL',
    is_daily BOOLEAN DEFAULT FALSE,
    daily_date DATE,
    created_by UUID REFERENCES users(id),
    view_count INTEGER DEFAULT 0,
    answer_count INTEGER DEFAULT 0,
    vote_yes INTEGER DEFAULT 0,
    vote_no INTEGER DEFAULT 0,
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  // Add new columns to existing questions table if they don't exist
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS tags TEXT[]`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) DEFAULT 'ALL'`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS vote_yes INTEGER DEFAULT 0`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS vote_no INTEGER DEFAULT 0`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual'`,
  `CREATE TABLE IF NOT EXISTS answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    answer_type VARCHAR(20) DEFAULT 'text',
    duration_seconds INTEGER DEFAULT 5,
    sentiment VARCHAR(50),
    like_count INTEGER DEFAULT 0,
    reaction_fire INTEGER DEFAULT 0,
    reaction_mindblown INTEGER DEFAULT 0,
    reaction_angry INTEGER DEFAULT 0,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `ALTER TABLE answers ADD COLUMN IF NOT EXISTS answer_type VARCHAR(20) DEFAULT 'text'`,
  `ALTER TABLE answers ADD COLUMN IF NOT EXISTS reaction_fire INTEGER DEFAULT 0`,
  `ALTER TABLE answers ADD COLUMN IF NOT EXISTS reaction_mindblown INTEGER DEFAULT 0`,
  `ALTER TABLE answers ADD COLUMN IF NOT EXISTS reaction_angry INTEGER DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS answer_likes (
    answer_id UUID REFERENCES answers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (answer_id, user_id)
  )`,
  // ── PHASE 1: Quick Vote (Po/Jo) ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS quick_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vote VARCHAR(5) NOT NULL CHECK (vote IN ('yes','no')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (question_id, user_id)
  )`,
  // ── PHASE 2: Opinion Battles ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    votes_a INTEGER DEFAULT 0,
    votes_b INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS battle_votes (
    battle_id UUID REFERENCES battles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    choice VARCHAR(1) NOT NULL CHECK (choice IN ('a','b')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (battle_id, user_id)
  )`,
  // ── PHASE 2: Reaction System ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    answer_id UUID REFERENCES answers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL CHECK (emoji IN ('fire','mindblown','angry')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (answer_id, user_id)
  )`,
  // ── PHASE 3: Trending Topics ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS trending_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    source VARCHAR(50),
    url TEXT,
    country_code VARCHAR(10) DEFAULT 'ALL',
    lang_code VARCHAR(10) DEFAULT 'sq',
    processed BOOLEAN DEFAULT FALSE,
    generated_question_id UUID REFERENCES questions(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  // ── Seed demo user ─────────────────────────────────────────────────
  `INSERT INTO users (username, display_name, email, country)
   VALUES ('demo_user', 'Demo User', 'demo@example.com', 'AL')
   ON CONFLICT (username) DO UPDATE SET country = 'AL'`,
  // ── Seed 60 Albanian + English Questions ───────────────────────────
  `INSERT INTO questions (text, lang_code, category, country_code, is_daily, daily_date) VALUES
    ('Çfarë do të bëje nëse do të ishe president për një ditë?', 'sq', 'opinion', 'ALL', TRUE, CURRENT_DATE),
    ('A mendoni se jeta jashtë Shqipërisë është më e mirë?', 'sq', 'lifestyle', 'AL', FALSE, NULL),
    ('Çfarë është gjëja më e rëndësishme në jetë: dashuria, paraja apo shëndeti?', 'sq', 'opinion', 'ALL', FALSE, NULL),
    ('A do të pranoje 1 milion euro nëse nuk mundesh të flasësh me familjen tënde për 1 vit?', 'sq', 'hypothetical', 'ALL', FALSE, NULL),
    ('Çfarë mendoni për brezin e ri të politikës shqiptare?', 'sq', 'politics', 'AL', FALSE, NULL),
    ('A duhet të jetë lënda e historisë obligative në shkollë?', 'sq', 'education', 'AL', FALSE, NULL),
    ('Kush mendoni se është personi më i famshëm shqiptar i të gjitha kohëve?', 'sq', 'culture', 'AL', FALSE, NULL),
    ('A do të ktheheshe në Shqipëri pas 10 vitesh jashtë?', 'sq', 'lifestyle', 'AL', FALSE, NULL),
    ('Çfarë muzike dëgjoni më shumë: shqipe apo angleze?', 'sq', 'culture', 'AL', FALSE, NULL),
    ('A mendoni se social media po shkatërron brezin e ri?', 'sq', 'tech', 'ALL', FALSE, NULL),
    ('Cili është filmi shqiptar më i mirë i bërë ndonjëherë?', 'sq', 'culture', 'AL', FALSE, NULL),
    ('A duhet njeriu të ndjehet fajtorë nëse nuk ndjek ëndrrën e tij?', 'sq', 'motivation', 'ALL', FALSE, NULL),
    ('Çfarë do të bëje me 24 orë plotësisht të lira?', 'sq', 'lifestyle', 'ALL', FALSE, NULL),
    ('A besoni se fati ekziston apo gjithçka është vendim personal?', 'sq', 'philosophy', 'ALL', FALSE, NULL),
    ('Cilat janë 3 cilësitë më të rëndësishme tek një mik i vërtetë?', 'sq', 'relationships', 'ALL', FALSE, NULL),
    ('A duhet të ketë njerëzit e famshëm jetë private?', 'sq', 'celebrity', 'ALL', FALSE, NULL),
    ('Çfarë është gjëja që të bën krenar/e për Shqipërinë?', 'sq', 'culture', 'AL', FALSE, NULL),
    ('A preferon të jetosh në qytet apo fshat?', 'sq', 'lifestyle', 'ALL', FALSE, NULL),
    ('Çfarë do të ndryshoje tek sistemi arsimor shqiptar?', 'sq', 'education', 'AL', FALSE, NULL),
    ('A mendoni se TikTok ka ndikim pozitiv apo negativ tek të rinjtë?', 'sq', 'tech', 'ALL', FALSE, NULL),
    ('Cili është qyteti më i bukur i Shqipërisë sipas jush?', 'sq', 'travel', 'AL', FALSE, NULL),
    ('A duhet të jetë universiteti falas për të gjithë?', 'sq', 'education', 'ALL', FALSE, NULL),
    ('Çfarë vlerëson më shumë: lirinë apo sigurinë?', 'sq', 'philosophy', 'ALL', FALSE, NULL),
    ('A mendoni se njerëzit ndryshojnë vërtet?', 'sq', 'philosophy', 'ALL', FALSE, NULL),
    ('Cili është makina e ëndrrave tuaja?', 'sq', 'lifestyle', 'ALL', FALSE, NULL),
    ('A duhet të ketë detyrim ushtarak në Shqipëri?', 'sq', 'politics', 'AL', FALSE, NULL),
    ('Çfarë mendoni për bllokimin e TikTok në disa vende?', 'sq', 'tech', 'ALL', FALSE, NULL),
    ('A preferon pushime në mal apo në det?', 'sq', 'travel', 'ALL', FALSE, NULL),
    ('Çfarë do t''i thosha vetes 10 vjet më parë?', 'sq', 'motivation', 'ALL', FALSE, NULL),
    ('A mendoni se Shqipëria do të bëhet anëtare e BE-së para 2030?', 'sq', 'politics', 'AL', FALSE, NULL),
    ('Cili sportist shqiptar ju bën më krenarë?', 'sq', 'sports', 'AL', FALSE, NULL),
    ('A duhet të jetë gjuha shqipe e detyrueshme në diasporë?', 'sq', 'culture', 'ALL', FALSE, NULL),
    ('Çfarë mendoni për fenomenin e influencerëve?', 'sq', 'social', 'ALL', FALSE, NULL),
    ('A do të preferonit të jetoni 100 vjet me shëndet mesatar ose 70 vjet me shëndet perfekt?', 'sq', 'hypothetical', 'ALL', FALSE, NULL),
    ('Cili është sekreti juaj për të qenë produktiv?', 'sq', 'motivation', 'ALL', FALSE, NULL),
    ('A mendoni se inteligjenca artificiale do të marrë punën tuaj?', 'sq', 'tech', 'ALL', FALSE, NULL),
    ('Çfarë është suksesi për ju?', 'sq', 'motivation', 'ALL', FALSE, NULL),
    ('A duhet të jetë votimi i detyrueshëm?', 'sq', 'politics', 'ALL', FALSE, NULL),
    ('Cili është libri më i mirë që keni lexuar?', 'sq', 'culture', 'ALL', FALSE, NULL),
    ('A mendoni se njerëzit janë themelisht të mirë apo të këqij?', 'sq', 'philosophy', 'ALL', FALSE, NULL),
    ('What would you do if you had unlimited money for one week?', 'en', 'hypothetical', 'ALL', FALSE, NULL),
    ('Should social media platforms be regulated like TV?', 'en', 'tech', 'ALL', FALSE, NULL),
    ('Is it better to be loved or respected?', 'en', 'relationships', 'ALL', FALSE, NULL),
    ('Would you take a job you hate for 3x your current salary?', 'en', 'lifestyle', 'ALL', FALSE, NULL),
    ('What skill do you wish you had learned earlier in life?', 'en', 'motivation', 'ALL', FALSE, NULL),
    ('Is remote work the future or just a temporary trend?', 'en', 'lifestyle', 'ALL', FALSE, NULL),
    ('Should everyone be required to learn to code?', 'en', 'education', 'ALL', FALSE, NULL),
    ('What is the most overrated thing in modern life?', 'en', 'opinion', 'ALL', FALSE, NULL),
    ('Would you rather have 10 close friends or 1000 acquaintances?', 'en', 'relationships', 'ALL', FALSE, NULL),
    ('Is it possible to be truly happy without money?', 'en', 'philosophy', 'ALL', FALSE, NULL),
    ('What will the world look like in 50 years?', 'en', 'future', 'ALL', FALSE, NULL),
    ('Should fast food companies be taxed more for health costs?', 'en', 'opinion', 'ALL', FALSE, NULL),
    ('What is the hardest truth you have had to accept?', 'en', 'philosophy', 'ALL', FALSE, NULL),
    ('Is social media making people more lonely?', 'en', 'social', 'ALL', FALSE, NULL),
    ('Would you choose to live on Mars if given the chance?', 'en', 'future', 'ALL', FALSE, NULL),
    ('What one thing would you change about your country?', 'en', 'politics', 'ALL', FALSE, NULL),
    ('Is it better to follow your passion or the money?', 'en', 'motivation', 'ALL', FALSE, NULL),
    ('Do you think AI will ever be more creative than humans?', 'en', 'tech', 'ALL', FALSE, NULL),
    ('What habit has changed your life the most?', 'en', 'motivation', 'ALL', FALSE, NULL),
    ('Should college education be free for everyone?', 'en', 'education', 'ALL', FALSE, NULL)
   ON CONFLICT DO NOTHING`,
  // ── Seed 3 battles ────────────────────────────────────────────────
  `INSERT INTO battles (title, option_a, option_b, question_id)
   SELECT
     'Dashuri vs Para',
     'Dashuria',
     'Paratë',
     id
   FROM questions WHERE text LIKE '%dashuria, paraja%' LIMIT 1
   ON CONFLICT DO NOTHING`,
  `INSERT INTO battles (title, option_a, option_b, question_id)
   SELECT
     'Liri vs Siguri',
     'Liria',
     'Siguria',
     id
   FROM questions WHERE text LIKE '%lirinë apo sigurinë%' LIMIT 1
   ON CONFLICT DO NOTHING`,
  `INSERT INTO battles (title, option_a, option_b, question_id)
   SELECT
     'Follow Your Passion vs Money',
     'Follow Your Passion',
     'Follow the Money',
     id
   FROM questions WHERE text LIKE '%passion or the money%' LIMIT 1
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
