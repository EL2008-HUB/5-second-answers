exports.up = async (knex) => {
  await knex.schema.createTable("expert_requests", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("question_id")
      .notNullable()
      .references("questions.id")
      .onDelete("CASCADE");
    table
      .uuid("requester_user_id")
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    table
      .uuid("expert_user_id")
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    table.string("category").defaultTo("general");
    table.integer("price_cents").notNullable().defaultTo(100);
    table.boolean("priority").notNullable().defaultTo(true);
    table.integer("max_answer_seconds").notNullable().defaultTo(10);
    table.string("status").notNullable().defaultTo("requested");
    table.string("payment_status").notNullable().defaultTo("reserved");
    table
      .uuid("answered_answer_id")
      .nullable()
      .references("answers.id")
      .onDelete("SET NULL");
    table.timestamp("answered_at").nullable();
    table.jsonb("metadata").notNullable().defaultTo(
      JSON.stringify({
        product: "ask_experts_fast_answer",
        priorityWindowHours: 24,
      })
    );
    table.timestamps(true, true);

    table.unique(["question_id"]);
    table.index("expert_user_id");
    table.index("requester_user_id");
    table.index("status");
    table.index(["expert_user_id", "status"]);
  });

  console.log("Expert request table created");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("expert_requests");
  console.log("Expert request table dropped");
};
