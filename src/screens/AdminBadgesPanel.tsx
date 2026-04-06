import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "../services/api";

const ADMIN_KEY = "admin-secret-key-123";
const { width } = Dimensions.get("window");

type User = {
  id: string;
  username: string;
  email: string;
  stats: any;
  badgesEarned: number;
  badges: any[];
};

type Badge = {
  id: string;
  name: string;
  emoji: string;
  description: string;
};

type BadgeStat = {
  id: string;
  name: string;
  emoji: string;
  earnedCount: number;
  earnedByPercentage: string;
};

export default function AdminBadgesPanel() {
  const [tab, setTab] = useState<"users" | "badges" | "leaderboard">("users");
  const [users, setUsers] = useState<User[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [badgeStats, setBadgeStats] = useState<BadgeStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadData();
  }, [tab]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (tab === "users") {
        const [usersRes, badgesRes] = await Promise.all([
          fetch(`${BASE_URL}/api/admin/users`),
          fetch(`${BASE_URL}/api/admin/badges`),
        ]);
        const usersData = await usersRes.json();
        const badgesData = await badgesRes.json();
        setUsers(usersData);
        setBadges(badgesData);
      } else if (tab === "badges") {
        const [badgesRes, statsRes] = await Promise.all([
          fetch(`${BASE_URL}/api/admin/badges`),
          fetch(`${BASE_URL}/api/admin/badges/stats`),
        ]);
        const badgesData = await badgesRes.json();
        const statsData = await statsRes.json();
        setBadges(badgesData);
        setBadgeStats(statsData.badgeStats);
      } else if (tab === "leaderboard") {
        const res = await fetch(`${BASE_URL}/api/admin/leaderboard`);
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error("Load data error:", err);
      Alert.alert("Error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAwardBadge = async (badgeId: string) => {
    if (!selectedUser) return;

    try {
      const res = await fetch(`${BASE_URL}/api/admin/badges/award`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": ADMIN_KEY,
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          badgeId,
        }),
      });

      const result = await res.json();
      if (result.error) {
        Alert.alert("Error", result.error);
      } else {
        Alert.alert("Success", result.message);
        setShowAwardModal(false);
        loadData();
      }
    } catch (err) {
      console.error("Award badge error:", err);
      Alert.alert("Error", "Failed to award badge");
    }
  };

  const handleRevokeBadge = async (badgeId: string) => {
    if (!selectedUser) return;

    Alert.alert(
      "Revoke Badge",
      `Are you sure you want to revoke this badge from ${selectedUser.username}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${BASE_URL}/api/admin/badges/revoke`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-admin-key": ADMIN_KEY,
                },
                body: JSON.stringify({
                  userId: selectedUser.id,
                  badgeId,
                }),
              });

              const result = await res.json();
              if (result.error) {
                Alert.alert("Error", result.error);
              } else {
                Alert.alert("Success", result.message);
                loadData();
              }
            } catch (err) {
              console.error("Revoke badge error:", err);
              Alert.alert("Error", "Failed to revoke badge");
            }
          },
        },
      ]
    );
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderUsersTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.userCard}
            onPress={() => {
              setSelectedUser(item);
              setShowAwardModal(true);
            }}
          >
            <View style={styles.userCardHeader}>
              <View>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.email}>{item.email}</Text>
              </View>
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{item.badgesEarned}</Text>
                <Text style={styles.badgeCountLabel}>Badges</Text>
              </View>
            </View>
            <View style={styles.userStats}>
              <Text style={styles.statText}>
                📝 {item.stats?.answersGiven || 0} answers
              </Text>
              <Text style={styles.statText}>
                ❤️ {item.stats?.likesReceived || 0} likes
              </Text>
            </View>
            {item.badgesEarned > 0 && (
              <View style={styles.badgesPreview}>
                {item.badges.slice(0, 5).map((badge) => (
                  <Text key={badge.id} style={styles.badgeEmojiSmall}>
                    {badge.emoji}
                  </Text>
                ))}
                {item.badgesEarned > 5 && (
                  <Text style={styles.moreBadges}>+{item.badgesEarned - 5}</Text>
                )}
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No users found</Text>
        }
      />
    </View>
  );

  const renderBadgesTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Badge Distribution</Text>
      <FlatList
        data={badgeStats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.badgeStatCard}>
            <View style={styles.badgeStatHeader}>
              <Text style={styles.badgeStatEmoji}>{item.emoji}</Text>
              <View style={styles.badgeStatInfo}>
                <Text style={styles.badgeStatName}>{item.name}</Text>
                <Text style={styles.badgeStatEarned}>
                  {item.earnedCount} users ({item.earnedByPercentage}%)
                </Text>
              </View>
            </View>
            <View style={styles.statProgressBar}>
              <View
                style={[
                  styles.statProgressFill,
                  { width: `${Number(item.earnedByPercentage)}%` as `${number}%` },
                ]}
              />
            </View>
          </View>
        )}
      />
    </View>
  );

  const renderLeaderboardTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Top Badge Earners</Text>
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View style={styles.leaderboardCard}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <View style={styles.leaderboardInfo}>
              <Text style={styles.leaderboardUsername}>{item.username}</Text>
              <View style={styles.leaderboardStats}>
                <Text style={styles.leaderboardStat}>
                  {item.badgesEarned} badges
                </Text>
                <Text style={styles.leaderboardStat}>
                  {item.answersCount} answers
                </Text>
                <Text style={styles.leaderboardStat}>
                  {item.likesCount} likes
                </Text>
              </View>
            </View>
            <View style={styles.leaderboardBadges}>
              {item.badges.map((emoji: string, idx: number) => (
                <Text key={idx} style={styles.leaderboardBadgeEmoji}>
                  {emoji}
                </Text>
              ))}
            </View>
          </View>
        )}
      />
    </View>
  );

  const renderAwardModal = () => (
    <Modal
      transparent
      animationType="slide"
      visible={showAwardModal && !!selectedUser}
      onRequestClose={() => setShowAwardModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Award Badge</Text>
            <TouchableOpacity onPress={() => setShowAwardModal(false)}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {selectedUser && (
            <>
              <Text style={styles.modalUserName}>{selectedUser.username}</Text>
              <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>

              {/* Current badges */}
              {selectedUser.badgesEarned > 0 && (
                <View style={styles.currentBadgesSection}>
                  <Text style={styles.currentBadgesTitle}>Current Badges</Text>
                  <View style={styles.currentBadgesRow}>
                    {selectedUser.badges.map((badge) => (
                      <View key={badge.id} style={styles.currentBadge}>
                        <Text style={styles.currentBadgeEmoji}>
                          {badge.emoji}
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleRevokeBadge(badge.id)}
                        >
                          <Ionicons name="close-circle" size={16} color="#ff4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Available badges to award */}
              <Text style={styles.availableBadgesTitle}>Award New Badge</Text>
              <ScrollView style={styles.badgesList}>
                {badges.map((badge) => {
                  const alreadyHas = selectedUser.badges.some(
                    (b) => b.id === badge.id
                  );
                  return (
                    <TouchableOpacity
                      key={badge.id}
                      style={[
                        styles.badgeOption,
                        alreadyHas && styles.badgeOptionDisabled,
                      ]}
                      onPress={() => handleAwardBadge(badge.id)}
                      disabled={alreadyHas}
                    >
                      <Text style={styles.badgeOptionEmoji}>{badge.emoji}</Text>
                      <View style={styles.badgeOptionInfo}>
                        <Text style={styles.badgeOptionName}>
                          {badge.name}
                        </Text>
                        <Text style={styles.badgeOptionDesc}>
                          {badge.description}
                        </Text>
                      </View>
                      {!alreadyHas && (
                        <Ionicons name="add-circle" size={24} color="#ff4444" />
                      )}
                      {alreadyHas && (
                        <Ionicons
                          name="checkmark-circle"
                          size={24}
                          color="#4ade80"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏅 Admin Badge Panel</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, tab === "users" && styles.tabActive]}
          onPress={() => setTab("users")}
        >
          <Text
            style={[
              styles.tabText,
              tab === "users" && styles.tabTextActive,
            ]}
          >
            Users
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "badges" && styles.tabActive]}
          onPress={() => setTab("badges")}
        >
          <Text
            style={[
              styles.tabText,
              tab === "badges" && styles.tabTextActive,
            ]}
          >
            Badges
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "leaderboard" && styles.tabActive]}
          onPress={() => setTab("leaderboard")}
        >
          <Text
            style={[
              styles.tabText,
              tab === "leaderboard" && styles.tabTextActive,
            ]}
          >
            Leaderboard
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ff4444" />
        </View>
      ) : (
        <>
          {tab === "users" && renderUsersTab()}
          {tab === "badges" && renderBadgesTab()}
          {tab === "leaderboard" && renderLeaderboardTab()}
        </>
      )}

      {renderAwardModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#ff4444",
  },
  tabText: {
    color: "#666",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#ff4444",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabContent: {
    flex: 1,
    padding: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "white",
    paddingVertical: 10,
    fontSize: 14,
  },
  userCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  userCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  username: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
  },
  email: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  badgeCount: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff4444",
    width: 50,
    borderRadius: 6,
  },
  badgeCountText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  badgeCountLabel: {
    fontSize: 10,
    color: "white",
  },
  userStats: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },
  statText: {
    fontSize: 12,
    color: "#ccc",
  },
  badgesPreview: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
  },
  badgeEmojiSmall: {
    fontSize: 16,
  },
  moreBadges: {
    fontSize: 12,
    color: "#999",
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
    marginBottom: 12,
  },
  badgeStatCard: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  badgeStatHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeStatEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  badgeStatInfo: {
    flex: 1,
  },
  badgeStatName: {
    fontSize: 13,
    fontWeight: "bold",
    color: "white",
  },
  badgeStatEarned: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  statProgressBar: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  statProgressFill: {
    height: "100%",
    backgroundColor: "#ff4444",
  },
  leaderboardCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rank: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ff4444",
    width: 30,
  },
  leaderboardInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  leaderboardUsername: {
    fontSize: 14,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  leaderboardStats: {
    flexDirection: "row",
    gap: 8,
  },
  leaderboardStat: {
    fontSize: 11,
    color: "#999",
  },
  leaderboardBadges: {
    flexDirection: "row",
    gap: 4,
  },
  leaderboardBadgeEmoji: {
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 40,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  modalUserName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  modalUserEmail: {
    fontSize: 12,
    color: "#999",
    marginBottom: 16,
  },
  currentBadgesSection: {
    marginBottom: 16,
  },
  currentBadgesTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ccc",
    marginBottom: 8,
  },
  currentBadgesRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  currentBadge: {
    alignItems: "center",
    backgroundColor: "rgba(74, 222, 128, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4ade80",
  },
  currentBadgeEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  availableBadgesTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ccc",
    marginBottom: 8,
  },
  badgesList: {
    flex: 1,
  },
  badgeOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  badgeOptionDisabled: {
    opacity: 0.5,
  },
  badgeOptionEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  badgeOptionInfo: {
    flex: 1,
  },
  badgeOptionName: {
    fontSize: 13,
    fontWeight: "bold",
    color: "white",
  },
  badgeOptionDesc: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
});
