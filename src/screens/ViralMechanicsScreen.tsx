import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const { width, height } = Dimensions.get("window");

// 🔥 MINORITY JOIN FEATURE
const MINORITY_INSIGHTS = [
  {
    question: "Pineapple on pizza?",
    yourChoice: "Yes",
    minorityPercent: 23,
    totalVotes: 15420,
    message: "You're in the 23% who think pineapple belongs on pizza! 🔥 Rare opinion!"
  },
  {
    question: "Cats or dogs?",
    yourChoice: "Cats",
    minorityPercent: 18,
    totalVotes: 12350,
    message: "You're in the 18% who prefer cats! 🐱 Unique choice!"
  },
  {
    question: "Coffee or tea?",
    yourChoice: "Tea",
    minorityPercent: 31,
    totalVotes: 9876,
    message: "You're in the 31% who choose tea! 🍵 Sophisticated taste!"
  },
  {
    question: "Morning person?",
    yourChoice: "No",
    minorityPercent: 15,
    totalVotes: 15670,
    message: "You're in the 15% who aren't morning people! 🌙 Night owl!"
  }
];

// 💥 OPINION BATTLES WITH LIVE RESULTS
const LIVE_BATTLES = [
  {
    id: "battle1",
    question: "Should homework be banned in schools?",
    yesVotes: 3456,
    noVotes: 5678,
    totalVotes: 9134,
    timeLeft: "2h 15m",
    trending: true,
    category: "education"
  },
  {
    id: "battle2",
    question: "Is remote work better than office?",
    yesVotes: 6789,
    noVotes: 4321,
    totalVotes: 11110,
    timeLeft: "4h 30m",
    trending: false,
    category: "work"
  },
  {
    id: "battle3",
    question: "Are smartphones making us less social?",
    yesVotes: 7890,
    noVotes: 3456,
    totalVotes: 11346,
    timeLeft: "1h 45m",
    trending: true,
    category: "technology"
  }
];

// ⚡ QUICK REACTIONS
const QUICK_REACTIONS = [
  { emoji: "🔥", label: "Fire", color: "#ff6b6b" },
  { emoji: "😎", label: "Cool", color: "#4caf50" },
  { emoji: "🤯", label: "Mind blown", color: "#ff9800" },
  { emoji: "😡", label: "Angry", color: "#f44336" },
  { emoji: "🤔", label: "Thinking", color: "#2196f3" },
  { emoji: "😂", label: "Funny", color: "#9c27b0" }
];

// 📢 VIRAL NOTIFICATIONS
const NOTIFICATION_TYPES = [
  {
    type: "streak_warning",
    title: "🔥 Streak Warning!",
    message: "Your 7-day streak is about to break! Answer now to keep it alive.",
    action: "Answer Now",
    urgent: true
  },
  {
    type: "daily_question",
    title: "❓ Daily Question Live!",
    message: "New question dropped! Everyone's answering - join the conversation.",
    action: "Answer Now",
    urgent: false
  },
  {
    type: "battle_ending",
    title: "⚔️ Battle Ending Soon!",
    message: "The hot take battle ends in 30 minutes. Cast your vote!",
    action: "Vote Now",
    urgent: true
  },
  {
    type: "friend_joined",
    title: "👥 Friend Joined!",
    message: "Your friend @BestFriend just joined via your invite! +50 points",
    action: "Say Hi",
    urgent: false
  }
];

export default function ViralMechanicsScreen() {
  const navigation = useNavigation();
  const [selectedInsight, setSelectedInsight] = useState(MINORITY_INSIGHTS[0]);
  const [userReactions, setUserReactions] = useState({});
  const [battleVotes, setBattleVotes] = useState({});

  const handleReaction = (contentId, reaction) => {
    setUserReactions({...userReactions, [contentId]: reaction});
    Alert.alert("⚡ Reacted!", `You reacted with ${reaction.emoji}!`);
  };

  const handleBattleVote = (battleId, vote) => {
    setBattleVotes({...battleVotes, [battleId]: vote});
    Alert.alert("⚔️ Voted!", `You voted ${vote.toUpperCase()} in the battle!`);
  };

  const handleShareMinority = () => {
    Alert.alert("📤 Shared!", "Posted your minority opinion to feed!");
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>🚀 Viral Engine</Text>
      <TouchableOpacity>
        <Ionicons name="settings" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );

  const renderMinorityInsight = () => (
    <View style={styles.minorityCard}>
      <View style={styles.minorityHeader}>
        <Text style={styles.minorityBadge}>🎯 MINORITY CLUB</Text>
        <TouchableOpacity onPress={handleShareMinority}>
          <Ionicons name="share-outline" size={20} color="#ff6b6b" />
        </TouchableOpacity>
      </View>

      <Text style={styles.minorityMessage}>{selectedInsight.message}</Text>

      <View style={styles.minorityStats}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{selectedInsight.minorityPercent}%</Text>
          <Text style={styles.statLabel}>Like You</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{selectedInsight.totalVotes.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Votes</Text>
        </View>
        <View style={styles.choiceBox}>
          <Text style={styles.choiceLabel}>Your Choice</Text>
          <Text style={styles.choiceValue}>{selectedInsight.yourChoice}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.insightsScroll}
        contentContainerStyle={styles.insightsContainer}
      >
        {MINORITY_INSIGHTS.map((insight, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.insightPill,
              selectedInsight.question === insight.question && styles.insightPillActive
            ]}
            onPress={() => setSelectedInsight(insight)}
          >
            <Text style={styles.insightText}>{insight.question.slice(0, 20)}...</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderLiveBattles = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚔️ Live Opinion Battles</Text>
      <Text style={styles.sectionSubtitle}>Vote before time runs out!</Text>

      {LIVE_BATTLES.map((battle) => {
        const userVote = battleVotes[battle.id];
        const yesPercent = Math.round((battle.yesVotes / battle.totalVotes) * 100);
        const noPercent = Math.round((battle.noVotes / battle.totalVotes) * 100);

        return (
          <View key={battle.id} style={styles.battleCard}>
            <View style={styles.battleHeader}>
              <Text style={styles.battleCategory}>
                {battle.category === 'education' ? '🎓' :
                 battle.category === 'work' ? '💼' : '📱'}
              </Text>
              <View style={styles.battleMeta}>
                {battle.trending && <Text style={styles.trendingBadge}>🔥</Text>}
                <Text style={styles.timeLeft}>{battle.timeLeft} left</Text>
              </View>
            </View>

            <Text style={styles.battleQuestion}>{battle.question}</Text>

            <View style={styles.battleResults}>
              <TouchableOpacity
                style={[
                  styles.battleOption,
                  userVote === 'yes' && styles.votedOption
                ]}
                onPress={() => handleBattleVote(battle.id, 'yes')}
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionEmoji}>👍</Text>
                  <Text style={styles.optionLabel}>Yes</Text>
                  <Text style={styles.optionPercent}>{yesPercent}%</Text>
                </View>
                <View style={styles.optionBar}>
                  <View style={[styles.optionFill, styles.yesFill, { width: `${yesPercent}%` }]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.battleOption,
                  userVote === 'no' && styles.votedOption
                ]}
                onPress={() => handleBattleVote(battle.id, 'no')}
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionEmoji}>👎</Text>
                  <Text style={styles.optionLabel}>No</Text>
                  <Text style={styles.optionPercent}>{noPercent}%</Text>
                </View>
                <View style={styles.optionBar}>
                  <View style={[styles.optionFill, styles.noFill, { width: `${noPercent}%` }]} />
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.battleTotal}>
              {battle.totalVotes.toLocaleString()} votes • Live results
            </Text>
          </View>
        );
      })}
    </View>
  );

  const renderQuickReactions = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚡ Quick Reactions</Text>
      <Text style={styles.sectionSubtitle}>React in seconds, no typing needed</Text>

      <View style={styles.reactionsGrid}>
        {QUICK_REACTIONS.map((reaction, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.reactionButton, { backgroundColor: reaction.color + "20", borderColor: reaction.color }]}
            onPress={() => handleReaction(`sample_${index}`, reaction)}
          >
            <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
            <Text style={styles.reactionLabel}>{reaction.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.reactionDemo}>
        <Text style={styles.demoText}>Try it on this answer:</Text>
        <View style={styles.sampleAnswer}>
          <Text style={styles.sampleText}>"Pineapple DOES belong on pizza! Fight me!"</Text>
          <Text style={styles.sampleAuthor}>@PizzaWarrior</Text>
        </View>

        <View style={styles.reactionBar}>
          {QUICK_REACTIONS.slice(0, 4).map((reaction, index) => (
            <TouchableOpacity
              key={index}
              style={styles.miniReaction}
              onPress={() => handleReaction('demo_answer', reaction)}
            >
              <Text style={styles.miniEmoji}>{reaction.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderNotifications = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📢 Smart Notifications</Text>
      <Text style={styles.sectionSubtitle}>What keeps users coming back</Text>

      {NOTIFICATION_TYPES.map((notif, index) => (
        <View key={index} style={[styles.notifCard, notif.urgent && styles.urgentNotif]}>
          <View style={styles.notifHeader}>
            <Text style={styles.notifTitle}>{notif.title}</Text>
            {notif.urgent && <Text style={styles.urgentBadge}>⚡ URGENT</Text>}
          </View>

          <Text style={styles.notifMessage}>{notif.message}</Text>

          <TouchableOpacity style={styles.notifAction}>
            <Text style={styles.notifActionText}>{notif.action}</Text>
            <Ionicons name="chevron-forward" size={16} color="#ff6b6b" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {renderHeader()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderMinorityInsight()}
        {renderLiveBattles()}
        {renderQuickReactions()}
        {renderNotifications()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  minorityCard: {
    backgroundColor: "#111",
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    borderWidth: 2,
    borderColor: "#ffd700",
  },
  minorityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  minorityBadge: {
    color: "#ffd700",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  minorityMessage: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    lineHeight: 24,
    marginBottom: 20,
  },
  minorityStats: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    color: "#ff6b6b",
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  choiceBox: {
    flex: 1,
    alignItems: "center",
  },
  choiceLabel: {
    color: "#888",
    fontSize: 12,
  },
  choiceValue: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 4,
  },
  insightsScroll: {
    maxHeight: 50,
  },
  insightsContainer: {
    gap: 10,
  },
  insightPill: {
    backgroundColor: "#222",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#333",
  },
  insightPillActive: {
    backgroundColor: "#ff6b6b",
    borderColor: "#ff6b6b",
  },
  insightText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "bold",
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: "#888",
    fontSize: 14,
    marginBottom: 15,
  },
  battleCard: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
  },
  battleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  battleCategory: {
    fontSize: 20,
  },
  battleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trendingBadge: {
    fontSize: 12,
  },
  timeLeft: {
    color: "#ff9800",
    fontSize: 12,
    fontWeight: "bold",
  },
  battleQuestion: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    lineHeight: 22,
  },
  battleResults: {
    gap: 10,
    marginBottom: 10,
  },
  battleOption: {
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: "#333",
  },
  votedOption: {
    borderColor: "#ff6b6b",
    backgroundColor: "rgba(255,107,107,0.1)",
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  optionEmoji: {
    fontSize: 20,
    marginRight: 10,
  },
  optionLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    flex: 1,
  },
  optionPercent: {
    color: "#888",
    fontSize: 14,
  },
  optionBar: {
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    overflow: "hidden",
  },
  optionFill: {
    height: "100%",
    borderRadius: 3,
  },
  yesFill: {
    backgroundColor: "#4caf50",
  },
  noFill: {
    backgroundColor: "#f44336",
  },
  battleTotal: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
  },
  reactionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  reactionButton: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  reactionEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  reactionLabel: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  reactionDemo: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 15,
  },
  demoText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
  },
  sampleAnswer: {
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  sampleText: {
    color: "white",
    fontSize: 14,
    marginBottom: 4,
  },
  sampleAuthor: {
    color: "#888",
    fontSize: 12,
  },
  reactionBar: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  miniReaction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  miniEmoji: {
    fontSize: 16,
  },
  notifCard: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  urgentNotif: {
    borderColor: "#ff6b6b",
    backgroundColor: "rgba(255,107,107,0.1)",
  },
  notifHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  notifTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  urgentBadge: {
    color: "#ff6b6b",
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  notifMessage: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  notifAction: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  notifActionText: {
    color: "#ff6b6b",
    fontSize: 14,
    fontWeight: "bold",
    marginRight: 4,
  },
});
