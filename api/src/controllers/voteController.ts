import { Request, Response } from 'express';
import pool from '../db/pool';

// Quick Vote (Po/Jo) — Phase 1
export async function quickVote(req: Request, res: Response) {
  const { questionId, userId, vote } = req.body;
  if (!questionId || !userId || !['yes', 'no'].includes(vote)) {
    return res.status(400).json({ error: 'questionId, userId and vote (yes/no) are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userRes = await client.query(
      `SELECT id FROM users WHERE username = $1 OR id::text = $1`, [userId]
    );
    if (!userRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const uid = userRes.rows[0].id;

    await client.query(
      `INSERT INTO quick_votes (question_id, user_id, vote)
       VALUES ($1, $2, $3)
       ON CONFLICT (question_id, user_id) DO UPDATE SET vote = EXCLUDED.vote`,
      [questionId, uid, vote]
    );

    await client.query(
      `UPDATE questions SET
         vote_yes = (SELECT COUNT(*) FROM quick_votes WHERE question_id=$1 AND vote='yes'),
         vote_no  = (SELECT COUNT(*) FROM quick_votes WHERE question_id=$1 AND vote='no')
       WHERE id = $1`, [questionId]
    );

    // Give 5 XP for voting
    await client.query(
      `UPDATE users SET xp = xp + 5, weekly_xp = weekly_xp + 5, updated_at = NOW() WHERE id=$1`, [uid]
    );

    const stats = await client.query(
      `SELECT vote_yes, vote_no FROM questions WHERE id = $1`, [questionId]
    );
    const { vote_yes, vote_no } = stats.rows[0];
    const total = vote_yes + vote_no;
    const userSideCount = vote === 'yes' ? vote_yes : vote_no;
    const userPct = total > 0 ? Math.round((userSideCount / total) * 100) : 100;
    const isMinority = userPct <= 30;

    await client.query('COMMIT');
    res.json({
      vote,
      voteYes: vote_yes,
      voteNo: vote_no,
      total,
      yesPct: total > 0 ? Math.round((vote_yes / total) * 100) : 0,
      noPct: total > 0 ? Math.round((vote_no / total) * 100) : 0,
      userPercentage: userPct,
      isMinority,
      minorityMessage: isMinority ? `Ti je në ${userPct}% të njerëzve 🔥` : null,
      xpGained: 5
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('quickVote error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

export async function getVoteStats(req: Request, res: Response) {
  const { questionId } = req.params;
  const { userId } = req.query;
  try {
    const stats = await pool.query(
      `SELECT vote_yes, vote_no FROM questions WHERE id = $1`, [questionId]
    );
    if (!stats.rows.length) return res.status(404).json({ error: 'Question not found' });
    const { vote_yes, vote_no } = stats.rows[0];
    const total = vote_yes + vote_no;

    let userVote = null;
    if (userId) {
      const userRes = await pool.query(
        `SELECT id FROM users WHERE username = $1 OR id::text = $1`, [userId]
      );
      if (userRes.rows.length) {
        const vr = await pool.query(
          `SELECT vote FROM quick_votes WHERE question_id=$1 AND user_id=$2`,
          [questionId, userRes.rows[0].id]
        );
        if (vr.rows.length) userVote = vr.rows[0].vote;
      }
    }

    res.json({
      voteYes: vote_yes,
      voteNo: vote_no,
      total,
      yesPct: total > 0 ? Math.round((vote_yes / total) * 100) : 0,
      noPct: total > 0 ? Math.round((vote_no / total) * 100) : 0,
      userVote
    });
  } catch (err) {
    console.error('getVoteStats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
