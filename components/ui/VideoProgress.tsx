import React from "react";
import { View, StyleSheet } from "react-native";

export default function VideoProgress({ progress }: { progress: number }) {
  return (
    <View style={styles.container}>
      <View style={[styles.bar, { width: `${progress * 100}%` as `${number}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 3,
    width: "100%",
    backgroundColor: "#444",
    position: "absolute",
    bottom: 0,
  },
  bar: {
    height: "100%",
    backgroundColor: "#fff",
  },
});
