import React, { useState } from "react";
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

// 🎯 DISCOVERY ALGORITHM
const DISCOVER_FEEDS = [
  {
    id: "trending",
    title: "🔥 Trending Now",
    description: "What's hot right now",
    icon: "🔥",
    color: "#ff4444",
    content: ["Viral memes", "Hot takes", "Trending challenges"]
  },
  {
    id: "following",
    title: "👥 Following",
    description: "Content from friends",
    icon: "👥",
    color: "#4caf50",
    content: ["Friend updates", "Challenges", "Personal stories"]
  },
  {
    id: "country",
    title: "🇦🇱 Albania",
    description: "Local content & trends",
    icon: "🇦🇱",
    color: "#2196f3",
    content: ["Tirana trends", "Albanian memes", "Local news"]
  },
  {
    id: "global",
    title: "🌍 Global",
    description: "Worldwide content",
    icon: "🌍",
    color: "#ff9800",
    content: ["International", "Cross-cultural", "Global trends"]
  },
  {
    id: "educational",
    title: "🎓 Learn",
    description: "Educational content",
    icon: "🎓",
    color: "#9c27b0",
    content: ["Science", "History", "Technology", "Facts"]
  },
  {
    id: "entertainment",
    title: "🎭 Entertainment",
    description: "Fun & entertainment",
    icon: "🎭",
    color: "#e91e63",
    content: ["Memes", "Jokes", "Challenges", "Entertainment"]
  }
];

// 🤖 AI SUGGESTIONS
const AI_SUGGESTIONS = [
  {
    type: "question",
    title: "AI Generated Question",
    content: "What's the weirdest food combination you've ever tried?",
    reason: "Trending topic in your region"
  },
  {
    type: "challenge",
    title: "Speed Challenge",
    content: "Answer 5 questions in under 30 seconds",
    reason: "Matches your answering speed"
  },
  {
    type: "friend",
    title: "Connect with Alex",
    content: "Alex has similar interests and is on a 15-day streak",
    reason: "Based on your activity patterns"
  }
];

// 📱 CONTENT TYPES
const CONTENT_TYPES = [
  { id: "questions", label: "Questions", icon: "❓", active: true },
  { id: "battles", label: "Battles", icon: "⚔️", active: true },
  { id: "memes", label: "Memes", icon: "😂", active: true },
  { id: "videos", label: "Videos", icon: "🎥", active: false },
  { id: "articles", label: "Articles", icon: "📄", active: false }
];

export default function DiscoveryScreen() {
  const navigation = useNavigation();
  const [selectedFeed, setSelectedFeed] = useState("trending");
  const [activeContentTypes, setActiveContentTypes] = useState(["questions", "battles", "memes"]);

  const handleFeedChange = (feedId) => {
    setSelectedFeed(feedId);
  };

  const toggleContentType = (typeId) => {
    if (activeContentTypes.includes(typeId)) {
      setActiveContentTypes(activeContentTypes.filter(id => id !== typeId));
    } else {
      setActiveContentTypes([...activeContentTypes, typeId]);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>🔍 Discover</Text>
      <TouchableOpacity>
        <Ionicons name="search" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );

  const renderFeedSelector = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.feedSelector}
      contentContainerStyle={styles.feedContainer}
    >
      {DISCOVER_FEEDS.map((feed) => (
        <TouchableOpacity
          key={feed.id}
          style={[
            styles.feedButton,
            selectedFeed === feed.id && styles.feedButtonActive,
            { borderColor: feed.color }
          ]}
          onPress={() => handleFeedChange(feed.id)}
        >
          <Text style={styles.feedIcon}>{feed.icon}</Text>
          <Text style={[
            styles.feedTitle,
            selectedFeed === feed.id && styles.feedTitleActive
          ]}>
            {feed.title}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderContentFilters = () => (
    <View style={styles.contentFilters}>
      <Text style={styles.filterTitle}>Content Types</Text>
      <View style={styles.filterButtons}>
        {CONTENT_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.filterButton,
              activeContentTypes.includes(type.id) && styles.filterButtonActive
            ]}
            onPress={() => toggleContentType(type.id)}
          >
            <Text style={styles.filterIcon}>{type.icon}</Text>
            <Text style={[
              styles.filterLabel,
              activeContentTypes.includes(type.id) && styles.filterLabelActive
            ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAISuggestions = () => (
    <View style={styles.aiSection}>
      <Text style={styles.sectionTitle}>🤖 AI Suggestions</Text>
      {AI_SUGGESTIONS.map((suggestion, index) => (
        <TouchableOpacity key={index} style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <Text style={styles.aiType}>
              {suggestion.type === "question" ? "❓" :
               suggestion.type === "challenge" ? "🎯" : "👥"}
            </Text>
            <Text style={styles.aiTitle}>{suggestion.title}</Text>
          </View>
          <Text style={styles.aiContent}>{suggestion.content}</Text>
          <Text style={styles.aiReason}>💡 {suggestion.reason}</Text>
          <TouchableOpacity style={styles.aiAction}>
            <Text style={styles.aiActionText}>
              {suggestion.type === "question" ? "Answer Now" :
               suggestion.type === "challenge" ? "Accept Challenge" : "Connect"}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderContentFeed = () => {
    const selectedFeedData = DISCOVER_FEEDS.find(f => f.id === selectedFeed);

    return (
      <View style={styles.contentSection}>
        <View style={styles.feedHeader}>
          <Text style={styles.feedTitle}>{selectedFeedData?.title}</Text>
          <Text style={styles.feedDescription}>{selectedFeedData?.description}</Text>
        </View>

        {/* Mock content items */}
        <View style={styles.contentList}>
          {[1,2,3,4,5].map((item) => (
            <TouchableOpacity key={item} style={styles.contentItem}>
              <View style={styles.contentItemHeader}>
                <Text style={styles.contentEmoji}>
                  {selectedFeed === "trending" ? "🔥" :
                   selectedFeed === "educational" ? "🎓" :
                   selectedFeed === "entertainment" ? "😂" : "🌍"}
                </Text>
                <View style={styles.contentMeta}>
                  <Text style={styles.contentTitle}>Sample Content #{item}</Text>
                  <Text style={styles.contentSubtitle}>Posted 2h ago • 1.2K views</Text>
                </View>
              </View>
              <View style={styles.contentActions}>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="heart-outline" size={16} color="#888" />
                  <Text style={styles.actionText}>123</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="chatbubble-outline" size={16} color="#888" />
                  <Text style={styles.actionText}>45</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <Ionicons name="share-outline" size={16} color="#888" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {renderHeader()}
      {renderFeedSelector()}
      {renderContentFilters()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderAISuggestions()}
        {renderContentFeed()}
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
  feedSelector: {
    maxHeight: 80,
    marginBottom: 20,
  },
  feedContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  feedButton: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#333",
    backgroundColor: "#111",
    minWidth: 100,
  },
  feedButtonActive: {
    backgroundColor: "rgba(255,107,107,0.1)",
  },
  feedIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  feedTitle: {
    color: "#888",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  feedTitleActive: {
    color: "white",
  },
  contentFilters: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  filterButtons: {
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#333",
  },
  filterButtonActive: {
    backgroundColor: "#ff6b6b",
    borderColor: "#ff6b6b",
  },
  filterIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  filterLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "bold",
  },
  filterLabelActive: {
    color: "white",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  aiSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  aiCard: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  aiHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  aiType: {
    fontSize: 20,
    marginRight: 10,
  },
  aiTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  aiContent: {
    color: "#ccc",
    fontSize: 14,
    marginBottom: 6,
  },
  aiReason: {
    color: "#888",
    fontSize: 12,
    fontStyle: "italic",
    marginBottom: 12,
  },
  aiAction: {
    backgroundColor: "#ff6b6b",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: "flex-start",
  },
  aiActionText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  contentSection: {
    marginBottom: 30,
  },
  feedHeader: {
    marginBottom: 15,
  },
  feedTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  feedDescription: {
    color: "#888",
    fontSize: 14,
  },
  contentList: {
    gap: 10,
  },
  contentItem: {
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 15,
  },
  contentItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  contentEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  contentMeta: {
    flex: 1,
  },
  contentTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 4,
  },
  contentSubtitle: {
    color: "#888",
    fontSize: 12,
  },
  contentActions: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: {
    color: "#888",
    fontSize: 12,
    marginLeft: 4,
  },
});
