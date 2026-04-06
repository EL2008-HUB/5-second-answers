import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { setMvpUserId } from "../theme/mvp";

export type AuthUser = {
  id: string;
  username: string;
  createdAt?: string | null;
  homeCountry?: string | null;
};

export type AuthSession = {
  user: AuthUser;
  savedAt: string;
};

const STORAGE_KEY = "five-second-auth-session";
const STORAGE_FILE =
  FileSystem.documentDirectory && `${FileSystem.documentDirectory}${STORAGE_KEY}.json`;

const normalizeSession = (value?: Partial<AuthSession> | null): AuthSession | null => {
  const id = String(value?.user?.id || "").trim();
  const username = String(value?.user?.username || "").trim();

  if (!id || !username) {
    return null;
  }

  return {
    user: {
      id,
      username,
      createdAt: value?.user?.createdAt || null,
      homeCountry: value?.user?.homeCountry || null,
    },
    savedAt: value?.savedAt || new Date().toISOString(),
  };
};

const applySession = (session: AuthSession | null) => {
  setMvpUserId(session?.user?.username || "demo_user");
  return session;
};

const readFromWebStorage = (): AuthSession | null => {
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!raw) {
    return applySession(null);
  }

  try {
    return applySession(normalizeSession(JSON.parse(raw)));
  } catch (error) {
    return applySession(null);
  }
};

const writeToWebStorage = (value: AuthSession | null) => {
  if (!value) {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
    return;
  }

  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
};

const readFromNativeStorage = async (): Promise<AuthSession | null> => {
  if (!STORAGE_FILE) {
    return applySession(null);
  }

  try {
    const info = await FileSystem.getInfoAsync(STORAGE_FILE);
    if (!info.exists) {
      return applySession(null);
    }

    const raw = await FileSystem.readAsStringAsync(STORAGE_FILE);
    return applySession(normalizeSession(JSON.parse(raw)));
  } catch (error) {
    return applySession(null);
  }
};

const writeToNativeStorage = async (value: AuthSession | null) => {
  if (!STORAGE_FILE) {
    return;
  }

  if (!value) {
    const info = await FileSystem.getInfoAsync(STORAGE_FILE);
    if (info.exists) {
      await FileSystem.deleteAsync(STORAGE_FILE, { idempotent: true });
    }
    return;
  }

  await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(value));
};

export const getAuthSession = async (): Promise<AuthSession | null> => {
  if (Platform.OS === "web") {
    return readFromWebStorage();
  }

  return readFromNativeStorage();
};

export const restoreAuthSession = async (): Promise<AuthSession | null> => getAuthSession();

export const saveAuthSession = async (user: AuthUser): Promise<AuthSession> => {
  const nextValue = normalizeSession({
    user,
    savedAt: new Date().toISOString(),
  });

  if (!nextValue) {
    throw new Error("Invalid auth user");
  }

  if (Platform.OS === "web") {
    writeToWebStorage(nextValue);
  } else {
    await writeToNativeStorage(nextValue);
  }

  applySession(nextValue);
  return nextValue;
};

export const clearAuthSession = async () => {
  if (Platform.OS === "web") {
    writeToWebStorage(null);
  } else {
    await writeToNativeStorage(null);
  }

  applySession(null);
};

export const getCurrentUserIdentifier = async () => {
  const session = await getAuthSession();
  return session?.user?.username || "demo_user";
};
