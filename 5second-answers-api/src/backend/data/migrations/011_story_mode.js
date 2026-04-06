exports.up = async (knex) => {
  const hasStoryPacks = await knex.schema.hasTable("story_packs");
  if (!hasStoryPacks) {
    await knex.schema.createTable("story_packs", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table.text("title").notNullable();
      table.text("description").nullable();
      table.string("category").notNullable();
      table.boolean("is_active").notNullable().defaultTo(true);
      table.timestamps(true, true);
      table.index(["category", "is_active"], "story_packs_category_active_idx");
    });
  }

  const hasStoryQuestions = await knex.schema.hasTable("story_questions");
  if (!hasStoryQuestions) {
    await knex.schema.createTable("story_questions", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table
        .uuid("pack_id")
        .notNullable()
        .references("story_packs.id")
        .onDelete("CASCADE");
      table.text("question").notNullable();
      table.integer("order_index").notNullable();
      table.string("lang", 5).notNullable().defaultTo("sq");
      table.timestamps(true, true);
      table.unique(["pack_id", "order_index"], "story_questions_pack_order_idx");
      table.index(["pack_id", "lang"], "story_questions_pack_lang_idx");
    });
  }

  const hasStorySessions = await knex.schema.hasTable("story_sessions");
  if (!hasStorySessions) {
    await knex.schema.createTable("story_sessions", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table
        .uuid("user_id")
        .notNullable()
        .references("users.id")
        .onDelete("CASCADE");
      table
        .uuid("pack_id")
        .notNullable()
        .references("story_packs.id")
        .onDelete("CASCADE");
      table.jsonb("answers").notNullable().defaultTo("[]");
      table.jsonb("emotion_score").notNullable().defaultTo("{}");
      table.string("primary_emotion").nullable();
      table.string("lang", 5).notNullable().defaultTo("sq");
      table.boolean("completed").notNullable().defaultTo(false);
      table.timestamps(true, true);
      table.index(["user_id", "created_at"], "story_sessions_user_created_idx");
      table.index(["pack_id", "completed"], "story_sessions_pack_completed_idx");
      table.index(["primary_emotion"], "story_sessions_primary_emotion_idx");
    });
  }

  console.log("Story mode tables ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("story_sessions");
  await knex.schema.dropTableIfExists("story_questions");
  await knex.schema.dropTableIfExists("story_packs");

  console.log("Story mode tables removed");
};
