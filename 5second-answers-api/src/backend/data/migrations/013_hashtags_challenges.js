exports.up = async (knex) => {
  const hasHashtags = await knex.schema.hasTable("hashtags");
  if (!hasHashtags) {
    await knex.schema.createTable("hashtags", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.string("name").notNullable().unique();
      table.integer("post_count").notNullable().defaultTo(0);
      table.timestamps(true, true);

      table.index(["post_count", "created_at"], "hashtags_count_idx");
    });
  }

  const hasAnswerHashtags = await knex.schema.hasTable("answer_hashtags");
  if (!hasAnswerHashtags) {
    await knex.schema.createTable("answer_hashtags", (table) => {
      table
        .uuid("answer_id")
        .notNullable()
        .references("answers.id")
        .onDelete("CASCADE");
      table
        .uuid("hashtag_id")
        .notNullable()
        .references("hashtags.id")
        .onDelete("CASCADE");
      table.timestamps(true, true);

      table.primary(["answer_id", "hashtag_id"]);
      table.index("hashtag_id");
      table.index("answer_id");
    });
  }

  const hasChallenges = await knex.schema.hasTable("challenges");
  if (!hasChallenges) {
    await knex.schema.createTable("challenges", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.string("hashtag").notNullable();
      table.string("title").notNullable();
      table.text("description").nullable();
      table.timestamp("starts_at").nullable();
      table.timestamp("ends_at").nullable();
      table.boolean("is_active").notNullable().defaultTo(true);
      table.integer("entry_count").notNullable().defaultTo(0);
      table.timestamps(true, true);

      table.index(["is_active", "ends_at"], "challenges_active_idx");
      table.index("hashtag");
    });
  }

  console.log("Hashtag and challenge tables ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("challenges");
  await knex.schema.dropTableIfExists("answer_hashtags");
  await knex.schema.dropTableIfExists("hashtags");

  console.log("Hashtag and challenge tables removed");
};
