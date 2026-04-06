import { Request, Response } from 'express';
import pool from '../db/pool';

export async function getUser(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, username, display_name, avatar_url, xp, level, streak_days, best_streak, created_at
       FROM users WHERE username = $1 OR id::text = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getUser error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createUser(req: Request, res: Response) {
  const { username, displayName, email, avatarUrl } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  try {
    const result = await pool.query(
      `INSERT INTO users (username, display_name, email, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id, username, display_name, xp, level, streak_days, best_streak, created_at`,
      [username, displayName || username, email || null, avatarUrl || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getLeaderboard(req: Request, res: Response) {
  try {
    const result = await pool.query(
      `SELECT id, username, display_name, avatar_url, xp, level, streak_days, best_streak
       FROM users ORDER BY xp DESC LIMIT 50`
    );
    res.json({ leaderboard: result.rows });
  } catch (err) {
    console.error('getLeaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
