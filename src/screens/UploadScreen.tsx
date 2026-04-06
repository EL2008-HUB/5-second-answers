import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation, useRoute } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";

const BASE_URL = "http://192.168.0.101:5000";

export default function UploadScreen() {
  const [question, setQuestion] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [videoUri, setVideoUri] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [aiFeedback, setAiFeedback] = useState("");
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const previewPlayer = useVideoPlayer(videoUri || null, (player) => {
    player.loop = true;
    player.muted = true;
  });
  
  // If coming from question flow
  const questionFromRoute = route.params?.question as string | undefined;

  React.useEffect(() => {
    if (questionFromRoute) {
      setQuestion(questionFromRoute);
    }
  }, [questionFromRoute]);

  React.useEffect(() => {
    if (videoUri) {
      previewPlayer.play();
      return;
    }

    previewPlayer.pause();
  }, [previewPlayer, videoUri]);

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.7,
    });

    if (res.canceled) return;

    const video = res.assets[0];
    
    // Check duration (should be <= 5 seconds)
    if ((video.duration ?? 0) > 10000) {
      Alert.alert(
        "Video Too Long",
        "Please select a video that's 10 seconds or less."
      );
      return;
    }

    setVideoUri(video.uri);
    setPreviewVisible(true);
  };

  const recordVideo = async () => {
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.7,
      videoMaxDuration: 10,
    });

    if (res.canceled) return;

    const video = res.assets[0];
    setVideoUri(video.uri);
    setPreviewVisible(true);
  };

  const simulateAIFeedback = () => {
    const feedbacks = [
      "✅ Clear and concise explanation",
      "⚠️ Could be more specific",
      "❌ Too long, keep it under 5 seconds",
      "✅ Great visual demonstration",
      "⚠️ Audio quality could improve"
    ];
    
    const randomFeedback = feedbacks[Math.floor(Math.random() * feedbacks.length)];
    setAiFeedback(randomFeedback);
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      Alert.alert("Error", "Please enter a question");
      return;
    }

    if (!videoUri && !answerText.trim()) {
      Alert.alert("Error", "Please provide a video or text answer");
      return;
    }

    setIsUploading(true);

    try {
      // 1️⃣ Create question first
      const questionRes = await fetch(`${BASE_URL}/api/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: question.trim(),
          category: "general",
          userId: "demo_user"
        })
      });

      const questionData = await questionRes.json();

      let contentUrl = null;

      // 2️⃣ Upload video if present
      if (videoUri) {
        const formData = new FormData();
        formData.append("video", {
          uri: videoUri,
          type: "video/mp4",
          name: "answer.mp4",
        } as any);

        const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
          method: "POST",
          body: formData,
          headers: { "Content-Type": "multipart/form-data" },
        });

        const uploadData = await uploadRes.json();
        contentUrl = uploadData.url;
      }

      // 3️⃣ Create answer
      const answerRes = await fetch(`${BASE_URL}/api/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: questionData.id,
          userId: "demo_user",
          type: videoUri ? "video" : "text",
          contentUrl,
          text: answerText.trim() || null
        })
      });

      const answerData = await answerRes.json();

      // 4️⃣ Show AI feedback
      simulateAIFeedback();

      Alert.alert(
        "✅ Answer Submitted!",
        aiFeedback || "Your answer has been submitted for review.",
        [
          {
            text: "View Answer",
            onPress: () => navigation.navigate("VideoPlayer", { questionId: questionData.id })
          },
          {
            text: "Create Another",
            onPress: () => {
              setQuestion("");
              setAnswerText("");
              setVideoUri("");
              setAiFeedback("");
            }
          }
        ]
      );

    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to submit answer");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Answer in 5 Seconds</Text>
        <Text style={styles.subtitle}>
          🎥 Video max 5s • 📝 Text ≤ 10 words
        </Text>
      </View>

      {/* Question Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Question</Text>
        <TextInput
          style={styles.input}
          placeholder="What's your question?"
          placeholderTextColor="#666"
          value={question}
          onChangeText={setQuestion}
          multiline
          maxLength={200}
        />
        <Text style={styles.charCount}>{question.length}/200</Text>
      </View>

      {/* Answer Options */}
      <View style={styles.section}>
        <Text style={styles.label}>Your Answer</Text>

        {/* Video Option */}
        <TouchableOpacity style={styles.optionButton} onPress={recordVideo}>
          <Ionicons name="camera" size={24} color="#ff4444" />
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>📹 Record 5s Video</Text>
            <Text style={styles.optionDesc}>Best way to explain</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionButton} onPress={pickVideo}>
          <Ionicons name="videocam" size={24} color="#4444ff" />
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>📁 Choose Video</Text>
            <Text style={styles.optionDesc}>From your library</Text>
          </View>
        </TouchableOpacity>

        {/* Text Option */}
        <View style={styles.textOption}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your answer (max 10 words)..."
            placeholderTextColor="#666"
            value={answerText}
            onChangeText={setAnswerText}
            maxLength={70}
            multiline
          />
          <Text style={styles.charCount}>{answerText.length}/70</Text>
        </View>
      </View>

      {/* Video Preview */}
      {videoUri && (
        <View style={styles.section}>
          <Text style={styles.label}>Preview</Text>
          <View style={styles.previewContainer}>
            <VideoView
              player={previewPlayer}
              style={styles.preview}
              contentFit="cover"
              nativeControls={false}
            />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setVideoUri("")}
            >
              <Ionicons name="close-circle" size={24} color="#ff4444" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* AI Feedback */}
      {aiFeedback && (
        <View style={styles.section}>
          <Text style={styles.label}>AI Review</Text>
          <View style={styles.aiFeedback}>
            <Text style={styles.aiText}>{aiFeedback}</Text>
          </View>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isUploading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isUploading}
      >
        {isUploading ? (
          <ActivityIndicator color="white" />
        ) : (
          <>
            <Ionicons name="rocket" size={20} color="white" />
            <Text style={styles.submitText}>Submit Answer</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    color: "#ccc",
    fontSize: 14,
  },
  section: {
    marginBottom: 25,
  },
  label: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "white",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: {
    color: "#666",
    fontSize: 12,
    textAlign: "right",
    marginTop: 5,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  optionContent: {
    marginLeft: 15,
    flex: 1,
  },
  optionTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  optionDesc: {
    color: "#ccc",
    fontSize: 14,
    marginTop: 2,
  },
  textOption: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 15,
    borderRadius: 12,
  },
  textInput: {
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "white",
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  previewContainer: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
  preview: {
    width: "100%",
    height: 200,
    backgroundColor: "#000",
  },
  removeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 20,
    padding: 5,
  },
  aiFeedback: {
    backgroundColor: "rgba(76,175,80,0.2)",
    padding: 15,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  aiText: {
    color: "white",
    fontSize: 16,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff4444",
    padding: 18,
    borderRadius: 25,
    marginBottom: 30,
  },
  submitButtonDisabled: {
    backgroundColor: "#666",
  },
  submitText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
});
