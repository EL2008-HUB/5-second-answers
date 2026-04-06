const LAUNCH_CHALLENGES = [
  {
    hashtag: "5SecondAnswer",
    title: "Sfida Origjinale",
    description: "Pergjigju pyetjes se dites dhe ndaj me #5SecondAnswer",
    durationHours: 168,
  },
  {
    hashtag: "ConfessionNight",
    title: "Confession Night",
    description: "Rrefe dicka qe nuk e ke thene kurre.",
    durationHours: 24,
  },
  {
    hashtag: "SavageOrNot",
    title: "Savage apo jo?",
    description: "Komuniteti voton nese je realisht savage.",
    durationHours: 48,
  },
  {
    hashtag: "5StackChallenge",
    title: "5 Stack Challenge",
    description: "Bej Story Mode dhe ndaj rezultatin.",
    durationHours: 72,
  },
];

exports.seed = async (knex) => {
  const hasChallenges = await knex.schema.hasTable("challenges");
  const hasHashtags = await knex.schema.hasTable("hashtags");

  if (!hasChallenges || !hasHashtags) {
    return;
  }

  for (const challenge of LAUNCH_CHALLENGES) {
    const normalizedHashtag = challenge.hashtag.toLowerCase();

    await knex("hashtags")
      .insert({
        name: normalizedHashtag,
      })
      .onConflict("name")
      .ignore();

    const existingChallenge = await knex("challenges")
      .where({
        hashtag: normalizedHashtag,
        title: challenge.title,
      })
      .first();

    if (!existingChallenge) {
      await knex("challenges").insert({
        hashtag: normalizedHashtag,
        title: challenge.title,
        description: challenge.description,
        starts_at: knex.fn.now(),
        ends_at: new Date(Date.now() + challenge.durationHours * 60 * 60 * 1000).toISOString(),
        is_active: true,
        entry_count: 0,
      });
    }
  }
};
