exports.up = async (knex) => {
  await knex.schema.createTable("rooms", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table.string("host_user_id").notNullable();
    table.string("title").notNullable();
    table.string("topic").notNullable().defaultTo("general");
    table.text("question_text").notNullable();
    table.integer("max_users").notNullable().defaultTo(6);
    table.string("status").notNullable().defaultTo("waiting");
    table.string("invite_code").notNullable().unique();
    table.timestamp("last_activity_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("expires_at").nullable();
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamps(true, true);

    table.index(["status", "last_activity_at"]);
    table.index(["topic", "status"]);
  });

  await knex.schema.createTable("room_participants", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("room_id")
      .notNullable()
      .references("rooms.id")
      .onDelete("CASCADE");
    table.string("user_id").notNullable();
    table.string("username").notNullable();
    table.string("socket_id").nullable();
    table.string("status").notNullable().defaultTo("active");
    table.timestamp("joined_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("last_seen_at").notNullable().defaultTo(knex.fn.now());
    table.timestamp("left_at").nullable();
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamps(true, true);

    table.unique(["room_id", "user_id"]);
    table.index(["room_id", "status"]);
    table.index(["socket_id"]);
    table.index(["last_seen_at"]);
  });

  await knex.schema.createTable("room_entries", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("room_id")
      .notNullable()
      .references("rooms.id")
      .onDelete("CASCADE");
    table.string("user_id").notNullable();
    table.string("username").notNullable();
    table.string("type").notNullable().defaultTo("text");
    table.text("text").nullable();
    table.text("media_url").nullable();
    table.string("mime_type").nullable();
    table.integer("duration").notNullable().defaultTo(0);
    table.jsonb("metadata").notNullable().defaultTo("{}");
    table.timestamps(true, true);

    table.index(["room_id", "created_at"]);
    table.index(["user_id", "created_at"]);
    table.index(["type"]);
  });

  console.log("Rooms persistence ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("room_entries");
  await knex.schema.dropTableIfExists("room_participants");
  await knex.schema.dropTableIfExists("rooms");

  console.log("Rooms persistence removed");
};
