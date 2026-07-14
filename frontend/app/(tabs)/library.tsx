// Library — user's continue-reading + ownedEndings.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { storyApi } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { COLORS, RADIUS, SPACING, VOICE } from "@/src/theme";

export default function Library() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    (async () => {
      const { stories } = await storyApi.list();
      setStories(stories);
      setLoading(false);
    })();
  }, []);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.romance} /></View>;

  const progress = user?.progress || {};
  const reading = stories.filter((s) => progress[s.id]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <Text style={styles.title}>Library</Text>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl }}>
        {reading.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={40} color={COLORS.secondary} />
            <Text style={styles.emptyText}>{VOICE.emptyLibrary}</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/home")} style={styles.emptyCta}>
              <Text style={styles.emptyCtaText}>{VOICE.emptyLibraryCta}</Text>
            </TouchableOpacity>
          </View>
        ) : reading.map((s) => {
          const p = progress[s.id];
          const total = s.chapters?.length || 1;
          const pct = Math.round((((p.chapterIndex || 0) + 1) / total) * 100);
          return (
            <TouchableOpacity
              key={s.id}
              testID={`library-${s.id}`}
              onPress={() => router.push(`/story/${s.id}`)}
              activeOpacity={0.85}
              style={styles.row}
            >
              <Image source={{ uri: s.coverUrl }} style={styles.cover} />
              <View style={{ flex: 1, padding: SPACING.md, justifyContent: "space-between" }}>
                <View>
                  <Text style={styles.rTitle} numberOfLines={1}>{s.title}</Text>
                  <Text style={styles.rMeta}>Ch. {(p.chapterIndex || 0) + 1} · {pct}% complete</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: s.accentColor }]} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  top: { padding: SPACING.lg },
  title: { color: COLORS.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.6 },
  empty: { alignItems: "center", padding: SPACING.xl, gap: SPACING.md, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  emptyText: { color: COLORS.secondary, textAlign: "center", fontSize: 14 },
  emptyCta: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.pill, backgroundColor: COLORS.romance },
  emptyCtaText: { color: COLORS.bg, fontWeight: "800" },
  row: { flexDirection: "row", height: 100, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  cover: { width: 100, height: 100 },
  rTitle: { color: COLORS.text, fontWeight: "800", fontSize: 15 },
  rMeta: { color: COLORS.secondary, fontSize: 12, marginTop: 2 },
  progressBar: { height: 4, borderRadius: 999, backgroundColor: COLORS.elevated, overflow: "hidden", marginTop: 8 },
  progressFill: { height: "100%", borderRadius: 999 },
});
