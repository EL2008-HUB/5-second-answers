const BADGES = [
  {
    id: "five_second",
    name: "5s Flash",
    emoji: "⚡",
    description: "Posted an answer inside the 5 second window",
    category: "speed",
    criteria: { firstFastAnswer: 1 },
    order: 0,
  },
  {
    id: "ten_second",
    name: "10s Turtle",
    emoji: "🐢",
    description: "Used the extra 5 seconds and still posted",
    category: "speed",
    criteria: { firstSlowAnswer: 1 },
    order: 1,
  },
  {
    id: "star",
    name: "Star",
    emoji: "⭐",
    description: "Received 50+ likes",
    category: "engagement",
    criteria: { likesReceived: 50 },
    order: 2,
  },
  {
    id: "active",
    name: "Active",
    emoji: "🚀",
    description: "Answered 20+ questions",
    category: "contributor",
    criteria: { answersGiven: 20 },
    order: 3,
  },
  {
    id: "vip",
    name: "VIP",
    emoji: "👑",
    description: "Received 500+ total views",
    category: "impact",
    criteria: { viewsReceived: 500 },
    order: 4,
  },
  {
    id: "rapid_fire",
    name: "Rapid Fire",
    emoji: "⚡",
    description: "Answered 5+ questions in one day",
    category: "streak",
    criteria: { answersInOneDay: 5 },
    order: 5,
  },
  {
    id: "perfect_score",
    name: "Perfect Score",
    emoji: "🎯",
    description: "10+ answers with 100% AI approval",
    category: "quality",
    criteria: { perfectAnswers: 10 },
    order: 6,
  },
  {
    id: "influencer",
    name: "Influencer",
    emoji: "🌟",
    description: "1000+ followers",
    category: "influence",
    criteria: { followers: 1000 },
    order: 7,
  },
  {
    id: "beta_tester",
    name: "Beta Tester",
    emoji: "🧪",
    description: "Joined during MVP phase (manually awarded)",
    category: "special",
    criteria: { manual: true },
    order: 8,
  },
  {
    id: "expert",
    name: "Expert",
    emoji: "🎓",
    description: "100+ helpful answers with high quality score",
    category: "mastery",
    criteria: { expertAnswers: 100 },
    order: 9,
  },
];

exports.up = async (knex) => {
  const hasBadgesTable = await knex.schema.hasTable("badges");

  if (!hasBadgesTable) {
    return;
  }

  for (const badge of BADGES) {
    await knex("badges")
      .insert(badge)
      .onConflict("id")
      .merge({
        name: badge.name,
        emoji: badge.emoji,
        description: badge.description,
        category: badge.category,
        criteria: badge.criteria,
        order: badge.order,
        updated_at: knex.fn.now(),
      });
  }

  console.log("Badge catalog synced");
};

exports.down = async (knex) => {
  const hasBadgesTable = await knex.schema.hasTable("badges");

  if (!hasBadgesTable) {
    return;
  }

  await knex("badges").whereIn("id", ["five_second", "ten_second"]).del();

  console.log("Week 2 badge catalog rollback complete");
};
