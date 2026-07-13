// Search — simple search with genre chips.
import React, { useEffect, useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { storyApi } from "@/src/api";
import { COLORS, GENRE_ACCENT, RADIUS, SPACING } from "@/src/theme";

const GENRES = ["all", "romance", "thriller", "horror", "scifi", "drama"];

export default function Search() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [g, setG] = useState("all");
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { stories } = await storyApi.list();
      setStories(stories);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return stories.filter((s) => {
      if (g !== "all" && s.genre !== g) return false;
      if (q && !s.title.toLowerCase().includes(q.toLowerCase()) && !s.synopsis?.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [stories, q, g]);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.romance} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView edges={["top"]} style={styles.stickyHead}>
        <View style={styles.top}>
          <Text style={styles.title}>Search</Text>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.secondary} />
          <TextInput
            testID="search-input"
            placeholder="find your next obsession..."
            placeholderTextColor={COLORS.muted}
            value={q}
            onChangeText={setQ}
            style={styles.searchInput}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {GENRES.map((x) => {
            const active = g === x;
            const color = x === "all" ? COLORS.romance : GENRE_ACCENT[x];
            return (
              <TouchableOpacity
                key={x}
                testID={`search-chip-${x}`}
                onPress={() => setG(x)}
                style={[styles.chip, active && { borderColor: color, backgroundColor: `${color}22` }]}
              >
                <Text style={[styles.chipText, active && { color }]}>{x}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ padding: SPACING.lg, flexDirection: "row", flexWrap: "wrap", gap: SPACING.md, paddingBottom: SPACING.xxl }}>
        {filtered.map((s) => (
          <TouchableOpacity
            key={s.id}
            testID={`search-result-${s.id}`}
            onPress={() => router.push(`/story/${s.id}`)}
            activeOpacity={0.85}
            style={styles.card}
          >
            <Image source={{ uri: s.coverUrl }} style={StyleSheet.absoluteFillObject} />
            <View style={styles.cardShade} />
            <Text style={styles.cardTitle} numberOfLines={2}>{s.title}</Text>
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && (
          <Text style={styles.empty}>nothing matched. try different vibes.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  stickyHead: { backgroundColor: COLORS.bg, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  top: { padding: SPACING.lg, paddingBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.6 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: SPACING.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: COLORS.text, paddingVertical: 12, fontSize: 15 },
  chips: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, gap: 8, alignItems: "center", height: 56 },
  chip: { flexShrink: 0, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, height: 36, justifyContent: "center" },
  chipText: { color: COLORS.secondary, fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  card: { width: "47.5%", aspectRatio: 0.72, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, justifyContent: "flex-end", padding: SPACING.sm },
  cardShade: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,10,15,0.4)" },
  cardTitle: { color: COLORS.text, fontWeight: "800", fontSize: 14, zIndex: 1 },
  empty: { color: COLORS.secondary, textAlign: "center", padding: SPACING.xl, width: "100%" },
});
