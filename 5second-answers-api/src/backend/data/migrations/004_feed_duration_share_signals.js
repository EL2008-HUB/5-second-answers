exports.up = async (knex) => {
  await knex.schema.alterTable("user_answer_signals", (table) => {
    table.integer("share_count").defaultTo(0);
  });

  await knex.schema.alterTable("user_daily_stats", (table) => {
    table.integer("shares_count").defaultTo(0);
  });

  console.log("Feed duration/share signals added");
};

exports.down = async (knex) => {
  await knex.schema.alterTable("user_daily_stats", (table) => {
    table.dropColumn("shares_count");
  });

  await knex.schema.alterTable("user_answer_signals", (table) => {
    table.dropColumn("share_count");
  });

  console.log("Feed duration/share signals removed");
};
