import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import { API_CONFIG, getApiUrl } from "../config/api";
import { colors, readJsonSafely } from "../theme/mvp";

type NewsItem = {
  publishedAt?: string | null;
  source?: string | null;
  title: string;
  viralScore?: number;
};

type NewsBucket = {
  categoryId: string;
  color: string;
  label: string;
  total: number;
  items: NewsItem[];
};

export default function NewsCategoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const categoryId = String(route.params?.categoryId || "").trim();
  const categoryLabel = String(route.params?.categoryLabel || "Kategori").trim();
  const categoryColor = String(route.params?.categoryColor || colors.accentWarm).trim();
  const country = String(route.params?.country || "AL").trim();
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<NewsBucket | null>(
    route.params?.initialBucket || null
  );

  useEffect(() => {
    let active = true;

    const loadBucket = async () => {
      if (!categoryId) {
        return;
      }

      try {
        setLoading(true);
        const response = await fetch(
          `${getApiUrl(API_CONFIG.endpoints.trending.liveNews)}?country=${encodeURIComponent(
            country
          )}&preferredCategories=${encodeURIComponent(categoryId)}&limitPerFeed=6&limitPerCategory=8`
        );
        const data = (await readJsonSafely(response)) as
          | { categorized?: NewsBucket[] }
          | null;

        if (!active) {
          return;
        }

        const nextBucket =
          data?.categorized?.find((item) => item.categoryId === categoryId) || null;
        setBucket(nextBucket);
      } catch (error) {
        console.error("News category load error:", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadBucket();

    return () => {
      active = false;
    };
  }, [categoryId, country]);

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>LIVE CATEGORY</Text>
            <Text style={styles.title}>{categoryLabel}</Text>
            <Text style={styles.subtitle}>
              Ketu shfaqen lajmet e plota vetem per kete kategori.
            </Text>
          </View>
        </View>

        <View style={[styles.categoryPill, { borderColor: `${categoryColor}88` }]}>
          <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
          <Text style={[styles.categoryPillText, { color: categoryColor }]}>{categoryLabel}</Text>
        </View>

        {loading ? <ActivityIndicator color={colors.accentWarm} style={styles.loader} /> : null}

        {bucket?.items?.length ? (
          <View style={styles.list}>
            {bucket.items.map((item, index) => (
              <View key={`${item.title}-${index}`} style={styles.storyCard}>
                <Text style={styles.storyTitle}>{item.title}</Text>
                <View style={styles.storyMetaRow}>
                  <Text style={styles.storyMeta}>{item.source || "News source"}</Text>
                  <Text style={styles.storyScore}>
                    Viral {Number(item.viralScore || 0).toFixed(1)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : !loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nuk ka lajme te ngarkuara per kete kategori.</Text>
            <Text style={styles.emptyText}>
              Provo refresh ose zgjidh nje kategori tjeter nga Home.
            </Text>
          </View>
        ) : null}
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
    top: -130,
    left: -30,
    right: -30,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255,138,0,0.08)",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 36,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
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
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 10,
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  categoryPill: {
    marginTop: 18,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: "900",
  },
  loader: {
    marginTop: 28,
  },
  list: {
    marginTop: 18,
    gap: 12,
  },
  storyCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  storyTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  storyMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  storyMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  storyScore: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
});
