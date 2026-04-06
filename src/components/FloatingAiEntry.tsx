import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { colors } from "../theme/mvp";

type Props = {
  bottomOffset?: number;
  feature?: string;
  queryHint?: string;
};

export default function FloatingAiEntry({
  bottomOffset = 28,
  feature = "mirror",
  queryHint = "",
}: Props) {
  const navigation = useNavigation<any>();

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={() =>
        navigation.navigate("AiCopilot", {
          feature,
          queryHint,
        })
      }
      style={[styles.button, { bottom: bottomOffset }]}
    >
      <Ionicons name="sparkles-outline" size={16} color={colors.accentWarm} />
      <Text style={styles.label}>Ask AI</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    right: 18,
    zIndex: 50,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: "rgba(12,12,16,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,138,0,0.28)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
});
