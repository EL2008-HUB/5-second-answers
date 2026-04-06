exports.up = async (knex) => {
  await knex.schema.alterTable("users", (table) => {
    table.string("invite_code").nullable().unique();
  });

  await knex.schema.createTable("referral_invites", (table) => {
    table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
    table
      .uuid("inviter_user_id")
      .notNullable()
      .references("users.id")
      .onDelete("CASCADE");
    table
      .uuid("invited_user_id")
      .nullable()
      .references("users.id")
      .onDelete("SET NULL");
    table.string("code").notNullable();
    table.string("source").defaultTo("share");
    table
      .enu("status", ["sent", "joined", "activated"], {
        useNative: true,
        enumName: "referral_status",
      })
      .defaultTo("sent");
    table.integer("reward_points").defaultTo(0);
    table.jsonb("metadata").defaultTo("{}");
    table.timestamp("activated_at").nullable();
    table.timestamps(true, true);

    table.index("inviter_user_id");
    table.index("invited_user_id");
    table.index("code");
    table.index("status");
    table.unique(["invited_user_id"]);
  });

  console.log("Referral system ready");
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("referral_invites");
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("invite_code");
  });

  await knex.raw("DROP TYPE IF EXISTS referral_status");

  console.log("Referral system removed");
};
