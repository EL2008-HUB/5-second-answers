import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type Props = {
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("App crashed:", error, errorInfo);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Aplikacioni hasi një gabim</Text>
          <Text style={styles.message}>{this.state.error.message || "Unknown error"}</Text>
          {this.state.error.stack ? (
            <Text style={styles.stack}>{this.state.error.stack}</Text>
          ) : null}
        </View>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#0b0b0b",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#171717",
    borderColor: "#8b1e1e",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  message: {
    color: "#ffb4b4",
    fontSize: 16,
    marginBottom: 16,
  },
  stack: {
    color: "#d0d0d0",
    fontSize: 12,
    lineHeight: 18,
  },
});
