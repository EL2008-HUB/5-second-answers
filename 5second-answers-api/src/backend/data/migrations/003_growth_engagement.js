exports.up = async (knex) => {
  await knex.schema.alterTable("answers", (table) => {
    table
      .jsonb("battle_stats")
      .notNullable()
      .defaultTo(JSON.stringify({ votes: 0 }));
  });

  await knex("answers")
    .whereNull("battle_stats")
    .update({ battle_stats: { votes: 0 } });

  await knex.schema.createTable("user_answer_signals", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    table
      .uuid("answer_id")
      .notNullable()
      .references("answers.id")
      .onDelete("CASCADE");
    table
      .uuid("question_id")
      .nullable()
      .references("questions.id")
      .onDelete("CASCADE");
    table
      .uuid("creator_user_id")
      .nullable()
      .references("users.id")
      .onDelete("SET NULL");
    table.string("category").defaultTo("general");
    table.integer("view_count").defaultTo(0);
    table.integer("completed_views").defaultTo(0);
    table.integer("replay_count").defaultTo(0);
    table.integer("total_watch_ms").defaultTo(0);
    table.integer("save_count").defaultTo(0);
    table.integer("like_count").defaultTo(0);
    table.timestamp("last_viewed_at").nullable();
    table.timestamp("last_interaction_at").nullable();
    table.timestamps(true, true);

    table.unique(["user_id", "answer_id"]);
    table.index("user_id");
    table.index("answer_id");
    table.index("category");
    table.index("creator_user_id");
    table.index("last_interaction_at");
  });

  await knex.schema.createTable("user_daily_stats", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    table.date("activity_date").notNullable();
    table.integer("watch_count").defaultTo(0);
    table.integer("answers_posted").defaultTo(0);
    table.integer("watch_time_ms").defaultTo(0);
    table.integer("replay_count").defaultTo(0);
    table.integer("saves_count").defaultTo(0);
    table.integer("likes_given").defaultTo(0);
    table.integer("completed_answers").defaultTo(0);
    table.timestamps(true, true);

    table.unique(["user_id", "activity_date"]);
    table.index("user_id");
    table.index("activity_date");
    table.index(["user_id", "activity_date"]);
  });

  await knex.schema.createTable("answer_battle_votes", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("question_id")
      .notNullable()
      .references("questions.id")
      .onDelete("CASCADE");
    table
      .uuid("answer_id")
      .notNullable()
      .references("answers.id")
      .onDelete("CASCADE");
    table
      .uuid("competitor_answer_id")
      .nullable()
      .references("answers.id")
      .onDelete("SET NULL");
    table
      .uuid("user_id")
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    table.timestamps(true, true);

    table.unique(["question_id", "user_id"]);
    table.index("question_id");
    table.index("answer_id");
    table.index("user_id");
  });

  console.log("Growth engagement tables created");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("answer_battle_votes");
  await knex.schema.dropTableIfExists("user_daily_stats");
  await knex.schema.dropTableIfExists("user_answer_signals");

  await knex.schema.alterTable("answers", (table) => {
    table.dropColumn("battle_stats");
  });

  console.log("Growth engagement tables dropped");
};
