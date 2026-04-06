exports.up = async (knex) => {
  const hasTable = await knex.schema.hasTable("launch_feedback");
  if (hasTable) {
    return;
  }

  await knex.schema.createTable("launch_feedback", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .nullable()
      .references("users.id")
      .onDelete("SET NULL");
    table
      .uuid("hot_question_id")
      .nullable()
      .references("questions.id")
      .onDelete("SET NULL");
    table
      .uuid("daily_question_id")
      .nullable()
      .references("questions.id")
      .onDelete("SET NULL");
    table.boolean("understood_immediately").notNullable().defaultTo(false);
    table.boolean("would_return").notNullable().defaultTo(false);
    table.text("notes").nullable();
    table.timestamps(true, true);

    table.index("created_at");
    table.index("user_id");
  });

  console.log("Launch feedback table ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("launch_feedback");
  console.log("Launch feedback table removed");
};
