exports.up = async (knex) => {
  const hasLang = await knex.schema.hasColumn('answers', 'lang');
  if (!hasLang) {
    await knex.schema.alterTable('answers', (table) => {
      table.string('lang', 5).notNullable().defaultTo('en');
    });
  }

  await knex.schema.alterTable('answers', (table) => {
    table.index(['lang', 'created_at'], 'answers_lang_created_at_idx');
  }).catch(() => null);

  console.log('Answer language field ready');
};

exports.down = async (knex) => {
  await knex.schema.alterTable('answers', (table) => {
    table.dropIndex(['lang', 'created_at'], 'answers_lang_created_at_idx');
  }).catch(() => null);

  const hasLang = await knex.schema.hasColumn('answers', 'lang');
  if (hasLang) {
    await knex.schema.alterTable('answers', (table) => {
      table.dropColumn('lang');
    });
  }

  console.log('Answer language field removed');
};
