import { Request, Response } from 'express';
import pool from '../db/pool';

// Phase 4: Share Feature — "Your Result" screen data
export async function getShareData(req: Request, res: Response) {
  const { questionId, userId } = req.query;
  if (!questionId) return res.status(400).json({ error: 'questionId is required' });
  try {
    const qRes = await pool.query(
      `SELECT id, text, vote_yes, vote_no, answer_count FROM questions WHERE id=$1`, [questionId]
    );
    if (!qRes.rows.length) return res.status(404).json({ error: 'Question not found' });
    const q = qRes.rows[0];
    const total = q.vote_yes + q.vote_no;

    let userVote: string | null = null;
    let userPercentage: number | null = null;
    let isMinority = false;

    if (userId) {
      const uRes = await pool.query(
        `SELECT id FROM users WHERE username=$1 OR id::text=$1`, [userId]
      );
      if (uRes.rows.length) {
        const vRes = await pool.query(
          `SELECT vote FROM quick_votes WHERE question_id=$1 AND user_id=$2`,
          [questionId, uRes.rows[0].id]
        );
        if (vRes.rows.length) {
          userVote = vRes.rows[0].vote;
          const sideCount = userVote === 'yes' ? q.vote_yes : q.vote_no;
          userPercentage = total > 0 ? Math.round((sideCount / total) * 100) : 100;
          isMinority = userPercentage <= 30;
        }
      }
    }

    const shareText = userVote && userPercentage !== null
      ? isMinority
        ? `Unë jam në ${userPercentage}% të njerëzve që thanë "${userVote === 'yes' ? 'PO' : 'JO'}"! 🔥 Ti çfarë mendon? #5SecondAnswers`
        : `Unë jam me ${userPercentage}% të njerëzve! Pajtohem apo jo? #5SecondAnswers`
      : `Çfarë mendon? ${q.text} #5SecondAnswers`;

    res.json({
      question: { id: q.id, text: q.text },
      stats: {
        voteYes: q.vote_yes,
        voteNo: q.vote_no,
        total,
        yesPct: total > 0 ? Math.round((q.vote_yes / total) * 100) : 0,
        noPct: total > 0 ? Math.round((q.vote_no / total) * 100) : 0
      },
      user: {
        vote: userVote,
        percentage: userPercentage,
        isMinority
      },
      shareText,
      hashtags: ['5SecondAnswers', 'Opinion', 'Albania', 'Shqipëri'],
      deepLink: `https://5secondanswers.app/q/${questionId}`
    });
  } catch (err) {
    console.error('getShareData error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getResultScreen(req: Request, res: Response) {
  const { battleId, userId } = req.query;
  if (!battleId) return res.status(400).json({ error: 'battleId is required' });
  try {
    const bRes = await pool.query(
      `SELECT id, title, option_a, option_b, votes_a, votes_b FROM battles WHERE id=$1`, [battleId]
    );
    if (!bRes.rows.length) return res.status(404).json({ error: 'Battle not found' });
    const b = bRes.rows[0];
    const total = b.votes_a + b.votes_b;

    let userChoice: string | null = null;
    let userPct: number | null = null;
    let isMinority = false;

    if (userId) {
      const uRes = await pool.query(
        `SELECT id FROM users WHERE username=$1 OR id::text=$1`, [userId]
      );
      if (uRes.rows.length) {
        const vRes = await pool.query(
          `SELECT choice FROM battle_votes WHERE battle_id=$1 AND user_id=$2`,
          [battleId, uRes.rows[0].id]
        );
        if (vRes.rows.length) {
          userChoice = vRes.rows[0].choice;
          const sideCount = userChoice === 'a' ? b.votes_a : b.votes_b;
          userPct = total > 0 ? Math.round((sideCount / total) * 100) : 100;
          isMinority = userPct <= 30;
        }
      }
    }

    const shareText = userChoice && userPct !== null
      ? isMinority
        ? `Unë jam në ${userPct}% të njerëzve! Zgjedhja e rrallë 🔥 #5SecondAnswers`
        : `Jam me ${userPct}% të njerëzve në "${userChoice === 'a' ? b.option_a : b.option_b}"! #5SecondAnswers`
      : `${b.title} — cila është zgjidhja jote? #5SecondAnswers`;

    res.json({
      battle: { id: b.id, title: b.title, optionA: b.option_a, optionB: b.option_b },
      stats: {
        votesA: b.votes_a, votesB: b.votes_b, total,
        pctA: total > 0 ? Math.round((b.votes_a / total) * 100) : 50,
        pctB: total > 0 ? Math.round((b.votes_b / total) * 100) : 50
      },
      user: { choice: userChoice, percentage: userPct, isMinority },
      shareText
    });
  } catch (err) {
    console.error('getResultScreen error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
