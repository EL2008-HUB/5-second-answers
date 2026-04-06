# 5-Second Answers API v2.0

A gamified micro-learning Q&A platform. Users give rapid answers to trending questions, earn XP/streaks, vote in battles, and react with emojis.

## Architecture

- **Backend API**: Node.js + TypeScript (Express), port 5000
- **Database**: PostgreSQL (Replit built-in)
- **Package manager**: npm

## Project Structure

```
api/src/
  server.ts                    - Entry point
  db/
    pool.ts                    - PostgreSQL connection
    migrate.ts                 - Auto-migrations + 60 seeded questions
  controllers/
    gamificationController.ts  - XP, streaks, QOD, record-answer
    questionController.ts      - Questions CRUD
    answerController.ts        - Answers, likes
    voteController.ts          - Quick Po/Jo vote + minority %
    battleController.ts        - Opinion Battles (Phase 2)
    reactionController.ts      - Emoji reactions 🔥😡🤯 (Phase 2)
    feedController.ts          - Scrollable feed + trending (Phase 2-3)
    trendingController.ts      - Trending pipeline (Phase 3)
    shareController.ts         - Share screen + "Your Result" (Phase 4)
    userController.ts          - Users, all-time & weekly leaderboard
  routes/index.ts              - All routes
```

## API Endpoints (v2.0)

### Gamification (Phase 1)
- `GET  /api/gamification/stats/:userId` — XP, level, streak, badges
- `GET  /api/gamification/qod`           — Question of the Day + countdown
- `POST /api/gamification/record-answer` — Submit answer (updates streak+XP+weekly)

### Quick Vote — Po/Jo (Phase 1)
- `POST /api/vote`                       — Vote yes/no, returns minority % message
- `GET  /api/questions/:id/vote-stats`   — Current vote distribution

### Questions
- `GET  /api/questions`                  — List (filter: lang, category, country)
- `POST /api/questions`                  — Create question
- `GET  /api/questions/:id`              — Single question
- `GET  /api/questions/:id/answers`      — Answers for question

### Answers & Reactions (Phase 2)
- `GET  /api/answers`                    — All answers feed
- `POST /api/answers/:id/like`           — Like an answer
- `POST /api/answers/:id/react`          — Emoji react (fire/mindblown/angry)
- `DELETE /api/answers/:id/react`        — Remove reaction

### Opinion Battles (Phase 2)
- `GET  /api/battles`                    — Active battles with live vote %
- `POST /api/battles`                    — Create a battle
- `GET  /api/battles/:id`                — Single battle + user vote
- `POST /api/battles/:id/vote`           — Vote (a/b), returns minority % message

### Feed & Discovery (Phase 2-3)
- `GET  /api/feed`                       — Mixed feed: questions+battles+answers
- `GET  /api/trending`                   — Hot questions (7-day score)
- `GET  /api/countries`                  — Available country filters

### Trending Pipeline (Phase 3)
- `GET  /api/trending-topics`            — Unprocessed trending topics
- `POST /api/trending-topics`            — Add news/topic to pipeline
- `POST /api/trending-topics/:id/process` — Convert topic → question

### Share & Result Screen (Phase 4)
- `GET  /api/share?questionId=&userId=`  — Shareable data + text
- `GET  /api/result?battleId=&userId=`   — Battle result screen data

### Users & Leaderboard
- `GET  /api/users/:id`                  — User profile
- `POST /api/users`                      — Create/upsert user
- `GET  /api/leaderboard`                — All-time (filter: country)
- `GET  /api/leaderboard/weekly`         — Weekly (resets each Monday)

## XP System
- Answer a question: +10 XP
- Fast answer (≤5s): +5 bonus XP
- Streak 3+ days: +5 bonus XP
- Streak 7+ days: +10 bonus XP
- Quick vote: +5 XP
- Battle vote: +5 XP

## Database Tables
users, questions, answers, answer_likes, quick_votes, battles, battle_votes, reactions, trending_topics, push_tokens

## Seeded Data
- 40 Albanian questions + 20 English questions (60 total)
- 3 sample battles (Dashuri vs Para, Liri vs Siguri, Passion vs Money)
- 1 demo_user
