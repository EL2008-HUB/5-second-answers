import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "../services/api";

export default function AdminModeration() {
  const [pending, setPending] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const navigation = useNavigation<any>();

  useEffect(() => {
    void fetchPending();
  }, []);

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/api/answers/pending`);
      const data = await response.json();
      setPending(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch pending:", error);
      Alert.alert("Gabim", "Deshtoi ngarkimi i pergjigjeve ne pritje.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await fetch(`${BASE_URL}/api/answers/${id}/approve`, { method: "POST" });
      setPending((prev) => prev.filter((item) => item.id !== id));
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    } catch (error) {
      console.error("Approve error:", error);
      Alert.alert("Gabim", "Deshtoi aprovimi.");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await fetch(`${BASE_URL}/api/answers/${id}/reject`, { method: "POST" });
      setPending((prev) => prev.filter((item) => item.id !== id));
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    } catch (error) {
      console.error("Reject error:", error);
      Alert.alert("Gabim", "Deshtoi refuzimi.");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === pending.length) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(pending.map((item) => item.id));
  };

  const handleBulkApprove = async () => {
    if (!selectedIds.length) {
      return;
    }

    setBulkBusy(true);
    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`${BASE_URL}/api/answers/${id}/approve`, { method: "POST" })
        )
      );

      setPending((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      setSelectedIds([]);
    } catch (error) {
      console.error("Bulk approve error:", error);
      Alert.alert("Gabim", "Deshtoi bulk approve.");
    } finally {
      setBulkBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Moderation - Pending Answers</Text>

      <View style={styles.toolsRow}>
        <TouchableOpacity style={styles.toolButton} onPress={toggleSelectAll}>
          <Ionicons name="checkbox-outline" size={16} color="white" />
          <Text style={styles.toolButtonText}>
            {selectedIds.length === pending.length && pending.length > 0
              ? "Clear All"
              : "Select All"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolButton, styles.bulkApproveButton]}
          onPress={() => void handleBulkApprove()}
          disabled={!selectedCount || bulkBusy}
        >
          <Ionicons name="checkmark-done" size={16} color="white" />
          <Text style={styles.toolButtonText}>
            {bulkBusy ? "Aprovim..." : `Bulk Approve (${selectedCount})`}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.toolsRow}>
        <TouchableOpacity
          style={styles.secondaryToolButton}
          onPress={() => navigation.navigate("AdminBadges")}
        >
          <Text style={styles.secondaryToolButtonText}>Badge Panel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryToolButton}
          onPress={() => navigation.navigate("Debug")}
        >
          <Text style={styles.secondaryToolButtonText}>Debug Tests</Text>
        </TouchableOpacity>
      </View>

      {!pending.length ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Nuk ka pergjigje ne pritje.</Text>
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = selectedIds.includes(item.id);
            const aiScore =
              typeof item.aiReview?.score === "number"
                ? `${Math.round(item.aiReview.score * 100)}%`
                : "N/A";

            return (
              <TouchableOpacity
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => toggleSelect(item.id)}
                activeOpacity={0.9}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.selectionRow}>
                    <Ionicons
                      name={isSelected ? "checkbox" : "square-outline"}
                      size={20}
                      color={isSelected ? "#ff4444" : "#bbb"}
                    />
                    <Text style={styles.question}>{item.question?.text}</Text>
                  </View>
                  <View style={styles.scorePill}>
                    <Text style={styles.scorePillText}>AI {aiScore}</Text>
                  </View>
                </View>

                <Text style={styles.meta}>
                  By: {item.user?.username || "anonymous"} • {item.type}
                </Text>

                {item.text ? <Text style={styles.answerText}>{item.text}</Text> : null}

                {item.aiReview?.feedback ? (
                  <Text style={styles.aiFeedback}>AI: {item.aiReview.feedback}</Text>
                ) : null}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.button, styles.approve]}
                    onPress={() => void handleApprove(item.id)}
                  >
                    <Text style={styles.buttonText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.button, styles.reject]}
                    onPress={() => void handleReject(item.id)}
                  >
                    <Text style={styles.buttonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    padding: 16,
  },
  center: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  emptyText: {
    color: "white",
  },
  toolsRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 8,
    flexWrap: "wrap",
  },
  toolButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  bulkApproveButton: {
    backgroundColor: "rgba(76,175,80,0.3)",
  },
  toolButtonText: {
    color: "white",
    fontWeight: "600",
  },
  secondaryToolButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  secondaryToolButtonText: {
    color: "white",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  cardSelected: {
    borderColor: "rgba(255,68,68,0.35)",
    backgroundColor: "rgba(255,68,68,0.08)",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 8,
  },
  selectionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  question: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  scorePill: {
    backgroundColor: "rgba(106,165,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  scorePillText: {
    color: "#cfe0ff",
    fontSize: 12,
    fontWeight: "700",
  },
  meta: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 2,
  },
  answerText: {
    color: "white",
    marginTop: 10,
    lineHeight: 20,
  },
  aiFeedback: {
    color: "#ffd28a",
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    marginTop: 12,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginRight: 8,
  },
  approve: {
    backgroundColor: "#4CAF50",
  },
  reject: {
    backgroundColor: "#F44336",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
});
