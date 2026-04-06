import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export type OnboardingInterest = {
  id: "ai" | "funny" | "deep" | "relationships" | "savage" | "growth";
  label: string;
  emoji: string;
  category: string;
  description: string;
};

export type OnboardingState = {
  interests: string[];
  preferredNewsCategories: string[];
  primaryInterest: string | null;
  firstAnswerCompleted: boolean;
  updatedAt: string | null;
};

const STORAGE_KEY = "five-second-onboarding-state";
const STORAGE_FILE =
  FileSystem.documentDirectory && `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;

const DEFAULT_STATE: OnboardingState = {
  interests: [],
  preferredNewsCategories: [],
  primaryInterest: null,
  firstAnswerCompleted: false,
  updatedAt: null,
};

const DEFAULT_NEWS_CATEGORY_BY_INTEREST: Record<OnboardingInterest["id"], string[]> = {
  ai: ["technology", "world"],
  funny: ["entertainment", "lifestyle"],
  deep: ["drama", "world"],
  relationships: ["drama", "lifestyle"],
  savage: ["politics", "crime"],
  growth: ["technology", "education"],
};

export const ONBOARDING_INTERESTS: OnboardingInterest[] = [
  {
    id: "ai",
    label: "AI",
    emoji: "AI",
    category: "mindset",
    description: "Pyetje per teknologji, mendim dhe instinkt.",
  },
  {
    id: "funny",
    label: "Funny",
    emoji: "LOL",
    category: "funny",
    description: "Pergjigje te shpejta qe krijojne reaction.",
  },
  {
    id: "deep",
    label: "Deep",
    emoji: "DEEP",
    category: "emotional",
    description: "Pyetje me peshe, ndjenje dhe vertetesi.",
  },
  {
    id: "relationships",
    label: "Love",
    emoji: "LOVE",
    category: "relationships",
    description: "Dashuri, red flags dhe tension social.",
  },
  {
    id: "savage",
    label: "Savage",
    emoji: "FIRE",
    category: "savage",
    description: "Pergjigje te forta, opinion dhe edge.",
  },
  {
    id: "growth",
    label: "Growth",
    emoji: "UP",
    category: "self-growth",
    description: "Mindset, discipline dhe self-upgrade.",
  },
];

const mergeWithDefaults = (value?: Partial<OnboardingState> | null): OnboardingState => ({
  ...DEFAULT_STATE,
  ...value,
  interests: Array.isArray(value?.interests) ? value?.interests || [] : [],
  preferredNewsCategories: Array.isArray(value?.preferredNewsCategories)
    ? value?.preferredNewsCategories || []
    : [],
  primaryInterest: value?.primaryInterest || null,
  firstAnswerCompleted: Boolean(value?.firstAnswerCompleted),
  updatedAt: value?.updatedAt || null,
});

const readFromWebStorage = (): OnboardingState => {
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_STATE;
  }

  try {
    return mergeWithDefaults(JSON.parse(raw));
  } catch (error) {
    return DEFAULT_STATE;
  }
};

const writeToWebStorage = (value: OnboardingState) => {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
};

const readFromNativeStorage = async (): Promise<OnboardingState> => {
  if (!STORAGE_FILE) {
    return DEFAULT_STATE;
  }

  try {
    const info = await FileSystem.getInfoAsync(STORAGE_FILE);
    if (!info.exists) {
      return DEFAULT_STATE;
    }

    const raw = await FileSystem.readAsStringAsync(STORAGE_FILE);
    return mergeWithDefaults(JSON.parse(raw));
  } catch (error) {
    return DEFAULT_STATE;
  }
};

const writeToNativeStorage = async (value: OnboardingState) => {
  if (!STORAGE_FILE) {
    return;
  }

  await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(value));
};

export const getOnboardingState = async (): Promise<OnboardingState> => {
  if (Platform.OS === "web") {
    return readFromWebStorage();
  }

  return readFromNativeStorage();
};

export const saveOnboardingState = async (
  updater:
    | Partial<OnboardingState>
    | ((current: OnboardingState) => Partial<OnboardingState>)
): Promise<OnboardingState> => {
  const current = await getOnboardingState();
  const nextPatch = typeof updater === "function" ? updater(current) : updater;
  const nextValue = mergeWithDefaults({
    ...current,
    ...nextPatch,
    updatedAt: new Date().toISOString(),
  });

  if (Platform.OS === "web") {
    writeToWebStorage(nextValue);
  } else {
    await writeToNativeStorage(nextValue);
  }

  return nextValue;
};

export const saveOnboardingInterests = async (interests: string[]) =>
  saveOnboardingState({
    interests,
    preferredNewsCategories: interests.flatMap((interestId) => {
      const key = interestId as OnboardingInterest["id"];
      return DEFAULT_NEWS_CATEGORY_BY_INTEREST[key] || [];
    }).filter((value, index, array) => array.indexOf(value) === index),
    primaryInterest: interests[0] || null,
    firstAnswerCompleted: false,
  });

export const completeFirstAnswerOnboarding = async () =>
  saveOnboardingState({
    firstAnswerCompleted: true,
  });

export const getOnboardingInterestMeta = (interestId?: string | null) =>
  ONBOARDING_INTERESTS.find((item) => item.id === interestId) || null;

export const getPreferredNewsCategories = async (): Promise<string[]> => {
  const state = await getOnboardingState();
  return Array.isArray(state.preferredNewsCategories) ? state.preferredNewsCategories : [];
};

export const savePreferredNewsCategories = async (categories: string[]) =>
  saveOnboardingState({
    preferredNewsCategories: categories
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((value, index, array) => array.indexOf(value) === index),
  });

export const resetOnboardingState = async (): Promise<OnboardingState> => {
  const nextValue = mergeWithDefaults({
    ...DEFAULT_STATE,
    updatedAt: new Date().toISOString(),
  });

  if (Platform.OS === "web") {
    writeToWebStorage(nextValue);
  } else {
    await writeToNativeStorage(nextValue);
  }

  return nextValue;
};
