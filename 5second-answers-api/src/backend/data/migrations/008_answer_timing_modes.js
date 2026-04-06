exports.up = async (knex) => {
  const hasTimeMode = await knex.schema.hasColumn("answers", "time_mode");
  if (!hasTimeMode) {
    await knex.schema.alterTable("answers", (table) => {
      table.string("time_mode").notNullable().defaultTo("5s");
    });
  }

  const hasResponseTime = await knex.schema.hasColumn("answers", "response_time");
  if (!hasResponseTime) {
    await knex.schema.alterTable("answers", (table) => {
      table.decimal("response_time", 4, 1).nullable();
    });
  }

  const hasPenaltyApplied = await knex.schema.hasColumn("answers", "penalty_applied");
  if (!hasPenaltyApplied) {
    await knex.schema.alterTable("answers", (table) => {
      table.boolean("penalty_applied").notNullable().defaultTo(false);
    });
  }

  console.log("Answer timing mode fields ready");
};

exports.down = async (knex) => {
  const hasPenaltyApplied = await knex.schema.hasColumn("answers", "penalty_applied");
  if (hasPenaltyApplied) {
    await knex.schema.alterTable("answers", (table) => {
      table.dropColumn("penalty_applied");
    });
  }

  const hasResponseTime = await knex.schema.hasColumn("answers", "response_time");
  if (hasResponseTime) {
    await knex.schema.alterTable("answers", (table) => {
      table.dropColumn("response_time");
    });
  }

  const hasTimeMode = await knex.schema.hasColumn("answers", "time_mode");
  if (hasTimeMode) {
    await knex.schema.alterTable("answers", (table) => {
      table.dropColumn("time_mode");
    });
  }

  console.log("Answer timing mode fields removed");
};
