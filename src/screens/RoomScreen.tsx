import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
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
import * as ExpoLinking from "expo-linking";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import FloatingAiEntry from "../components/FloatingAiEntry";
import { API_CONFIG, getApiUrl } from "../config/api";
import { createRoomSocket } from "../services/roomSocket";
import { colors, MVP_USER_ID, readJsonSafely } from "../theme/mvp";

type RoomUser = {
  isOnline?: boolean;
  joinedAt?: string | null;
  lastSeenAt?: string | null;
  socketId?: string | null;
  status?: string;
  userId: string;
  username: string;
};

type TypingUser = {
  userId: string;
  username: string;
};

type RoomAnswer = {
  id: string;
  userId: string;
  username: string;
  type: "text" | "audio" | "video";
  text?: string | null;
  mediaUrl?: string | null;
  mimeType?: string | null;
  duration?: number;
  createdAt?: string;
};

type RoomSnapshot = {
  answerCount: number;
  answers: RoomAnswer[];
  expiresAt?: string | null;
  id: string;
  inviteCode: string;
  lastActivityAt?: string | null;
  maxUsers: number;
  presenceBackend?: string;
  presenceUsers: RoomUser[];
  questionText: string;
  shareUrl: string;
  status: string;
  title: string;
  topic: string;
  typingUsers: TypingUser[];
  userCount: number;
  users: RoomUser[];
};

const AUDIO_MODE = {
  allowsBackgroundRecording: false,
  allowsRecording: true,
  interruptionMode: "doNotMix" as const,
  playsInSilentMode: true,
  shouldPlayInBackground: false,
  shouldRouteThroughEarpiece: false,
};

const HEARTBEAT_MS = 15000;
const TYPING_IDLE_MS = 1400;

const formatTimeAgo = (value?: string | null) => {
  if (!value) {
    return "Tani";
  }

  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
};

export default function RoomScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const socketRef = useRef<ReturnType<typeof createRoomSocket> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initialRoomId = String(route.params?.roomId || "");
  const initialInviteCode = String(route.params?.inviteCode || "");
  const [resolvedRoomId, setResolvedRoomId] = useState(initialRoomId);
  const [resolvedInviteCode, setResolvedInviteCode] = useState(initialInviteCode);
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [users, setUsers] = useState<RoomUser[]>([]);
  const [answers, setAnswers] = useState<RoomAnswer[]>([]);
  const [presenceUsers, setPresenceUsers] = useState<RoomUser[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [copyingCode, setCopyingCode] = useState(false);

  const roomQuestion = room?.questionText || "Loading...";
  const canSendText = Boolean(text.trim()) && !sending;

  const sortedUsers = useMemo(
    () =>
      [...users].sort((left, right) => {
        const onlineDiff = Number(Boolean(right.isOnline)) - Number(Boolean(left.isOnline));
        if (onlineDiff !== 0) {
          return onlineDiff;
        }

        return left.username.localeCompare(right.username);
      }),
    [users]
  );

  const typingLabel = useMemo(() => {
    const others = typingUsers.filter((item) => item.userId !== MVP_USER_ID);
    if (!others.length) {
      return "";
    }

    if (others.length === 1) {
      return `${others[0].username} po shkruan...`;
    }

    return `${others.length} users po shkruajne...`;
  }, [typingUsers]);

  const applyRoomSnapshot = (snapshot: RoomSnapshot | null) => {
    if (!snapshot) {
      return;
    }

    setRoom(snapshot);
    setUsers(Array.isArray(snapshot.users) ? snapshot.users : []);
    setAnswers(Array.isArray(snapshot.answers) ? snapshot.answers : []);
    setPresenceUsers(Array.isArray(snapshot.presenceUsers) ? snapshot.presenceUsers : []);
    setTypingUsers(Array.isArray(snapshot.typingUsers) ? snapshot.typingUsers : []);
    setResolvedRoomId(snapshot.id || resolvedRoomId);
    if (snapshot.inviteCode) {
      setResolvedInviteCode(snapshot.inviteCode);
    }
  };

  const stopTypingSoon = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      if (!resolvedRoomId) {
        return;
      }

      socketRef.current?.emit("typing_stop", {
        roomId: resolvedRoomId,
        userId: MVP_USER_ID,
        username: MVP_USER_ID,
      });
    }, TYPING_IDLE_MS);
  };

  const stopTypingImmediately = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (!resolvedRoomId) {
      return;
    }

    socketRef.current?.emit("typing_stop", {
      roomId: resolvedRoomId,
      userId: MVP_USER_ID,
      username: MVP_USER_ID,
    });
  };

  const fetchRoom = async () => {
    const roomId = resolvedRoomId.trim();
    const inviteCode = resolvedInviteCode.trim();

    if (!roomId && !inviteCode) {
      Alert.alert("Room", "Linku ose room id mungon.");
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);

      const endpoint = roomId
        ? API_CONFIG.endpoints.rooms.detail(roomId)
        : API_CONFIG.endpoints.rooms.invite(inviteCode);
      const response = await fetch(getApiUrl(endpoint));
      const data = (await readJsonSafely(response)) as RoomSnapshot | { error?: string } | null;

      if (!response.ok || !data || !("id" in data)) {
        throw new Error((data as { error?: string } | null)?.error || "Failed to load room");
      }

      applyRoomSnapshot(data);
    } catch (error) {
      console.error("Room fetch error:", error);
      Alert.alert("Gabim", "Room nuk u ngarkua.");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRoomId && initialRoomId !== resolvedRoomId) {
      setResolvedRoomId(initialRoomId);
    }
    if (initialInviteCode && initialInviteCode !== resolvedInviteCode) {
      setResolvedInviteCode(initialInviteCode);
    }
  }, [initialInviteCode, initialRoomId, resolvedInviteCode, resolvedRoomId]);

  useEffect(() => {
    void fetchRoom();
  }, [resolvedInviteCode, resolvedRoomId]);

  useEffect(() => {
    if (!resolvedRoomId) {
      return;
    }

    const socket = createRoomSocket();
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_room", {
        roomId: resolvedRoomId,
        userId: MVP_USER_ID,
        username: MVP_USER_ID,
      });
    });

    socket.on("room_state", (snapshot: RoomSnapshot) => {
      applyRoomSnapshot(snapshot);
    });

    socket.on("presence_state", (nextPresenceUsers: RoomUser[]) => {
      setPresenceUsers(Array.isArray(nextPresenceUsers) ? nextPresenceUsers : []);
    });

    socket.on("typing_state", (nextTypingUsers: TypingUser[]) => {
      setTypingUsers(Array.isArray(nextTypingUsers) ? nextTypingUsers : []);
    });

    socket.on("user_joined", (nextUsers: RoomUser[]) => {
      setUsers(Array.isArray(nextUsers) ? nextUsers : []);
    });

    socket.on("user_left", (nextUsers: RoomUser[]) => {
      setUsers(Array.isArray(nextUsers) ? nextUsers : []);
    });

    socket.on("new_answer", (entry: RoomAnswer) => {
      setAnswers((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
    });

    socket.on("room_expired", (payload: { message?: string }) => {
      Alert.alert("Room u mbyll", payload?.message || "Ky room nuk eshte me aktiv.", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
    });

    socket.on("room_error", (payload: { message?: string }) => {
      Alert.alert("Room", payload?.message || "Ndodhi nje problem ne room.");
    });

    const heartbeat = setInterval(() => {
      socket.emit("heartbeat", {
        roomId: resolvedRoomId,
        userId: MVP_USER_ID,
        username: MVP_USER_ID,
      });
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(heartbeat);
      stopTypingImmediately();
      socket.emit("leave_room", {
        roomId: resolvedRoomId,
        userId: MVP_USER_ID,
      });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [navigation, resolvedRoomId]);

  const emitAnswer = (payload: Partial<RoomAnswer>) => {
    if (!resolvedRoomId) {
      return;
    }

    socketRef.current?.emit("submit_answer", {
      roomId: resolvedRoomId,
      userId: MVP_USER_ID,
      username: MVP_USER_ID,
      ...payload,
    });
  };

  const handleTextChange = (value: string) => {
    setText(value);

    if (!resolvedRoomId) {
      return;
    }

    if (!value.trim()) {
      stopTypingImmediately();
      return;
    }

    socketRef.current?.emit("typing_start", {
      roomId: resolvedRoomId,
      userId: MVP_USER_ID,
      username: MVP_USER_ID,
    });
    stopTypingSoon();
  };

  const sendText = async () => {
    if (!canSendText) {
      return;
    }

    try {
      setSending(true);
      emitAnswer({
        text: text.trim(),
        type: "text",
      });
      setText("");
      stopTypingImmediately();
    } finally {
      setSending(false);
    }
  };

  const buildMediaFormData = async (
    fieldName: "audio" | "video",
    fileUri: string,
    filename: string,
    mimeType: string
  ) => {
    const formData = new FormData();

    if (Platform.OS === "web") {
      const response = await fetch(fileUri);
      const blob = await response.blob();
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

  const uploadAndEmitMedia = async ({
    duration = 0,
    fieldName,
    mimeType,
    type,
    uri,
  }: {
    uri: string;
    type: "audio" | "video";
    fieldName: "audio" | "video";
    mimeType: string;
    duration?: number;
  }) => {
    const filename = `${type}-${Date.now()}.${type === "audio" ? "m4a" : "mp4"}`;
    const formData = await buildMediaFormData(fieldName, uri, filename, mimeType);
    const response = await fetch(getApiUrl(API_CONFIG.endpoints.upload), {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    const data = (await readJsonSafely(response)) as { url?: string; message?: string } | null;

    if (!response.ok || !data?.url) {
      throw new Error(data?.message || "Failed to upload media");
    }

    emitAnswer({
      duration,
      mediaUrl: data.url,
      mimeType,
      type,
    });
  };

  const toggleAudioRecording = async () => {
    try {
      if (!recordingAudio) {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Permission", "Prano audio permission qe te regjistrosh.");
          return;
        }

        stopTypingImmediately();
        await setAudioModeAsync(AUDIO_MODE);
        await recorder.prepareToRecordAsync();
        recorder.record();
        setRecordingAudio(true);
        return;
      }

      setAudioUploading(true);
      await recorder.stop();
      const recordedUri = recorder.uri;
      setRecordingAudio(false);

      if (!recordedUri) {
        throw new Error("Audio file missing");
      }

      await uploadAndEmitMedia({
        duration: recorderState.durationMillis / 1000,
        fieldName: "audio",
        mimeType: "audio/m4a",
        type: "audio",
        uri: recordedUri,
      });
    } catch (error) {
      console.error("Audio room error:", error);
      Alert.alert("Gabim", "Audio answer nuk u dergua.");
      setRecordingAudio(false);
    } finally {
      setAudioUploading(false);
    }
  };

  const recordVideo = async () => {
    try {
      stopTypingImmediately();
      setVideoUploading(true);
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.7,
        videoMaxDuration: 20,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      await uploadAndEmitMedia({
        duration: (asset.duration || 0) / 1000,
        fieldName: "video",
        mimeType: asset.mimeType || "video/mp4",
        type: "video",
        uri: asset.uri,
      });
    } catch (error) {
      console.error("Video room error:", error);
      Alert.alert("Gabim", "Video answer nuk u dergua.");
    } finally {
      setVideoUploading(false);
    }
  };

  const shareRoomInvite = async () => {
    if (!room?.shareUrl) {
      return;
    }

    try {
      const appInviteLink = ExpoLinking.createURL(`room/${room.inviteCode}`);
      await Share.share({
        message:
          `${room.title}\n${room.questionText}\n\n` +
          `Open in app: ${appInviteLink}\n` +
          `Invite link: ${room.shareUrl}\n` +
          `Invite code: ${room.inviteCode}`,
      });
    } catch (error) {
      console.error("Share room invite error:", error);
    }
  };

  const copyRoomCode = async () => {
    if (!room?.inviteCode) {
      return;
    }

    try {
      setCopyingCode(true);
      await Clipboard.setStringAsync(room.inviteCode);
      Alert.alert("Copied", `Invite code ${room.inviteCode} u kopjua.`);
    } finally {
      setCopyingCode(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.accentWarm} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>LIVE ROOM</Text>
          <Text style={styles.title}>{room?.title || "Room"}</Text>
          <Text style={styles.subtitle}>{roomQuestion}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{room?.topic || "general"}</Text>
            <Text style={styles.metaText}>
              {room?.userCount || users.length}/{room?.maxUsers || 6} users
            </Text>
            <Text style={styles.metaText}>{room?.status || "waiting"}</Text>
            <Text style={styles.metaText}>
              {presenceUsers.length} online · {room?.presenceBackend || "memory"}
            </Text>
          </View>
          <View style={styles.inviteCard}>
            <View style={styles.inviteCopy}>
              <Text style={styles.inviteLabel}>Invite code</Text>
              <Text style={styles.inviteValue}>{room?.inviteCode || resolvedInviteCode || "----"}</Text>
            </View>
            <View style={styles.inviteActions}>
              <TouchableOpacity style={styles.inviteButton} onPress={() => void shareRoomInvite()}>
                <Ionicons name="share-social-outline" size={15} color={colors.text} />
                <Text style={styles.inviteButtonText}>Share link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.inviteButton} onPress={() => void copyRoomCode()}>
                {copyingCode ? (
                  <ActivityIndicator size="small" color={colors.text} />
                ) : (
                  <>
                    <Ionicons name="copy-outline" size={15} color={colors.text} />
                    <Text style={styles.inviteButtonText}>Copy code</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.cardTitle}>People in room</Text>
          <View style={styles.userRow}>
            {sortedUsers.map((user) => (
              <View key={user.userId} style={[styles.userChip, user.isOnline && styles.userChipOnline]}>
                <View style={[styles.presenceDot, user.isOnline && styles.presenceDotOnline]} />
                <Text style={styles.userChipText}>{user.username}</Text>
              </View>
            ))}
          </View>
          {typingLabel ? <Text style={styles.typingText}>{typingLabel}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Drop your take</Text>
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            onBlur={stopTypingImmediately}
            placeholder="Type a quick answer..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, !canSendText && styles.actionButtonDisabled]}
              disabled={!canSendText}
              onPress={() => void sendText()}
            >
              <Ionicons name="send" size={16} color={colors.text} />
              <Text style={styles.actionButtonText}>Send text</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, (audioUploading || recordingAudio) && styles.actionButtonHot]}
              onPress={() => void toggleAudioRecording()}
            >
              {audioUploading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name={recordingAudio ? "stop-circle" : "mic"} size={16} color={colors.text} />
                  <Text style={styles.actionButtonText}>
                    {recordingAudio
                      ? `Stop ${Math.floor(recorderState.durationMillis / 1000)}s`
                      : "Record audio"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, videoUploading && styles.actionButtonHot]}
              onPress={() => void recordVideo()}
            >
              {videoUploading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Ionicons name="videocam" size={16} color={colors.text} />
                  <Text style={styles.actionButtonText}>Record video</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Room feed</Text>
          {answers.length ? (
            answers.map((answer) => (
              <View key={answer.id} style={styles.answerCard}>
                <View style={styles.answerHeader}>
                  <Text style={styles.answerUser}>@{answer.username}</Text>
                  <Text style={styles.answerMeta}>
                    {answer.type.toUpperCase()} · {formatTimeAgo(answer.createdAt)}
                  </Text>
                </View>
                {answer.text ? <Text style={styles.answerText}>{answer.text}</Text> : null}
                {answer.mediaUrl ? (
                  <TouchableOpacity
                    style={styles.mediaLink}
                    onPress={() => {
                      if (answer.mediaUrl) {
                        void Linking.openURL(answer.mediaUrl);
                      }
                    }}
                  >
                    <Ionicons
                      name={answer.type === "audio" ? "headset" : "play-circle"}
                      size={16}
                      color={colors.text}
                    />
                    <Text style={styles.mediaLinkText}>
                      Open {answer.type} · {Math.round(Number(answer.duration || 0))}s
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              Asnje answer ende. Hape room-in me nje text, audio ose video.
            </Text>
          )}
        </View>
      </ScrollView>
      <FloatingAiEntry
        bottomOffset={26}
        feature="rooms"
        queryHint="Si ta bej kete room me engaging?"
      />
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
    backgroundColor: "rgba(255,138,0,0.12)",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 18,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.soft,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 16,
  },
  card: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  inviteCard: {
    borderRadius: 18,
    padding: 14,
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  inviteCopy: {
    gap: 6,
  },
  inviteLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  inviteValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 2,
  },
  inviteActions: {
    flexDirection: "row",
    gap: 10,
  },
  inviteButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  inviteButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  userRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  userChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userChipOnline: {
    backgroundColor: "rgba(48,209,88,0.10)",
  },
  presenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  presenceDotOnline: {
    backgroundColor: "#30D158",
  },
  userChipText: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  typingText: {
    color: colors.accentWarm,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: 88,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    textAlignVertical: "top",
    fontSize: 14,
  },
  actionRow: {
    gap: 10,
  },
  actionButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonHot: {
    backgroundColor: "rgba(255,77,77,0.16)",
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  answerCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    gap: 10,
  },
  answerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  answerUser: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  answerMeta: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  answerText: {
    color: colors.soft,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  mediaLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,138,0,0.1)",
  },
  mediaLinkText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
  },
});
