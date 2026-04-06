import { Request, Response } from 'express';
import pool from '../db/pool';

// Emoji Reactions (😎=fire / 🤯=mindblown / 😡=angry) — Phase 2
export async function reactToAnswer(req: Request, res: Response) {
  const { id } = req.params; // answer id
  const { userId, emoji } = req.body;
  if (!userId || !['fire', 'mindblown', 'angry'].includes(emoji)) {
    return res.status(400).json({ error: 'userId and emoji (fire/mindblown/angry) are required' });
  }
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

    // Upsert reaction (one per user per answer)
    const oldRes = await client.query(
      `SELECT emoji FROM reactions WHERE answer_id=$1 AND user_id=$2`, [id, uid]
    );
    const oldEmoji = oldRes.rows[0]?.emoji;

    await client.query(
      `INSERT INTO reactions (answer_id, user_id, emoji) VALUES ($1,$2,$3)
       ON CONFLICT (answer_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji`,
      [id, uid, emoji]
    );

    // Recalculate reaction counts
    await client.query(
      `UPDATE answers SET
         reaction_fire      = (SELECT COUNT(*) FROM reactions WHERE answer_id=$1 AND emoji='fire'),
         reaction_mindblown = (SELECT COUNT(*) FROM reactions WHERE answer_id=$1 AND emoji='mindblown'),
         reaction_angry     = (SELECT COUNT(*) FROM reactions WHERE answer_id=$1 AND emoji='angry')
       WHERE id=$1`, [id]
    );

    const aRes = await client.query(
      `SELECT reaction_fire, reaction_mindblown, reaction_angry FROM answers WHERE id=$1`, [id]
    );
    await client.query('COMMIT');
    const r = aRes.rows[0];
    res.json({
      emoji,
      changed: oldEmoji !== emoji,
      reactions: {
        fire: r.reaction_fire,
        mindblown: r.reaction_mindblown,
        angry: r.reaction_angry,
        total: r.reaction_fire + r.reaction_mindblown + r.reaction_angry
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('reactToAnswer error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

export async function removeReaction(req: Request, res: Response) {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const uRes = await pool.query(
      `SELECT id FROM users WHERE username=$1 OR id::text=$1`, [userId]
    );
    if (!uRes.rows.length) return res.status(404).json({ error: 'User not found' });
    await pool.query(
      `DELETE FROM reactions WHERE answer_id=$1 AND user_id=$2`, [id, uRes.rows[0].id]
    );
    await pool.query(
      `UPDATE answers SET
         reaction_fire      = (SELECT COUNT(*) FROM reactions WHERE answer_id=$1 AND emoji='fire'),
         reaction_mindblown = (SELECT COUNT(*) FROM reactions WHERE answer_id=$1 AND emoji='mindblown'),
         reaction_angry     = (SELECT COUNT(*) FROM reactions WHERE answer_id=$1 AND emoji='angry')
       WHERE id=$1`, [id]
    );
    res.json({ removed: true });
  } catch (err) {
    console.error('removeReaction error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
