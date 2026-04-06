exports.up = async (knex) => {
  const hasPasswordHash = await knex.schema.hasColumn("users", "password_hash");

  if (!hasPasswordHash) {
    await knex.schema.alterTable("users", (table) => {
      table.text("password_hash").nullable();
    });
  }

  console.log("Basic auth fields ready");
};

exports.down = async (knex) => {
  const hasPasswordHash = await knex.schema.hasColumn("users", "password_hash");

  if (hasPasswordHash) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("password_hash");
    });
  }

  console.log("Basic auth fields removed");
};
