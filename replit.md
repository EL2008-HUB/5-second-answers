# 5-Second Answers

A gamified micro-learning Q&A platform inspired by TikTok and Quora. Users give rapid 5-second answers to trending questions, earning XP, streaks, and badges.

## Architecture

- **Backend API**: Node.js + TypeScript (Express), runs on port 5000
- **Database**: PostgreSQL (Replit built-in)
- **Package manager**: npm

## Project Structure

```
api/
  src/
    server.ts           - Entry point, Express app
    db/
      pool.ts           - PostgreSQL connection pool
      migrate.ts        - Schema migrations (auto-runs on start)
    controllers/
      gamificationController.ts  - XP, streaks, QOD
      questionController.ts      - Questions CRUD
      answerController.ts        - Answers, likes
      userController.ts          - Users, leaderboard
    routes/
      index.ts          - All API routes under /api
```

## Key API Endpoints

- `GET /` - API info and endpoint list
- `GET /api/health` - Health check
- `GET /api/gamification/stats/:userId` - User XP, level, streak stats
- `GET /api/gamification/qod` - Question of the Day
- `POST /api/gamification/record-answer` - Submit an answer (updates streak/XP)
- `GET /api/questions` - List questions
- `POST /api/questions` - Create a question
- `GET /api/questions/:id/answers` - Answers for a question
- `POST /api/answers/:id/like` - Like an answer
- `GET /api/users/:id` - Get user profile
- `POST /api/users` - Create/upsert user
- `GET /api/leaderboard` - Top users by XP

## Running

- Dev: `cd api && npm run dev` (uses ts-node-dev, auto-restarts)
- Production: TypeScript compiled via `npm run build`, then `node dist/server.js`

## Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (set automatically by Replit DB)
- `PORT` - Server port (defaults to 5000)

## Database Schema

- **users** - User profiles with XP, level, streak tracking
- **questions** - Questions with daily QOD support
- **answers** - User answers with approval and sentiment fields
- **answer_likes** - Many-to-many likes tracking
- **push_tokens** - Device push notification tokens

## Demo Data

A `demo_user` and 3 sample questions are seeded automatically on first run.
