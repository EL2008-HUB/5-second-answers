import React, { useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  Image,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

type Answer = {
  id: string;
  contentUrl: string;
  questionId: string;
  duration?: number | null;
  text?: string;
  battle?: {
    votes: number;
    isLeading: boolean;
  };
  user?: {
    username: string;
    avatar?: string;
    followers?: number;
  };
  interactions?: {
    likes: number;
    views: number;
    saves: number;
    shares?: number;
  };
};

type Question = {
  id: string;
  text: string;
  category: string;
  answerCount: number;
};

type Props = {
  videoUrl: string;
  isActive: boolean;
  answer?: Answer;
  question?: Question;
  isFollowing?: boolean;
  isFollowLoading?: boolean;
  onLike?: (answerId: string) => void;
  onSave?: (answerId: string) => void;
  onShare?: (answerId: string) => void;
  onPlaybackSession?: (
    answerId: string,
    payload: { watchTimeMs: number; replayCount: number; completed: boolean }
  ) => void;
  onQuestionPress?: (questionId: string) => void;
  onToggleFollow?: (username: string) => void;
};

export default function FeedVideoCard({
  videoUrl,
  isActive,
  answer,
  question,
  isFollowing = false,
  isFollowLoading = false,
  onLike,
  onSave,
  onShare,
  onPlaybackSession,
  onQuestionPress,
  onToggleFollow,
}: Props) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const watchTimeMsRef = useRef(0);
  const replayCountRef = useRef(0);
  const completedRef = useRef(false);
  const lastObservedTimeRef = useRef(0);
  const completionMarkedRef = useRef(false);
  const answerDuration = Math.min(Math.max(Number(answer?.duration || 5), 1), 10);

  const player = useVideoPlayer(videoUrl, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = false;
    videoPlayer.volume = 0.5;
    videoPlayer.timeUpdateEventInterval = 0.1;
  });

  const flushPlaybackSession = () => {
    if (!answer?.id || !onPlaybackSession) {
      return;
    }

    const payload = {
      watchTimeMs: Math.round(watchTimeMsRef.current),
      replayCount: replayCountRef.current,
      completed: completedRef.current,
    };

    if (payload.watchTimeMs || payload.replayCount || payload.completed) {
      onPlaybackSession(answer.id, payload);
    }

    watchTimeMsRef.current = 0;
    replayCountRef.current = 0;
    completedRef.current = false;
    lastObservedTimeRef.current = 0;
    completionMarkedRef.current = false;
  };

  useEffect(() => {
    if (isActive) {
      player.play();
      return;
    }

    player.pause();
    flushPlaybackSession();
    setProgress(0);
  }, [answerDuration, isActive, player]);

  useEffect(() => () => flushPlaybackSession(), []);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const interval = setInterval(() => {
      const duration = Math.max(Number(player.duration || 0), answerDuration, 5);
      const current = Math.max(0, Number(player.currentTime || 0));
      const previous = lastObservedTimeRef.current;

      if (current + 0.35 < previous && previous / duration > 0.8) {
        replayCountRef.current += 1;
        completionMarkedRef.current = false;
      }

      const delta = current >= previous ? current - previous : current;
      if (delta > 0 && delta < 2) {
        watchTimeMsRef.current += delta * 1000;
      }

      if (!completionMarkedRef.current && current / duration >= 0.95) {
        completedRef.current = true;
        completionMarkedRef.current = true;
      }

      lastObservedTimeRef.current = current;
      setProgress(Math.min(current / duration, 1));
    }, 250);

    return () => clearInterval(interval);
  }, [isActive, player]);

  const handleLike = () => {
    setLiked((prev) => !prev);
    if (answer && onLike) {
      onLike(answer.id);
    }
  };

  const handleSave = () => {
    setSaved((prev) => !prev);
    if (answer && onSave) {
      onSave(answer.id);
    }
  };

  const handleQuestionPress = () => {
    if (question && onQuestionPress) {
      onQuestionPress(question.id);
    }
  };

  const handleShare = () => {
    if (answer?.id && onShare) {
      onShare(answer.id);
    }
  };

  const handleFollow = () => {
    const username = answer?.user?.username;
    if (username && onToggleFollow) {
      onToggleFollow(username);
    }
  };

  const completionPercent = Math.round(progress * 100);
  const followersCount = answer?.user?.followers || 0;
  const durationLabel = answerDuration <= 5 ? "5s core" : `${answerDuration}s deep`;

  return (
    <View style={styles.container}>
      <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} />

      <View style={styles.topShade} />

      <TouchableOpacity style={styles.questionOverlay} onPress={handleQuestionPress}>
        <View style={styles.questionBadge}>
          <Ionicons name="help-circle" size={14} color="#ffb3b3" />
          <Text style={styles.questionBadgeText}>Prek pyetjen</Text>
        </View>
        <Text style={styles.questionText}>{question?.text || "Po ngarkohet pyetja..."}</Text>
        <View style={styles.questionMeta}>
          <Text style={styles.categoryText}>{question?.category || "general"}</Text>
          <Text style={styles.answersPrompt}>
            {(question?.answerCount || 0) + " pergjigje - hape pyetjen per me shume"}
          </Text>
        </View>
      </TouchableOpacity>

      {answer?.text ? (
        <View style={styles.answerOverlay}>
          <Text style={styles.answerText}>{answer.text}</Text>
        </View>
      ) : null}

      {answer?.user ? (
        <View style={styles.userOverlay}>
          <View style={styles.userIdentity}>
            {answer.user.avatar ? (
              <Image source={{ uri: answer.user.avatar }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={18} color="#666" />
              </View>
            )}
            <View>
              <Text style={styles.username}>@{answer.user.username}</Text>
              <Text style={styles.userSubtitle}>{followersCount} followers • Krijues</Text>
            </View>
          </View>

          {answer.user.username !== "demo_user" ? (
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followButtonActive]}
              onPress={handleFollow}
              disabled={isFollowLoading}
            >
              <Text style={styles.followButtonText}>
                {isFollowLoading ? "..." : isFollowing ? "Po e ndjek" : "Ndiq"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <View style={styles.interactions}>
        <TouchableOpacity style={styles.button} onPress={handleLike}>
          <Ionicons
            name={liked ? "heart" : "heart-outline"}
            size={28}
            color={liked ? "#ff4444" : "white"}
          />
          <Text style={styles.buttonText}>{answer?.interactions?.likes || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={28}
            color={saved ? "#6aa5ff" : "white"}
          />
          <Text style={styles.buttonText}>{answer?.interactions?.saves || 0}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={28} color="white" />
          <Text style={styles.buttonText}>{answer?.interactions?.shares || 0}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomInfo}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.viewsText}>{answer?.interactions?.views || 0} shikime</Text>
          {answer?.battle?.votes ? (
            <Text style={styles.debugText}>
              {answer.battle.isLeading ? "Battle leader" : "Battle"} • {answer.battle.votes} votes
            </Text>
          ) : __DEV__ ? (
            <Text style={styles.debugText}>
              {durationLabel} • completion {completionPercent}%
            </Text>
          ) : (
            <Text style={styles.debugText}>{durationLabel}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    position: "relative",
  },
  video: {
    flex: 1,
  },
  topShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  questionOverlay: {
    position: "absolute",
    top: 64,
    left: 16,
    right: 86,
    backgroundColor: "rgba(0,0,0,0.72)",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  questionBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,68,68,0.16)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  questionBadgeText: {
    color: "#ffb3b3",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 6,
  },
  questionText: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
    marginBottom: 8,
  },
  questionMeta: {
    gap: 4,
  },
  categoryText: {
    color: "#ff6b6b",
    fontSize: 12,
    textTransform: "capitalize",
    fontWeight: "700",
  },
  answersPrompt: {
    color: "#d9d9d9",
    fontSize: 12,
  },
  answerOverlay: {
    position: "absolute",
    bottom: 148,
    left: 16,
    right: 86,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 10,
    borderRadius: 12,
  },
  answerText: {
    color: "white",
    fontSize: 14,
    fontStyle: "italic",
    lineHeight: 19,
  },
  userOverlay: {
    position: "absolute",
    bottom: 92,
    left: 16,
    right: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  userIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: width - 150,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
  },
  username: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  userSubtitle: {
    color: "#b7b7b7",
    fontSize: 12,
    marginTop: 2,
  },
  followButton: {
    backgroundColor: "#ff4444",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  followButtonActive: {
    backgroundColor: "#2f2f2f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  followButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  interactions: {
    position: "absolute",
    bottom: 116,
    right: 16,
    alignItems: "center",
  },
  button: {
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "white",
    fontSize: 12,
    marginTop: 4,
  },
  bottomInfo: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#ff4444",
    borderRadius: 999,
  },
  metaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewsText: {
    color: "#d4d4d4",
    fontSize: 12,
  },
  debugText: {
    color: "#a8a8a8",
    fontSize: 12,
  },
});

