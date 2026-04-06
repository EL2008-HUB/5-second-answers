import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import ShareSelector from "../components/ShareSelector";
import { API_CONFIG, getApiUrl } from "../config/api";
import { exportAnswerVideo, shareExportedVideo } from "../services/shareService";
import { colors } from "../theme/mvp";

const AI_STYLE_THEME: Record<
  string,
  { accent: string; chip: string; label: string }
> = {
  default: { accent: "#FF8A00", chip: "AI REACTION", label: "AI is in the loop" },
  emotional: { accent: "#7C6CFF", chip: "EMOTIONAL MODE", label: "AI caught the feeling" },
  funny: { accent: "#FFB84D", chip: "FUNNY MODE", label: "AI found the punchline" },
  savage: { accent: "#FF5C5C", chip: "SAVAGE MODE", label: "AI came in sharp" },
};

const AI_REVEAL_DELAY_MS = 1250;
const AI_TYPING_MS = 18;

const formatPercent = (value: unknown) => `${Math.round(Number(value || 0) * 100)}%`;

export default function ShareScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const type = route.params?.type || "answer";
  const data = route.params?.data || {};
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const celebrationTranslateY = useRef(new Animated.Value(18)).current;
  const aiOpacity = useRef(new Animated.Value(0)).current;
  const aiTranslateY = useRef(new Animated.Value(22)).current;
  const [aiPhase, setAiPhase] = useState<"hidden" | "thinking" | "revealed">(
    data?.aiComment ? "thinking" : "hidden"
  );
  const [typedAiComment, setTypedAiComment] = useState("");
  const [exportingVideo, setExportingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string | null>(null);
  const [teamState, setTeamState] = useState<any>(data?.aiTeam || null);
  const fullAiComment = String(data?.aiComment || "").trim();
  const answerId = String(data?.answerId || "").trim();
  const aiEmoji = String(data?.aiCommentMeta?.emoji || "🤖").trim() || "🤖";
  const aiTheme = useMemo(
    () => AI_STYLE_THEME[String(data?.aiCommentMeta?.style || "").toLowerCase()] || AI_STYLE_THEME.default,
    [data?.aiCommentMeta?.style]
  );
  const displaySentiment = teamState?.smart?.payload?.sentiment || data?.sentiment || null;
  const smartSummary = String(teamState?.smart?.payload?.summary || "").trim();
  const smartTakeaway = String(teamState?.smart?.payload?.takeaway || "").trim();
  const brainInsight = teamState?.brain?.payload || null;
  const smartStatus = String(teamState?.smart?.status || "").trim().toLowerCase();
  const brainStatus = String(teamState?.brain?.status || "").trim().toLowerCase();
  const overallReady = Boolean(teamState?.ready);

  useEffect(() => {
    if (!data?.onboardingFlow) {
      return;
    }

    Animated.parallel([
      Animated.timing(celebrationOpacity, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.spring(celebrationTranslateY, {
        toValue: 0,
        damping: 16,
        stiffness: 170,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [celebrationOpacity, celebrationTranslateY, data?.onboardingFlow]);

  useEffect(() => {
    aiOpacity.setValue(0);
    aiTranslateY.setValue(22);
    setTypedAiComment("");

    if (!fullAiComment) {
      setAiPhase("hidden");
      return;
    }

    setAiPhase("thinking");

    let typingInterval: ReturnType<typeof setInterval> | null = null;
    const revealTimer = setTimeout(() => {
      setAiPhase("revealed");

      Animated.parallel([
        Animated.timing(aiOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(aiTranslateY, {
          toValue: 0,
          damping: 17,
          stiffness: 180,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();

      let index = 0;
      typingInterval = setInterval(() => {
        index += 1;
        setTypedAiComment(fullAiComment.slice(0, index));

        if (index >= fullAiComment.length && typingInterval) {
          clearInterval(typingInterval);
          typingInterval = null;
        }
      }, AI_TYPING_MS);
    }, AI_REVEAL_DELAY_MS);

    return () => {
      clearTimeout(revealTimer);
      if (typingInterval) {
        clearInterval(typingInterval);
      }
    };
  }, [aiOpacity, aiTranslateY, fullAiComment]);

  useEffect(() => {
    if (!answerId) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    const loadTeam = async () => {
      try {
        const response = await fetch(getApiUrl(API_CONFIG.endpoints.answerAiTeam(answerId)));
        if (!response.ok || cancelled) {
          return;
        }

        const payload = await response.json();
        if (cancelled) {
          return;
        }

        setTeamState(payload);

        const smartDone = ["completed", "failed"].includes(
          String(payload?.smart?.status || "").toLowerCase()
        );
        const brainDone = ["completed", "failed"].includes(
          String(payload?.brain?.status || "").toLowerCase()
        );

        if (!smartDone || !brainDone) {
          attempts += 1;
          if (attempts < 20) {
            timer = setTimeout(() => {
              void loadTeam();
            }, 2500);
          }
        }
      } catch (error) {
        attempts += 1;
        if (!cancelled && attempts < 10) {
          timer = setTimeout(() => {
            void loadTeam();
          }, 2800);
        }
      }
    };

    void loadTeam();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [answerId]);

  const handleVideoExport = async () => {
    const question = String(data?.question || "").trim();
    const answer = String(data?.answer || "").trim();

    if (!question || !answer || exportingVideo) {
      return;
    }

    try {
      setExportingVideo(true);
      setVideoStatus("Po renderohet MP4 vertikale...");

      const exportedVideo = await exportAnswerVideo({
        answer,
        aiComment: fullAiComment || undefined,
        question,
        seconds: Number(data?.seconds || 5),
      });

      setVideoStatus("Video u gjenerua. Po hap share sheet...");

      await shareExportedVideo({
        message: `${Number(data?.seconds || 5).toFixed(1)}s answer on 5Second.app`,
        title: "5Second.app video",
        videoUrl: exportedVideo.url,
      });

      setVideoStatus("Video ready per share.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Video export failed";
      setVideoStatus(message);
    } finally {
      setExportingVideo(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>SHARE CARDS</Text>
          <Text style={styles.title}>Your answer now has an AI reaction loop.</Text>
          <Text style={styles.subtitle}>
            Keep the suspense for a beat, then turn the answer into something worth sharing.
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        {data?.onboardingFlow ? (
          <Animated.View
            style={[
              styles.liveCard,
              {
                opacity: celebrationOpacity,
                transform: [{ translateY: celebrationTranslateY }],
              },
            ]}
          >
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>YOUR FIRST ANSWER IS LIVE</Text>
            </View>
            <Text style={styles.liveTitle}>
              {Number(data?.onboardingBoost?.likes || 0)} likes are warming up your first post.
            </Text>
            <Text style={styles.liveMeta}>
              Streak: day {Number(data?.streakCurrent || 1)}
              {data?.interestLabel ? ` | Vibe: ${data.interestLabel}` : ""}
            </Text>
          </Animated.View>
        ) : null}

        {fullAiComment && aiPhase === "thinking" ? (
          <View style={styles.thinkingCard}>
            <Text style={styles.thinkingChip}>AI THINKING</Text>
            <Text style={styles.thinkingTitle}>🤖 po mendon...</Text>
            <Text style={styles.thinkingText}>
              Po gatuan reagimin qe do ta beje kete answer te ndihet si event, jo thjesht postim.
            </Text>
          </View>
        ) : null}

        {fullAiComment && aiPhase === "revealed" ? (
          <Animated.View
            style={[
              styles.aiCard,
              {
                borderColor: `${aiTheme.accent}66`,
                opacity: aiOpacity,
                transform: [{ translateY: aiTranslateY }],
              },
            ]}
          >
            <View style={styles.aiTopRow}>
              <View style={[styles.aiChip, { backgroundColor: `${aiTheme.accent}22` }]}>
                <Text style={[styles.aiChipText, { color: aiTheme.accent }]}>{aiTheme.chip}</Text>
              </View>
              <Text style={styles.aiCharacter}>{aiEmoji}</Text>
            </View>

            <Text style={styles.aiTitle}>{aiTheme.label}</Text>
            <Text style={styles.aiQuote}>
              {typedAiComment}
              {typedAiComment.length < fullAiComment.length ? <Text style={styles.aiCursor}>|</Text> : null}
            </Text>

            {displaySentiment ? (
              <View style={styles.aiStatsRow}>
                <View style={styles.aiStatPill}>
                  <Text style={styles.aiStatLabel}>Emotion</Text>
                  <Text style={styles.aiStatValue}>{String(displaySentiment.emotion || "neutral")}</Text>
                </View>
                <View style={styles.aiStatPill}>
                  <Text style={styles.aiStatLabel}>Intensity</Text>
                  <Text style={styles.aiStatValue}>{formatPercent(displaySentiment.intensity)}</Text>
                </View>
                <View style={styles.aiStatPill}>
                  <Text style={styles.aiStatLabel}>Debate</Text>
                  <Text style={styles.aiStatValue}>{formatPercent(displaySentiment.debate_score)}</Text>
                </View>
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        {answerId ? (
          <View style={styles.teamCard}>
            <Text style={styles.teamEyebrow}>AI TEAM FLOW</Text>
            <Text style={styles.teamStateLine}>
              {overallReady ? "All AI layers are ready for testing." : "AI layers are still cooking in background."}
            </Text>
            <View style={styles.teamRow}>
              <View style={styles.teamPill}>
                <Text style={styles.teamLabel}>FAST</Text>
                <Text style={styles.teamValue}>Groq done</Text>
              </View>
              <View style={styles.teamPill}>
                <Text style={styles.teamLabel}>SMART</Text>
                <Text style={styles.teamValue}>
                  {smartStatus === "completed"
                    ? "Mixtral ready"
                    : smartStatus === "failed"
                      ? "Mixtral failed"
                      : "Mixtral running"}
                </Text>
              </View>
              <View style={styles.teamPill}>
                <Text style={styles.teamLabel}>BRAIN</Text>
                <Text style={styles.teamValue}>
                  {brainStatus === "completed"
                    ? "Nemotron ready"
                    : brainStatus === "failed"
                      ? "Nemotron failed"
                      : "Nemotron running"}
                </Text>
              </View>
            </View>

            {smartSummary ? (
              <View style={styles.teamInsightBox}>
                <Text style={styles.teamInsightTitle}>SMART TAKEAWAY</Text>
                <Text style={styles.teamInsightText}>{smartSummary}</Text>
                {smartTakeaway ? (
                  <Text style={styles.teamInsightMeta}>{smartTakeaway}</Text>
                ) : null}
              </View>
            ) : smartStatus === "pending" ? (
              <Text style={styles.teamPendingText}>
                Mixtral po përpunon summary dhe sentiment në background.
              </Text>
            ) : null}

            {brainInsight ? (
              <View style={styles.teamInsightBox}>
                <Text style={styles.teamInsightTitle}>BRAIN INSIGHT</Text>
                <Text style={styles.teamInsightText}>{String(brainInsight.summary || "")}</Text>
                <View style={styles.aiStatsRow}>
                  <View style={styles.aiStatPill}>
                    <Text style={styles.aiStatLabel}>Risk</Text>
                    <Text style={styles.aiStatValue}>{String(brainInsight.risk_level || "medium")}</Text>
                  </View>
                  <View style={styles.aiStatPill}>
                    <Text style={styles.aiStatLabel}>Confidence</Text>
                    <Text style={styles.aiStatValue}>{formatPercent(brainInsight.confidence)}</Text>
                  </View>
                </View>
                {brainInsight.next_step ? (
                  <Text style={styles.teamInsightMeta}>Next: {String(brainInsight.next_step)}</Text>
                ) : null}
              </View>
            ) : brainStatus === "pending" ? (
              <Text style={styles.teamPendingText}>
                Nemotron po bën analizën e thellë për risk dhe insight.
              </Text>
            ) : null}
          </View>
        ) : null}

        {Array.isArray(data?.newBadges) && data.newBadges.length ? (
          <View style={styles.badgesCard}>
            <Text style={styles.badgesEyebrow}>UNLOCKED NOW</Text>
            <View style={styles.badgesRow}>
              {data.newBadges.map((badge: any) => (
                <View key={badge.id || badge.name} style={styles.badgePill}>
                  <Text style={styles.badgeEmoji}>{badge.emoji || "Badge"}</Text>
                  <Text style={styles.badgeName}>{badge.name || "New badge"}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <ShareSelector
          type={type}
          data={{
            ...data,
            aiComment: data?.aiComment || null,
            aiCommentEmoji: aiEmoji,
          }}
        />

        {type === "answer" ? (
          <View style={styles.videoExportCard}>
            <View style={styles.videoExportCopy}>
              <Text style={styles.videoExportEyebrow}>DEDICATED VIDEO EXPORT</Text>
              <Text style={styles.videoExportTitle}>Ktheje answer-in ne MP4 vertical per story dhe reel.</Text>
              <Text style={styles.videoExportText}>
                Layout-i perfshin pyetjen, pergjigjen, AI reaction dhe speed mode branding te 5Second.app.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.videoExportButton, exportingVideo && styles.videoExportButtonDisabled]}
              disabled={exportingVideo}
              onPress={() => void handleVideoExport()}
            >
              {exportingVideo ? <ActivityIndicator color={colors.text} /> : null}
              <Text style={styles.videoExportButtonText}>
                {exportingVideo ? "Po eksportohet..." : "Eksporto video MP4"}
              </Text>
            </TouchableOpacity>

            {videoStatus ? <Text style={styles.videoExportStatus}>{videoStatus}</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 20,
  },
  glowTop: {
    position: "absolute",
    top: -120,
    left: -30,
    right: -30,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255,77,77,0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
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
  subtitle: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  liveCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#170E0A",
    borderWidth: 1,
    borderColor: "rgba(255,138,0,0.24)",
  },
  livePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,77,77,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.36)",
  },
  livePillText: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  liveTitle: {
    marginTop: 14,
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  liveMeta: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  thinkingCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  thinkingChip: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  thinkingTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  thinkingText: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  aiCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#0F1015",
    borderWidth: 1,
  },
  aiTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  aiChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  aiChipText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  aiCharacter: {
    fontSize: 22,
  },
  aiTitle: {
    marginTop: 14,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  aiQuote: {
    marginTop: 10,
    color: colors.soft,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
  },
  aiCursor: {
    color: colors.accentWarm,
  },
  aiStatsRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  aiStatPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  aiStatLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  aiStatValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  teamCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#12111A",
    borderWidth: 1,
    borderColor: "rgba(124,108,255,0.22)",
  },
  teamEyebrow: {
    color: "#7C6CFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  teamStateLine: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  teamRow: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  teamPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  teamLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  teamValue: {
    marginTop: 4,
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  teamInsightBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  teamInsightTitle: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  teamInsightText: {
    marginTop: 8,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  teamInsightMeta: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  teamPendingText: {
    marginTop: 14,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  badgesCard: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  badgesEyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  badgesRow: {
    marginTop: 12,
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
  badgeName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  videoExportCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#130E10",
    borderWidth: 1,
    borderColor: "rgba(255,77,77,0.24)",
  },
  videoExportCopy: {
    gap: 8,
  },
  videoExportEyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  videoExportTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  videoExportText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  videoExportButton: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#FF4D4D",
  },
  videoExportButtonDisabled: {
    opacity: 0.72,
  },
  videoExportButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  videoExportStatus: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
});
