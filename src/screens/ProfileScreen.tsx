import React, { useEffect, useMemo, useState } from "react";
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
import { clearAuthSession } from "../services/authService";
import { resetOnboardingState } from "../services/onboardingService";
import {
  colors,
  formatCompactNumber,
  formatCountdown,
  MVP_USER_ID,
  readJsonSafely,
} from "../theme/mvp";

type AnswerHistoryItem = {
  id: string;
  type: "video" | "audio" | "text";
  text?: string | null;
  createdAt?: string | null;
  timeMode?: "5s" | "10s";
  responseTime?: number | null;
  penaltyApplied?: boolean;
  questionId?: string;
  question?: {
    id: string;
    text: string;
    category: string;
  };
  interactions?: {
    likes?: number;
    views?: number;
    shares?: number;
  };
};

type DailyPayload = {
  question?: {
    timeRemainingSeconds?: number;
  };
  streak?: {
    current: number;
  };
};

type ProfileBadge = {
  id: string;
  name: string;
  emoji: string;
  unlockedAt?: string | null;
};

type ProfileUser = {
  id: string;
  username: string;
  badges: ProfileBadge[];
  stats?: {
    bestStreak?: number;
  };
};

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<AnswerHistoryItem[]>([]);
  const [daily, setDaily] = useState<DailyPayload | null>(null);
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const [answersResponse, dailyResponse, meResponse] = await Promise.all([
        fetch(`${getApiUrl(API_CONFIG.endpoints.answers)}?userId=${MVP_USER_ID}`),
        fetch(`${getApiUrl(API_CONFIG.endpoints.questionDaily)}?userId=${MVP_USER_ID}`),
        fetch(
          `${getApiUrl(API_CONFIG.endpoints.auth.me)}?userId=${encodeURIComponent(MVP_USER_ID)}`
        ),
      ]);

      const answersData = (await readJsonSafely(answersResponse)) as AnswerHistoryItem[] | null;
      const dailyData = (await readJsonSafely(dailyResponse)) as DailyPayload | null;
      const meData = (await readJsonSafely(meResponse)) as { user?: ProfileUser } | null;

      setAnswers(Array.isArray(answersData) ? answersData : []);
      setDaily(dailyData);
      setProfileUser(meData?.user || null);
    } catch (error) {
      console.error("Profile load error:", error);
      setAnswers([]);
      setDaily(null);
      setProfileUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();

    const unsubscribe = navigation.addListener("focus", () => {
      void loadProfile();
    });

    return unsubscribe;
  }, [navigation]);

  const stats = useMemo(
    () =>
      answers.reduce(
        (acc, answer) => ({
          totalAnswers: acc.totalAnswers + 1,
          totalLikes: acc.totalLikes + Number(answer.interactions?.likes || 0),
          totalViews: acc.totalViews + Number(answer.interactions?.views || 0),
          fastAnswers:
            acc.fastAnswers + (answer.timeMode === "10s" || answer.penaltyApplied ? 0 : 1),
          slowAnswers:
            acc.slowAnswers + (answer.timeMode === "10s" || answer.penaltyApplied ? 1 : 0),
        }),
        {
          totalAnswers: 0,
          totalLikes: 0,
          totalViews: 0,
          fastAnswers: 0,
          slowAnswers: 0,
        }
      ),
    [answers]
  );

  const fastPercent = stats.totalAnswers
    ? Math.round((stats.fastAnswers / stats.totalAnswers) * 100)
    : 0;
  const slowPercent = stats.totalAnswers
    ? Math.round((stats.slowAnswers / stats.totalAnswers) * 100)
    : 0;
  const badgePreview = profileUser?.badges?.slice(0, 6) || [];

  const openAnswer = (answer: AnswerHistoryItem) => {
    const questionId = answer.question?.id || answer.questionId;
    if (!questionId) {
      return;
    }

    navigation.navigate("VideoPlayer", {
      questionId,
      highlightAnswerId: answer.id,
      refreshKey: Date.now(),
    });
  };

  const handleSignOut = async () => {
    try {
      await clearAuthSession();
      await resetOnboardingState();
      navigation.reset({
        index: 0,
        routes: [{ name: "Auth" }],
      });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={34} color={colors.accentWarm} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.username}>@{MVP_USER_ID}</Text>
            <Text style={styles.bio}>Short answers. Fast instinct. Real streak.</Text>
            <TouchableOpacity style={styles.signOutButton} onPress={() => void handleSignOut()}>
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>STATS</Text>
          {loading ? (
            <ActivityIndicator color={colors.accentWarm} style={styles.loader} />
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{daily?.streak?.current || 0}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{stats.totalAnswers}</Text>
                <Text style={styles.statLabel}>Answers</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{formatCompactNumber(stats.totalViews)}</Text>
                <Text style={styles.statLabel}>Views</Text>
              </View>
            </View>
          )}
          <Text style={styles.countdownText}>
            QoD resets in {formatCountdown(daily?.question?.timeRemainingSeconds || 0)}
          </Text>
          <View style={styles.splitStats}>
            <View style={styles.splitRow}>
              <Text style={styles.splitLabel}>FAST 5s</Text>
              <Text style={styles.splitValue}>{fastPercent}%</Text>
            </View>
            <View style={styles.splitTrack}>
              <View style={[styles.splitFill, { width: `${fastPercent}%` }]} />
            </View>
            <View style={[styles.splitRow, styles.splitRowSecondary]}>
              <Text style={styles.splitLabel}>SLOW 10s</Text>
              <Text style={styles.splitValue}>{slowPercent}%</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>BADGES</Text>
          {badgePreview.length ? (
            <View style={styles.badgesRow}>
              {badgePreview.map((badge) => (
                <View key={badge.id} style={styles.badgePill}>
                  <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                  <Text style={styles.badgeText}>{badge.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Post in 5s to unlock the fast badge and use the extra 5s to unlock the slow badge.
            </Text>
          )}
          <Text style={styles.badgesHint}>
            Best streak: {Number(profileUser?.stats?.bestStreak || daily?.streak?.current || 0)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.gamificationCard}
          onPress={() => navigation.navigate("Gamification", { refreshKey: Date.now() })}
        >
          <Text style={styles.eyebrow}>WEEKLY RACE</Text>
          <Text style={styles.referralTitle}>Open streak, badges and leaderboard.</Text>
          <Text style={styles.referralBody}>
            Shiko sa pike ke kete jave dhe kush po e kryeson garen.
          </Text>
          <Text style={styles.referralAction}>Open Gamification</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>HISTORY</Text>
          <Text style={styles.sectionTitle}>Your latest answers</Text>

          {loading ? (
            <ActivityIndicator color={colors.accentWarm} style={styles.loader} />
          ) : answers.length ? (
            answers.map((answer) => (
              <TouchableOpacity
                key={answer.id}
                style={styles.historyRow}
                onPress={() => openAnswer(answer)}
              >
                <View style={styles.historyBadge}>
                  <Text style={styles.historyBadgeText}>
                    {(answer.timeMode === "10s" || answer.penaltyApplied ? "SLOW" : "FAST") +
                      " " +
                      answer.type.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.historyContent}>
                  <Text style={styles.historyQuestion} numberOfLines={2}>
                    {answer.question?.text || "Question removed"}
                  </Text>
                  <Text style={styles.historyPreview} numberOfLines={2}>
                    {answer.text || "Tap to review this answer."}
                  </Text>
                  <View style={styles.historyMeta}>
                    <Text style={styles.historyMetaText}>
                      {formatCompactNumber(answer.interactions?.likes || 0)} likes
                    </Text>
                    <Text style={styles.historyMetaText}>
                      {formatCompactNumber(answer.interactions?.views || 0)} views
                    </Text>
                    <Text style={styles.historyMetaText}>
                      {(answer.responseTime || (answer.timeMode === "10s" ? 10 : 5)).toFixed(1)}s
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.soft} />
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>Your answer history will appear here after the first post.</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.referralCard}
          onPress={() => navigation.navigate("Referral", { refreshKey: Date.now() })}
        >
          <View style={styles.referralGlow} />
          <Text style={styles.eyebrow}>REFERRALS</Text>
          <Text style={styles.referralTitle}>Turn shares into real users.</Text>
          <Text style={styles.referralBody}>
            Open your referral panel, copy your code, and track who joins from your invites.
          </Text>
          <Text style={styles.referralAction}>Open Referral Panel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("Mirror", { refreshKey: Date.now() })}
        >
          <View style={styles.primaryGlow} />
          <Text style={styles.primaryText}>Answer today's question</Text>
        </TouchableOpacity>
      </ScrollView>
      <FloatingAiEntry feature="referral" queryHint="Si e rris growth-in tim ne app?" />
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
    left: -30,
    right: -30,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255,138,0,0.08)",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  headerInfo: {
    marginLeft: 14,
    flex: 1,
  },
  signOutButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  signOutText: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "800",
  },
  username: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  bio: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  card: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  eyebrow: {
    color: "#FFB38C",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  loader: {
    marginVertical: 12,
  },
  statsGrid: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  statBox: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  statNumber: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  countdownText: {
    marginTop: 14,
    color: colors.soft,
    fontSize: 13,
    fontWeight: "700",
  },
  splitStats: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  splitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  splitRowSecondary: {
    marginTop: 12,
  },
  splitLabel: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  splitValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  splitTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.track,
    overflow: "hidden",
  },
  splitFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  badgesRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  badgeEmoji: {
    fontSize: 16,
  },
  badgeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  badgesHint: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    marginTop: 10,
    marginBottom: 12,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  historyBadge: {
    minWidth: 68,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
  },
  historyBadgeText: {
    color: colors.soft,
    fontSize: 11,
    fontWeight: "800",
  },
  historyContent: {
    flex: 1,
  },
  historyQuestion: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  historyPreview: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  historyMeta: {
    marginTop: 8,
    flexDirection: "row",
    gap: 10,
  },
  historyMetaText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  emptyText: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  gamificationCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#151018",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.18)",
  },
  referralCard: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#160D0D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  referralGlow: {
    position: "absolute",
    right: -30,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 140,
    backgroundColor: "rgba(255,138,0,0.12)",
  },
  referralTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  referralBody: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  referralAction: {
    marginTop: 16,
    color: colors.accentWarm,
    fontSize: 13,
    fontWeight: "800",
  },
  primaryButton: {
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
  primaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
});
