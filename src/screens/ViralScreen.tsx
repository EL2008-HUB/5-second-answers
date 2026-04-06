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
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const { width, height } = Dimensions.get("window");
const BASE_URL = "http://localhost:5000";

// 🔥 VIRAL MECHANICS
const VIRAL_CHALLENGES = [
  {
    id: "share_streak",
    title: "Share Your Streak 🔥",
    description: "Post your current streak on social media",
    reward: 100,
    action: "share",
    icon: "🔥",
    viralText: "I'm on a 🔥 streak on 5-Second Answers! Can you beat my record?"
  },
  {
    id: "challenge_friend",
    title: "Challenge a Friend ⚔️",
    description: "Send a challenge to someone not using the app",
    reward: 75,
    action: "invite",
    icon: "⚔️",
    viralText: "I challenge you to join 5-Second Answers! Answer in 5 seconds or less!"
  },
  {
    id: "viral_meme",
    title: "Create Viral Meme 😎",
    description: "Make a meme that gets 50+ reactions",
    reward: 200,
    action: "create",
    icon: "😎",
    viralText: "Just created this meme on 5-Second Answers! Check it out!"
  }
];

// 💥 OPINION BATTLES
const OPINION_BATTLES = [
  {
    id: "battle1",
    question: "Pineapple on pizza?",
    yesVotes: 2341,
    noVotes: 3456,
    totalVotes: 5800,
    userVote: null,
    trending: true
  },
  {
    id: "battle2",
    question: "Cats or dogs?",
    yesVotes: 4567,
    noVotes: 3210,
    totalVotes: 7780,
    userVote: "yes",
    trending: false
  },
  {
    id: "battle3",
    question: "Coffee or tea?",
    yesVotes: 2987,
    noVotes: 4123,
    totalVotes: 7110,
    userVote: "no",
    trending: true
  }
];

// 🚀 VIRAL FEATURES
const VIRAL_FEATURES = [
  {
    id: "quick_reactions",
    title: "Quick Reactions",
    description: "React with 🔥 😎 🤯 in seconds",
    icon: "⚡",
    unlocked: true
  },
  {
    id: "opinion_battles",
    title: "Opinion Battles",
    description: "Vote on hot takes, see live results",
    icon: "⚔️",
    unlocked: true
  },
  {
    id: "challenge_friends",
    title: "Challenge Friends",
    description: "Send viral challenges to contacts",
    icon: "👥",
    unlocked: false
  },
  {
    id: "share_streaks",
    title: "Share Streaks",
    description: "Post achievements on social media",
    icon: "🔥",
    unlocked: true
  },
  {
    id: "viral_templates",
    title: "Viral Templates",
    description: "Use proven viral formats",
    icon: "🎨",
    unlocked: false
  },
  {
    id: "duet_answers",
    title: "Duet Answers",
    description: "React to answers with your take",
    icon: "🎭",
    unlocked: false
  }
];

export default function ViralScreen() {
  const navigation = useNavigation();
  const [userVotes, setUserVotes] = useState({});
  const [completedChallenges, setCompletedChallenges] = useState([]);

  const handleShare = async (challenge) => {
    try {
      await Share.share({
        message: challenge.viralText,
        url: 'https://5secondanswers.app'
      });
      setCompletedChallenges([...completedChallenges, challenge.id]);
      Alert.alert("✅ Shared!", `Earned ${challenge.reward} points!`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleVote = (battleId, vote) => {
    setUserVotes({...userVotes, [battleId]: vote});
    // Simulate live update
    Alert.alert("✅ Voted!", "Your vote has been counted!");
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>🚀 Go Viral</Text>
      <TouchableOpacity>
        <Ionicons name="share-social" size={24} color="#ff6b6b" />
      </TouchableOpacity>
    </View>
  );

  const renderViralChallenges = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🎯 Viral Challenges</Text>
      <Text style={styles.sectionSubtitle}>Complete these to spread the word</Text>

      {VIRAL_CHALLENGES.map((challenge) => {
        const isCompleted = completedChallenges.includes(challenge.id);

        return (
          <TouchableOpacity
            key={challenge.id}
            style={[styles.challengeCard, isCompleted && styles.completedCard]}
            onPress={() => !isCompleted && handleShare(challenge)}
          >
            <View style={styles.challengeHeader}>
              <Text style={styles.challengeIcon}>{challenge.icon}</Text>
              <View style={styles.challengeContent}>
                <Text style={styles.challengeTitle}>{challenge.title}</Text>
                <Text style={styles.challengeDescription}>{challenge.description}</Text>
                <Text style={styles.rewardText}>+{challenge.reward} points</Text>
              </View>
              {isCompleted ? (
                <Ionicons name="checkmark-circle" size={24} color="#4caf50" />
              ) : (
                <Ionicons name="share-outline" size={24} color="#ff6b6b" />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderOpinionBattles = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚔️ Opinion Battles</Text>
      <Text style={styles.sectionSubtitle}>Vote and see live results</Text>

      {OPINION_BATTLES.map((battle) => {
        const userVote = userVotes[battle.id] || battle.userVote;
        const yesPercent = Math.round((battle.yesVotes / battle.totalVotes) * 100);
        const noPercent = Math.round((battle.noVotes / battle.totalVotes) * 100);

        return (
          <View key={battle.id} style={styles.battleCard}>
            <Text style={styles.battleQuestion}>{battle.question}</Text>

            <View style={styles.battleResults}>
              <View style={styles.resultBar}>
                <View style={[styles.resultFill, styles.yesFill, { width: `${yesPercent}%` }]}>
                  <Text style={styles.resultText}>Yes {battle.yesVotes.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.resultBar}>
                <View style={[styles.resultFill, styles.noFill, { width: `${noPercent}%` }]}>
                  <Text style={styles.resultText}>No {battle.noVotes.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {battle.trending && (
              <Text style={styles.trendingBadge}>🔥 Trending</Text>
            )}

            <View style={styles.voteButtons}>
              <TouchableOpacity
                style={[styles.voteButton, userVote === 'yes' && styles.votedButton]}
                onPress={() => handleVote(battle.id, 'yes')}
              >
                <Text style={[styles.voteText, userVote === 'yes' && styles.votedText]}>
                  👍 Yes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.voteButton, userVote === 'no' && styles.votedButton]}
                onPress={() => handleVote(battle.id, 'no')}
              >
                <Text style={[styles.voteText, userVote === 'no' && styles.votedText]}>
                  👎 No
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderViralFeatures = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>✨ Viral Features</Text>
      <Text style={styles.sectionSubtitle}>Unlock these as you grow</Text>

      <View style={styles.featuresGrid}>
        {VIRAL_FEATURES.map((feature) => (
          <TouchableOpacity
            key={feature.id}
            style={[styles.featureCard, !feature.unlocked && styles.lockedFeature]}
            disabled={!feature.unlocked}
          >
            <Text style={styles.featureIcon}>{feature.icon}</Text>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureDescription}>{feature.description}</Text>
            {!feature.unlocked && (
              <View style={styles.lockOverlay}>
                <Ionicons name="lock-closed" size={20} color="#666" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStats = () => (
    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>📊 Your Viral Impact</Text>
      <View style={styles.statsGrid}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Shares</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>8</Text>
          <Text style={styles.statLabel}>Challenges</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>45</Text>
          <Text style={styles.statLabel}>Votes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>892</Text>
          <Text style={styles.statLabel}>Reach</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {renderHeader()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStats()}
        {renderViralChallenges()}
        {renderOpinionBattles()}
        {renderViralFeatures()}
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
  statsCard: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 20,
    marginBottom: 25,
  },
  statsTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: "#ff6b6b",
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  challengeCard: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  completedCard: {
    borderColor: "#4caf50",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
  },
  challengeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  challengeIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  challengeContent: {
    flex: 1,
  },
  challengeTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  challengeDescription: {
    color: "#888",
    fontSize: 13,
    marginBottom: 8,
  },
  rewardText: {
    color: "#ff6b6b",
    fontSize: 12,
    fontWeight: "bold",
  },
  battleCard: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  battleQuestion: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  battleResults: {
    marginBottom: 15,
  },
  resultBar: {
    height: 40,
    backgroundColor: "#333",
    borderRadius: 20,
    marginBottom: 8,
    overflow: "hidden",
  },
  resultFill: {
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 15,
  },
  yesFill: {
    backgroundColor: "#4caf50",
  },
  noFill: {
    backgroundColor: "#f44336",
  },
  resultText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  trendingBadge: {
    color: "#ff6b6b",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  voteButtons: {
    flexDirection: "row",
    gap: 10,
  },
  voteButton: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  votedButton: {
    backgroundColor: "#ff6b6b",
  },
  voteText: {
    color: "#888",
    fontSize: 14,
    fontWeight: "bold",
  },
  votedText: {
    color: "white",
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  featureCard: {
    width: "48%",
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    position: "relative",
  },
  lockedFeature: {
    opacity: 0.6,
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  featureTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
  },
  featureDescription: {
    color: "#888",
    fontSize: 12,
    lineHeight: 16,
  },
  lockOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
