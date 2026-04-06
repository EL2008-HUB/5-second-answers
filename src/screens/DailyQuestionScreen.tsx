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
const BASE_URL = "http://localhost:5000";

// ❓ DAILY QUESTION
const DAILY_QUESTIONS = [
  {
    id: "dq1",
    question: "What's the most useless superpower you can think of?",
    category: "fun",
    answers: [
      { text: "Ability to talk to vegetables", votes: 234, percentage: 35 },
      { text: "Always knowing the exact time", votes: 189, percentage: 28 },
      { text: "Making toast perfectly every time", votes: 145, percentage: 22 },
      { text: "Changing hair color at will", votes: 98, percentage: 15 }
    ],
    totalVotes: 666,
    timeLeft: "23h 45m"
  },
  {
    id: "dq2",
    question: "If you could have dinner with any historical figure, who would it be?",
    category: "history",
    answers: [
      { text: "Albert Einstein", votes: 456, percentage: 42 },
      { text: "Cleopatra", votes: 321, percentage: 30 },
      { text: "Leonardo da Vinci", votes: 198, percentage: 18 },
      { text: "Marie Curie", votes: 87, percentage: 8 }
    ],
    totalVotes: 1062,
    timeLeft: "18h 12m"
  },
  {
    id: "dq3",
    question: "What's the weirdest dream you've ever had?",
    category: "personal",
    answers: [
      { text: "Flying with spaghetti wings", votes: 567, percentage: 38 },
      { text: "Teaching math to cats", votes: 423, percentage: 28 },
      { text: "Dancing with vegetables", votes: 312, percentage: 21 },
      { text: "Time traveling to yesterday", votes: 198, percentage: 13 }
    ],
    totalVotes: 1500,
    timeLeft: "12h 33m"
  }
];

// 🔥 TRENDING ANSWERS
const TRENDING_ANSWERS = [
  {
    id: "ta1",
    answer: "\"The ability to make any food taste like pizza\" 🔥",
    author: "@PizzaLover",
    votes: 892,
    timeAgo: "2h ago"
  },
  {
    id: "ta2",
    answer: "\"Talking to vegetables would be chaos\" 😂",
    author: "@VeggieHater",
    votes: 654,
    timeAgo: "4h ago"
  },
  {
    id: "ta3",
    answer: "\"Perfect toast is actually useful\" 🤔",
    author: "@ToastMaster",
    votes: 432,
    timeAgo: "6h ago"
  }
];

// 💭 QUICK ANSWERS (Yes/No)
const QUICK_QUESTIONS = [
  {
    id: "qq1",
    question: "Pineapple belongs on pizza?",
    yesVotes: 3456,
    noVotes: 5678,
    totalVotes: 9134,
    userVote: null
  },
  {
    id: "qq2",
    question: "Cats are better than dogs?",
    yesVotes: 6789,
    noVotes: 4321,
    totalVotes: 11110,
    userVote: "yes"
  },
  {
    id: "qq3",
    question: "Coffee or tea?",
    yesVotes: 7890,
    noVotes: 3456,
    totalVotes: 11346,
    userVote: "no"
  }
];

export default function DailyQuestionScreen() {
  const navigation = useNavigation();
  const [selectedQuestion, setSelectedQuestion] = useState(DAILY_QUESTIONS[0]);
  const [userVotes, setUserVotes] = useState({});

  const handleVote = (questionId, answerIndex) => {
    // Simulate voting
    Alert.alert("✅ Voted!", "Your vote has been recorded!");
    setUserVotes({...userVotes, [questionId]: answerIndex});
  };

  const handleQuickVote = (questionId, vote) => {
    Alert.alert("⚡ Quick Vote!", `You voted ${vote.toUpperCase()}!`);
    setUserVotes({...userVotes, [questionId]: vote});
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="white" />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>❓ Daily Question</Text>
        <Text style={styles.headerSubtitle}>Answer in 5 seconds or less</Text>
      </View>
      <TouchableOpacity>
        <Ionicons name="notifications" size={24} color="#ffd700" />
      </TouchableOpacity>
    </View>
  );

  const renderDailyQuestion = () => (
    <View style={styles.dailyCard}>
      <View style={styles.questionHeader}>
        <Text style={styles.questionCategory}>🔥 HOT QUESTION</Text>
        <Text style={styles.timeLeft}>{selectedQuestion.timeLeft} left</Text>
      </View>

      <Text style={styles.questionText}>{selectedQuestion.question}</Text>

      <View style={styles.answersList}>
        {selectedQuestion.answers.map((answer, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.answerOption,
              userVotes[selectedQuestion.id] === index && styles.selectedAnswer
            ]}
            onPress={() => handleVote(selectedQuestion.id, index)}
          >
            <View style={styles.answerContent}>
              <Text style={styles.answerText}>{answer.text}</Text>
              <Text style={styles.answerVotes}>
                {answer.votes.toLocaleString()} votes ({answer.percentage}%)
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${answer.percentage}%` },
                  userVotes[selectedQuestion.id] === index && styles.selectedFill
                ]}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.questionStats}>
        <Text style={styles.totalVotes}>
          📊 {selectedQuestion.totalVotes.toLocaleString()} total votes
        </Text>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={16} color="white" />
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderQuickAnswers = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>⚡ Quick Answers</Text>
      <Text style={styles.sectionSubtitle}>Tap once, vote instantly</Text>

      {QUICK_QUESTIONS.map((question) => {
        const userVote = userVotes[question.id];
        const yesPercent = Math.round((question.yesVotes / question.totalVotes) * 100);
        const noPercent = Math.round((question.noVotes / question.totalVotes) * 100);

        return (
          <View key={question.id} style={styles.quickCard}>
            <Text style={styles.quickQuestion}>{question.question}</Text>

            <View style={styles.quickResults}>
              <TouchableOpacity
                style={[
                  styles.quickOption,
                  styles.yesOption,
                  userVote === 'yes' && styles.selectedQuick
                ]}
                onPress={() => handleQuickVote(question.id, 'yes')}
              >
                <Text style={styles.quickEmoji}>👍</Text>
                <Text style={styles.quickLabel}>Yes</Text>
                <Text style={styles.quickPercent}>{yesPercent}%</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickOption,
                  styles.noOption,
                  userVote === 'no' && styles.selectedQuick
                ]}
                onPress={() => handleQuickVote(question.id, 'no')}
              >
                <Text style={styles.quickEmoji}>👎</Text>
                <Text style={styles.quickLabel}>No</Text>
                <Text style={styles.quickPercent}>{noPercent}%</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.quickTotal}>
              {question.totalVotes.toLocaleString()} votes
            </Text>
          </View>
        );
      })}
    </View>
  );

  const renderTrendingAnswers = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🔥 Trending Answers</Text>
      <Text style={styles.sectionSubtitle}>What everyone's saying</Text>

      {TRENDING_ANSWERS.map((answer) => (
        <View key={answer.id} style={styles.trendingCard}>
          <View style={styles.trendingHeader}>
            <Text style={styles.trendingAuthor}>{answer.author}</Text>
            <Text style={styles.trendingTime}>{answer.timeAgo}</Text>
          </View>

          <Text style={styles.trendingAnswer}>{answer.answer}</Text>

          <View style={styles.trendingActions}>
            <TouchableOpacity style={styles.trendingAction}>
              <Ionicons name="heart" size={16} color="#ff6b6b" />
              <Text style={styles.actionCount}>{answer.votes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.trendingAction}>
              <Ionicons name="chatbubble-outline" size={16} color="#888" />
              <Text style={styles.actionCount}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.trendingAction}>
              <Ionicons name="share-outline" size={16} color="#888" />
              <Text style={styles.actionCount}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  const renderQuestionSelector = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.questionSelector}
      contentContainerStyle={styles.selectorContainer}
    >
      {DAILY_QUESTIONS.map((question) => (
        <TouchableOpacity
          key={question.id}
          style={[
            styles.selectorButton,
            selectedQuestion.id === question.id && styles.selectorActive
          ]}
          onPress={() => setSelectedQuestion(question)}
        >
          <Text style={styles.selectorCategory}>
            {question.category === 'fun' ? '🎭' :
             question.category === 'history' ? '📚' : '💭'}
          </Text>
          <Text style={[
            styles.selectorText,
            selectedQuestion.id === question.id && styles.selectorTextActive
          ]}>
            {question.timeLeft.split(' ')[0]}h
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {renderHeader()}
      {renderQuestionSelector()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderDailyQuestion()}
        {renderQuickAnswers()}
        {renderTrendingAnswers()}
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
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  headerSubtitle: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  questionSelector: {
    maxHeight: 60,
    marginBottom: 20,
  },
  selectorContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  selectorButton: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#333",
  },
  selectorActive: {
    backgroundColor: "#ff6b6b",
    borderColor: "#ff6b6b",
  },
  selectorCategory: {
    fontSize: 16,
    marginBottom: 4,
  },
  selectorText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "bold",
  },
  selectorTextActive: {
    color: "white",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dailyCard: {
    backgroundColor: "#111",
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    borderWidth: 2,
    borderColor: "#ff6b6b",
  },
  questionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  questionCategory: {
    color: "#ff6b6b",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  timeLeft: {
    color: "#ffd700",
    fontSize: 12,
    fontWeight: "bold",
  },
  questionText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
    lineHeight: 26,
  },
  answersList: {
    gap: 12,
  },
  answerOption: {
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#333",
  },
  selectedAnswer: {
    borderColor: "#ff6b6b",
    backgroundColor: "rgba(255,107,107,0.1)",
  },
  answerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  answerText: {
    color: "white",
    fontSize: 16,
    flex: 1,
  },
  answerVotes: {
    color: "#888",
    fontSize: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#ff6b6b",
    borderRadius: 2,
  },
  selectedFill: {
    backgroundColor: "#4caf50",
  },
  questionStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
  },
  totalVotes: {
    color: "#888",
    fontSize: 12,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  shareText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
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
  quickCard: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
  },
  quickQuestion: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
  },
  quickResults: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  quickOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#333",
  },
  yesOption: {
    borderColor: "#4caf50",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
  },
  noOption: {
    borderColor: "#f44336",
    backgroundColor: "rgba(244, 67, 54, 0.1)",
  },
  selectedQuick: {
    borderWidth: 3,
  },
  quickEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickLabel: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  quickPercent: {
    color: "#888",
    fontSize: 12,
  },
  quickTotal: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
  },
  trendingCard: {
    backgroundColor: "#111",
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  trendingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  trendingAuthor: {
    color: "#ff6b6b",
    fontSize: 14,
    fontWeight: "bold",
  },
  trendingTime: {
    color: "#888",
    fontSize: 12,
  },
  trendingAnswer: {
    color: "white",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  trendingActions: {
    flexDirection: "row",
    gap: 20,
  },
  trendingAction: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionCount: {
    color: "#888",
    fontSize: 12,
    marginLeft: 4,
  },
});
