import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { API_CONFIG, getApiUrl } from "../config/api";
import FloatingAiEntry from "../components/FloatingAiEntry";
import { handleNotificationNavigation } from "../services/notificationRouting";
import { MVP_USER_ID } from "../theme/mvp";

type NotificationType =
  | "approved"
  | "daily_question_live"
  | "duet_challenge"
  | "duet_complete"
  | "emotion_score_shared"
  | "expert_answer"
  | "expert_request"
  | "friend_answered_about_you"
  | "group_pressure"
  | "hot_question"
  | "new_answer"
  | "new_follower"
  | "referral_activated"
  | "referral_joined"
  | "streak_at_risk"
  | "top_answer";

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: {
    answeredCount?: number | null;
    questionId?: string | null;
    questionText?: string | null;
    answerId?: string | null;
    answererId?: string | null;
    autoOpenQuestion?: boolean | null;
    category?: string | null;
    duetSessionId?: string | null;
    source?: string | null;
    storySessionId?: string | null;
    userId?: string | null;
  };
  actor?: {
    id?: string | null;
    username?: string | null;
    avatar?: string | null;
  } | null;
};

const formatRelativeTime = (timestamp?: string | null) => {
  if (!timestamp) {
    return "Tani";
  }

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));

  if (minutes < 60) {
    return `${minutes} min me pare`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ore me pare`;
  }

  const days = Math.floor(hours / 24);
  return `${days} dite me pare`;
};

const getIconName = (type: NotificationType) => {
  switch (type) {
    case "approved":
      return "checkmark-circle";
    case "daily_question_live":
      return "flash";
    case "duet_challenge":
      return "git-compare";
    case "duet_complete":
      return "images";
    case "emotion_score_shared":
      return "sparkles";
    case "expert_answer":
      return "ribbon";
    case "expert_request":
      return "flash";
    case "friend_answered_about_you":
      return "eye";
    case "group_pressure":
      return "people";
    case "hot_question":
      return "radio";
    case "new_follower":
      return "person-add";
    case "referral_activated":
      return "rocket";
    case "referral_joined":
      return "people-circle";
    case "streak_at_risk":
      return "alarm";
    case "top_answer":
      return "flame";
    case "new_answer":
    default:
      return "chatbubble";
  }
};

const getIconColor = (type: NotificationType) => {
  switch (type) {
    case "approved":
      return "#4CAF50";
    case "daily_question_live":
      return "#f59e0b";
    case "duet_challenge":
      return "#ef4444";
    case "duet_complete":
      return "#f97316";
    case "emotion_score_shared":
      return "#ec4899";
    case "expert_answer":
      return "#f59e0b";
    case "expert_request":
      return "#f97316";
    case "friend_answered_about_you":
      return "#ef4444";
    case "group_pressure":
      return "#14b8a6";
    case "hot_question":
      return "#dc2626";
    case "new_follower":
      return "#8b5cf6";
    case "referral_activated":
      return "#f59e0b";
    case "referral_joined":
      return "#22c55e";
    case "streak_at_risk":
      return "#f97316";
    case "top_answer":
      return "#ff914d";
    case "new_answer":
    default:
      return "#2196F3";
  }
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const navigation = useNavigation<any>();

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  useEffect(() => {
    void loadNotifications();

    const unsubscribe = navigation.addListener("focus", () => {
      void loadNotifications();
    });

    return unsubscribe;
  }, [navigation, filter]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiUrl(API_CONFIG.endpoints.notifications.list)}?userId=${MVP_USER_ID}&filter=${filter}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Deshtoi ngarkimi i njoftimeve");
      }

      setNotifications(data.notifications || []);
    } catch (err) {
      console.error("Load notifications error:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(getApiUrl(API_CONFIG.endpoints.notifications.readOne(notificationId)), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: MVP_USER_ID }),
      });

      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item))
      );
    } catch (error) {
      console.error("Mark as read error:", error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setActionLoading(true);
      const response = await fetch(getApiUrl(API_CONFIG.endpoints.notifications.readAll), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: MVP_USER_ID }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Deshtoi perditesimi i njoftimeve");
      }

      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (error) {
      console.error("Mark all read error:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleNotificationPress = async (notification: NotificationItem) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
    handleNotificationNavigation({
      type: notification.type,
      ...(notification.metadata || {}),
    });
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[styles.notificationCard, !item.read && styles.notificationCardUnread]}
      onPress={() => void handleNotificationPress(item)}
    >
      <View
        style={[
          styles.iconBg,
          { backgroundColor: `${getIconColor(item.type)}20` },
        ]}
      >
        <Ionicons
          name={getIconName(item.type)}
          size={20}
          color={getIconColor(item.type)}
        />
      </View>

      <View style={styles.notificationContent}>
        <View style={styles.titleRow}>
          <Text style={styles.notificationTitle}>{item.title}</Text>
          {!item.read ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.notificationMessage} numberOfLines={3}>
          {item.message}
        </Text>
        <Text style={styles.timestamp}>{formatRelativeTime(item.createdAt)}</Text>
      </View>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => void handleNotificationPress(item)}
      >
        <Text style={styles.actionText}>Hape</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Njoftime</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0
              ? `${unreadCount} te palexuara`
              : "Je ne rregull per momentin"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={() => void handleMarkAllRead()}
          disabled={actionLoading || unreadCount === 0}
        >
          <Text style={styles.markAllText}>
            {actionLoading ? "..." : "Lexoji te gjitha"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterButton, filter === "all" && styles.filterButtonActive]}
          onPress={() => setFilter("all")}
        >
          <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
            Te gjitha
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === "unread" && styles.filterButtonActive]}
          onPress={() => setFilter("unread")}
        >
          <Text style={[styles.filterText, filter === "unread" && styles.filterTextActive]}>
            Te palexuara
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off" size={48} color="#666" />
          <Text style={styles.emptyText}>Ende s'ke njoftime</Text>
          <Text style={styles.emptySubtext}>
            Kur dikush te ndjek, t'i pergjigjet pyetjes ose kur pergjigjja jote del ne krye,
            do te shfaqet ketu.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
      <FloatingAiEntry
        feature="notifications"
        queryHint="Shpjegoma cfare bejne keto notifications."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#a0a0a0",
    marginTop: 4,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  markAllText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  filterTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  filterButtonActive: {
    backgroundColor: "#ff4444",
  },
  filterText: {
    color: "#ccc",
    fontWeight: "500",
  },
  filterTextActive: {
    color: "white",
    fontWeight: "bold",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 120,
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.04)",
  },
  notificationCardUnread: {
    borderColor: "rgba(255,68,68,0.35)",
    backgroundColor: "rgba(255,68,68,0.08)",
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
    paddingRight: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ff4444",
  },
  notificationMessage: {
    fontSize: 13,
    color: "#ccc",
    marginBottom: 6,
    lineHeight: 18,
  },
  timestamp: {
    fontSize: 12,
    color: "#888",
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ff4444",
    borderRadius: 10,
  },
  actionText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
});
