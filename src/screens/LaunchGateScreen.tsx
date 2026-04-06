import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";

import {
  getOnboardingInterestMeta,
  getOnboardingState,
} from "../services/onboardingService";
import { restoreAuthSession } from "../services/authService";
import { colors } from "../theme/mvp";

export default function LaunchGateScreen() {
  const navigation = useNavigation<any>();

  useEffect(() => {
    let active = true;

    const boot = async () => {
      const session = await restoreAuthSession();

      if (!active) {
        return;
      }

      if (!session?.user?.id) {
        navigation.reset({
          index: 0,
          routes: [{ name: "Auth" }],
        });
        return;
      }

      const state = await getOnboardingState();

      if (!active) {
        return;
      }

      if (!state.interests.length) {
        navigation.reset({
          index: 0,
          routes: [{ name: "Onboarding" }],
        });
        return;
      }

      if (!state.firstAnswerCompleted) {
        const primaryInterest = getOnboardingInterestMeta(state.primaryInterest);
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
                      onboardingInterestLabel: primaryInterest?.label || null,
                      onboardingInterests: state.interests,
                      preferredCategory: primaryInterest?.category || null,
                      refreshKey: Date.now(),
                    },
                  },
                ],
              },
            },
          ],
        });
        return;
      }

      navigation.reset({
        index: 0,
        routes: [{ name: "Main" }],
      });
    };

    void boot().catch((error) => {
      console.error("Launch gate boot error:", error);

      if (!active) {
        return;
      }

      navigation.reset({
        index: 0,
        routes: [{ name: "Auth" }],
      });
    });

    return () => {
      active = false;
    };
  }, [navigation]);

  return (
    <View style={styles.screen}>
      <View style={styles.glowTop} />
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>5 SECOND ANSWER</Text>
        <Text style={styles.title}>Po pergatisim hyrjen tende te pare.</Text>
        <Text style={styles.subtitle}>
          Interesat, pyetja e duhur dhe flow-i i shpejte do te ngarkohen tani.
        </Text>
        <ActivityIndicator color={colors.accentWarm} style={styles.loader} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
    padding: 24,
  },
  glowTop: {
    position: "absolute",
    top: -120,
    left: -40,
    right: -40,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(255,138,0,0.10)",
  },
  panel: {
    width: "100%",
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  eyebrow: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    textAlign: "center",
  },
  title: {
    marginTop: 14,
    color: colors.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
  },
  loader: {
    marginTop: 24,
  },
});
