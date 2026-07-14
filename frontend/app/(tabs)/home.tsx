// Home — hero flagship + genre rails + continue reading.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import ReAnimated, { FadeInDown, useSharedValue, withSequence, withTiming, useAnimatedStyle, withDelay } from "react-native-reanimated";
import { storyApi, avatarApi } from "@/src/api";
import { AvatarPreview } from "@/src/AvatarPreview";
import { useAuth } from "@/src/AuthContext";
import { COLORS, GENRE_ACCENT, RADIUS, SPACING, VOICE } from "@/src/theme";
import { formatReadCount, pluralize } from "@/src/utils/format";

const GENRE_ORDER = ["romance", "thriller", "horror", "scifi", "drama"];

export default function Home() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [stories, setStories] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Streak shake: if streak > 0 and >= 20h since last claim, wobble the flag
  const streakAtRisk = (() => {
    if (!user?.streak || !user?.lastDailyClaim) return false;
    const last = new Date(user.lastDailyClaim).getTime();
    const hoursSince = (Date.now() - last) / 3600000;
    return hoursSince >= 20 && hoursSince < 48;
  })();
  const shake = useSharedValue(0);
  useEffect(() => {
    if (!streakAtRisk) return;
    const loop = () => {
      shake.value = withSequence(
        withTiming(-1, { duration: 60 }),
        withTiming(1, { duration: 60 }),
        withTiming(-1, { duration: 60 }),
        withTiming(1, { duration: 60 }),
        withTiming(0, { duration: 60 }),
        withDelay(2500, withTiming(0, { duration: 0 })),
      );
    };
    loop();
    const iv = setInterval(loop, 3200);
    return () => clearInterval(iv);
  }, [streakAtRisk, shake]);
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shake.value * 12}deg` }, { scale: 1 + Math.abs(shake.value) * 0.15 }],
  }));

  const load = useCallback(async () => {
    try {
      const [{ stories }, { items }] = await Promise.all([storyApi.list(), avatarApi.catalog()]);
      setStories(stories);
      setCatalog(items);
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

  // ── Dedupe: a story may appear in ONLY ONE module per screen ────────────
  // Priority (highest wins): continue reading > flagship hero > featured rail > genre rails
  const progress = user?.progress || {};
  const continueList = stories
    .filter((s) => progress[s.id] && (progress[s.id].chapterIndex || 0) < (s.chapters?.length || 0))
    .map((s) => ({ story: s, chapterIndex: progress[s.id].chapterIndex || 0 }));
  const continueIds = new Set(continueList.map((c) => c.story.id));

  // Hero: highest-priority story NOT in continueList. Prefer the flagship the user
  // hasn't started yet; fall back to the first flagship.
  const flagship = stories.find((s) => s.isFlagship && !continueIds.has(s.id))
    || stories.find((s) => s.isFlagship)
    || null;
  const heroId = flagship?.id;
  const usedIds = new Set([...continueIds, ...(heroId ? [heroId] : [])]);

  // Featured rail: stories not yet used, prefer live+flagships first, cap at 6 tiles
  const featuredList = stories
    .filter((s) => !usedIds.has(s.id))
    .sort((a, b) => (b.isFlagship - a.isFlagship) || ((b.seedReads || 0) - (a.seedReads || 0)))
    .slice(0, 6);
  featuredList.forEach((s) => usedIds.add(s.id));

  // Genre rails: whatever's left, grouped by genre
  const byGenre = GENRE_ORDER.map((g) => ({
    genre: g,
    list: stories.filter((s) => s.genre === g && !usedIds.has(s.id)),
  }));

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
          <TouchableOpacity
            testID="home-avatar-chip"
            activeOpacity={0.85}
            onPress={() => router.push("/(tabs)/profile")}
            style={styles.avatarChipWrap}
          >
            <View style={styles.avatarChipInner}>
              <AvatarPreview
                layers={user?.avatarConfig?.layers || {}}
                catalog={catalog}
                presetImageUrl={user?.avatarConfig?.imageUrl}
                size={38}
              />
            </View>
            {(user?.streak ?? 0) > 0 && (
              <ReAnimated.View style={[styles.streakFlag, streakAtRisk && shakeStyle, streakAtRisk && { backgroundColor: COLORS.romance }]}>
                <Ionicons name="flame" size={9} color={COLORS.bg} />
                <Text style={styles.streakFlagText}>{user.streak}</Text>
              </ReAnimated.View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.romance} />}
      >
        {/* Featured this week — horizontal snap carousel */}
        {featuredList.length > 0 && (
          <View style={styles.featuredWrap}>
            <View style={styles.featuredHead}>
              <View style={styles.featuredEyebrowRow}>
                <Ionicons name="star" size={12} color={COLORS.gemGold} />
                <Text style={styles.featuredEyebrow}>FEATURED THIS WEEK</Text>
              </View>
              <Text style={styles.featuredCount}>{featuredList.length}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={296}
              decelerationRate="fast"
              contentContainerStyle={styles.featuredRail}
            >
              {featuredList.map((s, idx) => (
                <ReAnimated.View key={s.id} entering={FadeInDown.duration(320).delay(idx * 60)}>
                  <TouchableOpacity
                    testID={`featured-${s.id}`}
                    activeOpacity={0.9}
                    onPress={() => router.push(`/story/${s.id}`)}
                    style={styles.featuredCard}
                  >
                    <Image source={{ uri: s.coverUrl }} style={StyleSheet.absoluteFillObject} />
                    <LinearGradient
                      colors={["transparent", "rgba(10,10,15,0.45)", "rgba(10,10,15,0.95)"]}
                      locations={[0, 0.5, 1]}
                      style={StyleSheet.absoluteFill}
                    />
                    <LinearGradient
                      colors={[`${s.accentColor}55`, "transparent"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.featuredContent}>
                      <View style={styles.featuredTopRow}>
                        <View style={[styles.featuredGenre, { backgroundColor: s.accentColor }]}>
                          <Text style={styles.featuredGenreText}>{cap(s.genre)}</Text>
                        </View>
                        {s.status === "coming_soon" && (
                          <View style={styles.featuredSoon}>
                            <Text style={styles.featuredSoonText}>SOON</Text>
                          </View>
                        )}
                        {s.isFlagship && (
                          <View style={styles.featuredFlame}>
                            <Ionicons name="flame" size={11} color={COLORS.gemGold} />
                            <Text style={styles.featuredFlameText}>HOT</Text>
                          </View>
                        )}
                      </View>
                      <View>
                        <Text numberOfLines={2} style={styles.featuredTitle}>{s.title}</Text>
                        <Text numberOfLines={1} style={styles.featuredSub}>
                          {s.tropeTags?.slice(0, 2).join(" · ")
                            || formatReadCount((s.seedReads || 0) + (s.totalReads || 0))
                            || "new · start reading"}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </ReAnimated.View>
              ))}
            </ScrollView>
          </View>
        )}

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
                {formatReadCount((flagship.seedReads || 0) + (flagship.totalReads || 0)) && (
                  <View style={styles.pillBadgeOutline}>
                    <Text style={styles.pillBadgeOutlineText}>{formatReadCount((flagship.seedReads || 0) + (flagship.totalReads || 0))}</Text>
                  </View>
                )}
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
                        <Text style={styles.contChapter}>Ch. {chapterIndex + 1} of {pluralize(total, "chapter")} · {pct}%</Text>
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

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: COLORS.secondary },
  topbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  brand: { flexDirection: "row", alignItems: "center", gap: 4 },
  wordmark: { color: COLORS.text, fontSize: 22, fontWeight: "900", letterSpacing: -1 },
  gemChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill },
  gemIcon: { width: 10, height: 10, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  gemNum: { color: COLORS.gemGold, fontWeight: "800", fontVariant: ["tabular-nums"] },
  avatarChipWrap: { width: 44, height: 44, borderRadius: 999, position: "relative" },
  avatarChipInner: { width: 44, height: 44, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.romance, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  streakFlag: { position: "absolute", top: -6, right: -6, backgroundColor: COLORS.gemGold, borderRadius: 999, minWidth: 20, height: 18, paddingHorizontal: 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 1, borderWidth: 2, borderColor: COLORS.bg },
  streakFlagText: { color: COLORS.bg, fontSize: 10, fontWeight: "900", fontVariant: ["tabular-nums"] },
  featuredWrap: { marginTop: SPACING.md },
  featuredHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  featuredEyebrowRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  featuredEyebrow: { color: COLORS.gemGold, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  featuredCount: { color: COLORS.secondary, fontSize: 12 },
  featuredRail: { gap: 12, paddingHorizontal: SPACING.lg, paddingBottom: 4 },
  featuredCard: { width: 284, height: 168, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  featuredContent: { flex: 1, padding: SPACING.md, justifyContent: "space-between" },
  featuredTopRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  featuredGenre: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.sm },
  featuredGenreText: { color: COLORS.bg, fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  featuredSoon: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.sm, backgroundColor: "rgba(10,10,15,0.65)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  featuredSoonText: { color: COLORS.text, fontSize: 9, fontWeight: "900" },
  featuredFlame: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: RADIUS.sm, backgroundColor: "rgba(255,201,74,0.15)", borderWidth: 1, borderColor: COLORS.gemGold },
  featuredFlameText: { color: COLORS.gemGold, fontSize: 9, fontWeight: "900" },
  featuredTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.5, lineHeight: 21 },
  featuredSub: { color: COLORS.secondary, fontSize: 11, marginTop: 3 },
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
