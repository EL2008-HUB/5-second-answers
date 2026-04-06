import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { API_CONFIG, getApiUrl } from "../config/api";
import { colors, MVP_USER_ID, readJsonSafely } from "../theme/mvp";
import { DuetData } from "../components/DuetCard";

type FriendItem = {
  id: string;
  username: string;
  followers?: number;
  approvedAnswerCount?: number;
  latestAnswerAt?: string | null;
};

type FollowingResponse = {
  following?: FriendItem[];
};

export default function FriendPickerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const questionText = String(route.params?.questionText || "Pa pyetje");
  const myAnswer = String(route.params?.myAnswer || "No answer");
  const mySeconds = Number(route.params?.mySeconds || 5);
  const answerId = String(route.params?.answerId || "");
  const questionId = String(route.params?.questionId || "");

  useEffect(() => {
    const loadFollowing = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${getApiUrl(API_CONFIG.endpoints.social.following)}?userId=${MVP_USER_ID}`
        );
        const data = (await readJsonSafely(response)) as FollowingResponse | null;

        if (!response.ok) {
          throw new Error("Failed to load following");
        }

        setFriends(Array.isArray(data?.following) ? data?.following : []);
      } catch (error) {
        console.error("Friend picker load error:", error);
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

    void loadFollowing();
  }, []);

  const challengePreview = useMemo(
    () => `${questionText}\n\n"${myAnswer}"`,
    [myAnswer, questionText]
  );

  const createChallenge = async (friend: FriendItem) => {
    try {
      setSubmittingId(friend.id);
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.duets.create), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: myAnswer,
          answerId: answerId || null,
          questionId: questionId || null,
          questionText,
          seconds: mySeconds,
          user1Id: MVP_USER_ID,
          user2Id: friend.id,
        }),
      });

      const data = (await readJsonSafely(response)) as { duet?: DuetData; error?: string } | null;

      if (!response.ok || !data?.duet?.sessionId) {
        throw new Error(data?.error || "Failed to create duet");
      }

      navigation.replace("Duet", {
        initialDuet: data.duet,
        sessionId: data.duet.sessionId,
      });
    } catch (error) {
      console.error("Create duet challenge error:", error);
    } finally {
      setSubmittingId(null);
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
          <Text style={styles.eyebrow}>DUET CHALLENGE</Text>
          <Text style={styles.title}>Zgjidh mikun qe do ta sfidosh.</Text>
        </View>
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>Po e dergon kete split-screen:</Text>
        <Text style={styles.previewText}>{challengePreview}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentWarm} />
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Ende pa miq per sfide.</Text>
          <Text style={styles.emptyText}>
            Ndiq disa profile fillimisht dhe ketu do te shfaqen per duet challenge.
          </Text>
        </View>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.friendCard}
              onPress={() => void createChallenge(item)}
              disabled={submittingId === item.id}
            >
              <View style={styles.friendMeta}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.username.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={styles.friendCopy}>
                  <Text style={styles.friendName}>@{item.username}</Text>
                  <Text style={styles.friendStats}>
                    {item.approvedAnswerCount || 0} answers · {item.followers || 0} followers
                  </Text>
                </View>
              </View>

              <View style={styles.challengeButton}>
                {submittingId === item.id ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={15} color={colors.text} />
                    <Text style={styles.challengeButtonText}>Sfido</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
    top: -90,
    left: -30,
    right: -30,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(255,77,77,0.09)",
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
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 10,
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  previewCard: {
    marginTop: 18,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  previewLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  previewText: {
    marginTop: 10,
    color: colors.soft,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    margin: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
    gap: 12,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  friendMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,138,0,0.18)",
  },
  avatarText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  friendCopy: {
    flex: 1,
  },
  friendName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  friendStats: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  challengeButton: {
    minHeight: 40,
    minWidth: 92,
    borderRadius: 999,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    backgroundColor: colors.accent,
  },
  challengeButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
});
