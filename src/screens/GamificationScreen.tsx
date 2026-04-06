import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { API_CONFIG, getApiUrl } from "../config/api";
import { colors, formatCompactNumber, MVP_USER_ID, readJsonSafely } from "../theme/mvp";

type GamificationStats = {
  points: number;
  level: number;
  currentLevelXP: number;
  nextLevelXP: number;
  streak: number;
  bestStreak: number;
  stats?: {
    answersGiven?: number;
    activeDaysThisWeek?: number;
    weeklyPoints?: number;
  };
};

type BadgeItem = {
  id: string;
  name: string;
  description?: string;
  emoji?: string;
  earned?: boolean;
  progress?: number;
  progressText?: string;
};

type ChallengeItem = {
  id: string;
  title: string;
  description: string;
  type: "daily" | "weekly" | "monthly";
  progress: number;
  total: number;
  progressRatio?: number;
  completed?: boolean;
  expiresAt?: string;
  icon?: string;
  color?: string;
  reward?: {
    type?: string;
    amount?: number;
  };
};

type LeaderboardEntry = {
  id: string;
  rank: number;
  username: string;
  avatar?: string | null;
  points: number;
  trend: "up" | "down" | "same";
  isCurrentUser?: boolean;
  stats?: {
    answers?: number;
    activeDays?: number;
    streak?: number;
  };
};

type LeaderboardPayload = {
  leaderboard: LeaderboardEntry[];
  currentUser?: LeaderboardEntry | null;
};

const getTrendIcon = (trend: LeaderboardEntry["trend"]) => {
  if (trend === "up") {
    return "trending-up";
  }

  if (trend === "down") {
    return "trending-down";
  }

  return "remove";
};

const getTrendColor = (trend: LeaderboardEntry["trend"]) => {
  if (trend === "up") {
    return "#22c55e";
  }

  if (trend === "down") {
    return "#ef4444";
  }

  return colors.muted;
};

const formatDeadline = (value?: string) => {
  if (!value) {
    return "This cycle";
  }

  const diffMs = new Date(value).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  if (hours < 24) {
    return `${hours}h left`;
  }

  return `${Math.ceil(hours / 24)}d left`;
};

export default function GamificationScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"challenges" | "badges" | "leaderboard">(
    "leaderboard"
  );
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentUserEntry, setCurrentUserEntry] = useState<LeaderboardEntry | null>(null);

  const loadGamification = async () => {
    try {
      if (!refreshing) {
        setLoading(true);
      }

      const [statsResponse, badgesResponse, challengesResponse, leaderboardResponse] =
        await Promise.all([
          fetch(getApiUrl(API_CONFIG.endpoints.gamification.stats(MVP_USER_ID))),
          fetch(getApiUrl(API_CONFIG.endpoints.gamification.badges(MVP_USER_ID))),
          fetch(getApiUrl(API_CONFIG.endpoints.gamification.challenges(MVP_USER_ID))),
          fetch(
            `${getApiUrl(API_CONFIG.endpoints.gamification.leaderboard)}?period=weekly&limit=12&userId=${encodeURIComponent(
              MVP_USER_ID
            )}`
          ),
        ]);

      const statsData = (await readJsonSafely(statsResponse)) as GamificationStats | null;
      const badgesData = (await readJsonSafely(badgesResponse)) as
        | { allBadges?: BadgeItem[] }
        | null;
      const challengesData = (await readJsonSafely(challengesResponse)) as
        | { active?: ChallengeItem[]; completed?: ChallengeItem[] }
        | null;
      const leaderboardData = (await readJsonSafely(leaderboardResponse)) as
        | LeaderboardPayload
        | null;

      setStats(statsResponse.ok ? statsData : null);
      setBadges(
        badgesResponse.ok && Array.isArray(badgesData?.allBadges)
          ? badgesData.allBadges
          : []
      );
      setChallenges(
        challengesResponse.ok
          ? [
              ...((Array.isArray(challengesData?.active) ? challengesData.active : []) || []),
              ...((Array.isArray(challengesData?.completed)
                ? challengesData.completed
                : []) || []),
            ]
          : []
      );
      setLeaderboard(
        leaderboardResponse.ok && Array.isArray(leaderboardData?.leaderboard)
          ? leaderboardData.leaderboard
          : []
      );
      setCurrentUserEntry(
        leaderboardResponse.ok ? leaderboardData?.currentUser || null : null
      );
    } catch (error) {
      console.error("Gamification load error:", error);
      setStats(null);
      setBadges([]);
      setChallenges([]);
      setLeaderboard([]);
      setCurrentUserEntry(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadGamification();

    const unsubscribe = navigation.addListener("focus", () => {
      void loadGamification();
    });

    return unsubscribe;
  }, [navigation]);

  const levelProgress = useMemo(() => {
    if (!stats?.nextLevelXP) {
      return 0;
    }

    return Math.min(1, (stats.currentLevelXP || 0) / stats.nextLevelXP);
  }, [stats?.currentLevelXP, stats?.nextLevelXP]);

  const topBadges = useMemo(
    () => badges.slice().sort((left, right) => Number(Boolean(right.earned)) - Number(Boolean(left.earned))),
    [badges]
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={colors.text} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.headerEyebrow}>WEEKLY RACE</Text>
        <Text style={styles.headerTitle}>Streak, badges, leaderboard</Text>
      </View>
      <TouchableOpacity
        style={styles.headerButton}
        onPress={() => {
          setRefreshing(true);
          void loadGamification();
        }}
      >
        <Ionicons name="refresh" size={18} color={colors.accentWarm} />
      </TouchableOpacity>
    </View>
  );

  const renderStats = () => (
    <View style={styles.heroCard}>
      <View style={styles.heroGlow} />
      <View style={styles.heroTop}>
        <View>
          <Text style={styles.heroLabel}>TOTAL POINTS</Text>
          <Text style={styles.heroPoints}>{formatCompactNumber(stats?.points || 0)}</Text>
        </View>
        <View style={styles.heroStreak}>
          <Text style={styles.heroStreakValue}>🔥 {stats?.streak || 0}</Text>
          <Text style={styles.heroStreakMeta}>Best {stats?.bestStreak || 0}</Text>
        </View>
      </View>

      <Text style={styles.levelValue}>Level {stats?.level || 1}</Text>
      <View style={styles.levelTrack}>
        <View style={[styles.levelFill, { width: `${Math.max(8, levelProgress * 100)}%` }]} />
      </View>
      <Text style={styles.levelMeta}>
        {stats?.currentLevelXP || 0}/{stats?.nextLevelXP || 250} XP
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statChipValue}>{stats?.stats?.weeklyPoints || 0}</Text>
          <Text style={styles.statChipLabel}>Weekly points</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statChipValue}>{stats?.stats?.answersGiven || 0}</Text>
          <Text style={styles.statChipLabel}>Answers</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statChipValue}>{stats?.stats?.activeDaysThisWeek || 0}</Text>
          <Text style={styles.statChipLabel}>Active days</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => navigation.navigate("Mirror", { refreshKey: Date.now() })}
        >
          <Text style={styles.primaryActionText}>Answer today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => navigation.navigate("Notifications", { refreshKey: Date.now() })}
        >
          <Text style={styles.secondaryActionText}>Open notifications</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabRow}>
      {[
        { id: "leaderboard", label: "Leaderboard" },
        { id: "challenges", label: "Challenges" },
        { id: "badges", label: "Badges" },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tabButton, selectedTab === tab.id && styles.tabButtonActive]}
          onPress={() =>
            setSelectedTab(tab.id as "challenges" | "badges" | "leaderboard")
          }
        >
          <Text
            style={[styles.tabButtonText, selectedTab === tab.id && styles.tabButtonTextActive]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderLeaderboard = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Top users this week</Text>
      <Text style={styles.sectionMeta}>
        Pike nga answers, dite aktive dhe ritmi javor.
      </Text>

      {leaderboard.length ? (
        leaderboard.map((entry) => (
          <View
            key={entry.id}
            style={[styles.listCard, entry.isCurrentUser && styles.listCardCurrent]}
          >
            <View style={styles.rankPill}>
              <Text style={styles.rankPillText}>#{entry.rank}</Text>
            </View>
            <View style={styles.listContent}>
              <Text style={styles.listTitle}>
                @{entry.username}
                {entry.isCurrentUser ? " (You)" : ""}
              </Text>
              <Text style={styles.listMeta}>
                {entry.points} pts · {entry.stats?.answers || 0} answers ·{" "}
                {entry.stats?.activeDays || 0} active days
              </Text>
            </View>
            <View style={styles.trendBadge}>
              <Ionicons
                name={getTrendIcon(entry.trend)}
                size={16}
                color={getTrendColor(entry.trend)}
              />
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Leaderboard-i do shfaqet sapo te kete aktivitet javor.</Text>
      )}

      {currentUserEntry && !leaderboard.some((entry) => entry.id === currentUserEntry.id) ? (
        <View style={[styles.listCard, styles.listCardCurrent]}>
          <View style={styles.rankPill}>
            <Text style={styles.rankPillText}>#{currentUserEntry.rank}</Text>
          </View>
          <View style={styles.listContent}>
            <Text style={styles.listTitle}>@{currentUserEntry.username} (You)</Text>
            <Text style={styles.listMeta}>
              {currentUserEntry.points} pts · {currentUserEntry.stats?.answers || 0} answers ·{" "}
              {currentUserEntry.stats?.activeDays || 0} active days
            </Text>
          </View>
          <View style={styles.trendBadge}>
            <Ionicons
              name={getTrendIcon(currentUserEntry.trend)}
              size={16}
              color={getTrendColor(currentUserEntry.trend)}
            />
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderChallenges = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Daily and weekly pushes</Text>
      <Text style={styles.sectionMeta}>
        Keto challenge te mbajne ne streak dhe te fusin ne gare.
      </Text>

      {challenges.length ? (
        challenges.map((challenge) => (
          <View key={challenge.id} style={styles.challengeCard}>
            <View style={styles.challengeHeader}>
              <View style={styles.challengeHeaderLeft}>
                <Text style={styles.challengeIcon}>{challenge.icon || "🎯"}</Text>
                <View>
                  <Text style={styles.challengeTitle}>{challenge.title}</Text>
                  <Text style={styles.challengeDescription}>{challenge.description}</Text>
                </View>
              </View>
              <Text style={styles.challengeDeadline}>{formatDeadline(challenge.expiresAt)}</Text>
            </View>

            <View style={styles.challengeProgressTrack}>
              <View
                style={[
                  styles.challengeProgressFill,
                  {
                    backgroundColor: challenge.color || colors.accent,
                    width: `${Math.max(
                      8,
                      Math.min(100, (challenge.progressRatio || 0) * 100)
                    )}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.challengeFooter}>
              <Text style={styles.challengeFooterText}>
                {challenge.progress}/{challenge.total}
              </Text>
              <Text style={styles.challengeFooterText}>
                +{challenge.reward?.amount || 0} pts
              </Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>Challenge-et do dalin sapo te kete aktivitet real.</Text>
      )}
    </View>
  );

  const renderBadges = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Unlocked and next-up badges</Text>
      <Text style={styles.sectionMeta}>
        Badge reale nga ritmi, shpejtesia dhe engagement-i yt.
      </Text>

      <View style={styles.badgeGrid}>
        {topBadges.map((badge) => (
          <View
            key={badge.id}
            style={[styles.badgeCard, badge.earned ? styles.badgeCardEarned : styles.badgeCardLocked]}
          >
            <Text style={styles.badgeEmoji}>{badge.emoji || "🏅"}</Text>
            <Text style={styles.badgeName}>{badge.name}</Text>
            <Text style={styles.badgeDescription} numberOfLines={3}>
              {badge.description || (badge.earned ? "Unlocked" : "In progress")}
            </Text>
            {badge.earned ? (
              <Text style={styles.badgeState}>Unlocked</Text>
            ) : (
              <Text style={styles.badgeState}>
                {Math.round(badge.progress || 0)}% · {badge.progressText || "Keep going"}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadGamification();
            }}
            tintColor={colors.accentWarm}
          />
        }
      >
        {renderHeader()}

        {loading ? (
          <ActivityIndicator color={colors.accentWarm} style={styles.loader} />
        ) : (
          <>
            {renderStats()}
            {renderTabs()}
            {selectedTab === "leaderboard" ? renderLeaderboard() : null}
            {selectedTab === "challenges" ? renderChallenges() : null}
            {selectedTab === "badges" ? renderBadges() : null}
          </>
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
    top: -120,
    left: -30,
    right: -30,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255,138,0,0.08)",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 120,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  headerCenter: {
    flex: 1,
  },
  headerEyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  headerTitle: {
    marginTop: 4,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  loader: {
    marginTop: 80,
  },
  heroCard: {
    overflow: "hidden",
    padding: 18,
    borderRadius: 24,
    marginBottom: 18,
    backgroundColor: "#12141B",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  heroGlow: {
    position: "absolute",
    top: -24,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 140,
    backgroundColor: "rgba(255,77,77,0.16)",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  heroPoints: {
    marginTop: 6,
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
  },
  heroStreak: {
    alignItems: "flex-end",
  },
  heroStreakValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
  },
  heroStreakMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  levelValue: {
    marginTop: 16,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  levelTrack: {
    height: 8,
    borderRadius: 999,
    marginTop: 10,
    backgroundColor: colors.track,
    overflow: "hidden",
  },
  levelFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accentWarm,
  },
  levelMeta: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  statChip: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  statChipValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statChipLabel: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  primaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  primaryActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  tabButtonActive: {
    backgroundColor: "rgba(255,77,77,0.16)",
    borderColor: "rgba(255,77,77,0.4)",
  },
  tabButtonText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  tabButtonTextActive: {
    color: colors.text,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  sectionMeta: {
    marginTop: 6,
    marginBottom: 14,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  listCardCurrent: {
    borderColor: "rgba(255,77,77,0.4)",
    backgroundColor: "rgba(255,77,77,0.08)",
  },
  rankPill: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  rankPillText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  listMeta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  trendBadge: {
    width: 32,
    alignItems: "center",
  },
  challengeCard: {
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  challengeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  challengeHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 10,
  },
  challengeIcon: {
    fontSize: 22,
  },
  challengeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  challengeDescription: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  challengeDeadline: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
  },
  challengeProgressTrack: {
    height: 8,
    borderRadius: 999,
    marginTop: 14,
    backgroundColor: colors.track,
    overflow: "hidden",
  },
  challengeProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  challengeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  challengeFooterText: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgeCard: {
    width: "48%",
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
  },
  badgeCardEarned: {
    borderColor: "rgba(255,138,0,0.36)",
  },
  badgeCardLocked: {
    borderColor: colors.panelBorder,
  },
  badgeEmoji: {
    fontSize: 24,
  },
  badgeName: {
    marginTop: 10,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  badgeDescription: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  badgeState: {
    marginTop: 10,
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
});
