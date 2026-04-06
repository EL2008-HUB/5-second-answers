# Migration Checklist: In-Memory → PostgreSQL + Real AI APIs

**Target:** Production-ready 5-Second Answers backend  
**Estimated Time:** 2-4 hours (including testing)  
**Prerequisites:** Node 18+, PostgreSQL 13+, OpenAI API key

---

## Phase 1: Database Setup (30 minutes)

- [ ] **Install PostgreSQL**
  - macOS: `brew install postgresql@15`
  - Ubuntu: `sudo apt-get install postgresql`
  - Windows: Download from postgresql.org

- [ ] **Start PostgreSQL service**
  - `brew services start postgresql@15` (macOS)
  - `sudo service postgresql start` (Ubuntu/Linux)

- [ ] **Create database & user**
  ```bash
  psql -U postgres
  CREATE DATABASE "5secondanswers";
  CREATE USER 5second_user WITH PASSWORD 'strong_password';
  GRANT ALL PRIVILEGES ON DATABASE "5secondanswers" TO 5second_user;
  \q
  ```

- [ ] **Verify connection**
  ```bash
  psql -U 5second_user -d 5secondanswers -h localhost
  \q
  ```

---

## Phase 2: Dependency Installation (10 minutes)

- [ ] **Navigate to API directory**
  ```bash
  cd 5second-answers-api
  ```

- [ ] **Install new dependencies**
  ```bash
  npm install knex pg axios form-data uuid
  ```

- [ ] **Verify package.json updated** with:
  - ✅ knex (3.1.0+)
  - ✅ pg (8.11.3+)
  - ✅ axios (1.6.5+)
  - ✅ form-data (4.0.0+)

---

## Phase 3: Environment Configuration (10 minutes)

- [ ] **Copy environment template**
  ```bash
  cp .env.example .env
  ```

- [ ] **Fill in `.env` file:**
  ```env
  # Database (REQUIRED)
  DATABASE_URL=postgresql://5second_user:password@localhost:5432/5secondanswers
  DB_HOST=localhost
  DB_PORT=5432
  DB_NAME=5secondanswers
  DB_USER=5second_user
  DB_PASSWORD=your_password

  # OpenAI (REQUIRED for AI)
  OPENAI_API_KEY=sk-...
  OPENAI_MODEL=gpt-3.5-turbo

  # Google Fact-Check (OPTIONAL - has fallback)
  GOOGLE_FACT_CHECK_API_KEY=...

  # Other
  PORT=5000
  NODE_ENV=development
  ADMIN_KEY=admin-secret-key-123
  ```

- [ ] **Get OpenAI API key**
  - Visit https://platform.openai.com/api-keys
  - Create new secret key
  - Add to `.env`: `OPENAI_API_KEY=sk-...`

- [ ] **Test `.env` is readable**
  ```bash
  node -e "require('dotenv').config(); console.log('✅ ENV loaded:', process.env.DB_HOST)"
  ```

---

## Phase 4: Database Migrations (15 minutes)

- [ ] **Run migrations**
  ```bash
  npm run db:migrate
  ```
  Expected output: `✅ Database schema created`

- [ ] **Verify schema created**
  ```bash
  psql -U 5second_user -d 5secondanswers -c "\dt"
  ```
  Should show 6 tables:
  - users
  - questions
  - answers
  - interactions
  - badges
  - user_badges

- [ ] **Seed demo data**
  ```bash
  npm run db:seed
  ```
  Expected output: `✅ Seed data inserted successfully`

- [ ] **Verify data loaded**
  ```bash
  psql -U 5second_user -d 5secondanswers -c "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM questions;"
  ```
  Should show:
  - 3 users
  - 3 questions

---

## Phase 5: Controller Updates (30 minutes)

### Note: Controllers already auto-compatible with new DB!

The controllers in `src/backend/controllers/` are designed to work with both in-memory and PostgreSQL. Just ensure they're calling the right functions:

- [ ] **Answer Controller**
  - ✅ Uses `db.createAnswer()` → now calls PostgreSQL
  - ✅ Uses `db.getAnswersByQuestion()` → now calls PostgreSQL
  - Update if needed: Change `interactions` array operations to call `db.createInteraction()`

- [ ] **Question Controller**
  - ✅ Uses `db.createQuestion()` → now calls PostgreSQL
  - ✅ Uses `db.getQuestions()` → now calls PostgreSQL
  - Update if needed: Change category filtering logic if necessary

- [ ] **Admin Controller**
  - ✅ Uses `badgeService` which works with DB calls
  - Verify badge operations still work

---

## Phase 6: AI Service Testing (30 minutes)

- [ ] **Test Whisper transcription** (if available)
  ```bash
  # Start server
  npm run dev
  
  # In another terminal, test transcription
  curl -X POST http://localhost:5000/api/ai/validate \
    -H "Content-Type: application/json" \
    -d '{
      "type": "text",
      "text": "Artificial intelligence is transforming industries worldwide"
    }'
  ```

- [ ] **Verify ChatGPT summarization**
  - Response should include: `shortSummary`, `fact`, `feedback`

- [ ] **Check fact-checking**
  - Response `verdict` should be one of: "likely_true", "uncertain", "likely_false"

- [ ] **Monitor API costs**
  - Visit https://platform.openai.com/usage/
  - Estimate cost: ~$0.01 per answer validation

- [ ] **Set spending limit** (recommended)
  - In OpenAI dashboard: Set usage limits to prevent runaway costs

---

## Phase 7: Integration Testing (45 minutes)

### Test Full Answer Creation Flow

```bash
# 1. Create question
curl -X POST http://localhost:5000/api/questions \
  -H "Content-Type: application/json" \
  -d '{"text":"How do I learn React?","category":"tech","userId":"test-user"}'

# Note the returned question ID: q-xxx

# 2. Create answer (with AI validation)
curl -X POST http://localhost:5000/api/answers \
  -H "Content-Type: application/json" \
  -d '{
    "questionId":"q-xxx",
    "userId":"test-user",
    "type":"text",
    "text":"Use the official React documentation and tutorials"
  }'

# Should return: approved=true, AI summary, fact-check score
```

- [ ] **Test question creation**
- [ ] **Test answer creation** (with AI validation)
- [ ] **Test answer retrieval** (check AI review populated)
- [ ] **Test interactions** (like/view/save)
- [ ] **Test badge unlocks** (answer creation should trigger checks)
- [ ] **Test admin endpoints**
  ```bash
  curl -X GET http://localhost:5000/api/admin/users \
    -H "x-admin-key: admin-secret-key-123"
  ```

---

## Phase 8: Performance Testing (30 minutes)

- [ ] **Load test with parallel requests**
  ```bash
  # Install Apache Bench (if not present)
  # macOS: brew install httpd
  # Test 100 requests, 10 concurrent
  ab -n 100 -c 10 http://localhost:5000/api/questions
  ```

- [ ] **Check query performance**
  ```bash
  # Enable slow query logging
  psql -U 5second_user -d 5secondanswers
  ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log >1s queries
  SELECT pg_reload_conf();
  \q
  ```

- [ ] **Verify no N+1 queries**
  - Check logs for multiple queries per request
  - Use `EXPLAIN ANALYZE` for slow queries

- [ ] **Monitor connections**
  ```bash
  psql -U 5second_user -d 5secondanswers -c "SELECT COUNT(*) FROM pg_stat_activity;"
  ```

---

## Phase 9: Production Readiness (30 minutes)

- [ ] **Enable SSL for PostgreSQL connections**
  ```bash
  # In production .env:
  DATABASE_URL=postgresql://user:pass@host/db?ssl=require
  ```

- [ ] **Set NODE_ENV=production**
  ```bash
  NODE_ENV=production npm start
  ```

- [ ] **Enable query logging**
  ```javascript
  // In db.js, add:
  db.on('query', (query) => {
    console.log(`[SQL] ${query.sql}`);
  });
  ```

- [ ] **Set up error handling**
  - Install Sentry: `npm install @sentry/node`
  - Initialize in server.js

- [ ] **Configure rate limiting**
  ```bash
  npm install express-rate-limit
  ```

- [ ] **Add CORS properly**
  ```javascript
  app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  }));
  ```

- [ ] **Configure backup strategy**
  ```bash
  # Daily backup to AWS S3
  node_modules/.bin/pg-dump...
  ```

---

## Phase 10: Deployment (varies by platform)

### Option A: Traditional Server
- [ ] SSH into server
- [ ] Clone repo / git pull
- [ ] Run `npm install`
- [ ] Create/update `.env`
- [ ] Run `npm run db:migrate db:seed`
- [ ] Start with PM2 or systemd
- [ ] Verify health: `curl http://localhost:5000/api/questions`

### Option B: Docker
- [ ] Build image: `docker build -t 5second-api .`
- [ ] Run container: `docker run -p 5000:5000 5second-api`
- [ ] Test: `curl http://localhost:5000/api/questions`

### Option C: Heroku
- [ ] Install Heroku CLI
- [ ] `heroku create app-name`
- [ ] `heroku addons:create heroku-postgresql:basic`
- [ ] `git push heroku main`
- [ ] `heroku run npm run db:migrate db:seed`

---

## Phase 11: Verification Checklist (15 minutes)

- [ ] **Database connected:** `SELECT 1` works from app
- [ ] **Questions stored in DB:** Not disappear on restart
- [ ] **Answers auto-approved:** AI validation working (score > 0.6)
- [ ] **Badges unlock:** Creating 20 answers unlocks "Active" badge
- [ ] **Interactions tracked:** Likes increment & toggle
- [ ] **Admin endpoints work:** `/api/admin/users` returns data
- [ ] **Error handling:** Invalid requests return 400 (not crash)
- [ ] **Logging:** Errors appear in console/logs
- [ ] **Performance:** 100 parallel requests complete <5s

---

## Phase 12: Documentation & Handoff (20 minutes)

- [ ] **Update README with:**
  - PostgreSQL setup steps
  - OpenAI API requirements
  - Environment variables
  - Running migrations

- [ ] **Record:** Deployment runbook video

- [ ] **Create:** Incident response playbook
  - What to do if DB down
  - What to do if API rate limited
  - How to rollback migration

- [ ] **Store credentials:**
  - Generate new admin key for production
  - Rotate API keys monthly
  - Store in vault (1Password, LastPass, etc.)

---

## Rollback Plan

If migration fails:

```bash
# Rollback migrations
npm run db:rollback

# Revert to in-memory (if needed)
git checkout HEAD~1 -- src/backend/data/db.js

# Restart server
npm run dev
```

---

## Success Criteria

✅ **Migration Complete When:**
1. ✓ PostgreSQL database has 6 tables with 15+ records
2. ✓ API responds with data from PostgreSQL (not in-memory)
3. ✓ AI validation works (Whisper/GPT/Fact-Check called)
4. ✓ Badges auto-unlock based on criteria
5. ✓ Server restarts don't lose data
6. ✓ Admin endpoints return correct data
7. ✓ No console errors or warnings
8. ✓ Performance acceptable (<2s for 99th percentile)

---

## Time Breakdown

| Phase | Task | Time |
|-------|------|------|
| 1 | Database Setup | 30 min |
| 2 | Dependencies | 10 min |
| 3 | Environment | 10 min |
| 4 | Migrations | 15 min |
| 5 | Controllers | 30 min |
| 6 | AI Testing | 30 min |
| 7 | Integration | 45 min |
| 8 | Performance | 30 min |
| 9 | Production | 30 min |
| 10 | Deployment | 60-120 min |
| 11 | Verification | 15 min |
| 12 | Handoff | 20 min |
| **TOTAL** | | **4-5 hours** |

---

## Questions?

- PostgreSQL issues: Check `DB_AND_AI_SETUP.md` troubleshooting section
- API issues: Check `API_DOCUMENTATION.md`
- Database schema: See `src/backend/data/migrations/001_initial_schema.js`

**Good luck! 🚀**
