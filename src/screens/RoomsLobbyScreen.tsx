import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ExpoLinking from "expo-linking";
import { useNavigation, useRoute } from "@react-navigation/native";

import FloatingAiEntry from "../components/FloatingAiEntry";
import { API_CONFIG, getApiUrl } from "../config/api";
import { colors, MVP_USER_ID, readJsonSafely } from "../theme/mvp";

type RoomSummary = {
  inviteCode: string;
  id: string;
  title: string;
  topic: string;
  questionText: string;
  maxUsers: number;
  userCount: number;
  answerCount: number;
  shareUrl: string;
  status: string;
};

export default function RoomsLobbyScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [title, setTitle] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [topic, setTopic] = useState("general");
  const [inviteCode, setInviteCode] = useState(String(route.params?.inviteCode || ""));

  const loadRooms = async () => {
    try {
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.rooms.list));
      const data = (await readJsonSafely(response)) as { rooms?: RoomSummary[] } | null;

      if (!response.ok) {
        throw new Error("Failed to load rooms");
      }

      setRooms(Array.isArray(data?.rooms) ? data.rooms : []);
    } catch (error) {
      console.error("Rooms load error:", error);
      setRooms([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadRooms();
  }, []);

  useEffect(() => {
    const incomingCode = String(route.params?.inviteCode || "").trim();
    if (incomingCode) {
      setInviteCode(incomingCode);
    }
  }, [route.params?.inviteCode]);

  const joinWithInviteCode = async (rawCode?: string) => {
    const nextCode = String(rawCode ?? inviteCode).trim().toUpperCase();
    if (!nextCode) {
      Alert.alert("Invite code", "Vendos kodin e room-it.");
      return;
    }

    try {
      setJoiningByCode(true);
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.rooms.invite(nextCode)));
      const data = (await readJsonSafely(response)) as RoomSummary | { error?: string } | null;

      if (!response.ok || !data || !("id" in data)) {
        throw new Error((data as { error?: string } | null)?.error || "Room not found");
      }

      setInviteCode(nextCode);
      navigation.navigate("Room", {
        inviteCode: nextCode,
        roomId: data.id,
      });
    } catch (error) {
      console.error("Join room by invite error:", error);
      Alert.alert("Gabim", "Ky invite code nuk u gjet.");
    } finally {
      setJoiningByCode(false);
    }
  };

  const shareRoom = async (room: Pick<RoomSummary, "title" | "questionText" | "inviteCode" | "shareUrl">) => {
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
      console.error("Share room error:", error);
    }
  };

  const copyInviteCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert("Copied", `Invite code ${code} u kopjua.`);
  };

  const createRoom = async () => {
    if (!title.trim() || !questionText.trim()) {
      Alert.alert("Missing info", "Vendos titullin dhe pyetjen e room-it.");
      return;
    }

    try {
      setCreating(true);
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.rooms.create), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostUserId: MVP_USER_ID,
          questionText: questionText.trim(),
          title: title.trim(),
          topic: topic.trim() || "general",
        }),
      });
      const data = (await readJsonSafely(response)) as RoomSummary | { error?: string } | null;

      if (!response.ok || !data || !("id" in data)) {
        throw new Error((data as { error?: string } | null)?.error || "Failed to create room");
      }

      setTitle("");
      setQuestionText("");
      setTopic("general");
      navigation.navigate("Room", {
        roomId: data.id,
      });
    } catch (error) {
      console.error("Create room error:", error);
      Alert.alert("Gabim", "Room nuk u krijua.");
    } finally {
      setCreating(false);
    }
  };

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
              void loadRooms();
            }}
            tintColor={colors.accentWarm}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>ROOMS</Text>
            <Text style={styles.title}>Hyr ne room live dhe pergjigju ne kohe reale.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create Room</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Titulli i room-it"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TextInput
            value={questionText}
            onChangeText={setQuestionText}
            placeholder="Pyetja qe do ndani ne room"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.inputTall]}
            multiline
          />
          <TextInput
            value={topic}
            onChangeText={setTopic}
            placeholder="Tema: funny, deep, politics..."
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <TouchableOpacity style={styles.primaryButton} onPress={() => void createRoom()}>
            {creating ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.primaryButtonText}>Create and Join</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Join with invite</Text>
          <TextInput
            autoCapitalize="characters"
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="P.sh. 7KQ2LM"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={styles.inlineRow}>
            <TouchableOpacity
              style={[styles.primaryButton, styles.inlineButton]}
              onPress={() => void joinWithInviteCode()}
            >
              {joiningByCode ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.primaryButtonText}>Join room</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.inlineButton]}
              onPress={() => void copyInviteCode(inviteCode.trim().toUpperCase())}
            >
              <Text style={styles.secondaryButtonText}>Copy code</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionRow}>
            <Text style={styles.cardTitle}>Active Rooms</Text>
            {(loading || refreshing) && <ActivityIndicator size="small" color={colors.accentWarm} />}
          </View>
          {rooms.length ? (
            rooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={styles.roomCard}
                onPress={() =>
                  navigation.navigate("Room", {
                    roomId: room.id,
                  })
                }
              >
                <View style={styles.roomHeader}>
                  <Text style={styles.roomTitle}>{room.title}</Text>
                  <View style={[styles.statusPill, room.status === "live" && styles.statusPillLive]}>
                    <Text style={styles.statusPillText}>{room.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.roomQuestion}>{room.questionText}</Text>
                <View style={styles.roomMetaRow}>
                  <Text style={styles.roomMeta}>{room.topic}</Text>
                  <Text style={styles.roomMeta}>{room.userCount}/{room.maxUsers} users</Text>
                  <Text style={styles.roomMeta}>{room.answerCount} answers</Text>
                </View>
                <View style={styles.roomActionRow}>
                  <TouchableOpacity
                    style={styles.roomAction}
                    onPress={(event: any) => {
                      event?.stopPropagation?.();
                      void shareRoom(room);
                    }}
                  >
                    <Ionicons name="share-social-outline" size={14} color={colors.text} />
                    <Text style={styles.roomActionText}>Share link</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.roomAction}
                    onPress={(event: any) => {
                      event?.stopPropagation?.();
                      void copyInviteCode(room.inviteCode);
                    }}
                  >
                    <Ionicons name="copy-outline" size={14} color={colors.text} />
                    <Text style={styles.roomActionText}>{room.inviteCode}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>Ende pa room-e. Krijoje te parin.</Text>
          )}
        </View>
      </ScrollView>
      <FloatingAiEntry
        feature="rooms"
        queryHint="Si funksionojne rooms dhe cfare room-i duhet te krijoj?"
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
    top: -100,
    left: -30,
    right: -30,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(255,77,77,0.08)",
  },
  content: {
    padding: 18,
    paddingTop: 56,
    paddingBottom: 120,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    gap: 12,
  },
  backButton: {
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
    gap: 8,
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
    lineHeight: 31,
    fontWeight: "800",
  },
  card: {
    borderRadius: 22,
    padding: 18,
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
  input: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  inputTall: {
    minHeight: 88,
    textAlignVertical: "top",
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
  secondaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: colors.soft,
    fontSize: 14,
    fontWeight: "800",
  },
  inlineRow: {
    flexDirection: "row",
    gap: 10,
  },
  inlineButton: {
    flex: 1,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roomCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 10,
  },
  roomHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  roomTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  roomQuestion: {
    color: colors.soft,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  roomMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roomMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  roomActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roomAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  roomActionText: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  statusPillLive: {
    backgroundColor: "rgba(255,138,0,0.12)",
  },
  statusPillText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
});
