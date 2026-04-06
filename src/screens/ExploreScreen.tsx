import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { API_CONFIG, getApiUrl } from "../config/api";
import FloatingAiEntry from "../components/FloatingAiEntry";
import {
  getPrefetchCountries,
  getCountryOption,
  getRecentCountries,
  getSelectedCountry,
  mergeRecentCountries,
  saveSelectedCountry,
  SUPPORTED_COUNTRIES,
} from "../services/countryService";
import {
  categoryChips,
  colors,
  formatCompactNumber,
  MVP_USER_ID,
  readJsonSafely,
} from "../theme/mvp";

type Question = {
  id: string;
  text: string;
  category: string;
  country?: string;
  answerCount: number;
  views?: number;
};

type TrendingItem = {
  question: Question;
  answerCount: number;
};

type TrendingHashtag = {
  id: string;
  name: string;
  postCount: number;
};

type ChallengeItem = {
  id: string;
  hashtag: string;
  title: string;
  description: string;
  entryCount: number;
  endsAt?: string | null;
};

type ExploreSnapshot = {
  challenges: ChallengeItem[];
  questions: Question[];
  trending: TrendingItem[];
  trendingHashtags: TrendingHashtag[];
};

type CachedExploreSnapshot = {
  snapshot: ExploreSnapshot;
  storedAt: number;
};

const getTimeLeft = (endsAt?: string | null) => {
  if (!endsAt) {
    return "Open";
  }

  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) {
    return "Closing";
  }

  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
};

const EXPLORE_CACHE_TTL_MS = 3 * 60 * 1000;

export default function ExploreScreen() {
  const navigation = useNavigation<any>();
  const exploreCacheRef = useRef(
    new Map<string, CachedExploreSnapshot>()
  );
  const pendingExplorePrefetchRef = useRef(new Set<string>());
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState("AL");
  const [recentCountries, setRecentCountries] = useState<string[]>(["AL"]);
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

  const getFreshExploreSnapshot = (countryCode: string) => {
    const entry = exploreCacheRef.current.get(countryCode);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.storedAt > EXPLORE_CACHE_TTL_MS) {
      exploreCacheRef.current.delete(countryCode);
      return null;
    }

    return entry.snapshot;
  };

  const storeExploreSnapshot = (countryCode: string, snapshot: ExploreSnapshot) => {
    exploreCacheRef.current.set(countryCode, {
      snapshot,
      storedAt: Date.now(),
    });
  };

  const prefetchExploreCountry = async (countryCode: string) => {
    const activeCountry = countryCode;

    if (getFreshExploreSnapshot(activeCountry) || pendingExplorePrefetchRef.current.has(activeCountry)) {
      return;
    }

    pendingExplorePrefetchRef.current.add(activeCountry);

    try {
      const [questionsResponse, trendingResponse, hashtagResponse] = await Promise.all([
        fetch(buildUrl(API_CONFIG.endpoints.questions, { country: activeCountry })),
        fetch(buildUrl(`${API_CONFIG.endpoints.questions}/trending`, { country: activeCountry, limit: 10 })),
        fetch(getApiUrl(API_CONFIG.endpoints.hashtags.trending)),
      ]);

      const questionsData = (await readJsonSafely(questionsResponse)) as Question[] | null;
      const trendingData = (await readJsonSafely(trendingResponse)) as TrendingItem[] | null;
      const hashtagData = (await readJsonSafely(hashtagResponse)) as
        | { challenges?: ChallengeItem[]; trending?: TrendingHashtag[] }
        | null;

      storeExploreSnapshot(activeCountry, {
        challenges: Array.isArray(hashtagData?.challenges) ? hashtagData?.challenges : [],
        questions: Array.isArray(questionsData) ? questionsData : [],
        trending: Array.isArray(trendingData) ? trendingData : [],
        trendingHashtags: Array.isArray(hashtagData?.trending) ? hashtagData?.trending : [],
      });
    } catch (error) {
      console.error("Explore prefetch error:", error);
    } finally {
      pendingExplorePrefetchRef.current.delete(activeCountry);
    }
  };

  const loadExplore = async (countryOverride?: string, options: { force?: boolean } = {}) => {
    try {
      const activeCountry = countryOverride || (await getSelectedCountry());
      const cached = getFreshExploreSnapshot(activeCountry);
      if (cached && !options.force) {
        setQuestions(cached.questions);
        setTrending(cached.trending);
        setChallenges(cached.challenges);
        setTrendingHashtags(cached.trendingHashtags);
        setLoading(false);
      } else {
        setLoading(true);
      }

      setSelectedCountryCode(activeCountry);
      const [questionsResponse, trendingResponse, hashtagResponse] = await Promise.all([
        fetch(buildUrl(API_CONFIG.endpoints.questions, { country: activeCountry })),
        fetch(buildUrl(`${API_CONFIG.endpoints.questions}/trending`, { country: activeCountry, limit: 10 })),
        fetch(getApiUrl(API_CONFIG.endpoints.hashtags.trending)),
      ]);

      const questionsData = (await readJsonSafely(questionsResponse)) as Question[] | null;
      const trendingData = (await readJsonSafely(trendingResponse)) as TrendingItem[] | null;
      const hashtagData = (await readJsonSafely(hashtagResponse)) as
        | { challenges?: ChallengeItem[]; trending?: TrendingHashtag[] }
        | null;

      const nextSnapshot = {
        challenges: Array.isArray(hashtagData?.challenges) ? hashtagData?.challenges : [],
        questions: Array.isArray(questionsData) ? questionsData : [],
        trending: Array.isArray(trendingData) ? trendingData : [],
        trendingHashtags: Array.isArray(hashtagData?.trending) ? hashtagData?.trending : [],
      };

      setQuestions(nextSnapshot.questions);
      setTrending(nextSnapshot.trending);
      setChallenges(nextSnapshot.challenges);
      setTrendingHashtags(nextSnapshot.trendingHashtags);
      storeExploreSnapshot(activeCountry, nextSnapshot);
    } catch (error) {
      console.error("Explore load error:", error);
      setQuestions([]);
      setTrending([]);
      setChallenges([]);
      setTrendingHashtags([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      setRecentCountries(await getRecentCountries());
      await loadExplore();
    })();
  }, []);

  useEffect(() => {
    const targets = getPrefetchCountries(selectedCountryCode, countryPickerOpen ? 4 : 2, recentCountries);
    targets.forEach((countryCode) => {
      void prefetchExploreCountry(countryCode);
    });
  }, [countryPickerOpen, recentCountries, selectedCountryCode]);

  const discoveredCategories = useMemo(() => {
    const dynamic = [...new Set(questions.map((item) => item.category).filter(Boolean))].map(
      (category) => ({
        id: category,
        label: category.replace(/-/g, " "),
        emoji: "•",
      })
    );

    const seen = new Set(categoryChips.map((item) => item.id));
    return [...categoryChips, ...dynamic.filter((item) => !seen.has(item.id))];
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    if (selectedCategory === "all") {
      return questions;
    }

    return questions.filter((item) => item.category === selectedCategory);
  }, [questions, selectedCategory]);

  const openMirror = (question: Question) => {
    navigation.navigate("Mirror", {
      questionId: question.id,
      questionText: question.text,
      category: question.category,
      country: question.country || selectedCountryCode,
      refreshKey: Date.now(),
    });
  };

  const switchCountry = async (countryCode: string) => {
    const nextCountry = await saveSelectedCountry(countryCode);
    setRecentCountries((current) => mergeRecentCountries(nextCountry, current));
    if (nextCountry === selectedCountryCode) {
      setCountryPickerOpen(false);
      return;
    }
    setSelectedCountryCode(nextCountry);
    setCountryPickerOpen(false);
    const cached = getFreshExploreSnapshot(nextCountry);
    if (cached) {
      setQuestions(cached.questions);
      setTrending(cached.trending);
      setChallenges(cached.challenges);
      setTrendingHashtags(cached.trendingHashtags);
      setLoading(false);
    } else {
      setQuestions([]);
      setTrending([]);
    }
    void loadExplore(nextCountry);
  };

  const openStoryMode = () => {
    navigation.navigate("StoryMode");
  };

  const openRooms = () => {
    navigation.navigate("RoomsLobby");
  };

  const openHashtagFeed = (hashtag: string) => {
    navigation.navigate("HashtagFeed", {
      hashtag,
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Explore what people are answering right now.</Text>
        <Text style={styles.subtitle}>
          Trending pyetje lart, kategori poshtë, dhe çdo klik të çon direkt te Mirror.
        </Text>

        <View style={styles.countryCard}>
          <TouchableOpacity
            style={styles.countryTrigger}
            onPress={() => setCountryPickerOpen((current) => !current)}
          >
            <Text style={styles.countryEyebrow}>EXPLORE COUNTRY</Text>
            <Text style={styles.countryText}>
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
                  <Text style={styles.countryFlag}>{country.flag}</Text>
                  <Text style={styles.countryLabel}>{country.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.storyShortcut} onPress={openStoryMode} activeOpacity={0.92}>
          <View style={styles.storyShortcutGlow} />
          <View style={styles.storyShortcutHeader}>
            <Text style={styles.storyShortcutEyebrow}>STORY MODE</Text>
            <Ionicons name="sparkles" size={16} color={colors.accentWarm} />
          </View>
          <Text style={styles.storyShortcutTitle}>
            5 pyetje radhazi dhe ne fund nje profil emocional share-ready.
          </Text>
          <Text style={styles.storyShortcutMeta}>Open the mode that turns answers into narrative.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.storyShortcut} onPress={openRooms} activeOpacity={0.92}>
          <View style={styles.storyShortcutGlow} />
          <View style={styles.storyShortcutHeader}>
            <Text style={styles.storyShortcutEyebrow}>ROOMS</Text>
            <Ionicons name="people" size={16} color={colors.accentWarm} />
          </View>
          <Text style={styles.storyShortcutTitle}>
            Real-time rooms me text, audio dhe video takes per te njejten pyetje.
          </Text>
          <Text style={styles.storyShortcutMeta}>Create a room or jump into one that is already live.</Text>
        </TouchableOpacity>

        {challenges.length ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Challenges</Text>
            </View>
            {challenges.map((challenge) => (
              <TouchableOpacity
                key={challenge.id}
                style={styles.challengeCard}
                onPress={() => openHashtagFeed(challenge.hashtag)}
              >
                <View style={styles.challengeHeader}>
                  <View style={styles.challengeCopy}>
                    <Text style={styles.challengeTitle}>{challenge.title}</Text>
                    <Text style={styles.challengeDescription}>{challenge.description}</Text>
                  </View>
                  <Text style={styles.challengeTimer}>{getTimeLeft(challenge.endsAt)}</Text>
                </View>
                <View style={styles.challengeFooter}>
                  <Text style={styles.challengeMeta}>
                    #{challenge.hashtag} · {formatCompactNumber(challenge.entryCount)} entries
                  </Text>
                  <Text style={styles.challengeJoin}>Open</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {trendingHashtags.length ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Trending Hashtags</Text>
            </View>
            <View style={styles.hashtagList}>
              {trendingHashtags.map((tag, index) => (
                <TouchableOpacity
                  key={tag.id || tag.name}
                  style={styles.hashtagRow}
                  onPress={() => openHashtagFeed(tag.name)}
                >
                  <Text style={styles.hashtagRank}>#{index + 1}</Text>
                  <View style={styles.hashtagInfo}>
                    <Text style={styles.hashtagName}>#{tag.name}</Text>
                    <Text style={styles.hashtagCount}>
                      {formatCompactNumber(tag.postCount)} pergjigje
                    </Text>
                  </View>
                  <Text style={styles.hashtagOpen}>Hape</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending Questions</Text>
          {loading ? <ActivityIndicator size="small" color={colors.accentWarm} /> : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trendingRow}
        >
          {trending.map((item, index) => (
            <TouchableOpacity
              key={item.question.id}
              style={styles.trendingCard}
              onPress={() => openMirror(item.question)}
            >
              <Text style={styles.rank}>#{index + 1}</Text>
              <Text style={styles.trendingCategory}>{item.question.category}</Text>
              <Text style={styles.trendingText} numberOfLines={4}>
                {item.question.text}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaStat}>{item.answerCount} answers</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.soft} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={() => void loadExplore()}>
            <Ionicons name="refresh" size={16} color={colors.soft} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {discoveredCategories.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.categoryChip,
                selectedCategory === item.id && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(item.id)}
            >
              <Text style={styles.categoryEmoji}>{item.emoji}</Text>
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item.id && styles.categoryTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Question List</Text>
          <Text style={styles.countText}>{filteredQuestions.length} items</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accentWarm} />
          </View>
        ) : filteredQuestions.length ? (
          filteredQuestions.map((question) => (
            <TouchableOpacity
              key={question.id}
              style={styles.questionCard}
              onPress={() => openMirror(question)}
            >
              <Text style={styles.questionCategory}>{question.category}</Text>
              <Text style={styles.questionText}>{question.text}</Text>
              <View style={styles.questionMetaRow}>
                <Text style={styles.questionMeta}>
                  {formatCompactNumber(question.answerCount || 0)} answers
                </Text>
                <Text style={styles.questionMeta}>
                  {formatCompactNumber(question.views || 0)} views
                </Text>
              </View>
              <TouchableOpacity style={styles.answerButton} onPress={() => openMirror(question)}>
                <Text style={styles.answerButtonText}>Open in Mirror</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>S’ka pyetje për këtë kategori ende.</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.dailyButton}
          onPress={() =>
            navigation.navigate("Mirror", {
              questionId: undefined,
              userId: MVP_USER_ID,
              refreshKey: Date.now(),
            })
          }
        >
          <View style={styles.primaryGlow} />
          <Text style={styles.dailyButtonText}>Go to today’s Mirror</Text>
        </TouchableOpacity>
      </ScrollView>
      <FloatingAiEntry
        feature="hashtags"
        queryHint="Si funksionojne challenges dhe hashtags?"
      />
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
    top: -120,
    left: -20,
    right: -20,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(255,77,77,0.09)",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 10,
    marginBottom: 24,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  countryCard: {
    marginBottom: 20,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#101219",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  countryTrigger: {
    gap: 6,
  },
  countryEyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  countryText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  countryList: {
    marginTop: 12,
    gap: 8,
  },
  countryOption: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
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
  countryFlag: {
    fontSize: 18,
  },
  countryLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  storyShortcut: {
    marginBottom: 22,
    padding: 18,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#130F1E",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  storyShortcutGlow: {
    position: "absolute",
    top: -28,
    right: -10,
    width: 150,
    height: 150,
    borderRadius: 150,
    backgroundColor: "rgba(255,77,77,0.12)",
  },
  storyShortcutHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  storyShortcutEyebrow: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  storyShortcutTitle: {
    marginTop: 12,
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
  },
  storyShortcutMeta: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  challengeCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#121016",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  challengeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  challengeCopy: {
    flex: 1,
  },
  challengeTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  challengeDescription: {
    marginTop: 6,
    color: colors.muted,
    lineHeight: 18,
    fontSize: 13,
    fontWeight: "600",
  },
  challengeTimer: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "800",
  },
  challengeFooter: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  challengeMeta: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  challengeJoin: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
  },
  sectionHeader: {
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  trendingRow: {
    gap: 12,
    paddingBottom: 18,
  },
  trendingCard: {
    width: 260,
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  rank: {
    color: colors.accentWarm,
    fontSize: 20,
    fontWeight: "900",
  },
  trendingCategory: {
    marginTop: 16,
    color: "#FFB38C",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  trendingText: {
    marginTop: 8,
    color: colors.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
    minHeight: 98,
  },
  metaRow: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaStat: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  refreshButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  hashtagList: {
    marginBottom: 18,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.panel,
  },
  hashtagRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  hashtagRank: {
    width: 34,
    color: colors.accentWarm,
    fontSize: 13,
    fontWeight: "900",
  },
  hashtagInfo: {
    flex: 1,
  },
  hashtagName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  hashtagCount: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  hashtagOpen: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "800",
  },
  categoryRow: {
    gap: 10,
    paddingBottom: 20,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  categoryChipActive: {
    backgroundColor: "rgba(255,77,77,0.12)",
    borderColor: "rgba(255,138,0,0.22)",
  },
  categoryEmoji: {
    fontSize: 14,
  },
  categoryText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  categoryTextActive: {
    color: colors.text,
  },
  countText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  loadingWrap: {
    paddingVertical: 32,
    alignItems: "center",
  },
  questionCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  questionCategory: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  questionText: {
    marginTop: 8,
    color: colors.text,
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "800",
  },
  questionMetaRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
  },
  questionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  answerButton: {
    marginTop: 16,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  answerButtonText: {
    color: colors.soft,
    fontSize: 13,
    fontWeight: "800",
  },
  emptyCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  dailyButton: {
    marginTop: 10,
    minHeight: 46,
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
  dailyButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
});
