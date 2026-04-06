import { Request, Response } from 'express';
import pool from '../db/pool';

export async function getQuestions(req: Request, res: Response) {
  try {
    const { lang, category, limit = 20, offset = 0 } = req.query;
    let query = `SELECT q.id, q.text, q.lang_code, q.category, q.answer_count, q.view_count, q.created_at
                 FROM questions q WHERE 1=1`;
    const params: any[] = [];
    if (lang) { params.push(lang); query += ` AND q.lang_code = $${params.length}`; }
    if (category) { params.push(category); query += ` AND q.category = $${params.length}`; }
    params.push(limit); query += ` ORDER BY q.created_at DESC LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;
    const result = await pool.query(query, params);
    res.json({ questions: result.rows, total: result.rows.length });
  } catch (err) {
    console.error('getQuestions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getQuestion(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, text, lang_code, category, is_daily, daily_date, answer_count, view_count, created_at
       FROM questions WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Question not found' });
    await pool.query(`UPDATE questions SET view_count = view_count + 1 WHERE id = $1`, [id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getQuestion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createQuestion(req: Request, res: Response) {
  const { text, langCode = 'en', category, isDaily, dailyDate, createdBy } = req.body;
  if (!text) return res.status(400).json({ error: 'Question text is required' });
  try {
    const result = await pool.query(
      `INSERT INTO questions (text, lang_code, category, is_daily, daily_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [text, langCode, category || null, isDaily || false, dailyDate || null, createdBy || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createQuestion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAnswersForQuestion(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT a.id, a.content, a.duration_seconds, a.like_count, a.sentiment, a.created_at,
              u.username, u.display_name, u.avatar_url
       FROM answers a
       JOIN users u ON a.user_id = u.id
       WHERE a.question_id = $1 AND a.is_approved = TRUE
       ORDER BY a.like_count DESC, a.created_at DESC
       LIMIT 50`,
      [id]
    );
    res.json({ answers: result.rows });
  } catch (err) {
    console.error('getAnswersForQuestion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
