import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import {
  ONBOARDING_INTERESTS,
  getOnboardingInterestMeta,
  saveOnboardingInterests,
} from "../services/onboardingService";
import { colors } from "../theme/mvp";

const MAX_SELECTION = 3;

export default function OnboardingInterestsScreen() {
  const navigation = useNavigation<any>();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedLabel = useMemo(
    () => getOnboardingInterestMeta(selected[0])?.label || "your vibe",
    [selected]
  );

  const toggleInterest = (interestId: string) => {
    setSelected((current) => {
      if (current.includes(interestId)) {
        return current.filter((item) => item !== interestId);
      }

      if (current.length >= MAX_SELECTION) {
        return [...current.slice(1), interestId];
      }

      return [...current, interestId];
    });
  };

  const continueToFirstAnswer = async () => {
    if (!selected.length) {
      return;
    }

    try {
      setSaving(true);
      await saveOnboardingInterests(selected);
      const primary = getOnboardingInterestMeta(selected[0]);

      navigation.reset({
        index: 0,
        routes: [
          {
            name: "Main",
            state: {
              routes: [
                {
                  name: "Mirror",
                  params: {
                    onboardingAutoStart: true,
                    onboardingFlow: true,
                    onboardingInterestLabel: primary?.label || null,
                    onboardingInterests: selected,
                    preferredCategory: primary?.category || null,
                    refreshKey: Date.now(),
                  },
                },
              ],
            },
          },
        ],
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>START FAST</Text>
        <Text style={styles.title}>Zgjidh interesat. Pastaj futesh direkt te answer-i i pare.</Text>
        <Text style={styles.subtitle}>
          Sa me qarte trego vibe-in tend, aq me mire pyetja e pare ndihet si e jotja.
        </Text>

        <View style={styles.grid}>
          {ONBOARDING_INTERESTS.map((interest) => {
            const active = selected.includes(interest.id);

            return (
              <TouchableOpacity
                key={interest.id}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => toggleInterest(interest.id)}
                activeOpacity={0.92}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardEmoji}>{interest.emoji}</Text>
                  {active ? (
                    <View style={styles.checkWrap}>
                      <Ionicons name="checkmark" size={14} color={colors.text} />
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardLabel}>{interest.label}</Text>
                <Text style={styles.cardDescription}>{interest.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>FIRST ANSWER FLOW</Text>
          <Text style={styles.summaryTitle}>Ne fillojme me {selectedLabel} dhe te cojmë direkt te Mirror.</Text>
          <Text style={styles.summaryBody}>
            Pa explore. Pa menu te panevojshme. Hyr, pergjigju, shiko feedback-un dhe momentum-in.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !selected.length && styles.primaryDisabled]}
          disabled={!selected.length || saving}
          onPress={() => void continueToFirstAnswer()}
        >
          <View style={styles.primaryGlow} />
          {saving ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.primaryText}>Nis answer-in e pare</Text>
          )}
        </TouchableOpacity>
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
    left: -40,
    right: -40,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(255,77,77,0.10)",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 34,
    paddingBottom: 42,
  },
  eyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 14,
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
  },
  grid: {
    marginTop: 24,
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  cardActive: {
    backgroundColor: "rgba(255,77,77,0.12)",
    borderColor: "rgba(255,138,0,0.45)",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardEmoji: {
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  cardLabel: {
    marginTop: 14,
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  cardDescription: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  summaryCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#150E0A",
    borderWidth: 1,
    borderColor: "rgba(255,138,0,0.18)",
  },
  summaryEyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  summaryTitle: {
    marginTop: 10,
    color: colors.text,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
  },
  summaryBody: {
    marginTop: 8,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  primaryButton: {
    minHeight: 54,
    marginTop: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    overflow: "hidden",
  },
  primaryDisabled: {
    opacity: 0.55,
  },
  primaryGlow: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "45%",
    backgroundColor: colors.accentWarm,
  },
  primaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
});
