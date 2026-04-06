const Groq = require('groq-sdk');
require('dotenv').config();

const {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  normalizeLanguageCode,
} = require('../config/languageConfig');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
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

const FRANC_LANGUAGE_MAP = {
  sqi: 'sq',
  eng: 'en',
  ita: 'it',
  deu: 'de',
  fra: 'fr',
  tur: 'tr',
  srp: 'sr',
  mkd: 'mk',
};

const LANGUAGE_HINTS = {
  sq: [/\b(po|jo|nuk|eshte|jam|dhe|kur|cfare|pse|shume|mire|faleminderit)\b/i, /[ëç]/i],
  en: [/\b(the|and|what|why|yes|no|because|really|with|this|that)\b/i],
  it: [/\b(il|lo|la|che|perche|grazie|sono|non|con|una|vale|pena|perdonare|sincerita|davvero)\b/i],
  de: [/\b(der|die|das|und|nicht|ich|du|ist|was|warum)\b/i],
  fr: [/\b(le|la|les|et|pas|pourquoi|merci|avec|est|une)\b/i],
  tr: [/\b(bir|ve|degil|neden|evet|hayir|cok|icin|ama|gibi)\b/i],
  sr: [/\b(da|ne|sta|zasto|hvala|nije|jesam|samo|ovo|kako)\b/i],
  mk: [/\b(da|ne|shto|zosto|blagodaram|ova|toa|samo|kako|mnogu)\b/i],
};

let francModulePromise = null;
let hasWarnedFrancUnavailable = false;
let hasWarnedGroqUnavailable = false;

const groq = GROQ_API_KEY
  ? new Groq({
      apiKey: GROQ_API_KEY,
    })
  : null;

const loadFranc = async () => {
  if (!francModulePromise) {
    francModulePromise = import('franc');
  }

  return francModulePromise;
};

const normalizeText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const detectFromHints = (text) => {
  const cleaned = normalizeText(text).toLowerCase();
  if (!cleaned) {
    return null;
  }

  let winner = null;
  let topScore = 0;

  Object.entries(LANGUAGE_HINTS).forEach(([langCode, rules]) => {
    const score = rules.reduce((total, rule) => total + (rule.test(cleaned) ? 1 : 0), 0);
    if (score > topScore) {
      topScore = score;
      winner = langCode;
    }
  });

  return topScore > 0 ? winner : null;
};

const detectLanguageFast = async (text, { fallback = DEFAULT_LANGUAGE } = {}) => {
  const normalizedFallback = normalizeLanguageCode(fallback);
  const cleaned = normalizeText(text);

  if (!cleaned) {
    return normalizedFallback;
  }

  const hintedLanguage = detectFromHints(cleaned);
  if (hintedLanguage) {
    return hintedLanguage;
  }

  if (cleaned.length < 3) {
    return normalizedFallback;
  }

  try {
    const { franc } = await loadFranc();
    const detected = franc(cleaned, { minLength: 3 });
    const normalizedDetected = normalizeLanguageCode(
      FRANC_LANGUAGE_MAP[detected] || detected,
      normalizedFallback
    );

    return SUPPORTED_LANGUAGES[normalizedDetected]
      ? normalizedDetected
      : normalizedFallback;
  } catch (error) {
    if (!hasWarnedFrancUnavailable) {
      hasWarnedFrancUnavailable = true;
      console.warn(`[AI] franc unavailable, using fallback language: ${error.message}`);
    }

    return normalizedFallback;
  }
};

const detectLanguage = async (text, { fallback = DEFAULT_LANGUAGE } = {}) => {
  const fastDetected = await detectLanguageFast(text, { fallback });
  const cleaned = normalizeText(text);

  if (!groq || !cleaned || cleaned.length < 8) {
    return fastDetected;
  }

  try {
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0,
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `What language is this text? Reply with ONLY the ISO 639-1 code: "${cleaned}"`,
        },
      ],
    });

    const detected = normalizeLanguageCode(
      response?.choices?.[0]?.message?.content,
      fastDetected
    );

    return SUPPORTED_LANGUAGES[detected] ? detected : fastDetected;
  } catch (error) {
    if (!hasWarnedGroqUnavailable) {
      hasWarnedGroqUnavailable = true;
      console.warn(`[AI] Groq language detect unavailable, using fast fallback: ${error.message}`);
    }

    return fastDetected;
  }
};

module.exports = {
  detectLanguage,
  detectLanguageFast,
};
