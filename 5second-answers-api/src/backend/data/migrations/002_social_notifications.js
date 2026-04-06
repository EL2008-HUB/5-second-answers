exports.up = async (knex) => {
  await knex.schema.createTable("user_follows", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("follower_user_id")
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    table
      .uuid("followed_user_id")
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    table.timestamps(true, true);

    table.unique(["follower_user_id", "followed_user_id"]);
    table.index("follower_user_id");
    table.index("followed_user_id");
    table.index("created_at");
  });

  await knex.schema.createTable("notifications", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    table
      .uuid("actor_user_id")
      .nullable()
      .references("users.id")
      .onDelete("SET NULL");
    table.string("type").notNullable();
    table.string("entity_type").nullable();
    table.uuid("entity_id").nullable();
    table.string("title").notNullable();
    table.text("message").notNullable();
    table.jsonb("metadata").defaultTo("{}");
    table.timestamp("read_at").nullable();
    table.timestamps(true, true);

    table.index("user_id");
    table.index("actor_user_id");
    table.index("type");
    table.index("read_at");
    table.index("created_at");
  });

  console.log("Social follows and notifications created");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("notifications");
  await knex.schema.dropTableIfExists("user_follows");

  console.log("Social follows and notifications dropped");
};
