import React, { useRef } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ViewShot from "react-native-view-shot";

import type { DuetData } from "../DuetCard";
import { captureAndShare } from "../../services/shareService";
import { colors } from "../../theme/mvp";

type Props = {
  duet: DuetData;
};

function Side({
  answer,
  color,
  label,
  seconds,
}: {
  answer: string;
  color: string;
  label: string;
  seconds: number | null;
}) {
  return (
    <View style={styles.side}>
      <Text style={[styles.sideLabel, { color }]}>{label}</Text>
      <View style={[styles.answerBubble, { borderColor: `${color}55` }]}>
        <Text style={styles.answerText}>{answer}</Text>
      </View>
      <Text style={styles.secondsText}>{typeof seconds === "number" ? `${seconds}s` : "n/a"}</Text>
    </View>
  );
}

export default function DuetShareCard({ duet }: Props) {
  const shotRef = useRef<ViewShot | null>(null);

  const share = async () =>
    captureAndShare({
      hashtags: ["5SecondAnswer", "Duet"],
      message: "E njejta pyetje. Dy pergjigje shume te ndryshme.",
      title: "5 Second Answer duet",
      viewRef: shotRef,
    });

  return (
    <View style={styles.wrapper}>
      <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }}>
        <View style={styles.card}>
          <Text style={styles.appName}>5 Second Answer</Text>
          <Text style={styles.questionLabel}>E NJEJTA PYETJE</Text>
          <Text style={styles.questionText}>{duet.question}</Text>

          <View style={styles.duetRow}>
            <Side
              answer={duet.left.answer}
              color="#FF8A00"
              label={duet.left.user?.name || "TI"}
              seconds={duet.left.seconds}
            />
            <View style={styles.vsShell}>
              <Text style={styles.vsText}>VS</Text>
            </View>
            <Side
              answer={duet.right.answer}
              color="#FF4D4D"
              label={duet.right.user?.name || "MIKU"}
              seconds={duet.right.seconds}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Dy mendje. Nje pyetje.</Text>
            <Text style={styles.footerCta}>5secondanswer.app</Text>
          </View>
        </View>
      </ViewShot>

      <TouchableOpacity style={styles.shareBtn} onPress={() => void share()}>
        <Text style={styles.shareBtnText}>Ndaj duet-in</Text>
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
    padding: 22,
    backgroundColor: "#0F1015",
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
  questionLabel: {
    marginTop: 18,
    color: colors.accentWarm,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  questionText: {
    marginTop: 8,
    color: colors.soft,
    textAlign: "center",
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
  },
  duetRow: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
  },
  side: {
    flex: 1,
    gap: 10,
  },
  sideLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  answerBubble: {
    flex: 1,
    minHeight: 180,
    borderRadius: 22,
    padding: 14,
    justifyContent: "center",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  answerText: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  secondsText: {
    color: "rgba(255,255,255,0.50)",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
  },
  vsShell: {
    width: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  footer: {
    marginTop: 22,
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
    color: colors.accentWarm,
    fontSize: 12,
    fontWeight: "900",
  },
  shareBtn: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  shareBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
});
