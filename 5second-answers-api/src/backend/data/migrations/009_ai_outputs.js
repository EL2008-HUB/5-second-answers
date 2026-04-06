exports.up = async (knex) => {
  const hasTable = await knex.schema.hasTable("ai_outputs");
  if (hasTable) {
    return;
  }

  await knex.schema.createTable("ai_outputs", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("type").notNullable();
    table.jsonb("input").notNullable().defaultTo(JSON.stringify({}));
    table.text("output").notNullable();
    table.timestamps(true, true);

    table.index("type");
    table.index("created_at");
  });

  console.log("AI outputs table ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("ai_outputs");
  console.log("AI outputs table removed");
};
