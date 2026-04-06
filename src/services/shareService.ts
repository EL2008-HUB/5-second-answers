import type { RefObject } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { Share } from "react-native";
import { Platform } from "react-native";
import type ViewShot from "react-native-view-shot";

import { API_CONFIG, getApiUrl } from "../config/api";

type CaptureAndShareParams = {
  hashtags?: string[];
  message: string;
  title?: string;
  viewRef: RefObject<ViewShot | null>;
};

type ExportAnswerVideoParams = {
  answer: string;
  aiComment?: string | null;
  question: string;
  seconds: number;
};

export async function captureAndShare({
  hashtags = [],
  message,
  title,
  viewRef,
}: CaptureAndShareParams) {
  const uri = await viewRef.current?.capture?.();

  const hashtagString = hashtags
    .map((tag) => String(tag || "").trim().replace(/^#+/, ""))
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .join(" ");

  await Share.share({
    message: [message, hashtagString].filter(Boolean).join("\n\n"),
    ...(title ? { title } : {}),
    ...(uri ? { url: uri } : {}),
  });

  return uri || null;
}

export async function exportAnswerVideo({
  answer,
  aiComment,
  question,
  seconds,
}: ExportAnswerVideoParams) {
  const response = await fetch(getApiUrl(API_CONFIG.endpoints.videos.exportShare), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      answer,
      aiComment,
      question,
      seconds,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.video?.url) {
    throw new Error(payload?.message || "Video export failed");
  }

  return payload.video as {
    durationSeconds: number;
    fileName: string;
    mimeType: string;
    url: string;
  };
}

export async function shareExportedVideo({
  message,
  title,
  videoUrl,
}: {
  message: string;
  title?: string;
  videoUrl: string;
}) {
  const absoluteVideoUrl = videoUrl.startsWith("http") ? videoUrl : getApiUrl(videoUrl);

  if (Platform.OS === "web") {
    await Share.share({
      message: [message, absoluteVideoUrl].filter(Boolean).join("\n\n"),
      ...(title ? { title } : {}),
      url: absoluteVideoUrl,
    });

    return absoluteVideoUrl;
  }

  const localTarget =
    FileSystem.cacheDirectory && `${FileSystem.cacheDirectory}share-video-${Date.now()}.mp4`;

  const sharedUrl = localTarget
    ? (await FileSystem.downloadAsync(absoluteVideoUrl, localTarget)).uri
    : absoluteVideoUrl;

  await Share.share({
    message,
    ...(title ? { title } : {}),
    url: sharedUrl,
  });

  return sharedUrl;
}
