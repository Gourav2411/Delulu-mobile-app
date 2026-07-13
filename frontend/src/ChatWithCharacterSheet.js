// Bottom-sheet chat with an NPC. Uses /api/story/chat (Claude Haiku).
// Rate-limited server-side to keep LLM budget sane.
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Animated, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { api } from "@/src/api";
import { COLORS, RADIUS, SPACING } from "@/src/theme";

export default function ChatWithCharacterSheet({
  visible, onClose, story, chapterIndex, characterId, playerAvatarNode,
}) {
  const char = story?.characters?.find((c) => c.id === characterId);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [remaining, setRemaining] = useState(4);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible) {
      setHistory([]);
      setInput("");
      setErr(null);
      setRemaining(4);
    }
  }, [visible]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setErr(null);
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextHistory = [...history, { role: "user", text }];
    setHistory(nextHistory);
    setInput("");
    try {
      const res = await api.post("/story/chat", {
        storyId: story.id,
        chapterIndex,
        characterId,
        userMessage: text,
        history: history,
      });
      const bubbles = res.bubbles || [res.reply];
      // Add bubbles progressively for the chat rhythm
      for (let i = 0; i < bubbles.length; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 500));
        setHistory((h) => [...h, { role: "assistant", text: bubbles[i] }]);
      }
      setRemaining(res.remaining ?? 0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      setErr(e.detail || "they didn't reply");
      // roll back the user message so they can retry
      setHistory(history);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }
  };

  if (!visible || !char) return null;

  const portrait = char.portraitUrls?.flirty || char.portraitUrls?.neutral || char.avatarUrl;
  const accent = story?.accentColor || COLORS.romance;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end" }}
        >
          <View style={styles.sheet}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.hAvatarWrap}>
                <Image source={{ uri: portrait }} style={styles.hAvatar} />
                <View style={[styles.onlineDot, { backgroundColor: COLORS.success }]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.hName}>{char.name}</Text>
                <Text style={styles.hStatus}>
                  {busy ? "typing…" : remaining > 0 ? `active now · ${remaining} texts left` : "gone quiet"}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} testID="chat-close" hitSlop={12}>
                <Ionicons name="close" size={24} color={COLORS.secondary} />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={styles.body}
              contentContainerStyle={{ paddingBottom: SPACING.md }}
              keyboardShouldPersistTaps="handled"
            >
              {history.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>text {char.name.split(" ")[0]} — say anything.</Text>
                  <Text style={styles.emptyHelper}>replies happen live. they remember what you say.</Text>
                </View>
              )}
              {history.map((m, i) => {
                if (m.role === "user") {
                  return (
                    <View key={i} style={[styles.row, { justifyContent: "flex-end" }]}>
                      <View style={[styles.bubble, styles.userBubble, { borderColor: accent }]}>
                        <Text style={styles.bubbleText}>{m.text}</Text>
                      </View>
                      <View style={styles.userAv}>{playerAvatarNode}</View>
                    </View>
                  );
                }
                return (
                  <View key={i} style={[styles.row, { justifyContent: "flex-start" }]}>
                    <Image source={{ uri: portrait }} style={styles.msgAv} />
                    <View style={[styles.bubble, styles.charBubble]}>
                      <Text style={styles.bubbleText}>{m.text}</Text>
                    </View>
                  </View>
                );
              })}
              {busy && (
                <View style={[styles.row, { justifyContent: "flex-start" }]}>
                  <Image source={{ uri: portrait }} style={styles.msgAv} />
                  <View style={[styles.bubble, styles.charBubble]}>
                    <TypingDots />
                  </View>
                </View>
              )}
              {err && <Text style={styles.err}>{err}</Text>}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputRow}>
              <TextInput
                testID="chat-input"
                style={styles.input}
                placeholder={remaining > 0 ? "text back…" : "they've gone quiet"}
                placeholderTextColor={COLORS.muted}
                value={input}
                onChangeText={setInput}
                editable={remaining > 0 && !busy}
                onSubmitEditing={send}
                returnKeyType="send"
                maxLength={180}
              />
              <TouchableOpacity
                testID="chat-send"
                onPress={send}
                style={[styles.sendBtn, { backgroundColor: accent }, (!input.trim() || busy || remaining <= 0) && { opacity: 0.4 }]}
                disabled={!input.trim() || busy || remaining <= 0}
                activeOpacity={0.85}
              >
                {busy ? <ActivityIndicator color={COLORS.bg} /> : <Ionicons name="arrow-up" size={20} color={COLORS.bg} />}
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onClose} testID="chat-continue-story" style={styles.continueBtn}>
              <Text style={styles.continueText}>continue the story →</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function TypingDots() {
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.3)).current;
  const a3 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = (v, delay) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: true }),
    ]));
    loop(a1, 0).start();
    loop(a2, 150).start();
    loop(a3, 300).start();
  }, [a1, a2, a3]);
  return (
    <View style={{ flexDirection: "row", gap: 4, padding: 6 }}>
      <Animated.View style={[styles.dot, { opacity: a1 }]} />
      <Animated.View style={[styles.dot, { opacity: a2 }]} />
      <Animated.View style={[styles.dot, { opacity: a3 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(10,10,15,0.85)" },
  sheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: COLORS.border, minHeight: 480, maxHeight: "88%",
  },
  handle: { alignSelf: "center", width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 999, marginTop: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  hAvatarWrap: { position: "relative" },
  hAvatar: { width: 44, height: 44, borderRadius: 999, backgroundColor: COLORS.elevated },
  onlineDot: { position: "absolute", right: 0, bottom: 0, width: 12, height: 12, borderRadius: 999, borderWidth: 2, borderColor: COLORS.surface },
  hName: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  hStatus: { color: COLORS.secondary, fontSize: 11, marginTop: 2 },
  body: { flex: 1, paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  emptyState: { alignItems: "center", paddingVertical: SPACING.xl },
  emptyText: { color: COLORS.text, fontSize: 15, fontWeight: "600" },
  emptyHelper: { color: COLORS.secondary, fontSize: 12, marginTop: 6 },
  row: { flexDirection: "row", gap: 6, alignItems: "flex-end", marginVertical: 3 },
  msgAv: { width: 28, height: 28, borderRadius: 999, backgroundColor: COLORS.elevated },
  userAv: { width: 32, height: 32, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.romance, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "72%", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
  charBubble: { backgroundColor: COLORS.elevated, borderColor: COLORS.border, borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: "rgba(255,62,138,0.18)", borderBottomRightRadius: 4 },
  bubbleText: { color: COLORS.text, fontSize: 14, lineHeight: 19 },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: COLORS.text },
  err: { color: COLORS.danger, fontSize: 12, textAlign: "center", padding: 8 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  input: { flex: 1, backgroundColor: COLORS.elevated, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, color: COLORS.text, fontSize: 15, borderWidth: 1, borderColor: COLORS.border },
  sendBtn: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  continueBtn: { paddingBottom: SPACING.md, alignItems: "center" },
  continueText: { color: COLORS.secondary, fontSize: 12, textDecorationLine: "underline" },
});
