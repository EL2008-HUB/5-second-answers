const { DEFAULT_COUNTRY_CODE } = require("../../config/countryConfig");

exports.up = async (knex) => {
  const hasUsersHomeCountry = await knex.schema.hasColumn("users", "home_country");
  if (!hasUsersHomeCountry) {
    await knex.schema.alterTable("users", (table) => {
      table.string("home_country", 2).notNullable().defaultTo(DEFAULT_COUNTRY_CODE);
      table.index(["home_country"], "users_home_country_idx");
    });
  }

  const hasQuestionsCountry = await knex.schema.hasColumn("questions", "country");
  if (!hasQuestionsCountry) {
    await knex.schema.alterTable("questions", (table) => {
      table.string("country", 2).notNullable().defaultTo(DEFAULT_COUNTRY_CODE);
      table.index(["country"], "questions_country_idx");
    });
  }

  const hasAnswersCountry = await knex.schema.hasColumn("answers", "country");
  if (!hasAnswersCountry) {
    await knex.schema.alterTable("answers", (table) => {
      table.string("country", 2).notNullable().defaultTo(DEFAULT_COUNTRY_CODE);
      table.index(["country"], "answers_country_idx");
    });
  }

  await knex("users").update({
    home_country: knex.raw("COALESCE(home_country, ?)", [DEFAULT_COUNTRY_CODE]),
  });

  await knex("questions").update({
    country: knex.raw("COALESCE(country, ?)", [DEFAULT_COUNTRY_CODE]),
  });

  await knex("answers as a")
    .update({
      country: knex.raw("COALESCE(a.country, q.country, ?)", [DEFAULT_COUNTRY_CODE]),
    })
    .updateFrom("questions as q")
    .whereRaw("q.id = a.question_id");

  console.log("Country context fields ready");
};

exports.down = async (knex) => {
  const hasAnswersCountry = await knex.schema.hasColumn("answers", "country");
  if (hasAnswersCountry) {
    await knex.schema.alterTable("answers", (table) => {
      table.dropIndex(["country"], "answers_country_idx");
      table.dropColumn("country");
    });
  }

  const hasQuestionsCountry = await knex.schema.hasColumn("questions", "country");
  if (hasQuestionsCountry) {
    await knex.schema.alterTable("questions", (table) => {
      table.dropIndex(["country"], "questions_country_idx");
      table.dropColumn("country");
    });
  }

  const hasUsersHomeCountry = await knex.schema.hasColumn("users", "home_country");
  if (hasUsersHomeCountry) {
    await knex.schema.alterTable("users", (table) => {
      table.dropIndex(["home_country"], "users_home_country_idx");
      table.dropColumn("home_country");
    });
  }

  console.log("Country context fields removed");
};
