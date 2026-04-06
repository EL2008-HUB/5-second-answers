import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { VideoView, useVideoPlayer } from "expo-video";
import ViewShot from "react-native-view-shot";

import { API_CONFIG, getApiUrl } from "../config/api";
import FloatingAiEntry from "../components/FloatingAiEntry";
import { getSelectedCountry } from "../services/countryService";
import { completeFirstAnswerOnboarding } from "../services/onboardingService";
import { colors, MVP_USER_ID, readJsonSafely } from "../theme/mvp";

type MirrorQuestion = {
  id: string;
  text: string;
  category: string;
  country?: string;
};

type SavedAnswer = {
  id: string;
  questionId: string;
  type: "video" | "audio" | "text";
  text?: string | null;
  contentUrl?: string | null;
  aiComment?: string | null;
  aiCommentMeta?: {
    comment?: string;
    emoji?: string;
    style?: "funny" | "savage" | "emotional";
    guardrail?: boolean;
    langCode?: string;
  } | null;
  hashtags?: string[];
  sentiment?: {
    emotion?: string | null;
    intensity?: number | null;
    debate_score?: number | null;
    relatability?: number | null;
  } | null;
  aiTeam?: {
    answerId?: string;
    fast?: { status?: string; provider?: string; role?: string };
    smart?: { status?: string; provider?: string; role?: string };
    brain?: { status?: string; provider?: string; role?: string };
  } | null;
  timeMode?: "5s" | "10s";
  responseTime?: number | null;
  penaltyApplied?: boolean;
  streak?: {
    current: number;
  };
  interactions?: {
    likes?: number;
    views?: number;
    shares?: number;
    saves?: number;
  };
  onboardingBoost?: {
    likes?: number;
    views?: number;
    shares?: number;
    saves?: number;
  } | null;
  newBadges?: Array<{
    id: string;
    name: string;
    emoji: string;
    unlockedAt?: string | null;
  }>;
};

type LocalMedia = {
  type: "video" | "audio";
  uri: string;
  duration: number;
};

const AUDIO_MODE = {
  playsInSilentMode: true,
  interruptionMode: "doNotMix" as const,
  allowsRecording: true,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
  allowsBackgroundRecording: false,
};

const DEFAULT_WINDOW = 5;

export default function MirrorScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const questionRetryCountRef = useRef(0);
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const player = useVideoPlayer(null, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });

  const audioStopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAudioDuration = useRef(DEFAULT_WINDOW);
  const onboardingAutoStartedQuestionId = useRef<string | null>(null);
  const shareAnswerOpacity = useRef(new Animated.Value(0)).current;
  const shareAnswerTranslateY = useRef(new Animated.Value(18)).current;
  const aiCommentOpacity = useRef(new Animated.Value(0)).current;
  const aiCommentTranslateY = useRef(new Animated.Value(26)).current;
  const actionCardAnimations = useRef(
    Array.from({ length: 7 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(22),
      scale: new Animated.Value(0.98),
    }))
  ).current;

  const [loading, setLoading] = useState(true);
  const [questionLoadError, setQuestionLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<
    "ready" | "capture" | "overtime" | "review" | "share" | "fail"
  >("ready");
  const [question, setQuestion] = useState<MirrorQuestion | null>(null);
  const [countdown, setCountdown] = useState(DEFAULT_WINDOW);
  const [selectedCountryCode, setSelectedCountryCode] = useState("AL");
  const [selectedMode, setSelectedMode] = useState<"audio" | "video" | "text" | null>(null);
  const [activeTimeMode, setActiveTimeMode] = useState<"5s" | "10s">("5s");
  const [usedExtraTime, setUsedExtraTime] = useState(false);
  const [roundStartedAt, setRoundStartedAt] = useState<number | null>(null);
  const [responseLockedAt, setResponseLockedAt] = useState<number | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [localMedia, setLocalMedia] = useState<LocalMedia | null>(null);
  const [saving, setSaving] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [savedAnswer, setSavedAnswer] = useState<SavedAnswer | null>(null);
  const [exportingScreenshot, setExportingScreenshot] = useState(false);
  const [copyingCaption, setCopyingCaption] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<ViewShot | null>(null);

  const hashtagContext = String(route.params?.hashtagContext || "")
    .trim()
    .replace(/^#+/, "");
  const onboardingInterestLabel = String(route.params?.onboardingInterestLabel || "").trim();
  const onboardingFlow = Boolean(route.params?.onboardingFlow);

  const getAnswerPreview = (answer: SavedAnswer | null = savedAnswer) => {
    const text = answer?.text?.trim();
    if (text) {
      return text;
    }

    const answerType = answer?.type || localMedia?.type || selectedMode || "text";

    if (answerType === "audio") {
      return "Audio answer";
    }

    if (answerType === "video") {
      return "Video answer";
    }

    return "Fast answer";
  };

  const buildShareCaption = () => {
    const responseTime = (savedAnswer?.responseTime || calculateResponseTime()).toFixed(1);
    const primaryHashtag = hashtagContext ? `#${hashtagContext}` : "#5SecondAnswer";
    const hashtags = [
      primaryHashtag,
      primaryHashtag.toLowerCase() === "#5secondanswer" ? null : "#5SecondAnswer",
      (savedAnswer?.timeMode || activeTimeMode) === "5s" ? "#5SecondChallenge" : "#SlowBadge",
    ].filter(Boolean);

    const answerPreview = getAnswerPreview(savedAnswer)
      ? `\n"${getAnswerPreview(savedAnswer)}"`
      : "";

    return [
      `5 second answer. ${responseTime}s.${answerPreview}`,
      question?.text ? `Pyetja: ${question.text}` : null,
      hashtags.join(" "),
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const openDuetScreen = (duet: { sessionId: string }) => {
    navigation.navigate("Duet", {
      initialDuet: duet,
      refreshKey: Date.now(),
      sessionId: duet.sessionId,
    });
  };

  const submitDuetRequest = async (endpoint: string, body: Record<string, unknown>) => {
    const response = await fetch(getApiUrl(endpoint), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = (await readJsonSafely(response)) as
      | { duet?: { sessionId: string }; error?: string }
      | null;

    if (!response.ok || !data?.duet?.sessionId) {
      throw new Error(data?.error || "Failed to create duet");
    }

    openDuetScreen(data.duet);
    return true;
  };

  const handlePostSaveDuetFlow = async (answer: SavedAnswer) => {
    const duetSessionId = String(route.params?.duetSessionId || "");
    const answerPreview = getAnswerPreview(answer);
    const responseTime = answer.responseTime || calculateResponseTime();

    if (duetSessionId) {
      await submitDuetRequest(API_CONFIG.endpoints.duets.respond(duetSessionId), {
        answer: answerPreview,
        answerId: answer.id,
        seconds: responseTime,
        userId: MVP_USER_ID,
      });
      return true;
    }

    if (route.params?.mode === "expose" && route.params?.opponentUserId) {
      await submitDuetRequest(API_CONFIG.endpoints.duets.expose, {
        answer: answerPreview,
        answerId: answer.id,
        opponentAnswer:
          String(route.params?.opponentAnswer || "").trim() || "Fast answer",
        opponentAnswerId: route.params?.opponentAnswerId || null,
        opponentSeconds: route.params?.opponentSeconds || 5,
        opponentUserId: route.params?.opponentUserId,
        questionId: question?.id || null,
        questionText: question?.text || route.params?.questionText || "",
        seconds: responseTime,
        userId: MVP_USER_ID,
      });
      return true;
    }

    return false;
  };

  const challengeFriend = () => {
    if (!savedAnswer?.id || !question?.id) {
      return;
    }

    navigation.navigate("FriendPicker", {
      answerId: savedAnswer.id,
      myAnswer: getAnswerPreview(savedAnswer),
      mySeconds: savedAnswer.responseTime || calculateResponseTime(),
      questionId: question.id,
      questionText: question.text,
    });
  };

  const compareWithRandom = async () => {
    if (!savedAnswer?.id || !question?.id) {
      return;
    }

    try {
      await submitDuetRequest(API_CONFIG.endpoints.duets.compareRandom, {
        answer: getAnswerPreview(savedAnswer),
        answerId: savedAnswer.id,
        questionId: question.id,
        questionText: question.text,
        seconds: savedAnswer.responseTime || calculateResponseTime(),
        userId: MVP_USER_ID,
      });
    } catch (error) {
      console.error("Random duet error:", error);
      Alert.alert("Duet", "Ende s'ka nje pergjigje tjeter per krahasim.");
    }
  };

  const shareToTikTok = async () => {
    if (!savedAnswer?.id) {
      return;
    }

    try {
      setSharing(true);

      const shareCaption = buildShareCaption();

      await fetch(getApiUrl(API_CONFIG.endpoints.answerInteract(savedAnswer.id)), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "share",
          userId: MVP_USER_ID,
        }),
      }).catch((error) => {
        console.error("Share tracking error:", error);
      });

      await Share.share({
        message: shareCaption,
        title: hashtagContext ? `Share with #${hashtagContext}` : "Share your 5 second answer",
      });
    } catch (error) {
      console.error("Mirror share error:", error);
      Alert.alert("Share", "Share nuk u krye dot kete here.");
    } finally {
      setSharing(false);
    }
  };

  const copyCaptionAndHashtags = async () => {
    try {
      setCopyingCaption(true);
      await Clipboard.setStringAsync(buildShareCaption());
      Alert.alert("Copied", "Caption dhe hashtag-et u kopjuan.");
    } catch (error) {
      console.error("Copy caption error:", error);
      Alert.alert("Copy", "Caption nuk u kopjua dot kete here.");
    } finally {
      setCopyingCaption(false);
    }
  };

  const exportShareScreenshot = async () => {
    if (!shareCardRef.current) {
      return;
    }

    try {
      setExportingScreenshot(true);
      const uri = await shareCardRef.current.capture?.();

      if (!uri) {
        throw new Error("Screenshot capture failed");
      }

      await Share.share({
        message: buildShareCaption(),
        title: hashtagContext ? `Screenshot for #${hashtagContext}` : "5 Second Answer screenshot",
        url: uri,
      });
    } catch (error) {
      console.error("Export screenshot error:", error);
      Alert.alert("Export", "Screenshot nuk u eksportua dot kete here.");
    } finally {
      setExportingScreenshot(false);
    }
  };

  const resetRoundState = () => {
    setStep("ready");
    setSelectedMode(null);
    setActiveTimeMode("5s");
    setUsedExtraTime(false);
    setRoundStartedAt(null);
    setResponseLockedAt(null);
    setTextAnswer("");
    setLocalMedia(null);
    setSavedAnswer(null);
    setCountdown(DEFAULT_WINDOW);
  };

  const loadQuestion = async () => {
    try {
      setLoading(true);
      setQuestionLoadError(null);
      resetRoundState();
      const activeCountry = String(route.params?.country || "").trim() || (await getSelectedCountry());
      setSelectedCountryCode(activeCountry);

      const routeQuestionId = route.params?.questionId as string | undefined;
      const routeQuestionText = route.params?.questionText as string | undefined;
      const routeCategory = route.params?.category as string | undefined;
      const preferredCategory = route.params?.preferredCategory as string | undefined;
      const routeQuestionFallback =
        routeQuestionId && routeQuestionText
          ? {
              id: routeQuestionId,
              text: routeQuestionText,
              category: routeCategory || "general",
              country: activeCountry,
            }
          : null;

      if (routeQuestionId && routeQuestionText) {
        setQuestion(routeQuestionFallback);
      }

      let sourceQuestion: MirrorQuestion | null = null;

      if (routeQuestionId) {
        try {
          const response = await fetch(
            `${getApiUrl(API_CONFIG.endpoints.questionById(routeQuestionId))}?userId=${MVP_USER_ID}&country=${encodeURIComponent(
              activeCountry
            )}`
          );
          const data = await readJsonSafely(response);

          if (response.ok) {
            sourceQuestion = data as MirrorQuestion;
          }
        } catch (error) {
          console.error("Mirror route question fallback error:", error);
        }

        if (!sourceQuestion?.id && routeQuestionFallback?.id) {
          sourceQuestion = routeQuestionFallback;
        }
      } else if (preferredCategory) {
        const categoryResponse = await fetch(
          `${getApiUrl(API_CONFIG.endpoints.questions)}?country=${encodeURIComponent(
            activeCountry
          )}&category=${encodeURIComponent(preferredCategory)}`
        );
        const categoryData = (await readJsonSafely(categoryResponse)) as MirrorQuestion[] | null;

        if (categoryResponse.ok && Array.isArray(categoryData) && categoryData.length) {
          sourceQuestion = categoryData[0];
        }
      }

      if (!sourceQuestion) {
        const response = await fetch(
          `${getApiUrl(API_CONFIG.endpoints.questionDaily)}?userId=${MVP_USER_ID}&country=${encodeURIComponent(
            activeCountry
          )}`
        );
        const data = await readJsonSafely(response);

        if (!response.ok) {
          throw new Error("Question load failed");
        }

        sourceQuestion = (data as { question?: MirrorQuestion })?.question || null;
      }

      if (!sourceQuestion?.id) {
        throw new Error("No question");
      }

      setQuestion({
        id: sourceQuestion.id,
        text: sourceQuestion.text,
        category: sourceQuestion.category,
        country: sourceQuestion.country || activeCountry,
      });
      questionRetryCountRef.current = 0;
    } catch (error) {
      console.error("Mirror load error:", error);
      setQuestion(null);
      setQuestionLoadError("Pyetja nuk u ngarkua.");
      questionRetryCountRef.current += 1;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQuestion();
  }, [route.params?.country, route.params?.questionId, route.params?.refreshKey]);

  useEffect(() => {
    if (loading || question?.id || questionRetryCountRef.current >= 2) {
      return;
    }

    const timer = setTimeout(() => {
      void loadQuestion();
    }, 1500);

    return () => clearTimeout(timer);
  }, [loading, question?.id, route.params?.country, route.params?.questionId, route.params?.refreshKey]);

  useEffect(() => {
    if (
      !route.params?.onboardingAutoStart ||
      !question?.id ||
      loading ||
      step !== "ready" ||
      onboardingAutoStartedQuestionId.current === question.id
    ) {
      return;
    }

    onboardingAutoStartedQuestionId.current = question.id;
    const timer = setTimeout(() => {
      startRound();
    }, 280);

    return () => clearTimeout(timer);
  }, [loading, question?.id, route.params?.onboardingAutoStart, step]);

  useEffect(() => {
    if (!localMedia?.uri || localMedia.type !== "video") {
      player.pause();
      return;
    }

    player.replace(localMedia.uri);
    player.play();
  }, [localMedia?.type, localMedia?.uri, player]);

  useEffect(() => {
    if (step !== "capture") {
      return;
    }

    if (countdown <= 0) {
      if (selectedMode === "audio" || selectedMode === "video") {
        return;
      }

      if (activeTimeMode === "5s" && !usedExtraTime) {
        setStep("overtime");
        return;
      }

      setStep("fail");
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeTimeMode, countdown, selectedMode, step, usedExtraTime]);

  useEffect(() => {
    if (!audioBusy || step !== "capture" || selectedMode !== "audio") {
      return;
    }

    if (!recorderState.isRecording && recorder.uri) {
      setLocalMedia({
        type: "audio",
        uri: recorder.uri,
        duration: pendingAudioDuration.current,
      });
      setAudioBusy(false);
      setStep("review");
    }
  }, [audioBusy, recorder, recorder.uri, recorderState.isRecording, selectedMode, step]);

  useEffect(() => {
    return () => {
      if (audioStopTimeout.current) {
        clearTimeout(audioStopTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const resetShareAnimations = () => {
      shareAnswerOpacity.setValue(0);
      shareAnswerTranslateY.setValue(18);
      aiCommentOpacity.setValue(0);
      aiCommentTranslateY.setValue(26);
      actionCardAnimations.forEach((animation) => {
        animation.opacity.setValue(0);
        animation.translateY.setValue(22);
        animation.scale.setValue(0.98);
      });
    };

    resetShareAnimations();

    if (step !== "share" || !savedAnswer) {
      return;
    }

    const answerIntro = Animated.parallel([
      Animated.timing(shareAnswerOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(shareAnswerTranslateY, {
        toValue: 0,
        damping: 17,
        stiffness: 180,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]);

    const aiIntro = savedAnswer.aiComment
      ? Animated.parallel([
          Animated.timing(aiCommentOpacity, {
            toValue: 1,
            duration: 240,
            delay: 300,
            useNativeDriver: true,
          }),
          Animated.timing(aiCommentTranslateY, {
            toValue: 0,
            duration: 260,
            delay: 300,
            useNativeDriver: true,
          }),
        ])
      : null;

    const actionIntros = actionCardAnimations.map((animation, index) =>
      Animated.parallel([
        Animated.timing(animation.opacity, {
          toValue: 1,
          duration: 220,
          delay: 900 + index * 200,
          useNativeDriver: true,
        }),
        Animated.timing(animation.translateY, {
          toValue: 0,
          duration: 240,
          delay: 900 + index * 200,
          useNativeDriver: true,
        }),
        Animated.timing(animation.scale, {
          toValue: 1,
          duration: 220,
          delay: 900 + index * 200,
          useNativeDriver: true,
        }),
      ])
    );

    const timeline = Animated.parallel(
      [answerIntro, aiIntro, ...actionIntros].filter(
        Boolean
      ) as Animated.CompositeAnimation[]
    );

    timeline.start();

    return () => {
      timeline.stop();
    };
  }, [
    actionCardAnimations,
    aiCommentOpacity,
    aiCommentTranslateY,
    savedAnswer,
    shareAnswerOpacity,
    shareAnswerTranslateY,
    step,
  ]);

  const lockResponseTime = () => {
    const timestamp = responseLockedAt || Date.now();
    if (!responseLockedAt) {
      setResponseLockedAt(timestamp);
    }
    return timestamp;
  };

  const calculateResponseTime = (lockedAtOverride?: number | null) => {
    if (!roundStartedAt) {
      return activeTimeMode === "10s" ? 10 : 5;
    }

    const endTime = lockedAtOverride || responseLockedAt || Date.now();
    const elapsedSeconds = Number(((endTime - roundStartedAt) / 1000).toFixed(1));
    return Math.max(0.1, Math.min(10, elapsedSeconds));
  };

  const startRound = () => {
    setStep("capture");
    setSelectedMode(null);
    setActiveTimeMode("5s");
    setUsedExtraTime(false);
    setRoundStartedAt(Date.now());
    setResponseLockedAt(null);
    setTextAnswer("");
    setLocalMedia(null);
    setSavedAnswer(null);
    setCountdown(DEFAULT_WINDOW);
  };

  const restartAsPro = () => {
    startRound();
  };

  const takeExtraTime = () => {
    setStep("capture");
    setActiveTimeMode("10s");
    setUsedExtraTime(true);
    setCountdown(DEFAULT_WINDOW);
  };

  const handleVideoCapture = async () => {
    const allowedDuration = Math.max(1, countdown);

    try {
      setSelectedMode("video");
      lockResponseTime();

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: allowedDuration,
      });

      if (result.canceled) {
        setSelectedMode(null);
        return;
      }

      const video = result.assets[0];
      setLocalMedia({
        type: "video",
        uri: video.uri,
        duration: Math.max(1, Math.round((video.duration || allowedDuration * 1000) / 1000)),
      });
      setStep("review");
    } catch (error) {
      console.error("Video capture error:", error);
      setSelectedMode(null);
      Alert.alert("Mirror", "Video capture failed.");
    }
  };

  const handleAudioCapture = async () => {
    const allowedDuration = Math.max(1, countdown);

    try {
      setSelectedMode("audio");
      lockResponseTime();
      pendingAudioDuration.current = allowedDuration;

      const permission = await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        throw new Error("Audio permission denied");
      }

      await setAudioModeAsync(AUDIO_MODE);
      await recorder.prepareToRecordAsync();
      recorder.record();
      setAudioBusy(true);

      if (audioStopTimeout.current) {
        clearTimeout(audioStopTimeout.current);
      }

      audioStopTimeout.current = setTimeout(async () => {
        try {
          await recorder.stop();
        } catch (error) {
          console.error("Audio stop error:", error);
          setAudioBusy(false);
          setSelectedMode(null);
        }
      }, allowedDuration * 1000);
    } catch (error) {
      console.error("Audio capture error:", error);
      setAudioBusy(false);
      setSelectedMode(null);
      Alert.alert("Mirror", "Audio capture is not available right now.");
    }
  };

  const uploadMedia = async (media: LocalMedia) => {
    const formData = new FormData();
    const field = media.type === "video" ? "video" : "audio";
    const name = media.type === "video" ? "mirror-answer.mp4" : "mirror-answer.m4a";
    const mimeType = media.type === "video" ? "video/mp4" : "audio/m4a";

    formData.append(field, {
      uri: media.uri,
      name,
      type: mimeType,
    } as any);

    const response = await fetch(getApiUrl(API_CONFIG.endpoints.upload), {
      method: "POST",
      body: formData,
      headers: Platform.OS === "web" ? undefined : { "Content-Type": "multipart/form-data" },
    });
    const data = (await readJsonSafely(response)) as { url?: string } | null;

    if (!response.ok || !data?.url) {
      throw new Error("Upload failed");
    }

    return data.url;
  };

  const saveAnswer = async (lockedAtOverride?: number | null) => {
    if (!question?.id) {
      return;
    }

    try {
      setSaving(true);
      let contentUrl: string | null = null;
      let answerType: "video" | "audio" | "text" = "text";
      let duration = DEFAULT_WINDOW;

      if (localMedia) {
        contentUrl = await uploadMedia(localMedia);
        answerType = localMedia.type;
        duration = localMedia.duration;
      }

      const response = await fetch(getApiUrl(API_CONFIG.endpoints.answers), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          countryContext: selectedCountryCode,
          questionId: question.id,
          userId: MVP_USER_ID,
          type: answerType,
          contentUrl,
          hashtagContext: route.params?.hashtagContext || null,
          text: answerType === "text" ? textAnswer.trim() : null,
          duration,
          timeMode: activeTimeMode,
          responseTime: calculateResponseTime(lockedAtOverride),
          penaltyApplied: usedExtraTime,
          seedInitialEngagement: onboardingFlow,
        }),
      });

      const data = (await readJsonSafely(response)) as SavedAnswer | null;

      if (!response.ok || !data?.id) {
        throw new Error("Save failed");
      }

      let duetHandled = false;
      try {
        duetHandled = await handlePostSaveDuetFlow(data);
      } catch (duetError) {
        console.error("Duet post-save flow error:", duetError);
        Alert.alert("Duet", "Pergjigjja u ruajt, por duet-i nuk u hap dot kete here.");
      }

      if (duetHandled) {
        return;
      }

      if (onboardingFlow) {
        await completeFirstAnswerOnboarding();
        navigation.setParams({
          onboardingAutoStart: false,
          onboardingFlow: false,
        });
      }

      setSavedAnswer(data);
      setStep("share");
        navigation.navigate("Share", {
          type: "answer",
          data: {
            answerId: data.id,
            answer: getAnswerPreview(data),
            aiComment: data.aiComment || null,
            aiCommentMeta: data.aiCommentMeta || null,
            aiTeam: data.aiTeam || null,
            emotion: question?.category || "default",
            hashtags: data.hashtags || [],
          interestLabel: onboardingInterestLabel || null,
          newBadges: data.newBadges || [],
          onboardingBoost: data.onboardingBoost || null,
          onboardingFlow,
          question: question?.text || "",
          seconds: data.responseTime || calculateResponseTime(lockedAtOverride),
          sentiment: data.sentiment || null,
          streakCurrent: data.streak?.current || 0,
        },
      });
    } catch (error) {
      console.error("Save answer error:", error);
      Alert.alert("Mirror", "Answer could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const submitTextAnswer = async () => {
    if (!textAnswer.trim()) {
      Alert.alert("Mirror", "Type a short answer first.");
      return;
    }

    const lockedAt = lockResponseTime();
    await saveAnswer(lockedAt);
  };

  const renderReady = () => (
    <View style={styles.centerPanel}>
      <Text style={styles.eyebrow}>MIRROR</Text>
      <Text style={styles.title}>Ke vetem 5 sekonda...</Text>
      <Text style={styles.question}>{question?.text || questionLoadError || "Loading question..."}</Text>
      {onboardingFlow && onboardingInterestLabel ? (
        <View style={styles.challengePill}>
          <Text style={styles.challengePillText}>Starting with {onboardingInterestLabel}</Text>
        </View>
      ) : null}
      {route.params?.hashtagContext ? (
        <View style={styles.challengePill}>
          <Text style={styles.challengePillText}>#{String(route.params.hashtagContext)}</Text>
        </View>
      ) : null}
      {!question && !loading ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadQuestion()}>
          <Text style={styles.secondaryText}>Provo përsëri</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity style={styles.primaryButton} onPress={startRound} disabled={!question}>
        <View style={styles.primaryGlow} />
        <Text style={styles.primaryText}>Start</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCapture = () => (
    <View style={styles.centerPanel}>
      <Text style={styles.eyebrow}>QUESTION</Text>
      <Text style={styles.question}>{question?.text}</Text>
      {onboardingFlow && onboardingInterestLabel ? (
        <View style={styles.challengePill}>
          <Text style={styles.challengePillText}>First answer for {onboardingInterestLabel}</Text>
        </View>
      ) : null}
      {route.params?.hashtagContext ? (
        <View style={styles.challengePill}>
          <Text style={styles.challengePillText}>
            Posting into #{String(route.params.hashtagContext)}
          </Text>
        </View>
      ) : null}

      <View style={styles.modeBadge}>
        <Text style={styles.modeBadgeText}>
          {activeTimeMode === "5s" ? "⚡ 5s prestige active" : "🐢 +5s penalty active"}
        </Text>
      </View>

      <View style={styles.timerBubble}>
        <Text style={styles.timerText}>{countdown}</Text>
      </View>

      <View style={styles.modeRow}>
        <TouchableOpacity style={styles.modeButton} onPress={() => void handleAudioCapture()}>
          <Ionicons name="mic" size={18} color={colors.text} />
          <Text style={styles.modeText}>Audio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modeButton} onPress={() => void handleVideoCapture()}>
          <Ionicons name="videocam" size={18} color={colors.text} />
          <Text style={styles.modeText}>Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modeButton} onPress={() => setSelectedMode("text")}>
          <Ionicons name="text" size={18} color={colors.text} />
          <Text style={styles.modeText}>Text</Text>
        </TouchableOpacity>
      </View>

      {selectedMode === "text" ? (
        <View style={styles.textComposer}>
          <TextInput
            style={styles.textInput}
            placeholder="Write fast..."
            placeholderTextColor={colors.muted}
            value={textAnswer}
            onChangeText={setTextAnswer}
            maxLength={70}
            multiline
            autoFocus
          />
          <View style={styles.textComposerMeta}>
            <Text style={styles.textHelper}>
              {activeTimeMode === "5s"
                ? "Shkruaj shpejt dhe dergoje para se te mbaroje koha."
                : "Ke 5 sek shtese, por pergjigjja do marre badge 🐢."}
            </Text>
            <Text style={styles.textCounter}>{textAnswer.length}/70</Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryButton, styles.textSubmitButton, !textAnswer.trim() && styles.disabledButton]}
            onPress={() => void submitTextAnswer()}
            disabled={!textAnswer.trim() || saving}
          >
            <View style={styles.primaryGlow} />
            {saving ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.primaryText}>
                {activeTimeMode === "5s" ? "Dergo pergjigjen" : "Dergo me penalitet"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {audioBusy ? (
        <View style={styles.statusBox}>
          <ActivityIndicator color={colors.accentWarm} />
          <Text style={styles.statusText}>Recording audio now...</Text>
        </View>
      ) : null}
    </View>
  );

  const renderOvertime = () => (
    <View style={styles.centerPanel}>
      <Text style={styles.eyebrow}>TIMEOUT</Text>
      <Text style={styles.title}>Koha mbaroi.</Text>
      <Text style={styles.statusText}>
        5 sek mbetet rruga me respekt. Mund ta provosh si pro ose te marresh +5 sek me penalitet.
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={restartAsPro}>
        <View style={styles.primaryGlow} />
        <Text style={styles.primaryText}>Pergjigju si PRO</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={takeExtraTime}>
        <Text style={styles.secondaryText}>Merr +5 sek me penalitet</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReview = () => (
    <View style={styles.centerPanel}>
      <Text style={styles.eyebrow}>REVIEW</Text>
      <Text style={styles.title}>
        {activeTimeMode === "5s" ? "This is your fast take." : "This answer carries the slow badge."}
      </Text>

      <View style={styles.reviewBadge}>
        <Text style={styles.reviewBadgeText}>
          {activeTimeMode === "5s" ? "⚡ 5s mode" : "🐢 10s mode"}
        </Text>
      </View>

      {localMedia?.type === "video" ? (
        <View style={styles.previewWrap}>
          <VideoView
            player={player}
            style={styles.previewVideo}
            contentFit="cover"
            nativeControls={false}
          />
        </View>
      ) : (
        <View style={styles.audioPreview}>
          <Ionicons name="mic" size={22} color={colors.accentWarm} />
          <Text style={styles.audioPreviewText}>Audio captured and ready to post.</Text>
        </View>
      )}

      <View style={styles.reviewActions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={startRound}>
          <Text style={styles.secondaryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void saveAnswer()} disabled={saving}>
          <View style={styles.primaryGlow} />
          {saving ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.primaryText}>Save answer</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderShare = () => (
    <View style={styles.centerPanel}>
      <Text style={styles.eyebrow}>SHARE</Text>
      <Text style={styles.title}>Answer saved.</Text>

      <Animated.View
        style={[
          styles.shareCard,
          {
            opacity: shareAnswerOpacity,
            transform: [{ translateY: shareAnswerTranslateY }],
          },
        ]}
      >
        <Text style={styles.shareQuestion}>{question?.text}</Text>
        <Text style={styles.shareAnswer}>
          {getAnswerPreview(savedAnswer)}
        </Text>
        <Text style={styles.shareMeta}>
          {(savedAnswer?.timeMode || activeTimeMode) === "5s" ? "⚡" : "🐢"}{" "}
          {(savedAnswer?.responseTime || calculateResponseTime()).toFixed(1)}s
        </Text>
        {savedAnswer?.aiComment ? (
          <Animated.View
            style={[
              styles.aiCommentCard,
              {
                opacity: aiCommentOpacity,
                transform: [{ translateY: aiCommentTranslateY }],
              },
            ]}
          >
            <Text style={styles.aiCommentLabel}>🤖 AI thote:</Text>
            <Text style={styles.aiCommentText}>{savedAnswer.aiComment}</Text>
          </Animated.View>
        ) : null}
      </Animated.View>

      <Animated.View
        style={[
          styles.shareActionWrap,
          {
            opacity: actionCardAnimations[0].opacity,
            transform: [
              { translateY: actionCardAnimations[0].translateY },
              { scale: actionCardAnimations[0].scale },
            ],
          },
        ]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => void shareToTikTok()}
            disabled={sharing}
        >
          <View style={styles.primaryGlow} />
          {sharing ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.primaryText}>
              {hashtagContext ? `Share with #${hashtagContext}` : "Share to TikTok"}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.shareActionWrap,
          {
            opacity: actionCardAnimations[1].opacity,
            transform: [
              { translateY: actionCardAnimations[1].translateY },
              { scale: actionCardAnimations[1].scale },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => void copyCaptionAndHashtags()}
          disabled={copyingCaption}
        >
          <Text style={styles.secondaryText}>
            {copyingCaption ? "Duke kopjuar..." : "Copy caption + hashtags"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.shareActionWrap,
          {
            opacity: actionCardAnimations[2].opacity,
            transform: [
              { translateY: actionCardAnimations[2].translateY },
              { scale: actionCardAnimations[2].scale },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => void exportShareScreenshot()}
          disabled={exportingScreenshot}
        >
          <Text style={styles.secondaryText}>
            {exportingScreenshot ? "Duke eksportuar..." : "Export screenshot"}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.shareActionWrap,
          {
            opacity: actionCardAnimations[3].opacity,
            transform: [
              { translateY: actionCardAnimations[3].translateY },
              { scale: actionCardAnimations[3].scale },
            ],
          },
        ]}
      >
        <TouchableOpacity style={styles.secondaryButton} onPress={challengeFriend}>
          <Text style={styles.secondaryText}>Sfido mikun</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.shareActionWrap,
          {
            opacity: actionCardAnimations[4].opacity,
            transform: [
              { translateY: actionCardAnimations[4].translateY },
              { scale: actionCardAnimations[4].scale },
            ],
          },
        ]}
      >
        <TouchableOpacity style={styles.secondaryButton} onPress={() => void compareWithRandom()}>
          <Text style={styles.secondaryText}>Krahasohu me te huaj</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.shareActionWrap,
          {
            opacity: actionCardAnimations[5].opacity,
            transform: [
              { translateY: actionCardAnimations[5].translateY },
              { scale: actionCardAnimations[5].scale },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate({
              name: "Home",
              merge: true,
              params: {
                refreshKey: Date.now(),
                postedAnswerId: savedAnswer?.id,
                questionId: question?.id,
                postedFeedItem: savedAnswer
                  ? {
                      ...savedAnswer,
                      question: question
                        ? {
                            id: question.id,
                            text: question.text,
                            category: question.category,
                            answerCount: 1,
                          }
                        : undefined,
                      user: {
                        id: MVP_USER_ID,
                        username: MVP_USER_ID,
                        followers: 0,
                      },
                      interactions: savedAnswer.interactions || {
                        likes: 0,
                        views: 0,
                        shares: 0,
                        saves: 0,
                      },
                    }
                  : undefined,
              },
            })
          }
        >
          <Text style={styles.secondaryText}>Shiko ne Feed</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          styles.shareActionWrap,
          {
            opacity: actionCardAnimations[6].opacity,
            transform: [
              { translateY: actionCardAnimations[6].translateY },
              { scale: actionCardAnimations[6].scale },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate("VideoPlayer", {
              questionId: question?.id,
              refreshKey: Date.now(),
            })
          }
        >
          <Text style={styles.secondaryText}>Shiko te tjeret</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={styles.captureHidden}>
        <ViewShot ref={shareCardRef} options={{ format: "png", quality: 1 }}>
          <View style={styles.captureCard}>
            <Text style={styles.captureBrand}>5 Second Answer</Text>
            <Text style={styles.captureQuestion}>{question?.text}</Text>
            <Text style={styles.captureAnswer}>
              {getAnswerPreview(savedAnswer)}
            </Text>
            <Text style={styles.captureMeta}>
              {(savedAnswer?.timeMode || activeTimeMode) === "5s" ? "Fast mode" : "Slow badge"} ·{" "}
              {(savedAnswer?.responseTime || calculateResponseTime()).toFixed(1)}s
            </Text>
            <Text style={styles.captureHashtags}>{buildShareCaption().split("\n\n").slice(-1)[0]}</Text>
          </View>
        </ViewShot>
      </View>
    </View>
  );

  const renderFail = () => (
    <View style={styles.centerPanel}>
      <Text style={styles.eyebrow}>FAILED</Text>
      <Text style={styles.title}>Koha mbaroi edhe ne slow mode.</Text>
      <Text style={styles.statusText}>Rinis dhe provo ta mbyllesh pa e humbur prestigjin.</Text>
      <TouchableOpacity style={styles.primaryButton} onPress={startRound}>
        <View style={styles.primaryGlow} />
        <Text style={styles.primaryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.accentWarm} />
        </View>
      ) : step === "ready" ? (
        renderReady()
      ) : step === "capture" ? (
        renderCapture()
      ) : step === "overtime" ? (
        renderOvertime()
      ) : step === "review" ? (
        renderReview()
      ) : step === "share" ? (
        renderShare()
      ) : (
        renderFail()
      )}
      {step !== "capture" && step !== "overtime" ? (
        <FloatingAiEntry
          bottomOffset={step === "share" ? 28 : 22}
          feature="mirror"
          queryHint="Si ta bej me viral kete answer?"
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
    backgroundColor: colors.bg,
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
  glowBottom: {
    position: "absolute",
    right: -80,
    bottom: -40,
    width: 240,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255,138,0,0.08)",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  centerPanel: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  eyebrow: {
    color: "#FFB38C",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  title: {
    marginTop: 12,
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  question: {
    marginTop: 16,
    color: colors.text,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "800",
    textAlign: "center",
  },
  challengePill: {
    alignSelf: "center",
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,138,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,138,0,0.35)",
  },
  challengePillText: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "900",
  },
  modeBadge: {
    alignSelf: "center",
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modeBadgeText: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "800",
  },
  timerBubble: {
    alignSelf: "center",
    marginTop: 18,
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  timerText: {
    color: colors.accentWarm,
    fontSize: 28,
    fontWeight: "900",
  },
  modeRow: {
    flexDirection: "row",
    marginTop: 22,
    gap: 10,
  },
  modeButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  modeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  textInput: {
    marginTop: 18,
    minHeight: 110,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "top",
  },
  textComposer: {
    marginTop: 18,
  },
  textComposerMeta: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  textHelper: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  textCounter: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "800",
  },
  statusBox: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  statusText: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    overflow: "hidden",
    marginTop: 20,
  },
  textSubmitButton: {
    marginTop: 14,
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
  secondaryButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginTop: 12,
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: colors.soft,
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.55,
  },
  reviewBadge: {
    alignSelf: "center",
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  reviewBadgeText: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "800",
  },
  previewWrap: {
    marginTop: 18,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#111216",
  },
  previewVideo: {
    width: "100%",
    aspectRatio: 9 / 16,
  },
  audioPreview: {
    marginTop: 18,
    minHeight: 120,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    gap: 12,
  },
  audioPreviewText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  reviewActions: {
    marginTop: 8,
  },
  shareActionWrap: {
    width: "100%",
  },
  shareCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  shareQuestion: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  shareAnswer: {
    marginTop: 12,
    color: colors.soft,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  shareMeta: {
    marginTop: 14,
    color: colors.accentWarm,
    fontSize: 13,
    fontWeight: "800",
  },
  aiCommentCard: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  aiCommentLabel: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "800",
  },
  aiCommentText: {
    marginTop: 6,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  captureHidden: {
    position: "absolute",
    left: -9999,
    top: -9999,
    opacity: 0,
  },
  captureCard: {
    width: 1080,
    minHeight: 1350,
    padding: 80,
    backgroundColor: "#0E0D13",
  },
  captureBrand: {
    color: colors.accentWarm,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  captureQuestion: {
    marginTop: 54,
    color: colors.text,
    fontSize: 72,
    lineHeight: 88,
    fontWeight: "900",
  },
  captureAnswer: {
    marginTop: 42,
    color: colors.soft,
    fontSize: 42,
    lineHeight: 58,
    fontWeight: "700",
  },
  captureMeta: {
    marginTop: 36,
    color: colors.muted,
    fontSize: 30,
    fontWeight: "700",
  },
  captureHashtags: {
    marginTop: 72,
    color: colors.accent,
    fontSize: 34,
    lineHeight: 48,
    fontWeight: "900",
  },
});
