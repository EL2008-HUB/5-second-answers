import { Request, Response } from 'express';
import pool from '../db/pool';

export async function likeAnswer(req: Request, res: Response) {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const userResult = await pool.query(
      `SELECT id FROM users WHERE username = $1 OR id::text = $1`, [userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const uid = userResult.rows[0].id;
    await pool.query(
      `INSERT INTO answer_likes (answer_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, uid]
    );
    await pool.query(
      `UPDATE answers SET like_count = (SELECT COUNT(*) FROM answer_likes WHERE answer_id = $1) WHERE id = $1`,
      [id]
    );
    const result = await pool.query(`SELECT like_count FROM answers WHERE id = $1`, [id]);
    res.json({ likeCount: result.rows[0]?.like_count || 0 });
  } catch (err) {
    console.error('likeAnswer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAnswers(req: Request, res: Response) {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const result = await pool.query(
      `SELECT a.id, a.content, a.duration_seconds, a.like_count, a.sentiment, a.created_at,
              u.username, u.display_name,
              q.text as question_text, q.id as question_id
       FROM answers a
       JOIN users u ON a.user_id = u.id
       JOIN questions q ON a.question_id = q.id
       WHERE a.is_approved = TRUE
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ answers: result.rows });
  } catch (err) {
    console.error('getAnswers error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
