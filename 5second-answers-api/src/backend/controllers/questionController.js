const { db } = require("../data/db");
const rankingService = require("../services/rankingService");
const growthService = require("../services/growthService");
const learningService = require("../services/learningService");
const expertService = require("../services/expertService");
const notificationService = require("../services/notificationService");
const streakService = require("../services/streakService");
const aiSelfImprovementService = require("../services/aiSelfImprovementService");
const { localizeCategoryLabel } = require("../services/newsTrendingService");
const { detectLanguageFast } = require("../services/languageDetector");
const {
  DEFAULT_COUNTRY_CODE,
  resolveCountryCode,
  resolveCountryLanguage,
  SUPPORTED_COUNTRIES,
} = require("../config/countryConfig");
const aiService = require("../services/aiService");
const {
  ensureUser,
  findUserByIdentifier,
  formatAnswer,
  formatQuestion,
  isUuid,
  sanitizeQuestionText,
  updateUserStats,
} = require("../data/helpers");

const DAILY_QUESTION_BANK = [
  { text: "What truth gets clearer when life gets harder?", category: "emotional" },
  { text: "What is one thing people pretend not to care about?", category: "savage" },
  { text: "What small habit changes your whole week?", category: "self-growth" },
  { text: "What is funny only after you survive it?", category: "funny" },
  { text: "What does confidence actually look like?", category: "mindset" },
  { text: "What is one thing heartbreak teaches fast?", category: "emotional" },
  { text: "What makes someone unforgettable in five seconds?", category: "social" },
  { text: "What is the boldest thing someone can say honestly?", category: "savage" },
  { text: "What tiny decision saves the most time every day?", category: "productivity" },
  { text: "What is one red flag people ignore too long?", category: "relationships" },
  { text: "What question reveals real intelligence?", category: "mindset" },
  { text: "What feels impossible until you do it once?", category: "self-growth" },
];

const DAILY_QUESTION_TRANSLATIONS = {
  sq: [
    "Cila e vertete behet me e qarte kur jeta veshtiresohet?",
    "Cfare shtiren njerezit sikur nuk i intereson?",
    "Cili zakon i vogel ta ndryshon krejt javen?",
    "Cfare behet qesharake vetem pasi e kalon?",
    "Si duket vertet vetebesimi?",
    "Cfare te meson zemra e thyer shpejt?",
    "Cfare e ben dike te paharrueshem ne pese sekonda?",
    "Cila eshte gjeja me e guximshme qe thuhet sinqerisht?",
    "Cili vendim i vogel kursen me shume kohe cdo dite?",
    "Cili red flag injorohet per shume gjate?",
    "Cila pyetje zbulon inteligjencen e vertete?",
    "Cfare duket e pamundur derisa e ben nje here?",
  ],
  en: DAILY_QUESTION_BANK.map((item) => item.text),
  de: [
    "Welche Wahrheit wird klarer, wenn das Leben haerter wird?",
    "Was geben Menschen vor, nicht zu interessieren?",
    "Welche kleine Gewohnheit veraendert deine ganze Woche?",
    "Was ist erst lustig, nachdem du es ueberlebt hast?",
    "Wie sieht echtes Selbstvertrauen eigentlich aus?",
    "Was lehrt Liebeskummer besonders schnell?",
    "Was macht jemanden in fuenf Sekunden unvergesslich?",
    "Was ist das Mutigste, das man ehrlich sagen kann?",
    "Welche kleine Entscheidung spart taeglich am meisten Zeit?",
    "Welche Red Flag wird viel zu lange ignoriert?",
    "Welche Frage zeigt echte Intelligenz?",
    "Was wirkt unmoeglich, bis du es einmal tust?",
  ],
  fr: [
    "Quelle verite devient plus claire quand la vie se durcit ?",
    "De quoi les gens font semblant de ne pas se soucier ?",
    "Quelle petite habitude change toute ta semaine ?",
    "Qu est-ce qui devient drole seulement apres coup ?",
    "A quoi ressemble la vraie confiance en soi ?",
    "Qu est-ce que le coeur brise apprend tres vite ?",
    "Qu est-ce qui rend quelqu un inoubliable en cinq secondes ?",
    "Quelle est la chose la plus courageuse a dire franchement ?",
    "Quelle petite decision fait gagner le plus de temps chaque jour ?",
    "Quel red flag les gens ignorent trop longtemps ?",
    "Quelle question revele une vraie intelligence ?",
    "Qu est-ce qui semble impossible jusqu au premier essai ?",
  ],
  it: [
    "Quale verita diventa piu chiara quando la vita si fa dura?",
    "Di cosa fanno finta di non importare le persone?",
    "Quale piccola abitudine cambia tutta la tua settimana?",
    "Cosa fa ridere solo dopo che l hai superata?",
    "Che aspetto ha davvero la sicurezza in se stessi?",
    "Cosa insegna in fretta un cuore spezzato?",
    "Cosa rende qualcuno indimenticabile in cinque secondi?",
    "Qual e la cosa piu coraggiosa da dire con sincerita?",
    "Quale piccola decisione fa risparmiare piu tempo ogni giorno?",
    "Quale red flag viene ignorata troppo a lungo?",
    "Quale domanda rivela una vera intelligenza?",
    "Cosa sembra impossibile finche non lo fai una volta?",
  ],
  es: [
    "Que verdad se vuelve mas clara cuando la vida aprieta?",
    "Que fingen no importarles a las personas?",
    "Que pequeno habito cambia toda tu semana?",
    "Que da risa solo despues de sobrevivirlo?",
    "Como se ve de verdad la confianza?",
    "Que ensena rapido un corazon roto?",
    "Que vuelve inolvidable a alguien en cinco segundos?",
    "Que es lo mas valiente que se puede decir con honestidad?",
    "Que pequena decision ahorra mas tiempo cada dia?",
    "Que red flag se ignora demasiado tiempo?",
    "Que pregunta revela inteligencia real?",
    "Que parece imposible hasta que lo haces una vez?",
  ],
  tr: [
    "Hayat zorlasinca hangi gercek daha net gorunur?",
    "Insanlar neyi umursamiyormus gibi yapar?",
    "Hangi kucuk aliskanlik tum haftani degistirir?",
    "Neye ancak atlattiktan sonra gulunur?",
    "Gercek ozguven nasil gorunur?",
    "Kirilan kalp insana neyi hizla ogretir?",
    "Birini bes saniyede unutulmaz yapan nedir?",
    "Dogruca soylenebilecek en cesur sey nedir?",
    "Hangi kucuk karar her gun en cok zaman kazandirir?",
    "Hangi red flag cok uzun sure gormezden gelinir?",
    "Hangi soru gercek zekayi ortaya cikarir?",
    "Bir kez yapana kadar ne imkansiz gorunur?",
  ],
  pt: [
    "Que verdade fica mais clara quando a vida aperta?",
    "Com o que as pessoas fingem nao se importar?",
    "Que habito pequeno muda a tua semana inteira?",
    "O que so fica engracado depois de sobreviver a isso?",
    "Como e a confianca de verdade?",
    "O que um coracao partido ensina rapido?",
    "O que torna alguem inesquecivel em cinco segundos?",
    "Qual e a coisa mais corajosa que se pode dizer com sinceridade?",
    "Que pequena decisao poupa mais tempo todos os dias?",
    "Que red flag e ignorada por tempo demais?",
    "Que pergunta revela inteligencia real?",
    "O que parece impossivel ate fazeres uma vez?",
  ],
  ja: [
    "人生が厳しくなると、どんな真実がよりはっきり見える？",
    "人は何に無関心なふりをしている？",
    "どんな小さな習慣が一週間を変える？",
    "乗り越えた後でしか笑えないものは何？",
    "本当の自信ってどんな見え方をする？",
    "失恋は何を一気に教える？",
    "5秒で忘れられなくなる人の条件は何？",
    "正直に言える一番勇敢な一言は何？",
    "毎日いちばん時間を節約する小さな決断は何？",
    "人が長く見逃しがちなレッドフラグは何？",
    "本当の知性を見抜く質問は何？",
    "一度やるまで不可能に見えることは何？",
  ],
};

const getUtcDayWindow = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );

  return { start, end };
};

const getCountryRotationOffset = (countryCode = DEFAULT_COUNTRY_CODE) => {
  const resolvedCountry = resolveCountryCode(countryCode, DEFAULT_COUNTRY_CODE);
  const supportedIndex = SUPPORTED_COUNTRIES.findIndex(
    (country) => country.code === resolvedCountry
  );

  return supportedIndex >= 0 ? supportedIndex : 0;
};

const getDailyBankIndex = (value = new Date(), countryCode = DEFAULT_COUNTRY_CODE) => {
  const { start } = getUtcDayWindow(value);
  const dayNumber = Math.floor(start.getTime() / (24 * 60 * 60 * 1000));
  return (dayNumber + getCountryRotationOffset(countryCode)) % DAILY_QUESTION_BANK.length;
};

const getTimeRemainingSeconds = (expiresAt) => {
  if (!expiresAt) {
    return 0;
  }

  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
};

const getLocalizedDailyTemplate = (templateIndex, countryCode) => {
  const language = resolveCountryLanguage(countryCode, "en");
  const translations = DAILY_QUESTION_TRANSLATIONS[language] || DAILY_QUESTION_TRANSLATIONS.en;
  const fallbackTemplate = DAILY_QUESTION_BANK[templateIndex] || DAILY_QUESTION_BANK[0];

  return {
    text: translations[templateIndex] || fallbackTemplate.text,
    category: fallbackTemplate.category,
    language,
  };
};

const questionNeedsCleanup = (text = "") => {
  const cleaned = sanitizeQuestionText(text);
  const normalizedOriginal = String(text || "").replace(/\s+/g, " ").trim();

  return (
    cleaned !== normalizedOriginal ||
    /\*\*|[_`]/.test(normalizedOriginal) ||
    /\(([^()]*)\)/.test(normalizedOriginal)
  );
};

const GENERIC_HOT_QUESTION_TEXT = {
  sq: "Pse po flet gjithe bota per kete?",
  en: "Why is everyone talking about this?",
  de: "Warum spricht jeder daruber?",
  fr: "Pourquoi tout le monde en parle?",
  it: "Perche ne parlano tutti?",
  es: "Por que todo el mundo habla de esto?",
  tr: "Neden herkes bundan bahsediyor?",
  pt: "Por que toda a gente fala disto?",
  ja: "なぜ今みんながこれを話している？",
};

const hotQuestionRefreshInFlight = new Set();

const isGenericHotQuestionText = (text = "", countryCode = DEFAULT_COUNTRY_CODE) => {
  const language = resolveCountryLanguage(countryCode, "en");
  return sanitizeQuestionText(text) === GENERIC_HOT_QUESTION_TEXT[language];
};

const queueHotQuestionRefresh = async ({
  activeHotQuestion,
  expectedLanguage,
  resolvedCountry,
}) => {
  const refreshKey = `${resolvedCountry}:${activeHotQuestion.id}`;
  if (hotQuestionRefreshInFlight.has(refreshKey)) {
    return;
  }

  hotQuestionRefreshInFlight.add(refreshKey);

  try {
    if (!activeHotQuestion?.metadata?.title) {
      return;
    }

    const regenerated = await aiService.generateQuestionFromNews(
      activeHotQuestion.metadata.title,
      expectedLanguage
    );

    await db("questions")
      .where({ id: activeHotQuestion.id })
      .update({
        text: regenerated.question,
        metadata: {
          ...(activeHotQuestion.metadata || {}),
          langCode: regenerated.langCode || expectedLanguage,
          language: regenerated.langCode || expectedLanguage,
        },
        updated_at: db.fn.now(),
      });
  } catch (error) {
    console.warn("[Daily Question] Hot question refresh skipped:", error.message);
  } finally {
    hotQuestionRefreshInFlight.delete(refreshKey);
  }
};

const resolveCountryForRequest = (requestedCountry, actor = null) =>
  resolveCountryCode(requestedCountry, actor?.homeCountry || DEFAULT_COUNTRY_CODE);

const buildQuestionCompareFilter = (question) => {
  const metadata = question?.metadata || {};
  const fingerprint = metadata?.newsFingerprint || null;

  return (query) => {
    if (metadata?.source === "hot-news" && fingerprint) {
      query
        .whereRaw("metadata @> ?::jsonb", [JSON.stringify({ source: "hot-news" })])
        .andWhereRaw("(metadata->>'newsFingerprint') = ?", [fingerprint]);
      return;
    }

    query.whereRaw("LOWER(text) = LOWER(?)", [String(question?.text || "").trim()]);
  };
};

const extractAnswerText = (row = {}) =>
  String(row.text || row.ai_review?.transcript || "")
    .replace(/\s+/g, " ")
    .trim();

const classifyCountryReaction = (text = "") => {
  const normalized = String(text || "").trim().toLowerCase();

  if (!normalized) {
    return "other";
  }

  const yesPattern = /\b(po|yes|yeah|yep|absolutely|sigurisht)\b/i;
  const noPattern = /\b(jo|no|nah|never)\b/i;

  if (yesPattern.test(normalized)) {
    return "yes";
  }

  if (noPattern.test(normalized)) {
    return "no";
  }

  return "other";
};

const hasUserAnsweredQuestion = async ({ userId, questionId, since = null }) => {
  if (!userId || !questionId) {
    return false;
  }

  const query = db("answers").where({
    user_id: userId,
    question_id: questionId,
  });

  if (since) {
    query.andWhere("created_at", ">=", since.toISOString());
  }

  const existing = await query.first("id");
  return Boolean(existing);
};

const hasUserAnsweredAnyQuestionSince = async ({ userId, since }) => {
  if (!userId || !since) {
    return false;
  }

  const existing = await db("answers")
    .where({ user_id: userId })
    .andWhere("created_at", ">=", since.toISOString())
    .first("id");

  return Boolean(existing);
};

const getAnsweredQuestionIdSet = async (userId) => {
  if (!userId) {
    return new Set();
  }

  const answeredQuestionIds = await db("answers").where({ user_id: userId }).pluck("question_id");
  return new Set(answeredQuestionIds.filter(Boolean));
};

const getVisibleAnswerCountMap = async (questionIds, userId = null, country = null) => {
  if (!questionIds.length) {
    return new Map();
  }

  let query = db("answers")
    .select("question_id")
    .count("* as count")
    .whereIn("question_id", questionIds)
    .groupBy("question_id");

  if (country) {
    query = query.andWhere("country", resolveCountryCode(country));
  }

  if (userId) {
    query = query.andWhere((builder) => {
      builder.where("status", "approved").orWhere((pendingBuilder) => {
        pendingBuilder.where("status", "pending").andWhere("user_id", userId);
      });
    });
  } else {
    query = query.andWhere({ status: "approved" });
  }

  const rows = await query;
  return new Map(rows.map((row) => [row.question_id, Number(row.count)]));
};

const parseRecentlyViewed = (rawValue) => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const attachExpertRequestsToQuestions = async (questions = []) => {
  if (!questions.length) {
    return questions;
  }

  const expertRequestMap = await expertService.loadQuestionExpertRequestMap(questions);

  return questions.map((question) => ({
    ...question,
    expertRequest: expertRequestMap.get(question.id) || null,
  }));
};

const ensureDailyQuestion = async (countryCode) => {
  const resolvedCountry = resolveCountryCode(countryCode);
  const now = new Date();
  const expectedRotationIndex = getDailyBankIndex(now, resolvedCountry);
  const expectedTemplate = getLocalizedDailyTemplate(expectedRotationIndex, resolvedCountry);
  const activeHotQuestion = await db("questions")
    .where({ country: resolvedCountry })
    .where("expires_at", ">", now.toISOString())
    .andWhereRaw("metadata @> ?::jsonb", [JSON.stringify({ source: "hot-news" })])
    .orderBy("expires_at", "asc")
    .first();

  if (activeHotQuestion) {
    const expectedLanguage = resolveCountryLanguage(resolvedCountry, "en");
    const currentLanguage =
      activeHotQuestion.metadata?.langCode || activeHotQuestion.metadata?.language || "en";
    const cleanedText = sanitizeQuestionText(activeHotQuestion.text);

    if (
      activeHotQuestion.metadata?.title &&
      (
        questionNeedsCleanup(activeHotQuestion.text) ||
        currentLanguage !== expectedLanguage ||
        isGenericHotQuestionText(activeHotQuestion.text, resolvedCountry)
      )
    ) {
      void queueHotQuestionRefresh({
        activeHotQuestion,
        expectedLanguage,
        resolvedCountry,
      });
    }

    if (cleanedText !== activeHotQuestion.text) {
      const [updatedCleanHotQuestion] = await db("questions")
        .where({ id: activeHotQuestion.id })
        .update({
          text: cleanedText,
          updated_at: db.fn.now(),
        })
        .returning("*");

      return updatedCleanHotQuestion || { ...activeHotQuestion, text: cleanedText };
    }

    return activeHotQuestion;
  }

  const activeDailyQuestion = await db("questions")
    .where({ country: resolvedCountry, is_daily: true })
    .andWhere("expires_at", ">", now.toISOString())
    .orderBy("expires_at", "asc")
    .first();

  if (
    activeDailyQuestion?.metadata?.rotationIndex === expectedRotationIndex &&
    activeDailyQuestion?.metadata?.language === expectedTemplate.language &&
    sanitizeQuestionText(activeDailyQuestion?.text) === expectedTemplate.text
  ) {
    return activeDailyQuestion;
  }

  if (activeDailyQuestion) {
    await db("questions")
      .where({ id: activeDailyQuestion.id })
      .update({
        is_daily: false,
        updated_at: db.fn.now(),
      });
  }

  await db("questions")
    .where({ country: resolvedCountry, is_daily: true })
    .update({
      is_daily: false,
      updated_at: db.fn.now(),
    });

  const { start, end } = getUtcDayWindow(now);
  const systemUser = await ensureUser("mirror_daily");

  const [createdDailyQuestion] = await db("questions")
    .insert({
      country: resolvedCountry,
      text: expectedTemplate.text,
      category: expectedTemplate.category,
      user_id: systemUser.id,
      views: 0,
      status: "active",
      ai_reviewed: true,
      is_daily: true,
      expires_at: end.toISOString(),
      metadata: {
        language: expectedTemplate.language,
        difficulty: "easy",
        source: "daily-rotation",
        activeOn: start.toISOString(),
        rotationIndex: expectedRotationIndex,
      },
    })
    .returning("*");

  return createdDailyQuestion;
};

const findCandidateQuestionForActor = async ({
  actor,
  answeredQuestionIds,
  excludeQuestionIds = [],
  country = DEFAULT_COUNTRY_CODE,
  preferredCategory = null,
}) => {
  const now = new Date().toISOString();
  const rows = await db("questions")
    .where({ country: resolveCountryCode(country), status: "active" })
    .andWhere((builder) => {
      builder.whereNull("expires_at").orWhere("expires_at", ">", now);
    })
    .modify((builder) => {
      if (excludeQuestionIds.length) {
        builder.whereNotIn("id", excludeQuestionIds);
      }
    })
    .orderBy("ai_reviewed", "desc")
    .orderBy("views", "desc")
    .orderBy("created_at", "desc")
    .limit(60);

  const unansweredRows = rows.filter((row) => !answeredQuestionIds.has(row.id));
  if (!unansweredRows.length) {
    return null;
  }

  const pickFirst = (filterFn) => unansweredRows.find(filterFn) || null;

  return (
    pickFirst(
      (row) => row.user_id !== actor.id && preferredCategory && row.category === preferredCategory
    ) ||
    pickFirst((row) => row.user_id !== actor.id) ||
    pickFirst((row) => preferredCategory && row.category === preferredCategory) ||
    unansweredRows[0]
  );
};

const getOrCreateFollowupRotationQuestion = async ({ actor, answeredQuestionIds, country }) => {
  const now = new Date();
  const nowIso = now.toISOString();
  const { start, end } = getUtcDayWindow(now);
  const systemUser = await ensureUser("mirror_daily");
  const resolvedCountry = resolveCountryCode(country);
  const anchorIndex = getDailyBankIndex(now, resolvedCountry);

  for (let offset = 1; offset < DAILY_QUESTION_BANK.length; offset += 1) {
    const templateIndex = (anchorIndex + offset) % DAILY_QUESTION_BANK.length;
    const template = getLocalizedDailyTemplate(templateIndex, resolvedCountry);

    const existingQuestion = await db("questions")
      .where({
        country: resolvedCountry,
        text: template.text,
        category: template.category,
        status: "active",
      })
      .andWhere((builder) => {
        builder.whereNull("expires_at").orWhere("expires_at", ">", nowIso);
      })
      .andWhere((builder) => {
        builder
          .whereRaw("(metadata->>'source') = ?", ["daily-rotation"])
          .orWhereRaw("(metadata->>'source') = ?", ["followup-rotation"]);
      })
      .orderBy("created_at", "desc")
      .first();

    if (existingQuestion && !answeredQuestionIds.has(existingQuestion.id)) {
      return existingQuestion;
    }

    if (!existingQuestion) {
      const [createdQuestion] = await db("questions")
        .insert({
          country: resolvedCountry,
          text: template.text,
          category: template.category,
          user_id: systemUser.id,
          views: 0,
          status: "active",
          ai_reviewed: true,
          is_daily: false,
          expires_at: end.toISOString(),
          metadata: {
            language: template.language,
            difficulty: "easy",
            source: "followup-rotation",
            activeOn: start.toISOString(),
            rotationIndex: templateIndex,
          },
        })
        .returning("*");

      if (createdQuestion && !answeredQuestionIds.has(createdQuestion.id)) {
        return createdQuestion;
      }
    }
  }

  return findCandidateQuestionForActor({
    actor,
    answeredQuestionIds,
    country: resolvedCountry,
    preferredCategory: null,
  });
};

const resolveQuestionForActor = async (actor, countryCode) => {
  const resolvedCountry = resolveCountryForRequest(countryCode, actor);
  const activeQuestion = await ensureDailyQuestion(resolvedCountry);
  const answeredQuestionIds = await getAnsweredQuestionIdSet(actor.id);

  if (!answeredQuestionIds.has(activeQuestion.id)) {
    return {
      question: activeQuestion,
      deliveryMode: "active",
      activeQuestionId: activeQuestion.id,
    };
  }

  const candidateQuestion =
    (await findCandidateQuestionForActor({
      actor,
      answeredQuestionIds,
      country: resolvedCountry,
      excludeQuestionIds: [activeQuestion.id],
      preferredCategory: activeQuestion.category || null,
    })) ||
    (await getOrCreateFollowupRotationQuestion({ actor, answeredQuestionIds, country: resolvedCountry }));

  return {
    question: candidateQuestion || activeQuestion,
    deliveryMode: candidateQuestion ? "next-up" : "active",
    activeQuestionId: activeQuestion.id,
    activeQuestionAnswered: true,
  };
};

const buildDailyQuestionPayload = async ({ question, actor, country, deliveryMode = "active" }) => {
  const resolvedCountry = resolveCountryForRequest(country, actor);
  const localizedHotCategoryLabel = question.metadata?.newsCategoryId
    ? localizeCategoryLabel(
        question.metadata.newsCategoryId,
        resolvedCountry,
        question.metadata?.newsCategoryLabel || null
      )
    : question.metadata?.newsCategoryLabel || null;
  const answerCounts = await getVisibleAnswerCountMap([question.id], actor.id, resolvedCountry);
  const streak = await streakService.getUserStreak(actor.id);
  const { start } = getUtcDayWindow();
  const [hasAnsweredToday, hasAnsweredCurrentQuestion] = await Promise.all([
    hasUserAnsweredAnyQuestionSince({ userId: actor.id, since: start }),
    hasUserAnsweredQuestion({ userId: actor.id, questionId: question.id }),
  ]);

  const isFollowupQuestion = deliveryMode === "next-up";

  return {
    question: formatQuestion(question, {
      answerCount: answerCounts.get(question.id) || 0,
      isDaily: !isFollowupQuestion,
      isFollowupQuestion,
      isHotQuestion: question.metadata?.source === "hot-news",
      expiresAt: question.expires_at || null,
      hotNewsCategoryColor: question.metadata?.newsCategoryColor || null,
      hotNewsCategoryId: question.metadata?.newsCategoryId || null,
      hotNewsCategoryLabel: localizedHotCategoryLabel,
      hotLabel: question.metadata?.source === "hot-news" ? "LIVE" : null,
      hotNewsTitle: question.metadata?.title || null,
      promptLabel: isFollowupQuestion ? "NEXT UP" : "QOD",
      promptNote: isFollowupQuestion
        ? "Kete pyetje e zhbllokove pasi iu pergjigje asaj te pares."
        : null,
      timeRemainingSeconds: getTimeRemainingSeconds(question.expires_at),
    }),
    selectedCountry: resolvedCountry,
    streak,
    hasAnsweredToday,
    hasAnsweredCurrentQuestion,
  };
};

exports.createQuestion = async (req, res) => {
  const { text, category, country, userId, expertRequest } = req.body;

  if (!text || text.trim().length === 0) {
    return res.status(400).json({ error: "Question text required" });
  }

  if (text.length > 200) {
    return res.status(400).json({ error: "Question too long (max 200 chars)" });
  }

  try {
    const normalizedCategory = category || "general";
    const questionLanguage = await detectLanguageFast(text, { fallback: "en" });
    const user = await ensureUser(userId || "demo_user");
    const resolvedCountry = resolveCountryForRequest(country, user);
    let selectedExpert = null;

    if (expertRequest?.expertUserId) {
      selectedExpert = await expertService.getExpertProfile(
        expertRequest.expertUserId,
        normalizedCategory
      );

      if (!selectedExpert || !selectedExpert.expertise?.verified) {
        return res.status(400).json({ error: "Selected expert is not available" });
      }

      if (selectedExpert.id === user.id) {
        return res.status(400).json({ error: "You cannot send a paid request to yourself" });
      }
    }

    const [questionRow] = await db("questions")
      .insert({
        text: text.trim(),
        category: normalizedCategory,
        country: resolvedCountry,
        user_id: user.id,
        views: 0,
        status: "active",
        ai_reviewed: false,
        metadata: {
          language: questionLanguage,
          difficulty: "easy",
          askMode: selectedExpert ? "expert" : "community",
          priority: Boolean(selectedExpert),
        },
      })
      .returning("*");

    let createdExpertRequest = null;
    if (selectedExpert) {
      createdExpertRequest = await expertService.createExpertRequest({
        questionId: questionRow.id,
        requesterUserId: user.id,
        expertUserId: selectedExpert.id,
        category: normalizedCategory,
        priceCents: selectedExpert.pricing?.priceCents || 100,
      });

      await notificationService.notifyPriorityExpertRequest({
        question: questionRow,
        requesterUser: user,
        expertUser: selectedExpert,
        expertRequest: createdExpertRequest,
      });
    }

    await updateUserStats(user.id, (stats) => ({
      ...stats,
      questionsAsked: (stats.questionsAsked || 0) + 1,
    }));

    res.json({
      ...formatQuestion(questionRow),
      expertRequest: createdExpertRequest,
    });
  } catch (error) {
    console.error("Create question error:", error);
    res.status(500).json({ error: "Failed to create question" });
  }
};

exports.getExperts = async (req, res) => {
  const { category = "general", limit = 6 } = req.query;

  try {
    const experts = await expertService.getExpertDirectory({
      category,
      limit: Math.max(3, Math.min(12, parseInt(limit, 10) || 6)),
    });

    res.json({
      category,
      experts,
    });
  } catch (error) {
    console.error("Get experts error:", error);
    res.status(500).json({ error: "Failed to load experts" });
  }
};

exports.getDailyQuestion = async (req, res) => {
  const { country, userId } = req.query;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const resolvedCountry = resolveCountryForRequest(country, actor);
    const { question, deliveryMode } = await resolveQuestionForActor(actor, resolvedCountry);

    res.json(await buildDailyQuestionPayload({ question, actor, country: resolvedCountry, deliveryMode }));
  } catch (error) {
    console.error("Get daily question error:", error);
    res.status(500).json({ error: "Failed to get daily question" });
  }
};

exports.getQuestions = async (req, res) => {
  const { category, country, trending, userId } = req.query;

  try {
    let resolvedUserId = null;
    let resolvedCountry = resolveCountryCode(country, DEFAULT_COUNTRY_CODE);
    let query = db("questions").orderBy("created_at", "desc");

    if (userId) {
      const user = await findUserByIdentifier(userId);
      if (!user) {
        return res.json([]);
      }

      resolvedUserId = user.id;
      resolvedCountry = resolveCountryForRequest(country, user);
      query = query.where({ user_id: user.id });
    }

    query = query.andWhere({ country: resolvedCountry });

    if (category && category !== "all") {
      query = query.where({ category });
    }

    const questionRows = await query;
    const counts = await getVisibleAnswerCountMap(
      questionRows.map((row) => row.id),
      resolvedUserId,
      resolvedCountry
    );

    let formattedQuestions = questionRows.map((row) => {
      const answerCount = counts.get(row.id) || 0;
      const formattedQuestion = formatQuestion(row, { answerCount });

      return {
        ...formattedQuestion,
        timeToLearn: learningService.estimateTimeToLearn(
          formattedQuestion,
          answerCount
        ),
      };
    });

    if (trending === "true") {
      formattedQuestions = formattedQuestions.sort(
        (left, right) => right.answerCount * 2 + right.views - (left.answerCount * 2 + left.views)
      );
    }

    res.json(await attachExpertRequestsToQuestions(formattedQuestions));
  } catch (error) {
    console.error("Get questions error:", error);
    res.status(500).json({ error: "Failed to get questions" });
  }
};

exports.getQuestionById = async (req, res) => {
  const { id } = req.params;
  const { country, userId } = req.query;

  try {
    if (!isUuid(id)) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = await db("questions").where({ id }).first();
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    const [updatedQuestion] = await db("questions")
      .where({ id })
      .increment("views", 1)
      .returning("*");

    let resolvedUserId = null;
    let resolvedCountry = resolveCountryCode(country, question.country || DEFAULT_COUNTRY_CODE);
    if (userId) {
      const user = await findUserByIdentifier(userId);
      resolvedUserId = user?.id || null;
      resolvedCountry = resolveCountryForRequest(country, user || null);
    }

    const siblingRows = await db("questions")
      .where({ category: question.category, country: resolvedCountry })
      .andWhereNot({ id })
      .orderBy("views", "desc")
      .limit(8);

    const answerRows = await db("answers")
      .where({ question_id: id, status: "approved", country: resolvedCountry })
      .orderBy("created_at", "desc");

    const counts = await getVisibleAnswerCountMap(
      [id, ...siblingRows.map((row) => row.id)],
      resolvedUserId,
      resolvedCountry
    );

    const formattedQuestion = formatQuestion(updatedQuestion || question, {
      answerCount: counts.get(id) || 0,
    });
    const siblingQuestions = siblingRows.map((row) => {
      const answerCount = counts.get(row.id) || 0;
      const formattedSibling = formatQuestion(row, { answerCount });

      return {
        ...formattedSibling,
        timeToLearn: learningService.estimateTimeToLearn(
          formattedSibling,
          answerCount
        ),
      };
    });
    const formattedAnswers = answerRows.map((row) => formatAnswer(row));
    const learning = learningService.buildQuestionLearningContext({
      question: formattedQuestion,
      answers: formattedAnswers,
      siblingQuestions,
    });
    const currentQuestion = updatedQuestion || question;
    const currentExpertRequest = await expertService.loadQuestionExpertRequest(
      id,
      currentQuestion.category || "general"
    );

    res.json({
      ...formattedQuestion,
      timeToLearn: learning.timeToLearn,
      learning,
      expertRequest: currentExpertRequest,
    });
  } catch (error) {
    console.error("Get question by id error:", error);
    res.status(500).json({ error: "Failed to get question" });
  }
};

exports.getFeed = async (req, res) => {
  const { sort = "top", country, userId, scope = "global" } = req.query;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const resolvedCountry = resolveCountryForRequest(country, actor);
    let answerQuery = db("answers as a")
      .leftJoin("questions as q", "q.id", "a.question_id")
      .leftJoin("users as u", "u.id", "a.user_id")
      .where("a.status", "approved")
      .select(
        "a.*",
        "q.text as question_text",
        "q.category as question_category",
        "q.country as question_country",
        "u.username",
        "u.avatar",
        "u.followers"
      );

    answerQuery = answerQuery.andWhere((builder) => {
      builder.where("a.country", resolvedCountry).orWhere((fallbackBuilder) => {
        fallbackBuilder.whereNull("a.country").andWhere("q.country", resolvedCountry);
      });
    });

    if (scope === "following") {
      const followingUserIds = await db("user_follows")
        .where({ follower_user_id: actor.id })
        .pluck("followed_user_id");

      if (followingUserIds.length) {
        answerQuery = answerQuery.whereIn("a.user_id", followingUserIds);
      }
    }

    const answerRows = await answerQuery.orderBy("a.created_at", "desc");

    const counts = await getVisibleAnswerCountMap(
      [...new Set(answerRows.map((row) => row.question_id).filter(Boolean))],
      null,
      resolvedCountry
    );

    const performanceMap = await growthService.loadAnswerPerformanceMap(
      answerRows.map((row) => row.id)
    );
    const approvedAnswers = answerRows.map((row) => {
      const formattedAnswer = formatAnswer(row, {
        user: {
          id: row.user_id,
          username: row.username || "anonymous",
          avatar: row.avatar || null,
          followers: Number(row.followers || 0),
        },
        question: {
          id: row.question_id,
          text: row.question_text || "(deleted)",
          category: row.question_category || "general",
          country: row.question_country || resolvedCountry,
          answerCount: counts.get(row.question_id) || 0,
        },
      });

      return {
        ...formattedAnswer,
        performance:
          performanceMap.get(row.id) ||
          growthService.getDefaultPerformanceSnapshot(formattedAnswer.duration),
      };
    });

    const enrichedAnswers = await aiSelfImprovementService.decorateAnswersForRanking(approvedAnswers, {
      country: resolvedCountry,
    });
    const profile = await growthService.loadPersonalizationProfile(actor.id);
    const recentlyViewed = parseRecentlyViewed(req.query.recentlyViewed);

    const feed =
      sort === "newest" || sort === "trending"
        ? rankingService.rankAnswers(enrichedAnswers, sort)
        : rankingService.getFYP(enrichedAnswers, {
            profile,
            recentlyViewed,
            limit: 50,
          });

    res.json(feed);
  } catch (error) {
    console.error("Get feed error:", error);
    res.status(500).json({ error: "Failed to get feed" });
  }
};

exports.getTrending = async (req, res) => {
  const { country, limit = 20 } = req.query;

  try {
    const resolvedCountry = resolveCountryCode(country, DEFAULT_COUNTRY_CODE);
    const questionRows = await db("questions")
      .where({ country: resolvedCountry })
      .orderBy("created_at", "desc");
    const answerRows = await db("answers as a")
      .leftJoin("users as u", "u.id", "a.user_id")
      .leftJoin("questions as q", "q.id", "a.question_id")
      .where("a.status", "approved")
      .andWhere("a.country", resolvedCountry)
      .select("a.*", "u.username", "u.avatar", "u.followers", "q.country as question_country")
      .orderBy("a.created_at", "desc");

    const answersByQuestion = new Map();
    answerRows.forEach((row) => {
      const answer = formatAnswer(row, {
        user: {
          username: row.username || "anonymous",
          avatar: row.avatar || null,
          followers: Number(row.followers || 0),
        },
      });
      const existing = answersByQuestion.get(answer.questionId) || [];
      existing.push(answer);
      answersByQuestion.set(answer.questionId, existing);
    });

    const rankedAnswerMap = new Map();
    await Promise.all(
      [...answersByQuestion.entries()].map(async ([questionId, questionAnswers]) => {
        rankedAnswerMap.set(
          questionId,
          await aiSelfImprovementService.decorateAnswersForRanking(questionAnswers, {
            country: resolvedCountry,
          })
        );
      })
    );

    const trending = questionRows
      .map((row) => {
        const questionAnswers = rankedAnswerMap.get(row.id) || answersByQuestion.get(row.id) || [];
        const rankedAnswers = rankingService.rankAnswers(questionAnswers, "trending");

        return {
          question: formatQuestion(row, { answerCount: questionAnswers.length }),
          answerCount: questionAnswers.length,
          topAnswer: rankedAnswers[0] || null,
          trendingScore: (rankedAnswers[0]?.rankingScore || 0) * questionAnswers.length,
        };
      })
      .filter((item) => item.answerCount > 0)
      .sort((left, right) => right.trendingScore - left.trendingScore)
      .slice(0, parseInt(limit, 10));

    res.json(trending);
  } catch (error) {
    console.error("Get trending error:", error);
    res.status(500).json({ error: "Failed to get trending questions" });
  }
};

exports.getSurpriseQuestion = async (req, res) => {
  const { country, userId } = req.query;

  try {
    const actor = await ensureUser(userId || "demo_user");
    const resolvedCountry = resolveCountryForRequest(country, actor);
    const profile = await growthService.loadPersonalizationProfile(actor.id);
    const rows = await db("questions as q")
      .join("answers as a", "a.question_id", "q.id")
      .where("a.status", "approved")
      .andWhere("q.country", resolvedCountry)
      .andWhere("a.country", resolvedCountry)
      .select("q.*")
      .countDistinct("a.id as answer_count")
      .groupBy("q.id")
      .orderBy("q.created_at", "desc");

    if (!rows.length) {
      return res.status(404).json({ error: "No surprise questions available yet" });
    }

    const categories = [...new Set(rows.map((row) => row.category || "general"))];
    const lowAffinityCategories = categories.sort(
      (left, right) =>
        (profile.categoryAffinity?.[left] || 0) - (profile.categoryAffinity?.[right] || 0)
    );
    const categoryPool = lowAffinityCategories.slice(0, Math.min(3, lowAffinityCategories.length));
    const randomCategory =
      categoryPool[Math.floor(Math.random() * categoryPool.length)] ||
      categories[Math.floor(Math.random() * categories.length)];

    const questionPool = rows.filter(
      (row) => (row.category || "general") === randomCategory
    );
    const randomQuestion =
      questionPool[Math.floor(Math.random() * questionPool.length)] ||
      rows[Math.floor(Math.random() * rows.length)];

    res.json({
      mode: "surprise",
      category: randomCategory,
      question: formatQuestion(randomQuestion, {
        answerCount: Number(randomQuestion.answer_count || 0),
      }),
      reason: `Random ${randomCategory} question for exploration`,
    });
  } catch (error) {
    console.error("Get surprise question error:", error);
    res.status(500).json({ error: "Failed to load a surprise question" });
  }
};

exports.getBattle = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  try {
    if (!isUuid(id)) {
      return res.status(404).json({ error: "Question not found" });
    }

    const actor = await ensureUser(userId || "demo_user");
    const question = await db("questions").where({ id }).first();

    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    const snapshot = await growthService.buildBattleSnapshot(id, actor.id);
    res.json({
      question: formatQuestion(question),
      ...snapshot,
    });
  } catch (error) {
    console.error("Get battle error:", error);
    res.status(500).json({ error: "Failed to load battle" });
  }
};

exports.compareCountries = async (req, res) => {
  const { id } = req.params;
  const { limit = 8 } = req.query;

  try {
    if (!isUuid(id)) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = await db("questions").where({ id }).first();
    if (!question) {
      return res.status(404).json({ error: "Question not found" });
    }

    const relatedQuestions = await db("questions")
      .modify(buildQuestionCompareFilter(question))
      .select("id", "country", "text", "metadata");

    const relatedQuestionIds = relatedQuestions.map((row) => row.id);
    if (!relatedQuestionIds.length) {
      return res.json({
        comparisons: [],
        question: formatQuestion(question),
      });
    }

    const answerRows = await db("answers")
      .whereIn("question_id", relatedQuestionIds)
      .andWhere({ status: "approved" })
      .select("id", "question_id", "country", "text", "ai_review");

    const rowsByCountry = new Map();

    answerRows.forEach((row) => {
      const countryCode = resolveCountryCode(row.country || question.country || DEFAULT_COUNTRY_CODE);
      const current = rowsByCountry.get(countryCode) || {
        country: countryCode,
        leadingReaction: "MIXED",
        otherCount: 0,
        otherPercent: 0,
        sampleAnswers: [],
        totalAnswers: 0,
        yesCount: 0,
        yesPercent: 0,
        noCount: 0,
        noPercent: 0,
      };

      const answerText = extractAnswerText(row);
      const reaction = classifyCountryReaction(answerText);
      current.totalAnswers += 1;

      if (reaction === "yes") {
        current.yesCount += 1;
      } else if (reaction === "no") {
        current.noCount += 1;
      } else {
        current.otherCount += 1;
      }

      if (answerText && current.sampleAnswers.length < 2) {
        current.sampleAnswers.push(answerText);
      }

      rowsByCountry.set(countryCode, current);
    });

    const comparisons = [...rowsByCountry.values()]
      .map((item) => {
        const total = Math.max(1, item.totalAnswers);
        const yesPercent = Number((item.yesCount / total).toFixed(2));
        const noPercent = Number((item.noCount / total).toFixed(2));
        const otherPercent = Number((item.otherCount / total).toFixed(2));
        const maxScore = Math.max(yesPercent, noPercent, otherPercent);

        return {
          ...item,
          leadingReaction:
            maxScore === yesPercent
              ? "PO"
              : maxScore === noPercent
                ? "JO"
                : "MIXED",
          yesPercent,
          noPercent,
          otherPercent,
        };
      })
      .sort((left, right) => right.totalAnswers - left.totalAnswers)
      .slice(0, Math.max(2, Math.min(12, Number(limit) || 8)));

    return res.json({
      comparisons,
      question: formatQuestion(question),
      totalCountries: comparisons.length,
    });
  } catch (error) {
    console.error("Compare countries error:", error);
    return res.status(500).json({ error: "Failed to compare countries" });
  }
};

exports.voteBattle = async (req, res) => {
  const { id } = req.params;
  const { answerId, userId } = req.body;

  if (!answerId) {
    return res.status(400).json({ error: "answerId is required" });
  }

  try {
    if (!isUuid(id)) {
      return res.status(404).json({ error: "Question not found" });
    }

    const actor = await ensureUser(userId || "demo_user");
    const result = await growthService.voteBattle({
      questionId: id,
      answerId,
      userId: actor.id,
    });

    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }

    res.json({
      alreadyVoted: result.alreadyVoted,
      ...result.snapshot,
    });
  } catch (error) {
    console.error("Vote battle error:", error);
    res.status(500).json({ error: "Failed to vote in battle" });
  }
};
