const CATEGORY_LABELS = {
  all: "Pergjithshme",
  business: "Biznes",
  education: "Arsim",
  entertainment: "Argetim",
  general: "Pergjithshme",
  health: "Shendet",
  history: "Histori",
  lifestyle: "Jetese",
  science: "Shkence",
  sports: "Sport",
  tech: "Teknologji",
};

const CATEGORY_BASE_MINUTES = {
  business: 2,
  education: 2,
  entertainment: 1,
  general: 2,
  health: 2,
  history: 3,
  lifestyle: 2,
  science: 3,
  sports: 2,
  tech: 3,
};

const DIFFICULTY_BONUS = {
  easy: 0,
  beginner: 0,
  medium: 1,
  advanced: 2,
  hard: 2,
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "blue",
  "by",
  "do",
  "does",
  "for",
  "from",
  "how",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "me",
  "of",
  "on",
  "or",
  "our",
  "so",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "this",
  "to",
  "what",
  "when",
  "why",
  "with",
  "you",
  "your",
]);

const GLOSSARY = [
  {
    term: "Rayleigh scattering",
    aliases: ["rayleigh scattering"],
    categories: ["science"],
    definition:
      "Blue light scatters more strongly than red light when sunlight hits tiny air molecules.",
    visual:
      "Imagine white sunlight entering the atmosphere and blue wavelengths bouncing around in every direction.",
  },
  {
    term: "Light spectrum",
    aliases: ["light spectrum", "spectrum"],
    categories: ["science"],
    definition:
      "The light spectrum is the range of colors and wavelengths that make up visible and invisible light.",
    visual:
      "Picture a rainbow stretched into a scale, from short blue wavelengths to longer red ones.",
  },
  {
    term: "Algorithm",
    aliases: ["algorithm", "algorithms"],
    categories: ["tech", "business"],
    definition:
      "An algorithm is a step by step set of rules a system follows to decide what happens next.",
    visual:
      "Think of a flowchart where each choice pushes the system toward a new result.",
  },
  {
    term: "API",
    aliases: ["api", "apis"],
    categories: ["tech"],
    definition:
      "An API is a structured way for one app or service to ask another app for data or actions.",
    visual:
      "Imagine two apps passing requests and responses through a clearly labeled doorway.",
  },
  {
    term: "Photosynthesis",
    aliases: ["photosynthesis"],
    categories: ["science", "health"],
    definition:
      "Photosynthesis is the process plants use to turn light, water and carbon dioxide into energy.",
    visual:
      "Picture a leaf acting like a solar panel and a tiny food factory at the same time.",
  },
  {
    term: "Metabolism",
    aliases: ["metabolism"],
    categories: ["health", "science"],
    definition:
      "Metabolism is the set of chemical processes your body uses to turn food into energy and repair.",
    visual:
      "Think of millions of small body engines converting fuel into movement, heat and growth.",
  },
  {
    term: "Inflation",
    aliases: ["inflation"],
    categories: ["business"],
    definition:
      "Inflation means prices rise over time, so the same amount of money buys less than before.",
    visual:
      "Imagine a shopping basket slowly getting smaller even though your cash stays the same.",
  },
  {
    term: "Compound interest",
    aliases: ["compound interest"],
    categories: ["business"],
    definition:
      "Compound interest means you earn returns on both your original money and the returns already added.",
    visual:
      "Picture a snowball rolling downhill and growing faster because each layer adds to the next.",
  },
  {
    term: "Probability",
    aliases: ["probability", "chance"],
    categories: ["science", "education"],
    definition:
      "Probability measures how likely an event is to happen on a scale from impossible to certain.",
    visual:
      "Imagine a slider moving from 0 percent chance to 100 percent certainty.",
  },
  {
    term: "Democracy",
    aliases: ["democracy", "democratic"],
    categories: ["history", "education"],
    definition:
      "Democracy is a system where people influence power through voting, representation and shared rules.",
    visual:
      "Think of many voices feeding into one decision making system instead of one ruler deciding alone.",
  },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeText = (value = "") => String(value).toLowerCase();

const titleCase = (value = "") =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getCategoryLabel = (category) =>
  CATEGORY_LABELS[category] || titleCase(category || "general");

const tokenize = (value = "") =>
  normalizeText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));

const getKeywordSet = (value = "") => new Set(tokenize(value));

const getFallbackDefinition = (term, category) => ({
  term,
  definition: `${term} eshte nje koncept kyc ne ${getCategoryLabel(category).toLowerCase()} qe te ndihmon te kuptosh pyetjen me mire.`,
  visual: `Mendoje ${term} si nje ide baze qe hap hapin tjeter ne kete teme.`,
});

const matchesGlossaryEntry = (entry, text, category) => {
  const categoryOk =
    !entry.categories?.length ||
    entry.categories.includes(category) ||
    entry.categories.includes("general");

  if (!categoryOk) {
    return false;
  }

  return entry.aliases.some((alias) => text.includes(alias));
};

const extractFallbackTerms = (questionText = "") => {
  const phraseMatches = questionText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
  const keywordMatches = tokenize(questionText).filter((token) => token.length >= 6);

  return [...new Set([...phraseMatches, ...keywordMatches.slice(0, 3)])].slice(0, 3);
};

const estimateTimeToLearn = (question, answerCount = 0) => {
  const metadata = question?.metadata || {};
  const base = CATEGORY_BASE_MINUTES[question?.category] || 2;
  const difficultyBonus = DIFFICULTY_BONUS[metadata.difficulty] || 0;
  const answerBonus = answerCount >= 5 ? 1 : 0;
  const minutes = clamp(base + difficultyBonus + answerBonus, 1, 6);

  return {
    minutes,
    shortLabel: `${minutes} min`,
    label: `Meso bazat e ${getCategoryLabel(question?.category)} - ${minutes} min`,
    summary:
      minutes <= 2
        ? "Shpjegim i shpejte per ta kapur idene."
        : "Rruge e shkurter per te kuptuar bazat pa humbur kohe.",
  };
};

const scoreQuestionMatch = (currentQuestion, candidateQuestion) => {
  const currentKeywords = getKeywordSet(currentQuestion.text);
  const candidateKeywords = getKeywordSet(candidateQuestion.text);
  let overlap = 0;

  currentKeywords.forEach((keyword) => {
    if (candidateKeywords.has(keyword)) {
      overlap += 1;
    }
  });

  const answerCountBoost = Number(candidateQuestion.answerCount || 0) * 0.35;
  const viewBoost = Math.min(6, Number(candidateQuestion.views || 0) / 20);
  const difficultyBonus =
    (DIFFICULTY_BONUS[candidateQuestion?.metadata?.difficulty] || 0) * 1.5;

  return overlap * 8 + answerCountBoost + viewBoost + difficultyBonus;
};

const buildQuestionChain = (currentQuestion, siblingQuestions = []) => {
  if (!siblingQuestions.length) {
    return [];
  }

  const scored = siblingQuestions
    .filter((item) => item.id !== currentQuestion.id)
    .map((item) => ({
      ...item,
      matchScore: scoreQuestionMatch(currentQuestion, item),
      timeToLearn: estimateTimeToLearn(item, item.answerCount || 0),
    }))
    .sort((left, right) => right.matchScore - left.matchScore);

  const related = scored.slice(0, 2).map((item, index) => ({
    id: item.id,
    text: item.text,
    category: item.category,
    answerCount: item.answerCount || 0,
    views: item.views || 0,
    timeToLearn: item.timeToLearn,
    chainType: "related",
    chainLabel: `Related question ${index + 1}`,
  }));

  const nextStepCandidate =
    scored.find(
      (item) =>
        !related.some((relatedItem) => relatedItem.id === item.id) &&
        (item.timeToLearn.minutes >= estimateTimeToLearn(currentQuestion).minutes ||
          item.matchScore > 0)
    ) || scored[2] || null;

  if (nextStepCandidate) {
    related.push({
      id: nextStepCandidate.id,
      text: nextStepCandidate.text,
      category: nextStepCandidate.category,
      answerCount: nextStepCandidate.answerCount || 0,
      views: nextStepCandidate.views || 0,
      timeToLearn: nextStepCandidate.timeToLearn,
      chainType: "next",
      chainLabel: "Next logical step",
    });
  }

  return related.slice(0, 3);
};

const buildMicroDefinitions = (question, answers = [], questionChain = []) => {
  const textCorpus = normalizeText(
    [
      question?.text || "",
      ...(answers || []).map((answer) => answer.text || ""),
      ...(answers || []).map((answer) => answer.aiReview?.transcript || ""),
    ].join(" ")
  );

  const glossaryMatches = GLOSSARY.filter((entry) =>
    matchesGlossaryEntry(entry, textCorpus, question?.category)
  )
    .slice(0, 3)
    .map((entry, index) => ({
      id: `${normalizeText(entry.term).replace(/\s+/g, "-")}-${index}`,
      term: entry.term,
      definition: entry.definition,
      visual: entry.visual,
      relatedQuestion: questionChain[index] || questionChain[0] || null,
    }));

  if (glossaryMatches.length) {
    return glossaryMatches;
  }

  return extractFallbackTerms(question?.text)
    .slice(0, 2)
    .map((term, index) => {
      const fallback = getFallbackDefinition(term, question?.category);
      return {
        id: `${normalizeText(term).replace(/\s+/g, "-")}-${index}`,
        ...fallback,
        relatedQuestion: questionChain[index] || questionChain[0] || null,
      };
    });
};

const buildQuestionLearningContext = ({
  question,
  answers = [],
  siblingQuestions = [],
}) => {
  const answerCount = Number(question?.answerCount || answers.length || 0);
  const timeToLearn = estimateTimeToLearn(question, answerCount);
  const questionChain = buildQuestionChain(question, siblingQuestions);
  const microDefinitions = buildMicroDefinitions(question, answers, questionChain);

  return {
    timeToLearn,
    questionChain,
    microDefinitions,
  };
};

module.exports = {
  buildQuestionLearningContext,
  estimateTimeToLearn,
  getCategoryLabel,
};

