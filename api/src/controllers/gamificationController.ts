import { Request, Response } from 'express';
import pool from '../db/pool';

export async function getUserStats(req: Request, res: Response) {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, username, display_name, xp, level, streak_days, best_streak, last_answer_date, created_at
       FROM users WHERE username = $1 OR id::text = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];
    const xpToNextLevel = (user.level * 100) - (user.xp % (user.level * 100));
    res.json({
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      xp: user.xp,
      level: user.level,
      xpToNextLevel,
      streakDays: user.streak_days,
      bestStreak: user.best_streak,
      lastAnswerDate: user.last_answer_date,
      badges: getBadges(user)
    });
  } catch (err) {
    console.error('getUserStats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getQOD(req: Request, res: Response) {
  try {
    const result = await pool.query(
      `SELECT id, text, lang_code, category, daily_date, answer_count
       FROM questions
       WHERE is_daily = TRUE AND daily_date = CURRENT_DATE
       LIMIT 1`
    );
    if (result.rows.length === 0) {
      const fallback = await pool.query(
        `SELECT id, text, lang_code, category, created_at, answer_count
         FROM questions ORDER BY created_at DESC LIMIT 1`
      );
      if (fallback.rows.length === 0) {
        return res.status(404).json({ error: 'No questions available' });
      }
      const q = fallback.rows[0];
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const timeRemainingSeconds = Math.floor((midnight.getTime() - now.getTime()) / 1000);
      return res.json({ question: q, timeRemainingSeconds });
    }
    const q = result.rows[0];
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timeRemainingSeconds = Math.floor((midnight.getTime() - now.getTime()) / 1000);
    res.json({ question: q, timeRemainingSeconds });
  } catch (err) {
    console.error('getQOD error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function getBadges(user: any) {
  const badges = [];
  if (user.streak_days >= 7) badges.push({ id: 'streak_week', name: 'Week Warrior', icon: '🔥' });
  if (user.streak_days >= 30) badges.push({ id: 'streak_month', name: 'Challenge Master', icon: '🏆' });
  if (user.level >= 5) badges.push({ id: 'level_5', name: 'Rising Star', icon: '⭐' });
  if (user.level >= 10) badges.push({ id: 'level_10', name: 'Gold Creator', icon: '🥇' });
  return badges;
}

export async function recordAnswer(req: Request, res: Response) {
  const { userId, questionId, content, durationSeconds } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      `SELECT id, username, streak_days, best_streak, last_answer_date, xp, level
       FROM users WHERE username = $1 OR id::text = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const lastDate = user.last_answer_date ? user.last_answer_date.toISOString().split('T')[0] : null;
    let newStreak = user.streak_days;
    if (lastDate === today) {
      // Already answered today
    } else if (lastDate === new Date(Date.now() - 86400000).toISOString().split('T')[0]) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
    const newBestStreak = Math.max(newStreak, user.best_streak);
    const xpGained = 10 + (durationSeconds <= 5 ? 5 : 0);
    const newXp = user.xp + xpGained;
    const newLevel = Math.floor(newXp / 100) + 1;
    await client.query(
      `UPDATE users SET streak_days=$1, best_streak=$2, last_answer_date=$3, xp=$4, level=$5, updated_at=NOW()
       WHERE id=$6`,
      [newStreak, newBestStreak, today, newXp, newLevel, user.id]
    );
    const answerResult = await client.query(
      `INSERT INTO answers (question_id, user_id, content, duration_seconds)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [questionId, user.id, content, durationSeconds || 5]
    );
    await client.query(
      `UPDATE questions SET answer_count = answer_count + 1 WHERE id = $1`,
      [questionId]
    );
    await client.query('COMMIT');
    res.json({
      answerId: answerResult.rows[0].id,
      xpGained,
      newXp,
      newLevel,
      streakDays: newStreak,
      bestStreak: newBestStreak,
      leveledUp: newLevel > user.level
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('recordAnswer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}
