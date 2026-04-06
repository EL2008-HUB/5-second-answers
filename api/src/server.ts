import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runMigrations } from './db/migrate';
import routes from './routes';

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({
    name: '5-Second Answers API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET  /api/health',
      'GET  /api/gamification/stats/:userId',
      'GET  /api/gamification/qod',
      'POST /api/gamification/record-answer',
      'GET  /api/questions',
      'POST /api/questions',
      'GET  /api/questions/:id',
      'GET  /api/questions/:id/answers',
      'GET  /api/answers',
      'POST /api/answers/:id/like',
      'GET  /api/users/:id',
      'POST /api/users',
      'GET  /api/leaderboard'
    ]
  });
});

async function main() {
  try {
    await runMigrations();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

main();
