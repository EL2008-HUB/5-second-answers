import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { fetchComments, addComment } from "@/services/commentApi";

type Props = {
  visible: boolean;
  onClose: () => void;
  videoId: string;
};

export default function CommentsModal({
  visible,
  onClose,
  videoId,
}: Props) {
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");

  useEffect(() => {
    if (visible) fetchComments(videoId).then(setComments);
  }, [visible]);

  const submit = async () => {
    if (!text.trim()) return;
    const newComment = await addComment(videoId, text);
    setComments((prev) => [...prev, newComment]);
    setText("");
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>Comments</Text>

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Text style={styles.comment}>• {item.text}</Text>
          )}
        />

        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a comment..."
            style={styles.input}
          />
          <TouchableOpacity onPress={submit}>
            <Text style={styles.send}>Send</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 10 },
  comment: { fontSize: 14, marginVertical: 4 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 6,
  },
  send: { marginLeft: 10, color: "blue" },
  close: { marginTop: 15, textAlign: "center", color: "red" },
});
