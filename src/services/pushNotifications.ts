import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { API_CONFIG, getApiUrl } from "../config/api";
import { MVP_USER_ID } from "../theme/mvp";
import { getCurrentUserIdentifier } from "./authService";
import { handleNotificationNavigation } from "./notificationRouting";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const getProjectId = () =>
  process.env.EXPO_PUBLIC_EXPO_PROJECT_ID?.trim() ||
  Constants.easConfig?.projectId ||
  "";

const registerDeviceToken = async (userId: string) => {
  if (!Device.isDevice) {
    return null;
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let status = existingPermissions.status;

  if (status !== "granted") {
    const requestedPermissions = await Notifications.requestPermissionsAsync();
    status = requestedPermissions.status;
  }

  if (status !== "granted") {
    return null;
  }

  const projectId = getProjectId();
  if (!projectId) {
    console.warn("Push notifications skipped: missing Expo project ID");
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  await fetch(getApiUrl(API_CONFIG.endpoints.notifications.registerDevice), {
    body: JSON.stringify({
      appVersion: Constants.expoConfig?.version || "dev",
      deviceName: Device.deviceName || null,
      expoPushToken: token,
      platform: Platform.OS,
      userId,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  return token;
};

export const sendStreakWarning = async (userId: string, currentStreak: number) => {
  await fetch(getApiUrl(API_CONFIG.endpoints.notifications.triggerStreakRisk), {
    body: JSON.stringify({
      currentStreak,
      userId,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
};

export const sendDailyQOD = async (userId: string, qodText: string) => {
  await fetch(getApiUrl(API_CONFIG.endpoints.notifications.triggerDailyQuestionLive), {
    body: JSON.stringify({
      qodText,
      userId,
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
};

export const initializePushNotifications = async (userId?: string) => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      importance: Notifications.AndroidImportance.MAX,
      name: "default",
    });
  }

  const resolvedUserId =
    String(userId || (await getCurrentUserIdentifier()) || MVP_USER_ID).trim() ||
    MVP_USER_ID;

  await registerDeviceToken(resolvedUserId);

  const lastResponse = await Notifications.getLastNotificationResponseAsync();
  if (lastResponse?.notification?.request?.content?.data) {
    handleNotificationNavigation(lastResponse.notification.request.content.data);
  }

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      handleNotificationNavigation(response.notification.request.content.data || {});
    }
  );

  return () => {
    responseSubscription.remove();
  };
};
