import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { BASE_URL } from "../services/api";
import FloatingAiEntry from "../components/FloatingAiEntry";
import { addComment, fetchComments } from "../services/commentApi";

const { height } = Dimensions.get("window");
const DEMO_USER_ID = "demo_user";

const getHeroLabel = ({ sortBy, highlighted, pending }) => {
  if (highlighted) {
    return "Pergjigjja jote";
  }

  if (pending) {
    return "Ne pritje";
  }

  if (sortBy === "newest") {
    return "New Answer";
  }

  if (sortBy === "trending") {
    return "Trending Answer";
  }

  return "Best Answer";
};

const getChainTone = (chainType) => {
  if (chainType === "next") {
    return {
      backgroundColor: "rgba(255,173,92,0.18)",
      color: "#ffd2a3",
    };
  }

  return {
    backgroundColor: "rgba(255,68,68,0.16)",
    color: "#ffb0b0",
  };
};

const readJsonSafely = async (response, fallbackMessage) => {
  const rawText = await response.text();

  if (!rawText) {
    if (!response.ok) {
      throw new Error(fallbackMessage || `Request failed with status ${response.status}`);
    }

    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch (error) {
    const snippet = rawText.slice(0, 120).replace(/\s+/g, " ").trim();
    throw new Error(
      `${fallbackMessage || "Invalid JSON response"}${snippet ? ` (${snippet})` : ""}`
    );
  }
};

export default function VideoPlayerScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const {
    questionId,
    flashMessage,
    flashStatus,
    refreshKey,
    highlightAnswerId,
    forceSort,
    optimisticAnswer,
  } = route.params || {};

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [loadingAnswers, setLoadingAnswers] = useState(true);
  const [activeAnswerIndex, setActiveAnswerIndex] = useState(0);
  const [sortBy, setSortBy] = useState("top");
  const [statusBanner, setStatusBanner] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [battleData, setBattleData] = useState(null);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleVoteLoading, setBattleVoteLoading] = useState(false);
  const [expertOnly, setExpertOnly] = useState(false);
  const [selectedDefinition, setSelectedDefinition] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [suggestedReactions, setSuggestedReactions] = useState([]);

  const loading = loadingQuestion || loadingAnswers;
  const mainAnswer = answers[activeAnswerIndex] || null;
  const visibleAnswerCount = Math.max(question?.answerCount || 0, answers.length);
  const mainVideoSource = mainAnswer?.type === "video" ? mainAnswer.contentUrl : null;
  const questionChain = question?.learning?.questionChain || [];
  const microDefinitions = question?.learning?.microDefinitions || [];
  const timeToLearn = question?.timeToLearn || question?.learning?.timeToLearn || null;
  const expertRequest = question?.expertRequest || null;
  const expertAnswerCount = answers.filter((answer) => answer.user?.expertise?.verified).length;

  const mainVideoPlayer = useVideoPlayer(mainVideoSource, (player) => {
    player.loop = true;

    if (mainVideoSource) {
      player.play();
    }
  });

  const compareAnswers = useMemo(
    () =>
      battleData?.participants?.length ? battleData.participants : answers.slice(0, 2),
    [answers, battleData]
  );

  const loadBattle = async () => {
    if (!questionId) {
      return;
    }

    try {
      setBattleLoading(true);
      const response = await fetch(
        `${BASE_URL}/api/questions/${questionId}/battle?userId=${DEMO_USER_ID}`
      );
      const data = await readJsonSafely(response, "Failed to load battle");

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load battle");
      }

      setBattleData(data);
    } catch (error) {
      console.error("Battle load error:", error);
      setBattleData(null);
    } finally {
      setBattleLoading(false);
    }
  };

  const loadQuestionDetails = async () => {
    if (!questionId) {
      return;
    }

    try {
      setLoadingQuestion(true);
      setSelectedDefinition(null);

      const response = await fetch(`${BASE_URL}/api/questions/${questionId}?userId=${DEMO_USER_ID}`);
      const data = await readJsonSafely(response, "Failed to load question");

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load question");
      }

      setQuestion(data);
    } catch (error) {
      console.error("Error loading question:", error);
      Alert.alert("Gabim", "Nuk u arrit te ngarkohet pyetja.");
    } finally {
      setLoadingQuestion(false);
    }
  };

  const loadAnswersAndBattle = async () => {
    if (!questionId) {
      return;
    }

    try {
      setLoadingAnswers(true);

      const answersResponse = await fetch(
        `${BASE_URL}/api/answers/${questionId}?sort=${sortBy}&userId=${DEMO_USER_ID}&expertOnly=${expertOnly}`
      );
      const answersData = await readJsonSafely(
        answersResponse,
        "Failed to load answers"
      );

      if (!answersResponse.ok) {
        throw new Error(answersData?.error || "Failed to load answers");
      }

      let nextAnswers = Array.isArray(answersData) ? answersData : [];

      if (
        optimisticAnswer?.id &&
        optimisticAnswer?.questionId === questionId &&
        !expertOnly &&
        !nextAnswers.some((answer) => answer.id === optimisticAnswer.id)
      ) {
        nextAnswers = [optimisticAnswer, ...nextAnswers];
      }

      setAnswers(nextAnswers);
      setCompareMode(nextAnswers.length >= 2);

      const highlightedIndex = highlightAnswerId
        ? nextAnswers.findIndex((answer) => answer.id === highlightAnswerId)
        : -1;
      const nextActiveIndex = highlightedIndex >= 0 ? highlightedIndex : 0;
      setActiveAnswerIndex(nextActiveIndex);

      const highlightedAnswer = highlightedIndex >= 0 ? nextAnswers[highlightedIndex] : null;
      const hasPendingAnswers = nextAnswers.some((answer) => answer.status === "pending");

      if (flashMessage) {
        setStatusBanner({
          type: flashStatus || "info",
          message: flashMessage,
        });
      } else if (expertOnly && !nextAnswers.length) {
        setStatusBanner({
          type: "info",
          message:
            "Nuk ka ende expert answers per kete pyetje. Provo te shohesh te gjitha pergjigjet.",
        });
      } else if (highlightedAnswer?.status === "approved") {
        setStatusBanner({
          type: "approved",
          message: "Pergjigjja jote u publikua dhe po shfaqet ketu.",
        });
      } else if (highlightedAnswer?.status === "pending") {
        setStatusBanner({
          type: "pending",
          message: "Pergjigjja jote u ruajt dhe po pret rishikimin.",
        });
      } else if (hasPendingAnswers) {
        setStatusBanner({
          type: "pending",
          message: "Ke pergjigje ne pritje te rishikimit per kete pyetje.",
        });
      } else {
        setStatusBanner(null);
      }

      await loadBattle();
    } catch (error) {
      console.error("Error loading answers:", error);
      Alert.alert("Gabim", "Nuk u arrit te ngarkohen pergjigjet.");
    } finally {
      setLoadingAnswers(false);
    }
  };

  useEffect(() => {
    if (forceSort === "newest") {
      setSortBy("newest");
    }
  }, [forceSort]);

  useEffect(() => {
    if (questionId) {
      void loadQuestionDetails();
    }
  }, [questionId, refreshKey]);

  useEffect(() => {
    if (questionId) {
      void loadAnswersAndBattle();
    }
  }, [questionId, sortBy, refreshKey, highlightAnswerId, expertOnly]);

  useEffect(() => {
    if (highlightAnswerId || !expertRequest?.expertUserId || !answers.length) {
      return;
    }

    const preferredIndex = expertRequest.answeredAnswerId
      ? answers.findIndex((answer) => answer.id === expertRequest.answeredAnswerId)
      : answers.findIndex((answer) => answer.userId === expertRequest.expertUserId);

    if (preferredIndex > 0) {
      setActiveAnswerIndex(preferredIndex);
    }
  }, [answers, expertRequest, highlightAnswerId]);

  const getCommentContext = (answer = mainAnswer) => ({
    answer: answer?.text || "",
    answerId: answer?.id || "",
    question: question?.text || "",
    userId: DEMO_USER_ID,
  });

  const loadComments = async (answer = mainAnswer) => {
    if (!answer?.id) {
      setComments([]);
      setSuggestedReactions([]);
      return;
    }

    try {
      setLoadingComments(true);
      const data = await fetchComments(answer.id, getCommentContext(answer));
      setComments(Array.isArray(data?.comments) ? data.comments : []);
      setSuggestedReactions(Array.isArray(data?.suggestedReactions) ? data.suggestedReactions : []);
    } catch (error) {
      console.error("Comments load error:", error);
      setComments([]);
      setSuggestedReactions([]);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    void loadComments(mainAnswer);
  }, [mainAnswer?.id, question?.id]);

  const handleLike = async (answerId) => {
    try {
      const response = await fetch(`${BASE_URL}/api/answers/${answerId}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "like", userId: DEMO_USER_ID }),
      });
      const result = await readJsonSafely(response, "Failed to like answer");

      if (!response.ok) {
        throw new Error(result?.error || "Failed to like answer");
      }

      setAnswers((prev) =>
        prev.map((answer) =>
          answer.id === answerId
            ? {
                ...answer,
                interactions: {
                  ...answer.interactions,
                  likes: result.likes ?? answer.interactions?.likes ?? 0,
                },
              }
            : answer
        )
      );
    } catch (error) {
      console.error("Like error:", error);
    }
  };

  const handleVoteBattle = async (answerId) => {
    if (!questionId || battleVoteLoading) {
      return;
    }

    try {
      setBattleVoteLoading(true);
      const response = await fetch(`${BASE_URL}/api/questions/${questionId}/battle/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answerId, userId: DEMO_USER_ID }),
      });
      const data = await readJsonSafely(response, "Failed to vote");

      if (!response.ok) {
        throw new Error(data?.error || "Failed to vote");
      }

      setBattleData(data);
      setAnswers((prev) =>
        prev.map((answer) => {
          const updated = data.participants?.find((item) => item.id === answer.id);
          return updated ? { ...answer, battle: updated.battle } : answer;
        })
      );
      setStatusBanner({
        type: "approved",
        message: data.alreadyVoted
          ? "Ke votuar tashme ne kete battle."
          : `Vote u ruajt. Fituesi merr +${data.xpReward || 15} XP dhe trending boost.`,
      });
    } catch (error) {
      console.error("Battle vote error:", error);
      Alert.alert("Gabim", "Nuk u arrit te ruhet vota.");
    } finally {
      setBattleVoteLoading(false);
    }
  };

  const handleSelectAnswer = (answerId) => {
    const targetIndex = answers.findIndex((answer) => answer.id === answerId);
    if (targetIndex >= 0) {
      setActiveAnswerIndex(targetIndex);
    }
  };

  const handleOpenUpload = () => {
    navigation.navigate("Upload", {
      questionId,
      question: question?.text,
      category: question?.category,
    });
  };

  const handleOpenRelatedQuestion = (id) => {
    if (!id) {
      return;
    }

    setSelectedDefinition(null);
    navigation.navigate("VideoPlayer", {
      questionId: id,
      refreshKey: Date.now(),
    });
  };

  const handleShare = () => {
    Alert.alert("Soon", "Viral share card do ta shtojme ne hapin tjeter.");
  };

  const handleSubmitComment = async (overrideText = null) => {
    const nextText = String(overrideText || commentText || "").trim();

    if (!mainAnswer?.id || !nextText || postingComment) {
      return;
    }

    try {
      setPostingComment(true);
      const result = await addComment(mainAnswer.id, nextText, getCommentContext(mainAnswer));

      if (!result.ok) {
        const rewrite = result.data?.moderation?.suggestedRewrite;
        if (rewrite) {
          setCommentText(rewrite);
        }

        Alert.alert(
          "Comment blocked",
          result.data?.moderation?.reason ||
            "Komenti u bllokua. Provo nje version me te respektueshem."
        );
        setSuggestedReactions(
          Array.isArray(result.data?.suggestedReactions) ? result.data.suggestedReactions : []
        );
        return;
      }

      if (result.data?.comment) {
        setComments((prev) => [result.data.comment, ...prev]);
      }

      setCommentText("");
      setSuggestedReactions(
        Array.isArray(result.data?.suggestedReactions) ? result.data.suggestedReactions : []
      );
    } catch (error) {
      console.error("Comment submit error:", error);
      Alert.alert("Gabim", "Komenti nuk u ruajt.");
    } finally {
      setPostingComment(false);
    }
  };

  if (loading && !question) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!question) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>Pyetja nuk u gjet.</Text>
      </View>
    );
  }

  const heroLabel = getHeroLabel({
    sortBy,
    highlighted: mainAnswer?.id === highlightAnswerId,
    pending: mainAnswer?.status === "pending",
  });

  return (
    <View style={styles.container}>
      <Modal transparent animationType="fade" visible={Boolean(selectedDefinition)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalEyebrow}>MICRO DEFINITION</Text>
                <Text style={styles.modalTitle}>{selectedDefinition?.term}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setSelectedDefinition(null)}
              >
                <Ionicons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDefinition}>{selectedDefinition?.definition}</Text>

            <View style={styles.visualCard}>
              <View style={styles.visualBadge}>
                <Ionicons name="eye-outline" size={16} color="#ffb2b2" />
                <Text style={styles.visualBadgeText}>Visual</Text>
              </View>
              <Text style={styles.visualText}>{selectedDefinition?.visual}</Text>
            </View>

            {selectedDefinition?.relatedQuestion ? (
              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => handleOpenRelatedQuestion(selectedDefinition.relatedQuestion.id)}
              >
                <Ionicons name="play-circle" size={18} color="white" />
                <Text style={styles.modalActionText}>Shih 1 video tjeter</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pyetje</Text>
        <TouchableOpacity onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.questionShell}>
          <View style={styles.questionTopRow}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{question.category}</Text>
            </View>
            {timeToLearn ? (
              <View style={styles.learnBadge}>
                <Ionicons name="time-outline" size={14} color="#ffd2d2" />
                <Text style={styles.learnBadgeText}>{timeToLearn.shortLabel}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.questionText}>{question.text}</Text>

          <View style={styles.questionMeta}>
            <Text style={styles.metaText}>{visibleAnswerCount} pergjigje</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{question.views} shikime</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{expertAnswerCount} expert takes</Text>
          </View>

          {timeToLearn ? (
            <View style={styles.learnMeterCard}>
              <View style={styles.learnMeterHeader}>
                <Text style={styles.learnMeterEyebrow}>TIME TO LEARN</Text>
                <Text style={styles.learnMeterValue}>{timeToLearn.shortLabel}</Text>
              </View>
              <Text style={styles.learnMeterTitle}>{timeToLearn.label}</Text>
              <Text style={styles.learnMeterSummary}>{timeToLearn.summary}</Text>
              <View style={styles.learnMeterTrack}>
                <View
                  style={[
                    styles.learnMeterFill,
                    {
                      width: `${Math.max(
                        22,
                        Math.min(100, Math.round(((timeToLearn.minutes || 1) / 6) * 100))
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {expertRequest ? (
            <View style={styles.priorityRequestCard}>
              <View style={styles.priorityRequestHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>ASK EXPERTS</Text>
                  <Text style={styles.priorityRequestTitle}>
                    {expertRequest.status === "answered"
                      ? "Pergjigjja prioritare mberriti"
                      : "Priority request ne radhe"}
                  </Text>
                </View>
                <View style={styles.priorityRequestPrice}>
                  <Text style={styles.priorityRequestPriceText}>{expertRequest.priceLabel}</Text>
                </View>
              </View>

              <View style={styles.priorityExpertRow}>
                <View style={styles.priorityExpertAvatar}>
                  <Text style={styles.priorityExpertAvatarText}>
                    {(expertRequest.expert?.username || "e").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.priorityExpertCopy}>
                  <Text style={styles.priorityExpertName}>
                    @{expertRequest.expert?.username || "expert"}
                  </Text>
                  <Text style={styles.priorityExpertReason}>
                    {expertRequest.expert?.expertise?.reason || "Verified fast-answer expert"}
                  </Text>
                </View>
              </View>

              <View style={styles.priorityMetaRow}>
                <Text style={styles.priorityMetaText}>
                  {expertRequest.status === "answered" ? "Delivered" : "Waiting for expert"}
                </Text>
                <Text style={styles.priorityMetaDot}>•</Text>
                <Text style={styles.priorityMetaText}>{expertRequest.maxAnswerSeconds || 10}s max</Text>
                <Text style={styles.priorityMetaDot}>•</Text>
                <Text style={styles.priorityMetaText}>
                  {expertRequest.paymentStatus === "captured" ? "Captured" : "Reserved"}
                </Text>
              </View>
            </View>
          ) : null}

          {microDefinitions.length ? (
            <View style={styles.definitionSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>INTERACTIVE</Text>
                  <Text style={styles.sectionTitle}>Micro Definitions</Text>
                </View>
                <Text style={styles.sectionHint}>Tap nje term</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.definitionChipsContent}
              >
                {microDefinitions.map((definition) => (
                  <TouchableOpacity
                    key={definition.id}
                    style={styles.definitionChip}
                    onPress={() => setSelectedDefinition(definition)}
                  >
                    <Ionicons name="sparkles" size={14} color="#ffb0b0" />
                    <Text style={styles.definitionChipText}>{definition.term}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {statusBanner ? (
          <View
            style={[
              styles.statusBanner,
              statusBanner.type === "approved" && styles.statusBannerApproved,
              statusBanner.type === "pending" && styles.statusBannerPending,
              statusBanner.type === "info" && styles.statusBannerInfo,
            ]}
          >
            <Text style={styles.statusBannerText}>{statusBanner.message}</Text>
          </View>
        ) : null}

        {mainAnswer?.type === "video" ? (
          <View style={styles.videoContainer}>
            <VideoView
              player={mainVideoPlayer}
              style={styles.mainVideo}
              contentFit="cover"
              nativeControls
            />

            <View style={styles.answerOverlay}>
              <View style={styles.userInfo}>
                <View style={styles.userAvatarPlaceholder}>
                  <Text style={styles.userAvatarText}>
                    {(mainAnswer.user?.username || "a").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userTextWrap}>
                  <View style={styles.userNameRow}>
                    <Text style={styles.username}>@{mainAnswer.user?.username || "anonymous"}</Text>
                    {mainAnswer.user?.expertise?.verified ? (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#95f0a0" />
                        <Text style={styles.verifiedBadgeText}>Verified</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.timestamp}>
                    {mainAnswer.user?.expertise?.reason || "Creator aktiv"}
                  </Text>
                </View>
              </View>

              <View style={styles.overlayRight}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankBadgeText}>{heroLabel}</Text>
                </View>
                <View style={styles.expertScorePill}>
                  <Text style={styles.expertScoreValue}>
                    {mainAnswer.user?.expertise?.score || 12}
                  </Text>
                  <Text style={styles.expertScoreLabel}>expert</Text>
                </View>
                <TouchableOpacity
                  style={styles.interactionButton}
                  onPress={() => handleLike(mainAnswer.id)}
                >
                  <Ionicons name="heart-outline" size={20} color="white" />
                  <Text style={styles.interactionText}>{mainAnswer.interactions?.likes || 0}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {mainAnswer && mainAnswer.type !== "video" ? (
          <View style={styles.textHeroCard}>
            <View style={styles.textHeroHeader}>
              <View style={styles.textHeroBadge}>
                <Ionicons name="flash" size={14} color="#ff4444" />
                <Text style={styles.textHeroBadgeText}>{heroLabel}</Text>
              </View>
              {mainAnswer.user?.expertise?.verified ? (
                <View style={styles.verifiedBadgeSolid}>
                  <Ionicons name="shield-checkmark" size={14} color="#95f0a0" />
                  <Text style={styles.verifiedBadgeText}>Verified Expert</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.textHeroText}>{mainAnswer.text || "Nuk ka tekst."}</Text>

            <View style={styles.textHeroFooter}>
              <View>
                <Text style={styles.answerUsername}>@{mainAnswer.user?.username || "anonymous"}</Text>
                <Text style={styles.answerReasonText}>
                  {mainAnswer.user?.expertise?.reason || "Creator aktiv"}
                </Text>
              </View>
              <View style={styles.heroFooterActions}>
                <View style={styles.expertScorePillCompact}>
                  <Text style={styles.expertScoreCompactText}>
                    {mainAnswer.user?.expertise?.score || 12}/100
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.smallInteractionButton}
                  onPress={() => handleLike(mainAnswer.id)}
                >
                  <Ionicons name="heart-outline" size={16} color="#ccc" />
                  <Text style={styles.smallInteractionText}>
                    {mainAnswer.interactions?.likes || 0}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {!mainAnswer ? (
          <View style={styles.emptyAnswersCard}>
            <Ionicons name="chatbubble-ellipses-outline" size={30} color="#666" />
            <Text style={styles.emptyAnswersTitle}>Ende pa pergjigje</Text>
            <Text style={styles.emptyAnswersText}>
              {expertOnly
                ? "Nuk ka ende expert answers per kete pyetje. Kalo te te gjitha pergjigjet ose posto nje answer te ri."
                : statusBanner?.type === "info"
                  ? "Po presim pergjigjet e para per kete pyetje..."
                  : "Behu i pari qe i pergjigjesh kesaj pyetjeje."}
            </Text>
          </View>
        ) : null}

        {answers.length >= 2 ? (
          <View style={styles.toolsRow}>
            <TouchableOpacity
              style={[styles.toolButton, compareMode && styles.toolButtonActive]}
              onPress={() => setCompareMode((prev) => !prev)}
            >
              <Ionicons name="trophy-outline" size={16} color="white" />
              <Text style={styles.toolButtonText}>Answer Battle</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {compareMode && compareAnswers.length >= 2 ? (
          <View style={styles.compareSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>ENGAGEMENT</Text>
                <Text style={styles.sectionTitle}>Video A vs Video B</Text>
              </View>
              {battleLoading ? <ActivityIndicator size="small" color="#fff" /> : null}
            </View>
            <Text style={styles.compareSubtitle}>
              Voto njehere. Fituesi merr XP boost dhe trending boost.
            </Text>
            <View style={styles.compareGrid}>
              {compareAnswers.map((answer, index) => (
                <TouchableOpacity
                  key={answer.id}
                  style={[
                    styles.compareCard,
                    mainAnswer?.id === answer.id && styles.compareCardActive,
                  ]}
                  onPress={() => handleSelectAnswer(answer.id)}
                >
                  <Text style={styles.compareRank}>{index === 0 ? "Video A" : "Video B"}</Text>
                  <Text style={styles.compareType}>
                    @{answer.user?.username || "anonymous"} • {answer.user?.followers || 0} followers
                  </Text>
                  <Text style={styles.compareText} numberOfLines={4}>
                    {answer.text || "Preke per ta bere pergjigjjen kryesore."}
                  </Text>
                  <Text style={styles.compareMeta}>
                    {(answer.battle?.votes || 0) +
                      " votes • " +
                      (answer.interactions?.likes || 0) +
                      " likes"}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.voteButton,
                      battleData?.userVoteAnswerId === answer.id && styles.voteButtonActive,
                      battleData?.userVoteAnswerId &&
                        battleData?.userVoteAnswerId !== answer.id &&
                        styles.voteButtonDisabled,
                    ]}
                    onPress={() => handleVoteBattle(answer.id)}
                    disabled={battleVoteLoading || Boolean(battleData?.userVoteAnswerId)}
                  >
                    <Text style={styles.voteButtonText}>
                      {battleVoteLoading
                        ? "..."
                        : battleData?.userVoteAnswerId === answer.id
                          ? "Votove"
                          : battleData?.userVoteAnswerId
                            ? "Votuar"
                            : "Voto"}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.compareFooterText}>
              {(battleData?.totalVotes || 0) +
                " vota totale • reward " +
                (battleData?.xpReward || 15) +
                " XP"}
            </Text>
          </View>
        ) : null}
        <View style={styles.discoverySection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>TRUST ENGINE</Text>
              <Text style={styles.sectionTitle}>Filtro pergjigjet</Text>
            </View>
            <Text style={styles.sectionHint}>{expertAnswerCount} verified</Text>
          </View>

          <View style={styles.sortContainer}>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === "top" && styles.sortButtonActive]}
              onPress={() => setSortBy("top")}
            >
              <Text style={[styles.sortText, sortBy === "top" && styles.sortTextActive]}>
                Best
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === "trending" && styles.sortButtonActive]}
              onPress={() => setSortBy("trending")}
            >
              <Text style={[styles.sortText, sortBy === "trending" && styles.sortTextActive]}>
                Trending
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === "newest" && styles.sortButtonActive]}
              onPress={() => setSortBy("newest")}
            >
              <Text style={[styles.sortText, sortBy === "newest" && styles.sortTextActive]}>
                New
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.expertToggle, expertOnly && styles.expertToggleActive]}
            onPress={() => setExpertOnly((prev) => !prev)}
          >
            <Ionicons
              name={expertOnly ? "shield-checkmark" : "shield-outline"}
              size={16}
              color={expertOnly ? "#95f0a0" : "#d4d4d4"}
            />
            <Text style={[styles.expertToggleText, expertOnly && styles.expertToggleTextActive]}>
              Show Expert Answers Only
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.answersSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>ANSWERS</Text>
              <Text style={styles.sectionTitle}>Perspektivat me te mira</Text>
            </View>
            {loadingAnswers ? <ActivityIndicator size="small" color="#fff" /> : null}
          </View>

          {answers.map((answer, index) => {
            const answerLabel =
              answer.id === highlightAnswerId
                ? "Pergjigjja jote"
                : index === 0 && sortBy === "top"
                  ? "Best Answer"
                  : index === 0 && sortBy === "newest"
                    ? "New Answer"
                    : index === 0 && sortBy === "trending"
                      ? "Trending Answer"
                      : null;

            return (
              <TouchableOpacity
                key={answer.id}
                style={[
                  styles.answerCard,
                  answer.id === mainAnswer?.id && styles.answerCardSelected,
                  answer.id === highlightAnswerId && styles.answerCardHighlighted,
                ]}
                onPress={() => handleSelectAnswer(answer.id)}
              >
                <View style={styles.answerCardHeader}>
                  <View style={styles.answerHeaderCopy}>
                    <View style={styles.answerAuthorRow}>
                      <Text style={styles.answerUsername}>@{answer.user?.username || "anonymous"}</Text>
                      {answer.user?.expertise?.verified ? (
                        <View style={styles.answerVerifiedPill}>
                          <Ionicons name="checkmark-circle" size={14} color="#95f0a0" />
                          <Text style={styles.answerVerifiedText}>Verified</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.answerReasonText}>
                      {answer.user?.expertise?.reason || "Creator aktiv"}
                    </Text>
                  </View>

                  <View style={styles.answerBadgeColumn}>
                    {answerLabel ? (
                      <View style={styles.freshPill}>
                        <Text style={styles.freshPillText}>{answerLabel}</Text>
                      </View>
                    ) : null}
                    <View style={styles.answerScoreBadge}>
                      <Text style={styles.answerScoreText}>
                        {answer.user?.expertise?.score || 12}/100
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.answerTypeLabel}>
                  {answer.type === "video" ? "Pergjigje me video" : "Pergjigje me tekst"}
                </Text>

                {answer.type === "text" ? (
                  <Text style={styles.answerText}>{answer.text}</Text>
                ) : (
                  <Text style={styles.answerTextMuted}>
                    Hape siper per ta pare videon. Mund ta krahasosh edhe me pergjigjet e tjera.
                  </Text>
                )}

                <View style={styles.answerFooter}>
                  <View style={styles.answerFooterMeta}>
                    {answer.battle?.votes ? (
                      <Text style={styles.answerBattleText}>
                        {answer.battle.votes} battle votes
                      </Text>
                    ) : null}
                    {answer.status === "pending" ? (
                      <Text style={styles.answerPendingText}>Ne pritje te rishikimit</Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={styles.smallInteractionButton}
                    onPress={() => handleLike(answer.id)}
                  >
                    <Ionicons name="heart-outline" size={16} color="#ccc" />
                    <Text style={styles.smallInteractionText}>
                      {answer.interactions?.likes || 0}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {mainAnswer ? (
          <View style={styles.commentsSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>AI COMMENT LAYER</Text>
                <Text style={styles.sectionTitle}>Comments & suggested reactions</Text>
              </View>
              {loadingComments ? <ActivityIndicator size="small" color="#fff" /> : null}
            </View>

            <Text style={styles.commentsSubtitle}>
              Sugjerimet poshte vijne nga AI sipas pyetjes dhe answer-it qe po sheh tani.
            </Text>

            {suggestedReactions.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestedReactionRow}
              >
                {suggestedReactions.map((item) => (
                  <TouchableOpacity
                    key={item.id || item.text}
                    style={styles.suggestedReactionChip}
                    onPress={() => void handleSubmitComment(item.text)}
                  >
                    <Text style={styles.suggestedReactionText}>
                      {item.emoji ? `${item.emoji} ` : ""}
                      {item.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.commentComposer}>
              <TextInput
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Shkruaj nje koment..."
                placeholderTextColor="#7b7b7b"
                style={styles.commentInput}
                multiline
              />
              <TouchableOpacity
                style={[styles.commentSendButton, postingComment && styles.commentSendButtonDisabled]}
                onPress={() => void handleSubmitComment()}
                disabled={postingComment}
              >
                {postingComment ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons name="send" size={16} color="white" />
                )}
              </TouchableOpacity>
            </View>

            {comments.length ? (
              comments.map((comment) => (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentUser}>@{comment.userId || "user"}</Text>
                    {comment.suggestedByAi ? (
                      <View style={styles.commentAiBadge}>
                        <Ionicons name="sparkles" size={12} color="#ffb788" />
                        <Text style={styles.commentAiBadgeText}>AI seed</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.commentBody}>{comment.text}</Text>
                  <Text style={styles.commentMeta}>
                    {comment.moderation?.severity || "low"} risk •{" "}
                    {comment.moderation?.reason || "approved"}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCommentCard}>
                <Text style={styles.emptyCommentTitle}>Ende pa komente.</Text>
                <Text style={styles.emptyCommentText}>
                  Perdori reaction chips per te ndezur biseden pa friction.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {questionChain.length ? (
          <View style={styles.relatedSection}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>KNOWLEDGE GRAPH</Text>
                <Text style={styles.sectionTitle}>Question Chains</Text>
              </View>
              <Text style={styles.sectionHint}>Learning journey</Text>
            </View>

            {questionChain.map((item) => {
              const tone = getChainTone(item.chainType);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.relatedCard}
                  onPress={() => handleOpenRelatedQuestion(item.id)}
                >
                  <View style={styles.relatedCardHeader}>
                    <View
                      style={[styles.relatedLabel, { backgroundColor: tone.backgroundColor }]}
                    >
                      <Text style={[styles.relatedLabelText, { color: tone.color }]}>
                        {item.chainLabel}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#ff6666" />
                  </View>
                  <Text style={styles.relatedQuestionText}>{item.text}</Text>
                  <View style={styles.relatedMetaRow}>
                    <Text style={styles.relatedMeta}>{item.category}</Text>
                    <Text style={styles.relatedMeta}>{item.answerCount || 0} pergjigje</Text>
                    <Text style={styles.relatedMeta}>{item.timeToLearn?.shortLabel || "2 min"}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={handleOpenUpload}>
        <Ionicons name="add" size={24} color="white" />
        <Text style={styles.addButtonText}>Pergjigju</Text>
      </TouchableOpacity>
      <FloatingAiEntry
        bottomOffset={96}
        feature="duet"
        queryHint="Si ta kthej kete answer ne duet ose content viral?"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  page: {
    flex: 1,
  },
  pageContent: {
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "black",
  },
  notFoundText: {
    color: "white",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  questionShell: {
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  questionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,68,68,0.16)",
  },
  categoryText: {
    color: "#ff9e9e",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  learnBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  learnBadgeText: {
    color: "#ffd2d2",
    fontSize: 12,
    fontWeight: "700",
  },
  questionText: {
    color: "white",
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "900",
    marginTop: 14,
  },
  questionMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 10,
  },
  metaText: {
    color: "#cfcfcf",
    fontSize: 13,
  },
  metaDot: {
    color: "#7a7a7a",
    fontSize: 12,
    marginHorizontal: 8,
  },
  learnMeterCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  learnMeterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  learnMeterEyebrow: {
    color: "#8f8f8f",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  learnMeterValue: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  learnMeterTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 10,
  },
  learnMeterSummary: {
    color: "#d0d0d0",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  learnMeterTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginTop: 12,
    overflow: "hidden",
  },
  learnMeterFill: {
    height: "100%",
    backgroundColor: "#ff5555",
    borderRadius: 999,
  },
  priorityRequestCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,152,64,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,152,64,0.18)",
  },
  priorityRequestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  priorityRequestTitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "800",
  },
  priorityRequestPrice: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  priorityRequestPriceText: {
    color: "#ffe0c2",
    fontSize: 12,
    fontWeight: "800",
  },
  priorityExpertRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  priorityExpertAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    marginRight: 12,
  },
  priorityExpertAvatarText: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },
  priorityExpertCopy: {
    flex: 1,
  },
  priorityExpertName: {
    color: "white",
    fontSize: 15,
    fontWeight: "800",
  },
  priorityExpertReason: {
    color: "#f0d4bc",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  priorityMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 12,
  },
  priorityMetaText: {
    color: "#fff2e3",
    fontSize: 12,
    fontWeight: "700",
  },
  priorityMetaDot: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    marginHorizontal: 8,
  },
  definitionSection: {
    marginTop: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionEyebrow: {
    color: "#898989",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionHint: {
    color: "#a6a6a6",
    fontSize: 12,
    fontWeight: "600",
  },
  definitionChipsContent: {
    paddingTop: 12,
    gap: 8,
  },
  definitionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,68,68,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,122,122,0.18)",
  },
  definitionChipText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  statusBanner: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statusBannerApproved: {
    backgroundColor: "rgba(76,175,80,0.16)",
    borderWidth: 1,
    borderColor: "rgba(76,175,80,0.25)",
  },
  statusBannerPending: {
    backgroundColor: "rgba(255,179,71,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,179,71,0.25)",
  },
  statusBannerInfo: {
    backgroundColor: "rgba(106,165,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(106,165,255,0.25)",
  },
  statusBannerText: {
    color: "white",
    fontSize: 14,
    lineHeight: 20,
  },
  videoContainer: {
    height: height * 0.36,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#0d0d0d",
  },
  mainVideo: {
    flex: 1,
  },
  answerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.74)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "rgba(255,68,68,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },
  userTextWrap: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  username: {
    color: "white",
    fontSize: 15,
    fontWeight: "800",
  },
  timestamp: {
    color: "#c7c7c7",
    fontSize: 12,
    marginTop: 4,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(149,240,160,0.12)",
  },
  verifiedBadgeSolid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(149,240,160,0.12)",
  },
  verifiedBadgeText: {
    color: "#c8f5cf",
    fontSize: 11,
    fontWeight: "800",
  },
  overlayRight: {
    alignItems: "flex-end",
    gap: 10,
  },
  rankBadge: {
    backgroundColor: "rgba(255,68,68,0.16)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rankBadgeText: {
    color: "#ffb3b3",
    fontSize: 12,
    fontWeight: "700",
  },
  expertScorePill: {
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  expertScoreValue: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },
  expertScoreLabel: {
    color: "#cfcfcf",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  interactionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  interactionText: {
    color: "white",
    fontSize: 14,
  },
  textHeroCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 18,
  },
  textHeroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  textHeroBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,68,68,0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  textHeroBadgeText: {
    color: "#ff7777",
    fontWeight: "700",
    fontSize: 12,
    marginLeft: 6,
  },
  textHeroText: {
    color: "white",
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "600",
  },
  textHeroFooter: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  heroFooterActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  expertScorePillCompact: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  expertScoreCompactText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyAnswersCard: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 24,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptyAnswersTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 12,
  },
  emptyAnswersText: {
    color: "#aaa",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  toolsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  toolButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 8,
  },
  toolButtonActive: {
    backgroundColor: "rgba(255,68,68,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,68,68,0.35)",
  },
  toolButtonText: {
    color: "white",
    fontWeight: "700",
  },
  compareSection: {
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  compareSubtitle: {
    color: "#d2d2d2",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 12,
  },
  compareGrid: {
    flexDirection: "row",
    gap: 10,
  },
  compareCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  compareCardActive: {
    borderColor: "rgba(255,99,99,0.32)",
    backgroundColor: "rgba(255,68,68,0.08)",
  },
  compareRank: {
    color: "#ff6b6b",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },
  compareType: {
    color: "#d8d8d8",
    fontSize: 12,
    marginBottom: 8,
  },
  compareText: {
    color: "white",
    fontSize: 14,
    lineHeight: 20,
    minHeight: 80,
  },
  compareMeta: {
    color: "#b5b5b5",
    fontSize: 12,
    marginTop: 10,
  },
  voteButton: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,68,68,0.22)",
  },
  voteButtonActive: {
    backgroundColor: "rgba(76,175,80,0.2)",
  },
  voteButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  voteButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 13,
  },
  compareFooterText: {
    color: "#bdbdbd",
    fontSize: 12,
    marginTop: 12,
  },
  discoverySection: {
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  sortContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  sortButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  sortButtonActive: {
    backgroundColor: "#ff4444",
  },
  sortText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  sortTextActive: {
    fontWeight: "800",
  },
  expertToggle: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  expertToggleActive: {
    backgroundColor: "rgba(149,240,160,0.14)",
    borderWidth: 1,
    borderColor: "rgba(149,240,160,0.18)",
  },
  expertToggleText: {
    color: "#e0e0e0",
    fontSize: 13,
    fontWeight: "700",
  },
  expertToggleTextActive: {
    color: "#d8f6dc",
  },
  answersSection: {
    marginHorizontal: 20,
    marginTop: 18,
  },
  answerCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 16,
    borderRadius: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  answerCardSelected: {
    borderColor: "rgba(255,99,99,0.34)",
  },
  answerCardHighlighted: {
    backgroundColor: "rgba(255,68,68,0.08)",
  },
  answerCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  answerHeaderCopy: {
    flex: 1,
  },
  answerAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  answerBadgeColumn: {
    alignItems: "flex-end",
    gap: 8,
  },
  answerVerifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(149,240,160,0.12)",
  },
  answerVerifiedText: {
    color: "#c8f5cf",
    fontSize: 11,
    fontWeight: "800",
  },
  answerScoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  answerScoreText: {
    color: "white",
    fontSize: 11,
    fontWeight: "800",
  },
  answerTypeLabel: {
    color: "#f0f0f0",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
  },
  answerText: {
    color: "white",
    fontSize: 16,
    marginTop: 10,
    lineHeight: 24,
  },
  answerTextMuted: {
    color: "#bdbdbd",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  answerFooter: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  answerFooterMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  answerUsername: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },
  answerReasonText: {
    color: "#bdbdbd",
    fontSize: 12,
    marginTop: 4,
  },
  answerBattleText: {
    color: "#ffb0b0",
    fontSize: 12,
    fontWeight: "700",
  },
  answerPendingText: {
    color: "#ffd28a",
    fontSize: 12,
    fontWeight: "700",
  },
  smallInteractionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  smallInteractionText: {
    color: "#f0f0f0",
    fontSize: 13,
    fontWeight: "700",
  },
  freshPill: {
    backgroundColor: "rgba(255,68,68,0.14)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  freshPillText: {
    color: "#ffb7b7",
    fontSize: 11,
    fontWeight: "800",
  },
  relatedSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  relatedCard: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  relatedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  relatedLabel: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  relatedLabelText: {
    fontSize: 11,
    fontWeight: "800",
  },
  relatedQuestionText: {
    color: "white",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 12,
  },
  relatedMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  relatedMeta: {
    color: "#bdbdbd",
    fontSize: 12,
  },
  commentsSection: {
    marginTop: 18,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 24,
    backgroundColor: "#111111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  commentsSubtitle: {
    color: "#bdbdbd",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  suggestedReactionRow: {
    gap: 10,
    paddingVertical: 14,
  },
  suggestedReactionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,138,0,0.18)",
  },
  suggestedReactionText: {
    color: "#ffe3cf",
    fontSize: 12,
    fontWeight: "700",
  },
  commentComposer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  commentInput: {
    flex: 1,
    minHeight: 50,
    maxHeight: 110,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "white",
    fontSize: 14,
    textAlignVertical: "top",
  },
  commentSendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#ff5b4d",
    alignItems: "center",
    justifyContent: "center",
  },
  commentSendButtonDisabled: {
    opacity: 0.7,
  },
  commentCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  commentUser: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },
  commentAiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,138,0,0.12)",
  },
  commentAiBadgeText: {
    color: "#ffb788",
    fontSize: 11,
    fontWeight: "800",
  },
  commentBody: {
    color: "#f0f0f0",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  commentMeta: {
    color: "#9f9f9f",
    fontSize: 11,
    marginTop: 10,
    textTransform: "capitalize",
  },
  emptyCommentCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emptyCommentTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyCommentText: {
    color: "#a5a5a5",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  addButton: {
    position: "absolute",
    right: 20,
    bottom: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff4444",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  addButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  modalEyebrow: {
    color: "#8f8f8f",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  modalTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  modalDefinition: {
    color: "#f0f0f0",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
  },
  visualCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(255,68,68,0.08)",
  },
  visualBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  visualBadgeText: {
    color: "#ffd0d0",
    fontSize: 11,
    fontWeight: "800",
  },
  visualText: {
    color: "white",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  modalActionButton: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 14,
    backgroundColor: "#ff4444",
  },
  modalActionText: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },
});




