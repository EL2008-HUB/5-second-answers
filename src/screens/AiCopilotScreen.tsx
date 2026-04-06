import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { API_CONFIG, getApiUrl } from "../config/api";
import { colors, MVP_USER_ID, readJsonSafely } from "../theme/mvp";

type AssistantAction = {
  id: string;
  label: string;
  target: string;
};

type FeatureGuide = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  suggestedActions?: AssistantAction[];
};

type AssistantPayload = {
  featureGuide?: FeatureGuide | null;
  featureId?: string | null;
  reply?: string | null;
  suggestedActions?: AssistantAction[];
};

type MonitorPayload = {
  status?: string;
  alerts?: { level: string; area: string; message: string }[];
  recommendations?: { type: string; message: string }[];
  metrics?: {
    pendingAnswers?: number;
    pendingDuets?: number;
    hasLiveHotQuestion?: boolean;
  };
};

type ExecutionIdea = {
  id: string;
  title: string;
  idea: string;
  build_steps: string[];
  viral_angle: string;
  monetization: string;
  first_step: string;
  difficulty: "easy" | "medium" | "hard";
};

type ExecutionPayload = {
  summary?: string;
  ideas?: ExecutionIdea[];
  langCode?: string;
};

type SelfImprovementTask = {
  taskType: string;
  totalEvents: number;
  positiveRate: number;
  hints?: string[];
  positiveTags?: { tag: string; count: number }[];
};

type SelfImprovementPayload = {
  country?: string | null;
  days?: number;
  totalEvents?: number;
  positiveSignals?: number;
  negativeSignals?: number;
  rankingPolicy?: {
    debateWeight?: number;
    intensityWeight?: number;
    speedBias?: number;
    depthBias?: number;
  };
  tasks?: SelfImprovementTask[];
};

const QUICK_FEATURES = [
  { feature: "mirror", label: "Mirror" },
  { feature: "story_mode", label: "Story Mode" },
  { feature: "duet", label: "Duet" },
  { feature: "live_news", label: "LIVE News" },
  { feature: "hashtags", label: "Challenges" },
  { feature: "rooms", label: "Rooms" },
  { feature: "referral", label: "Referral" },
];

export default function AiCopilotScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [input, setInput] = useState("");
  const [loadingReply, setLoadingReply] = useState(false);
  const [loadingGuide, setLoadingGuide] = useState(false);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [loadingExecution, setLoadingExecution] = useState(false);
  const [loadingSelfImprovement, setLoadingSelfImprovement] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [assistant, setAssistant] = useState<AssistantPayload | null>(null);
  const [monitor, setMonitor] = useState<MonitorPayload | null>(null);
  const [executionPrompt, setExecutionPrompt] = useState("");
  const [execution, setExecution] = useState<ExecutionPayload | null>(null);
  const [selfImprovement, setSelfImprovement] = useState<SelfImprovementPayload | null>(null);
  const [error, setError] = useState("");
  const seededFeature = String(route.params?.feature || "mirror");
  const selectedCountry = String(route.params?.country || "AL").trim().toUpperCase();
  const queryHint = String(route.params?.queryHint || "").trim();

  useEffect(() => {
    if (queryHint) {
      setInput(queryHint);
      setExecutionPrompt(queryHint);
    }
    void loadFeatureGuide(seededFeature);
    void loadMonitor();
    void loadSelfImprovement();
  }, [queryHint, seededFeature, selectedCountry]);

  const runSuggestedAction = (action: AssistantAction) => {
    if (!action?.target) {
      return;
    }

    navigation.navigate(action.target);
  };

  const loadFeatureGuide = async (feature: string) => {
    try {
      setError("");
      setLoadingGuide(true);

      const response = await fetch(getApiUrl(API_CONFIG.endpoints.ai.featureGuide), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature }),
      });
      const data = (await readJsonSafely(response)) as FeatureGuide | null;

      if (!response.ok || !data) {
        throw new Error("Failed to load feature guide");
      }

      setAssistant({
        featureGuide: data,
        featureId: data.id,
        reply: data.summary,
        suggestedActions: data.suggestedActions || [],
      });
    } catch (loadError) {
      console.error("AI guide load error:", loadError);
      setError("AI guide nuk u ngarkua.");
    } finally {
      setLoadingGuide(false);
    }
  };

  const loadMonitor = async () => {
    try {
      setLoadingMonitor(true);
      const response = await fetch(
        `${getApiUrl(API_CONFIG.endpoints.ai.monitor)}?requestedBy=${encodeURIComponent(MVP_USER_ID)}`
      );
      const data = (await readJsonSafely(response)) as MonitorPayload | null;

      if (!response.ok || !data) {
        throw new Error("Failed to load monitor");
      }

      setMonitor(data);
    } catch (monitorError) {
      console.error("AI monitor load error:", monitorError);
    } finally {
      setLoadingMonitor(false);
    }
  };

  const loadSelfImprovement = async () => {
    try {
      setLoadingSelfImprovement(true);
      const response = await fetch(
        `${getApiUrl(API_CONFIG.endpoints.ai.selfImprovement)}?country=${encodeURIComponent(
          selectedCountry
        )}&days=14`
      );
      const data = (await readJsonSafely(response)) as SelfImprovementPayload | null;

      if (!response.ok || !data) {
        throw new Error("Failed to load self improvement");
      }

      setSelfImprovement(data);
    } catch (selfImprovementError) {
      console.error("AI self improvement load error:", selfImprovementError);
    } finally {
      setLoadingSelfImprovement(false);
    }
  };

  const askAi = async () => {
    if (!input.trim()) {
      return;
    }

    try {
      setError("");
      setLoadingReply(true);
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.ai.assistant), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: input.trim(),
          userId: MVP_USER_ID,
          context: {
            langCode: "sq",
          },
        }),
      });
      const data = (await readJsonSafely(response)) as AssistantPayload | null;

      if (!response.ok || !data) {
        throw new Error("Failed to ask AI");
      }

      setAssistant(data);
    } catch (askError) {
      console.error("Ask AI error:", askError);
      setError("AI nuk u pergjigj dot tani.");
    } finally {
      setLoadingReply(false);
    }
  };

  const runExecutionEngine = async () => {
    if (!executionPrompt.trim()) {
      return;
    }

    try {
      setError("");
      setLoadingExecution(true);
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.ai.ideaExecutionEngine), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: executionPrompt.trim(),
          country: selectedCountry,
          langCode: "sq",
          limit: 3,
        }),
      });
      const data = (await readJsonSafely(response)) as ExecutionPayload | null;

      if (!response.ok || !data) {
        throw new Error("Failed to build execution plan");
      }

      setExecution(data);
    } catch (executionError) {
      console.error("Execution engine error:", executionError);
      setError("Execution engine nuk u ngarkua dot tani.");
    } finally {
      setLoadingExecution(false);
    }
  };

  const submitFeedback = async (signal: string, tags: string[]) => {
    try {
      setFeedbackBusy(true);
      await fetch(getApiUrl(API_CONFIG.endpoints.ai.feedback), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: "assistant",
          signal,
          sourceType: "copilot_ui",
          sourceId: assistant?.featureId || "assistant_reply",
          country: selectedCountry,
          langCode: "sq",
          tags,
          metadata: {
            reply: assistant?.reply || null,
          },
        }),
      });
      await loadSelfImprovement();
    } catch (feedbackError) {
      console.error("AI feedback submit error:", feedbackError);
    } finally {
      setFeedbackBusy(false);
    }
  };

  const openExecutionIdea = (idea: ExecutionIdea) => {
    navigation.navigate("CreateLab", {
      seedCategory: "business",
      seedIdea: {
        id: idea.id,
        title: idea.title,
        prompt: idea.idea,
        angle: `${idea.viral_angle}\n${idea.first_step}`,
        intent: "answer",
        categoryId: "business",
        source: "idea_execution_engine",
        metadata: {
          buildSteps: idea.build_steps,
          monetization: idea.monetization,
          difficulty: idea.difficulty,
          durationCap: 10,
        },
      },
    });
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
            <Text style={styles.eyebrow}>AI COPILOT</Text>
            <Text style={styles.title}>Pyet AI per app-in, feature-t dhe cfare te besh me pas.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Ask AI</Text>
          <Text style={styles.cardBody}>
            Pyet per Story Mode, Duet, LIVE news, hashtags, referral ose cfare duhet te provosh me pas.
          </Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Shembull: si funksionon duet?"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <View style={styles.quickRow}>
            {QUICK_FEATURES.map((item) => (
              <TouchableOpacity
                key={item.feature}
                style={styles.quickChip}
                onPress={() => void loadFeatureGuide(item.feature)}
              >
                <Text style={styles.quickChipText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void askAi()}>
            {loadingReply ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.primaryButtonText}>Ask AI</Text>
            )}
          </TouchableOpacity>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionRow}>
            <Text style={styles.cardTitle}>Idea + Execution Engine</Text>
            {loadingExecution ? <ActivityIndicator size="small" color={colors.accentWarm} /> : null}
          </View>
          <Text style={styles.cardBody}>
            Shkruaj nje intent si "dua ide per biznes" dhe AI te kthen ide, build steps dhe viral angle.
          </Text>
          <TextInput
            value={executionPrompt}
            onChangeText={setExecutionPrompt}
            placeholder="Shembull: dua ide per biznes me AI per SME"
            placeholderTextColor={colors.muted}
            style={styles.executionInput}
            multiline
          />
          <TouchableOpacity style={styles.primaryButton} onPress={() => void runExecutionEngine()}>
            {loadingExecution ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.primaryButtonText}>Build Plan</Text>
            )}
          </TouchableOpacity>

          {execution?.summary ? <Text style={styles.replyText}>{execution.summary}</Text> : null}

          {(execution?.ideas || []).map((idea) => (
            <View key={idea.id} style={styles.executionCard}>
              <View style={styles.executionHeader}>
                <Text style={styles.executionTitle}>{idea.title}</Text>
                <Text style={styles.executionDifficulty}>{idea.difficulty.toUpperCase()}</Text>
              </View>
              <Text style={styles.executionIdea}>{idea.idea}</Text>
              {idea.build_steps?.map((step, index) => (
                <Text key={`${idea.id}-step-${index}`} style={styles.executionStep}>
                  {index + 1}. {step}
                </Text>
              ))}
              <View style={styles.executionMetaBox}>
                <Text style={styles.executionMetaLabel}>Viral angle</Text>
                <Text style={styles.executionMetaText}>{idea.viral_angle}</Text>
              </View>
              <View style={styles.executionMetaBox}>
                <Text style={styles.executionMetaLabel}>Monetization</Text>
                <Text style={styles.executionMetaText}>{idea.monetization}</Text>
              </View>
              <View style={styles.executionMetaBox}>
                <Text style={styles.executionMetaLabel}>First step</Text>
                <Text style={styles.executionMetaText}>{idea.first_step}</Text>
              </View>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => openExecutionIdea(idea)}
              >
                <Text style={styles.secondaryButtonText}>Open In Create Lab</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionRow}>
            <Text style={styles.cardTitle}>AI Response</Text>
            {loadingGuide ? <ActivityIndicator size="small" color={colors.accentWarm} /> : null}
          </View>
          <Text style={styles.replyText}>{assistant?.reply || "Zgjidh nje feature ose bej nje pyetje."}</Text>

          {assistant?.featureGuide ? (
            <View style={styles.guideBox}>
              <Text style={styles.guideTitle}>{assistant.featureGuide.title}</Text>
              {assistant.featureGuide.steps?.map((step, index) => (
                <Text key={`${assistant.featureGuide?.id}-${index}`} style={styles.stepText}>
                  {index + 1}. {step}
                </Text>
              ))}
            </View>
          ) : null}

          {assistant?.suggestedActions?.length ? (
            <View style={styles.actionRow}>
              {assistant.suggestedActions.map((action) => (
                <TouchableOpacity
                  key={action.id}
                  style={styles.secondaryButton}
                  onPress={() => runSuggestedAction(action)}
                >
                  <Text style={styles.secondaryButtonText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={styles.feedbackRow}>
            <TouchableOpacity
              style={styles.feedbackChip}
              disabled={feedbackBusy}
              onPress={() => void submitFeedback("like", ["specific", "clear"])}
            >
              <Text style={styles.feedbackChipText}>Helpful</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.feedbackChip}
              disabled={feedbackBusy}
              onPress={() => void submitFeedback("dismiss", ["too_generic"])}
            >
              <Text style={styles.feedbackChipText}>Too Generic</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.feedbackChip}
              disabled={feedbackBusy}
              onPress={() => void submitFeedback("dismiss", ["too_robotic"])}
            >
              <Text style={styles.feedbackChipText}>Too Robotic</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionRow}>
            <Text style={styles.cardTitle}>AI Self-Improvement</Text>
            {loadingSelfImprovement ? (
              <ActivityIndicator size="small" color={colors.accentWarm} />
            ) : null}
          </View>
          <Text style={styles.cardBody}>
            Events: {selfImprovement?.totalEvents || 0} | Positive:{" "}
            {selfImprovement?.positiveSignals || 0} | Negative:{" "}
            {selfImprovement?.negativeSignals || 0}
          </Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Debate</Text>
              <Text style={styles.metricValue}>
                {Number(selfImprovement?.rankingPolicy?.debateWeight || 0).toFixed(3)}
              </Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Intensity</Text>
              <Text style={styles.metricValue}>
                {Number(selfImprovement?.rankingPolicy?.intensityWeight || 0).toFixed(3)}
              </Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Speed</Text>
              <Text style={styles.metricValue}>
                {Number(selfImprovement?.rankingPolicy?.speedBias || 0).toFixed(3)}
              </Text>
            </View>
          </View>
          {(selfImprovement?.tasks || []).map((task) => (
            <View key={task.taskType} style={styles.improvementTask}>
              <View style={styles.executionHeader}>
                <Text style={styles.executionTitle}>{task.taskType}</Text>
                <Text style={styles.executionDifficulty}>
                  {Math.round(Number(task.positiveRate || 0) * 100)}% POSITIVE
                </Text>
              </View>
              {(task.hints || []).map((hint, index) => (
                <Text key={`${task.taskType}-hint-${index}`} style={styles.executionStep}>
                  - {hint}
                </Text>
              ))}
              {!!task.positiveTags?.length ? (
                <Text style={styles.executionMetaText}>
                  Strong tags: {task.positiveTags.map((item) => item.tag).join(", ")}
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionRow}>
            <Text style={styles.cardTitle}>System Monitor</Text>
            {loadingMonitor ? <ActivityIndicator size="small" color={colors.accentWarm} /> : null}
          </View>
          <Text style={styles.monitorStatus}>
            Status: {(monitor?.status || "unknown").toUpperCase()}
          </Text>
          <Text style={styles.cardBody}>
            Pending answers: {monitor?.metrics?.pendingAnswers || 0} | Pending duets:{" "}
            {monitor?.metrics?.pendingDuets || 0} | LIVE active:{" "}
            {monitor?.metrics?.hasLiveHotQuestion ? "Po" : "Jo"}
          </Text>
          {(monitor?.alerts || []).map((alert, index) => (
            <View key={`${alert.area}-${index}`} style={styles.alertRow}>
              <Text style={styles.alertLevel}>{alert.level.toUpperCase()}</Text>
              <Text style={styles.alertText}>{alert.message}</Text>
            </View>
          ))}
          {(monitor?.recommendations || []).slice(0, 2).map((item, index) => (
            <Text key={`${item.type}-${index}`} style={styles.recommendationText}>
              - {item.message}
            </Text>
          ))}
        </View>
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
    right: -40,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(255,138,0,0.14)",
  },
  content: {
    padding: 20,
    paddingTop: 62,
    paddingBottom: 120,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
  },
  card: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    gap: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  cardBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  input: {
    minHeight: 108,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  executionInput: {
    minHeight: 84,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  quickChipText: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  errorText: {
    color: "#FF8585",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  replyText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  guideBox: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 8,
  },
  guideTitle: {
    color: colors.accentWarm,
    fontSize: 14,
    fontWeight: "800",
  },
  stepText: {
    color: colors.soft,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  feedbackRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  feedbackChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,138,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  feedbackChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  monitorStatus: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  alertRow: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 6,
  },
  alertLevel: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
  },
  alertText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  recommendationText: {
    color: colors.soft,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  executionCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 8,
  },
  executionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  executionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  executionDifficulty: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  executionIdea: {
    color: colors.soft,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  executionStep: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  executionMetaBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 4,
  },
  executionMetaLabel: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  executionMetaText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metricPill: {
    minWidth: 92,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 4,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  metricValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  improvementTask: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 8,
  },
});
