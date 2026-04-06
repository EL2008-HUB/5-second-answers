exports.seed = async (knex) => {
  const hasStoryPacks = await knex.schema.hasTable("story_packs");
  const hasStoryQuestions = await knex.schema.hasTable("story_questions");

  if (!hasStoryPacks || !hasStoryQuestions) {
    return;
  }

  await knex("story_questions").del();
  await knex("story_packs").del();

  const [confessionPack] = await knex("story_packs")
    .insert({
      title: "Confession Session",
      description: "5 pyetje qe nxjerrin versionin me te vertete te teje.",
      category: "confession",
      is_active: true,
    })
    .returning("*");

  const [savagePack] = await knex("story_packs")
    .insert({
      title: "My Savage Side",
      description: "Pyetje qe nuk te lejojne te fshihesh pas diplomacise.",
      category: "savage",
      is_active: true,
    })
    .returning("*");

  const [funnyPack] = await knex("story_packs")
    .insert({
      title: "Humor i Zi",
      description: "5 pyetje ku instinkti yt vendos tonin e dhomes.",
      category: "funny",
      is_active: true,
    })
    .returning("*");

  const [romanticPack] = await knex("story_packs")
    .insert({
      title: "Anet Romantike",
      description: "Kur ndjenjat dalin perpara filtrit.",
      category: "romantic",
      is_active: true,
    })
    .returning("*");

  await knex("story_questions").insert([
    {
      pack_id: confessionPack.id,
      question: "Rrefe dicka qe nuk e di askush tjeter.",
      order_index: 1,
      lang: "sq",
    },
    {
      pack_id: confessionPack.id,
      question: "Cfare ke bere dhe nuk e ke treguar kurre?",
      order_index: 2,
      lang: "sq",
    },
    {
      pack_id: confessionPack.id,
      question: "Ke lenduar dike pa u ndjere fare keq?",
      order_index: 3,
      lang: "sq",
    },
    {
      pack_id: confessionPack.id,
      question: "Cfare deshiron te ndodhe por nuk e pranon?",
      order_index: 4,
      lang: "sq",
    },
    {
      pack_id: confessionPack.id,
      question: "Fjala e fundit nese te degjonte e gjithe bota.",
      order_index: 5,
      lang: "sq",
    },
    {
      pack_id: savagePack.id,
      question: "Kush do te te kenaqte nese do te deshtonte?",
      order_index: 1,
      lang: "sq",
    },
    {
      pack_id: savagePack.id,
      question: "Cfare mendon realisht per shefin ose mesuesen tende?",
      order_index: 2,
      lang: "sq",
    },
    {
      pack_id: savagePack.id,
      question: "Gjeja me e keqe qe ke menduar per dike te dashur.",
      order_index: 3,
      lang: "sq",
    },
    {
      pack_id: savagePack.id,
      question: "Cili opinion yt do t'i alarmonte te gjithe?",
      order_index: 4,
      lang: "sq",
    },
    {
      pack_id: savagePack.id,
      question: "Nese fshin nje person nga jeta, kush eshte?",
      order_index: 5,
      lang: "sq",
    },
    {
      pack_id: funnyPack.id,
      question: "Cila eshte genjeshtra me qesharake qe ke thene?",
      order_index: 1,
      lang: "sq",
    },
    {
      pack_id: funnyPack.id,
      question: "Kur ke qeshur ne moment krejt te gabuar?",
      order_index: 2,
      lang: "sq",
    },
    {
      pack_id: funnyPack.id,
      question: "Cili eshte mendimi yt me absurd per dashurine?",
      order_index: 3,
      lang: "sq",
    },
    {
      pack_id: funnyPack.id,
      question: "Cili person ne jeten tende eshte meme pa e ditur?",
      order_index: 4,
      lang: "sq",
    },
    {
      pack_id: funnyPack.id,
      question: "Kur e ke shpirtin me te zi ne humor?",
      order_index: 5,
      lang: "sq",
    },
    {
      pack_id: romanticPack.id,
      question: "Cfare nuk ia ke thene ende personit qe te pelqen?",
      order_index: 1,
      lang: "sq",
    },
    {
      pack_id: romanticPack.id,
      question: "Ke humbur dike qe ende e mban me vete?",
      order_index: 2,
      lang: "sq",
    },
    {
      pack_id: romanticPack.id,
      question: "Kur je ndjere me i sinqerte ne dashuri?",
      order_index: 3,
      lang: "sq",
    },
    {
      pack_id: romanticPack.id,
      question: "Cfare te tremb me shume kur lidhemi me dike?",
      order_index: 4,
      lang: "sq",
    },
    {
      pack_id: romanticPack.id,
      question: "Cfare do te doje te degjoje sonte nga dikush?",
      order_index: 5,
      lang: "sq",
    },
  ]);

  console.log("Story packs seeded");
};
