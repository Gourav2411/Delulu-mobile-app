// Editorial Ending Wall — art-first grid of every ending the user has unlocked.
// Sortable by rarity or story. Tap → the same share card as the reader's ending flow.
// Cycling featured banner rotates between rarest / newest / most-shared endings
// every 4s. Share taps fire a `share_card_shared` analytics event via the backend.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Share } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import ReAnimated, { FadeInUp, FadeIn, FadeOut } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { storyApi, analyticsApi } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { COLORS, RADIUS, SPACING, VOICE } from "@/src/theme";

const SORTS = [
  { id: "rarity", label: "By Rarity" },
  { id: "recent", label: "Recent" },
  { id: "story", label: "By Story" },
];

// Which banner variants cycle in the featured slot and how they're labeled.
const BANNER_MODES = [
  { id: "rarest",       label: "YOUR RAREST",  tagline: (c) => `only ${c.rarity}% of readers` },
  { id: "newest",       label: "JUST UNLOCKED", tagline: (c) => `${c.storyTitle} · ${c.endingName}` },
  { id: "most_shared",  label: "MOST SHARED",   tagline: (c) => `you've shared this ${c.shareCount || 1}× · keep flexing` },
];

function rarityBucket(pct) {
  if (pct <= 5) return { label: "RARE", color: COLORS.gemGold };
  if (pct <= 20) return { label: "EPIC", color: COLORS.scifi };
  return { label: "GOOD", color: COLORS.success };
}

function ProgressRing({ size = 44, stroke = 4, progress = 0, color = COLORS.gemGold, trackColor = "rgba(255,255,255,0.18)", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const dashOffset = c * (1 - clamped);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="transparent" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export default function EndingWall() {
  const router = useRouter();
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("rarity");
  const [bannerModeIdx, setBannerModeIdx] = useState(0);
  const rotateRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { stories } = await storyApi.list();
        setStories(stories);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const owned = user?.ownedEndings || [];
  const unlockTimes = user?.endingUnlockTimes || {};
  const shareCounts = user?.endingShareCounts || {};
  // Only count endings the user can actually unlock (live stories with real chapters)
  const liveStories = useMemo(() => stories.filter((s) => s.status === "live"), [stories]);
  const total = liveStories.reduce((n, s) => n + (s.endings?.length || 0), 0);

  const cards = useMemo(() => {
    const list = [];
    // owned is ordered oldest → newest (server appends). We keep insertion index for "recent".
    owned.forEach((key, idx) => {
      const [storyId, endingId] = key.split(":");
      const story = stories.find((s) => s.id === storyId);
      const ending = story?.endings?.find((e) => e.id === endingId);
      if (story && ending) {
        list.push({
          key,
          storyId,
          endingId,
          storyTitle: story.title,
          accent: story.accentColor,
          cover: story.coverUrl,
          endingName: ending.name,
          rarity: ending.rarityPercent ?? 10,
          headline: ending.shareCardConfig?.headline || "GOOD ending",
          subtitle: ending.shareCardConfig?.subtitle,
          orderIdx: idx,
          unlockedAt: unlockTimes[key] || null,
          shareCount: shareCounts[key] || 0,
        });
      }
    });
    if (sort === "rarity") list.sort((a, b) => a.rarity - b.rarity);
    else if (sort === "story") list.sort((a, b) => a.storyTitle.localeCompare(b.storyTitle));
    else if (sort === "recent") list.sort((a, b) => b.orderIdx - a.orderIdx);
    return list;
  }, [owned, stories, sort, unlockTimes, shareCounts]);

  // ── Cycling banner data ─────────────────────────────────────────────────
  // Compute the three candidate banner cards so we can rotate between them.
  const bannerCandidates = useMemo(() => {
    if (!cards.length) return [];
    const rarest = cards.reduce((m, c) => (c.rarity < m.rarity ? c : m), cards[0]);
    const newest = cards.reduce((m, c) => (c.orderIdx > m.orderIdx ? c : m), cards[0]);
    const mostShared = cards.reduce((m, c) => ((c.shareCount || 0) > (m.shareCount || 0) ? c : m), cards[0]);
    const candidates = [
      { mode: BANNER_MODES[0], card: rarest },
      { mode: BANNER_MODES[1], card: newest },
    ];
    // Only include most-shared once at least one share has happened
    if ((mostShared.shareCount || 0) > 0) {
      candidates.push({ mode: BANNER_MODES[2], card: mostShared });
    }
    // Dedupe by key so if all three point to the same ending we only cycle once
    const seen = new Set();
    return candidates.filter((c) => {
      const uniq = `${c.mode.id}:${c.card.key}`;
      if (seen.has(uniq)) return false;
      seen.add(uniq);
      return true;
    });
  }, [cards]);

  // Auto-rotate every 4 seconds when there's more than one candidate.
  useEffect(() => {
    if (bannerCandidates.length <= 1) {
      if (rotateRef.current) clearInterval(rotateRef.current);
      rotateRef.current = null;
      setBannerModeIdx(0);
      return;
    }
    // Reset to 0 on candidate-set change to avoid out-of-bounds index
    setBannerModeIdx(0);
    if (rotateRef.current) clearInterval(rotateRef.current);
    rotateRef.current = setInterval(() => {
      setBannerModeIdx((i) => (i + 1) % bannerCandidates.length);
    }, 4000);
    return () => {
      if (rotateRef.current) clearInterval(rotateRef.current);
      rotateRef.current = null;
    };
  }, [bannerCandidates.length]);

  const share = useCallback(async (item, surface = "ending_wall") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await Share.share({
        message: `i got the ${rarityBucket(item.rarity).label.toLowerCase()} ending in ${item.storyTitle}. ${VOICE.endingRareTemplate(item.rarity)}. #Delulu`,
      });
      // Fire share_card_shared analytics only if the native sheet was actually engaged
      // (either shared with an activity or dismissed). Both count as user intent.
      if (result?.action === Share.sharedAction || result?.action === Share.dismissedAction) {
        analyticsApi.track("share_card_shared", {
          storyId: item.storyId,
          endingId: item.endingId,
          surface,
          rarityPercent: item.rarity,
          didShare: result.action === Share.sharedAction,
          activityType: result.activityType || null,
        });
        // Increment per-user share count via the endings/share endpoint so the
        // cycling banner "most-shared" variant has data to sort on.
        storyApi.shareEnding({ storyId: item.storyId, endingId: item.endingId, surface });
      }
    } catch {}
  }, []);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.romance} /></View>;

  const activeBanner = bannerCandidates[bannerModeIdx] || (cards.length ? { mode: BANNER_MODES[0], card: cards[0] } : null);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.iconBtn} testID="wall-back">
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.title}>ENDING WALL</Text>
            <Text style={styles.subtitle}>{cards.length} of {total || cards.length} · your choices, receipts</Text>
          </View>
          {/* Global progress ring in the header */}
          <ProgressRing
            size={40}
            stroke={3.5}
            progress={total ? cards.length / total : 0}
            color={COLORS.gemGold}
          >
            <Text style={styles.ringLabel} testID="wall-progress-ring">{cards.length}/{total || cards.length}</Text>
          </ProgressRing>
        </View>
      </SafeAreaView>

      {cards.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="ribbon-outline" size={48} color={COLORS.secondary} />
          <Text style={styles.emptyText}>{VOICE.endingsEmpty}</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/home")} style={styles.emptyCta}>
            <Text style={styles.emptyCtaText}>{VOICE.endingsEmptyCta}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
          {/* cycling featured banner */}
          {activeBanner && (
            <ReAnimated.View
              key={`${activeBanner.mode.id}:${activeBanner.card.key}`}
              entering={FadeIn.duration(420)}
              exiting={FadeOut.duration(220)}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => share(activeBanner.card, "ending_wall_banner")}
                style={styles.featureBanner}
                testID={`wall-banner-${activeBanner.mode.id}`}
              >
                <Image source={{ uri: activeBanner.card.cover }} style={StyleSheet.absoluteFillObject} />
                <LinearGradient
                  colors={["rgba(10,10,15,0.2)", "rgba(10,10,15,0.55)", "rgba(10,10,15,0.98)"]}
                  locations={[0, 0.5, 1]}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={[`${rarityBucket(activeBanner.card.rarity).color}55`, "transparent"]}
                  start={{ x: 0, y: 0.4 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.bannerBody}>
                  <View style={[styles.rarityPill, { borderColor: rarityBucket(activeBanner.card.rarity).color, backgroundColor: `${rarityBucket(activeBanner.card.rarity).color}33` }]}>
                    <Ionicons name="diamond" size={11} color={rarityBucket(activeBanner.card.rarity).color} />
                    <Text style={[styles.rarityPillText, { color: rarityBucket(activeBanner.card.rarity).color }]}>
                      {activeBanner.mode.label}
                    </Text>
                  </View>
                  <Text style={styles.bannerHeadline}>{activeBanner.card.headline}</Text>
                  <Text style={styles.bannerStory}>{activeBanner.card.storyTitle} · {activeBanner.card.endingName}</Text>
                  <Text style={styles.bannerRarity}>{activeBanner.mode.tagline(activeBanner.card)}</Text>
                  <View style={styles.bannerFooterRow}>
                    <View style={styles.shareRow}>
                      <Ionicons name="share-social" size={12} color={COLORS.text} />
                      <Text style={styles.shareText}>tap to share</Text>
                    </View>
                    {/* dot indicators for cycle position */}
                    {bannerCandidates.length > 1 && (
                      <View style={styles.dotsRow}>
                        {bannerCandidates.map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.dot,
                              i === bannerModeIdx && { backgroundColor: COLORS.text, width: 14 },
                            ]}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </ReAnimated.View>
          )}

          {/* sort chips */}
          <View style={styles.sortRow}>
            {SORTS.map((s) => {
              const active = sort === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  testID={`wall-sort-${s.id}`}
                  onPress={() => { Haptics.selectionAsync(); setSort(s.id); }}
                  style={[styles.sortChip, active && { backgroundColor: COLORS.romance, borderColor: COLORS.romance }]}
                >
                  <Text style={[styles.sortText, active && { color: COLORS.bg }]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* grid */}
          <View style={styles.grid}>
            {cards.map((c, idx) => {
              const bucket = rarityBucket(c.rarity);
              return (
                <ReAnimated.View
                  key={c.key}
                  entering={FadeInUp.duration(360).delay(idx * 55)}
                  style={styles.card}
                >
                  <TouchableOpacity activeOpacity={0.88} onPress={() => share(c, "ending_wall_card")} style={{ flex: 1 }} testID={`wall-card-${c.endingId}`}>
                    <Image source={{ uri: c.cover }} style={StyleSheet.absoluteFillObject} />
                    <LinearGradient colors={["transparent", "rgba(10,10,15,0.75)", "#0A0A0F"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
                    <LinearGradient colors={[`${bucket.color}55`, "transparent"]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
                    <View style={styles.cardTop}>
                      <View style={[styles.rarityBadge, { borderColor: bucket.color, backgroundColor: `${bucket.color}22` }]}>
                        <Text style={[styles.rarityBadgeText, { color: bucket.color }]}>{bucket.label}</Text>
                      </View>
                      <Text style={styles.rarityPct}>{c.rarity}%</Text>
                    </View>
                    <View style={styles.cardBottom}>
                      <Text numberOfLines={1} style={styles.cardStory}>{c.storyTitle}</Text>
                      <Text numberOfLines={2} style={styles.cardEnding}>{c.endingName}</Text>
                    </View>
                  </TouchableOpacity>
                </ReAnimated.View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", padding: SPACING.md },
  iconBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  title: { color: COLORS.text, fontSize: 15, fontWeight: "900", letterSpacing: 2 },
  subtitle: { color: COLORS.secondary, fontSize: 11, marginTop: 2 },
  ringLabel: { color: COLORS.text, fontSize: 10, fontWeight: "900", letterSpacing: 0.3 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.md },
  emptyText: { color: COLORS.secondary, textAlign: "center", fontSize: 14, lineHeight: 20 },
  emptyCta: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: COLORS.romance, marginTop: SPACING.sm },
  emptyCtaText: { color: COLORS.bg, fontWeight: "800" },
  featureBanner: { height: 260, marginHorizontal: SPACING.lg, marginTop: SPACING.sm, borderRadius: RADIUS.lg, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border, shadowColor: COLORS.gemGold, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16 },
  bannerBody: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACING.lg, gap: 4 },
  rarityPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill, borderWidth: 1, marginBottom: 4 },
  rarityPillText: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  bannerHeadline: { color: COLORS.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.8 },
  bannerStory: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginTop: 4 },
  bannerRarity: { color: COLORS.secondary, fontSize: 11, marginTop: 2 },
  bannerFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  shareRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(10,10,15,0.6)", borderRadius: RADIUS.pill, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  shareText: { color: COLORS.text, fontSize: 11, fontWeight: "700" },
  dotsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  sortRow: { flexDirection: "row", gap: 6, paddingHorizontal: SPACING.lg, marginTop: SPACING.lg, marginBottom: SPACING.md },
  sortChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  sortText: { color: COLORS.secondary, fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: SPACING.lg, gap: SPACING.sm, justifyContent: "space-between" },
  card: { width: "48%", aspectRatio: 0.72, borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, position: "relative" },
  cardTop: { position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rarityBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm, borderWidth: 1 },
  rarityBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  rarityPct: { color: COLORS.text, fontSize: 10, fontWeight: "800", backgroundColor: "rgba(10,10,15,0.65)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm },
  cardBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 10, gap: 2 },
  cardStory: { color: COLORS.secondary, fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  cardEnding: { color: COLORS.text, fontSize: 14, fontWeight: "900", lineHeight: 16, letterSpacing: -0.3 },
});
