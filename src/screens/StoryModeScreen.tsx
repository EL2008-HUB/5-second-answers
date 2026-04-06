import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { API_CONFIG, getApiUrl } from "../config/api";
import { colors, MVP_USER_ID, readJsonSafely } from "../theme/mvp";

type StoryCategory = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  description: string;
};

type StoryQuestion = {
  id: string;
  question: string;
  orderIndex: number;
  lang?: string;
};

type StoryPack = {
  packId: string;
  title: string;
  description: string;
  category: string;
  langCode?: string;
  questions: StoryQuestion[];
};

type StoryAnswer = {
  questionId: string;
  question: string;
  answer: string;
  seconds: number;
  orderIndex: number;
};

type EmotionKey = "savage" | "funny" | "emotional" | "mysterious" | "chaotic";

type EmotionScore = {
  primary: EmotionKey;
  breakdown: Record<EmotionKey, number>;
  summary: string;
  badge: string;
  langCode?: string;
};

const STORY_CATEGORIES: StoryCategory[] = [
  {
    id: "confession",
    label: "Confession Session",
    emoji: "🕳️",
    color: "#171225",
    description: "5 pyetje qe nxjerrin gjerat qe zakonisht mbeten brenda.",
  },
  {
    id: "savage",
    label: "My Savage Side",
    emoji: "💀",
    color: "#230C12",
    description: "Pa filtër, pa diplomaci, vetem instinkt i paster.",
  },
  {
    id: "funny",
    label: "Humor i Zi",
    emoji: "😂",
    color: "#0D1B16",
    description: "Kur humori yt vendos si do lexohet e verteta.",
  },
  {
    id: "romantic",
    label: "Anet Romantike",
    emoji: "💕",
    color: "#20101D",
    description: "5 pyetje ku ndjenjat dalin para maskes.",
  },
];

const EMOTION_CONFIG: Record<
  EmotionKey,
  { color: string; bg: string; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  savage: {
    color: "#FF3B30",
    bg: "#1B0A0A",
    label: "I/E Eger",
    desc: "Direkt, i mprehte dhe pa nevoje per zbutje artificiale.",
    icon: "flame",
  },
  funny: {
    color: "#FF9500",
    bg: "#1E1406",
    label: "Qesharak/e",
    desc: "Humori del perpara, edhe kur pyetjet kerkojne tension.",
    icon: "happy",
  },
  emotional: {
    color: "#5856D6",
    bg: "#100B1D",
    label: "I/E Ndjeshem",
    desc: "Pergjigjet vijne nga ndjenja e vertete, jo nga performance.",
    icon: "heart",
  },
  mysterious: {
    color: "#30D158",
    bg: "#08170E",
    label: "Enigmatik/e",
    desc: "Ti le gjithmone dicka pezull. Pikerisht kjo te ben interesant.",
    icon: "moon",
  },
  chaotic: {
    color: "#FF2D55",
    bg: "#1D0912",
    label: "Kaotik/e",
    desc: "Instinkt i paparashikueshem. Pak rremuje, shume energji.",
    icon: "flash",
  },
};

const QUESTION_COUNT = 5;
const QUESTION_DURATION = 5;

const hasMeaningfulStoryAnswer = (value: string) => {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return false;
  }

  return normalized.replace(/[.\s?,_\-!?;:()[\]{}"']/g, "").length > 0;
};

function BreakdownBar({
  emotion,
  score,
  color,
  isTop,
}: {
  emotion: EmotionKey;
  score: number;
  color: string;
  isTop: boolean;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.max(0, Math.min(1, score)),
      duration: 750,
      delay: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score, widthAnim]);

  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, isTop && { color }]}>{EMOTION_CONFIG[emotion].label}</Text>
      <View style={styles.breakdownTrack}>
        <Animated.View
          style={[
            styles.breakdownFill,
            {
              backgroundColor: color,
              opacity: isTop ? 1 : 0.42,
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
      <Text style={[styles.breakdownPct, { color }]}>{Math.round(score * 100)}%</Text>
    </View>
  );
}

export default function StoryModeScreen() {
  const navigation = useNavigation<any>();
  const [phase, setPhase] = useState<"select" | "loading" | "question" | "result">("select");
  const [selectedCategory, setSelectedCategory] = useState<StoryCategory | null>(null);
  const [pack, setPack] = useState<StoryPack | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<StoryAnswer[]>([]);
  const [result, setResult] = useState<EmotionScore | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_DURATION);
  const [currentAnswer, setCurrentAnswer] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.72)).current;
  const resultFade = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answerRef = useRef("");
  const isSubmittingRef = useRef(false);
  const currentQuestion = pack?.questions?.[currentQ] || null;
  const progressDots = useMemo(() => Array.from({ length: QUESTION_COUNT }, (_, index) => index), []);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const animateQuestionIn = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const startQuestion = () => {
    clearTimer();
    isSubmittingRef.current = false;
    setCurrentAnswer("");
    answerRef.current = "";
    setTimeLeft(QUESTION_DURATION);
    animateQuestionIn();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          void submitCurrentAnswer();
          return 0;
        }

        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (phase !== "result") {
      return;
    }

    badgeScale.setValue(0.72);
    resultFade.setValue(0);

    Animated.parallel([
      Animated.spring(badgeScale, {
        toValue: 1,
        tension: 38,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(resultFade, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [badgeScale, phase, resultFade]);

  const selectCategory = async (category: StoryCategory) => {
    try {
      setSelectedCategory(category);
      setPhase("loading");

      const response = await fetch(
        `${getApiUrl(API_CONFIG.endpoints.story.pack(category.id))}?lang=sq`
      );
      const data = (await readJsonSafely(response)) as StoryPack | null;

      if (!response.ok || !data?.packId || !Array.isArray(data.questions) || data.questions.length < 5) {
        throw new Error("Story pack could not be loaded");
      }

      setPack(data);
      setCurrentQ(0);
      setAnswers([]);
      setResult(null);
      setPhase("question");
      startQuestion();
    } catch (error) {
      console.error("Story load error:", error);
      Alert.alert("Story Mode", "Story pack nuk u ngarkua. Provo perseri.");
      setPhase("select");
    }
  };

  const completeStory = async (allAnswers: StoryAnswer[]) => {
    try {
      const answeredCount = allAnswers.filter((entry) => hasMeaningfulStoryAnswer(entry.answer)).length;

      if (!answeredCount) {
        Alert.alert(
          "Story Mode",
          "Per nje rezultat real duhet te shkruash te pakten nje pergjigje."
        );
        setPhase("select");
        return;
      }

      setPhase("loading");

      const response = await fetch(getApiUrl(API_CONFIG.endpoints.story.complete), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: MVP_USER_ID,
          packId: pack?.packId,
          answers: allAnswers,
          langCode: pack?.langCode || "sq",
        }),
      });

      const data = (await readJsonSafely(response)) as
        | { emotionScore?: EmotionScore; error?: string }
        | null;

      if (!response.ok || !data?.emotionScore) {
        throw new Error(data?.error || "Story result failed");
      }

      setResult(data.emotionScore);
      setPhase("result");
    } catch (error) {
      console.error("Story complete error:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Rezultati nuk u gjenerua. Provo perseri.";
      Alert.alert("Story Mode", message);
      setPhase("select");
    }
  };

  const submitCurrentAnswer = async () => {
    if (!pack || !currentQuestion || isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    clearTimer();

    const secondsSpent = Math.max(0, QUESTION_DURATION - timeLeft);
    const nextAnswer: StoryAnswer = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      answer: answerRef.current.trim(),
      seconds: Math.max(1, secondsSpent),
      orderIndex: currentQ + 1,
    };

    const allAnswers = [...answers, nextAnswer];
    setAnswers(allAnswers);

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      if (currentQ < QUESTION_COUNT - 1) {
        setCurrentQ((prev) => prev + 1);
        startQuestion();
        return;
      }

      void completeStory(allAnswers);
    });
  };

  const retryStory = () => {
    clearTimer();
    setPhase("select");
    setSelectedCategory(null);
    setPack(null);
    setCurrentQ(0);
    setAnswers([]);
    setResult(null);
    setCurrentAnswer("");
    answerRef.current = "";
    setTimeLeft(QUESTION_DURATION);
  };

  const shareResult = async () => {
    if (!result) {
      return;
    }

    navigation.navigate("Share", {
      type: "emotion",
      data: {
        answer: answers[0]?.answer || "",
        badge: result.badge,
        breakdown: result.breakdown,
        primary: result.primary,
        question: answers[0]?.question || "",
        seconds: answers[0]?.seconds || 5,
        summary: result.summary,
      },
    });
  };

  const goBackHome = () => {
    navigation.navigate("Home");
  };

  if (phase === "select") {
    return (
      <View style={styles.screen}>
        <View style={styles.glowTop} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backRow} onPress={goBackHome}>
            <Ionicons name="arrow-back" size={18} color={colors.soft} />
            <Text style={styles.backText}>Back to Home</Text>
          </TouchableOpacity>

          <Text style={styles.heroEyebrow}>STORY MODE</Text>
          <Text style={styles.heroTitle}>5 pyetje. 5 sekonda secila. 1 rezultat qe te lexon.</Text>
          <Text style={styles.heroSubtitle}>
            Pergjigjet individuale mbeten te tuat. Ajo qe ndahet eshte profili emocional i
            momentit.
          </Text>

          {STORY_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryCard, { backgroundColor: category.color }]}
              onPress={() => void selectCategory(category)}
            >
              <View style={styles.categoryLeft}>
                <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                <View style={styles.categoryCopy}>
                  <Text style={styles.categoryTitle}>{category.label}</Text>
                  <Text style={styles.categoryDescription}>{category.description}</Text>
                </View>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.soft} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (phase === "loading") {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingOrb} />
        <ActivityIndicator size="small" color={colors.accentWarm} />
        <Text style={styles.loadingTitle}>Duke pergatitur Story Mode...</Text>
        <Text style={styles.loadingSubtitle}>
          AI po zgjedh ritmin, pack-u po ngarkohet dhe fundi do te dale share-ready.
        </Text>
      </View>
    );
  }

  if (phase === "question" && pack && currentQuestion) {
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
        <Animated.View
          style={[
            styles.questionWrap,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [28, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity style={styles.backRow} onPress={retryStory}>
            <Ionicons name="close" size={18} color={colors.soft} />
            <Text style={styles.backText}>Exit Story Mode</Text>
          </TouchableOpacity>

          <View style={styles.progressRow}>
            {progressDots.map((index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index < currentQ && styles.progressDotDone,
                  index === currentQ && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          <Text style={styles.packTitle}>{pack.title}</Text>
          <Text style={styles.questionCounter}>
            Pyetja {currentQ + 1}/{QUESTION_COUNT}
          </Text>
          <Text style={[styles.timer, timeLeft <= 2 && styles.timerUrgent]}>{timeLeft}</Text>
          <Text style={styles.questionPrompt}>{currentQuestion.question}</Text>

          <TextInput
            style={styles.answerInput}
            value={currentAnswer}
            onChangeText={(value) => {
              setCurrentAnswer(value);
              answerRef.current = value;
            }}
            placeholder="Shkruaj tani..."
            placeholderTextColor="rgba(255,255,255,0.22)"
            autoFocus
            multiline
            maxLength={120}
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => {
              void submitCurrentAnswer();
            }}
          />

          <Text style={styles.questionHint}>
            Timeri e dergon vetem. Nese e ke gati me heret, shtyp vazhdo.
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={() => void submitCurrentAnswer()}>
            <View style={styles.primaryGlow} />
            <Text style={styles.primaryButtonText}>
              {currentQ === QUESTION_COUNT - 1 ? "Shiko rezultatin" : "Pyetja tjeter"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    );
  }

  if (!result || !selectedCategory) {
    return null;
  }

  const config = EMOTION_CONFIG[result.primary];
  const sortedBreakdown = (Object.entries(result.breakdown) as [EmotionKey, number][])
    .sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backRow} onPress={retryStory}>
          <Ionicons name="refresh" size={18} color={colors.soft} />
          <Text style={styles.backText}>Run another Story</Text>
        </TouchableOpacity>

        <Animated.View
          style={[
            styles.resultCard,
            {
              backgroundColor: config.bg,
              opacity: resultFade,
              transform: [{ translateY: resultFade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.badgeCircle,
              {
                borderColor: config.color,
                transform: [{ scale: badgeScale }],
              },
            ]}
          >
            <Ionicons name={config.icon} size={28} color={config.color} />
            <Text style={[styles.badgeText, { color: config.color }]}>{result.badge}</Text>
          </Animated.View>

          <Text style={[styles.resultPrimary, { color: config.color }]}>{config.label}</Text>
          <Text style={styles.resultDesc}>{config.desc}</Text>
          <Text style={styles.resultSummary}>"{result.summary}"</Text>

          <View style={styles.breakdownCard}>
            {sortedBreakdown.map(([emotion, score]) => (
              <BreakdownBar
                key={emotion}
                emotion={emotion}
                score={score}
                color={EMOTION_CONFIG[emotion].color}
                isTop={emotion === result.primary}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: config.color }]}
            onPress={() => void shareResult()}
          >
            <Text style={styles.shareButtonText}>Ndaj rezultatin</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={retryStory}>
            <Text style={styles.secondaryButtonText}>Provo sesion tjeter</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 40,
  },
  glowTop: {
    position: "absolute",
    top: -140,
    left: -40,
    right: -40,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(255,77,77,0.10)",
  },
  glowBottom: {
    position: "absolute",
    right: -80,
    bottom: 120,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255,138,0,0.09)",
  },
  backRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  backText: {
    color: colors.soft,
    fontSize: 13,
    fontWeight: "700",
  },
  heroEyebrow: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  heroTitle: {
    marginTop: 12,
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
  },
  heroSubtitle: {
    marginTop: 12,
    marginBottom: 24,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  categoryCard: {
    marginBottom: 14,
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  categoryEmoji: {
    fontSize: 26,
  },
  categoryCopy: {
    flex: 1,
  },
  categoryTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  categoryDescription: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loadingOrb: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255,77,77,0.10)",
  },
  loadingTitle: {
    marginTop: 18,
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  loadingSubtitle: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    fontWeight: "600",
  },
  questionWrap: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  progressRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  progressDot: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.track,
  },
  progressDotDone: {
    backgroundColor: "rgba(255,138,0,0.48)",
  },
  progressDotActive: {
    backgroundColor: colors.accent,
  },
  packTitle: {
    color: colors.soft,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  questionCounter: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  timer: {
    marginTop: 28,
    color: colors.text,
    fontSize: 78,
    fontWeight: "900",
    lineHeight: 86,
  },
  timerUrgent: {
    color: colors.accent,
  },
  questionPrompt: {
    marginTop: 12,
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  answerInput: {
    minHeight: 146,
    marginTop: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    textAlignVertical: "top",
    fontWeight: "600",
  },
  questionHint: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: "auto",
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  primaryGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,138,0,0.28)",
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  resultContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 56,
  },
  resultCard: {
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  badgeCircle: {
    alignSelf: "center",
    minWidth: 170,
    minHeight: 170,
    borderRadius: 170,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 10,
  },
  badgeText: {
    textAlign: "center",
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  resultPrimary: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 30,
    fontWeight: "900",
  },
  resultDesc: {
    marginTop: 10,
    color: colors.soft,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  resultSummary: {
    marginTop: 16,
    color: colors.text,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
  },
  breakdownCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 12,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  breakdownLabel: {
    width: 104,
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  breakdownTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: 999,
  },
  breakdownPct: {
    width: 42,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
  },
  shareButton: {
    marginTop: 24,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButtonText: {
    color: "#0B0B0F",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    marginTop: 12,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
});
