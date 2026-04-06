import { Request, Response } from 'express';
import pool from '../db/pool';

// Phase 3: Trending Pipeline & Auto-Question Generation
export async function addTrendingTopic(req: Request, res: Response) {
  const { title, source, url, countryCode = 'ALL', langCode = 'sq' } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const result = await pool.query(
      `INSERT INTO trending_topics (title, source, url, country_code, lang_code)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [title, source || 'manual', url || null, countryCode, langCode]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('addTrendingTopic error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getTrendingTopics(req: Request, res: Response) {
  const { processed = 'false', limit = 20 } = req.query;
  try {
    const result = await pool.query(
      `SELECT t.*, q.text as generated_question
       FROM trending_topics t
       LEFT JOIN questions q ON t.generated_question_id = q.id
       WHERE t.processed = $1
       ORDER BY t.created_at DESC LIMIT $2`,
      [processed === 'true', limit]
    );
    res.json({ topics: result.rows });
  } catch (err) {
    console.error('getTrendingTopics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Convert a trending topic into a question (manual trigger, AI can be added later)
export async function processTopic(req: Request, res: Response) {
  const { id } = req.params;
  const { questionText, langCode = 'sq', countryCode = 'ALL', category = 'trending' } = req.body;
  if (!questionText) return res.status(400).json({ error: 'questionText is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const qRes = await client.query(
      `INSERT INTO questions (text, lang_code, category, country_code, source)
       VALUES ($1,$2,$3,$4,'trending') RETURNING id`,
      [questionText, langCode, category, countryCode]
    );
    const qid = qRes.rows[0].id;
    await client.query(
      `UPDATE trending_topics SET processed=TRUE, generated_question_id=$1 WHERE id=$2`,
      [qid, id]
    );
    await client.query('COMMIT');
    res.json({ success: true, questionId: qid, questionText });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('processTopic error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}
