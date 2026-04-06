exports.up = async (knex) => {
  const hasPushTokens = await knex.schema.hasTable("user_push_tokens");
  if (!hasPushTokens) {
    await knex.schema.createTable("user_push_tokens", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table
        .uuid("user_id")
        .notNullable()
        .references("users.id")
        .onDelete("CASCADE");
      table.string("expo_push_token").notNullable().unique();
      table.string("platform").nullable();
      table.string("device_name").nullable();
      table.string("app_version").nullable();
      table.boolean("is_active").notNullable().defaultTo(true);
      table.timestamp("last_registered_at").notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.index("user_id");
      table.index("is_active");
      table.index("last_registered_at");
    });
  }

  const hasDeliveryLog = await knex.schema.hasTable("notification_delivery_log");
  if (!hasDeliveryLog) {
    await knex.schema.createTable("notification_delivery_log", (table) => {
      table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
      table
        .uuid("user_id")
        .notNullable()
        .references("users.id")
        .onDelete("CASCADE");
      table
        .uuid("notification_id")
        .nullable()
        .references("notifications.id")
        .onDelete("SET NULL");
      table.string("type").notNullable();
      table.string("channel").notNullable().defaultTo("push");
      table.string("status").notNullable().defaultTo("sent");
      table.jsonb("metadata").notNullable().defaultTo("{}");
      table.timestamp("sent_at").notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.index("user_id");
      table.index("type");
      table.index("channel");
      table.index("sent_at");
    });
  }

  console.log("Push notification tables ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("notification_delivery_log");
  await knex.schema.dropTableIfExists("user_push_tokens");

  console.log("Push notification tables removed");
};
