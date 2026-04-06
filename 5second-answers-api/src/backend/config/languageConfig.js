const DEFAULT_LANGUAGE = 'en';

const SUPPORTED_LANGUAGES = {
  sq: {
    name: 'Shqip',
    instruction: 'Pergjigju VETEM ne shqip.',
    flag: 'AL',
  },
  en: {
    name: 'English',
    instruction: 'Reply ONLY in English.',
    flag: 'GB',
  },
  it: {
    name: 'Italiano',
    instruction: 'Rispondi SOLO in italiano.',
    flag: 'IT',
  },
  de: {
    name: 'Deutsch',
    instruction: 'Antworte NUR auf Deutsch.',
    flag: 'DE',
  },
  fr: {
    name: 'Francais',
    instruction: 'Reponds UNIQUEMENT en francais.',
    flag: 'FR',
  },
  es: {
    name: 'Espanol',
    instruction: 'Responde SOLO en espanol.',
    flag: 'ES',
  },
  pt: {
    name: 'Portugues',
    instruction: 'Responde SOMENTE em portugues.',
    flag: 'BR',
  },
  tr: {
    name: 'Turkce',
    instruction: 'YALNIZCA Turkce yanitla.',
    flag: 'TR',
  },
  ja: {
    name: 'Japanese',
    instruction: '日本語だけで答えてください。',
    flag: 'JP',
  },
  sr: {
    name: 'Srpski',
    instruction: 'Odgovori SAMO na srpskom.',
    flag: 'RS',
  },
  mk: {
    name: 'Makedonski',
    instruction: 'Odgovori SAMO na makedonski.',
    flag: 'MK',
  },
};

const LANGUAGE_ALIASES = {
  alb: 'sq',
  sqi: 'sq',
  eng: 'en',
  ita: 'it',
  deu: 'de',
  ger: 'de',
  fra: 'fr',
  fre: 'fr',
  spa: 'es',
  esp: 'es',
  por: 'pt',
  tur: 'tr',
  jpn: 'ja',
  srp: 'sr',
  mkd: 'mk',
};

const normalizeLanguageCode = (langCode, fallback = DEFAULT_LANGUAGE) => {
  const normalized = String(langCode || '')
    .trim()
    .toLowerCase();

  if (!normalized) {
    return fallback;
  }

  const mapped = LANGUAGE_ALIASES[normalized] || normalized;
  if (SUPPORTED_LANGUAGES[mapped]) {
    return mapped;
  }

  return fallback;
};

const getLanguageInstruction = (langCode) =>
  SUPPORTED_LANGUAGES[normalizeLanguageCode(langCode)]?.instruction ||
  SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE].instruction;

module.exports = {
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  getLanguageInstruction,
  normalizeLanguageCode,
};
