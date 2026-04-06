import React, { useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ViewShot from "react-native-view-shot";

import { captureAndShare } from "../../services/shareService";
import { colors } from "../../theme/mvp";

type Props = {
  answer: string;
  aiComment?: string | null;
  aiCommentEmoji?: string | null;
  emotion?: string | null;
  hashtags?: string[];
  question: string;
  seconds: number;
};

const EMOTION_COLORS: Record<string, string> = {
  chaotic: "#FF2D55",
  default: "#FF4D4D",
  emotional: "#5856D6",
  funny: "#FF9500",
  mindset: "#30D158",
  mysterious: "#30D158",
  relationships: "#FF2D55",
  savage: "#FF3B30",
  "self-growth": "#30D158",
  social: "#FF8A00",
};

export default function AnswerShareCard({
  answer,
  aiComment,
  aiCommentEmoji,
  emotion,
  hashtags = ["5SecondAnswer", "5sekonda"],
  question,
  seconds,
}: Props) {
  const shotRef = useRef<ViewShot | null>(null);
  const accentColor = EMOTION_COLORS[String(emotion || "").toLowerCase()] || EMOTION_COLORS.default;
  const speedEmoji = seconds <= 5 ? "⚡" : "🐢";

  const share = async () =>
    captureAndShare({
      hashtags,
      message: `${speedEmoji} U pergjigja ne ${seconds.toFixed(1)} sekonda. 5Second.app`,
      title: "5Second.app",
      viewRef: shotRef,
    });

  return (
    <View style={styles.wrapper}>
      <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }}>
        <View style={[styles.card, { borderTopColor: accentColor }]}>
          <View style={styles.header}>
            <Text style={styles.appName}>5Second.app</Text>
            <View style={styles.headerBadges}>
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>{speedEmoji}</Text>
              </View>
              <View style={[styles.secBadge, { borderColor: accentColor, backgroundColor: `${accentColor}22` }]}>
                <Text style={[styles.secText, { color: accentColor }]}>{seconds.toFixed(1)}s</Text>
              </View>
            </View>
          </View>

          <View style={styles.questionBox}>
            <Text style={styles.questionLabel}>PYETJA</Text>
            <Text style={styles.questionText}>{question}</Text>
          </View>

          <View style={[styles.divider, { backgroundColor: accentColor }]} />

          <View style={styles.answerBox}>
            <Text style={styles.answerLabel}>PERGJIGJJA IME</Text>
            <Text style={styles.answerText}>{answer}</Text>
          </View>

          {aiComment ? (
            <View style={styles.aiReactionBox}>
              <Text style={styles.aiReactionLabel}>{aiCommentEmoji || "🤖"} AI REAGIM</Text>
              <Text style={styles.aiReactionText}>{aiComment}</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Cfare do te thoje ti?</Text>
            <Text style={[styles.footerCta, { color: accentColor }]}>5Second.app</Text>
          </View>
        </View>
      </ViewShot>

      <TouchableOpacity style={[styles.shareBtn, { backgroundColor: accentColor }]} onPress={() => void share()}>
        <Text style={styles.shareBtnText}>Ndaj pergjigjen</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 14,
  },
  card: {
    borderTopWidth: 4,
    borderRadius: 24,
    overflow: "hidden",
    padding: 22,
    backgroundColor: "#0F1015",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  headerBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  appName: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  modeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modeBadgeText: {
    fontSize: 15,
  },
  secBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  secText: {
    fontSize: 12,
    fontWeight: "800",
  },
  questionBox: {
    marginBottom: 16,
  },
  questionLabel: {
    color: "rgba(255,255,255,0.34)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  questionText: {
    marginTop: 8,
    color: colors.soft,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    opacity: 0.35,
    marginBottom: 16,
  },
  answerBox: {
    minHeight: 180,
    justifyContent: "center",
  },
  answerLabel: {
    color: "rgba(255,255,255,0.34)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  answerText: {
    marginTop: 10,
    color: colors.text,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "900",
  },
  aiReactionBox: {
    marginTop: 18,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  aiReactionLabel: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  aiReactionText: {
    marginTop: 8,
    color: colors.soft,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
  },
  footer: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
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
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
});
