import { Request, Response } from 'express';
import pool from '../db/pool';

// Get active battles — Phase 2
export async function getBattles(req: Request, res: Response) {
  try {
    const result = await pool.query(
      `SELECT b.id, b.title, b.option_a, b.option_b, b.votes_a, b.votes_b,
              b.is_active, b.ends_at, b.created_at,
              q.text as question_text, q.lang_code
       FROM battles b
       LEFT JOIN questions q ON b.question_id = q.id
       WHERE b.is_active = TRUE AND b.ends_at > NOW()
       ORDER BY b.created_at DESC
       LIMIT 20`
    );
    const battles = result.rows.map(b => enrichBattle(b));
    res.json({ battles });
  } catch (err) {
    console.error('getBattles error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getBattle(req: Request, res: Response) {
  const { id } = req.params;
  const { userId } = req.query;
  try {
    const result = await pool.query(
      `SELECT b.id, b.title, b.option_a, b.option_b, b.votes_a, b.votes_b,
              b.is_active, b.ends_at, b.created_at,
              q.text as question_text, q.lang_code
       FROM battles b
       LEFT JOIN questions q ON b.question_id = q.id
       WHERE b.id = $1`, [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Battle not found' });

    const battle = enrichBattle(result.rows[0]);
    if (userId) {
      const uRes = await pool.query(
        `SELECT id FROM users WHERE username=$1 OR id::text=$1`, [userId]
      );
      if (uRes.rows.length) {
        const vr = await pool.query(
          `SELECT choice FROM battle_votes WHERE battle_id=$1 AND user_id=$2`,
          [id, uRes.rows[0].id]
        );
        battle.userChoice = vr.rows[0]?.choice || null;
      }
    }
    res.json(battle);
  } catch (err) {
    console.error('getBattle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function voteBattle(req: Request, res: Response) {
  const { id } = req.params;
  const { userId, choice } = req.body;
  if (!userId || !['a', 'b'].includes(choice)) {
    return res.status(400).json({ error: 'userId and choice (a/b) are required' });
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

    const existing = await client.query(
      `SELECT choice FROM battle_votes WHERE battle_id=$1 AND user_id=$2`, [id, uid]
    );
    if (existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Already voted in this battle' });
    }

    await client.query(
      `INSERT INTO battle_votes (battle_id, user_id, choice) VALUES ($1,$2,$3)`,
      [id, uid, choice]
    );
    await client.query(
      `UPDATE battles SET
         votes_a = (SELECT COUNT(*) FROM battle_votes WHERE battle_id=$1 AND choice='a'),
         votes_b = (SELECT COUNT(*) FROM battle_votes WHERE battle_id=$1 AND choice='b')
       WHERE id=$1`, [id]
    );
    // Give XP for voting
    await client.query(
      `UPDATE users SET xp = xp + 5, weekly_xp = weekly_xp + 5 WHERE id=$1`, [uid]
    );

    const bRes = await client.query(
      `SELECT votes_a, votes_b FROM battles WHERE id=$1`, [id]
    );
    const { votes_a, votes_b } = bRes.rows[0];
    const total = votes_a + votes_b;
    const userVotes = choice === 'a' ? votes_a : votes_b;
    const userPct = total > 0 ? Math.round((userVotes / total) * 100) : 100;
    const isMinority = userPct <= 30;

    await client.query('COMMIT');
    res.json({
      choice,
      votesA: votes_a,
      votesB: votes_b,
      total,
      pctA: total > 0 ? Math.round((votes_a / total) * 100) : 0,
      pctB: total > 0 ? Math.round((votes_b / total) * 100) : 0,
      userPercentage: userPct,
      isMinority,
      minorityMessage: isMinority ? `Ti je në ${userPct}% të njerëzve 🔥` : null
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('voteBattle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
}

export async function createBattle(req: Request, res: Response) {
  const { questionId, title, optionA, optionB, hoursActive = 24 } = req.body;
  if (!title || !optionA || !optionB) {
    return res.status(400).json({ error: 'title, optionA and optionB are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO battles (question_id, title, option_a, option_b, ends_at)
       VALUES ($1,$2,$3,$4, NOW() + ($5 || ' hours')::INTERVAL)
       RETURNING *`,
      [questionId || null, title, optionA, optionB, hoursActive]
    );
    res.status(201).json(enrichBattle(result.rows[0]));
  } catch (err) {
    console.error('createBattle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function enrichBattle(b: any) {
  const total = b.votes_a + b.votes_b;
  return {
    ...b,
    total,
    pctA: total > 0 ? Math.round((b.votes_a / total) * 100) : 50,
    pctB: total > 0 ? Math.round((b.votes_b / total) * 100) : 50,
    timeRemaining: b.ends_at ? Math.max(0, Math.floor((new Date(b.ends_at).getTime() - Date.now()) / 1000)) : 0
  };
}
