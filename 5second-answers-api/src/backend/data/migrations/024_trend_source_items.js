exports.up = async (knex) => {
  const hasTable = await knex.schema.hasTable("trend_source_items");

  if (!hasTable) {
    await knex.schema.createTable("trend_source_items", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.string("country", 8).notNullable();
      table.string("fingerprint", 255).notNullable();
      table.string("source_type", 64).notNullable();
      table.string("source_name", 128).notNullable();
      table.string("external_id", 255).nullable();
      table.text("title").notNullable();
      table.text("url").nullable();
      table.timestamp("published_at").nullable();
      table.string("category_id", 64).nullable();
      table.decimal("engagement_score", 8, 2).notNullable().defaultTo(0);
      table.decimal("emotion_score", 8, 2).notNullable().defaultTo(0);
      table.decimal("recency_score", 8, 2).notNullable().defaultTo(0);
      table.decimal("uniqueness_score", 8, 2).notNullable().defaultTo(0);
      table.decimal("viral_score", 8, 2).notNullable().defaultTo(0);
      table.text("ai_question").nullable();
      table.text("ai_insight").nullable();
      table.text("ai_action").nullable();
      table.string("ai_risk", 16).nullable();
      table.jsonb("metadata").notNullable().defaultTo("{}");
      table.timestamp("last_seen_at").notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.unique(["country", "fingerprint"]);
      table.index(["country", "source_type"]);
      table.index(["country", "viral_score"]);
      table.index(["country", "published_at"]);
    });
  }

  console.log("Trend source items table ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("trend_source_items");
  console.log("Trend source items table removed");
};
