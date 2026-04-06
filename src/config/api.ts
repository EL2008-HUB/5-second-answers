import Constants from "expo-constants";
import { NativeModules, Platform } from "react-native";

type ExpoConfigExtra = {
  apiUrl?: string;
  appEnv?: string;
  localIp?: string | null;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isLoopbackHost = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    !normalized ||
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1"
  );
};

const getWebHostUrl = () => {
  const location = (globalThis as { location?: { hostname?: string } }).location;
  const hostname = location?.hostname;

  if (isLoopbackHost(hostname)) {
    return "http://localhost:5000";
  }

  return `http://${hostname}:5000`;
};

const extractHostname = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const match = value.match(/^(?:[a-z]+:\/\/)?([^/:?#]+)/i);
  return match?.[1] ?? null;
};

const getExpoExtra = () => {
  const rawConstants = Constants as typeof Constants & {
    expoConfig?: { extra?: ExpoConfigExtra; hostUri?: string };
    expoGoConfig?: { debuggerHost?: string; hostUri?: string; extra?: ExpoConfigExtra };
    manifest2?: { extra?: ExpoConfigExtra & { expoClient?: { hostUri?: string } } };
    linkingUri?: string;
    experienceUrl?: string;
  };

  return {
    ...(rawConstants.manifest2?.extra || {}),
    ...(rawConstants.expoGoConfig?.extra || {}),
    ...(rawConstants.expoConfig?.extra || {}),
  };
};

const getDevServerHost = () => {
  const rawConstants = Constants as typeof Constants & {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string; hostUri?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
    linkingUri?: string;
    experienceUrl?: string;
  };
  const sourceCode = NativeModules.SourceCode as { scriptURL?: string } | undefined;

  return (
    extractHostname(sourceCode?.scriptURL) ??
    extractHostname(rawConstants.expoConfig?.hostUri) ??
    extractHostname(rawConstants.expoGoConfig?.debuggerHost) ??
    extractHostname(rawConstants.expoGoConfig?.hostUri) ??
    extractHostname(rawConstants.manifest2?.extra?.expoClient?.hostUri) ??
    extractHostname(rawConstants.linkingUri) ??
    extractHostname(rawConstants.experienceUrl)
  );
};

const getConfiguredApiUrl = () => {
  const processUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (processUrl) {
    return trimTrailingSlash(processUrl);
  }

  const extraUrl = getExpoExtra().apiUrl?.trim();
  if (extraUrl) {
    return trimTrailingSlash(extraUrl);
  }

  return null;
};

const getNativeHostUrl = () => {
  const configuredUrl = getConfiguredApiUrl();
  const configuredHost = extractHostname(configuredUrl);
  if (configuredUrl && configuredHost && !isLoopbackHost(configuredHost)) {
    return configuredUrl;
  }

  const expoHost = getDevServerHost();
  if (expoHost && !isLoopbackHost(expoHost)) {
    return `http://${expoHost}:5000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000";
  }

  return "http://localhost:5000";
};

const resolveApiBaseUrl = () => {
  const configuredUrl = getConfiguredApiUrl();
  if (configuredUrl) {
    const configuredHost = extractHostname(configuredUrl);
    if (configuredHost && !isLoopbackHost(configuredHost)) {
      return configuredUrl;
    }

    if (Platform.OS === "web") {
      return configuredUrl;
    }

    return getNativeHostUrl();
  }

  if (Platform.OS === "web") {
    return getWebHostUrl();
  }

  return getNativeHostUrl();
};

export const API_CONFIG = {
  BASE_URL: resolveApiBaseUrl(),
  ENV: process.env.EXPO_PUBLIC_APP_ENV || getExpoExtra().appEnv || "development",
  endpoints: {
    questions: "/api/questions",
    questionDaily: "/api/questions/daily",
    questionById: (id: string) => `/api/questions/${id}`,
    questionCompareCountries: (id: string) => `/api/questions/${id}/compare-countries`,
    questionFeed: "/api/questions/feed",
    questionSurprise: "/api/questions/surprise",
    questionExperts: "/api/questions/experts",
    questionBattle: (id: string) => `/api/questions/${id}/battle`,
    questionBattleVote: (id: string) => `/api/questions/${id}/battle/vote`,
    auth: {
      signup: "/api/auth/signup",
      login: "/api/auth/login",
      me: "/api/auth/me",
    },
    answers: "/api/answers",
    answersByQuestion: (questionId: string) => `/api/answers/${questionId}`,
    answerAiTeam: (answerId: string) => `/api/answers/${answerId}/ai-team`,
    answerInteract: (answerId: string) => `/api/answers/${answerId}/interact`,
    answerConsume: (answerId: string) => `/api/answers/${answerId}/consume`,
    videos: {
      exportShare: "/api/videos/export-share",
      like: (id: string) => `/api/videos/${id}/like`,
      list: "/api/videos",
    },
    upload: "/api/upload",
    social: {
      following: "/api/social/following",
      homeSummary: "/api/social/home-summary",
      follow: "/api/social/follow",
      unfollow: "/api/social/unfollow",
    },
    notifications: {
      list: "/api/notifications",
      registerDevice: "/api/notifications/devices/register",
      hotQuestionStats: "/api/notifications/hot-question/stats",
      readAll: "/api/notifications/read-all",
      readOne: (id: string) => `/api/notifications/${id}/read`,
      triggerDailyQuestionLive: "/api/notifications/jobs/daily-question-live",
      triggerGroupPressure: "/api/notifications/jobs/group-pressure",
      triggerHotQuestion: "/api/notifications/hot-question",
      triggerStreakRisk: "/api/notifications/jobs/streak-risk",
    },
    gamification: {
      badges: (userId: string) => `/api/gamification/badges/${encodeURIComponent(userId)}`,
      challenges: (userId: string) =>
        `/api/gamification/challenges/${encodeURIComponent(userId)}`,
      claimDailyReward: (userId: string) =>
        `/api/gamification/daily-reward/${encodeURIComponent(userId)}`,
      leaderboard: "/api/gamification/leaderboard",
      stats: (userId: string) => `/api/gamification/stats/${encodeURIComponent(userId)}`,
      updateProgress: (userId: string) =>
        `/api/gamification/progress/${encodeURIComponent(userId)}`,
    },
    createLab: {
      workspace: "/api/create-lab",
      saveConcept: "/api/create-lab/save-concept",
      draftHistory: "/api/create-lab/draft-history",
      removeItem: (id: string) => `/api/create-lab/${id}`,
    },
    admin: {
      users: "/api/admin/users",
      badges: "/api/admin/badges",
      leaderboard: "/api/admin/leaderboard",
    },
    ai: {
      validate: "/api/ai/validate",
      health: "/api/ai/health",
      transcribe: "/api/ai/transcribe",
      createLabIdeas: "/api/ai/create-lab-ideas",
      ideaExecutionEngine: "/api/ai/idea-execution-engine",
      generateQuestion: "/api/ai/generate-question",
      analyzeSentiment: "/api/ai/analyze-sentiment",
      generateComment: "/api/ai/generate-comment",
      assistant: "/api/ai/assistant",
      feedback: "/api/ai/feedback",
      featureGuide: "/api/ai/feature-guide",
      monitor: "/api/ai/monitor",
      processEvent: "/api/ai/process-event",
      selfImprovement: "/api/ai/self-improvement",
    },
    story: {
      pack: (category: string) => `/api/story/pack/${category}`,
      complete: "/api/story/complete",
    },
    hashtags: {
      createChallenge: "/api/hashtags/challenges",
      feed: (hashtag: string) => `/api/hashtags/feed/${encodeURIComponent(hashtag)}`,
      tagAnswer: "/api/hashtags/tag-answer",
      trending: "/api/hashtags/trending",
    },
    duets: {
      create: "/api/duets/create",
      compareRandom: "/api/duets/compare-random",
      expose: "/api/duets/expose",
      pending: "/api/duets/pending",
      react: (sessionId: string) => `/api/duets/${sessionId}/react`,
      respond: (sessionId: string) => `/api/duets/respond/${sessionId}`,
      session: (sessionId: string) => `/api/duets/${sessionId}`,
    },
    referrals: {
      summary: "/api/referrals/summary",
      share: "/api/referrals/share",
      redeem: "/api/referrals/redeem",
    },
    rooms: {
      create: "/api/rooms",
      detail: (roomId: string) => `/api/rooms/${roomId}`,
      invite: (inviteCode: string) => `/api/rooms/invite/${encodeURIComponent(inviteCode)}`,
      list: "/api/rooms",
    },
    socialIngestion: {
      importProvider: (provider: string) => `/api/social-ingestion/import/${provider}`,
      webhookProvider: (provider: string) => `/api/social-ingestion/webhook/${provider}`,
    },
    trending: {
      challenges: "/api/trending/challenges",
      content: "/api/trending/content",
      dailyBrain: "/api/trending/news/daily-brain",
      detectNews: "/api/trending/news/detect",
      hotInsights: (questionId: string) => `/api/trending/news/insights/${questionId}`,
      hotQuestionsFromNews: "/api/trending/news/hot-questions",
      launchFeedback: "/api/trending/launch/feedback",
      launchPack: "/api/trending/launch/pack",
      liveNews: "/api/trending/news/live",
      liveNewsRun: "/api/trending/news/live/run",
      liveNewsRunAll: "/api/trending/news/live/run-all",
      topics: "/api/trending/topics",
    },
    health: "/health",
  },
  timeout: 30000,
  retry: {
    max: 3,
    delay: 1000,
  },
};

export const getApiUrl = (endpoint: string): string =>
  `${API_CONFIG.BASE_URL}${endpoint}`;

export const logApiConfig = () => {
  if (API_CONFIG.ENV === "development") {
    console.log("API Configuration:", {
      baseUrl: API_CONFIG.BASE_URL,
      env: API_CONFIG.ENV,
      timeout: API_CONFIG.timeout,
      platform: Platform.OS,
    });
  }
};

if (API_CONFIG.ENV === "development") {
  logApiConfig();
}


