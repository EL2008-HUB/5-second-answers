import { Request, Response } from 'express';
import pool from '../db/pool';

// Scrollable Feed — Phase 2 & 3
export async function getFeed(req: Request, res: Response) {
  const { country = 'ALL', lang = 'sq', limit = 20, offset = 0 } = req.query;
  try {
    // Parallel fetch: trending questions + active battles + recent answers
    const [questionsRes, battlesRes, answersRes] = await Promise.all([
      pool.query(
        `SELECT q.id, q.text, q.lang_code, q.category, q.vote_yes, q.vote_no,
                q.answer_count, q.view_count, q.is_daily, q.created_at,
                'question' as item_type
         FROM questions q
         WHERE (q.country_code = $1 OR q.country_code = 'ALL')
           AND (q.lang_code = $2 OR $2 = 'all')
         ORDER BY (q.vote_yes + q.vote_no + q.answer_count * 2) DESC, q.created_at DESC
         LIMIT $3 OFFSET $4`,
        [country, lang, Math.ceil(Number(limit) * 0.5), offset]
      ),
      pool.query(
        `SELECT b.id, b.title, b.option_a, b.option_b, b.votes_a, b.votes_b,
                b.ends_at, 'battle' as item_type
         FROM battles b
         WHERE b.is_active = TRUE AND b.ends_at > NOW()
         ORDER BY (b.votes_a + b.votes_b) DESC
         LIMIT 5`
      ),
      pool.query(
        `SELECT a.id, a.content, a.like_count, a.reaction_fire, a.reaction_mindblown,
                a.reaction_angry, a.created_at,
                u.username, u.display_name,
                q.text as question_text, q.id as question_id,
                'answer' as item_type
         FROM answers a
         JOIN users u ON a.user_id = u.id
         JOIN questions q ON a.question_id = q.id
         WHERE a.is_approved = TRUE
         ORDER BY (a.like_count + a.reaction_fire + a.reaction_mindblown) DESC, a.created_at DESC
         LIMIT $1`,
        [Math.ceil(Number(limit) * 0.3)]
      )
    ]);

    // Interleave: question, battle (if available), answer, question...
    const items: any[] = [];
    const questions = questionsRes.rows.map(q => ({
      ...q,
      totalVotes: q.vote_yes + q.vote_no,
      yesPct: (q.vote_yes + q.vote_no) > 0
        ? Math.round((q.vote_yes / (q.vote_yes + q.vote_no)) * 100) : 0
    }));
    const battles = battlesRes.rows.map(b => {
      const total = b.votes_a + b.votes_b;
      return { ...b, total, pctA: total > 0 ? Math.round((b.votes_a / total) * 100) : 50, pctB: total > 0 ? Math.round((b.votes_b / total) * 100) : 50 };
    });
    const answers = answersRes.rows;

    let qi = 0, bi = 0, ai = 0;
    while (qi < questions.length || bi < battles.length || ai < answers.length) {
      if (qi < questions.length) items.push(questions[qi++]);
      if (bi < battles.length) items.push(battles[bi++]);
      if (ai < answers.length) items.push(answers[ai++]);
      if (qi < questions.length) items.push(questions[qi++]);
    }

    res.json({ feed: items, total: items.length });
  } catch (err) {
    console.error('getFeed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getTrending(req: Request, res: Response) {
  const { country = 'ALL', lang = 'sq', limit = 10 } = req.query;
  try {
    const result = await pool.query(
      `SELECT q.id, q.text, q.lang_code, q.category, q.vote_yes, q.vote_no,
              q.answer_count, q.view_count, q.created_at,
              (q.vote_yes + q.vote_no + q.answer_count * 3 + q.view_count) as hot_score
       FROM questions q
       WHERE (q.country_code = $1 OR q.country_code = 'ALL')
         AND q.created_at > NOW() - INTERVAL '7 days'
       ORDER BY hot_score DESC
       LIMIT $2`,
      [country, limit]
    );
    res.json({ trending: result.rows });
  } catch (err) {
    console.error('getTrending error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getCountries(req: Request, res: Response) {
  res.json({
    countries: [
      { code: 'ALL', name: 'Global 🌍', flag: '🌍' },
      { code: 'AL', name: 'Shqipëri 🇦🇱', flag: '🇦🇱' },
      { code: 'XK', name: 'Kosovë 🇽🇰', flag: '🇽🇰' },
      { code: 'MK', name: 'Maqedoni 🇲🇰', flag: '🇲🇰' },
      { code: 'US', name: 'USA 🇺🇸', flag: '🇺🇸' },
      { code: 'GB', name: 'UK 🇬🇧', flag: '🇬🇧' },
      { code: 'DE', name: 'Germany 🇩🇪', flag: '🇩🇪' },
      { code: 'IT', name: 'Italy 🇮🇹', flag: '🇮🇹' }
    ]
  });
}
