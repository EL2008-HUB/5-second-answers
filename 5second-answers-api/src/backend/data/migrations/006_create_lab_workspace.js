exports.up = async (knex) => {
  await knex.schema.createTable("create_lab_items", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("user_id")
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    table.string("item_kind").notNullable().defaultTo("saved_concept");
    table.string("title").notNullable();
    table.text("prompt").notNullable();
    table.string("category").notNullable().defaultTo("general");
    table.text("angle").nullable();
    table.string("intent").notNullable().defaultTo("ask");
    table.string("source").notNullable().defaultTo("create_lab");
    table
      .uuid("question_id")
      .nullable()
      .references("questions.id")
      .onDelete("SET NULL");
    table.string("creator_username").nullable();
    table.string("ask_mode").nullable();
    table.string("action").nullable();
    table.integer("usage_count").notNullable().defaultTo(1);
    table.jsonb("metadata").notNullable().defaultTo(JSON.stringify({}));
    table.timestamp("last_used_at").notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.index("user_id");
    table.index("item_kind");
    table.index("question_id");
    table.index("last_used_at");
    table.index(["user_id", "item_kind"]);
    table.index(["user_id", "last_used_at"]);
  });

  console.log("Create Lab workspace table created");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("create_lab_items");
  console.log("Create Lab workspace table dropped");
};
