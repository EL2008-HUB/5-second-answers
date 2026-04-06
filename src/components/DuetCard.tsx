import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ViewShot from "react-native-view-shot";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../theme/mvp";

type DuetParticipant = {
  answer: string;
  seconds: number | null;
  user: {
    avatarColor?: string | null;
    id?: string | null;
    name?: string | null;
  };
};

export type DuetData = {
  createdAt?: string | null;
  expiresAt?: string | null;
  metadata?: {
    mode?: string | null;
  } | null;
  question: string;
  questionId?: string | null;
  reactions: Record<string, number>;
  sessionId: string;
  status: "pending" | "complete" | "expired";
  winnerId?: string | null;
  left: DuetParticipant;
  right: DuetParticipant;
};

type Props = {
  duet: DuetData;
  onReact?: (emoji: string) => void;
};

const REACTIONS = ["🔥", "😂", "😱", "💀", "❤️"];

const formatSeconds = (seconds: number | null | undefined) => {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "n/a";
  }

  return `${seconds}s`;
};

function SidePanel({
  isWinner,
  side,
  participant,
}: {
  isWinner: boolean;
  side: "left" | "right";
  participant: DuetParticipant;
}) {
  const initials = (participant.user?.name || "??").slice(0, 2).toUpperCase();

  return (
    <View style={[styles.sidePanel, side === "left" ? styles.leftPanel : styles.rightPanel]}>
      <View style={styles.userHead}>
        <View
          style={[
            styles.avatarCircle,
            { backgroundColor: participant.user?.avatarColor || colors.accent },
            isWinner && styles.avatarWinner,
          ]}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.userName} numberOfLines={1}>
          {participant.user?.name || "anonymous"}
        </Text>
      </View>

      <View style={[styles.answerBox, isWinner && styles.answerBoxWinner]}>
        <Text style={styles.answerText}>{participant.answer}</Text>
      </View>

      <View style={[styles.timeBadge, isWinner && styles.timeBadgeWinner]}>
        <Text style={[styles.timeText, isWinner && styles.timeTextWinner]}>
          {formatSeconds(participant.seconds)}
        </Text>
      </View>
    </View>
  );
}

export default function DuetCard({ duet, onReact }: Props) {
  const shotRef = useRef<ViewShot | null>(null);
  const [sharing, setSharing] = useState(false);

  const shareScreenshot = async () => {
    if (!shotRef.current) {
      return;
    }

    try {
      setSharing(true);
      const uri = await shotRef.current.capture?.();

      if (!uri) {
        throw new Error("Capture failed");
      }

      await Share.share({
        title: "5 Second Answer duet",
        message: `E njejta pyetje. Dy pergjigje. #5SecondAnswer`,
        url: uri,
      });
    } finally {
      setSharing(false);
    }
  };

  const winnerId = duet.winnerId || null;

  return (
    <View style={styles.wrapper}>
      <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }}>
        <View style={styles.card}>
          <View style={styles.questionBar}>
            <Text style={styles.questionLabel}>E NJEJTA PYETJE</Text>
            <Text style={styles.questionText}>{duet.question}</Text>
          </View>

          <View style={styles.splitRow}>
            <SidePanel
              isWinner={Boolean(winnerId && winnerId === duet.left.user?.id)}
              side="left"
              participant={duet.left}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <View style={styles.vsCircle}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <View style={styles.dividerLine} />
            </View>

            <SidePanel
              isWinner={Boolean(winnerId && winnerId === duet.right.user?.id)}
              side="right"
              participant={duet.right}
            />
          </View>

          <View style={styles.brandingBar}>
            <Text style={styles.brandingText}>5 Second Answer</Text>
            <Text style={styles.brandingTag}>#5SecondAnswer</Text>
          </View>
        </View>
      </ViewShot>

      <View style={styles.reactionsRow}>
        {REACTIONS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={styles.reactionBtn}
            onPress={() => onReact?.(emoji)}
            disabled={!onReact}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            <Text style={styles.reactionCount}>{duet.reactions?.[emoji] || 0}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.shareBtn} onPress={() => void shareScreenshot()} disabled={sharing}>
        {sharing ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Ionicons name="share-social-outline" size={16} color={colors.text} />
            <Text style={styles.shareBtnText}>Ndaj krahasimin</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 16,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  card: {
    backgroundColor: "#0F1015",
  },
  questionBar: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  questionLabel: {
    color: colors.accentWarm,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  questionText: {
    marginTop: 8,
    color: colors.soft,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  splitRow: {
    flexDirection: "row",
    minHeight: 240,
  },
  sidePanel: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  leftPanel: {
    paddingRight: 8,
  },
  rightPanel: {
    paddingLeft: 8,
  },
  userHead: {
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWinner: {
    borderWidth: 2,
    borderColor: colors.accentWarm,
  },
  avatarText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  userName: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  answerBox: {
    flex: 1,
    width: "100%",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  answerBoxWinner: {
    backgroundColor: "rgba(255,138,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,138,0,0.28)",
  },
  answerText: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  divider: {
    width: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  dividerLine: {
    width: 1,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  vsCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#15161C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  vsText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  timeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  timeBadgeWinner: {
    backgroundColor: "rgba(255,77,77,0.12)",
  },
  timeText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  timeTextWinner: {
    color: colors.accentWarm,
  },
  brandingBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  brandingText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
  },
  brandingTag: {
    color: colors.accentWarm,
    fontSize: 11,
    fontWeight: "800",
  },
  reactionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  reactionBtn: {
    alignItems: "center",
    gap: 4,
    minWidth: 44,
  },
  reactionEmoji: {
    fontSize: 20,
  },
  reactionCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  shareBtn: {
    marginHorizontal: 14,
    marginBottom: 14,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.accent,
  },
  shareBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
});
