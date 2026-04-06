import React, { useMemo, useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ViewShot from "react-native-view-shot";

import { captureAndShare } from "../../services/shareService";
import { colors } from "../../theme/mvp";

type EmotionKey = "savage" | "funny" | "emotional" | "mysterious" | "chaotic";

type Props = {
  badge: string;
  breakdown: Record<string, number>;
  primary: EmotionKey;
  summary: string;
};

const CONFIGS: Record<
  EmotionKey,
  { color: string; bg: string; label: string }
> = {
  savage: { color: "#FF3B30", bg: "#1B0809", label: "I/E Eger" },
  funny: { color: "#FF9500", bg: "#1A1206", label: "Qesharak/e" },
  emotional: { color: "#5856D6", bg: "#120D20", label: "I/E Ndjeshem" },
  mysterious: { color: "#30D158", bg: "#08180E", label: "Enigmatik/e" },
  chaotic: { color: "#FF2D55", bg: "#1A0910", label: "Kaotik/e" },
};

export default function EmotionShareCard({ badge, breakdown, primary, summary }: Props) {
  const shotRef = useRef<ViewShot | null>(null);
  const config = CONFIGS[primary] || CONFIGS.chaotic;

  const topEmotions = useMemo(
    () =>
      Object.entries(breakdown || {})
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 3),
    [breakdown]
  );

  const share = async () =>
    captureAndShare({
      hashtags: ["5SecondAnswer", "EmotionScore", badge.replace(/\s+/g, "")],
      message: `Rezultova "${badge}" ne 5 Second Answer. Cfare je ti?`,
      title: "Emotion Score",
      viewRef: shotRef,
    });

  return (
    <View style={styles.wrapper}>
      <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }}>
        <View style={[styles.card, { backgroundColor: config.bg }]}>
          <Text style={styles.appName}>5 Second Answer</Text>

          <View style={[styles.badgeShell, { borderColor: config.color }]}>
            <Text style={[styles.badgeText, { color: config.color }]}>{badge}</Text>
            <Text style={[styles.badgeLabel, { color: `${config.color}AA` }]}>{config.label}</Text>
          </View>

          <Text style={styles.summary}>"{summary}"</Text>

          <View style={styles.breakdown}>
            {topEmotions.map(([emotion, score]) => {
              const emotionConfig = CONFIGS[(emotion as EmotionKey) || primary] || config;
              return (
                <View key={emotion} style={styles.barRow}>
                  <Text style={styles.barEmotion}>{emotionConfig.label}</Text>
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.round(Number(score || 0) * 100)}%`,
                          backgroundColor: emotionConfig.color,
                          opacity: emotion === primary ? 1 : 0.45,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barPct, { color: emotionConfig.color }]}>
                    {Math.round(Number(score || 0) * 100)}%
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Cfare je ti?</Text>
            <Text style={[styles.footerCta, { color: config.color }]}>5secondanswer.app</Text>
          </View>
        </View>
      </ViewShot>

      <TouchableOpacity style={[styles.shareBtn, { backgroundColor: config.color }]} onPress={() => void share()}>
        <Text style={styles.shareBtnText}>Ndaj rezultatin</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 14,
  },
  card: {
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  appName: {
    color: "rgba(255,255,255,0.30)",
    textAlign: "center",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  badgeShell: {
    marginTop: 22,
    alignSelf: "center",
    minWidth: 180,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    gap: 6,
  },
  badgeText: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  summary: {
    marginTop: 20,
    color: colors.soft,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "600",
  },
  breakdown: {
    marginTop: 24,
    gap: 10,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  barEmotion: {
    width: 90,
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
  },
  barBg: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },
  barPct: {
    width: 46,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
  },
  footer: {
    marginTop: 26,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    color: "rgba(255,255,255,0.34)",
    fontSize: 12,
    fontWeight: "700",
  },
  footerCta: {
    fontSize: 12,
    fontWeight: "900",
  },
  shareBtn: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtnText: {
    color: "#0B0B0F",
    fontSize: 15,
    fontWeight: "900",
  },
});
