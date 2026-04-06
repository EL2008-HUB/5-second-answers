import { Router } from 'express';
import { getUserStats, getQOD, recordAnswer } from '../controllers/gamificationController';
import { getQuestions, getQuestion, createQuestion, getAnswersForQuestion } from '../controllers/questionController';
import { likeAnswer, getAnswers } from '../controllers/answerController';
import { getUser, createUser, getLeaderboard, getWeeklyLeaderboard } from '../controllers/userController';
import { quickVote, getVoteStats } from '../controllers/voteController';
import { getBattles, getBattle, voteBattle, createBattle } from '../controllers/battleController';
import { reactToAnswer, removeReaction } from '../controllers/reactionController';
import { getFeed, getTrending, getCountries } from '../controllers/feedController';
import { addTrendingTopic, getTrendingTopics, processTopic } from '../controllers/trendingController';
import { getShareData, getResultScreen } from '../controllers/shareController';

const router = Router();

// ── Health ─────────────────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date(), version: '2.0.0' }));

// ── Gamification (Phase 1) ──────────────────────────────────────────────
router.get('/gamification/stats/:userId', getUserStats);
router.get('/gamification/qod', getQOD);
router.post('/gamification/record-answer', recordAnswer);

// ── Questions ──────────────────────────────────────────────────────────
router.get('/questions', getQuestions);
router.post('/questions', createQuestion);
router.get('/questions/:id', getQuestion);
router.get('/questions/:id/answers', getAnswersForQuestion);
router.get('/questions/:id/vote-stats', getVoteStats);

// ── Quick Vote Po/Jo (Phase 1) ─────────────────────────────────────────
router.post('/vote', quickVote);

// ── Answers & Reactions (Phase 2) ──────────────────────────────────────
router.get('/answers', getAnswers);
router.post('/answers/:id/like', likeAnswer);
router.post('/answers/:id/react', reactToAnswer);
router.delete('/answers/:id/react', removeReaction);

// ── Opinion Battles (Phase 2) ──────────────────────────────────────────
router.get('/battles', getBattles);
router.post('/battles', createBattle);
router.get('/battles/:id', getBattle);
router.post('/battles/:id/vote', voteBattle);

// ── Feed & Trending (Phase 2–3) ────────────────────────────────────────
router.get('/feed', getFeed);
router.get('/trending', getTrending);
router.get('/countries', getCountries);

// ── Trending Pipeline (Phase 3) ────────────────────────────────────────
router.get('/trending-topics', getTrendingTopics);
router.post('/trending-topics', addTrendingTopic);
router.post('/trending-topics/:id/process', processTopic);

// ── Users & Leaderboard ────────────────────────────────────────────────
router.get('/users/:id', getUser);
router.post('/users', createUser);
router.get('/leaderboard', getLeaderboard);
router.get('/leaderboard/weekly', getWeeklyLeaderboard);

// ── Share & Result Screen (Phase 4) ────────────────────────────────────
router.get('/share', getShareData);
router.get('/result', getResultScreen);

export default router;
