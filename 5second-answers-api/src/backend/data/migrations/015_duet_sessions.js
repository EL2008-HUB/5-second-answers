exports.up = async (knex) => {
  const hasDuetSessions = await knex.schema.hasTable("duet_sessions");
  if (!hasDuetSessions) {
    await knex.schema.createTable("duet_sessions", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table
        .uuid("question_id")
        .nullable()
        .references("questions.id")
        .onDelete("SET NULL");
      table.text("question_text").notNullable();

      table
        .uuid("user1_id")
        .notNullable()
        .references("users.id")
        .onDelete("CASCADE");
      table
        .uuid("user1_answer_id")
        .nullable()
        .references("answers.id")
        .onDelete("SET NULL");
      table.text("user1_answer").nullable();
      table.integer("user1_seconds").nullable();

      table
        .uuid("user2_id")
        .nullable()
        .references("users.id")
        .onDelete("SET NULL");
      table
        .uuid("user2_answer_id")
        .nullable()
        .references("answers.id")
        .onDelete("SET NULL");
      table.text("user2_answer").nullable();
      table.integer("user2_seconds").nullable();

      table.string("status").notNullable().defaultTo("pending");
      table
        .uuid("winner_id")
        .nullable()
        .references("users.id")
        .onDelete("SET NULL");
      table.jsonb("reaction_counts").notNullable().defaultTo("{}");
      table.jsonb("metadata").notNullable().defaultTo("{}");
      table.timestamp("expires_at").notNullable().defaultTo(knex.raw("now() + interval '24 hours'"));
      table.timestamps(true, true);

      table.index(["user2_id", "status"], "duet_user2_pending_idx");
      table.index("question_id");
      table.index("created_at");
      table.index("status");
    });
  }

  console.log("Duet sessions ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("duet_sessions");
  console.log("Duet sessions removed");
};
