import { Request, Response } from 'express';
import pool from '../db/pool';

export async function getUser(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, username, display_name, avatar_url, country,
              xp, level, streak_days, best_streak, weekly_xp, created_at
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
  const { username, displayName, email, avatarUrl, country = 'ALL' } = req.body;
  if (!username) return res.status(400).json({ error: 'Username is required' });
  try {
    const result = await pool.query(
      `INSERT INTO users (username, display_name, email, avatar_url, country)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             country = EXCLUDED.country
       RETURNING id, username, display_name, country, xp, level, streak_days, best_streak, weekly_xp, created_at`,
      [username, displayName || username, email || null, avatarUrl || null, country]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createUser error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getLeaderboard(req: Request, res: Response) {
  const { country } = req.query;
  try {
    let query = `SELECT id, username, display_name, avatar_url, country,
                        xp, level, streak_days, best_streak
                 FROM users`;
    const params: any[] = [];
    if (country && country !== 'ALL') {
      params.push(country);
      query += ` WHERE country = $1`;
    }
    query += ` ORDER BY xp DESC LIMIT 50`;
    const result = await pool.query(query, params);
    res.json({ leaderboard: result.rows, period: 'all-time' });
  } catch (err) {
    console.error('getLeaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getWeeklyLeaderboard(req: Request, res: Response) {
  const { country } = req.query;
  try {
    // Reset weekly XP if needed
    await pool.query(
      `UPDATE users SET weekly_xp = 0, weekly_reset_date = CURRENT_DATE
       WHERE weekly_reset_date < date_trunc('week', CURRENT_DATE)`
    );
    let query = `SELECT id, username, display_name, avatar_url, country,
                        weekly_xp as xp, level, streak_days
                 FROM users`;
    const params: any[] = [];
    if (country && country !== 'ALL') {
      params.push(country);
      query += ` WHERE country = $1`;
    }
    query += ` ORDER BY weekly_xp DESC LIMIT 50`;
    const result = await pool.query(query, params);
    res.json({ leaderboard: result.rows, period: 'weekly' });
  } catch (err) {
    console.error('getWeeklyLeaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
