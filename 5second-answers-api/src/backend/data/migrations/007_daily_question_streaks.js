exports.up = async (knex) => {
  const hasIsDaily = await knex.schema.hasColumn("questions", "is_daily");
  if (!hasIsDaily) {
    await knex.schema.alterTable("questions", (table) => {
      table.boolean("is_daily").notNullable().defaultTo(false);
      table.index("is_daily");
    });
  }

  const hasExpiresAt = await knex.schema.hasColumn("questions", "expires_at");
  if (!hasExpiresAt) {
    await knex.schema.alterTable("questions", (table) => {
      table.timestamp("expires_at").nullable();
      table.index("expires_at");
    });
  }

  const hasUserStreaks = await knex.schema.hasTable("user_streaks");
  if (!hasUserStreaks) {
    await knex.schema.createTable("user_streaks", (table) => {
      table
        .uuid("user_id")
        .primary()
        .references("users.id")
        .onDelete("CASCADE");
      table.integer("current_streak").notNullable().defaultTo(0);
      table.date("last_answer_date").nullable();
      table.timestamps(true, true);

      table.index("last_answer_date");
    });
  }

  console.log("Daily questions and user streaks ready");
};

exports.down = async (knex) => {
  const hasUserStreaks = await knex.schema.hasTable("user_streaks");
  if (hasUserStreaks) {
    await knex.schema.dropTableIfExists("user_streaks");
  }

  const hasExpiresAt = await knex.schema.hasColumn("questions", "expires_at");
  if (hasExpiresAt) {
    await knex.schema.alterTable("questions", (table) => {
      table.dropColumn("expires_at");
    });
  }

  const hasIsDaily = await knex.schema.hasColumn("questions", "is_daily");
  if (hasIsDaily) {
    await knex.schema.alterTable("questions", (table) => {
      table.dropColumn("is_daily");
    });
  }

  console.log("Daily questions and user streaks removed");
};
