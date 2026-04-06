import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { API_CONFIG, getApiUrl } from "../config/api";
import {
  getPrefetchCountries,
  getCountryOption,
  getRecentCountries,
  getSelectedCountry,
  mergeRecentCountries,
  resolveCountryCode,
  saveSelectedCountry,
  SUPPORTED_COUNTRIES,
} from "../services/countryService";
import {
  getOnboardingState,
  getPreferredNewsCategories,
  savePreferredNewsCategories,
} from "../services/onboardingService";
import { getCurrentUserIdentifier } from "../services/authService";
import {
  colors,
  formatCompactNumber,
  formatCountdown,
  readJsonSafely,
} from "../theme/mvp";

type DailyQuestion = {
  id: string;
  text: string;
  category: string;
  country?: string;
  answerCount: number;
  expiresAt?: string | null;
  hotNewsCategoryColor?: string | null;
  hotNewsCategoryId?: string | null;
  hotNewsCategoryLabel?: string | null;
  hotLabel?: string | null;
  hotNewsTitle?: string | null;
  isHotQuestion?: boolean;
  isFollowupQuestion?: boolean;
  promptLabel?: string | null;
  promptNote?: string | null;
  timeRemainingSeconds?: number;
};

type TrendingNewsItem = {
  title: string;
  source?: string | null;
  publishedAt?: string | null;
  viralScore?: number;
};

type TrendingCategoryBucket = {
  categoryId: string;
  color: string;
  label: string;
  total: number;
  items: TrendingNewsItem[];
};

type DailyPayload = {
  question: DailyQuestion;
  streak: {
    current: number;
    lastAnswerDate?: string | null;
  };
  hasAnsweredToday: boolean;
  hasAnsweredCurrentQuestion?: boolean;
};

type HotInsights = {
  topReactions?: string[];
  totalResponses?: number;
};

type CountryComparison = {
  country: string;
  leadingReaction: "PO" | "JO" | "MIXED";
  noPercent: number;
  totalAnswers: number;
  yesPercent: number;
};

type LaunchPackResponse = {
  dailyQuestion?: DailyQuestion | null;
  hotQuestion?: DailyQuestion | null;
};

type DailyBrainCard = {
  id: string;
  title: string;
  summary: string;
  implication: string;
  action: string;
  risk: "low" | "medium" | "high";
  whyNow: string;
  categoryLabel?: string;
  source?: string;
};

type DailyBrainPayload = {
  knowToday?: DailyBrainCard[];
  risingTrend?: {
    categoryLabel?: string;
    title?: string;
    momentum?: string | number;
  } | null;
  decision?: {
    title?: string;
    action?: string;
    risk?: string;
    implication?: string;
  } | null;
};

type WeeklyLeaderboardEntry = {
  id: string;
  rank: number;
  username: string;
  points: number;
  trend: "up" | "down" | "same";
  isCurrentUser?: boolean;
  stats?: {
    answers?: number;
    activeDays?: number;
    streak?: number;
  };
};

type HomeSnapshot = {
  allNewsBuckets: TrendingCategoryBucket[];
  countryComparisons: CountryComparison[];
  daily: DailyPayload | null;
  dailyBrain: DailyBrainPayload | null;
  feed: FeedAnswer[];
  feedScope: "following" | "global";
  hotInsights: HotInsights | null;
  launchQod: DailyQuestion | null;
  newsBuckets: TrendingCategoryBucket[];
  preferredNewsCategories: string[];
  remainingSeconds: number;
};

type CachedHomeSnapshot = {
  snapshot: HomeSnapshot;
  storedAt: number;
};

type FeedAnswer = {
  id: string;
  type: "video" | "audio" | "text";
  text?: string | null;
  contentUrl?: string | null;
  timeMode?: "5s" | "10s";
  responseTime?: number | null;
  penaltyApplied?: boolean;
  question?: {
    id: string;
    text: string;
    category: string;
    country?: string;
    answerCount?: number;
  };
  user?: {
    id?: string;
    username?: string;
    followers?: number;
  };
  interactions?: {
    likes?: number;
    views?: number;
    shares?: number;
    saves?: number;
  };
  aiComment?: string | null;
};

const getSpeedBadge = (item: FeedAnswer) =>
  item.timeMode === "10s" || item.penaltyApplied ? "🐢" : "⚡";

const HOME_CACHE_TTL_MS = 3 * 60 * 1000;

const readOptionalJson = async <T,>(response: Response, label: string) => {
  try {
    return (await readJsonSafely(response)) as T | null;
  } catch (error) {
    console.error(`${label} parse error:`, error);
    return null;
  }
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const hotPulse = useRef(new Animated.Value(0)).current;
  const autoOpenedQuestionRef = useRef("");
  const latestLoadRequestRef = useRef(0);
  const homeRetryCountRef = useRef(0);
  const homeCacheRef = useRef(new Map<string, CachedHomeSnapshot>());
  const pendingHomePrefetchRef = useRef(new Set<string>());
  const lastLoadMetaRef = useRef({
    at: 0,
    country: "",
    userId: "",
  });
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isHomeContextReady, setIsHomeContextReady] = useState(false);
  const [allNewsBuckets, setAllNewsBuckets] = useState<TrendingCategoryBucket[]>([]);
  const [daily, setDaily] = useState<DailyPayload | null>(null);
  const [dailyBrain, setDailyBrain] = useState<DailyBrainPayload | null>(null);
  const [feed, setFeed] = useState<FeedAnswer[]>([]);
  const [feedScope, setFeedScope] = useState<"following" | "global">("following");
  const [hotInsights, setHotInsights] = useState<HotInsights | null>(null);
  const [launchQod, setLaunchQod] = useState<DailyQuestion | null>(null);
  const [newsBuckets, setNewsBuckets] = useState<TrendingCategoryBucket[]>([]);
  const [preferredNewsCategories, setPreferredNewsCategories] = useState<string[]>([]);
  const [quickAnswerFeedback, setQuickAnswerFeedback] = useState<string | null>(null);
  const [quickAnswerSubmitting, setQuickAnswerSubmitting] = useState<"PO" | "JO" | null>(
    null
  );
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [countryComparisons, setCountryComparisons] = useState<CountryComparison[]>([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState("AL");
  const [currentUserId, setCurrentUserId] = useState("demo_user");
  const [recentCountries, setRecentCountries] = useState<string[]>(["AL"]);
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<WeeklyLeaderboardEntry[]>([]);
  const selectedCountryOption = useMemo(
    () => getCountryOption(selectedCountryCode),
    [selectedCountryCode]
  );

  const buildUrl = (endpoint: string, params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && `${value}`.length) {
        search.set(key, String(value));
      }
    });

    const query = search.toString();
    return `${getApiUrl(endpoint)}${query ? `?${query}` : ""}`;
  };

  const mergePostedAnswer = (items: FeedAnswer[], postedAnswer?: FeedAnswer | null) => {
    if (!postedAnswer?.id) {
      return items;
    }

    const withoutPosted = items.filter((item) => item.id !== postedAnswer.id);
    return [postedAnswer, ...withoutPosted];
  };

  const getFreshHomeSnapshot = (cacheKey: string) => {
    const entry = homeCacheRef.current.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.storedAt > HOME_CACHE_TTL_MS) {
      homeCacheRef.current.delete(cacheKey);
      return null;
    }

    return entry.snapshot;
  };

  const storeHomeSnapshot = (cacheKey: string, snapshot: HomeSnapshot) => {
    homeCacheRef.current.set(cacheKey, {
      snapshot,
      storedAt: Date.now(),
    });
  };

  const applyHomeSnapshot = (snapshot: HomeSnapshot) => {
    setAllNewsBuckets(snapshot.allNewsBuckets);
    setCountryComparisons(snapshot.countryComparisons);
    setDaily(snapshot.daily);
    setDailyBrain(snapshot.dailyBrain);
    setFeed(snapshot.feed);
    setFeedScope(snapshot.feedScope);
    setHotInsights(snapshot.hotInsights);
    setLaunchQod(snapshot.launchQod);
    setNewsBuckets(snapshot.newsBuckets);
    setPreferredNewsCategories(snapshot.preferredNewsCategories);
    setRemainingSeconds(snapshot.remainingSeconds);
  };

  const buildSnapshot = (payload: HomeSnapshot) => payload;

  const prefetchHomeCountry = async (countryCode: string, userId: string) => {
    const activeCountry = resolveCountryCode(countryCode);
    const activeUserId = String(userId || "").trim() || "demo_user";
    const cacheKey = `${activeCountry}:${activeUserId}`;

    if (getFreshHomeSnapshot(cacheKey) || pendingHomePrefetchRef.current.has(cacheKey)) {
      return;
    }

    pendingHomePrefetchRef.current.add(cacheKey);

    try {
      const [preferredCategories, onboardingState] = await Promise.all([
        getPreferredNewsCategories(),
        getOnboardingState(),
      ]);
      const interestList = Array.isArray(onboardingState?.interests)
        ? onboardingState.interests
        : [];
      const preferredCategoryList = Array.isArray(onboardingState?.preferredNewsCategories)
        ? onboardingState.preferredNewsCategories
        : preferredCategories;

      const dailyResponse = await fetch(
        buildUrl(API_CONFIG.endpoints.questionDaily, {
          country: activeCountry,
          userId: activeUserId,
        })
      );
      const dailyData = await readOptionalJson<DailyPayload>(dailyResponse, "Home prefetch daily");
      if (!dailyResponse.ok || !dailyData?.question?.id) {
        return;
      }

      const settledResponses = await Promise.allSettled([
        fetch(
          buildUrl(API_CONFIG.endpoints.questionFeed, {
            country: activeCountry,
            userId: activeUserId,
            scope: "following",
            sort: "newest",
          })
        ),
        fetch(
          buildUrl(API_CONFIG.endpoints.trending.liveNews, {
            country: activeCountry,
            limitPerSource: 2,
            totalLimit: 8,
            limitPerCategory: 2,
          })
        ),
        fetch(buildUrl(API_CONFIG.endpoints.trending.launchPack, { country: activeCountry })),
        fetch(
          buildUrl(API_CONFIG.endpoints.trending.dailyBrain, {
            country: activeCountry,
            userId: activeUserId,
            interests: interestList.join(","),
            preferredCategories: preferredCategoryList.join(","),
          })
        ),
      ]);

      const followingResponse =
        settledResponses[0]?.status === "fulfilled" ? settledResponses[0].value : null;
      const liveNewsResponse =
        settledResponses[1]?.status === "fulfilled" ? settledResponses[1].value : null;
      const launchPackResponse =
        settledResponses[2]?.status === "fulfilled" ? settledResponses[2].value : null;
      const dailyBrainResponse =
        settledResponses[3]?.status === "fulfilled" ? settledResponses[3].value : null;

      const followingData = followingResponse
        ? await readOptionalJson<FeedAnswer[]>(followingResponse, "Home prefetch feed")
        : null;
      const liveNewsData = liveNewsResponse
        ? await readOptionalJson<{ categorized?: TrendingCategoryBucket[] }>(
            liveNewsResponse,
            "Home prefetch live news"
          )
        : null;
      const launchPackData = launchPackResponse
        ? await readOptionalJson<LaunchPackResponse>(launchPackResponse, "Home prefetch launch pack")
        : null;
      const dailyBrainData = dailyBrainResponse
        ? await readOptionalJson<DailyBrainPayload>(dailyBrainResponse, "Home prefetch daily brain")
        : null;
      const categorizedBuckets = Array.isArray(liveNewsData?.categorized)
        ? liveNewsData?.categorized || []
        : [];
      const filteredBuckets = preferredCategories.length
        ? categorizedBuckets.filter((bucket) => preferredCategories.includes(bucket.categoryId))
        : categorizedBuckets;

      storeHomeSnapshot(
        cacheKey,
        buildSnapshot({
          allNewsBuckets: categorizedBuckets,
          countryComparisons: [],
          daily: dailyData,
          dailyBrain: dailyBrainResponse?.ok ? dailyBrainData : null,
          feed: Array.isArray(followingData) ? followingData.slice(0, 10) : [],
          feedScope: "following",
          hotInsights: null,
          launchQod:
            launchPackData?.dailyQuestion?.id && launchPackData.dailyQuestion.id !== dailyData.question.id
              ? launchPackData.dailyQuestion
              : null,
          newsBuckets: filteredBuckets.length ? filteredBuckets : categorizedBuckets,
          preferredNewsCategories: preferredCategories,
          remainingSeconds: dailyData.question.timeRemainingSeconds || 0,
        })
      );
    } catch (error) {
      console.error("Home prefetch error:", error);
    } finally {
      pendingHomePrefetchRef.current.delete(cacheKey);
    }
  };

  const loadHome = async (
    countryCode: string,
    userId: string,
    options: { force?: boolean } = {}
  ) => {
    const requestId = Date.now() + Math.random();
    const activeCountry = resolveCountryCode(countryCode);
    const activeUserId = String(userId || "").trim() || "demo_user";
    const cacheKey = `${activeCountry}:${activeUserId}`;
    const cachedSnapshot = getFreshHomeSnapshot(cacheKey);
    const now = Date.now();
    const shouldSkipDuplicate =
      !options.force &&
      lastLoadMetaRef.current.country === activeCountry &&
      lastLoadMetaRef.current.userId === activeUserId &&
      now - lastLoadMetaRef.current.at < 900;

    if (shouldSkipDuplicate) {
      return;
    }

    latestLoadRequestRef.current = requestId;
    lastLoadMetaRef.current = {
      at: now,
      country: activeCountry,
      userId: activeUserId,
    };

    try {
      if (cachedSnapshot && !options.force) {
        applyHomeSnapshot(cachedSnapshot);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const [preferredCategories, onboardingState] = await Promise.all([
        getPreferredNewsCategories(),
        getOnboardingState(),
      ]);
      const interestList = Array.isArray(onboardingState?.interests)
        ? onboardingState.interests
        : [];
      const preferredCategoryList = Array.isArray(onboardingState?.preferredNewsCategories)
        ? onboardingState.preferredNewsCategories
        : preferredCategories;

      if (latestLoadRequestRef.current !== requestId) {
        return;
      }

      setSelectedCountryCode(activeCountry);

      const dailyResponse = await fetch(
        buildUrl(API_CONFIG.endpoints.questionDaily, {
          country: activeCountry,
          userId: activeUserId,
        })
      );
      const dailyData = await readOptionalJson<DailyPayload>(dailyResponse, "Home daily");

      if (!dailyResponse.ok || !dailyData?.question?.id) {
        throw new Error("Failed to load daily question");
      }

      if (latestLoadRequestRef.current !== requestId) {
        return;
      }

      setDaily(dailyData);
      setRemainingSeconds(dailyData.question.timeRemainingSeconds || 0);
      if (!cachedSnapshot) {
        setLoading(false);
      }

      const settledResponses = await Promise.allSettled([
        fetch(
          buildUrl(API_CONFIG.endpoints.questionFeed, {
            country: activeCountry,
            userId: activeUserId,
            scope: "following",
            sort: "newest",
          })
        ),
        fetch(
          buildUrl(API_CONFIG.endpoints.trending.liveNews, {
            country: activeCountry,
            limitPerSource: 2,
            totalLimit: 8,
            limitPerCategory: 2,
          })
        ),
        fetch(buildUrl(API_CONFIG.endpoints.trending.launchPack, { country: activeCountry })),
        fetch(
          buildUrl(API_CONFIG.endpoints.trending.dailyBrain, {
            country: activeCountry,
            userId: activeUserId,
            interests: interestList.join(","),
            preferredCategories: preferredCategoryList.join(","),
          })
        ),
      ]);

      const followingResponse =
        settledResponses[0]?.status === "fulfilled" ? settledResponses[0].value : null;
      const liveNewsResponse =
        settledResponses[1]?.status === "fulfilled" ? settledResponses[1].value : null;
      const launchPackResponse =
        settledResponses[2]?.status === "fulfilled" ? settledResponses[2].value : null;
      const dailyBrainResponse =
        settledResponses[3]?.status === "fulfilled" ? settledResponses[3].value : null;

      const followingData = followingResponse
        ? await readOptionalJson<FeedAnswer[]>(followingResponse, "Home feed")
        : null;
      const liveNewsData = liveNewsResponse
        ? await readOptionalJson<{ categorized?: TrendingCategoryBucket[] }>(
            liveNewsResponse,
            "Home live news"
          )
        : null;
      const launchPackData = launchPackResponse
        ? await readOptionalJson<LaunchPackResponse>(launchPackResponse, "Home launch pack")
        : null;
      const dailyBrainData = dailyBrainResponse
        ? await readOptionalJson<DailyBrainPayload>(dailyBrainResponse, "Home daily brain")
        : null;

      if (latestLoadRequestRef.current !== requestId) {
        return;
      }

      let resolvedFeed = Array.isArray(followingData) ? followingData : [];
      let resolvedScope: "following" | "global" = "following";
      let resolvedHotInsights: HotInsights | null = cachedSnapshot?.hotInsights || null;
      let resolvedCountryComparisons: CountryComparison[] = cachedSnapshot?.countryComparisons || [];

      if (latestLoadRequestRef.current !== requestId) {
        return;
      }

      setDaily(dailyData);
      setDailyBrain(dailyBrainResponse?.ok ? dailyBrainData : null);
      setCountryComparisons(resolvedCountryComparisons);
      setHotInsights(resolvedHotInsights);
      setLaunchQod(
        launchPackData?.dailyQuestion?.id && launchPackData.dailyQuestion.id !== dailyData.question.id
          ? launchPackData.dailyQuestion
          : null
      );
      const categorizedBuckets = Array.isArray(liveNewsData?.categorized)
        ? liveNewsData?.categorized || []
        : [];
      const filteredBuckets = preferredCategories.length
        ? categorizedBuckets.filter((bucket) => preferredCategories.includes(bucket.categoryId))
        : categorizedBuckets;
      const coreSnapshot = buildSnapshot({
        allNewsBuckets: categorizedBuckets,
        countryComparisons: resolvedCountryComparisons,
        daily: dailyData,
        dailyBrain: dailyBrainResponse?.ok ? dailyBrainData : null,
        feed: mergePostedAnswer(
          resolvedFeed.slice(0, 10),
          (route.params?.postedFeedItem as FeedAnswer | undefined) || null
        ),
        feedScope: resolvedScope,
        hotInsights: resolvedHotInsights,
        launchQod:
          launchPackData?.dailyQuestion?.id && launchPackData.dailyQuestion.id !== dailyData.question.id
            ? launchPackData.dailyQuestion
            : null,
        newsBuckets: filteredBuckets.length ? filteredBuckets : categorizedBuckets,
        preferredNewsCategories: preferredCategories,
        remainingSeconds: dailyData.question.timeRemainingSeconds || 0,
      });

      applyHomeSnapshot(coreSnapshot);
      storeHomeSnapshot(cacheKey, coreSnapshot);
      homeRetryCountRef.current = 0;
      setLoading(false);
      setRefreshing(false);

      void (async () => {
        let nextFeed = resolvedFeed;
        let nextScope: "following" | "global" = resolvedScope;
        let nextHotInsights = resolvedHotInsights;
        let nextCountryComparisons = resolvedCountryComparisons;

        if (!nextFeed.length) {
          try {
            const globalResponse = await fetch(
              buildUrl(API_CONFIG.endpoints.questionFeed, {
                country: activeCountry,
                userId: activeUserId,
                scope: "global",
                sort: "newest",
              })
            );
            const globalData = (await readJsonSafely(globalResponse)) as FeedAnswer[] | null;
            if (globalResponse.ok && Array.isArray(globalData)) {
              nextFeed = globalData;
              nextScope = "global";
            }
          } catch (error) {
            console.error("Global feed fallback error:", error);
          }
        }

        if (dailyData.question.isHotQuestion && dailyData.question.id) {
          try {
            const insightsResponse = await fetch(
              getApiUrl(API_CONFIG.endpoints.trending.hotInsights(dailyData.question.id))
            );
            const insightsData = (await readJsonSafely(insightsResponse)) as HotInsights | null;
            if (insightsResponse.ok) {
              nextHotInsights = insightsData;
            }
          } catch (error) {
            console.error("Hot insights load error:", error);
          }
        }

        if (dailyData.question.id) {
          try {
            const compareResponse = await fetch(
              buildUrl(API_CONFIG.endpoints.questionCompareCountries(dailyData.question.id), { limit: 6 })
            );
            const compareData = (await readJsonSafely(compareResponse)) as
              | { comparisons?: CountryComparison[] }
              | null;
            if (compareResponse.ok && Array.isArray(compareData?.comparisons)) {
              nextCountryComparisons = compareData.comparisons;
            }
          } catch (error) {
            console.error("Country compare load error:", error);
          }
        }

        if (latestLoadRequestRef.current !== requestId) {
          return;
        }

        const enhancedSnapshot = buildSnapshot({
          ...coreSnapshot,
          countryComparisons: nextCountryComparisons,
          feed: mergePostedAnswer(
            nextFeed.slice(0, 10),
            (route.params?.postedFeedItem as FeedAnswer | undefined) || null
          ),
          feedScope: nextScope,
          hotInsights: nextHotInsights,
        });
        applyHomeSnapshot(enhancedSnapshot);
        storeHomeSnapshot(cacheKey, enhancedSnapshot);
      })();
    } catch (error) {
      if (latestLoadRequestRef.current !== requestId) {
        return;
      }

      console.error("Home load error:", error);
      homeRetryCountRef.current += 1;
      if (cachedSnapshot) {
        applyHomeSnapshot(cachedSnapshot);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setAllNewsBuckets([]);
      setCountryComparisons([]);
      setDaily(null);
      setDailyBrain(null);
      setHotInsights(null);
      setLaunchQod(null);
      setPreferredNewsCategories([]);
      setNewsBuckets([]);
      setFeed(
        mergePostedAnswer([], (route.params?.postedFeedItem as FeedAnswer | undefined) || null)
      );
    } finally {
      if (latestLoadRequestRef.current === requestId) {
        if (!getFreshHomeSnapshot(cacheKey)) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const hydrateHomeContext = async () => {
      try {
        const [storedCountry, userId, storedRecentCountries] = await Promise.all([
          getSelectedCountry(),
          getCurrentUserIdentifier(),
          getRecentCountries(),
        ]);

        if (!mounted) {
          return;
        }

        setSelectedCountryCode(resolveCountryCode(storedCountry));
        setCurrentUserId(String(userId || "").trim() || "demo_user");
        setRecentCountries(storedRecentCountries);
      } finally {
        if (mounted) {
          setIsHomeContextReady(true);
        }
      }
    };

    void hydrateHomeContext();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHomeContextReady) {
      return;
    }

    void loadHome(selectedCountryCode, currentUserId);
  }, [currentUserId, isHomeContextReady, selectedCountryCode]);

  useEffect(() => {
    if (!isHomeContextReady || loading || daily?.question?.id || homeRetryCountRef.current >= 2) {
      return;
    }

    const timer = setTimeout(() => {
      void loadHome(selectedCountryCode, currentUserId, { force: true });
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentUserId, daily?.question?.id, isHomeContextReady, loading, selectedCountryCode]);

  useEffect(() => {
    if (!isHomeContextReady || !currentUserId) {
      return;
    }

    const targets = getPrefetchCountries(
      selectedCountryCode,
      countryPickerOpen ? 4 : 2,
      recentCountries
    );
    targets.forEach((countryCode) => {
      void prefetchHomeCountry(countryCode, currentUserId);
    });
  }, [countryPickerOpen, currentUserId, isHomeContextReady, recentCountries, selectedCountryCode]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (!isHomeContextReady) {
        return;
      }

      void loadHome(selectedCountryCode, currentUserId);
      void loadWeeklyLeaderboard(currentUserId);
    });

    return unsubscribe;
  }, [currentUserId, isHomeContextReady, navigation, selectedCountryCode]);

  useEffect(() => {
    if (!isHomeContextReady || !currentUserId) {
      return;
    }

    void loadWeeklyLeaderboard(currentUserId);
  }, [currentUserId, isHomeContextReady]);

  useEffect(() => {
    if (route.params?.refreshKey && isHomeContextReady) {
      void loadHome(selectedCountryCode, currentUserId, { force: true });
    }
  }, [currentUserId, isHomeContextReady, route.params?.refreshKey]);

  useEffect(() => {
    const postedFeedItem = route.params?.postedFeedItem as FeedAnswer | undefined;
    if (!postedFeedItem?.id) {
      return;
    }

    setFeed((current) => mergePostedAnswer(current, postedFeedItem));
  }, [route.params?.postedFeedItem]);

  useEffect(() => {
    if (!remainingSeconds) {
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingSeconds]);

  useEffect(() => {
    if (!route.params?.autoOpenQuestion || !daily?.question?.id || loading) {
      return;
    }

    const autoOpenKey = `${route.params?.refreshKey || "na"}:${daily.question.id}`;
    if (autoOpenedQuestionRef.current === autoOpenKey) {
      return;
    }

    autoOpenedQuestionRef.current = autoOpenKey;
    openMirror(daily.question);
  }, [daily?.question?.id, loading, route.params?.autoOpenQuestion, route.params?.refreshKey]);

  useEffect(() => {
    setQuickAnswerFeedback(null);
    setQuickAnswerSubmitting(null);
  }, [daily?.question?.id]);

  useEffect(() => {
    hotPulse.stopAnimation();

    if (!daily?.question?.isHotQuestion) {
      hotPulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hotPulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(hotPulse, {
          toValue: 0,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();

    return () => loop.stop();
  }, [daily?.question?.isHotQuestion, hotPulse]);

  const streakProgress = useMemo(() => {
    const streak = daily?.streak?.current || 0;
    return Math.min(1, streak / 7);
  }, [daily?.streak?.current]);

  const availableLiveCategories = useMemo(
    () => allNewsBuckets.map((bucket) => ({
      categoryId: bucket.categoryId,
      color: bucket.color,
      label: bucket.label,
    })),
    [allNewsBuckets]
  );

  const openMirror = (question?: DailyQuestion | FeedAnswer["question"]) => {
    if (!question?.id) {
      return;
    }

    navigation.navigate("Mirror", {
      questionId: question.id,
      questionText: question.text,
      category: question.category,
      country: question.country || selectedCountryCode,
      refreshKey: Date.now(),
    });
  };

  const openWatch = (questionId?: string) => {
    if (!questionId) {
      return;
    }

    navigation.navigate("VideoPlayer", {
      questionId,
      refreshKey: Date.now(),
    });
  };

  const openStoryMode = () => {
    navigation.navigate("StoryMode");
  };

  const openAiCopilot = () => {
    navigation.navigate("AiCopilot");
  };

  const openNewsCategory = (bucket: TrendingCategoryBucket) => {
    navigation.navigate("NewsCategory", {
      categoryColor: bucket.color,
      categoryId: bucket.categoryId,
      categoryLabel: bucket.label,
      country: selectedCountryCode,
      initialBucket: bucket,
    });
  };

  const switchCountry = async (countryCode: string) => {
    const nextCountry = await saveSelectedCountry(countryCode);
    setRecentCountries((current) => mergeRecentCountries(nextCountry, current));
    if (nextCountry === selectedCountryCode) {
      setCountryPickerOpen(false);
      void loadHome(nextCountry, currentUserId, { force: true });
      return;
    }
    setSelectedCountryCode(nextCountry);
    setCountryPickerOpen(false);
    homeRetryCountRef.current = 0;
    lastLoadMetaRef.current = {
      at: 0,
      country: "",
      userId: "",
    };

    const nextCache = getFreshHomeSnapshot(`${nextCountry}:${currentUserId}`);
    if (nextCache) {
      applyHomeSnapshot(nextCache);
      setLoading(false);
      setRefreshing(false);
    } else {
      setDaily(null);
      setDailyBrain(null);
      setHotInsights(null);
      setLaunchQod(null);
      setCountryComparisons([]);
      setRemainingSeconds(0);
      setAllNewsBuckets([]);
      setNewsBuckets([]);
      setFeed([]);
      setLoading(true);
    }

    void loadHome(nextCountry, currentUserId, { force: true });
    void loadWeeklyLeaderboard(currentUserId);
  };

  const togglePreferredNewsCategory = async (categoryId: string) => {
    const next = preferredNewsCategories.includes(categoryId)
      ? preferredNewsCategories.filter((item) => item !== categoryId)
      : [...preferredNewsCategories, categoryId];

    setPreferredNewsCategories(next);
    const filteredBuckets = next.length
      ? allNewsBuckets.filter((bucket) => next.includes(bucket.categoryId))
      : allNewsBuckets;
    setNewsBuckets(filteredBuckets);
    await savePreferredNewsCategories(next);
  };

  const loadWeeklyLeaderboard = async (userId: string) => {
    try {
      const response = await fetch(
        `${getApiUrl(API_CONFIG.endpoints.gamification.leaderboard)}?period=weekly&limit=5&userId=${encodeURIComponent(
          userId
        )}`
      );
      const data = (await readJsonSafely(response)) as
        | { leaderboard?: WeeklyLeaderboardEntry[] }
        | null;

      if (!response.ok) {
        return;
      }

      setWeeklyLeaderboard(
        Array.isArray(data?.leaderboard) ? data.leaderboard.slice(0, 5) : []
      );
    } catch (error) {
      console.error("Weekly leaderboard load error:", error);
    }
  };

  const submitQuickAnswer = async (choice: "PO" | "JO") => {
    if (!daily?.question?.id || quickAnswerSubmitting) {
      return;
    }

    try {
      setQuickAnswerSubmitting(choice);
      setQuickAnswerFeedback(null);

      const response = await fetch(getApiUrl(API_CONFIG.endpoints.answers), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryContext: selectedCountryCode,
          responseTime: 1.2,
          questionId: daily.question.id,
          text: choice === "PO" ? "Po" : "Jo",
          type: "text",
          userId: currentUserId,
        }),
      });
      const data = (await readJsonSafely(response)) as
        | { streak?: { current?: number; lastAnswerDate?: string | null }; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Quick answer failed");
      }

      setDaily((current) =>
        current
          ? {
              ...current,
              hasAnsweredCurrentQuestion: true,
              hasAnsweredToday: true,
              streak: {
                current: Math.max(
                  Number(data?.streak?.current || 0),
                  Number(current.streak?.current || 0)
                ),
                lastAnswerDate:
                  data?.streak?.lastAnswerDate || current.streak?.lastAnswerDate || null,
              },
            }
          : current
      );
      setQuickAnswerFeedback(choice === "PO" ? "U ruajt: Po" : "U ruajt: Jo");
      void loadHome(selectedCountryCode, currentUserId, { force: true });
      void loadWeeklyLeaderboard(currentUserId);
    } catch (error) {
      console.error("Quick answer error:", error);
      setQuickAnswerFeedback("Nuk u ruajt. Provo perseri.");
    } finally {
      setQuickAnswerSubmitting(null);
    }
  };

  const openGamification = () => {
    navigation.navigate("Gamification", { refreshKey: Date.now() });
  };

  const openExpose = (item: FeedAnswer) => {
    if (!item.question?.id || !item.user?.id) {
      return;
    }

    navigation.navigate("Mirror", {
      mode: "expose",
      opponentAnswer:
        item.text || (item.type === "audio" ? "Audio answer" : item.type === "video" ? "Video answer" : "Fast answer"),
      opponentAnswerId: item.id,
      opponentSeconds:
        item.responseTime || (item.timeMode === "10s" || item.penaltyApplied ? 10 : 5),
      opponentUser: item.user.username,
      opponentUserId: item.user.id,
      questionId: item.question.id,
      questionText: item.question.text,
      category: item.question.category,
      refreshKey: Date.now(),
    });
  };

  const reactToAnswer = async (answerId: string) => {
    try {
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.answerInteract(answerId)), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, type: "like" }),
      });
      const data = await readJsonSafely(response);

      if (!response.ok) {
        return;
      }

      setFeed((current) =>
        current.map((item) =>
          item.id === answerId
            ? {
                ...item,
                interactions: {
                  ...item.interactions,
                  likes:
                    typeof (data as { likes?: number })?.likes === "number"
                      ? (data as { likes: number }).likes
                      : item.interactions?.likes || 0,
                },
              }
            : item
        )
      );
    } catch (error) {
      console.error("Like error:", error);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadHome(selectedCountryCode, currentUserId, { force: true });
            }}
            tintColor={colors.accentWarm}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.streakPill}>
            <Ionicons name="flame" size={14} color={colors.accentWarm} />
            <Text style={styles.streakPillText}>Dita {daily?.streak?.current || 0}</Text>
          </View>
          <View style={styles.headerActions}>
            <Text style={styles.scopePill}>
              {feedScope === "following" ? "Feed i miqve" : "Feed global"}
            </Text>
            <TouchableOpacity style={styles.aiButton} onPress={openAiCopilot}>
              <Ionicons name="sparkles-outline" size={16} color={colors.accentWarm} />
              <Text style={styles.aiButtonText}>AI</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.notificationsButton}
              onPress={() => navigation.navigate("Notifications", { refreshKey: Date.now() })}
            >
              <Ionicons name="notifications-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.heroTitle}>Question of the day, streak, and real answers.</Text>

        <View style={styles.countryCard}>
          <TouchableOpacity
            style={styles.countryTrigger}
            onPress={() => setCountryPickerOpen((current) => !current)}
          >
            <Text style={styles.countryTriggerEyebrow}>COUNTRY VIEW</Text>
            <Text style={styles.countryTriggerText}>
              {selectedCountryOption.flag} {selectedCountryOption.label} ▼
            </Text>
          </TouchableOpacity>

          {countryPickerOpen ? (
            <View style={styles.countryList}>
              {SUPPORTED_COUNTRIES.map((country) => (
                <TouchableOpacity
                  key={country.code}
                  style={[
                    styles.countryOption,
                    selectedCountryCode === country.code && styles.countryOptionActive,
                  ]}
                  onPress={() => void switchCountry(country.code)}
                >
                  <Text style={styles.countryOptionFlag}>{country.flag}</Text>
                  <Text style={styles.countryOptionLabel}>{country.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <Animated.View
          style={[
            styles.card,
            daily?.question?.isHotQuestion && styles.hotCard,
            daily?.question?.isHotQuestion
              ? {
                  transform: [
                    {
                      scale: hotPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.01],
                      }),
                    },
                  ],
                }
              : null,
          ]}
        >
          <Text style={styles.eyebrow}>{daily?.question?.promptLabel || "QOD"}</Text>
          {loading && !daily ? (
            <ActivityIndicator color={colors.accentWarm} style={styles.loader} />
          ) : daily?.question ? (
            <>
              {daily.question.isHotQuestion ? (
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.livePillText}>{daily.question.hotLabel || "LIVE"}</Text>
                </View>
              ) : null}
              {daily.question.isHotQuestion && daily.question.hotNewsCategoryLabel ? (
                <View
                  style={[
                    styles.newsCategoryPill,
                    {
                      borderColor:
                        daily.question.hotNewsCategoryColor || "rgba(255,255,255,0.16)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.newsCategoryPillText,
                      { color: daily.question.hotNewsCategoryColor || colors.soft },
                    ]}
                  >
                    {daily.question.hotNewsCategoryLabel}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.questionText}>{daily.question.text}</Text>
              {daily.question.isHotQuestion && daily.question.hotNewsTitle ? (
                <Text style={styles.hotNewsHint}>{daily.question.hotNewsTitle}</Text>
              ) : null}
              {daily.question.promptNote ? (
                <Text style={styles.promptNote}>{daily.question.promptNote}</Text>
              ) : null}
              <View style={styles.countdownRow}>
                <Ionicons name="time-outline" size={16} color={colors.soft} />
                <Text
                  style={[
                    styles.countdownText,
                    daily.question.isHotQuestion && styles.countdownTextHot,
                  ]}
                >
                  {formatCountdown(remainingSeconds)}
                </Text>
                <Text style={styles.countdownMeta}>
                  {daily.question.answerCount || 0} answers today
                </Text>
              </View>
              <View style={styles.quickAnswerCard}>
                <View style={styles.sectionRow}>
                  <Text style={styles.quickAnswerEyebrow}>QUICK ANSWER</Text>
                  <Text style={styles.quickAnswerMeta}>1 tap</Text>
                </View>
                <Text style={styles.quickAnswerText}>
                  Jep nje instinct te menjehershem me Po ose Jo.
                </Text>
                <View style={styles.quickAnswerRow}>
                  <TouchableOpacity
                    style={[
                      styles.quickAnswerButton,
                      (daily.hasAnsweredCurrentQuestion || quickAnswerSubmitting === "PO") &&
                        styles.quickAnswerButtonDisabled,
                    ]}
                    disabled={Boolean(
                      daily.hasAnsweredCurrentQuestion || quickAnswerSubmitting
                    )}
                    onPress={() => void submitQuickAnswer("PO")}
                  >
                    <Text style={styles.quickAnswerButtonText}>
                      {quickAnswerSubmitting === "PO" ? "..." : "Po"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quickAnswerButton,
                      styles.quickAnswerButtonSecondary,
                      (daily.hasAnsweredCurrentQuestion || quickAnswerSubmitting === "JO") &&
                        styles.quickAnswerButtonDisabled,
                    ]}
                    disabled={Boolean(
                      daily.hasAnsweredCurrentQuestion || quickAnswerSubmitting
                    )}
                    onPress={() => void submitQuickAnswer("JO")}
                  >
                    <Text style={styles.quickAnswerButtonText}>
                      {quickAnswerSubmitting === "JO" ? "..." : "Jo"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.quickAnswerHint}>
                  {daily.hasAnsweredCurrentQuestion
                    ? "Pergjigjja e kesaj pyetjeje u ruajt. Mund te vazhdosh me tjetren."
                    : quickAnswerFeedback || "Zero friction. Ruaje streak-un me nje tap."}
                </Text>
              </View>
              {daily.question.isHotQuestion && hotInsights?.topReactions?.length ? (
                <View style={styles.hotInsightsCard}>
                  <View style={styles.hotInsightsHeader}>
                    <Text style={styles.hotInsightsEyebrow}>TOP REACTIONS</Text>
                    <Text style={styles.hotInsightsMeta}>
                      {hotInsights.totalResponses || 0} total
                    </Text>
                  </View>
                  <View style={styles.hotInsightsRow}>
                    {hotInsights.topReactions.map((reaction) => (
                      <View key={reaction} style={styles.hotReactionPill}>
                        <Text style={styles.hotReactionText}>{reaction}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {countryComparisons.length ? (
                <View style={styles.compareCard}>
                  <View style={styles.compareHeader}>
                    <Text style={styles.compareEyebrow}>COMPARE COUNTRIES</Text>
                    <Text style={styles.compareMeta}>{countryComparisons.length} vende</Text>
                  </View>
                  {countryComparisons.map((item) => {
                    const option = getCountryOption(item.country);
                    const leadingPercent =
                      item.leadingReaction === "PO"
                        ? item.yesPercent
                        : item.leadingReaction === "JO"
                          ? item.noPercent
                          : Math.max(1 - item.yesPercent - item.noPercent, 0);

                    return (
                      <View key={item.country} style={styles.compareRow}>
                        <Text style={styles.compareCountry}>
                          {option.flag} {option.label}
                        </Text>
                        <Text style={styles.compareReaction}>
                          {Math.round(leadingPercent * 100)}% {item.leadingReaction}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              <TouchableOpacity style={styles.primaryButton} onPress={() => openMirror(daily.question)}>
                <View style={styles.primaryGlow} />
                <Text style={styles.primaryText}>Përgjigju në 5 sekonda</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.emptyText}>Pyetja e ditës nuk u ngarkua ende.</Text>
              <TouchableOpacity
                style={styles.secondaryLaunchButton}
                onPress={() => void loadHome(selectedCountryCode, currentUserId, { force: true })}
              >
                <Text style={styles.secondaryLaunchButtonText}>Provo përsëri</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {daily?.question?.isHotQuestion && launchQod?.id ? (
          <View style={styles.qodCard}>
            <View style={styles.sectionRow}>
              <Text style={styles.eyebrow}>QOD BACKUP</Text>
              <Text style={styles.percentText}>Always-on</Text>
            </View>
            <Text style={styles.qodTitle}>{launchQod.text}</Text>
            <Text style={styles.qodMeta}>
              Nese HOT mbaron, kjo pyetje e dites vazhdon te mbaje ritmin.
            </Text>
            <TouchableOpacity style={styles.secondaryLaunchButton} onPress={() => openMirror(launchQod)}>
              <Text style={styles.secondaryLaunchButtonText}>Open QoD</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {weeklyLeaderboard.length ? (
          <View style={styles.qodCard}>
            <View style={styles.sectionRow}>
              <Text style={styles.eyebrow}>WEEKLY LEADERBOARD</Text>
              <TouchableOpacity onPress={openGamification}>
                <Text style={styles.linkText}>Open all</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.qodTitle}>Top users kete jave.</Text>
            <Text style={styles.qodMeta}>
              Pike nga answers dhe aktivitet, qe te jete gare reale per t'u kthyer cdo dite.
            </Text>
            <View style={styles.leaderboardPreviewList}>
              {weeklyLeaderboard.map((entry) => (
                <View
                  key={entry.id}
                  style={[
                    styles.leaderboardPreviewRow,
                    entry.isCurrentUser && styles.leaderboardPreviewRowCurrent,
                  ]}
                >
                  <Text style={styles.leaderboardPreviewRank}>#{entry.rank}</Text>
                  <View style={styles.leaderboardPreviewInfo}>
                    <Text style={styles.leaderboardPreviewName}>
                      @{entry.username}
                      {entry.isCurrentUser ? " (You)" : ""}
                    </Text>
                    <Text style={styles.leaderboardPreviewMeta}>
                      {entry.points} pts · {entry.stats?.answers || 0} answers
                    </Text>
                  </View>
                  <Ionicons
                    name={
                      entry.trend === "up"
                        ? "trending-up"
                        : entry.trend === "down"
                          ? "trending-down"
                          : "remove"
                    }
                    size={16}
                    color={
                      entry.trend === "up"
                        ? "#22c55e"
                        : entry.trend === "down"
                          ? "#ef4444"
                          : colors.muted
                    }
                  />
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {dailyBrain?.knowToday?.length ? (
          <View style={styles.brainCard}>
            <View style={styles.sectionRow}>
              <Text style={styles.brainEyebrow}>DAILY BRAIN</Text>
              <Text style={styles.percentText}>{dailyBrain.knowToday.length} gjera</Text>
            </View>
            <Text style={styles.brainTitle}>3 gjera qe duhet t'i dish sot.</Text>
            <Text style={styles.brainMeta}>
              E filtruar nga vendi yt, interesat dhe ritmi i lajmeve qe po ngrihen tani.
            </Text>

            <View style={styles.brainList}>
              {dailyBrain.knowToday.map((item, index) => (
                <View key={item.id || `${item.title}-${index}`} style={styles.brainItem}>
                  <View style={styles.brainItemHeader}>
                    <Text style={styles.brainItemIndex}>0{index + 1}</Text>
                    <Text style={styles.brainItemCategory}>
                      {item.categoryLabel || "News"}{item.source ? ` | ${item.source}` : ""}
                    </Text>
                  </View>
                  <Text style={styles.brainItemHeadline}>{item.title}</Text>
                  <Text style={styles.brainItemSummary}>⚡ {item.summary}</Text>
                  <Text style={styles.brainItemImplication}>🧠 {item.implication}</Text>
                  <Text style={styles.brainItemAction}>🎯 {item.action}</Text>
                  <View style={styles.brainFooter}>
                    <Text style={styles.brainRisk}>Risk: {String(item.risk || "medium").toUpperCase()}</Text>
                    <Text style={styles.brainWhyNow}>{item.whyNow}</Text>
                  </View>
                </View>
              ))}
            </View>

            {dailyBrain.risingTrend ? (
              <View style={styles.brainTrendCard}>
                <Text style={styles.brainTrendEyebrow}>RISING TREND</Text>
                <Text style={styles.brainTrendTitle}>
                  {dailyBrain.risingTrend.categoryLabel || "Trend"} | {dailyBrain.risingTrend.title || "Live now"}
                </Text>
              </View>
            ) : null}

            {dailyBrain.decision ? (
              <View style={styles.brainDecisionCard}>
                <Text style={styles.brainDecisionEyebrow}>TODAY'S DECISION</Text>
                <Text style={styles.brainDecisionAction}>{dailyBrain.decision.action}</Text>
                <Text style={styles.brainDecisionMeta}>
                  {dailyBrain.decision.implication || ""} {dailyBrain.decision.risk ? `| Risk ${String(dailyBrain.decision.risk).toUpperCase()}` : ""}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {newsBuckets.length ? (
          <View style={styles.card}>
            <View style={styles.sectionRow}>
              <Text style={styles.eyebrow}>LIVE FOR YOU</Text>
              <Text style={styles.percentText}>{newsBuckets.length} kategori</Text>
            </View>
            <Text style={styles.streakTitle}>LIVE tani del nga kategorite qe te pelqejne me shume.</Text>
            <Text style={styles.metaText}>
              Zgjidh kategorite qe do ne Home. Kliko kartat poshte dhe hapet lista e plote e lajmeve per secilen.
            </Text>

            {availableLiveCategories.length ? (
              <View style={styles.newsFilterRow}>
                {availableLiveCategories.map((category) => {
                  const active = preferredNewsCategories.includes(category.categoryId);

                  return (
                    <TouchableOpacity
                      key={category.categoryId}
                      style={[
                        styles.newsFilterChip,
                        active && styles.newsFilterChipActive,
                        { borderColor: `${category.color}${active ? "AA" : "44"}` },
                      ]}
                      onPress={() => void togglePreferredNewsCategory(category.categoryId)}
                    >
                      <Text
                        style={[
                          styles.newsFilterChipText,
                          { color: active ? colors.text : category.color },
                        ]}
                      >
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.newsCategoryList}>
              {newsBuckets.map((bucket) => (
                <TouchableOpacity
                  key={bucket.categoryId}
                  activeOpacity={0.92}
                  onPress={() => openNewsCategory(bucket)}
                  style={[
                    styles.newsCategoryCard,
                    { borderColor: `${bucket.color}55` },
                  ]}
                >
                  <View style={styles.newsCategoryHeader}>
                    <View style={[styles.newsCategoryDot, { backgroundColor: bucket.color }]} />
                    <Text style={styles.newsCategoryTitle}>{bucket.label}</Text>
                    <Text style={styles.newsCategoryCount}>{bucket.total}</Text>
                  </View>

                  {bucket.items.map((item, index) => (
                    <View
                      key={`${bucket.categoryId}-${index}-${item.title}`}
                      style={[
                        styles.newsStoryRow,
                        index > 0 && styles.newsStoryRowBorder,
                      ]}
                    >
                      <Text style={styles.newsStoryTitle}>{item.title}</Text>
                      <View style={styles.newsStoryMetaRow}>
                        <Text style={styles.newsStoryMeta}>{item.source || "News"}</Text>
                        <Text style={styles.newsStoryScore}>
                          Viral {Number(item.viralScore || 0).toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionRow}>
            <Text style={styles.eyebrow}>STREAK</Text>
            <Text style={styles.percentText}>{Math.round(streakProgress * 100)}%</Text>
          </View>
          <Text style={styles.streakTitle}>Mbaje ritmin gjallë çdo ditë.</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(8, streakProgress * 100)}%` }]} />
          </View>
          <Text style={styles.metaText}>
            {daily?.hasAnsweredToday
              ? "Sot e ke ruajtur streak-un."
              : "Një answer sot e mban streak-un aktiv."}
          </Text>
        </View>

        <TouchableOpacity style={styles.storyCard} onPress={openStoryMode} activeOpacity={0.92}>
          <View style={styles.storyGlow} />
          <View style={styles.storyHeader}>
            <Text style={styles.storyEyebrow}>STORY MODE</Text>
            <Ionicons name="albums-outline" size={18} color={colors.soft} />
          </View>
          <Text style={styles.storyTitle}>5 pyetje radhazi. Fundi te kthen nje badge emocional.</Text>
          <Text style={styles.storyBody}>
            Privacy per pergjigjet, viralitet per rezultatin. Ky eshte versioni me narrativ i Mirror.
          </Text>
          <View style={styles.storyFooter}>
            <Text style={styles.storyMeta}>Confession, Savage, Funny, Romantic</Text>
            <Text style={styles.storyAction}>Open Story Mode</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.feedHeader}>
          <Text style={styles.feedTitle}>Feed</Text>
          {loading ? <ActivityIndicator size="small" color={colors.accentWarm} /> : null}
        </View>

        {feed.length ? (
          feed.map((item) => (
            <View key={item.id} style={styles.feedCard}>
              <TouchableOpacity activeOpacity={0.9} onPress={() => openWatch(item.question?.id)}>
                <Text style={styles.feedQuestion}>{item.question?.text || "Question"}</Text>
                <View style={styles.mediaShell}>
                  <View style={styles.mediaGlowRed} />
                  <View style={styles.mediaGlowOrange} />
                  <View style={styles.topMetaRow}>
                    <View style={styles.answerType}>
                      <Text style={styles.answerTypeText}>{item.type.toUpperCase()}</Text>
                    </View>
                    <View style={styles.speedBadge}>
                      <Text style={styles.speedBadgeText}>{getSpeedBadge(item)}</Text>
                    </View>
                  </View>
                  <Text style={styles.answerCopy} numberOfLines={4}>
                    {item.text || "Tap to watch or listen to the answer."}
                  </Text>
                  <View style={styles.creatorRow}>
                    <View>
                      <Text style={styles.username}>@{item.user?.username || "creator"}</Text>
                      <Text style={styles.userMeta}>
                        {formatCompactNumber(item.user?.followers || 0)} followers
                      </Text>
                      <Text style={styles.speedMeta}>
                        u pergjigj ne {(item.responseTime || (item.timeMode === "10s" ? 10 : 5)).toFixed(1)} sek{" "}
                        {item.timeMode === "10s" || item.penaltyApplied ? "😬" : ""}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.watchButton}
                      onPress={() => openWatch(item.question?.id)}
                    >
                      <Text style={styles.watchButtonText}>Watch</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.reactionRow}>
                <TouchableOpacity style={styles.reaction} onPress={() => void reactToAnswer(item.id)}>
                  <Ionicons name="heart-outline" size={16} color={colors.text} />
                  <Text style={styles.reactionText}>
                    {formatCompactNumber(item.interactions?.likes || 0)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reaction} onPress={() => openWatch(item.question?.id)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.text} />
                  <Text style={styles.reactionText}>{item.question?.answerCount || 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reaction} onPress={() => openMirror(item.question)}>
                  <Ionicons name="sparkles-outline" size={16} color={colors.text} />
                  <Text style={styles.reactionText}>Answer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reaction} onPress={() => openExpose(item)}>
                  <Ionicons name="git-compare-outline" size={16} color={colors.text} />
                  <Text style={styles.reactionText}>Duet</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Sapo të ketë answers, feed-i shfaqet këtu.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  glowTop: {
    position: "absolute",
    top: -140,
    left: -20,
    right: -20,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255,138,0,0.10)",
  },
  glowBottom: {
    position: "absolute",
    right: -80,
    bottom: 120,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(255,77,77,0.08)",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  streakPillText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  scopePill: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  notificationsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  aiButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(255,138,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,138,0,0.22)",
  },
  aiButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  heroTitle: {
    marginTop: 20,
    marginBottom: 18,
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
  },
  countryCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#101219",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  countryTrigger: {
    gap: 6,
  },
  countryTriggerEyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  countryTriggerText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  countryList: {
    marginTop: 14,
    gap: 8,
  },
  countryOption: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  countryOptionActive: {
    backgroundColor: "rgba(255,77,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.26)",
  },
  countryOptionFlag: {
    fontSize: 18,
  },
  countryOptionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  card: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  hotCard: {
    backgroundColor: "#190B0D",
    borderColor: "rgba(255,77,77,0.52)",
    shadowColor: "#FF4D4D",
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  brainCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#0F141C",
    borderWidth: 1,
    borderColor: "rgba(74,168,255,0.26)",
  },
  brainEyebrow: {
    color: "#7CC7FF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  brainTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  brainMeta: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  brainList: {
    marginTop: 14,
    gap: 12,
  },
  brainItem: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  brainItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brainItemIndex: {
    color: "#7CC7FF",
    fontSize: 12,
    fontWeight: "900",
  },
  brainItemCategory: {
    flex: 1,
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  brainItemHeadline: {
    marginTop: 10,
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  brainItemSummary: {
    marginTop: 10,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  brainItemImplication: {
    marginTop: 6,
    color: colors.soft,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  brainItemAction: {
    marginTop: 8,
    color: "#FFD089",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
  },
  brainFooter: {
    marginTop: 10,
    gap: 6,
  },
  brainRisk: {
    color: "#FF8A00",
    fontSize: 12,
    fontWeight: "900",
  },
  brainWhyNow: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  brainTrendCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,138,0,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,138,0,0.22)",
  },
  brainTrendEyebrow: {
    color: "#FFB14D",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  brainTrendTitle: {
    marginTop: 8,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  brainDecisionCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,77,77,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.20)",
  },
  brainDecisionEyebrow: {
    color: "#FF6B57",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  brainDecisionAction: {
    marginTop: 8,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
  },
  brainDecisionMeta: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  storyCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#160B0D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  storyGlow: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 170,
    height: 170,
    borderRadius: 170,
    backgroundColor: "rgba(255,138,0,0.13)",
  },
  storyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  storyEyebrow: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  storyTitle: {
    marginTop: 12,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  storyBody: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  storyFooter: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  storyMeta: {
    flex: 1,
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  storyAction: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  loader: {
    marginVertical: 12,
  },
  eyebrow: {
    color: "#FFB38C",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  questionText: {
    marginTop: 12,
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
  },
  livePill: {
    alignSelf: "flex-start",
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,77,77,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.35)",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  livePillText: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  hotNewsHint: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  newsCategoryPill: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  newsCategoryPillText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  promptNote: {
    marginTop: 10,
    color: colors.soft,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  countdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    marginBottom: 16,
  },
  countdownText: {
    color: colors.soft,
    fontSize: 14,
    fontWeight: "700",
  },
  countdownTextHot: {
    color: "#FF8A80",
    fontSize: 16,
    fontWeight: "900",
  },
  countdownMeta: {
    marginLeft: "auto",
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  hotInsightsCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  hotInsightsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  hotInsightsEyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  hotInsightsMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  hotInsightsRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hotReactionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,77,77,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.28)",
  },
  hotReactionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  compareCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  compareHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  compareEyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  compareMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  compareRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  compareCountry: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  compareReaction: {
    color: colors.soft,
    fontSize: 13,
    fontWeight: "800",
  },
  qodCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  qodTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },
  qodMeta: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  linkText: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "800",
  },
  quickAnswerCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  quickAnswerEyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  quickAnswerMeta: {
    color: colors.soft,
    fontSize: 11,
    fontWeight: "800",
  },
  quickAnswerText: {
    marginTop: 8,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  quickAnswerRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  quickAnswerButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  quickAnswerButtonSecondary: {
    backgroundColor: "#1B2230",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  quickAnswerButtonDisabled: {
    opacity: 0.55,
  },
  quickAnswerButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  quickAnswerHint: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  leaderboardPreviewList: {
    marginTop: 14,
    gap: 10,
  },
  leaderboardPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  leaderboardPreviewRowCurrent: {
    backgroundColor: "rgba(255,77,77,0.10)",
    borderColor: "rgba(255,77,77,0.24)",
  },
  leaderboardPreviewRank: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    minWidth: 34,
  },
  leaderboardPreviewInfo: {
    flex: 1,
  },
  leaderboardPreviewName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  leaderboardPreviewMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  secondaryLaunchButton: {
    marginTop: 14,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  secondaryLaunchButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    overflow: "hidden",
  },
  primaryGlow: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "48%",
    backgroundColor: colors.accentWarm,
  },
  primaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  percentText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  streakTitle: {
    marginTop: 12,
    marginBottom: 14,
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
  },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.track,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  metaText: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  newsCategoryList: {
    marginTop: 16,
    gap: 12,
  },
  newsFilterRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  newsFilterChip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  newsFilterChipActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  newsFilterChipText: {
    fontSize: 12,
    fontWeight: "800",
  },
  newsCategoryCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
  },
  newsCategoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  newsCategoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  newsCategoryTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  newsCategoryCount: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "800",
  },
  newsStoryRow: {
    paddingTop: 12,
    paddingBottom: 2,
  },
  newsStoryRowBorder: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    marginTop: 10,
  },
  newsStoryTitle: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  newsStoryMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  newsStoryMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  newsStoryScore: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
  },
  feedHeader: {
    marginTop: 6,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feedTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  feedCard: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  feedQuestion: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
  },
  mediaShell: {
    marginTop: 14,
    aspectRatio: 9 / 14,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#111216",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 18,
  },
  mediaGlowRed: {
    position: "absolute",
    top: -30,
    left: -10,
    width: 150,
    height: 150,
    borderRadius: 150,
    backgroundColor: "rgba(255,77,77,0.15)",
  },
  mediaGlowOrange: {
    position: "absolute",
    right: -20,
    bottom: -40,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: "rgba(255,138,0,0.15)",
  },
  topMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  answerType: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.32)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  answerTypeText: {
    color: colors.soft,
    fontSize: 11,
    fontWeight: "800",
  },
  speedBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.32)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  speedBadgeText: {
    fontSize: 16,
  },
  answerCopy: {
    marginTop: "auto",
    color: colors.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    maxWidth: "78%",
  },
  creatorRow: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  username: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  userMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  speedMeta: {
    marginTop: 4,
    color: colors.soft,
    fontSize: 11,
    fontWeight: "700",
  },
  watchButton: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  watchButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  reactionRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  reaction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  reactionText: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
