const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const Bottleneck = require('bottleneck');
const Groq = require('groq-sdk');
require('dotenv').config();
const { db } = require('../data/db');
const aiSelfImprovementService = require('./aiSelfImprovementService');
const {
  DEFAULT_LANGUAGE,
  getLanguageInstruction,
  normalizeLanguageCode,
} = require('../config/languageConfig');
const { detectLanguageFast } = require('./languageDetector');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_HTTP_REFERER =
  process.env.OPENROUTER_HTTP_REFERER || 'https://5second.app';
const OPENROUTER_APP_TITLE =
  process.env.OPENROUTER_APP_TITLE || '5SecondAnswers';
const OPENROUTER_SMART_MODEL =
  process.env.OPENROUTER_SMART_MODEL ||
  process.env.OPENROUTER_MODEL_MEDIUM ||
  'mistralai/mixtral-8x7b-instruct';
const NEMOTRON_API_KEY = process.env.NEMOTRON_API_KEY || '';
const NEMOTRON_BASE_URL =
  process.env.NEMOTRON_BASE_URL || 'https://integrate.api.nvidia.com/v1';
const NEMOTRON_BRAIN_MODEL =
  process.env.NEMOTRON_BRAIN_MODEL ||
  process.env.NEMOTRON_MODEL_COMPLEX ||
  process.env.NEMOTRON_MODEL ||
  'nvidia/nemotron-3-super-120b-a12b';
const normalizeGroqModel = (value) => {
  const requested = String(value || '').trim();

  if (!requested || requested === 'llama-3.1-70b-versatile') {
    return 'llama-3.3-70b-versatile';
  }

  if (requested === 'llama-3.1-70b-specdec') {
    return 'llama-3.3-70b-specdec';
  }

  return requested;
};

const GROQ_MODEL = normalizeGroqModel(process.env.GROQ_MODEL);
const OPENROUTER_MODEL_COMPLEX =
  process.env.OPENROUTER_MODEL_COMPLEX ||
  'mistralai/mixtral-8x22b-instruct';
const GROQ_TRANSCRIPTION_MODEL =
  process.env.GROQ_TRANSCRIPTION_MODEL || 'whisper-large-v3-turbo';
const GOOGLE_FACT_CHECK_KEY = process.env.GOOGLE_FACT_CHECK_API_KEY || '';
const GOOGLE_FACT_CHECK_LANG = process.env.GOOGLE_FACT_CHECK_LANG || 'en';
const AI_HTTP_TIMEOUT_MS = Number(process.env.AI_HTTP_TIMEOUT_MS || 30000);
const AI_MAX_RETRIES = Math.max(0, Number(process.env.AI_MAX_RETRIES || 2));
const AI_RETRY_BASE_MS = Math.max(
  100,
  Number(process.env.AI_RETRY_BASE_MS || 1000)
);
const AI_CHAT_MAX_CONCURRENT = Math.max(
  1,
  Number(process.env.AI_CHAT_MAX_CONCURRENT || 5)
);
const AI_CHAT_MIN_TIME_MS = Math.max(
  0,
  Number(process.env.AI_CHAT_MIN_TIME_MS || 200)
);
const GOOGLE_FACT_CHECK_ENABLED = process.env.GOOGLE_FACT_CHECK_ENABLED !== 'false';
const clampConfigNumber = (value, fallback, min, max) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, numericValue));
};
const AI_QUESTION_TEMPERATURE = clampConfigNumber(
  process.env.AI_QUESTION_TEMPERATURE,
  0.7,
  0,
  2
);
const AI_SENTIMENT_TEMPERATURE = clampConfigNumber(
  process.env.AI_SENTIMENT_TEMPERATURE,
  0.25,
  0,
  2
);
const AI_COMMENT_TEMPERATURE = clampConfigNumber(
  process.env.AI_COMMENT_TEMPERATURE,
  0.82,
  0,
  2
);
const AI_ROUTING_ENABLED = process.env.AI_ROUTING_ENABLED !== 'false';

const DEFAULT_FACT_RESULT = {
  score: 0.65,
  verdict: 'uncertain',
};

let hasWarnedGoogleFactCheckUnavailable = false;
let hasWarnedGroqUnavailable = false;
let hasWarnedOpenRouterUnavailable = false;
let hasWarnedNemotronUnavailable = false;

const groq = GROQ_API_KEY
  ? new Groq({
      apiKey: GROQ_API_KEY,
    })
  : null;

const aiChatLimiter = new Bottleneck({
  maxConcurrent: AI_CHAT_MAX_CONCURRENT,
  minTime: AI_CHAT_MIN_TIME_MS,
});

const AI_COMPLEXITY = {
  SIMPLE: 'simple',
  MEDIUM: 'medium',
  COMPLEX: 'complex',
};

const AI_ROLES = {
  FAST: 'fast',
  SMART: 'smart',
  BRAIN: 'brain',
  BACKUP: 'backup',
};

const TASK_ROUTE_MAP = {
  comment: { role: AI_ROLES.FAST, complexity: AI_COMPLEXITY.SIMPLE },
  comment_moderation: { role: AI_ROLES.FAST, complexity: AI_COMPLEXITY.SIMPLE },
  comment_reactions: { role: AI_ROLES.FAST, complexity: AI_COMPLEXITY.SIMPLE },
  assistant: { role: AI_ROLES.FAST, complexity: AI_COMPLEXITY.SIMPLE },
  summarize: { role: AI_ROLES.SMART, complexity: AI_COMPLEXITY.MEDIUM },
  smart_answer: { role: AI_ROLES.SMART, complexity: AI_COMPLEXITY.MEDIUM },
  answer_validation: { role: AI_ROLES.SMART, complexity: AI_COMPLEXITY.MEDIUM },
  create_lab_ideas: { role: AI_ROLES.SMART, complexity: AI_COMPLEXITY.MEDIUM },
  idea_execution: { role: AI_ROLES.SMART, complexity: AI_COMPLEXITY.MEDIUM },
  sentiment: { role: AI_ROLES.SMART, complexity: AI_COMPLEXITY.MEDIUM },
  story_emotion: { role: AI_ROLES.SMART, complexity: AI_COMPLEXITY.MEDIUM },
  news_question_generation: { role: AI_ROLES.BRAIN, complexity: AI_COMPLEXITY.COMPLEX },
  news_reasoning: { role: AI_ROLES.BRAIN, complexity: AI_COMPLEXITY.COMPLEX },
  deep_analysis: { role: AI_ROLES.BRAIN, complexity: AI_COMPLEXITY.COMPLEX },
  decision_support: { role: AI_ROLES.BRAIN, complexity: AI_COMPLEXITY.COMPLEX },
  general: { role: AI_ROLES.SMART, complexity: AI_COMPLEXITY.MEDIUM },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const safeAiLog = (label, payload) => {
  console.log(label, payload);
};

const getAdaptivePromptBlock = async ({ taskType, country = null, langCode = null } = {}) => {
  try {
    const summary = await aiSelfImprovementService.getPromptOptimizationHints({
      taskType,
      country,
      langCode,
    });

    if (!summary?.hints?.length) {
      return '';
    }

    return `\nAdaptive product feedback:\n- ${summary.hints.join('\n- ')}\n`;
  } catch (error) {
    return '';
  }
};

const toWords = (text) =>
  String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const truncateWords = (text, maxWords = 10) =>
  toWords(text).slice(0, maxWords).join(' ');

const normalizeSummary = (text, maxWords) =>
  truncateWords(String(text || '').replace(/\s+/g, ' ').trim(), maxWords);

const getErrorMessage = (error) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  'Unknown error';

const isRetryableError = (error) => {
  const status = error?.response?.status;

  if (!status) {
    return true;
  }

  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
};

const createServiceError = (service, error) => {
  const wrapped = new Error(getErrorMessage(error));
  wrapped.service = service;
  wrapped.status = error?.response?.status || null;
  wrapped.retryable = isRetryableError(error);
  wrapped.originalError = error;
  return wrapped;
};

const requestWithRetry = async (service, runner) => {
  let lastError = null;

  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt += 1) {
    try {
      return await runner();
    } catch (error) {
      const wrapped = createServiceError(service, error);
      lastError = wrapped;

      console.warn(
        `[AI] ${service} attempt ${attempt + 1}/${AI_MAX_RETRIES + 1} failed` +
          `${wrapped.status ? ` (${wrapped.status})` : ''}: ${wrapped.message}`
      );

      const shouldRetry = wrapped.retryable && attempt < AI_MAX_RETRIES;
      if (!shouldRetry) {
        break;
      }

      await sleep(AI_RETRY_BASE_MS * 2 ** attempt);
    }
  }

  throw lastError || new Error(`${service} request failed`);
};

const buildFactFallback = (text, errorMessage = null) => {
  const wordCount = toWords(text).length;
  const score = wordCount >= 5 ? 0.65 : 0.55;

  return {
    score,
    verdict: score > 0.6 ? 'likely_true' : 'uncertain',
    ...(errorMessage ? { error: errorMessage } : {}),
  };
};

const shouldHideFactCheckError = (error) => {
  const status = error?.status || error?.response?.status;
  const message = getErrorMessage(error).toLowerCase();

  return (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    message.includes('fact check tools api has not been used') ||
    message.includes('api key not valid') ||
    message.includes('permission denied') ||
    message.includes('request failed with status code 403')
  );
};

const warnGoogleFactCheckUnavailableOnce = (message) => {
  if (hasWarnedGoogleFactCheckUnavailable) {
    return;
  }

  hasWarnedGoogleFactCheckUnavailable = true;
  console.warn(`[AI] Google Fact Check unavailable, using fallback: ${message}`);
};

const warnGroqUnavailableOnce = (message) => {
  if (hasWarnedGroqUnavailable) {
    return;
  }

  hasWarnedGroqUnavailable = true;
  console.warn(`[AI] Groq unavailable, using fallback: ${message}`);
};

const warnOpenRouterUnavailableOnce = (message) => {
  if (hasWarnedOpenRouterUnavailable) {
    return;
  }

  hasWarnedOpenRouterUnavailable = true;
  console.warn(`[AI] OpenRouter unavailable, using fallback: ${message}`);
};

const warnNemotronUnavailableOnce = (message) => {
  if (hasWarnedNemotronUnavailable) {
    return;
  }

  hasWarnedNemotronUnavailable = true;
  console.warn(`[AI] Nemotron unavailable, using fallback: ${message}`);
};

const extractJsonObject = (rawText) => {
  const text = String(rawText || '').trim();

  if (!text) {
    return null;
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || text;
  const matchedObject = candidate.match(/\{[\s\S]*\}/);
  const jsonCandidate = matchedObject?.[0] || candidate;
  const startIndex = jsonCandidate.indexOf('{');
  const endIndex = jsonCandidate.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  try {
    return JSON.parse(jsonCandidate.slice(startIndex, endIndex + 1));
  } catch (error) {
    return null;
  }
};

const persistAiOutput = async ({ type, input, output }) => {
  try {
    await db('ai_outputs').insert({
      type,
      input: input || {},
      output: String(output || '').trim(),
    });
  } catch (error) {
    console.warn(`[AI] Failed to persist ai_output (${type}): ${error.message}`);
  }
};

const logAiInput = (feature, input) => {
  safeAiLog('AI INPUT:', {
    feature,
    ...input,
  });
};

const logAiOutput = (feature, output) => {
  safeAiLog('AI OUTPUT:', {
    feature,
    ...output,
  });
};

const scheduleAiChat = (service, runner) =>
  aiChatLimiter.schedule(() => requestWithRetry(service, runner));

const normalizeRouteText = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const resolveTaskRouteConfig = ({
  forceComplexity = null,
  taskType = 'general',
} = {}) => {
  const normalizedTaskType = normalizeRouteText(taskType) || 'general';
  const baseConfig = TASK_ROUTE_MAP[normalizedTaskType] || TASK_ROUTE_MAP.general;
  const forced = normalizeRouteText(forceComplexity);
  const forcedComplexity = Object.values(AI_COMPLEXITY).includes(forced) ? forced : null;

  return {
    taskType: normalizedTaskType,
    role: baseConfig.role,
    complexity: forcedComplexity || baseConfig.complexity,
  };
};

const buildAiRoute = (options = {}) => {
  const createRoute = ({
    complexity,
    provider,
    model,
    role,
    backgroundRoutes = [],
    fallbackRoutes = [],
  }) => ({
    complexity,
    provider,
    model,
    role,
    backgroundRoutes,
    fallbackRoutes,
  });

  const groqRoute = (complexity = AI_COMPLEXITY.SIMPLE) =>
    createRoute({
      complexity,
      provider: 'groq',
      model: GROQ_MODEL,
      role: 'fast',
    });

  const mixtralRoute = (complexity = AI_COMPLEXITY.MEDIUM) =>
    createRoute({
      complexity,
      provider: 'openrouter',
      model:
        complexity === AI_COMPLEXITY.COMPLEX
          ? OPENROUTER_MODEL_COMPLEX
          : OPENROUTER_SMART_MODEL,
      role: AI_ROLES.SMART,
    });

  const nemotronRoute = (complexity = AI_COMPLEXITY.COMPLEX) =>
    createRoute({
      complexity,
      provider: 'nemotron',
      model: NEMOTRON_BRAIN_MODEL,
      role: AI_ROLES.BRAIN,
    });

  const backupRoute = (complexity = AI_COMPLEXITY.MEDIUM) =>
    createRoute({
      complexity,
      provider: 'openrouter',
      model:
        complexity === AI_COMPLEXITY.COMPLEX
          ? OPENROUTER_MODEL_COMPLEX
          : OPENROUTER_SMART_MODEL,
      role: AI_ROLES.BACKUP,
    });

  const taskConfig = resolveTaskRouteConfig(options);

  if (!AI_ROUTING_ENABLED) {
    if (taskConfig.role === AI_ROLES.FAST && GROQ_API_KEY) {
      return groqRoute(AI_COMPLEXITY.SIMPLE);
    }

    if (taskConfig.role === AI_ROLES.SMART && OPENROUTER_API_KEY) {
      return mixtralRoute(taskConfig.complexity);
    }

    if (taskConfig.role === AI_ROLES.BRAIN && NEMOTRON_API_KEY) {
      return nemotronRoute(taskConfig.complexity);
    }

    if (OPENROUTER_API_KEY) {
      return backupRoute(taskConfig.complexity);
    }

    return groqRoute(AI_COMPLEXITY.SIMPLE);
  }

  if (taskConfig.role === AI_ROLES.FAST) {
    return createRoute({
      complexity: taskConfig.complexity,
      provider: 'groq',
      model: GROQ_MODEL,
      role: AI_ROLES.FAST,
      backgroundRoutes: [
        mixtralRoute(AI_COMPLEXITY.MEDIUM),
        nemotronRoute(AI_COMPLEXITY.COMPLEX),
      ],
      fallbackRoutes: [mixtralRoute(AI_COMPLEXITY.MEDIUM)],
    });
  }

  if (taskConfig.role === AI_ROLES.SMART) {
    return createRoute({
      complexity: taskConfig.complexity,
      provider: 'openrouter',
      model:
        taskConfig.complexity === AI_COMPLEXITY.COMPLEX
          ? OPENROUTER_MODEL_COMPLEX
          : OPENROUTER_SMART_MODEL,
      role: AI_ROLES.SMART,
      backgroundRoutes: [],
      fallbackRoutes: [nemotronRoute(AI_COMPLEXITY.COMPLEX)],
    });
  }

  return createRoute({
    complexity: taskConfig.complexity,
    provider: 'nemotron',
    model: NEMOTRON_BRAIN_MODEL,
    role: AI_ROLES.BRAIN,
    fallbackRoutes: [backupRoute(taskConfig.complexity)],
  });
};

const serializeRoute = (route) => ({
  complexity: route.complexity,
  provider: route.provider,
  model: route.model,
  role: route.role || null,
  backgroundRoutes: (route.backgroundRoutes || []).map((backgroundRoute) => ({
    complexity: backgroundRoute.complexity,
    provider: backgroundRoute.provider,
    model: backgroundRoute.model,
    role: backgroundRoute.role || null,
  })),
  fallbackRoutes: (route.fallbackRoutes || []).map((fallbackRoute) => ({
    complexity: fallbackRoute.complexity,
    provider: fallbackRoute.provider,
    model: fallbackRoute.model,
    role: fallbackRoute.role || null,
  })),
});

const buildRoutePreview = (options = {}) => {
  const primary = buildAiRoute(options);
  const fallbacks = (primary.fallbackRoutes || []).map((route) => serializeRoute(route));

  return {
    requested: {
      taskType: options.taskType || 'general',
      forceComplexity: options.forceComplexity || null,
      question: String(options.question || options.title || '').slice(0, 120),
      answer: String(options.answer || options.text || options.prompt || '').slice(0, 120),
    },
    routingEnabled: AI_ROUTING_ENABLED,
    primary: serializeRoute(primary),
    background: (primary.backgroundRoutes || []).map((route) => serializeRoute(route)),
    fallbacks,
    configuredProviders: {
      groq: Boolean(GROQ_API_KEY),
      nemotron: Boolean(NEMOTRON_API_KEY),
      openrouter: Boolean(OPENROUTER_API_KEY),
    },
  };
};

const resolveLanguageCode = async ({
  langCode,
  primaryText,
  fallbackText,
  fallbackLanguage = DEFAULT_LANGUAGE,
}) => {
  const explicitLanguage = String(langCode || '').trim();
  if (explicitLanguage) {
    return normalizeLanguageCode(explicitLanguage, fallbackLanguage);
  }

  const detectionSource = String(primaryText || fallbackText || '').trim();
  return detectLanguageFast(detectionSource, { fallback: fallbackLanguage });
};

const ANALYSIS_STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'with',
  'is',
  'are',
  'what',
  'why',
  'how',
  'one',
  'this',
  'that',
  'po',
  'jo',
  'dhe',
  'nje',
  'një',
  'kur',
  'pse',
  'cfare',
  'çfare',
  'eshte',
  'është',
  'si',
  'qe',
  'që',
  'te',
  'të',
  'se',
  'me',
  'ne',
  'në',
  'per',
  'për',
  'i',
  'e',
]);

const LOW_EFFORT_ANSWERS = new Set([
  'idk',
  'i dont know',
  "i don't know",
  'dont know',
  'no idea',
  'whatever',
  'test',
  'ok',
  'k',
  'lol',
  'haha',
  'hahaha',
  'hmm',
  'meh',
  'se di',
  'nuk e di',
  'sedi',
  'ska lidhje',
  'nuk ka lidhje',
  'po',
  'jo',
  'asgje',
  'asgjë',
]);

const COMMENT_BLOCKLIST = [
  'idiot',
  'stupid',
  'dumb',
  'moron',
  'loser',
  'hate you',
  'bitch',
  'fuck you',
  'fck',
  'budalla',
  'ik pirdhu',
  'pirdhu',
  'qor',
  'mut',
  'vk',
];

const OPINION_QUESTION_HINTS = [
  'what do you think',
  'what is one',
  'why do',
  'would you',
  'red flag',
  'happiness',
  'best way',
  'cfare mendon',
  'çfare mendon',
  'pse',
  'a ia vlen',
];

const normalizeAnalysisText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cleanCommentText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const hasBlockedCommentLanguage = (text) => {
  const normalized = normalizeAnalysisText(text);
  return COMMENT_BLOCKLIST.some((word) => normalized.includes(normalizeAnalysisText(word)));
};

const isLikelyCommentSpam = (text) => {
  const normalized = cleanCommentText(text).toLowerCase();

  if (!normalized) {
    return true;
  }

  if (normalized.length > 180) {
    return true;
  }

  if (/([!?.])\1{4,}/.test(normalized)) {
    return true;
  }

  if (/(.)\1{7,}/.test(normalized.replace(/\s+/g, ''))) {
    return true;
  }

  return false;
};

const buildFallbackCommentModeration = ({ text, langCode }) => {
  const cleaned = cleanCommentText(text);
  const tooShort = cleaned.length < 2;
  const blocked = hasBlockedCommentLanguage(cleaned);
  const spam = isLikelyCommentSpam(cleaned);
  const allowed = !tooShort && !blocked && !spam;

  const suggestedRewrite =
    langCode === 'sq'
      ? 'Provo nje reagim te shkurter, me respekt dhe me opinion real.'
      : 'Try a short, respectful reaction with a real opinion.';

  return {
    allowed,
    severity: blocked ? 'high' : spam || tooShort ? 'medium' : 'low',
    reason: blocked
      ? 'Blocked for toxic language.'
      : spam
        ? 'Blocked as likely spam.'
        : tooShort
          ? 'Comment needs a bit more substance.'
          : 'Looks safe.',
    sanitizedText: cleaned,
    suggestedRewrite: allowed ? null : suggestedRewrite,
  };
};

const normalizeCommentModeration = (parsed, fallback) => {
  if (!parsed || typeof parsed !== 'object') {
    return fallback;
  }

  return {
    allowed: typeof parsed.allowed === 'boolean' ? parsed.allowed : fallback.allowed,
    severity: ['low', 'medium', 'high'].includes(String(parsed.severity || '').toLowerCase())
      ? String(parsed.severity).toLowerCase()
      : fallback.severity,
    reason: cleanCommentText(parsed.reason || fallback.reason).slice(0, 160) || fallback.reason,
    sanitizedText:
      cleanCommentText(parsed.sanitizedText || fallback.sanitizedText).slice(0, 220) ||
      fallback.sanitizedText,
    suggestedRewrite:
      cleanCommentText(parsed.suggestedRewrite || fallback.suggestedRewrite || '').slice(0, 180) ||
      null,
  };
};

const buildFallbackSuggestedReactions = ({ answer, limit = 4, langCode }) => {
  const safeAnswer = cleanCommentText(answer);
  const reactionBase =
    langCode === 'sq'
      ? [
          'Kjo ishte e forte 🔥',
          'Shume e vertete kjo',
          'Nuk jam dakord 😅',
          'Kjo meriton duet 👀',
          safeAnswer ? `"${truncateWords(safeAnswer, 5)}" me kapi 😂` : 'Kjo me kapi fare',
        ]
      : [
          'That was wild 🔥',
          'Low-key true',
          'Nah I disagree 😅',
          'This deserves a duet 👀',
          safeAnswer ? `"${truncateWords(safeAnswer, 5)}" got me 😂` : 'This got me',
        ];

  return reactionBase.slice(0, Math.max(1, Math.min(6, Number(limit) || 4))).map((text, index) => ({
    id: `fallback_${index + 1}`,
    text,
    emoji: (text.match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u) || [null])[0],
  }));
};

const tokenizeForAnalysis = (value) =>
  normalizeAnalysisText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !ANALYSIS_STOP_WORDS.has(token));

const getUniqueOverlapScore = (questionText, answerText) => {
  const questionTokens = [...new Set(tokenizeForAnalysis(questionText))];
  const answerTokens = [...new Set(tokenizeForAnalysis(answerText))];

  if (!questionTokens.length || !answerTokens.length) {
    return 0;
  }

  const questionSet = new Set(questionTokens);
  const matches = answerTokens.filter((token) => questionSet.has(token)).length;

  return Number((matches / Math.max(1, Math.min(questionTokens.length, 4))).toFixed(2));
};

const looksLikeGibberish = (value) => {
  const normalized = normalizeAnalysisText(value).replace(/\s+/g, '');
  if (!normalized) {
    return false;
  }

  const vowelMatches = normalized.match(/[aeiouy]/g) || [];
  const vowelRatio = vowelMatches.length / normalized.length;
  const digitRatio = (normalized.match(/[0-9]/g) || []).length / normalized.length;

  return (
    normalized.length <= 4 ||
    digitRatio >= 0.3 ||
    vowelRatio < 0.2 ||
    /(.)\1\1/.test(normalized)
  );
};

const buildHeuristicAnswerReview = ({
  questionText,
  answerText,
  transcript = null,
  langCode = DEFAULT_LANGUAGE,
}) => {
  const normalizedAnswer = normalizeAnalysisText(answerText);
  const overlapScore = getUniqueOverlapScore(questionText, answerText);
  const lowEffort = LOW_EFFORT_ANSWERS.has(normalizedAnswer);
  const gibberish = looksLikeGibberish(answerText);
  const answerTokens = tokenizeForAnalysis(answerText);
  const veryShort = answerTokens.length <= 1 || normalizedAnswer.length <= 6;
  const likelyOpinionQuestion = OPINION_QUESTION_HINTS.some((hint) =>
    normalizeAnalysisText(questionText).includes(hint)
  );

  let score = 0.45;
  let category = 'weak';
  let feedback = 'Needs a clearer answer.';

  if (!normalizedAnswer) {
    score = 0;
    category = 'empty';
    feedback = 'Empty answer.';
  } else if (gibberish) {
    score = 0.08;
    category = 'gibberish';
    feedback = 'This looks like gibberish, not a real answer.';
  } else if (lowEffort) {
    score = 0.12;
    category = 'low_effort';
    feedback = 'This is too generic and does not really answer the question.';
  } else if (veryShort && overlapScore < 0.2) {
    score = 0.2;
    category = 'off_topic';
    feedback = 'Too short or too vague to match the question.';
  } else if (!likelyOpinionQuestion && overlapScore >= 0.35) {
    score = 0.7;
    category = 'good';
    feedback = 'Relevant and direct.';
  } else if (likelyOpinionQuestion && answerTokens.length >= 2) {
    score = 0.58;
    category = overlapScore >= 0.15 ? 'good' : 'weak';
    feedback =
      overlapScore >= 0.15
        ? 'Subjective answer with enough substance.'
        : 'It sounds like an opinion, but it needs to connect better to the question.';
  }

  return {
    score: Number(score.toFixed(2)),
    category,
    feedback,
    overlapScore,
    lowEffort,
    gibberish,
    transcript,
    langCode: normalizeLanguageCode(langCode, DEFAULT_LANGUAGE),
  };
};

const callGroqChat = async ({
  model = GROQ_MODEL,
  system,
  user,
  temperature = 0.7,
  maxTokens = 80,
}) => {
  if (!groq) {
    warnGroqUnavailableOnce('GROQ_API_KEY not configured');
    return null;
  }

  try {
    const response = await scheduleAiChat('groq-chat', () =>
      groq.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'system',
            content: system,
          },
          {
            role: 'user',
            content: user,
          },
        ],
      })
    );

    return String(response?.choices?.[0]?.message?.content || '').trim() || null;
  } catch (error) {
    warnGroqUnavailableOnce(error.message);
    return null;
  }
};

const callOpenRouterChat = async ({
  model = OPENROUTER_SMART_MODEL,
  system,
  user,
  temperature = 0.7,
  maxTokens = 80,
}) => {
  if (!OPENROUTER_API_KEY) {
    warnOpenRouterUnavailableOnce('OPENROUTER_API_KEY not configured');
    return null;
  }

  try {
    const response = await scheduleAiChat('openrouter-chat', () =>
      openRouterClient.post('/chat/completions', {
        model,
        messages: [
          {
            role: 'system',
            content: system,
          },
          {
            role: 'user',
            content: user,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      })
    );

    return String(response?.data?.choices?.[0]?.message?.content || '').trim() || null;
  } catch (error) {
    warnOpenRouterUnavailableOnce(error.message);
    return null;
  }
};

const callNemotronChat = async ({
  model = NEMOTRON_BRAIN_MODEL,
  system,
  user,
  temperature = 0.4,
  maxTokens = 120,
}) => {
  if (!NEMOTRON_API_KEY) {
    warnNemotronUnavailableOnce('NEMOTRON_API_KEY not configured');
    return null;
  }

  try {
    const response = await scheduleAiChat('nemotron-chat', () =>
      nemotronClient.post('/chat/completions', {
        model,
        messages: [
          {
            role: 'system',
            content: system,
          },
          {
            role: 'user',
            content: user,
          },
        ],
        temperature,
        max_tokens: maxTokens,
      })
    );

    return String(response?.data?.choices?.[0]?.message?.content || '').trim() || null;
  } catch (error) {
    warnNemotronUnavailableOnce(error.message);
    return null;
  }
};

const executeAiRoute = async (route, options = {}) => {
  safeAiLog('[AI ROUTE]', {
    complexity: route.complexity,
    model: route.model,
    provider: route.provider,
    role: route.role || null,
    taskType: options.taskType || 'general',
  });

  const routeOptions = {
    ...options,
    model: route.model,
  };

  if (route.provider === 'nemotron') {
    return callNemotronChat(routeOptions);
  }

  if (route.provider === 'openrouter') {
    return callOpenRouterChat(routeOptions);
  }

  if (route.provider === 'groq') {
    return callGroqChat(routeOptions);
  }

  return null;
};

const callLiveCommentModel = async (options = {}) => {
  const route = buildAiRoute(options);
  const primaryResult = await executeAiRoute(route, options);
  if (primaryResult) {
    return primaryResult;
  }

  for (const fallbackRoute of route.fallbackRoutes || []) {
    const fallbackResult = await executeAiRoute(fallbackRoute, options);
    if (fallbackResult) {
      return fallbackResult;
    }
  }

  return null;
};

const evaluateAnswerAgainstQuestion = async ({
  questionText,
  answerText,
  langCode = DEFAULT_LANGUAGE,
  heuristicReview,
}) => {
  const languageInstruction = getLanguageInstruction(langCode);
  const rawOutput = await callLiveCommentModel({
    taskType: 'answer_validation',
    question: questionText,
    answer: answerText,
    system: `
You evaluate whether an answer actually responds to a question.
- Return ONLY valid JSON
- Be strict with off-topic, nonsense, meme, or low-effort answers
- Reward only answers that clearly address the question
- "reason" must follow this language rule: ${languageInstruction}

JSON schema:
{
  "relevance": 0-1,
  "clarity": 0-1,
  "effort": 0-1,
  "category": "great|good|weak|off_topic|gibberish|low_effort",
  "reason": ""
}
    `.trim(),
    user: `
Question: ${questionText}
Answer: ${answerText}
Heuristic overlap score: ${heuristicReview.overlapScore}
Heuristic flags:
- low effort: ${heuristicReview.lowEffort}
- gibberish: ${heuristicReview.gibberish}
    `.trim(),
    temperature: 0.1,
    maxTokens: 160,
  });

  const parsed = extractJsonObject(rawOutput);
  if (!parsed) {
    return null;
  }

  const relevance = clampUnitNumber(parsed.relevance, heuristicReview.score);
  const clarity = clampUnitNumber(parsed.clarity, 0.5);
  const effort = clampUnitNumber(parsed.effort, 0.5);
  const category = String(parsed.category || heuristicReview.category || 'weak')
    .trim()
    .toLowerCase();
  const reason = String(parsed.reason || heuristicReview.feedback || 'Needs a clearer answer.')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  return {
    relevance,
    clarity,
    effort,
    category,
    reason,
  };
};

const ensureUploadsDir = () => {
  const uploadDir = path.join(__dirname, '../uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
};

const parseJsonArray = (rawText) => {
  const text = String(rawText || '').trim();

  if (!text) {
    return null;
  }

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() || text;
  const startIndex = candidate.indexOf('[');
  const endIndex = candidate.lastIndexOf(']');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  try {
    const parsed = JSON.parse(candidate.slice(startIndex, endIndex + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
};

const createIdeaSlug = (value, index = 0) =>
  String(value || `idea-${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `idea-${index}`;

const createFallbackIdeaTemplates = (category = 'general') => ({
  science: [
    {
      title: 'Shpjego nje fenomen',
      prompt: 'Cili fenomen shkencor mund te shpjegohet ne 5 sekonda pa humbur thelbin?',
      angle: 'Merre nje ide te madhe dhe zbuloje me nje shembull te thjeshte.',
      intent: 'answer',
    },
    {
      title: 'Pyetje qe ndez kuriozitetin',
      prompt: 'Cili fakt shkencor habit me shume kur thuhet thjesht?',
      angle: 'Perfekte per pyetje te re ose per nje answer te shkurter edukativ.',
      intent: 'ask',
    },
  ],
  tech: [
    {
      title: 'Tool qe kursen kohe',
      prompt: 'Cili tool ose shortcut tech ia vlen te shpjegohet ne nje answer ultra te shkurter?',
      angle: 'Fokusohu te vlera praktike dhe rezultati i menjehershem.',
      intent: 'answer',
    },
    {
      title: 'Pyetje e forte tech',
      prompt: 'Cili koncept tech keqkuptohet me shpesh nga fillestaret?',
      angle: 'Beje pyetje te qarte qe sjell pergjigje me vlerë.',
      intent: 'ask',
    },
  ],
  health: [
    {
      title: 'Mit ose zakon i vogel',
      prompt: 'Cili zakon i vogel i shendetit ka impakt te madh kur shpjegohet thjesht?',
      angle: 'Shmang fjalet e renda dhe beje te dobishme per perdorim ditor.',
      intent: 'answer',
    },
    {
      title: 'Pyetje per ekspert',
      prompt: 'Cili mit shendeti meriton nje pergjigje te shpejte nga ekspert?',
      angle: 'Ideale per Ask Expert ose per nje pyetje me besueshmeri te larte.',
      intent: 'ask',
    },
  ],
  history: [
    {
      title: 'Moment qe ndryshon kendveshtrimin',
      prompt: 'Cili moment historie mund te shpjegohet shpejt por ndryshon si e sheh nje epoke?',
      angle: 'Zgjidh nje detaj qe ndez diskutim.',
      intent: 'answer',
    },
    {
      title: 'Pyetje me lidhje',
      prompt: 'Cili event historik hap rrugen per 2-3 pyetje te lidhura me njera-tjetren?',
      angle: 'Mendoje si fillim i nje mini-journey edukativ.',
      intent: 'ask',
    },
  ],
  general: [
    {
      title: 'Hook i shpejte',
      prompt: 'Cila pyetje e thjeshte mund te kthehet ne content qe mbahet mend?',
      angle: 'Nis me nje hook te qarte dhe nje payoff te shpejte.',
      intent: 'ask',
    },
    {
      title: 'Pergjigje e qarte',
      prompt: 'Cili koncept mund te shpjegohet ne 5 sekonda dhe prape te duket i zgjuar?',
      angle: 'Zgjidh qartesi, ritëm dhe nje shembull konkret.',
      intent: 'answer',
    },
  ],
}[category] || createFallbackIdeaTemplates('general'));

const normalizeIdeaRecord = (idea, category = 'general', index = 0) => {
  const intent = idea?.intent === 'answer' ? 'answer' : 'ask';
  const title = String(idea?.title || `Idea ${index + 1}`)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
  const prompt = String(idea?.prompt || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const angle = String(idea?.angle || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  return {
    id: `ai-${createIdeaSlug(`${category}-${title}-${index}`, index)}`,
    title: title || `Idea ${index + 1}`,
    prompt: prompt || 'Gjej nje kend interesant dhe ktheje ne pyetje ose answer te shpejte.',
    angle: angle || 'Beje sa me te qarte dhe te shpejte per feed-in.',
    intent,
    category,
  };
};

const buildFallbackCreateLabIdeas = ({ category = 'general', context = [], limit = 4 } = {}) => {
  const templates = createFallbackIdeaTemplates(category);
  const seedTopics = context
    .map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 3);

  const ideas = [];

  seedTopics.forEach((topic, index) => {
    const template = templates[index % templates.length] || templates[0];
    ideas.push(
      normalizeIdeaRecord(
        {
          title: `${template.title}`,
          prompt: `${topic}`,
          angle: template.angle,
          intent: template.intent,
        },
        category,
        index
      )
    );
  });

  while (ideas.length < limit) {
    const template = templates[ideas.length % templates.length] || templates[0];
    ideas.push(normalizeIdeaRecord(template, category, ideas.length));
  }

  return ideas.slice(0, limit);
};

const fallbackSentiment = (title = '') => {
  const text = String(title || '').toLowerCase();
  const hotWords = ['shok', 'alarm', 'skandal', 'tragjedi', 'fiton', 'humb', 'luft', 'krize'];
  const scoreBoost = hotWords.some((word) => text.includes(word)) ? 0.2 : 0;

  return {
    emotion: scoreBoost ? 'chaotic' : 'calm',
    intensity: Number(Math.min(0.95, 0.45 + scoreBoost).toFixed(2)),
    debate_score: Number(Math.min(0.9, 0.4 + scoreBoost).toFixed(2)),
    relatability: Number(Math.min(0.85, 0.5 + scoreBoost / 2).toFixed(2)),
  };
};

const QUESTION_FALLBACKS = {
  sq: {
    empty: 'Cfare mendon per kete lajm?',
    hot: 'Pse po flet gjithe bota per kete?',
  },
  en: {
    empty: 'What do you think about this news?',
    hot: 'Why is everyone talking about this?',
  },
  it: {
    empty: 'Che ne pensi di questa notizia?',
    hot: 'Perche ne parlano tutti?',
  },
  de: {
    empty: 'Was denkst du uber diese Nachricht?',
    hot: 'Warum spricht jeder daruber?',
  },
  fr: {
    empty: 'Tu penses quoi de cette actu?',
    hot: 'Pourquoi tout le monde en parle?',
  },
  es: {
    empty: 'Que piensas de esta noticia?',
    hot: 'Por que todo el mundo habla de esto?',
  },
  pt: {
    empty: 'O que achas desta noticia?',
    hot: 'Por que toda a gente fala disto?',
  },
  tr: {
    empty: 'Bu haber hakkinda ne dusunuyorsun?',
    hot: 'Neden herkes bundan bahsediyor?',
  },
  ja: {
    empty: 'このニュースをどう思う？',
    hot: 'なぜ今みんながこれを話している？',
  },
  sr: {
    empty: 'Sta mislis o ovoj vesti?',
    hot: 'Zasto svi pricaju o ovome?',
  },
  mk: {
    empty: 'Sto mislis za ova vest?',
    hot: 'Zosto site zboruvaat za ova?',
  },
};

const QUESTION_TOPIC_RULES = [
  {
    topic: 'warning',
    keywords: [
      'kujdes',
      'warning',
      'alert',
      'fake',
      'false page',
      'faqe jo zyrtare',
      'scam',
      'mashtrim',
      'fraud',
      'viza',
      'visa',
    ],
  },
  {
    topic: 'legal',
    keywords: [
      'akuze',
      'aktakuze',
      'korrupsion',
      'gjykat',
      'hetues',
      'prokuror',
      'arrest',
      'dosje',
      'charges',
      'charge',
      'indict',
      'court',
      'judge',
      'trial',
      'corruption',
      'investigation',
      'prosecutor',
    ],
  },
  {
    topic: 'trade',
    keywords: ['tarif', 'import', 'export', 'trade', 'dogan', 'custom', 'china', 'kine'],
  },
  {
    topic: 'conflict',
    keywords: [
      'luft',
      'sulm',
      'raket',
      'missile',
      'attack',
      'conflict',
      'border',
      'trupa',
      'troops',
      'bomb',
      'strike',
    ],
  },
  {
    topic: 'economy',
    keywords: [
      'inflation',
      'cmim',
      'price',
      'tax',
      'salary',
      'pag',
      'job',
      'layoff',
      'market',
      'ekonomi',
      'economy',
      'rent',
      'borxh',
      'debt',
    ],
  },
  {
    topic: 'politics',
    keywords: [
      'president',
      'kryemin',
      'minister',
      'government',
      'qeveri',
      'parliament',
      'parlament',
      'election',
      'vote',
      'poll',
    ],
  },
  {
    topic: 'drama',
    keywords: ['video', 'tradhti', 'scandal', 'skandal', 'celebrity', 'leak', 'divorce', 'affair'],
  },
];

const SPECIFIC_QUESTION_FALLBACKS = {
  sq: {
    legal: 'A beson se kjo shkon ne aktakuze?',
    trade: 'A do te na godasin keto tarifa?',
    conflict: 'A po shkon kjo drejt pershkallezimit?',
    economy: 'A do te preke kjo xhepin tend?',
    politics: 'A ta ndryshon mendjen kjo levizje?',
    drama: 'A i besohet ketij versioni?',
  },
  en: {
    legal: 'Do you think this ends in charges?',
    trade: 'Will these tariffs hit everyday prices?',
    conflict: 'Is this heading toward escalation?',
    economy: 'Will this hit your wallet?',
    politics: 'Does this move change your view?',
    drama: 'Do you buy this version?',
  },
  de: {
    legal: 'Glaubst du, dass das in einer Anklage endet?',
    trade: 'Treffen diese Zoelle den Alltag?',
    conflict: 'Geht das Richtung Eskalation?',
    economy: 'Trifft das direkt den Geldbeutel?',
    politics: 'Aendert dieser Schritt deine Sicht?',
    drama: 'Glaubt man dieser Version wirklich?',
  },
  fr: {
    legal: 'Tu crois que ca finit en accusation ?',
    trade: 'Ces tarifs vont toucher les prix ?',
    conflict: 'Ca va vers une escalation ?',
    economy: 'Ca va toucher ton portefeuille ?',
    politics: 'Ce geste change ton avis ?',
    drama: 'Tu crois vraiment a cette version ?',
  },
  it: {
    legal: 'Pensi che finisca con un accusa?',
    trade: 'Questi dazi colpiranno i prezzi?',
    conflict: 'Sta andando verso un escalation?',
    economy: 'Questo colpira il tuo portafoglio?',
    politics: 'Questa mossa ti cambia idea?',
    drama: 'A questa versione ci credi davvero?',
  },
  es: {
    legal: 'Crees que esto acaba en acusacion?',
    trade: 'Estos aranceles golpearan los precios?',
    conflict: 'Esto va rumbo a una escalada?',
    economy: 'Esto golpeara tu bolsillo?',
    politics: 'Este movimiento te cambia la opinion?',
    drama: 'De verdad te crees esta version?',
  },
  tr: {
    legal: 'Sence bu is dava ile biter mi?',
    trade: 'Bu tarifeler fiyatlari vurur mu?',
    conflict: 'Bu is tirmansa donusur mu?',
    economy: 'Bu senin cebini vurur mu?',
    politics: 'Bu hamle fikrini degistirir mi?',
    drama: 'Bu versiyona gercekten inanir misin?',
  },
  pt: {
    legal: 'Achas que isto acaba em acusacao?',
    trade: 'Estas tarifas vao subir os precos?',
    conflict: 'Isto caminha para escalada?',
    economy: 'Isto vai bater no teu bolso?',
    politics: 'Este passo muda a tua opiniao?',
    drama: 'Tu acreditas mesmo nesta versao?',
  },
  ja: {
    legal: 'これは本当に起訴まで行くと思う？',
    trade: 'この関税で物価は上がると思う？',
    conflict: 'これは更なる緊張に向かう？',
    economy: 'これは生活費に響くと思う？',
    politics: 'この動きで見方は変わる？',
    drama: 'この説明を本当に信じる？',
  },
};

const detectHeadlineTopic = (title = '') => {
  const normalized = String(title || '').toLowerCase();
  if (!normalized) {
    return null;
  }

  for (const rule of QUESTION_TOPIC_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.topic;
    }
  }

  return null;
};

const DECISION_FALLBACKS = {
  sq: {
    warning: {
      summary: 'Ka sinjale qe njerezit mund te bien ne kurth.',
      implication: 'Mund te humbasesh kohe, para ose te dhena nese vepron shpejt.',
      action: 'Verifiko burimin zyrtar para cdo aplikimi ose pagese.',
      risk: 'high',
      why_now: 'Kur dalin faqe jo zyrtare, rreziku i mashtrimit rritet menjehere.',
    },
    legal: {
      summary: 'Ceshtja po shkon drejt presionit ligjor.',
      implication: 'Mund te ndryshoje besimin publik dhe klimën politike.',
      action: 'Mos u mbeshtet te zhurma; prit nje fakt ose dokument zyrtar.',
      risk: 'medium',
      why_now: 'Kur hyn ligji ne loje, narrativa ndryshon shpejt.',
    },
    trade: {
      summary: 'Kjo mund te shtyje lart koston e produkteve.',
      implication: 'Cmimet ose pritjet e tregut mund te levizin shpejt.',
      action: 'Shty vendimet impulsive te blerjes dhe prit nje update tjeter.',
      risk: 'medium',
      why_now: 'Tregu reagon shpejt ndaj tarifave dhe importeve.',
    },
    conflict: {
      summary: 'Tensioni po leviz ne drejtim me te rrezikshem.',
      implication: 'Mund te sjelle pasiguri, frike dhe reagim zinxhir.',
      action: 'Ndiq vetem burime serioze dhe shmang reagimin emocional.',
      risk: 'high',
      why_now: 'Konfliktet levizin shpejt dhe ndikojne narrativen globale.',
    },
    economy: {
      summary: 'Ky sinjal mund te preke direkt xhepin e perditshem.',
      implication: 'Kostoja, puna ose pritjet financiare mund te ndryshojne.',
      action: 'Bej kujdes me shpenzimet dhe mos e injoro trendin.',
      risk: 'medium',
      why_now: 'Kur ekonomia leviz, ndikimi ndjehet shpejt ne jeten reale.',
    },
    politics: {
      summary: 'Levizja politike mund te ndryshoje tonin e debatit.',
      implication: 'Mund te ndikojne bindjet, vota ose klima publike.',
      action: 'Shiko nese ky eshte sinjal real apo thjesht presion mediatik.',
      risk: 'medium',
      why_now: 'Reagimi publik formohet ne oret e para.',
    },
    drama: {
      summary: 'Historia po ushqen reagim dhe mosbesim.',
      implication: 'Njerezit do ndahen shpejt ne ane te kunderta.',
      action: 'Mos e beso versionin e pare pa nje prove tjeter.',
      risk: 'low',
      why_now: 'Drama leviz shpejt kur versionet perplasen.',
    },
    general: {
      summary: 'Ky lajm po fiton peshe shume shpejt.',
      implication: 'Mund te preke vendimet ose kostot e dites tende.',
      action: 'Rri i vemendshem dhe mos vepro pa nje fakt me shume.',
      risk: 'medium',
      why_now: 'Po merr vemendje tani dhe mund te ndryshoje shpejt.',
    },
  },
  en: {
    warning: {
      summary: 'There are signs people could get trapped here.',
      implication: 'You could lose time, money, or data if you rush.',
      action: 'Verify the official source before any application or payment.',
      risk: 'high',
      why_now: 'When unofficial pages appear, scam risk rises immediately.',
    },
    legal: {
      summary: 'This is moving toward real legal pressure.',
      implication: 'It could reshape public trust and the political mood.',
      action: 'Do not react to noise alone; wait for one official fact.',
      risk: 'medium',
      why_now: 'Once legal pressure enters the story, the narrative shifts fast.',
    },
    trade: {
      summary: 'This could push everyday costs higher.',
      implication: 'Prices and market expectations may move quickly.',
      action: 'Delay impulse buying decisions and wait for one more update.',
      risk: 'medium',
      why_now: 'Markets react fast to tariffs and import pressure.',
    },
    conflict: {
      summary: 'The situation is moving toward higher tension.',
      implication: 'It can trigger uncertainty, fear, and chain reactions.',
      action: 'Follow reliable sources only and avoid emotional overreaction.',
      risk: 'high',
      why_now: 'Conflict stories can escalate quickly and reshape the global mood.',
    },
    economy: {
      summary: 'This signal may hit everyday finances directly.',
      implication: 'Costs, jobs, or money expectations could shift.',
      action: 'Watch spending closely and do not ignore the trend.',
      risk: 'medium',
      why_now: 'When the economy moves, people feel it fast.',
    },
    politics: {
      summary: 'This political move may change the debate fast.',
      implication: 'It can influence opinions, votes, or public mood.',
      action: 'Check whether this is a real shift or just media pressure.',
      risk: 'medium',
      why_now: 'Public opinion starts forming in the first hours.',
    },
    drama: {
      summary: 'The story is feeding reaction and distrust.',
      implication: 'People will split into sides very quickly.',
      action: 'Do not trust the first version without one more proof point.',
      risk: 'low',
      why_now: 'Drama moves fast when competing versions collide.',
    },
    general: {
      summary: 'This news is gaining importance quickly.',
      implication: 'It may affect your daily decisions or costs.',
      action: 'Stay alert and do not act before one more concrete fact.',
      risk: 'medium',
      why_now: 'It is picking up attention now and may shift fast.',
    },
  },
  ja: {
    warning: {
      summary: 'ここには人が引っかかる危険なサインがあります。',
      implication: '急ぐと時間やお金、個人情報を失う可能性があります。',
      action: '申請や支払いの前に必ず公式ソースを確認してください。',
      risk: 'high',
      why_now: '非公式ページが出ると詐欺リスクはすぐ上がります。',
    },
    legal: {
      summary: 'この件は法的圧力の段階に近づいています。',
      implication: '世論や政治の空気が変わる可能性があります。',
      action: '騒ぎだけで判断せず、公式な事実をもう一つ待ってください。',
      risk: 'medium',
      why_now: '法的要素が入ると流れは一気に変わります。',
    },
    trade: {
      summary: 'これは日常コストを押し上げる可能性があります。',
      implication: '物価や市場の期待がすぐ動くかもしれません。',
      action: '衝動的な購入を急がず、次の更新を待ってください。',
      risk: 'medium',
      why_now: '関税や輸入の話では市場が素早く反応します。',
    },
    conflict: {
      summary: '状況はより危険な緊張へ向かっています。',
      implication: '不安や連鎖反応を生む可能性があります。',
      action: '信頼できる情報源だけを追い、感情で反応しないでください。',
      risk: 'high',
      why_now: '衝突の話は一気に拡大しやすいです。',
    },
    economy: {
      summary: 'この動きは家計に直接響く可能性があります。',
      implication: '支出や仕事、お金の見通しが変わるかもしれません。',
      action: '出費をよく見直し、この流れを軽く見ないでください。',
      risk: 'medium',
      why_now: '経済の変化は生活にすぐ出ます。',
    },
    politics: {
      summary: 'この政治的な動きは議論の空気を変えるかもしれません。',
      implication: '見方や世論、判断に影響する可能性があります。',
      action: '本当の転換点か、ただの圧力かを見極めてください。',
      risk: 'medium',
      why_now: '世論は最初の数時間で形になり始めます。',
    },
    drama: {
      summary: 'この話は反応と不信感を強く生みます。',
      implication: '人々はすぐに二つの側に分かれやすいです。',
      action: '別の裏付けが出るまで最初の話をそのまま信じないでください。',
      risk: 'low',
      why_now: '食い違う話が出ると拡散が速くなります。',
    },
    general: {
      summary: 'このニュースは急に重みを増しています。',
      implication: '今日の判断や空気感に影響する可能性があります。',
      action: 'もう一つ確かな更新を確認するまで急いで動かないでください。',
      risk: 'medium',
      why_now: '今まさに注目が集まり、流れが変わりやすいです。',
    },
  },
};

const buildNewsDecisionFallback = (title = '', langCode = DEFAULT_LANGUAGE) => {
  const language = normalizeLanguageCode(langCode, DEFAULT_LANGUAGE);
  const topic = detectHeadlineTopic(title) || 'general';
  const fallbackSet = DECISION_FALLBACKS[language] || DECISION_FALLBACKS.en;
  return fallbackSet[topic] || fallbackSet.general;
};

const fallbackGeneratedQuestion = (title = '', langCode = DEFAULT_LANGUAGE) => {
  const normalized = String(title || '').replace(/\s+/g, ' ').trim();
  const language = normalizeLanguageCode(langCode, DEFAULT_LANGUAGE);
  const fallbackSet = QUESTION_FALLBACKS[language] || QUESTION_FALLBACKS.en;

  if (!normalized) {
    return fallbackSet.empty;
  }

  const topic = detectHeadlineTopic(normalized);
  const specificQuestion = SPECIFIC_QUESTION_FALLBACKS[language]?.[topic];
  if (specificQuestion) {
    return specificQuestion;
  }

  return fallbackSet.hot;
};

const QUESTION_LEAK_PATTERNS = [
  /\bwe need to\b/i,
  /\breturn only\b/i,
  /\bheadline\b/i,
  /\bbased on\b/i,
  /\bmax \d+\b/i,
  /\bshort question\b/i,
  /\bproduce a\b/i,
  /\bpyetje:\b/i,
  /\bquestion:\b/i,
];

const stripQuestionMetaParens = (value) => {
  let text = String(value || '');
  let previous = null;

  while (previous !== text) {
    previous = text;
    text = text.replace(/\(([^()]*)\)/g, (match, inner) => {
      const meta = String(inner || '').trim();
      if (
        /\b(emotional|emotionale|provokuese|provocative|provok|fjale|words?|shqip|english|deutsch|francais|italiano|espanol|portugues|japanese|vetem|reply|respond|answer|question|max|tone|style|output)\b/i.test(
          meta
        )
      ) {
        return '';
      }

      return match;
    });
  }

  return text;
};

const normalizeGeneratedQuestion = (value, title, langCode = DEFAULT_LANGUAGE) => {
  const normalized = stripQuestionMetaParens(
    String(value || '')
      .replace(/\*\*/g, '')
      .replace(/[_`]/g, '')
  )
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^(pyetja|question)\s*:\s*/i, '')
    .trim()
    .slice(0, 120);

  if (!normalized) {
    return fallbackGeneratedQuestion(title, langCode);
  }

  const wordCount = toWords(normalized).length;
  const titleTokens = new Set(tokenizeForAnalysis(title));
  const normalizedTokens = tokenizeForAnalysis(normalized);
  const overlapCount = normalizedTokens.filter((token) => titleTokens.has(token)).length;
  const leakedPrompt = QUESTION_LEAK_PATTERNS.some((pattern) => pattern.test(normalized));

  if (leakedPrompt || wordCount > 14 || (titleTokens.size && overlapCount === 0)) {
    return fallbackGeneratedQuestion(title, langCode);
  }

  return /[?!.]$/.test(normalized) ? normalized : `${normalized}?`;
};

const fallbackAIComment = ({ question, answer, timeMode }) => {
  if (timeMode === '10s') {
    return 'Ide e mire, po breshka e mendoi gjate 😬';
  }

  if (String(answer || '').trim()) {
    return 'Shpejt, i qarte, dhe pak brutal ⚡';
  }

  return `5 sek dhe prape e preke piken ⚡`;
};

const pickRandom = (items, fallback = '') => {
  if (!Array.isArray(items) || !items.length) {
    return fallback;
  }

  return items[Math.floor(Math.random() * items.length)] || fallback;
};

const AI_COMMENT_FALLBACKS = {
  sq: {
    slowAnswered: [
      'Mire e the, po 10 sek u ndjene.',
      'Pergjigje e forte, por oreksi erdhi me vonese.',
      'E shpetove, po breshka e pa e para.',
      'Jo keq, por ora e vuri re vonesen.',
    ],
    slowEmpty: [
      '10 sekonda iken shpejt kur vjen presioni.',
      'Slow mode ndezur. Provoje serish me shpejt.',
    ],
    fastAnswered: [
      '5 sekonda dhe e godite paster.',
      'Shpejt, i qarte, dhe me vetebesim.',
      'Respekt. Kjo doli si refleks.',
      'Direkt ne pike. Kjo ka peshe.',
    ],
    fastEmpty: [
      '5 sekonda. Vetem refleksi te shpeton.',
      'Ora nuk pret, por ti mundesh me mire.',
    ],
  },
  en: {
    slowAnswered: [
      'Strong answer, but the 10 seconds showed.',
      'You saved it, but the timer saw everything.',
    ],
    slowEmpty: [
      'Ten seconds disappear fast under pressure.',
      'Slow mode is on. Try it sharper next round.',
    ],
    fastAnswered: [
      'Five seconds and you still nailed it.',
      'Fast, clean, and confident.',
    ],
    fastEmpty: [
      'Five seconds only. Pure reflex mode.',
      'The clock is brutal. You can hit harder.',
    ],
  },
  it: {
    slowAnswered: ['Bella risposta, ma i 10 secondi si sentono.'],
    slowEmpty: ['Dieci secondi passano in fretta sotto pressione.'],
    fastAnswered: ['Cinque secondi e l hai centrata bene.'],
    fastEmpty: ['Cinque secondi soltanto. Solo riflesso puro.'],
  },
  de: {
    slowAnswered: ['Starke Antwort, aber die 10 Sekunden sieht man.'],
    slowEmpty: ['Zehn Sekunden gehen unter Druck schnell vorbei.'],
    fastAnswered: ['Fünf Sekunden und trotzdem voll getroffen.'],
    fastEmpty: ['Nur fünf Sekunden. Reiner Reflexmodus.'],
  },
  fr: {
    slowAnswered: ['Bonne reponse, mais les 10 secondes se voient.'],
    slowEmpty: ['Dix secondes filent vite sous pression.'],
    fastAnswered: ['Cinq secondes et tu as vise juste.'],
    fastEmpty: ['Cinq secondes seulement. Reflexe pur.'],
  },
  tr: {
    slowAnswered: ['Iyi cevap, ama 10 saniye belli oldu.'],
    slowEmpty: ['Baski altinda 10 saniye hizla biter.'],
    fastAnswered: ['Bes saniyede yine de tam vurdun.'],
    fastEmpty: ['Sadece bes saniye. Tam refleks modu.'],
  },
  sr: {
    slowAnswered: ['Dobar odgovor, ali se 10 sekundi oseti.'],
    slowEmpty: ['Deset sekundi prodje brzo pod pritiskom.'],
    fastAnswered: ['Pet sekundi i opet pravo u metu.'],
    fastEmpty: ['Samo pet sekundi. Cist refleks.'],
  },
  mk: {
    slowAnswered: ['Dobar odgovor, ama 10 sekundi se osetija.'],
    slowEmpty: ['Deset sekundi minuvaat brzo pod pritisok.'],
    fastAnswered: ['Pet sekundi i pak pogodi pravo.'],
    fastEmpty: ['Samo pet sekundi. Cist refleks.'],
  },
};

const buildFallbackAIComment = ({ answer, timeMode, langCode }) => {
  const hasAnswer = Boolean(String(answer || '').trim());
  const language = normalizeLanguageCode(langCode, DEFAULT_LANGUAGE);
  const fallbackSet = AI_COMMENT_FALLBACKS[language] || AI_COMMENT_FALLBACKS.en;

  if (timeMode === '10s') {
    return pickRandom(
      hasAnswer ? fallbackSet.slowAnswered : fallbackSet.slowEmpty,
      fallbackSet.slowAnswered[0] || AI_COMMENT_FALLBACKS.en.slowAnswered[0]
    );
  }

  if (hasAnswer) {
    return pickRandom(
      fallbackSet.fastAnswered,
      fallbackSet.fastAnswered[0] || AI_COMMENT_FALLBACKS.en.fastAnswered[0]
    );
  }

  return pickRandom(
    fallbackSet.fastEmpty,
    fallbackSet.fastEmpty[0] || AI_COMMENT_FALLBACKS.en.fastEmpty[0]
  );
};

const AI_COMMENT_STYLES = [
  {
    id: 'funny',
    emoji: '😂',
    instruction:
      'Energjia duhet te jete playful, ironike dhe e lehte. Beje te share-able pa u bere mean.',
  },
  {
    id: 'savage',
    emoji: '💀',
    instruction:
      'Energjia duhet te jete e ashper, confidence-first dhe pak ruthless, por jo ofenduese.',
  },
  {
    id: 'emotional',
    emoji: '🥹',
    instruction:
      'Energjia duhet te jete e ndjere, dramatike dhe e afert, si nje reagim qe prek nervin.',
  },
];

const pickAiCommentStyle = (styleId = null) => {
  const explicitStyle = AI_COMMENT_STYLES.find((style) => style.id === styleId);
  if (explicitStyle) {
    return explicitStyle;
  }

  return pickRandom(AI_COMMENT_STYLES, AI_COMMENT_STYLES[0]);
};

const decorateAiComment = (text, style) => {
  const normalizedText = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim()
    .slice(0, 120);

  if (!normalizedText) {
    return style.emoji;
  }

  return normalizedText.startsWith(style.emoji)
    ? normalizedText
    : `${style.emoji} ${normalizedText}`;
};

const OFF_TOPIC_GUARDRAIL_COMMENTS = {
  sq: [
    'Kjo s iu pergjigj fare pyetjes.',
    'Prit, kjo doli krejt jashte teme.',
  ],
  en: [
    "That did not answer the question at all.",
    'Wait, this one went fully off topic.',
  ],
};

const buildGuardrailComment = ({ langCode, aiReview }) => {
  if (!aiReview) {
    return null;
  }

  const score = Number(aiReview.score || 0);
  const category = String(aiReview.category || '').toLowerCase();
  const language = normalizeLanguageCode(langCode, DEFAULT_LANGUAGE);
  const options = OFF_TOPIC_GUARDRAIL_COMMENTS[language] || OFF_TOPIC_GUARDRAIL_COMMENTS.en;

  if (
    score <= 0.3 ||
    ['off_topic', 'gibberish', 'low_effort', 'empty'].includes(category)
  ) {
    return pickRandom(options, OFF_TOPIC_GUARDRAIL_COMMENTS.en[0]);
  }

  return null;
};

const clampUnitNumber = (value, fallback = 0.5) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return Number(fallback.toFixed(2));
  }

  return Number(Math.max(0, Math.min(1, numericValue)).toFixed(2));
};

const SENTIMENT_EMOTIONS = [
  'savage',
  'funny',
  'emotional',
  'awkward',
  'bold',
  'calm',
  'chaotic',
  'confident',
];

const SENTIMENT_EMOTION_ALIASES = {
  angry: 'savage',
  anxious: 'awkward',
  chaos: 'chaotic',
  excited: 'bold',
  happy: 'funny',
  neutral: 'calm',
  sad: 'emotional',
  serious: 'bold',
  tense: 'chaotic',
};

const normalizeSentimentEmotion = (value, fallback = 'calm') => {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const resolvedFallback = SENTIMENT_EMOTION_ALIASES[fallback] || fallback || 'calm';

  if (SENTIMENT_EMOTIONS.includes(normalized)) {
    return normalized;
  }

  if (SENTIMENT_EMOTION_ALIASES[normalized]) {
    return SENTIMENT_EMOTION_ALIASES[normalized];
  }

  return SENTIMENT_EMOTIONS.includes(resolvedFallback) ? resolvedFallback : 'calm';
};

const normalizeSentimentPayload = (payload, fallback) => ({
  emotion: normalizeSentimentEmotion(payload?.emotion, fallback.emotion || 'calm'),
  intensity: clampUnitNumber(payload?.intensity, fallback.intensity),
  debate_score: clampUnitNumber(payload?.debate_score, fallback.debate_score),
  relatability: clampUnitNumber(payload?.relatability, fallback.relatability),
});

const STORY_EMOTIONS = ['savage', 'funny', 'emotional', 'mysterious', 'chaotic'];

const normalizeStoryBreakdown = (payload = {}, fallbackPrimary = 'chaotic') => {
  const rawValues = STORY_EMOTIONS.map((emotion) =>
    Math.max(0, Number(payload?.[emotion] ?? 0))
  );
  const total = rawValues.reduce((sum, value) => sum + value, 0);

  if (!total) {
    const equalShare = Number((1 / STORY_EMOTIONS.length).toFixed(2));
    return STORY_EMOTIONS.reduce(
      (acc, emotion) => ({
        ...acc,
        [emotion]: equalShare,
      }),
      {}
    );
  }

  let remainder = 1;
  const normalized = {};

  STORY_EMOTIONS.forEach((emotion, index) => {
    if (index === STORY_EMOTIONS.length - 1) {
      normalized[emotion] = Number(Math.max(0, remainder).toFixed(2));
      return;
    }

    const nextValue = Number((rawValues[index] / total).toFixed(2));
    normalized[emotion] = nextValue;
    remainder = Number((remainder - nextValue).toFixed(2));
  });

  if (!STORY_EMOTIONS.includes(fallbackPrimary)) {
    return normalized;
  }

  if (Object.values(normalized).every((value) => value === 0)) {
    normalized[fallbackPrimary] = 1;
  }

  return normalized;
};

const pickPrimaryStoryEmotion = (breakdown = {}) =>
  STORY_EMOTIONS.reduce((best, emotion) => {
    if (!best) {
      return emotion;
    }

    return Number(breakdown[emotion] || 0) > Number(breakdown[best] || 0)
      ? emotion
      : best;
  }, 'chaotic');

const STORY_RESULT_FALLBACKS = {
  sq: {
    savage: {
      summary: 'Ti flet drejt dhe nuk i zbut gjerat kot.',
      badge: 'Pa Filter',
    },
    funny: {
      summary: 'Humori yt del i pari, edhe kur tema eshte e rende.',
      badge: 'Humor i Zi',
    },
    emotional: {
      summary: 'Pergjigjet e tua vijne nga ndjenja, jo nga maska.',
      badge: 'Zemer e Hapur',
    },
    mysterious: {
      summary: 'Ti lë gjithmone dicka pezull dhe kjo te ben interesant.',
      badge: 'Kod i Mbyllur',
    },
    chaotic: {
      summary: 'Instinkti yt eshte i paparashikueshem, por jo i rastesishem.',
      badge: 'Shpirt i Lire',
    },
  },
  en: {
    savage: {
      summary: 'You answer directly and do not soften the edges.',
      badge: 'No Filter',
    },
    funny: {
      summary: 'Humor takes the wheel even when the topic gets sharp.',
      badge: 'Dark Humor',
    },
    emotional: {
      summary: 'Your answers come from feeling before performance.',
      badge: 'Open Heart',
    },
    mysterious: {
      summary: 'You always leave one layer hidden, and that is the point.',
      badge: 'Locked Code',
    },
    chaotic: {
      summary: 'Your instinct is unpredictable, but never boring.',
      badge: 'Free Spirit',
    },
  },
};

const hasMeaningfulStoryAnswer = (value = '') => {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return false;
  }

  return normalized.replace(/[.\s?,_\-!?;:()[\]{}"']/g, '').length > 0;
};

const buildFallbackStoryEmotionScore = (langCode = DEFAULT_LANGUAGE, answers = []) => {
  const normalizedLanguage = normalizeLanguageCode(langCode, DEFAULT_LANGUAGE);
  const answerText = answers
    .filter((entry) => hasMeaningfulStoryAnswer(entry?.answer))
    .map((entry) => String(entry?.answer || '').toLowerCase())
    .join(' ');

  let primary = 'chaotic';
  if (/(haha|lol|qesh|meme|funny)/i.test(answerText)) {
    primary = 'funny';
  } else if (/(dua|zemer|mall|ndjej|love|miss)/i.test(answerText)) {
    primary = 'emotional';
  } else if (/(sinqert|brutal|direkt|never|kurr|urrej|hate)/i.test(answerText)) {
    primary = 'savage';
  } else if (/(sekret|mister|pse jo|maybe|ndoshta)/i.test(answerText)) {
    primary = 'mysterious';
  }

  const templateSet =
    STORY_RESULT_FALLBACKS[normalizedLanguage] || STORY_RESULT_FALLBACKS.en;
  const template = templateSet[primary] || templateSet.chaotic;

  const breakdown = normalizeStoryBreakdown(
    {
      savage: primary === 'savage' ? 0.42 : 0.14,
      funny: primary === 'funny' ? 0.38 : 0.16,
      emotional: primary === 'emotional' ? 0.4 : 0.15,
      mysterious: primary === 'mysterious' ? 0.36 : 0.18,
      chaotic: primary === 'chaotic' ? 0.34 : 0.17,
    },
    primary
  );

  return {
    primary,
    breakdown,
    summary: template.summary,
    badge: template.badge,
    langCode: normalizedLanguage,
  };
};

const normalizeStoryEmotionScore = (payload, fallback) => {
  const primary = STORY_EMOTIONS.includes(String(payload?.primary || '').trim())
    ? String(payload.primary).trim()
    : fallback.primary;
  const breakdown = normalizeStoryBreakdown(payload?.breakdown, primary);

  return {
    primary,
    breakdown,
    summary:
      String(payload?.summary || fallback.summary)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160) || fallback.summary,
    badge:
      String(payload?.badge || fallback.badge)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40) || fallback.badge,
  };
};

const openRouterClient = axios.create({
  baseURL: OPENROUTER_BASE_URL,
  timeout: AI_HTTP_TIMEOUT_MS,
  headers: OPENROUTER_API_KEY
    ? {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': OPENROUTER_HTTP_REFERER,
        'X-Title': OPENROUTER_APP_TITLE,
      }
    : {},
});

const nemotronClient = axios.create({
  baseURL: NEMOTRON_BASE_URL,
  timeout: AI_HTTP_TIMEOUT_MS,
  headers: NEMOTRON_API_KEY
    ? {
        Authorization: `Bearer ${NEMOTRON_API_KEY}`,
      }
    : {},
});

const factCheckClient = axios.create({
  baseURL: 'https://factchecktools.googleapis.com/v1alpha1',
  timeout: Math.min(AI_HTTP_TIMEOUT_MS, 15000),
});

exports.transcribe = async (contentUrl) => {
  if (!contentUrl) {
    return null;
  }

  if (!groq) {
    warnGroqUnavailableOnce('GROQ_API_KEY not configured for transcription');
    return '[Transcription unavailable: GROQ_API_KEY not configured]';
  }

  const uploadDir = ensureUploadsDir();
  const tempFilePath = path.join(uploadDir, `temp_${Date.now()}.mp3`);

  try {
    console.log(`[AI] Transcribing: ${contentUrl}`);

    const downloadResponse = await requestWithRetry('groq-download', () =>
      axios.get(contentUrl, {
        responseType: 'arraybuffer',
        timeout: AI_HTTP_TIMEOUT_MS,
      })
    );

    fs.writeFileSync(tempFilePath, downloadResponse.data);

    const response = await requestWithRetry('groq-transcribe', () =>
      groq.audio.transcriptions.create({
        model: GROQ_TRANSCRIPTION_MODEL,
        file: fs.createReadStream(tempFilePath),
        language: GOOGLE_FACT_CHECK_LANG,
        response_format: 'json',
        temperature: 0,
      })
    );

    const transcript = String(response?.text || '').trim();
    console.log(`[AI] Transcription complete (${transcript.length} chars)`);
    return transcript || '[Transcription unavailable: empty response]';
  } catch (error) {
    console.error(`[AI] Transcription failed: ${error.message}`);
    return `[Transcription unavailable: ${error.message}]`;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
};

exports.summarize = async (text, maxWords = 10) => {
  const sourceText = String(text || '').trim();

  if (!sourceText) {
    return '';
  }

  try {
    console.log(`[AI] Summarizing text to ${maxWords} words`);

    const summary = normalizeSummary(
      await callLiveCommentModel({
        taskType: 'summarize',
        text: sourceText,
        system: `Summarize the text in ${maxWords} words or fewer. Keep only the essential meaning.`,
        user: sourceText.slice(0, 2000),
        temperature: 0.2,
        maxTokens: 120,
      }),
      maxWords
    );

    return summary || truncateWords(sourceText, maxWords);
  } catch (error) {
    console.error(`[AI] Summarization failed: ${error.message}`);
    return truncateWords(sourceText, maxWords);
  }
};

exports.factCheck = async (text) => {
  const sourceText = String(text || '').trim();

  if (!sourceText) {
    return { ...DEFAULT_FACT_RESULT, score: 0 };
  }

  if (!GOOGLE_FACT_CHECK_ENABLED) {
    warnGoogleFactCheckUnavailableOnce('disabled by GOOGLE_FACT_CHECK_ENABLED=false');
    return buildFactFallback(sourceText);
  }

  if (!GOOGLE_FACT_CHECK_KEY) {
    warnGoogleFactCheckUnavailableOnce('GOOGLE_FACT_CHECK_API_KEY not configured');
    return buildFactFallback(sourceText);
  }

  try {
    console.log(`[AI] Fact-checking: "${sourceText.slice(0, 50)}..."`);

    const response = await requestWithRetry('google-fact-check', () =>
      factCheckClient.get('/claims:search', {
        params: {
          query: sourceText.slice(0, 500),
          languageCode: GOOGLE_FACT_CHECK_LANG,
          maxAgeDays: 365,
          pageSize: 5,
          key: GOOGLE_FACT_CHECK_KEY,
        },
      })
    );

    const claims = response?.data?.claims || [];

    if (!claims.length) {
      return {
        ...DEFAULT_FACT_RESULT,
        sources: 0,
      };
    }

    let trueCount = 0;
    let falseCount = 0;
    let mixedCount = 0;

    for (const claim of claims) {
      for (const rating of claim.claimReview || []) {
        const value = String(rating.textualRating || '').toLowerCase();
        if (value.includes('true') || value.includes('correct')) {
          trueCount += 1;
        } else if (value.includes('false') || value.includes('incorrect')) {
          falseCount += 1;
        } else {
          mixedCount += 1;
        }
      }
    }

    const total = trueCount + falseCount + mixedCount;
    let score = 0.5;
    let verdict = 'uncertain';

    if (total > 0) {
      score = trueCount / total;
      if (score > 0.6) {
        verdict = 'likely_true';
      } else if (score < 0.4) {
        verdict = 'likely_false';
      }
    }

    console.log(`[AI] Fact-check complete: ${verdict} (${score.toFixed(2)})`);

    return {
      score,
      verdict,
      sources: claims.length,
    };
  } catch (error) {
    if (shouldHideFactCheckError(error)) {
      warnGoogleFactCheckUnavailableOnce(getErrorMessage(error));
      return buildFactFallback(sourceText);
    }

    console.error(`[AI] Fact-check failed: ${error.message}`);
    return buildFactFallback(sourceText, error.message);
  }
};

exports.validateAnswer = async ({
  type,
  contentUrl,
  text,
  questionText = '',
  langCode = null,
}) => {
  try {
    console.log(`[AI] Starting validation for ${type} answer`);

    let transcript = null;
    if (type === 'video' || type === 'audio') {
      transcript = await exports.transcribe(contentUrl);
    }

    const sourceText = String(text || transcript || '').trim();
    const resolvedLanguage = await resolveLanguageCode({
      langCode,
      primaryText: sourceText,
      fallbackText: questionText,
      fallbackLanguage: DEFAULT_LANGUAGE,
    });

    if (!sourceText) {
      return {
        approved: false,
        shortSummary: '',
        fact: { ...DEFAULT_FACT_RESULT, score: 0 },
        transcript,
        feedback: 'Empty content - cannot validate',
        score: 0,
        category: 'empty',
        relevance: 0,
        clarity: 0,
        effort: 0,
        langCode: resolvedLanguage,
      };
    }

    const heuristicReview = buildHeuristicAnswerReview({
      questionText,
      answerText: sourceText,
      transcript,
      langCode: resolvedLanguage,
    });

    const subjectiveQuestion = OPINION_QUESTION_HINTS.some((hint) =>
      normalizeAnalysisText(questionText).includes(hint)
    );

    const [shortSummary, fact] = await Promise.all([
      exports.summarize(sourceText, 10),
      exports.factCheck(sourceText),
    ]);
    const modelReview = questionText
      ? await evaluateAnswerAgainstQuestion({
          questionText,
          answerText: sourceText,
          langCode: resolvedLanguage,
          heuristicReview,
        })
      : null;

    const relevance = modelReview?.relevance ?? clampUnitNumber(heuristicReview.overlapScore, 0.35);
    const clarity = modelReview?.clarity ?? (heuristicReview.gibberish ? 0.08 : 0.45);
    const effort = modelReview?.effort ?? (heuristicReview.lowEffort ? 0.15 : 0.5);
    const category = modelReview?.category || heuristicReview.category;
    const factWeight = subjectiveQuestion ? 0.08 : 0.22;
    const qualityScore =
      relevance * 0.5 +
      clarity * 0.22 +
      effort * 0.2 +
      clampUnitNumber(fact.score, heuristicReview.score) * factWeight;

    let finalScore = Number(Math.max(0, Math.min(1, qualityScore)).toFixed(2));

    if (heuristicReview.gibberish) {
      finalScore = Math.min(finalScore, 0.08);
    } else if (heuristicReview.lowEffort) {
      finalScore = Math.min(finalScore, 0.18);
    } else if (category === 'off_topic') {
      finalScore = Math.min(finalScore, 0.22);
    }

    const approved = finalScore >= 0.62;
    const feedback =
      modelReview?.reason ||
      heuristicReview.feedback ||
      (approved ? 'Relevant and clear.' : 'Needs review or correction.');

    return {
      approved,
      shortSummary,
      fact,
      transcript,
      feedback,
      score: finalScore,
      category,
      relevance: Number(relevance.toFixed(2)),
      clarity: Number(clarity.toFixed(2)),
      effort: Number(effort.toFixed(2)),
      overlapScore: heuristicReview.overlapScore,
      langCode: resolvedLanguage,
    };
  } catch (error) {
    console.error('[AI] Validation pipeline error:', error);
    return {
      approved: false,
      shortSummary: '',
      fact: { ...DEFAULT_FACT_RESULT, score: 0 },
      transcript: null,
      feedback: `Validation error: ${error.message}`,
      score: 0,
      category: 'error',
      relevance: 0,
      clarity: 0,
      effort: 0,
      langCode: normalizeLanguageCode(langCode, DEFAULT_LANGUAGE),
    };
  }
};

exports.generateCreateLabIdeas = async ({
  category = 'general',
  context = [],
  limit = 4,
} = {}) => {
  const safeLimit = Math.max(1, Math.min(6, Number(limit || 4)));
  const normalizedContext = Array.isArray(context)
    ? context
        .map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .slice(0, 5)
    : [];

  try {
    const adaptivePromptBlock = await getAdaptivePromptBlock({
      taskType: 'create_lab_ideas',
    });
    const contextBlock = normalizedContext.length
      ? normalizedContext.map((entry, index) => `${index + 1}. ${entry}`).join('\n')
      : 'No specific context provided.';

    const rawOutput = await callLiveCommentModel({
      taskType: 'create_lab_ideas',
      text: contextBlock,
      system:
        `You generate short-form content ideas for a mobile creation studio. Return only valid JSON. Produce an array of idea objects with keys: title, prompt, angle, intent. Intent must be either "ask" or "answer". Keep titles under 6 words, prompts under 160 characters, and angles under 120 characters.${adaptivePromptBlock}`,
      user: `Category: ${category}\nNeed: ${safeLimit} ideas for a fast content studio inside a 5-10 second learning app.\nExisting context questions:\n${contextBlock}\nMix practical, curiosity-driven, and creator-friendly ideas.`,
      temperature: 0.9,
      maxTokens: 500,
    });

    const parsedIdeas = parseJsonArray(rawOutput || '');

    if (!parsedIdeas?.length) {
      return buildFallbackCreateLabIdeas({
        category,
        context: normalizedContext,
        limit: safeLimit,
      });
    }

    return parsedIdeas
      .slice(0, safeLimit)
      .map((idea, index) => normalizeIdeaRecord(idea, category, index));
  } catch (error) {
    console.error(`[AI] Create Lab idea generation failed: ${error.message}`);
    return buildFallbackCreateLabIdeas({
      category,
      context: normalizedContext,
      limit: safeLimit,
    });
  }
};

const normalizeIdeaExecutionItem = (item, index = 0) => {
  const buildSteps = Array.isArray(item?.build_steps)
    ? item.build_steps
    : Array.isArray(item?.buildPlan)
      ? item.buildPlan
      : [];

  return {
    id:
      String(item?.id || item?.title || `plan-${index + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || `plan-${index + 1}`,
    title: String(item?.title || `Idea ${index + 1}`)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80),
    idea: String(item?.idea || item?.summary || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 220),
    build_steps: buildSteps
      .map((step) => String(step || "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 4),
    viral_angle: String(item?.viral_angle || item?.viralAngle || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180),
    monetization: String(item?.monetization || item?.business_model || item?.businessModel || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180),
    first_step: String(item?.first_step || item?.firstStep || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180),
    difficulty: ["easy", "medium", "hard"].includes(String(item?.difficulty || "").toLowerCase())
      ? String(item.difficulty).toLowerCase()
      : "medium",
  };
};

const buildFallbackIdeaExecutionPlan = ({ query, langCode = "en", limit = 3 }) => {
  const normalizedQuery = String(query || "").trim() || "new business";
  const isAlbanian = langCode === "sq";
  const seed = [
    {
      title: isAlbanian ? "Mikro newsletter niche" : "Niche micro newsletter",
      idea: isAlbanian
        ? `Nderto nje newsletter te vogel rreth: ${normalizedQuery}. Jep 3 insight-e te shpejta dhe 1 veprim praktik.`
        : `Build a small newsletter around: ${normalizedQuery}. Give 3 sharp insights and 1 practical action.`,
      build_steps: isAlbanian
        ? ["Zgjidh nje niche te ngushte.", "Krijo landing page + form signup.", "Publiko 3 edicione prove."]
        : ["Pick one narrow niche.", "Launch a landing page with email capture.", "Publish 3 test editions."],
      viral_angle: isAlbanian
        ? "Posto nje insight te forte cdo dite si screenshot ose carousel."
        : "Post one sharp insight daily as a screenshot or carousel.",
      monetization: isAlbanian
        ? "Sponsorizime niche ose version premium me signal-e shtese."
        : "Niche sponsorships or a premium tier with extra signals.",
      first_step: isAlbanian ? "Gjej 20 persona qe e kane realisht kete problem." : "Find 20 people who already have this problem.",
      difficulty: "easy",
    },
    {
      title: isAlbanian ? "Tool me template" : "Template-driven tool",
      idea: isAlbanian
        ? `Ktheje ${normalizedQuery} ne nje tool te thjeshte me input -> rezultat.`
        : `Turn ${normalizedQuery} into a simple input-to-result tool.`,
      build_steps: isAlbanian
        ? ["Defino rezultatin kryesor.", "Nderto MVP me 1 flow.", "Vendos wall per save/export."]
        : ["Define the single core outcome.", "Build a one-flow MVP.", "Add a save/export paywall."],
      viral_angle: isAlbanian
        ? "Perdor before/after ose rezultate reale nga user-at."
        : "Use before/after examples or real user outputs.",
      monetization: isAlbanian
        ? "Freemium me credits ose subscription."
        : "Freemium credits or subscription.",
      first_step: isAlbanian ? "Shkruaj rezultatin qe user do te paguante ta marre brenda 30 sekondash." : "Write the outcome a user would pay to get within 30 seconds.",
      difficulty: "medium",
    },
    {
      title: isAlbanian ? "Media + community" : "Media plus community",
      idea: isAlbanian
        ? `Nderto audience rreth ${normalizedQuery}, pastaj ktheje ne komunitet me pagesë.`
        : `Build an audience around ${normalizedQuery}, then convert it into a paid community.`,
      build_steps: isAlbanian
        ? ["Publiko 20 poste prove.", "Mat cilat tema marrin save/share.", "Krijo grup me akses premium."]
        : ["Publish 20 test posts.", "Measure which themes get saves and shares.", "Create a premium access group."],
      viral_angle: isAlbanian
        ? "Publiko krahasime, gabime te zakonshme dhe take te forta."
        : "Post comparisons, common mistakes, and strong takes.",
      monetization: isAlbanian
        ? "Membership, konsultim, ose sponsor niche."
        : "Membership, consulting, or niche sponsors.",
      first_step: isAlbanian ? "Zgjidh 3 tema qe ndezin debat dhe testoji per 7 dite." : "Pick 3 debate-heavy themes and test them for 7 days.",
      difficulty: "medium",
    },
  ];

  return {
    ideas: seed.slice(0, Math.max(1, Math.min(limit, seed.length))).map(normalizeIdeaExecutionItem),
    summary: isAlbanian
      ? "Fillo me versionin me te thjeshte qe mund te publikohet dhe testohet shpejt."
      : "Start with the simplest version you can ship and test quickly.",
  };
};

const shouldUseIdeaExecutionFallback = async ({ result, resolvedLanguage }) => {
  const ideas = Array.isArray(result?.ideas) ? result.ideas : [];
  if (!ideas.length) {
    return true;
  }

  if (ideas.some((idea) => !idea.idea || (idea.build_steps || []).length < 2)) {
    return true;
  }

  if (resolvedLanguage !== "sq") {
    return false;
  }

  const combinedText = [
    result.summary,
    ...ideas.flatMap((idea) => [idea.title, idea.idea, ...(idea.build_steps || []), idea.viral_angle, idea.monetization]),
  ]
    .filter(Boolean)
    .join(" ");

  const detectedLanguage = await detectLanguageFast(combinedText, {
    fallback: resolvedLanguage,
  });

  const hasStrongEnglishMarkers = ideas.some((idea) =>
    [idea.idea, ...(idea.build_steps || []), idea.viral_angle, idea.monetization, idea.first_step]
      .filter(Boolean)
      .some((entry) =>
        /\b(identify|develop|integrate|test|offer|charge|conduct|existing|systems|feedback|subscription|monthly|free trial)\b/i.test(
          String(entry)
        )
      )
  );

  return detectedLanguage === "en" || hasStrongEnglishMarkers;
};

exports.generateIdeaExecutionPlan = async ({
  query,
  langCode = null,
  limit = 3,
  country = null,
} = {}) => {
  const normalizedQuery = String(query || "").replace(/\s+/g, " ").trim();

  if (!normalizedQuery) {
    throw new Error("Query is required for idea execution");
  }

  const resolvedLanguage = await resolveLanguageCode({
    langCode,
    primaryText: normalizedQuery,
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const languageInstruction = getLanguageInstruction(resolvedLanguage);
  const safeLimit = Math.max(1, Math.min(4, Number(limit) || 3));
  const adaptivePromptBlock = await getAdaptivePromptBlock({
    taskType: "idea_execution",
    country,
    langCode: resolvedLanguage,
  });

  const fallback = buildFallbackIdeaExecutionPlan({
    query: normalizedQuery,
    langCode: resolvedLanguage,
    limit: safeLimit,
  });

  const aiInput = {
    query: normalizedQuery,
    langCode: resolvedLanguage,
    limit: safeLimit,
    country,
  };

  logAiInput("generateIdeaExecutionPlan", aiInput);

  try {
    const rawOutput = await callLiveCommentModel({
      taskType: "idea_execution",
      prompt: normalizedQuery,
      text: normalizedQuery,
      system: `
You are SMART AI inside a product studio.
Return ONLY valid JSON with this shape:
{
  "summary": "1 short positioning line",
  "ideas": [
    {
      "title": "",
      "idea": "",
      "build_steps": ["", "", ""],
      "viral_angle": "",
      "monetization": "",
      "first_step": "",
      "difficulty": "easy|medium|hard"
    }
  ]
}
- Generate ${safeLimit} ideas
- Every idea must be practical enough to ship as an MVP
- "build_steps" must be concrete steps, not abstract advice
- "viral_angle" must explain how to get attention fast
- "monetization" must be realistic
- ${languageInstruction}
${adaptivePromptBlock}
      `.trim(),
      user: `Request: ${normalizedQuery}`,
      temperature: 0.55,
      maxTokens: 700,
    });

    const parsed = extractJsonObject(rawOutput);
    const ideas = Array.isArray(parsed?.ideas)
      ? parsed.ideas.slice(0, safeLimit).map((item, index) => normalizeIdeaExecutionItem(item, index))
      : [];

    let result = {
      summary:
        String(parsed?.summary || fallback.summary)
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 180) || fallback.summary,
      ideas: ideas.length ? ideas : fallback.ideas,
      langCode: resolvedLanguage,
    };

    if (await shouldUseIdeaExecutionFallback({ result, resolvedLanguage })) {
      result = {
        ...fallback,
        langCode: resolvedLanguage,
      };
    }

    await persistAiOutput({
      type: "idea_execution",
      input: aiInput,
      output: JSON.stringify(result),
    });

    logAiOutput("generateIdeaExecutionPlan", result);
    return result;
  } catch (error) {
    const result = {
      ...fallback,
      langCode: resolvedLanguage,
    };

    await persistAiOutput({
      type: "idea_execution",
      input: aiInput,
      output: JSON.stringify({
        ...result,
        fallback: true,
        error: error.message,
      }),
    });

    logAiOutput("generateIdeaExecutionPlan", result);
    return result;
  }
};

exports.generateQuestionFromNews = async (title, langCode = null) => {
  const promptInput = String(title || '').replace(/\s+/g, ' ').trim();
  if (!promptInput) {
    return {
      question: fallbackGeneratedQuestion('', langCode),
      langCode: normalizeLanguageCode(langCode, DEFAULT_LANGUAGE),
    };
  }

  const resolvedLanguage = await resolveLanguageCode({
    langCode,
    primaryText: promptInput,
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const languageInstruction = getLanguageInstruction(resolvedLanguage);
  const aiInput = {
    langCode: resolvedLanguage,
    temperature: AI_QUESTION_TEMPERATURE,
    title: promptInput,
  };

  logAiInput('generateQuestion', aiInput);

  const output =
    (await callLiveCommentModel({
      taskType: 'news_question_generation',
      title: promptInput,
      system: `
Ti je editori i HOT questions per app-in "5 Second Answer".
- Ktheje lajmin ne nje pyetje te shkurter qe user e kupton menjehere
- Lidhu direkt me tensionin real te lajmit, jo me nje teme te pergjithshme
- Max 11 fjale
- Duhet te hap debatin ose zgjedhjen e anes
- Shmang forma boshe si "Cfare mendon..." ose "Si ndihesh..."
- Pa markdown, pa yje, pa kllapa, pa thonjeza, pa etiketa, pa shpjegim
- ${languageInstruction}
- Kthe vetem pyetjen
      `.trim(),
      user: `Lajmi: ${promptInput}`,
      temperature: AI_QUESTION_TEMPERATURE,
      maxTokens: 60,
    })) || fallbackGeneratedQuestion(promptInput, resolvedLanguage);

  const question = normalizeGeneratedQuestion(output, promptInput, resolvedLanguage);

  await persistAiOutput({
    type: 'question',
    input: aiInput,
    output: question,
  });

  const result = {
    question,
    langCode: resolvedLanguage,
  };

  logAiOutput('generateQuestion', result);

  return result;
};

exports.generateQuestion = exports.generateQuestionFromNews;

exports.analyzeSentiment = async (input, langCode = null) => {
  const normalizedInput =
    input && typeof input === 'object' && !Array.isArray(input)
      ? input
      : {
          title: input,
          langCode,
        };
  const promptInput = String(
    normalizedInput.answer || normalizedInput.text || normalizedInput.title || ''
  )
    .replace(/\s+/g, ' ')
    .trim();
  if (!promptInput) {
    return fallbackSentiment('');
  }

  const questionText = String(normalizedInput.question || '').replace(/\s+/g, ' ').trim();
  const timeMode = normalizedInput.timeMode === '10s' ? '10s' : '5s';

  const resolvedLanguage = await resolveLanguageCode({
    langCode: normalizedInput.langCode || langCode,
    primaryText: [questionText, promptInput].filter(Boolean).join(' '),
    fallbackText: questionText,
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const fallback = fallbackSentiment(promptInput);
  const aiInput = {
    answer: promptInput,
    langCode: resolvedLanguage,
    question: questionText || null,
    temperature: AI_SENTIMENT_TEMPERATURE,
    timeMode,
  };

  logAiInput('analyzeSentiment', aiInput);

  const rawOutput = await callLiveCommentModel({
    taskType: 'sentiment',
    question: questionText,
    answer: promptInput,
    system: `
Analizo tonin emocional te pergjigjes dhe kthe VETEM JSON:
{
 emotion: "",
 intensity: 0-1,
 debate_score: 0-1,
 relatability: 0-1
}
- emotion duhet te jete vetem nje nga keto: savage, funny, emotional, awkward, bold, calm, chaotic, confident
- intensity mat sa e forte del energjia e pergjigjes
- debate_score mat sa shume mund te ndajne mendim njerezit
- relatability mat sa lehte e ndjen dikush si "edhe une keshtu"
- perdor pyetjen vetem si kontekst, jo si burim emocionesh
- nese pergjigjja eshte neutrale, zgjidh "calm"
- nese timeMode eshte 10s, lejo pak me shume reflektim; nese 5s, favorizo impulsin
    `.trim(),
    user: `
Pyetja: ${questionText || '(pa kontekst)'}
Pergjigjja: ${promptInput}
Koha: ${timeMode}
    `.trim(),
    temperature: AI_SENTIMENT_TEMPERATURE,
    maxTokens: 120,
  });

  const parsed = extractJsonObject(rawOutput);
  const normalized = normalizeSentimentPayload(parsed, fallback);

  await persistAiOutput({
    type: 'sentiment',
    input: aiInput,
    output: JSON.stringify(normalized),
  });

  const result = {
    ...normalized,
    langCode: resolvedLanguage,
  };

  logAiOutput('analyzeSentiment', result);

  return result;
};

const normalizeSmartAnswerInsight = (payload, fallback) => ({
  summary:
    String(payload?.summary || fallback.summary)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || fallback.summary,
  takeaway:
    String(payload?.takeaway || fallback.takeaway)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || fallback.takeaway,
  feed_hook:
    String(payload?.feed_hook || fallback.feed_hook)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || fallback.feed_hook,
});

const isGroundedInsightText = (insightText, sourceText) => {
  const insightTokens = new Set(tokenizeForAnalysis(insightText));
  const sourceTokens = new Set(tokenizeForAnalysis(sourceText));

  if (!insightTokens.size || !sourceTokens.size) {
    return false;
  }

  let matches = 0;
  for (const token of insightTokens) {
    if (sourceTokens.has(token)) {
      matches += 1;
    }
  }

  return matches >= 1;
};

exports.generateSmartAnswerInsight = async ({
  question = '',
  answer = '',
  timeMode = '5s',
  langCode = null,
} = {}) => {
  const normalizedQuestion = String(question || '').replace(/\s+/g, ' ').trim();
  const normalizedAnswer = String(answer || '').replace(/\s+/g, ' ').trim();

  const resolvedLanguage = await resolveLanguageCode({
    langCode,
    primaryText: `${normalizedQuestion} ${normalizedAnswer}`.trim(),
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const languageInstruction = getLanguageInstruction(resolvedLanguage);

  const fallback = {
    summary:
      resolvedLanguage === 'sq'
        ? 'Pergjigjja duket spontane dhe mban energji te drejtperdrejte.'
        : 'The answer feels spontaneous and keeps direct energy.',
    takeaway:
      resolvedLanguage === 'sq'
        ? 'Ka nje reagim te qarte, por mund te forcohet me nje arsye me konkrete.'
        : 'It has a clear reaction, but it gets stronger with one concrete reason.',
    feed_hook:
      resolvedLanguage === 'sq'
        ? 'Kjo hyn mire si moment impulsiv me pak debat.'
        : 'This works well as an impulsive moment with some debate.',
  };

  const aiInput = {
    question: normalizedQuestion,
    answer: normalizedAnswer,
    timeMode,
    langCode: resolvedLanguage,
  };
  const adaptivePromptBlock = await getAdaptivePromptBlock({
    taskType: 'smart_answer',
    langCode: resolvedLanguage,
  });

  logAiInput('generateSmartAnswerInsight', aiInput);

  const rawOutput = await callLiveCommentModel({
    taskType: 'smart_answer',
    question: normalizedQuestion,
    answer: normalizedAnswer,
    text: `${normalizedQuestion}\n${normalizedAnswer}`.trim(),
    system: `
You are SMART AI, the logical layer for a fast-answer social app.
Return ONLY valid JSON:
{
  "summary": "one short sentence about what the answer is actually saying",
  "takeaway": "one short sentence with the clearest point or missing piece",
  "feed_hook": "one short sentence for why people would react in feed"
}
- Ground every line in the actual answer text
- If the answer is weak, vague, or dodges the question, say that directly
- Do not repeat the question word-for-word
- Keep each field under 18 words
- No filler phrases like "overall", "in essence", "it seems that"
- ${languageInstruction}
- Avoid robotic phrasing, therapy tone, and academic tone
${adaptivePromptBlock}
    `.trim(),
    user: `
Question: ${normalizedQuestion || '(missing)'}
Answer: ${normalizedAnswer || '(missing)'}
Time mode: ${timeMode}
    `.trim(),
    temperature: 0.35,
    maxTokens: 180,
  });

  const parsed = extractJsonObject(rawOutput);
  let normalized = normalizeSmartAnswerInsight(parsed, fallback);
  const sourceText = `${normalizedQuestion} ${normalizedAnswer}`.trim();
  const looksGrounded =
    isGroundedInsightText(normalized.summary, sourceText) ||
    isGroundedInsightText(normalized.takeaway, sourceText);

  if (!looksGrounded) {
    normalized = fallback;
  }

  await persistAiOutput({
    type: 'smart_answer',
    input: aiInput,
    output: JSON.stringify(normalized),
  });

  const result = {
    ...normalized,
    langCode: resolvedLanguage,
  };

  logAiOutput('generateSmartAnswerInsight', result);

  return result;
};

const normalizeBrainInsight = (payload, fallback) => {
  const riskLevel = ['low', 'medium', 'high'].includes(String(payload?.risk_level || '').toLowerCase())
    ? String(payload.risk_level).toLowerCase()
    : fallback.risk_level;
  const confidence = Number(payload?.confidence);

  return {
    summary:
      String(payload?.summary || fallback.summary)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180) || fallback.summary,
    risk_level: riskLevel,
    confidence: Number.isFinite(confidence)
      ? Math.max(0, Math.min(1, confidence))
      : fallback.confidence,
    why:
      String(payload?.why || fallback.why)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 240) || fallback.why,
    next_step:
      String(payload?.next_step || fallback.next_step)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180) || fallback.next_step,
    feed_angle:
      String(payload?.feed_angle || fallback.feed_angle)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180) || fallback.feed_angle,
  };
};

const normalizeNewsDecisionBrief = (payload, fallback) => {
  const riskLevel = ['low', 'medium', 'high'].includes(String(payload?.risk || '').toLowerCase())
    ? String(payload.risk).toLowerCase()
    : fallback.risk;

  return {
    summary:
      String(payload?.summary || fallback.summary)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 160) || fallback.summary,
    implication:
      String(payload?.implication || fallback.implication)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180) || fallback.implication,
    action:
      String(payload?.action || fallback.action)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180) || fallback.action,
    risk: riskLevel,
    why_now:
      String(payload?.why_now || fallback.why_now)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180) || fallback.why_now,
  };
};

exports.generateNewsDecisionBrief = async ({
  title = '',
  category = 'general',
  country = null,
  langCode = null,
  sentiment = null,
  viralScore = null,
} = {}) => {
  const normalizedTitle = String(title || '').replace(/\s+/g, ' ').trim();

  if (!normalizedTitle) {
    return {
      summary: 'No news headline available.',
      implication: 'There is not enough context yet.',
      action: 'Wait for a clearer update.',
      risk: 'medium',
      why_now: 'This topic may matter once more details arrive.',
      langCode: normalizeLanguageCode(langCode, DEFAULT_LANGUAGE),
    };
  }

  const resolvedLanguage = await resolveLanguageCode({
    langCode,
    primaryText: normalizedTitle,
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const languageInstruction = getLanguageInstruction(resolvedLanguage);
  const fallback = buildNewsDecisionFallback(normalizedTitle, resolvedLanguage);

  const aiInput = {
    title: normalizedTitle,
    category,
    country,
    langCode: resolvedLanguage,
    sentiment,
    viralScore,
  };
  const adaptivePromptBlock = await getAdaptivePromptBlock({
    taskType: 'decision_support',
    country,
    langCode: resolvedLanguage,
  });

  logAiInput('generateNewsDecisionBrief', aiInput);

  const rawOutput = await callLiveCommentModel({
    taskType: 'decision_support',
    title: normalizedTitle,
    text: normalizedTitle,
    system: `
You are BRAIN AI for a short-form decision product.
Return ONLY valid JSON:
{
  "summary": "5-second summary",
  "implication": "what this means for the user",
  "action": "best practical action",
  "risk": "low|medium|high",
  "why_now": "why this matters now"
}
- Be concrete, human, and useful
- Ground everything in the headline only
- Do not invent facts beyond the headline
- Keep each field short and scannable
- "action" must be practical, not vague motivation
- ${languageInstruction}
${adaptivePromptBlock}
    `.trim(),
    user: `
Headline: ${normalizedTitle}
Category: ${String(category || 'general')}
Country: ${String(country || 'unknown')}
Sentiment: ${JSON.stringify(sentiment || {})}
Viral score: ${Number(viralScore || 0)}
    `.trim(),
    temperature: 0.22,
    maxTokens: 220,
  });

  const parsed = extractJsonObject(rawOutput);
  const normalized = normalizeNewsDecisionBrief(parsed, fallback);

  await persistAiOutput({
    type: 'news_decision_brief',
    input: aiInput,
    output: JSON.stringify(normalized),
  });

  const result = {
    ...normalized,
    langCode: resolvedLanguage,
  };

  logAiOutput('generateNewsDecisionBrief', result);

  return result;
};

exports.generateBrainInsight = async ({
  question = '',
  answer = '',
  timeMode = '5s',
  langCode = null,
} = {}) => {
  const normalizedQuestion = String(question || '').replace(/\s+/g, ' ').trim();
  const normalizedAnswer = String(answer || '').replace(/\s+/g, ' ').trim();

  if (!normalizedQuestion && !normalizedAnswer) {
    return {
      summary: 'No answer context available.',
      risk_level: 'medium',
      confidence: 0.32,
      why: 'There was not enough context for a deeper decision layer.',
      next_step: 'Collect a clearer answer first.',
      feed_angle: 'No strong angle yet.',
      langCode: normalizeLanguageCode(langCode, DEFAULT_LANGUAGE),
    };
  }

  const resolvedLanguage = await resolveLanguageCode({
    langCode,
    primaryText: `${normalizedQuestion} ${normalizedAnswer}`.trim(),
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const languageInstruction = getLanguageInstruction(resolvedLanguage);

  const fallback = {
    summary:
      resolvedLanguage === 'sq'
        ? 'Pergjigjja ka nevoje per pak me shume kontekst para nje vendimi te forte.'
        : 'This answer needs a bit more context before a strong decision layer.',
    risk_level:
      /(invest|crypto|money|loan|borxh|investoj|bitcoin|career|job|nderrim)/i.test(
        `${normalizedQuestion} ${normalizedAnswer}`
      )
        ? 'high'
        : 'medium',
    confidence: 0.58,
    why:
      resolvedLanguage === 'sq'
        ? 'Ka sinjal emocional, por vendimi final varet nga me shume detaje.'
        : 'There is emotional signal here, but the final decision needs more detail.',
    next_step:
      resolvedLanguage === 'sq'
        ? 'Kerko nje arsye konkrete ose nje kriter para se ta kthesh ne vendim.'
        : 'Ask for one concrete reason or criterion before turning this into a decision.',
    feed_angle:
      resolvedLanguage === 'sq'
        ? 'Kjo hyn mire si debat: instinkt kunder logjikes.'
        : 'This plays well as a debate: instinct versus logic.',
  };

  const aiInput = {
    question: normalizedQuestion,
    answer: normalizedAnswer,
    timeMode,
    langCode: resolvedLanguage,
  };
  const adaptivePromptBlock = await getAdaptivePromptBlock({
    taskType: 'deep_analysis',
    langCode: resolvedLanguage,
  });

  logAiInput('generateBrainInsight', aiInput);

  const rawOutput = await callLiveCommentModel({
    taskType: 'deep_analysis',
    question: normalizedQuestion,
    answer: normalizedAnswer,
    text: `${normalizedQuestion}\n${normalizedAnswer}`.trim(),
    system: `
You are BRAIN AI, the heavy reasoning layer for a fast-answer social app.
Return ONLY valid JSON with:
{
  "summary": "1 compact paragraph",
  "risk_level": "low|medium|high",
  "confidence": 0-1,
  "why": "the concrete reason this matters",
  "next_step": "the best next practical step",
  "feed_angle": "how this could be framed for feed or insights"
}
- Use the question and answer together
- Ground every field in the provided text only
- Be honest about uncertainty and do not overclaim
- confidence must reflect evidence in the answer, not your own confidence
- risk_level should be high only when there is real downside, cost, or decision risk
- No corporate tone, no therapy language, no generic motivation
- ${languageInstruction}
${adaptivePromptBlock}
    `.trim(),
    user: `
Question: ${normalizedQuestion || '(missing)'}
Answer: ${normalizedAnswer || '(missing)'}
Time mode: ${timeMode}
    `.trim(),
    temperature: 0.28,
    maxTokens: 260,
  });

  const parsed = extractJsonObject(rawOutput);
  const normalized = normalizeBrainInsight(parsed, fallback);

  await persistAiOutput({
    type: 'deep_analysis',
    input: aiInput,
    output: JSON.stringify(normalized),
  });

  const result = {
    ...normalized,
    langCode: resolvedLanguage,
  };

  logAiOutput('generateBrainInsight', result);

  return result;
};

exports.generateAICommentPayload = async ({
  question,
  answer,
  timeMode = '5s',
  langCode = null,
  aiReview = null,
  style = null,
}) => {
  const resolvedLanguage = await resolveLanguageCode({
    langCode,
    primaryText: [question, answer].filter(Boolean).join(' '),
    fallbackText: question,
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const languageInstruction = getLanguageInstruction(resolvedLanguage);
  const promptInput = {
    question: String(question || '').replace(/\s+/g, ' ').trim(),
    answer: String(answer || '').replace(/\s+/g, ' ').trim(),
    timeMode: timeMode === '10s' ? '10s' : '5s',
    langCode: resolvedLanguage,
  };
  const commentStyle = pickAiCommentStyle(style);
  const guardrailComment = buildGuardrailComment({
    langCode: resolvedLanguage,
    aiReview,
  });
  const aiInput = {
    ...promptInput,
    aiReview: aiReview || null,
    style: commentStyle.id,
    temperature: AI_COMMENT_TEMPERATURE,
  };
  const adaptivePromptBlock = await getAdaptivePromptBlock({
    taskType: 'comment',
    langCode: resolvedLanguage,
  });

  logAiInput('generateAIComment', aiInput);

  if (guardrailComment) {
    const guardedComment = decorateAiComment(guardrailComment, commentStyle);

    await persistAiOutput({
      type: 'comment',
      input: aiInput,
      output: guardedComment,
    });

    const guardedResult = {
      comment: guardedComment,
      emoji: commentStyle.emoji,
      guardrail: true,
      langCode: resolvedLanguage,
      style: commentStyle.id,
    };

    logAiOutput('generateAIComment', guardedResult);

    return guardedResult;
  }

  const rawOutput = await callLiveCommentModel({
    taskType: 'comment',
    question: promptInput.question,
    answer: promptInput.answer,
    system: `
Ti je FAST AI, fytyra e app-it 5 Second Answer.

- Max 10 fjale
- Style: ${commentStyle.id}
- ${commentStyle.instruction}
- Reago si koment i menjehershem ne feed, jo si analize
- Mos perserit pyetjen
- Mos perdor hashtags, thonjeza, ose dy fjali
- Nese 5s -> energji, respekt, impuls
- Nese 10s -> pak tallje ose presion i lehte, pa kaluar ne ofendim
- Nese pergjigjja eshte pa lidhje, gibberish, ose low effort: mos e lavdero; thirre qarte
- Kur pergjigjja eshte e forte, kap kendin me te mprehte ose me te ndjere
- ${languageInstruction}
${adaptivePromptBlock}
Vetem 1 koment.
    `.trim(),
    user: `
Pyetja: ${promptInput.question}
Pergjigja: ${promptInput.answer}
Koha: ${promptInput.timeMode}
AI quality score: ${Number(aiReview?.score || 0).toFixed(2)}
AI category: ${String(aiReview?.category || 'unknown')}
    `.trim(),
    temperature: AI_COMMENT_TEMPERATURE,
    maxTokens: 50,
  });

  const comment = decorateAiComment(
    rawOutput || buildFallbackAIComment(promptInput),
    commentStyle
  );

  await persistAiOutput({
    type: 'comment',
    input: aiInput,
    output: comment,
  });

  const result = {
    comment,
    emoji: commentStyle.emoji,
    guardrail: false,
    langCode: resolvedLanguage,
    style: commentStyle.id,
  };

  logAiOutput('generateAIComment', result);

  return result;
};

exports.generateAIComment = async (payload) => {
  const result = await exports.generateAICommentPayload(payload);
  return result.comment;
};

exports.generateAssistantReply = async ({
  prompt,
  systemContext = '',
  langCode = null,
  maxTokens = 180,
  temperature = 0.35,
}) => {
  const resolvedLanguage = await resolveLanguageCode({
    langCode,
    primaryText: prompt,
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const languageInstruction = getLanguageInstruction(resolvedLanguage);
  const normalizedPrompt = String(prompt || '').replace(/\s+/g, ' ').trim();

  if (!normalizedPrompt) {
    throw new Error('Prompt is required for assistant reply');
  }

  const fallbackReply =
    resolvedLanguage === 'sq'
      ? 'Jam gati te ndihmoj me Story Mode, Duet, Mirror, lajmet LIVE dhe challenge-t.'
      : 'I can help with Story Mode, Duet, Mirror, LIVE news, and challenges.';
  const adaptivePromptBlock = await getAdaptivePromptBlock({
    taskType: 'assistant',
    langCode: resolvedLanguage,
  });

  const rawOutput = await callLiveCommentModel({
    taskType: 'assistant',
    prompt: normalizedPrompt,
    text: `${systemContext} ${normalizedPrompt}`.trim(),
    system: `
Ti je AI copiloti i app-it 5 Second Answer.

- Jep pergjigje te shkurtra, praktike, te ngrohta
- Shpjego feature-t e app-it qarte
- Sugjero hapin e radhes kur ka kuptim
- Mos shpik feature qe nuk jane permendur ne context
- ${languageInstruction}
${adaptivePromptBlock}

Context i app-it:
${String(systemContext || '').trim() || 'App ka Mirror, Story Mode, Duet, hashtags/challenges, notifications dhe LIVE news.'}
    `.trim(),
    user: normalizedPrompt,
    temperature,
    maxTokens,
  });

  const reply = String(rawOutput || fallbackReply)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);

  await persistAiOutput({
    type: 'assistant',
    input: {
      langCode: resolvedLanguage,
      prompt: normalizedPrompt,
      systemContext,
    },
    output: reply,
  });

  return {
    langCode: resolvedLanguage,
    reply,
  };
};

exports.moderateComment = async ({
  text,
  question = '',
  answer = '',
  langCode = null,
}) => {
  const cleaned = cleanCommentText(text);
  const resolvedLanguage = await resolveLanguageCode({
    langCode,
    primaryText: cleaned,
    fallbackText: `${question} ${answer}`.trim(),
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const fallback = buildFallbackCommentModeration({
    text: cleaned,
    langCode: resolvedLanguage,
  });

  if (!cleaned) {
    return fallback;
  }

  if (!fallback.allowed && fallback.severity === 'high') {
    await persistAiOutput({
      type: 'comment_moderation',
      input: { text: cleaned, question, answer, langCode: resolvedLanguage },
      output: JSON.stringify(fallback),
    });
    return fallback;
  }

  const languageInstruction = getLanguageInstruction(resolvedLanguage);
  const rawOutput = await callLiveCommentModel({
    taskType: 'comment_moderation',
    question,
    answer,
    text: cleaned,
    system: `
Ti je moderator komentesh per nje app social.
Kthe VETEM JSON me skemen:
{
  "allowed": true|false,
  "severity": "low|medium|high",
  "reason": "1 fjali e shkurter",
  "sanitizedText": "teksti i pastruar",
  "suggestedRewrite": "opsionale"
}

- Blloko toksicitet, sharje, sulm personal dhe spam
- Lejo komente te shkurtra nese jane reagime reale
- ${languageInstruction}
    `.trim(),
    user: `
Pyetja: ${String(question || '').trim()}
Pergjigja: ${String(answer || '').trim()}
Komenti: ${cleaned}
    `.trim(),
    temperature: 0.1,
    maxTokens: 140,
  });

  const parsed = extractJsonObject(rawOutput);
  const normalized = normalizeCommentModeration(parsed, fallback);

  await persistAiOutput({
    type: 'comment_moderation',
    input: { text: cleaned, question, answer, langCode: resolvedLanguage },
    output: JSON.stringify(normalized),
  });

  return normalized;
};

exports.suggestCommentReactions = async ({
  question = '',
  answer = '',
  langCode = null,
  limit = 4,
}) => {
  const resolvedLanguage = await resolveLanguageCode({
    langCode,
    primaryText: answer,
    fallbackText: question,
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const safeLimit = Math.max(1, Math.min(6, Number(limit) || 4));
  const fallback = buildFallbackSuggestedReactions({
    answer,
    limit: safeLimit,
    langCode: resolvedLanguage,
  });
  const languageInstruction = getLanguageInstruction(resolvedLanguage);

  const rawOutput = await callLiveCommentModel({
    taskType: 'comment_reactions',
    question,
    answer,
    system: `
Krijo komente te shkurtra per reaction chips ne nje app social.
Kthe VETEM JSON me skemen:
{
  "suggestions": [
    { "text": "koment i shkurter", "emoji": "emoji opsionale" }
  ]
}

- Max ${safeLimit} sugjerime
- 2 deri 5 fjale secila
- Te duken si reagime reale, jo robotike
- Mund te jene funny, shocked, savage ose supportive
- ${languageInstruction}
    `.trim(),
    user: `
Pyetja: ${String(question || '').trim()}
Pergjigja: ${String(answer || '').trim()}
    `.trim(),
    temperature: 0.7,
    maxTokens: 120,
  });

  const parsed = extractJsonObject(rawOutput);
  const suggestions = Array.isArray(parsed?.suggestions)
    ? parsed.suggestions
        .map((item, index) => ({
          id: `ai_${index + 1}`,
          text: cleanCommentText(item?.text || '').slice(0, 48),
          emoji: cleanCommentText(item?.emoji || '').slice(0, 4) || null,
        }))
        .filter((item) => item.text)
        .slice(0, safeLimit)
    : [];

  const normalized = suggestions.length ? suggestions : fallback;

  await persistAiOutput({
    type: 'comment_reactions',
    input: { question, answer, langCode: resolvedLanguage, limit: safeLimit },
    output: JSON.stringify(normalized),
  });

  return {
    langCode: resolvedLanguage,
    suggestions: normalized,
  };
};

exports.generateStoryEmotionScore = async ({ answers = [], langCode = null }) => {
  const normalizedAnswers = Array.isArray(answers)
    ? answers
        .map((entry, index) => ({
          question: String(entry?.question || '').replace(/\s+/g, ' ').trim(),
          answer: String(entry?.answer || '').replace(/\s+/g, ' ').trim(),
          seconds: Math.max(0, Number(entry?.seconds || 0)),
          order: index + 1,
        }))
        .filter((entry) => entry.question || entry.answer)
    : [];

  const answeredEntries = normalizedAnswers.filter((entry) => hasMeaningfulStoryAnswer(entry.answer));
  const detectionText = answeredEntries
    .map((entry) => entry.answer)
    .join(' ')
    .trim();

  const resolvedLanguage = await resolveLanguageCode({
    langCode,
    primaryText: detectionText,
    fallbackLanguage: DEFAULT_LANGUAGE,
  });
  const fallback = buildFallbackStoryEmotionScore(
    resolvedLanguage,
    answeredEntries
  );
  const languageInstruction = getLanguageInstruction(resolvedLanguage);

  if (!answeredEntries.length) {
    throw new Error('At least one real answer is required for Story Mode analysis');
  }

  const answersText = answeredEntries
    .map(
      (entry) =>
        `Pyetja ${entry.order}: ${entry.question}\nPergjigja: ${entry.answer}\nKoha: ${entry.seconds} sekonda`
    )
    .join('\n\n');

  const rawOutput = await callLiveCommentModel({
    taskType: 'story_emotion',
    text: answersText,
    system: `
Analizon 5 pergjigje spontane dhe klasifikon personalitetin.
Kthe VETEM JSON me kete skeme:
{
  "primary": "savage|funny|emotional|mysterious|chaotic",
  "breakdown": {
    "savage": 0.0-1.0,
    "funny": 0.0-1.0,
    "emotional": 0.0-1.0,
    "mysterious": 0.0-1.0,
    "chaotic": 0.0-1.0
  },
  "summary": "1 fjali - ${languageInstruction}",
  "badge": "Titull i shkurter 2-3 fjale - ${languageInstruction}"
}
- breakdown duhet te kete shume totale 1.0
- mos shto asgje jashte JSON
    `.trim(),
    user: answersText,
    temperature: 0.3,
    maxTokens: 220,
  });

  const parsed = extractJsonObject(rawOutput);
  const normalized = normalizeStoryEmotionScore(parsed, fallback);

  await persistAiOutput({
    type: 'story_emotion',
    input: {
      langCode: resolvedLanguage,
      answers: answeredEntries,
    },
    output: JSON.stringify(normalized),
  });

  return {
    ...normalized,
    langCode: resolvedLanguage,
  };
};

exports.previewRoute = (options = {}) => buildRoutePreview(options);

exports.healthCheck = async () => {
  const groqConfigured = Boolean(GROQ_API_KEY);
  const nemotronConfigured = Boolean(NEMOTRON_API_KEY);
  const openrouterConfigured = Boolean(OPENROUTER_API_KEY);
  const googleConfigured = GOOGLE_FACT_CHECK_ENABLED && Boolean(GOOGLE_FACT_CHECK_KEY);
  const previewSamples = {
    simple: buildRoutePreview({
      taskType: 'comment',
      question: 'A do e beje kete?',
      answer: 'Po, pse jo.',
    }).primary,
    medium: buildRoutePreview({
      taskType: 'sentiment',
      question: 'Explain this vibe.',
      answer: 'It feels bold and a bit awkward, but still relatable.',
    }).primary,
    complex: buildRoutePreview({
      taskType: 'news_question_generation',
      title: 'Breaking news: leaders debate a major new policy shift',
    }).primary,
  };

  const status = {
    groq: groqConfigured,
    nemotron: nemotronConfigured,
    openrouter: openrouterConfigured,
    google_fact_check: googleConfigured,
    ready: groqConfigured || nemotronConfigured || openrouterConfigured,
    degraded:
      !groqConfigured ||
      !nemotronConfigured ||
      !openrouterConfigured ||
      (GOOGLE_FACT_CHECK_ENABLED && !googleConfigured),
    routing_enabled: AI_ROUTING_ENABLED,
    routing_mode: 'team_escalation_locked',
    stack: {
      fast: 'groq',
      smart: 'openrouter_mixtral',
      brain: 'nemotron_super',
      backup: 'role_specific_fallbacks',
    },
    groq_model: GROQ_MODEL,
    nemotron_base_url: NEMOTRON_BASE_URL,
    nemotron_brain_model: NEMOTRON_BRAIN_MODEL,
    openrouter_base_url: OPENROUTER_BASE_URL,
    openrouter_smart_model: OPENROUTER_SMART_MODEL,
    openrouter_model_complex: OPENROUTER_MODEL_COMPLEX,
    groq_transcription_model: GROQ_TRANSCRIPTION_MODEL,
    fact_check_lang: GOOGLE_FACT_CHECK_LANG,
    timeout_ms: AI_HTTP_TIMEOUT_MS,
    max_retries: AI_MAX_RETRIES,
    chat_max_concurrent: AI_CHAT_MAX_CONCURRENT,
    chat_min_time_ms: AI_CHAT_MIN_TIME_MS,
    routing_preview: previewSamples,
  };

  console.log('[AI] Health:', status);
  return status;
};
