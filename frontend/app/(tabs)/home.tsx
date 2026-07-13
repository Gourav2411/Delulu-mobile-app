// Home — hero flagship + genre rails + continue reading.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { storyApi } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { COLORS, GENRE_ACCENT, RADIUS, SPACING, VOICE } from "@/src/theme";

const GENRE_ORDER = ["romance", "thriller", "horror", "scifi", "drama"];

export default function Home() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { stories } = await storyApi.list();
      setStories(stories);
    } catch (e) {
      // handled silently for now
    }
  }, []);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const flagship = stories.find((s) => s.isFlagship);
  const byGenre = GENRE_ORDER.map((g) => ({ genre: g, list: stories.filter((s) => s.genre === g && !s.isFlagship) }));

  // continue reading: any story with progress and unfinished chapterIndex
  const progress = user?.progress || {};
  const continueList = stories
    .filter((s) => progress[s.id] && (progress[s.id].chapterIndex || 0) < (s.chapters?.length || 0))
    .map((s) => ({ story: s, chapterIndex: progress[s.id].chapterIndex || 0 }));

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.romance} />
        <Text style={styles.loadingText}>{VOICE.loading}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: COLORS.bg }}>
        <View style={styles.topbar}>
          <View style={styles.gemChip} testID="home-gems">
            <View style={styles.gemIcon} />
            <Text style={styles.gemNum}>{user?.gemBalance ?? 0}</Text>
          </View>
          <View style={styles.brand}>
            <Text style={styles.wordmark}>delulu</Text>
          </View>
          <View style={styles.streakChip}>
            <Ionicons name="flame" size={14} color={COLORS.gemGold} />
            <Text style={styles.streakText}>{user?.streak ?? 0}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.romance} />}
      >
        {/* Flagship hero — cinematic full-bleed */}
        {flagship && (
          <TouchableOpacity
            testID="home-flagship-hero"
            activeOpacity={0.92}
            onPress={() => router.push(`/story/${flagship.id}`)}
            style={styles.hero}
          >
            <Image source={{ uri: flagship.coverUrl }} style={styles.heroImg} />
            <LinearGradient
              colors={["transparent", "rgba(10,10,15,0.55)", "#0A0A0F"]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[`${flagship.accentColor}66`, "transparent"]}
              start={{ x: 0.1, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroContent}>
              <View style={styles.badgeRow}>
                <View style={[styles.pillBadge, { backgroundColor: flagship.accentColor }]}>
                  <Ionicons name="flame" size={11} color={COLORS.bg} />
                  <Text style={styles.pillBadgeText}>FLAGSHIP</Text>
                </View>
                <View style={styles.pillBadgeOutline}>
                  <Text style={styles.pillBadgeOutlineText}>{flagship.ageRating || "16+"}</Text>
                </View>
                <View style={styles.pillBadgeOutline}>
                  <Text style={styles.pillBadgeOutlineText}>{formatReads(flagship.totalReads)} reads</Text>
                </View>
              </View>
              <Text style={styles.heroTitle}>{flagship.title}</Text>
              <Text style={styles.heroSub} numberOfLines={2}>{flagship.synopsis}</Text>
              <View style={styles.heroCtaRow}>
                <View style={[styles.heroCta, { backgroundColor: flagship.accentColor }]}>
                  <Ionicons name="play" size={14} color={COLORS.bg} />
                  <Text style={styles.heroCtaText}>start reading</Text>
                </View>
                <View style={styles.heroSecCta}>
                  <Ionicons name="bookmark-outline" size={16} color={COLORS.text} />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Continue reading */}
        {continueList.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>continue reading</Text>
              <Text style={styles.sectionLink}>see all</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {continueList.map(({ story, chapterIndex }) => {
                const total = story.chapters?.length || 1;
                const pct = Math.round(((chapterIndex + 1) / total) * 100);
                return (
                  <TouchableOpacity
                    key={story.id}
                    testID={`continue-${story.id}`}
                    activeOpacity={0.85}
                    style={styles.contCard}
                    onPress={() => router.push(`/story/${story.id}`)}
                  >
                    <Image source={{ uri: story.coverUrl }} style={styles.contCover} />
                    <LinearGradient colors={["transparent", "rgba(10,10,15,0.55)"]} style={StyleSheet.absoluteFillObject} />
                    <View style={{ flex: 1, padding: SPACING.sm, justifyContent: "space-between" }}>
                      <View>
                        <Text numberOfLines={1} style={styles.contTitle}>{story.title}</Text>
                        <Text style={styles.contChapter}>Ch. {chapterIndex + 1} of {total} · {pct}%</Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: story.accentColor }]} />
                      </View>
                    </View>
                    <View style={[styles.contPlayBtn, { backgroundColor: story.accentColor }]}>
                      <Ionicons name="play" size={14} color={COLORS.bg} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Genre pills */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>genres</Text>
          <View style={styles.genreGrid}>
            {GENRE_ORDER.map((g) => (
              <View key={g} style={[styles.genreIcon, { backgroundColor: `${GENRE_ACCENT[g]}22`, borderColor: GENRE_ACCENT[g] }]}>
                <Ionicons name={genreIcon(g)} size={18} color={GENRE_ACCENT[g]} />
                <Text style={styles.genreLabel} numberOfLines={1}>{cap(g)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Genre rails */}
        {byGenre.filter((r) => r.list.length > 0).map((row) => (
          <View key={row.genre} style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>trending in {cap(row.genre)}</Text>
              <Text style={styles.sectionLink}>see all</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
              {row.list.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  testID={`story-card-${s.id}`}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/story/${s.id}`)}
                  style={styles.storyCard}
                >
                  <Image source={{ uri: s.coverUrl }} style={styles.storyCover} />
                  <LinearGradient colors={["transparent", "rgba(10,10,15,0.35)", "rgba(10,10,15,0.95)"]} locations={[0, 0.55, 1]} style={styles.cardShade} />
                  <LinearGradient colors={[`${s.accentColor}44`, "transparent"]} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFill} />
                  <View style={styles.cardText}>
                    <Text numberOfLines={2} style={styles.cardTitle}>{s.title}</Text>
                    <View style={styles.cardMetaRow}>
                      <View style={[styles.genreTag, { backgroundColor: s.accentColor }]}>
                        <Text style={styles.genreTagText}>{cap(s.genre)}</Text>
                      </View>
                      <View style={styles.cardMetaChip}>
                        <Ionicons name="book" size={9} color={COLORS.text} />
                        <Text style={styles.cardMetaText}>{s.chapters?.length || 0}</Text>
                      </View>
                    </View>
                  </View>
                  {s.status === "coming_soon" && (
                    <View style={styles.soonRibbon}>
                      <Text style={styles.soonText}>SOON</Text>
                    </View>
                  )}
                  {s.isFlagship && (
                    <View style={styles.flameCorner}>
                      <Ionicons name="flame" size={12} color={COLORS.gemGold} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }
function genreIcon(g) {
  return { romance: "heart", thriller: "flash", horror: "flame", scifi: "planet", drama: "cafe" }[g] || "star";
}
function formatReads(n) {
  if (!n) return "0";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: COLORS.secondary },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  brand: { flexDirection: "row", alignItems: "center", gap: 4 },
  wordmark: { color: COLORS.text, fontSize: 22, fontWeight: "900", letterSpacing: -1 },
  gemChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill },
  gemIcon: { width: 10, height: 10, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  gemNum: { color: COLORS.gemGold, fontWeight: "800", fontVariant: ["tabular-nums"] },
  streakChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill },
  streakText: { color: COLORS.text, fontWeight: "800", fontVariant: ["tabular-nums"] },
  hero: { marginHorizontal: SPACING.lg, borderRadius: RADIUS.xl, overflow: "hidden", height: 380, marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.romance, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 12 },
  heroImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  heroContent: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACING.lg, gap: 10 },
  badgeRow: { flexDirection: "row", gap: 6, marginBottom: 2 },
  pillBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill },
  pillBadgeText: { color: COLORS.bg, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  pillBadgeOutline: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: "rgba(10,10,15,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  pillBadgeOutlineText: { color: COLORS.text, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  heroTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", letterSpacing: -1.2, lineHeight: 36 },
  heroSub: { color: COLORS.secondary, fontSize: 13, lineHeight: 18 },
  heroCtaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  heroCta: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.pill },
  heroCtaText: { color: COLORS.bg, fontWeight: "900", fontSize: 14 },
  heroSecCta: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(10,10,15,0.55)", alignItems: "center", justifyContent: "center" },
  section: { marginTop: SPACING.xl, paddingHorizontal: SPACING.lg },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.md },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.5 },
  sectionLink: { color: COLORS.secondary, fontSize: 12 },
  rail: { gap: SPACING.md, paddingRight: SPACING.lg },
  contCard: { width: 280, height: 96, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", flexDirection: "row", position: "relative" },
  contCover: { width: 96, height: 96 },
  contTitle: { color: COLORS.text, fontWeight: "800", fontSize: 14 },
  contChapter: { color: COLORS.secondary, fontSize: 11, marginTop: 2 },
  contPlayBtn: { position: "absolute", right: 10, top: 10, width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  progressBar: { height: 4, borderRadius: 999, backgroundColor: COLORS.elevated, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999 },
  genreGrid: { flexDirection: "row", gap: 6 },
  genreIcon: { flex: 1, aspectRatio: 1, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 2 },
  genreLabel: { color: COLORS.text, fontSize: 10, fontWeight: "700" },
  storyCard: { width: 160, height: 230, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", position: "relative" },
  storyCover: { ...StyleSheet.absoluteFillObject },
  cardShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 130 },
  cardText: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACING.sm, gap: 6 },
  cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: "900", lineHeight: 17, letterSpacing: -0.2 },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  cardMetaChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: RADIUS.sm, backgroundColor: "rgba(10,10,15,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  cardMetaText: { color: COLORS.text, fontSize: 9, fontWeight: "700" },
  genreTag: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  genreTagText: { color: COLORS.bg, fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  soonRibbon: { position: "absolute", top: 8, right: 8, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  soonText: { color: COLORS.secondary, fontSize: 9, fontWeight: "900" },
  flameCorner: { position: "absolute", top: 8, left: 8, width: 24, height: 24, borderRadius: 999, backgroundColor: "rgba(10,10,15,0.7)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.gemGold },
});
