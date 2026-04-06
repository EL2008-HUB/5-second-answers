const SUPPORTED_COUNTRIES = [
  { code: "AL", flag: "🇦🇱", label: "Shqiperi", englishLabel: "Albania", langCode: "sq" },
  { code: "XK", flag: "🇽🇰", label: "Kosove", englishLabel: "Kosovo", langCode: "sq" },
  { code: "GB", flag: "🇬🇧", label: "United Kingdom", englishLabel: "United Kingdom", langCode: "en" },
  { code: "US", flag: "🇺🇸", label: "United States", englishLabel: "United States", langCode: "en" },
  { code: "DE", flag: "🇩🇪", label: "Germany", englishLabel: "Germany", langCode: "de" },
  { code: "FR", flag: "🇫🇷", label: "France", englishLabel: "France", langCode: "fr" },
  { code: "IT", flag: "🇮🇹", label: "Italy", englishLabel: "Italy", langCode: "it" },
  { code: "ES", flag: "🇪🇸", label: "Spain", englishLabel: "Spain", langCode: "es" },
  { code: "TR", flag: "🇹🇷", label: "Turkey", englishLabel: "Turkey", langCode: "tr" },
  { code: "BR", flag: "🇧🇷", label: "Brazil", englishLabel: "Brazil", langCode: "pt" },
  { code: "IN", flag: "🇮🇳", label: "India", englishLabel: "India", langCode: "en" },
  { code: "JP", flag: "🇯🇵", label: "Japan", englishLabel: "Japan", langCode: "ja" },
];

const DEFAULT_COUNTRY_CODE = "AL";
const COUNTRY_BY_CODE = new Map(SUPPORTED_COUNTRIES.map((country) => [country.code, country]));

const normalizeCountryCode = (value) => String(value || "").trim().toUpperCase();

const resolveCountryCode = (value, fallback = DEFAULT_COUNTRY_CODE) => {
  const normalized = normalizeCountryCode(value);

  if (COUNTRY_BY_CODE.has(normalized)) {
    return normalized;
  }

  return normalizeCountryCode(fallback) || DEFAULT_COUNTRY_CODE;
};

const getCountryConfig = (value) => {
  const code = resolveCountryCode(value);
  return COUNTRY_BY_CODE.get(code) || COUNTRY_BY_CODE.get(DEFAULT_COUNTRY_CODE);
};

const resolveCountryLanguage = (value, fallback = "en") =>
  getCountryConfig(value)?.langCode || fallback;

module.exports = {
  DEFAULT_COUNTRY_CODE,
  SUPPORTED_COUNTRIES,
  getCountryConfig,
  normalizeCountryCode,
  resolveCountryCode,
  resolveCountryLanguage,
};
