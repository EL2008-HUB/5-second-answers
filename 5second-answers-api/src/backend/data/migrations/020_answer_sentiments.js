exports.up = async (knex) => {
  const hasTable = await knex.schema.hasTable("answer_sentiments");
  if (hasTable) {
    return;
  }

  await knex.schema.createTable("answer_sentiments", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("answer_id")
      .notNullable()
      .references("answers.id")
      .onDelete("CASCADE")
      .unique();
    table.string("emotion", 32).notNullable().defaultTo("neutral");
    table.decimal("intensity", 4, 2).notNullable().defaultTo(0);
    table.decimal("debate_score", 4, 2).notNullable().defaultTo(0);
    table.timestamps(true, true);

    table.index("emotion");
    table.index("created_at");
  });

  console.log("Answer sentiments table ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("answer_sentiments");
  console.log("Answer sentiments table removed");
};
