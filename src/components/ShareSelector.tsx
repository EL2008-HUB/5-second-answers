import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { DuetData } from "./DuetCard";
import AnswerShareCard from "./ShareCards/AnswerShareCard";
import DuetShareCard from "./ShareCards/DuetShareCard";
import EmotionShareCard from "./ShareCards/EmotionShareCard";

type AnswerData = {
  answer: string;
  aiComment?: string | null;
  aiCommentEmoji?: string | null;
  duet?: DuetData | null;
  emotion?: string | null;
  hashtags?: string[];
  question: string;
  seconds: number;
};

type EmotionData = {
  answer?: string;
  badge: string;
  breakdown: Record<string, number>;
  primary: "savage" | "funny" | "emotional" | "mysterious" | "chaotic";
  question?: string;
  seconds?: number;
  summary: string;
};

type DuetDataShape = {
  duet: DuetData;
};

type Props =
  | { data: AnswerData; type: "answer" }
  | { data: EmotionData; type: "emotion" }
  | { data: DuetDataShape; type: "duet" };

export default function ShareSelector(props: Props) {
  const [activeCard, setActiveCard] = useState(0);

  const cards = useMemo(() => {
    if (props.type === "emotion") {
      const items = [
        {
          label: "Score",
          render: (
            <EmotionShareCard
              badge={props.data.badge}
              breakdown={props.data.breakdown}
              primary={props.data.primary}
              summary={props.data.summary}
            />
          ),
        },
      ];

      if (props.data.answer && props.data.question && props.data.seconds) {
        items.push({
          label: "Pergjigja",
          render: (
            <AnswerShareCard
              answer={props.data.answer}
              emotion={props.data.primary}
              question={props.data.question}
              seconds={props.data.seconds}
            />
          ),
        });
      }

      return items;
    }

    if (props.type === "duet") {
      return [
        {
          label: "Duet",
          render: <DuetShareCard duet={props.data.duet} />,
        },
      ];
    }

    const items = [
      {
        label: "Pergjigja",
        render: (
          <AnswerShareCard
            answer={props.data.answer}
            aiComment={props.data.aiComment}
            aiCommentEmoji={props.data.aiCommentEmoji}
            emotion={props.data.emotion}
            hashtags={props.data.hashtags}
            question={props.data.question}
            seconds={props.data.seconds}
          />
        ),
      },
    ];

    if (props.data.duet) {
      items.push({
        label: "Duet",
        render: <DuetShareCard duet={props.data.duet} />,
      });
    }

    return items;
  }, [props]);

  return (
    <View style={styles.container}>
      {cards.length > 1 ? (
        <View style={styles.tabRow}>
          {cards.map((card, index) => (
            <TouchableOpacity
              key={card.label}
              style={[styles.tab, index === activeCard && styles.tabActive]}
              onPress={() => setActiveCard(index)}
            >
              <Text style={[styles.tabText, index === activeCard && styles.tabTextActive]}>
                {card.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {cards[activeCard]?.render}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  tabRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  tabActive: {
    backgroundColor: "rgba(255,77,77,0.12)",
    borderColor: "rgba(255,77,77,0.35)",
  },
  tabText: {
    color: "rgba(255,255,255,0.46)",
    fontSize: 13,
    fontWeight: "700",
  },
  tabTextActive: {
    color: "#FF8A00",
  },
});
