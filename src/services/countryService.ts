import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { getAuthSession, saveAuthSession } from "./authService";

export type SupportedCountry = {
  code: string;
  englishLabel: string;
  flag: string;
  label: string;
};

export const SUPPORTED_COUNTRIES: SupportedCountry[] = [
  { code: "AL", englishLabel: "Albania", flag: "🇦🇱", label: "Shqiperi" },
  { code: "XK", englishLabel: "Kosovo", flag: "🇽🇰", label: "Kosove" },
  { code: "GB", englishLabel: "United Kingdom", flag: "🇬🇧", label: "United Kingdom" },
  { code: "US", englishLabel: "United States", flag: "🇺🇸", label: "United States" },
  { code: "DE", englishLabel: "Germany", flag: "🇩🇪", label: "Germany" },
  { code: "FR", englishLabel: "France", flag: "🇫🇷", label: "France" },
  { code: "IT", englishLabel: "Italy", flag: "🇮🇹", label: "Italy" },
  { code: "ES", englishLabel: "Spain", flag: "🇪🇸", label: "Spain" },
  { code: "TR", englishLabel: "Turkey", flag: "🇹🇷", label: "Turkey" },
  { code: "BR", englishLabel: "Brazil", flag: "🇧🇷", label: "Brazil" },
  { code: "IN", englishLabel: "India", flag: "🇮🇳", label: "India" },
  { code: "JP", englishLabel: "Japan", flag: "🇯🇵", label: "Japan" },
];

const STORAGE_KEY = "five-second-country-selection";
const STORAGE_FILE =
  FileSystem.documentDirectory && `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;
const DEFAULT_COUNTRY_CODE = "AL";
const MAX_RECENT_COUNTRIES = 6;

const COUNTRY_BY_CODE = new Map(SUPPORTED_COUNTRIES.map((country) => [country.code, country]));

const normalizeCountryCode = (value?: string | null) => String(value || "").trim().toUpperCase();

export const resolveCountryCode = (value?: string | null, fallback = DEFAULT_COUNTRY_CODE) => {
  const normalized = normalizeCountryCode(value);
  if (COUNTRY_BY_CODE.has(normalized)) {
    return normalized;
  }

  return normalizeCountryCode(fallback) || DEFAULT_COUNTRY_CODE;
};

export const getCountryOption = (value?: string | null) =>
  COUNTRY_BY_CODE.get(resolveCountryCode(value)) || COUNTRY_BY_CODE.get(DEFAULT_COUNTRY_CODE)!;

const COUNTRY_PREFETCH_MAP: Record<string, string[]> = {
  AL: ["XK", "IT", "DE", "GB"],
  XK: ["AL", "DE", "CH", "GB"],
  GB: ["US", "DE", "FR", "IT"],
  US: ["GB", "DE", "JP", "IN"],
  DE: ["FR", "GB", "IT", "US"],
  FR: ["DE", "GB", "ES", "IT"],
  IT: ["AL", "DE", "FR", "ES"],
  ES: ["FR", "IT", "GB", "BR"],
  TR: ["DE", "GB", "IN", "AL"],
  BR: ["US", "ES", "PT", "GB"],
  IN: ["GB", "US", "JP", "TR"],
  JP: ["US", "IN", "GB", "DE"],
};

const dedupeCountryCodes = (items: (string | null | undefined)[] = []) =>
  items
    .map((item) => normalizeCountryCode(item))
    .filter((item, index, array) => Boolean(item) && COUNTRY_BY_CODE.has(item) && array.indexOf(item) === index);

export const getPrefetchCountries = (value?: string | null, limit = 3, recentCountries: string[] = []) => {
  const active = resolveCountryCode(value);
  const prioritized = COUNTRY_PREFETCH_MAP[active] || [];
  const merged = [...recentCountries, ...prioritized, ...SUPPORTED_COUNTRIES.map((country) => country.code)];
  const unique = dedupeCountryCodes(merged).filter((code) => code !== active);
  return unique.slice(0, Math.max(1, limit));
};

type StoredCountrySelection = {
  country?: string;
  recentCountries?: string[];
  selectedCountry?: string;
  updatedAt?: string;
};

const normalizeStoredSelection = (value: unknown): StoredCountrySelection | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = value as StoredCountrySelection;
  return {
    recentCountries: Array.isArray(parsed.recentCountries)
      ? dedupeCountryCodes(parsed.recentCountries).slice(0, MAX_RECENT_COUNTRIES)
      : [],
    selectedCountry: resolveCountryCode(parsed.selectedCountry || parsed.country || null),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
  };
};

const buildStoredSelection = (selectedCountry: string, recentCountries: string[] = []) => ({
  recentCountries: dedupeCountryCodes([selectedCountry, ...recentCountries]).slice(0, MAX_RECENT_COUNTRIES),
  selectedCountry: resolveCountryCode(selectedCountry),
  updatedAt: new Date().toISOString(),
});

export const mergeRecentCountries = (selectedCountry: string, recentCountries: string[] = []) =>
  buildStoredSelection(selectedCountry, recentCountries).recentCountries || [resolveCountryCode(selectedCountry)];

const readWebSelection = () => {
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeStoredSelection(JSON.parse(raw));
  } catch (error) {
    return null;
  }
};

const writeWebSelection = (payload: StoredCountrySelection) => {
  globalThis.localStorage?.setItem(
    STORAGE_KEY,
    JSON.stringify(payload)
  );
};

const readNativeSelection = async () => {
  if (!STORAGE_FILE) {
    return null;
  }

  try {
    const info = await FileSystem.getInfoAsync(STORAGE_FILE);
    if (!info.exists) {
      return null;
    }

    const raw = await FileSystem.readAsStringAsync(STORAGE_FILE);
    return normalizeStoredSelection(JSON.parse(raw));
  } catch (error) {
    return null;
  }
};

const writeNativeSelection = async (payload: StoredCountrySelection) => {
  if (!STORAGE_FILE) {
    return;
  }

  await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(payload));
};

const readStoredSelectedCountry = async () => {
  if (Platform.OS === "web") {
    return readWebSelection();
  }

  return readNativeSelection();
};

export const detectDeviceCountry = () => {
  const locale =
    Intl.DateTimeFormat?.().resolvedOptions?.().locale ||
    (globalThis.navigator as { language?: string } | undefined)?.language ||
    "";
  const match = String(locale).match(/[-_](AL|XK|GB|US|DE|FR|IT|ES|TR|BR|IN|JP)\b/i);

  return resolveCountryCode(match?.[1], DEFAULT_COUNTRY_CODE);
};

export const getSelectedCountry = async () => {
  const stored = await readStoredSelectedCountry();
  if (stored?.selectedCountry) {
    return stored.selectedCountry;
  }

  const session = await getAuthSession();
  return resolveCountryCode(session?.user?.homeCountry, detectDeviceCountry());
};

export const getRecentCountries = async () => {
  const stored = await readStoredSelectedCountry();
  if (stored?.recentCountries?.length) {
    return stored.recentCountries;
  }

  return [await getSelectedCountry()];
};

export const saveSelectedCountry = async (countryCode: string) => {
  const resolved = resolveCountryCode(countryCode);
  const existing = (await readStoredSelectedCountry()) || {
    recentCountries: [],
  };
  const payload = buildStoredSelection(resolved, existing.recentCountries || []);

  if (Platform.OS === "web") {
    writeWebSelection(payload);
  } else {
    await writeNativeSelection(payload);
  }

  return resolved;
};

export const syncHomeCountry = async (countryCode: string) => {
  const resolved = resolveCountryCode(countryCode);
  const session = await getAuthSession();

  if (session?.user) {
    await saveAuthSession({
      ...session.user,
      homeCountry: resolved,
    });
  }

  await saveSelectedCountry(resolved);
  return resolved;
};
