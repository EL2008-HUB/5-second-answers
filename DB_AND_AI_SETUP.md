# PostgreSQL & AI Integration Setup Guide

**5-Second Answers Backend Migration**  
**From In-Memory to Production-Ready Stack**

---

## Table of Contents

1. [PostgreSQL Setup](#postgresql-setup)
2. [Database Migrations](#database-migrations)
3. [AI API Configuration](#ai-api-configuration)
4. [Installation & Deployment](#installation--deployment)
5. [Troubleshooting](#troubleshooting)

---

## PostgreSQL Setup

### Prerequisites

- **Node.js:** v18.0.0 or higher
- **PostgreSQL:** v13 or higher
- **npm:** v9.0.0 or higher

**Install PostgreSQL:**

**On macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**On Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
```

**On Windows:**
- Download from https://www.postgresql.org/download/windows/
- Run installer → Accept defaults → Remember password for `postgres` user

### Create Database & User

```bash
# Connect to PostgreSQL as default user
psql -U postgres

# Inside psql terminal:
CREATE DATABASE "5secondanswers";
CREATE USER 5second_user WITH PASSWORD 'strong_password_here';
ALTER ROLE 5second_user SET client_encoding TO 'utf8';
ALTER ROLE 5second_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE 5second_user SET default_transaction_deferrable TO on;
ALTER ROLE 5second_user SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE "5secondanswers" TO 5second_user;
ALTER DATABASE "5secondanswers" OWNER TO 5second_user;

# Exit psql
\q
```

### Verify Connection

```bash
psql -U 5second_user -d 5secondanswers -h localhost
```

If successful, you'll see: `5secondanswers=>`

---

## Database Migrations

### 1. Install Dependencies

```bash
cd 5second-answers-api
npm install
```

**New packages added:**
- `knex` (3.1.0) - SQL query builder & migrations
- `pg` (8.11.3) - PostgreSQL driver
- `axios` (1.6.5) - HTTP client for AI APIs
- `form-data` (4.0.0) - For multipart file uploads
- `uuid` (9.0.1) - UUID generation

### 2. Create `.env` File

Copy the environment template and fill in your values:

```bash
cp .env.example .env
```

**Edit `.env`:**

```env
# Database (REQUIRED)
DATABASE_URL=postgresql://5second_user:strong_password_here@localhost:5432/5secondanswers
DB_HOST=localhost
DB_PORT=5432
DB_NAME=5secondanswers
DB_USER=5second_user
DB_PASSWORD=strong_password_here

# Server
PORT=5000
NODE_ENV=production

# OpenAI API (REQUIRED for AI validation)
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-3.5-turbo
WHISPER_MODEL=whisper-1

# Google Fact-Check API (OPTIONAL - falls back to simulation)
GOOGLE_FACT_CHECK_API_KEY=your-api-key-here
GOOGLE_FACT_CHECK_LANG=en

# Admin
ADMIN_KEY=admin-secret-key-123

# Frontend
FRONTEND_URL=http://localhost:3000
```

### 3. Run Migrations

```bash
# Run all pending migrations
npm run db:migrate

# Output should show:
# ✅ Database schema created
```

**Migration files created:**
- `src/backend/data/migrations/001_initial_schema.js` - Creates 6 tables

**Tables created:**
1. `users` - User accounts with stats
2. `questions` - Q&A questions
3. `answers` - Answers (video/audio/text)
4. `interactions` - Likes, views, saves
5. `badges` - Badge definitions
6. `user_badges` - User badge assignments

### 4. Seed Initial Data

```bash
# Insert demo data
npm run db:seed

# Output should show:
# ✅ Seed data inserted successfully
```

**Demo data includes:**
- 3 sample users with different stats
- 3 sample questions
- 3 sample answers
- Badge definitions (8 types)
- User badge assignments

### 5. Verify Database

```bash
# Connect to database
psql -U 5second_user -d 5secondanswers

# List tables
\dt

# Output should show:
# public | badges         | table | 5second_user
# public | interactions   | table | 5second_user
# public | answers        | table | 5second_user
# public | questions      | table | 5second_user
# public | user_badges    | table | 5second_user
# public | users          | table | 5second_user

# Exit
\q
```

### 6. (Optional) Reset Database

```bash
# Rollback all migrations and re-run with seed
npm run db:reset

# This runs:
# 1. knex migrate:rollback (drop all tables)
# 2. knex migrate:latest (recreate tables)
# 3. knex seed:run (insert demo data)
```

---

## AI API Configuration

### 1. OpenAI API Setup (REQUIRED)

**Get your API key:**
1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy and save (you won't see it again)
4. Add to `.env`: `OPENAI_API_KEY=sk-...`

**Pricing:**
- Whisper (transcription): $0.006 per minute
- GPT-3.5-turbo (summarization): $0.0005 per 1K input tokens
- Estimated cost: ~$0.01 per answer validation

**Monthly budget example:**
- 1M answers validated/month ≈ $10K/month
- Set spending limit in OpenAI dashboard to avoid surprises

### 2. Google Fact-Check API Setup (OPTIONAL)

**Get your API key:**
1. Go to https://console.cloud.google.com/
2. Create new project
3. Enable "Fact Check Tools" API
4. Create API key (credentials)
5. Add to `.env`: `GOOGLE_FACT_CHECK_API_KEY=...`

**Pricing:**
- 100 requests/day free (after that, requires paid API)
- For higher volume, contact Google Cloud support

**Alternative Fact-Check APIs:**
- ClaimBuster API: https://claimbusters.ifp.illinois.edu/
- NewsGuard: https://www.newsguardtech.com/
- Kialo: https://www.kialo.com/

### 3. Test AI Integration

```bash
# Start backend server
npm run dev

# Test transcription (will use Whisper)
curl -X POST http://localhost:5000/api/ai/validate \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "text": "TypeScript is a programming language built on top of JavaScript"
  }'

# Response should show:
# {
#   "approved": true,
#   "shortSummary": "...",
#   "fact": { "score": 0.78, "verdict": "likely_true" },
#   "feedback": "Clear and likely accurate",
#   "score": 0.78
# }
```

---

## Installation & Deployment

### Local Development Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd 5second-answers

# 2. Install dependencies
npm install
cd 5second-answers-api && npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL & API keys

# 4. Run migrations & seed
npm run db:migrate
npm run db:seed

# 5. Start backend server
npm run dev

# Output should show:
# ✅ PostgreSQL connected successfully
# 🚀 Server running on http://localhost:5000
```

### Production Deployment

#### Option A: Traditional Server (AWS EC2, DigitalOcean, etc.)

```bash
# 1. SSH into server
ssh user@your-server.com

# 2. Install Node.js & PostgreSQL
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql

# 3. Clone & setup
git clone <repo-url>
cd 5second-answers/5second-answers-api
npm install

# 4. Configure environment
nano .env
# Add production values

# 5. Run migrations
npm run db:migrate
npm run db:seed

# 6. Start with PM2 (process manager)
npm install -g pm2
pm2 start src/server.js --name "5second-answers-api"
pm2 save
```

#### Option B: Docker Deployment

```bash
# 1. Create Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run db:migrate

EXPOSE 5000
CMD ["npm", "start"]

# 2. Create docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: 5secondanswers
      POSTGRES_USER: 5second_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api:
    build: ./5second-answers-api
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://5second_user:${DB_PASSWORD}@db:5432/5secondanswers
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - NODE_ENV=production
    depends_on:
      - db

volumes:
  postgres_data:

# 3. Deploy
docker-compose up -d
```

#### Option C: Heroku Deployment

```bash
# 1. Install Heroku CLI
npm install -g heroku

# 2. Create Heroku app
heroku create your-app-name

# 3. Add PostgreSQL addon
heroku addons:create heroku-postgresql:basic --app your-app-name

# 4. Set environment variables
heroku config:set OPENAI_API_KEY=sk-... --app your-app-name
heroku config:set ADMIN_KEY=... --app your-app-name

# 5. Deploy
git push heroku main

# 6. Run migrations on Heroku
heroku run npm run db:migrate --app your-app-name
heroku run npm run db:seed --app your-app-name
```

---

## Troubleshooting

### Error: "connect ECONNREFUSED 127.0.0.1:5432"

**Cause:** PostgreSQL not running

**Solution:**
```bash
# Start PostgreSQL
sudo service postgresql start

# Verify it's running
sudo service postgresql status
```

### Error: "FATAL: role '5second_user' does not exist"

**Cause:** Database user not created

**Solution:**
```bash
# Recreate user
psql -U postgres -c "CREATE USER 5second_user WITH PASSWORD 'password';"
psql -U postgres -c "ALTER ROLE 5second_user SET client_encoding TO 'utf8';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE 5secondanswers TO 5second_user;"
```

### Error: "Error: connect ENOTFOUND db"

**Cause:** Docker container can't reach database

**Solution:**
```yaml
# In docker-compose.yml, ensure:
api:
  depends_on:
    - db  # Must match service name
```

### Error: "OPENAI_API_KEY not configured"

**Cause:** Environment variable not set

**Solution:**
```bash
# Check .env file
cat 5second-answers-api/.env | grep OPENAI_API_KEY

# If missing, add it:
echo "OPENAI_API_KEY=sk-..." >> 5second-answers-api/.env
```

### Error: "No migrations found"

**Cause:** Migration files not in correct location

**Solution:**
```bash
# Verify file exists
ls -la src/backend/data/migrations/

# Run with verbose output
npx knex migrate:latest --verbose
```

### Slow Transcription (>30s)

**Cause:** Large video file or network lag

**Solution:**
- Compress video before uploading
- Implement chunked upload
- Add timeout handling

### Fact-Check API Rate Limit

**Cause:** Exceeded 100 requests/day limit

**Solution:**
```javascript
// Implement circuit breaker
const factCheckWithFallback = async (text) => {
  try {
    return await exports.factCheck(text);
  } catch (error) {
    if (error.status === 429) {
      // Rate limited - use fallback
      return { score: 0.65, verdict: 'uncertain', fallback: true };
    }
    throw error;
  }
};
```

---

## Performance Optimization

### Database Indexes

Already added in schema migration:
- `questions` - index on `category`, `user_id`, `created_at`
- `answers` - index on `question_id`, `user_id`, `status`, `created_at`
- `interactions` - unique constraint on `(answer_id, user_id, type)`

### Connection Pooling

Knex includes connection pooling by default:
```javascript
// src/backend/data/db.js
const db = knex({
  client: 'pg',
  connection: { ... },
  pool: {
    min: 2,
    max: 10
  }
});
```

### Query Optimization

Example queries using Knex:
```javascript
// Get trending questions with answer counts (efficient)
db('questions as q')
  .select('q.*')
  .selectRaw('COUNT(DISTINCT a.id) as answer_count')
  .leftJoin('answers as a', 'a.question_id', 'q.id')
  .where('a.status', 'approved')
  .groupBy('q.id')
  .orderByRaw('answer_count DESC')
```

### Caching

Implement Redis for frequently accessed data:
```bash
npm install redis
```

```javascript
const redis = require('redis');
const client = redis.createClient({ host: 'localhost', port: 6379 });

// Cache trending questions for 5 minutes
const getTrendingCached = async () => {
  const cached = await client.get('trending_questions');
  if (cached) return JSON.parse(cached);
  
  const trending = await db./* query */;
  await client.setEx('trending_questions', 300, JSON.stringify(trending));
  return trending;
};
```

---

## Next Steps

1. **Monitoring:** Set up error tracking (Sentry, LogRocket)
2. **Analytics:** Add database analytics
3. **Backups:** Configure PostgreSQL backups
4. **Rate Limiting:** Add express-rate-limit middleware
5. **Authentication:** Replace mock admin key with JWT

---

## Support & Resources

- PostgreSQL Docs: https://www.postgresql.org/docs/
- Knex.js Docs: http://knexjs.org/
- OpenAI API: https://platform.openai.com/docs/
- Google Fact Check: https://toolbox.google.com/factcheck/explorer  

**Questions?** Create an issue in the repository or contact the dev team.
