exports.up = async (knex) => {
  const hasImportedPosts = await knex.schema.hasTable("social_imported_posts");
  if (!hasImportedPosts) {
    await knex.schema.createTable("social_imported_posts", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.string("provider").notNullable();
      table.string("external_post_id").notNullable();
      table.string("author_handle").nullable();
      table.string("author_name").nullable();
      table.text("caption").nullable();
      table.string("canonical_url").notNullable();
      table.string("thumbnail_url").nullable();
      table.string("media_type").nullable();
      table.timestamp("posted_at").nullable();
      table.jsonb("hashtags").notNullable().defaultTo("[]");
      table.jsonb("metadata").notNullable().defaultTo("{}");
      table.timestamps(true, true);

      table.unique(["provider", "external_post_id"]);
      table.index("provider");
      table.index("posted_at");
    });
  }

  const hasIngestionRuns = await knex.schema.hasTable("social_ingestion_runs");
  if (!hasIngestionRuns) {
    await knex.schema.createTable("social_ingestion_runs", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.string("provider").notNullable();
      table.string("source_type").notNullable().defaultTo("manual");
      table.string("status").notNullable().defaultTo("received");
      table.integer("imported_count").notNullable().defaultTo(0);
      table.jsonb("metadata").notNullable().defaultTo("{}");
      table.timestamps(true, true);

      table.index(["provider", "created_at"], "social_ingestion_runs_provider_idx");
    });
  }

  console.log("Social ingestion tables ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("social_ingestion_runs");
  await knex.schema.dropTableIfExists("social_imported_posts");

  console.log("Social ingestion tables removed");
};
