import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import DuetCard, { DuetData } from "../components/DuetCard";
import { API_CONFIG, getApiUrl } from "../config/api";
import { colors, MVP_USER_ID, readJsonSafely } from "../theme/mvp";

export default function DuetScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [duet, setDuet] = useState<DuetData | null>(route.params?.initialDuet || null);
  const [loading, setLoading] = useState(!route.params?.initialDuet);
  const [refreshing, setRefreshing] = useState(false);
  const sessionId = String(route.params?.sessionId || route.params?.initialDuet?.sessionId || "");

  const loadDuet = async () => {
    if (!sessionId) {
      setDuet(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.duets.session(sessionId)));
      const data = (await readJsonSafely(response)) as { duet?: DuetData } | null;

      if (!response.ok || !data?.duet?.sessionId) {
        throw new Error("Failed to load duet");
      }

      setDuet(data.duet);
    } catch (error) {
      console.error("Load duet error:", error);
      setDuet(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadDuet();
  }, [sessionId]);

  useEffect(() => {
    if (!duet || duet.status !== "pending") {
      return;
    }

    const timer = setInterval(() => {
      void loadDuet();
    }, 8000);

    return () => clearInterval(timer);
  }, [duet?.sessionId, duet?.status]);

  const isInvitedUser = useMemo(() => duet?.right?.user?.name === MVP_USER_ID, [duet?.right?.user?.name]);

  const reactToDuet = async (emoji: string) => {
    if (!duet?.sessionId) {
      return;
    }

    try {
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.duets.react(duet.sessionId)), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, userId: MVP_USER_ID }),
      });
      const data = (await readJsonSafely(response)) as { duet?: DuetData } | null;

      if (!response.ok || !data?.duet) {
        throw new Error("Failed to react");
      }

      setDuet(data.duet);
    } catch (error) {
      console.error("React duet error:", error);
    }
  };

  const answerPendingDuet = () => {
    if (!duet) {
      return;
    }

    navigation.navigate("Mirror", {
      duetSessionId: duet.sessionId,
      questionId: duet.questionId,
      questionText: duet.question,
      refreshKey: Date.now(),
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadDuet();
            }}
            tintColor={colors.accentWarm}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>DUET</Text>
            <Text style={styles.title}>Dy pergjigje. Nje screenshot viral.</Text>
          </View>
        </View>

        {loading && !duet ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accentWarm} />
          </View>
        ) : !duet ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Ky duet nuk u gjet.</Text>
            <Text style={styles.stateText}>Mund te kete skaduar ose linku nuk eshte me valid.</Text>
          </View>
        ) : duet.status === "pending" ? (
          <>
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>
                {isInvitedUser ? "Je sfiduar." : "Sfida u dergua."}
              </Text>
              <Text style={styles.stateText}>
                {isInvitedUser
                  ? `${duet.left.user.name} po pret per pergjigjen tende. Mbylle tani dhe split-screen del gati.`
                  : `${duet.right.user.name} ka 24 ore per t'u pergjigjur. Sapo te mbaroje, krahasimi del ketu.`}
              </Text>

              {isInvitedUser ? (
                <TouchableOpacity style={styles.primaryButton} onPress={answerPendingDuet}>
                  <View style={styles.primaryGlow} />
                  <Text style={styles.primaryText}>Pergjigju tani</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <DuetCard duet={duet} />
          </>
        ) : duet.status === "expired" ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Sfida skadoi.</Text>
            <Text style={styles.stateText}>
              24 oret kaluan pa nje pergjigje. Mund ta provosh perseri me dikë tjeter.
            </Text>
          </View>
        ) : (
          <>
            <DuetCard duet={duet} onReact={reactToDuet} />

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() =>
                  navigation.navigate("Mirror", {
                    questionId: duet.questionId,
                    questionText: duet.question,
                    refreshKey: Date.now(),
                  })
                }
              >
                <Text style={styles.secondaryText}>Pergjigju perseri</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate("Home", { refreshKey: Date.now() })}
              >
                <Text style={styles.secondaryText}>Kthehu te Feed</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() =>
                  navigation.navigate("Share", {
                    type: "duet",
                    data: { duet },
                  })
                }
              >
                <Text style={styles.secondaryText}>Open share cards</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
    top: -120,
    left: -20,
    right: -20,
    height: 240,
    borderRadius: 240,
    backgroundColor: "rgba(255,138,0,0.09)",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 48,
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
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
  },
  center: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  stateCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 22,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  stateTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  stateText: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.accent,
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
  actionsRow: {
    marginTop: 16,
    gap: 10,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  secondaryText: {
    color: colors.soft,
    fontSize: 14,
    fontWeight: "800",
  },
});
