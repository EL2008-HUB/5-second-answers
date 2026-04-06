import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { API_CONFIG, getApiUrl } from "../config/api";
import FloatingAiEntry from "../components/FloatingAiEntry";
import { colors, formatCompactNumber, readJsonSafely } from "../theme/mvp";

type FeedAnswer = {
  id: string;
  text?: string | null;
  type: "audio" | "text" | "video" | "external";
  createdAt?: string | null;
  externalUrl?: string | null;
  interactions?: {
    likes?: number;
    views?: number;
  };
  provider?: string | null;
  question?: {
    id: string;
    text: string;
    category: string;
  } | null;
  source?: "imported" | "native";
  thumbnailUrl?: string | null;
  user?: {
    username?: string | null;
  };
};

const formatTimeAgo = (value?: string | null) => {
  if (!value) {
    return "Tani";
  }

  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  return `${Math.floor(hours / 24)}d`;
};

export default function HashtagFeedScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const hashtag = String(route.params?.hashtag || "").replace(/^#+/, "").toLowerCase();
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<FeedAnswer[]>([]);
  const [postCount, setPostCount] = useState(0);

  const loadFeed = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.hashtags.feed(hashtag)));
      const data = (await readJsonSafely(response)) as
        | { postCount?: number; responses?: FeedAnswer[] }
        | null;

      if (!response.ok) {
        throw new Error("Failed to load hashtag feed");
      }

      setFeed(Array.isArray(data?.responses) ? data?.responses : []);
      setPostCount(Number(data?.postCount || 0));
    } catch (error) {
      console.error("Hashtag feed load error:", error);
      setFeed([]);
      setPostCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFeed();
  }, [hashtag]);

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>HASHTAG FEED</Text>
          <Text style={styles.title}>#{hashtag}</Text>
          <Text style={styles.meta}>{formatCompactNumber(postCount)} entries</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => void loadFeed()}>
          <Ionicons name="refresh" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={feed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Organic loop starts here.</Text>
            <Text style={styles.heroBody}>
              Shiko si po perdoret #{hashtag}, pastaj futu direkt ne Mirror dhe posto versionin tend.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.feedCard}
            onPress={() => {
              if (item.source === "imported" && item.externalUrl) {
                void Linking.openURL(item.externalUrl);
                return;
              }

              if (!item.question?.id) {
                return;
              }

              navigation.navigate("VideoPlayer", {
                questionId: item.question.id,
                refreshKey: Date.now(),
              });
            }}
          >
            <Text style={styles.answerMeta}>
              @{item.user?.username || "anonymous"} · {formatTimeAgo(item.createdAt)}
            </Text>
            <Text style={styles.answerText} numberOfLines={4}>
              {item.text || `${item.type.toUpperCase()} answer`}
            </Text>
            {item.source === "imported" ? (
              <Text style={styles.importedMeta} numberOfLines={2}>
                Imported from {item.provider || "social"} · tap to open original
              </Text>
            ) : (
              <Text style={styles.questionText} numberOfLines={2}>
                {item.question?.text || "Question unavailable"}
              </Text>
            )}
            <View style={styles.statsRow}>
              {item.source === "imported" ? (
                <Text style={styles.stat}>External post</Text>
              ) : (
                <>
                  <Text style={styles.stat}>
                    {formatCompactNumber(Number(item.interactions?.likes || 0))} likes
                  </Text>
                  <Text style={styles.stat}>
                    {formatCompactNumber(Number(item.interactions?.views || 0))} views
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.accentWarm} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Ende pa pergjigje.</Text>
              <Text style={styles.emptyBody}>Behu i pari qe e ndez #{hashtag}.</Text>
            </View>
          )
        }
      />

      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() =>
          navigation.navigate("Mirror", {
            hashtagContext: hashtag,
            refreshKey: Date.now(),
          })
        }
      >
        <Text style={styles.ctaText}>+ Pergjigju me #{hashtag}</Text>
      </TouchableOpacity>
      <FloatingAiEntry
        bottomOffset={92}
        feature="hashtags"
        queryHint={`Si futem ne trend me #${hashtag}?`}
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
    left: -30,
    right: -30,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(255,77,77,0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 22,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerCopy: {
    flex: 1,
    paddingHorizontal: 12,
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
    fontWeight: "900",
    marginTop: 6,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },
  heroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
    backgroundColor: "#130F1E",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  heroBody: {
    color: colors.muted,
    marginTop: 8,
    lineHeight: 20,
    fontWeight: "600",
  },
  feedCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  answerMeta: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "800",
  },
  answerText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "800",
    marginTop: 10,
  },
  questionText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    fontWeight: "600",
  },
  importedMeta: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  stat: {
    color: colors.soft,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyBody: {
    color: colors.muted,
    marginTop: 8,
  },
  ctaButton: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  ctaText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
});

