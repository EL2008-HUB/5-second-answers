// @ts-nocheck
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  FlatList,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const { width, height } = Dimensions.get("window");

// 🔥 TRENDING TOPICS
const TRENDING_TOPICS = [
  {
    id: "tech_life",
    title: "Tech Life Hacks",
    description: "Quick tech tips that save time",
    participants: 15420,
    growth: "+23%",
    icon: "💻",
    color: "#00bcd4",
    posts: 342
  },
  {
    id: "coffee_talk",
    title: "Coffee Talk",
    description: "Everything about coffee culture",
    participants: 12350,
    growth: "+18%",
    icon: "☕",
    color: "#8b4513",
    posts: 289
  },
  {
    id: "5s_learning",
    title: "5-Second Learning",
    description: "Learn anything in 5 seconds",
    participants: 28930,
    growth: "+45%",
    icon: "🎯",
    color: "#ff4444",
    posts: 567
  },
  {
    id: "meme_battle",
    title: "Meme Battle",
    description: "Best memes win the day",
    participants: 45620,
    growth: "+67%",
    icon: "😂",
    color: "#ff00ff",
    posts: 892
  }
];

// 🎯 VIRAL CHALLENGES
const VIRAL_CHALLENGES = [
  {
    id: "explain_like_im_5",
    title: "Explain Like I'm 5",
    description: "Break down complex topics simply",
    hashtag: "#ExplainLikeIm5",
    participants: 8934,
    daysLeft: 3,
    prize: "🏆 Viral Creator Badge",
    difficulty: "Easy",
    entries: [
      { username: "TechGuru", content: "Quantum computing is like magic math", likes: 234 },
      { username: "ScienceKid", content: "Black holes are cosmic vacuum cleaners", likes: 189 }
    ]
  },
  {
    id: "hot_take_challenge",
    title: "Hot Take Challenge",
    description: "Share your most controversial opinions",
    hashtag: "#HotTakeChallenge",
    participants: 15670,
    daysLeft: 5,
    prize: "💎 500 Points",
    difficulty: "Medium",
    entries: [
      { username: "TruthTeller", content: "Pineapple belongs on pizza", likes: 567 },
      { username: "RebelMind", content: "Meetings are a waste of time", likes: 423 }
    ]
  },
  {
    id: "speed_create",
    title: "Speed Create",
    description: "Create something amazing in 5 seconds",
    hashtag: "#SpeedCreate",
    participants: 23450,
    daysLeft: 2,
    prize: "⚡ Speed Demon Badge",
    difficulty: "Hard",
    entries: [
      { username: "QuickArtist", content: "Drew a masterpiece in 5s", likes: 892 },
      { username: "FlashThinker", content: "Solved riddle instantly", likes: 756 }
    ]
  }
];

// 📈 TRENDING CONTENT
const TRENDING_CONTENT = [
  {
    id: "1",
    type: "video",
    title: "How to code in 5 seconds",
    creator: "CodeMaster",
    thumbnail: "https://via.placeholder.com/300x400/333/fff?text=CODE",
    views: 45670,
    likes: 2340,
    trend: "🔥 Trending #1",
    category: "Tech"
  },
  {
    id: "2",
    type: "meme",
    title: "When coffee kicks in",
    creator: "MemeLord",
    thumbnail: "https://via.placeholder.com/300x400/8b4513/fff?text=COFFEE",
    views: 38920,
    likes: 1923,
    trend: "📈 Rising Fast",
    category: "Lifestyle"
  },
  {
    id: "3",
    type: "text",
    title: "Life hack that changed everything",
    creator: "LifeGuru",
    thumbnail: "https://via.placeholder.com/300x400/4caf50/fff?text=LIFE",
    views: 29840,
    likes: 1567,
    trend: "⚡ Viral",
    category: "Life"
  }
];

export default function TrendingScreen() {
  const navigation = useNavigation();
  const [selectedTab, setSelectedTab] = useState("topics");
  const [joinedChallenges, setJoinedChallenges] = useState([]);
  const scrollY = new Animated.Value(0);

  const handleJoinChallenge = (challengeId) => {
    if (joinedChallenges.includes(challengeId)) {
      setJoinedChallenges(joinedChallenges.filter(id => id !== challengeId));
    } else {
      setJoinedChallenges([...joinedChallenges, challengeId]);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>🔥 Trending</Text>
      <TouchableOpacity>
        <Ionicons name="notifications" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );

  const renderTabNavigation = () => (
    <View style={styles.tabContainer}>
      {[
        { id: "topics", label: "Topics", icon: "📊" },
        { id: "challenges", label: "Challenges", icon: "🎯" },
        { id: "content", label: "Content", icon: "📱" }
      ].map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tabButton,
            selectedTab === tab.id && styles.tabButtonActive
          ]}
          onPress={() => setSelectedTab(tab.id)}
        >
          <Text style={styles.tabIcon}>{tab.icon}</Text>
          <Text style={[
            styles.tabLabel,
            selectedTab === tab.id && styles.tabLabelActive
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTrendingTopics = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🔥 Trending Topics</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
      
      {TRENDING_TOPICS.map((topic, index) => (
        <TouchableOpacity key={topic.id} style={styles.topicCard}>
          <View style={styles.topicHeader}>
            <View style={[styles.topicIcon, { backgroundColor: topic.color + "20" }]}>
              <Text style={styles.topicEmoji}>{topic.icon}</Text>
            </View>
            <View style={styles.topicInfo}>
              <Text style={styles.topicTitle}>{topic.title}</Text>
              <Text style={styles.topicDescription}>{topic.description}</Text>
            </View>
            <View style={styles.topicStats}>
              <Text style={styles.participants}>{topic.participants.toLocaleString()}</Text>
              <Text style={styles.growth}>{topic.growth}</Text>
            </View>
          </View>
          
          <View style={styles.topicFooter}>
            <Text style={styles.postsCount}>{topic.posts} posts</Text>
            <TouchableOpacity style={styles.joinButton}>
              <Text style={styles.joinButtonText}>Join Topic</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderViralChallenges = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🎯 Viral Challenges</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
      
      {VIRAL_CHALLENGES.map((challenge, index) => {
        const isJoined = joinedChallenges.includes(challenge.id);
        
        return (
          <TouchableOpacity key={challenge.id} style={styles.challengeCard}>
            <View style={styles.challengeHeader}>
              <View style={styles.challengeInfo}>
                <Text style={styles.challengeTitle}>{challenge.title}</Text>
                <Text style={styles.challengeDescription}>{challenge.description}</Text>
                <Text style={styles.hashtag}>{challenge.hashtag}</Text>
              </View>
              <View style={styles.challengeMeta}>
                <View style={[styles.difficultyBadge, {
                  backgroundColor: 
                    challenge.difficulty === "Easy" ? "#4caf50" :
                    challenge.difficulty === "Medium" ? "#ff9800" : "#f44336"
                }]}>
                  <Text style={styles.difficultyText}>{challenge.difficulty}</Text>
                </View>
                <Text style={styles.daysLeft}>{challenge.daysLeft} days left</Text>
              </View>
            </View>
            
            <View style={styles.challengeStats}>
              <View style={styles.statItem}>
                <Ionicons name="people" size={16} color="#888" />
                <Text style={styles.statText}>{challenge.participants.toLocaleString()}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="trophy" size={16} color="#ffd700" />
                <Text style={styles.statText}>{challenge.prize}</Text>
              </View>
            </View>
            
            <View style={styles.entriesPreview}>
              <Text style={styles.entriesTitle}>Top Entries</Text>
              {challenge.entries.slice(0, 2).map((entry, idx) => (
                <View key={idx} style={styles.entryItem}>
                  <Text style={styles.entryUsername}>{entry.username}</Text>
                  <Text style={styles.entryContent}>"{entry.content}"</Text>
                  <View style={styles.entryLikes}>
                    <Ionicons name="heart" size={12} color="#ff4444" />
                    <Text style={styles.entryLikesText}>{entry.likes}</Text>
                  </View>
                </View>
              ))}
            </View>
            
            <TouchableOpacity
              style={[
                styles.joinChallengeButton,
                isJoined && styles.joinedButton
              ]}
              onPress={() => handleJoinChallenge(challenge.id)}
            >
              <Text style={[
                styles.joinChallengeButtonText,
                isJoined && styles.joinedButtonText
              ]}>
                {isJoined ? "✅ Joined" : "🚀 Join Challenge"}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderTrendingContent = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>📱 Trending Content</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={TRENDING_CONTENT}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.contentCard}>
            <View style={styles.contentThumbnail}>
              <Text style={styles.contentThumbnailText}>{item.category[0]}</Text>
            </View>
            <View style={styles.contentOverlay}>
              <Text style={styles.contentTrend}>{item.trend}</Text>
            </View>
            <View style={styles.contentInfo}>
              <Text style={styles.contentTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.contentCreator}>@{item.creator}</Text>
              <View style={styles.contentStats}>
                <View style={styles.contentStat}>
                  <Ionicons name="eye" size={12} color="#888" />
                  <Text style={styles.contentStatText}>{item.views.toLocaleString()}</Text>
                </View>
                <View style={styles.contentStat}>
                  <Ionicons name="heart" size={12} color="#ff4444" />
                  <Text style={styles.contentStatText}>{item.likes.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.contentList}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {renderHeader()}
      {renderTabNavigation()}
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
      >
        {selectedTab === "topics" && renderTrendingTopics()}
        {selectedTab === "challenges" && renderViralChallenges()}
        {selectedTab === "content" && renderTrendingContent()}
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
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#111",
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: "#ff4444",
  },
  tabIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tabLabel: {
    color: "#888",
    fontSize: 14,
    fontWeight: "bold",
  },
  tabLabelActive: {
    color: "#fff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  seeAll: {
    color: "#ff4444",
    fontSize: 14,
    fontWeight: "bold",
  },
  topicCard: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
  },
  topicHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  topicIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  topicEmoji: {
    fontSize: 24,
  },
  topicInfo: {
    flex: 1,
  },
  topicTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  topicDescription: {
    color: "#888",
    fontSize: 13,
  },
  topicStats: {
    alignItems: "flex-end",
  },
  participants: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  growth: {
    color: "#4caf50",
    fontSize: 12,
    fontWeight: "bold",
  },
  topicFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postsCount: {
    color: "#888",
    fontSize: 12,
  },
  joinButton: {
    backgroundColor: "#ff4444",
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 12,
  },
  joinButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  challengeCard: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  challengeHeader: {
    marginBottom: 12,
  },
  challengeInfo: {
    marginBottom: 10,
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
    marginBottom: 6,
  },
  hashtag: {
    color: "#ff4444",
    fontSize: 12,
    fontWeight: "bold",
  },
  challengeMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  difficultyText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  daysLeft: {
    color: "#ff9800",
    fontSize: 12,
    fontWeight: "bold",
  },
  challengeStats: {
    flexDirection: "row",
    marginBottom: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 20,
  },
  statText: {
    color: "#888",
    fontSize: 12,
    marginLeft: 4,
  },
  entriesPreview: {
    backgroundColor: "#0a0a0a",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  entriesTitle: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
  },
  entryItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  entryUsername: {
    color: "#ff4444",
    fontSize: 12,
    fontWeight: "bold",
    marginRight: 8,
    minWidth: 80,
  },
  entryContent: {
    color: "#ccc",
    fontSize: 12,
    flex: 1,
    fontStyle: "italic",
  },
  entryLikes: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  entryLikesText: {
    color: "#888",
    fontSize: 11,
    marginLeft: 2,
  },
  joinChallengeButton: {
    backgroundColor: "#ff4444",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  joinedButton: {
    backgroundColor: "#4caf50",
  },
  joinChallengeButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  joinedButtonText: {
    color: "white",
  },
  contentList: {
    paddingRight: 10,
  },
  contentCard: {
    width: 200,
    backgroundColor: "#111",
    borderRadius: 15,
    marginRight: 12,
    overflow: "hidden",
  },
  contentThumbnail: {
    height: 120,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  contentThumbnailText: {
    color: "#666",
    fontSize: 32,
    fontWeight: "bold",
  },
  contentOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,68,68,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  contentTrend: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  contentInfo: {
    padding: 12,
  },
  contentTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  contentCreator: {
    color: "#888",
    fontSize: 12,
    marginBottom: 8,
  },
  contentStats: {
    flexDirection: "row",
  },
  contentStat: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
  },
  contentStatText: {
    color: "#888",
    fontSize: 11,
    marginLeft: 4,
  },
});
