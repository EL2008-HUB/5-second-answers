import { Request, Response } from 'express';
import pool from '../db/pool';

export async function getRooms(req: Request, res: Response) {
  const { country, limit = 20 } = req.query;
  try {
    let query = `
      SELECT r.id, r.name, r.description, r.country_code, r.is_live,
             r.participant_count, r.max_participants, r.created_at,
             q.text as question_text, q.id as question_id
      FROM rooms r
      LEFT JOIN questions q ON r.question_id = q.id
      WHERE r.is_active = TRUE`;
    const params: any[] = [];
    if (country && country !== 'ALL') {
      params.push(country);
      query += ` AND (r.country_code = $${params.length} OR r.country_code = 'ALL')`;
    }
    params.push(limit);
    query += ` ORDER BY r.is_live DESC, r.participant_count DESC LIMIT $${params.length}`;
    const result = await pool.query(query, params);
    res.json({ rooms: result.rows });
  } catch (err) {
    console.error('getRooms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getRoom(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT r.*, q.text as question_text
       FROM rooms r LEFT JOIN questions q ON r.question_id = q.id
       WHERE r.id = $1 AND r.is_active = TRUE`, [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Room not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('getRoom error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createRoom(req: Request, res: Response) {
  const { name, description, questionId, countryCode = 'ALL', maxParticipants = 100 } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO rooms (name, description, question_id, country_code, max_participants)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, description || null, questionId || null, countryCode, maxParticipants]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('createRoom error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function joinRoom(req: Request, res: Response) {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const uRes = await client.query(
      `SELECT id FROM users WHERE username=$1 OR id::text=$1`, [userId]
    );
    if (!uRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const uid = uRes.rows[0].id;
    await client.query(
      `INSERT INTO room_participants (room_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, uid]
    );
    await client.query(
      `UPDATE rooms SET
         participant_count = (SELECT COUNT(*) FROM room_participants WHERE room_id=$1),
         is_live = TRUE
       WHERE id=$1`, [id]
    );
    const rRes = await client.query(`SELECT * FROM rooms WHERE id=$1`, [id]);
    await client.query('COMMIT');
    res.json({ joined: true, room: rRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('joinRoom error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

export async function leaveRoom(req: Request, res: Response) {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const uRes = await pool.query(
      `SELECT id FROM users WHERE username=$1 OR id::text=$1`, [userId]
    );
    if (!uRes.rows.length) return res.status(404).json({ error: 'User not found' });
    await pool.query(
      `DELETE FROM room_participants WHERE room_id=$1 AND user_id=$2`, [id, uRes.rows[0].id]
    );
    const count = await pool.query(
      `SELECT COUNT(*) as cnt FROM room_participants WHERE room_id=$1`, [id]
    );
    const cnt = parseInt(count.rows[0].cnt);
    await pool.query(
      `UPDATE rooms SET participant_count=$1, is_live=$2 WHERE id=$3`,
      [cnt, cnt > 0, id]
    );
    res.json({ left: true, participantCount: cnt });
  } catch (err) {
    console.error('leaveRoom error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
