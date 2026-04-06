import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";

import { API_CONFIG, getApiUrl } from "../config/api";
import { colors, MVP_USER_ID, readJsonSafely } from "../theme/mvp";

type ReferralSummary = {
  code: string;
  shareLink: string;
  shareMessage: string;
  stats: {
    activatedCount: number;
    earnedPoints: number;
    joinedCount: number;
    sentCount: number;
  };
  milestones: Array<{
    current: number;
    label: string;
    progress: number;
    reached: boolean;
    target: number;
  }>;
  recentInvites: Array<{
    id: string;
    status: "sent" | "joined" | "activated";
    rewardPoints: number;
    source?: string;
    invitedUser?: {
      username?: string | null;
    } | null;
  }>;
};

const getStatusCopy = (status: ReferralSummary["recentInvites"][number]["status"]) => {
  switch (status) {
    case "activated":
      return "Aktiv";
    case "joined":
      return "U bashkua";
    case "sent":
    default:
      return "Derguar";
  }
};

export default function ReferralScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiUrl(API_CONFIG.endpoints.referrals.summary)}?userId=${MVP_USER_ID}`
      );
      const data = (await readJsonSafely(response)) as ReferralSummary | null;

      if (!response.ok || !data?.code) {
        throw new Error("Failed to load referrals");
      }

      setSummary(data);
    } catch (error) {
      console.error("Referral summary error:", error);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  const trackShare = async (source: string) => {
    try {
      await fetch(getApiUrl(API_CONFIG.endpoints.referrals.share), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          userId: MVP_USER_ID,
        }),
      });
    } catch (error) {
      console.error("Referral track share error:", error);
    }
  };

  const copyCode = async () => {
    if (!summary?.code) {
      return;
    }

    await Clipboard.setStringAsync(summary.code);
    await trackShare("copy_code");
    Alert.alert("Copied", "Kodi i referral u kopjua.");
    void loadSummary();
  };

  const shareInvite = async () => {
    if (!summary?.shareMessage) {
      return;
    }

    await Share.share({
      message: summary.shareMessage,
      title: "Invite te 5 Second Answer",
    });
    await trackShare("share_sheet");
    void loadSummary();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>REFERRALS</Text>
            <Text style={styles.title}>Cdo screenshot dhe cdo invite mund te sjelle user-in tjeter.</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accentWarm} />
          </View>
        ) : !summary ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Referral panel nuk u ngarkua kete here.</Text>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>KODI YT</Text>
              <Text style={styles.code}>{summary.code}</Text>
              <Text style={styles.heroBody}>
                Dergoje. Nese hyn dhe jep answer-in e pare, growth-i kthehet ne pike dhe momentum.
              </Text>

              <View style={styles.ctaRow}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => void shareInvite()}>
                  <Text style={styles.primaryText}>Ndaj invite</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => void copyCode()}>
                  <Text style={styles.secondaryText}>Copy code</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{summary.stats.sentCount}</Text>
                <Text style={styles.statLabel}>Sent</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{summary.stats.joinedCount}</Text>
                <Text style={styles.statLabel}>Joined</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{summary.stats.activatedCount}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{summary.stats.earnedPoints}</Text>
                <Text style={styles.statLabel}>XP</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Milestones</Text>
              {summary.milestones.map((milestone) => (
                <View key={milestone.target} style={styles.milestoneRow}>
                  <View style={styles.milestoneHead}>
                    <Text style={styles.milestoneLabel}>{milestone.label}</Text>
                    <Text style={styles.milestoneValue}>
                      {milestone.current}/{milestone.target}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.max(6, milestone.progress * 100)}%` }]} />
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Recent invites</Text>
              {summary.recentInvites.length ? (
                summary.recentInvites.map((invite) => (
                  <View key={invite.id} style={styles.inviteRow}>
                    <View style={styles.inviteMeta}>
                      <Text style={styles.inviteName}>
                        {invite.invitedUser?.username ? `@${invite.invitedUser.username}` : "Invite pending"}
                      </Text>
                      <Text style={styles.inviteSource}>{invite.source || "share"}</Text>
                    </View>
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>{getStatusCopy(invite.status)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  Sapo te nisesh kodin tend, referral-et e fundit do te shfaqen ketu.
                </Text>
              )}
            </View>
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
    paddingTop: 24,
    paddingBottom: 48,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 10,
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#160D0D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroLabel: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  code: {
    marginTop: 12,
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heroBody: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  primaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  secondaryText: {
    color: colors.soft,
    fontSize: 14,
    fontWeight: "800",
  },
  statsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  statNumber: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  milestoneRow: {
    marginBottom: 14,
  },
  milestoneHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  milestoneLabel: {
    color: colors.soft,
    fontSize: 13,
    fontWeight: "700",
  },
  milestoneValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  track: {
    marginTop: 8,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.track,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  inviteMeta: {
    flex: 1,
  },
  inviteName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  inviteSource: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statusText: {
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
