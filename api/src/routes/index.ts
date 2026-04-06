import { Router } from 'express';
import { getUserStats, getQOD, recordAnswer } from '../controllers/gamificationController';
import { getQuestions, getQuestion, createQuestion, getAnswersForQuestion } from '../controllers/questionController';
import { likeAnswer, getAnswers } from '../controllers/answerController';
import { getUser, createUser, getLeaderboard } from '../controllers/userController';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

router.get('/gamification/stats/:userId', getUserStats);
router.get('/gamification/qod', getQOD);
router.post('/gamification/record-answer', recordAnswer);

router.get('/questions', getQuestions);
router.post('/questions', createQuestion);
router.get('/questions/:id', getQuestion);
router.get('/questions/:id/answers', getAnswersForQuestion);

router.get('/answers', getAnswers);
router.post('/answers/:id/like', likeAnswer);

router.get('/users/:id', getUser);
router.post('/users', createUser);
router.get('/leaderboard', getLeaderboard);

export default router;
