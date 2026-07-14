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
            {/* Cover with strict 2:3 aspect ratio — image fills, no text overlay */}
            <View style={styles.cover}>
              <Image source={{ uri: s.coverUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              {/* Small genre chip stays on the image (top-left, low visual weight) */}
              <View style={[styles.genreChipOnCover, { backgroundColor: s.accentColor }]}>
                <Text style={styles.genreChipText}>{s.genre?.[0]?.toUpperCase() || "?"}</Text>
              </View>
              {s.status === "coming_soon" && (
                <View style={styles.soonPill}>
                  <Text style={styles.soonText}>SOON</Text>
                </View>
              )}
            </View>
            {/* Caption line: title + genre outside the image */}
            <View style={styles.caption}>
              <Text style={styles.cardTitle} numberOfLines={2}>{s.title}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>{cap(s.genre)}</Text>
            </View>
          </TouchableOpacity>
        ))}
        {filtered.length === 0 && (
          <Text style={styles.empty}>nothing matched. try different vibes.</Text>
        )}
      </ScrollView>
    </View>
  );
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

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
  // Search-result card: uniform 2:3 cover, caption outside the image
  card: { width: "47.5%", gap: 6 },
  cover: { width: "100%", aspectRatio: 2 / 3, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, position: "relative" },
  genreChipOnCover: { position: "absolute", top: 8, left: 8, width: 22, height: 22, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  genreChipText: { color: COLORS.bg, fontSize: 11, fontWeight: "900" },
  soonPill: { position: "absolute", top: 8, right: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm, backgroundColor: "rgba(10,10,15,0.75)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  soonText: { color: COLORS.text, fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  caption: { paddingHorizontal: 2, gap: 2, minHeight: 42 },
  cardTitle: { color: COLORS.text, fontWeight: "800", fontSize: 13, lineHeight: 16, letterSpacing: -0.1 },
  cardSub: { color: COLORS.secondary, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  empty: { color: COLORS.secondary, textAlign: "center", padding: SPACING.xl, width: "100%" },
});
