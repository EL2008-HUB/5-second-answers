const { db } = require("../data/db");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
};

const diffDays = (leftKey, rightKey) => {
  if (!leftKey || !rightKey) {
    return null;
  }

  const left = new Date(`${leftKey}T00:00:00.000Z`).getTime();
  const right = new Date(`${rightKey}T00:00:00.000Z`).getTime();
  return Math.round((left - right) / MS_PER_DAY);
};

const getUserStreak = async (userId) => {
  const row = await db("user_streaks").where({ user_id: userId }).first();
  const todayKey = toDateKey();

  if (!row) {
    return {
      userId,
      current: 0,
      lastAnswerDate: null,
    };
  }

  const lastAnswerKey = row.last_answer_date ? toDateKey(row.last_answer_date) : null;
  const dayGap = diffDays(todayKey, lastAnswerKey);
  const currentStreak = Number(row.current_streak || 0);

  if (dayGap !== null && dayGap > 1 && currentStreak !== 0) {
    await db("user_streaks").where({ user_id: userId }).update({
      current_streak: 0,
      updated_at: db.fn.now(),
    });

    return {
      userId,
      current: 0,
      lastAnswerDate: lastAnswerKey,
    };
  }

  return {
    userId,
    current: currentStreak,
    lastAnswerDate: lastAnswerKey,
  };
};

const recordAnswerForUser = async (userId, answeredAt = new Date()) => {
  const todayKey = toDateKey(answeredAt);
  const existing = await db("user_streaks").where({ user_id: userId }).first();

  if (!existing) {
    await db("user_streaks").insert({
      user_id: userId,
      current_streak: 1,
      last_answer_date: todayKey,
    });

    return {
      userId,
      current: 1,
      lastAnswerDate: todayKey,
    };
  }

  const lastAnswerKey = existing.last_answer_date
    ? toDateKey(existing.last_answer_date)
    : null;

  if (lastAnswerKey === todayKey) {
    return {
      userId,
      current: Number(existing.current_streak || 0),
      lastAnswerDate: lastAnswerKey,
    };
  }

  const dayGap = diffDays(todayKey, lastAnswerKey);
  const nextStreak = dayGap === 1 ? Number(existing.current_streak || 0) + 1 : 1;

  await db("user_streaks").where({ user_id: userId }).update({
    current_streak: nextStreak,
    last_answer_date: todayKey,
    updated_at: db.fn.now(),
  });

  return {
    userId,
    current: nextStreak,
    lastAnswerDate: todayKey,
  };
};

module.exports = {
  getUserStreak,
  recordAnswerForUser,
};
