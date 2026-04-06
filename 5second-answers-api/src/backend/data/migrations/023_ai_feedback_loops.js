exports.up = async (knex) => {
  const hasTable = await knex.schema.hasTable("ai_feedback_events");

  if (!hasTable) {
    await knex.schema.createTable("ai_feedback_events", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.uuid("user_id").nullable().references("id").inTable("users").onDelete("SET NULL");
      table.uuid("answer_id").nullable().references("id").inTable("answers").onDelete("CASCADE");
      table.string("task_type").notNullable();
      table.string("signal").notNullable();
      table.string("source_type").notNullable().defaultTo("manual");
      table.string("source_id").nullable();
      table.string("country", 8).nullable();
      table.string("lang_code", 12).nullable();
      table.decimal("score", 8, 4).notNullable().defaultTo(0);
      table.jsonb("metadata").notNullable().defaultTo("{}");
      table.timestamps(true, true);

      table.index(["task_type", "created_at"]);
      table.index(["country", "created_at"]);
      table.index(["answer_id", "created_at"]);
      table.index(["signal", "created_at"]);
    });
  }

  console.log("AI feedback loops table ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("ai_feedback_events");
  console.log("AI feedback loops table removed");
};
