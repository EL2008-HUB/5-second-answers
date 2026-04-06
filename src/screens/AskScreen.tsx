import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { API_CONFIG, getApiUrl } from "../config/api";

const DEMO_USER_ID = "demo_user";
const MAX_VOICE_ASK_MS = 12000;

const categories = [
  { id: "science", label: "Shkence", emoji: "ðŸ”¬" },
  { id: "history", label: "Histori", emoji: "ðŸ“š" },
  { id: "tech", label: "Teknologji", emoji: "ðŸ’»" },
  { id: "health", label: "Shendet", emoji: "ðŸ¥" },
  { id: "sports", label: "Sport", emoji: "âš½" },
  { id: "entertainment", label: "Argetim", emoji: "ðŸŽ¬" },
  { id: "education", label: "Arsim", emoji: "ðŸŽ“" },
  { id: "business", label: "Biznes", emoji: "ðŸ’¼" },
  { id: "lifestyle", label: "Jetese", emoji: "â˜•" },
];

const sampleQuestions = [
  "Pse qielli duket blu?",
  "Si funksionon graviteti?",
  "Cili eshte ndryshimi mes RAM dhe storage?",
];

type ExpertSummary = {
  id: string;
  username: string;
  followers: number;
  expertise?: {
    verified?: boolean;
    score?: number;
    approvedAnswers?: number;
    reason?: string;
    matchingCategory?: boolean;
  };
  pricing?: {
    priceCents?: number;
    label?: string;
    subtitle?: string;
  };
};

type ExpertRequestSummary = {
  status: string;
  priceLabel: string;
  expert?: {
    username?: string | null;
  } | null;
};

type QuestionSummary = {
  id: string;
  text: string;
  category: string;
  answerCount: number;
  views: number;
  createdAt?: string | null;
  userId?: string;
  expertRequest?: ExpertRequestSummary | null;
};

const formatDuration = (durationMillis: number) => {
  const seconds = Math.floor(durationMillis / 1000);
  const remainingMs = Math.floor((durationMillis % 1000) / 100);
  return `0:${String(seconds).padStart(2, "0")}.${remainingMs}`;
};

const getAudioUploadConfig = (uri: string) => {
  if (uri.toLowerCase().includes(".webm")) {
    return {
      name: "voice-question.webm",
      type: "audio/webm",
    };
  }

  return {
    name: "voice-question.m4a",
    type: "audio/m4a",
  };
};

const buildUploadFormData = async (
  fieldName: string,
  fileUri: string,
  filename: string,
  mimeType: string
) => {
  const formData = new FormData();

  if (Platform.OS === "web") {
    const fileResponse = await fetch(fileUri);
    const blob = await fileResponse.blob();
    formData.append(fieldName, blob, filename);
    return formData;
  }

  formData.append(fieldName, {
    uri: fileUri,
    name: filename,
    type: mimeType,
  } as any);

  return formData;
};

export default function AskScreen() {
  const route = useRoute<any>();
  const [question, setQuestion] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("science");
  const [loading, setLoading] = useState(false);
  const [myQuestions, setMyQuestions] = useState<QuestionSummary[]>([]);
  const [loadingMyQuestions, setLoadingMyQuestions] = useState(true);
  const [askMode, setAskMode] = useState<"community" | "expert">("community");
  const [experts, setExperts] = useState<ExpertSummary[]>([]);
  const [loadingExperts, setLoadingExperts] = useState(false);
  const [selectedExpertId, setSelectedExpertId] = useState("");
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [lastProcessedVoiceUri, setLastProcessedVoiceUri] = useState("");
  const navigation = useNavigation<any>();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const seedQuestion = route.params?.seedQuestion as string | undefined;
  const seedCategory = route.params?.seedCategory as string | undefined;
  const seedAskMode = route.params?.seedAskMode as "community" | "expert" | undefined;

  const isRecordingVoice = Boolean(recorderState.isRecording);
  const selectedExpert = useMemo(
    () => experts.find((expert) => expert.id === selectedExpertId) || null,
    [experts, selectedExpertId]
  );

  const voiceProgressText = useMemo(() => {
    if (!isRecordingVoice) {
      return "";
    }

    const remaining = Math.max(0, MAX_VOICE_ASK_MS - recorderState.durationMillis);
    return `${formatDuration(recorderState.durationMillis)} / ${formatDuration(MAX_VOICE_ASK_MS)} - edhe ${Math.ceil(
      remaining / 1000
    )}s`;
  }, [isRecordingVoice, recorderState.durationMillis]);

  const askButtonLabel = useMemo(() => {
    if (askMode === "expert" && selectedExpert) {
      return `Dergo te @${selectedExpert.username} ${selectedExpert.pricing?.label || "$1"}`;
    }

    return "Publiko pyetjen";
  }, [askMode, selectedExpert]);

  useEffect(() => {
    if (seedQuestion) {
      setQuestion(seedQuestion);
    }

    if (seedCategory) {
      setSelectedCategory(seedCategory);
    }

    if (seedAskMode) {
      setAskMode(seedAskMode);
    }
  }, [seedAskMode, seedCategory, seedQuestion]);

  useEffect(() => {
    void loadMyQuestions();

    const unsubscribe = navigation.addListener("focus", () => {
      void loadMyQuestions();
      void loadExperts(selectedCategory);
    });

    return unsubscribe;
  }, [navigation, selectedCategory]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("blur", () => {
      if (recorderState.isRecording) {
        recorder.stop().catch(() => null);
      }

      setQuestion("");
      setSelectedCategory("science");
      setAskMode("community");
      setSelectedExpertId("");
      setVoiceStatus("");
      setVoiceTranscript("");
      setLastProcessedVoiceUri("");
    });

    return unsubscribe;
  }, [navigation, recorder, recorderState.isRecording]);

  useEffect(() => {
    if (!recorderState.isRecording || recorderState.durationMillis < MAX_VOICE_ASK_MS) {
      return;
    }

    void handleStopVoiceAsk();
  }, [recorderState.durationMillis, recorderState.isRecording]);

  useEffect(() => {
    void loadExperts(selectedCategory);
  }, [selectedCategory]);

  const loadExperts = async (categoryId: string) => {
    try {
      setLoadingExperts(true);
      const response = await fetch(
        `${getApiUrl(API_CONFIG.endpoints.questionExperts)}?category=${encodeURIComponent(categoryId)}`
      );
      const data = await response.json();
      const nextExperts: ExpertSummary[] = Array.isArray(data?.experts) ? data.experts : [];

      setExperts(nextExperts);
      setSelectedExpertId((current) => {
        if (nextExperts.some((expert) => expert.id === current)) {
          return current;
        }

        return nextExperts[0]?.id || "";
      });
    } catch (error) {
      console.error("Load experts error:", error);
      setExperts([]);
      setSelectedExpertId("");
    } finally {
      setLoadingExperts(false);
    }
  };

  const loadMyQuestions = async () => {
    try {
      setLoadingMyQuestions(true);

      const response = await fetch(`${getApiUrl(API_CONFIG.endpoints.questions)}?userId=${DEMO_USER_ID}`);
      const data = await response.json();

      if (!Array.isArray(data)) {
        setMyQuestions([]);
        return;
      }

      const mine = data
        .sort((left, right) => {
          const leftTime = new Date(left.createdAt || 0).getTime();
          const rightTime = new Date(right.createdAt || 0).getTime();
          return rightTime - leftTime;
        })
        .slice(0, 5);

      setMyQuestions(mine);
    } catch (error) {
      console.error("Load my questions error:", error);
      setMyQuestions([]);
    } finally {
      setLoadingMyQuestions(false);
    }
  };

  const transcribeVoiceAsk = async (audioUri: string) => {
    if (!audioUri || audioUri === lastProcessedVoiceUri) {
      return;
    }

    setIsTranscribingVoice(true);
    setVoiceStatus("Po e kthej pyetjen me ze ne tekst...");

    try {
      const uploadConfig = getAudioUploadConfig(audioUri);
      const formData = await buildUploadFormData(
        "audio",
        audioUri,
        uploadConfig.name,
        uploadConfig.type
      );

      const uploadResponse = await fetch(getApiUrl(API_CONFIG.endpoints.upload), {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.message || uploadData.error || "Deshtoi ngarkimi i audios");
      }

      const transcribeResponse = await fetch(getApiUrl(API_CONFIG.endpoints.ai.transcribe), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentUrl: uploadData.url }),
      });
      const transcribeData = await transcribeResponse.json();

      if (!transcribeResponse.ok) {
        throw new Error(
          transcribeData.error || "Transkriptimi nuk u krye. Provo edhe nje here."
        );
      }

      setLastProcessedVoiceUri(audioUri);
      setVoiceTranscript(transcribeData.transcript || "");
      setQuestion(transcribeData.suggestedQuestion || transcribeData.transcript || "");
      setVoiceStatus("Pyetja u kthye ne tekst. Mund ta rregullosh para publikimit.");
    } catch (error) {
      console.error("Voice ask transcribe error:", error);
      setVoiceStatus("Transkriptimi nuk u krye. Provo perseri ose shkruaje vete.");
      Alert.alert(
        "Voice Ask",
        error instanceof Error ? error.message : "Transkriptimi nuk u krye."
      );
    } finally {
      setIsTranscribingVoice(false);
    }
  };

  const handleStartVoiceAsk = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Leja e mikrofonit mungon",
          "Lejo mikrofonin qe ta kthesh pyetjen me ze ne tekst."
        );
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: "duckOthers",
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });

      setVoiceTranscript("");
      setVoiceStatus("Po degjoj pyetjen tende...");
      await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
      recorder.record();
    } catch (error) {
      console.error("Start voice ask error:", error);
      setVoiceStatus("Nuk u arrit regjistrimi i zerit.");
      Alert.alert(
        "Voice Ask",
        error instanceof Error ? error.message : "Nuk u arrit regjistrimi i zerit."
      );
    }
  };

  const handleStopVoiceAsk = async () => {
    try {
      if (!recorderState.isRecording) {
        return;
      }

      setVoiceStatus("Po ruaj audion...");
      await recorder.stop();

      const recordedUri = recorder.uri || recorderState.url;
      if (!recordedUri) {
        throw new Error("Audio nuk u ruajt.");
      }

      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: "duckOthers",
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });

      await transcribeVoiceAsk(recordedUri);
    } catch (error) {
      console.error("Stop voice ask error:", error);
      setVoiceStatus("Audio nuk u ruajt si duhet.");
    }
  };

  const handleAsk = async () => {
    const normalizedQuestion = question.trim();

    if (!normalizedQuestion) {
      Alert.alert("Pyetja mungon", "Shkruaj nje pyetje para se ta publikosh.");
      return;
    }

    if (askMode === "expert" && !selectedExpert) {
      Alert.alert("Eksperti mungon", "Zgjidh nje ekspert para se ta dergosh request-in.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(getApiUrl(API_CONFIG.endpoints.questions), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: normalizedQuestion,
          category: selectedCategory,
          userId: DEMO_USER_ID,
          expertRequest:
            askMode === "expert" && selectedExpert
              ? {
                  expertUserId: selectedExpert.id,
                }
              : undefined,
        }),
      });

      const questionData = await res.json();

      if (!res.ok) {
        throw new Error(questionData.error || "Deshtoi publikimi i pyetjes");
      }

      const hasExpertRequest = Boolean(questionData.expertRequest?.expert?.username);
      const flashMessage = hasExpertRequest
        ? `Priority request u dergua te @${questionData.expertRequest.expert.username} per ${questionData.expertRequest.priceLabel}.`
        : "Pyetja u publikua. Po presim pergjigjet e para...";

      setQuestion("");
      setVoiceStatus("");
      setVoiceTranscript("");
      setLastProcessedVoiceUri("");
      setAskMode("community");
      setMyQuestions((prev) =>
        [questionData, ...prev.filter((item) => item.id !== questionData.id)].slice(0, 5)
      );
      navigation.navigate("VideoPlayer", {
        questionId: questionData.id,
        flashStatus: hasExpertRequest ? "approved" : "info",
        flashMessage,
        refreshKey: Date.now(),
      });
    } catch (error) {
      console.error("Ask error:", error);
      Alert.alert(
        "Gabim",
        error instanceof Error ? error.message : "Deshtoi publikimi i pyetjes."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOpenQuestion = (questionId: string) => {
    navigation.navigate("VideoPlayer", { questionId });
  };

  const askDisabled =
    loading ||
    isTranscribingVoice ||
    isRecordingVoice ||
    (askMode === "expert" && (loadingExperts || !selectedExpert));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Bej nje pyetje</Text>
        <Text style={styles.subtitle}>
          Shkruaje qarte ose fol me ze. Publikoje per komunitetin ose dergoje direkt te
          nje ekspert per pergjigje prioritare 5-10 sekonda.
        </Text>
      </View>

      <View style={styles.modeCard}>
        <View style={styles.modeHeader}>
          <View>
            <Text style={styles.modeEyebrow}>ASK MODE</Text>
            <Text style={styles.modeTitle}>Zgjidh ritmin e pergjigjes</Text>
          </View>
          <View style={styles.modeAccent}>
            <Ionicons name="flash" size={16} color="#ffd8b0" />
            <Text style={styles.modeAccentText}>5-10s priority</Text>
          </View>
        </View>

        <View style={styles.modeToggleRow}>
          <TouchableOpacity
            style={[styles.modeToggle, askMode === "community" && styles.modeToggleActive]}
            onPress={() => setAskMode("community")}
          >
            <Text
              style={[
                styles.modeToggleTitle,
                askMode === "community" && styles.modeToggleTitleActive,
              ]}
            >
              Community
            </Text>
            <Text style={styles.modeToggleText}>Pergjigje nga creators dhe feed-i.</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeToggle, askMode === "expert" && styles.modeToggleActiveStrong]}
            onPress={() => setAskMode("expert")}
          >
            <Text
              style={[
                styles.modeToggleTitle,
                askMode === "expert" && styles.modeToggleTitleActive,
              ]}
            >
              Ask Expert
            </Text>
            <Text style={styles.modeToggleText}>Request prioritare me tier $1-$5.</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.voiceCard}>
        <View style={styles.voiceHeader}>
          <View>
            <Text style={styles.voiceTitle}>Voice Ask</Text>
            <Text style={styles.voiceSubtitle}>
              Fol natyrshem dhe pyetja do te kthehet ne tekst.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.voiceButton, isRecordingVoice && styles.voiceButtonRecording]}
            onPress={() =>
              void (isRecordingVoice ? handleStopVoiceAsk() : handleStartVoiceAsk())
            }
            disabled={isTranscribingVoice}
          >
            <Ionicons
              name={isRecordingVoice ? "stop-circle" : "mic"}
              size={18}
              color="white"
            />
            <Text style={styles.voiceButtonText}>
              {isRecordingVoice ? "Ndalo" : "Pyet me ze"}
            </Text>
          </TouchableOpacity>
        </View>

        {isRecordingVoice ? (
          <View style={styles.voiceLiveBox}>
            <Text style={styles.voiceLiveLabel}>Po regjistrohet...</Text>
            <Text style={styles.voiceLiveTime}>{voiceProgressText}</Text>
          </View>
        ) : null}

        {voiceStatus ? <Text style={styles.voiceStatus}>{voiceStatus}</Text> : null}
        {isTranscribingVoice ? <ActivityIndicator color="#ff6b6b" /> : null}

        {voiceTranscript ? (
          <View style={styles.voiceTranscriptBox}>
            <Text style={styles.voiceTranscriptLabel}>Transkripti i plote</Text>
            <Text style={styles.voiceTranscriptText}>{voiceTranscript}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Pyetjet e mia te fundit</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Explore")}>
            <Text style={styles.recentLink}>Shiko te gjitha</Text>
          </TouchableOpacity>
        </View>

        {loadingMyQuestions ? (
          <ActivityIndicator color="#ff4444" />
        ) : myQuestions.length === 0 ? (
          <Text style={styles.recentEmpty}>
            Pyetjet qe publikon do te dalin ketu, qe t'i hapesh perseri me nje klik.
          </Text>
        ) : (
          myQuestions.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.recentCard}
              onPress={() => handleOpenQuestion(item.id)}
            >
              <View style={styles.recentCardHeader}>
                <Text style={styles.recentCategory}>{item.category}</Text>
                <Ionicons name="chevron-forward" size={18} color="#ff4444" />
              </View>
              <Text style={styles.recentQuestion} numberOfLines={2}>
                {item.text}
              </Text>
              {item.expertRequest ? (
                <Text style={styles.recentPriority}>
                  Ask Expert · @{item.expertRequest.expert?.username || "expert"} · {item.expertRequest.priceLabel}
                </Text>
              ) : null}
              <Text style={styles.recentMeta}>
                {item.answerCount || 0} pergjigje - {item.views || 0} shikime
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Pyetja jote</Text>
        <TextInput
          style={styles.input}
          placeholder="P.sh. Pse qielli duket blu?"
          placeholderTextColor="#666"
          value={question}
          onChangeText={setQuestion}
          multiline
          maxLength={200}
        />
        <Text style={styles.charCount}>{question.length}/200</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Shembuj te shpejte</Text>
        <View style={styles.examplesRow}>
          {sampleQuestions.map((sample) => (
            <TouchableOpacity
              key={sample}
              style={styles.exampleChip}
              onPress={() => setQuestion(sample)}
            >
              <Text style={styles.exampleChipText}>{sample}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Zgjidh kategorine</Text>
        <View style={styles.categoryGrid}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryOption,
                selectedCategory === category.id && styles.categoryOptionActive,
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Text style={styles.categoryEmoji}>{category.emoji}</Text>
              <Text
                style={[
                  styles.categoryName,
                  selectedCategory === category.id && styles.categoryNameActive,
                ]}
              >
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {askMode === "expert" ? (
        <View style={styles.expertPanel}>
          <View style={styles.expertPanelHeader}>
            <View>
              <Text style={styles.expertEyebrow}>ASK EXPERTS</Text>
              <Text style={styles.expertTitle}>Zgjidh ekspertin per kete kategori</Text>
            </View>
            <View style={styles.expertHeaderPill}>
              <Text style={styles.expertHeaderPillText}>Priority queue</Text>
            </View>
          </View>

          <Text style={styles.expertSubtitle}>
            Eksperti merr nje request prioritare dhe pergjigjet me video 5-10 sekonda.
          </Text>

          {loadingExperts ? (
            <ActivityIndicator color="#ff6b6b" />
          ) : !experts.length ? (
            <Text style={styles.expertEmpty}>
              Nuk ka ende ekspert aktiv ne kete kategori. Provo nje kategori tjeter ose
              publikoje per komunitetin.
            </Text>
          ) : (
            experts.map((expert) => {
              const isSelected = selectedExpertId === expert.id;
              return (
                <TouchableOpacity
                  key={expert.id}
                  style={[styles.expertCard, isSelected && styles.expertCardSelected]}
                  onPress={() => setSelectedExpertId(expert.id)}
                >
                  <View style={styles.expertCardHeader}>
                    <View style={styles.expertIdentity}>
                      <View style={styles.expertAvatar}>
                        <Text style={styles.expertAvatarText}>
                          {expert.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.expertIdentityCopy}>
                        <View style={styles.expertNameRow}>
                          <Text style={styles.expertName}>@{expert.username}</Text>
                          {expert.expertise?.verified ? (
                            <View style={styles.verifiedPill}>
                              <Ionicons name="checkmark-circle" size={14} color="#9ef7a8" />
                              <Text style={styles.verifiedPillText}>Verified</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.expertReason}>
                          {expert.expertise?.reason || "Creator aktiv"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.expertPriceBox}>
                      <Text style={styles.expertPrice}>{expert.pricing?.label || "$1"}</Text>
                      <Text style={styles.expertPriceCaption}>priority</Text>
                    </View>
                  </View>

                  <View style={styles.expertStatsRow}>
                    <Text style={styles.expertStat}>{expert.followers || 0} followers</Text>
                    <Text style={styles.expertStat}>
                      expert {expert.expertise?.score || 12}
                    </Text>
                    <Text style={styles.expertStat}>
                      {expert.expertise?.approvedAnswers || 0} approved
                    </Text>
                  </View>

                  <Text style={styles.expertTierText}>
                    {expert.pricing?.subtitle || "Priority 5-10s answer"}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : (
        <View style={styles.tipCardMuted}>
          <Text style={styles.tipTitleMuted}>Community mode</Text>
          <Text style={styles.tipTextMuted}>
            Pyetja del direkt ne platforme dhe creators pergjigjen me ritmin normal te app-it.
          </Text>
        </View>
      )}

      <View style={[styles.tipCard, askMode === "expert" && styles.tipCardWarm]}>
        <Text style={styles.tipTitle}>{askMode === "expert" ? "Fast lane" : "Me e thjeshta"}</Text>
        <Text style={styles.tipText}>
          {askMode === "expert"
            ? "Pyetja ruhet si priority request dhe faqja e pyetjes do te tregoje ekspertin, statusin dhe momentin kur pergjigjja arrin."
            : 'Mund ta shkruash pyetjen ose te shtypesh "Pyet me ze". Pas publikimit do te hapet direkt faqja e pyetjes dhe do te shohesh pritjen per pergjigjet e para.'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.askButton, askDisabled && styles.askButtonDisabled]}
        onPress={() => void handleAsk()}
        disabled={askDisabled}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Ionicons
              name={askMode === "expert" ? "flash" : "help-circle"}
              size={20}
              color="white"
            />
            <Text style={styles.askButtonText}>{askButtonLabel}</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    padding: 20,
  },
  content: {
    paddingBottom: 120,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#c9c9c9",
    textAlign: "center",
    lineHeight: 22,
  },
  modeCard: {
    backgroundColor: "#101010",
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  modeEyebrow: {
    color: "#8c8c8c",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  modeTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
  },
  modeAccent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,152,64,0.18)",
  },
  modeAccentText: {
    color: "#ffd8b0",
    fontSize: 12,
    fontWeight: "700",
  },
  modeToggleRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  modeToggle: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  modeToggleActive: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.12)",
  },
  modeToggleActiveStrong: {
    backgroundColor: "rgba(255,122,69,0.12)",
    borderColor: "rgba(255,122,69,0.28)",
  },
  modeToggleTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  modeToggleTitleActive: {
    color: "#fff2e8",
  },
  modeToggleText: {
    color: "#b8b8b8",
    fontSize: 13,
    lineHeight: 18,
  },
  voiceCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  voiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  voiceTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  voiceSubtitle: {
    color: "#b9b9b9",
    marginTop: 4,
    lineHeight: 18,
  },
  voiceButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff4444",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    gap: 8,
  },
  voiceButtonRecording: {
    backgroundColor: "#ff7a45",
  },
  voiceButtonText: {
    color: "white",
    fontWeight: "700",
  },
  voiceLiveBox: {
    backgroundColor: "rgba(255,68,68,0.12)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  voiceLiveLabel: {
    color: "#ffb3b3",
    fontWeight: "700",
    marginBottom: 4,
  },
  voiceLiveTime: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  voiceStatus: {
    color: "#d8d8d8",
    lineHeight: 20,
    marginBottom: 8,
  },
  voiceTranscriptBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  voiceTranscriptLabel: {
    color: "#ff6b6b",
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 12,
  },
  voiceTranscriptText: {
    color: "#e5e5e5",
    lineHeight: 20,
  },
  recentSection: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  recentTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  recentLink: {
    color: "#ff6b6b",
    fontWeight: "600",
  },
  recentEmpty: {
    color: "#b9b9b9",
    lineHeight: 20,
  },
  recentCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  recentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  recentCategory: {
    color: "#ff6b6b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  recentQuestion: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },
  recentPriority: {
    color: "#ffd6af",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  recentMeta: {
    color: "#b9b9b9",
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginBottom: 12,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "white",
    padding: 16,
    borderRadius: 14,
    fontSize: 16,
    minHeight: 110,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#777",
    textAlign: "right",
    marginTop: 6,
  },
  examplesRow: {
    gap: 10,
  },
  exampleChip: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  exampleChipText: {
    color: "#e5e5e5",
    fontSize: 14,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  categoryOption: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  categoryOptionActive: {
    backgroundColor: "rgba(255,68,68,0.3)",
    borderWidth: 2,
    borderColor: "#ff4444",
  },
  categoryEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  categoryName: {
    color: "#ccc",
    fontSize: 13,
    fontWeight: "500",
  },
  categoryNameActive: {
    color: "#ff4444",
    fontWeight: "bold",
  },
  expertPanel: {
    backgroundColor: "rgba(255,139,92,0.08)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,139,92,0.18)",
  },
  expertPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  expertEyebrow: {
    color: "#ffbf94",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  expertTitle: {
    color: "white",
    fontSize: 19,
    fontWeight: "800",
  },
  expertHeaderPill: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  expertHeaderPillText: {
    color: "#ffe2cc",
    fontSize: 12,
    fontWeight: "700",
  },
  expertSubtitle: {
    color: "#dfd6cf",
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 14,
  },
  expertEmpty: {
    color: "#ead5c6",
    lineHeight: 20,
  },
  expertCard: {
    backgroundColor: "rgba(10,10,10,0.58)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 10,
  },
  expertCardSelected: {
    borderColor: "rgba(255,139,92,0.5)",
    backgroundColor: "rgba(255,139,92,0.12)",
  },
  expertCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  expertIdentity: {
    flexDirection: "row",
    flex: 1,
  },
  expertAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    marginRight: 12,
  },
  expertAvatarText: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
  },
  expertIdentityCopy: {
    flex: 1,
  },
  expertNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  expertName: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(149,240,160,0.12)",
  },
  verifiedPillText: {
    color: "#d6f8da",
    fontSize: 11,
    fontWeight: "800",
  },
  expertReason: {
    color: "#d4c1b4",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  expertPriceBox: {
    alignItems: "flex-end",
  },
  expertPrice: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
  },
  expertPriceCaption: {
    color: "#ffcfac",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  expertStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  expertStat: {
    color: "#f2e0d2",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  expertTierText: {
    color: "#ffddb8",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 12,
  },
  tipCardMuted: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tipTitleMuted: {
    color: "#efefef",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  tipTextMuted: {
    color: "#cfcfcf",
    lineHeight: 20,
  },
  tipCard: {
    backgroundColor: "rgba(76,175,80,0.12)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.22)",
  },
  tipCardWarm: {
    backgroundColor: "rgba(255,152,64,0.12)",
    borderColor: "rgba(255,152,64,0.22)",
  },
  tipTitle: {
    color: "#77d977",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  tipText: {
    color: "#d5d5d5",
    lineHeight: 20,
  },
  askButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff4444",
    padding: 18,
    borderRadius: 25,
    marginBottom: 30,
  },
  askButtonDisabled: {
    backgroundColor: "#666",
  },
  askButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
});

















