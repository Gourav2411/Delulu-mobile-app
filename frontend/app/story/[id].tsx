// Story detail — cover, character lineup with "starring YOU", synopsis, tropes, chapter list.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { storyApi, avatarApi } from "@/src/api";
import { AvatarPreview } from "@/src/AvatarPreview";
import { useAuth } from "@/src/AuthContext";
import { COLORS, RADIUS, SPACING, VOICE } from "@/src/theme";
import { formatReadCount, pluralize } from "@/src/utils/format";

export default function StoryDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [story, setStory] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([storyApi.get(id), avatarApi.catalog()]);
        setStory(s);
        setCatalog(c.items);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading || !story) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.romance} />
      </View>
    );
  }

  const accent = story.accentColor || COLORS.romance;
  const progress = user?.progress?.[story.id];
  const canRead = story.chapters && story.chapters.length > 0;

  const startReading = () => {
    if (!canRead) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/reader/${story.id}?chapter=${progress?.chapterIndex ?? 0}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Cover */}
        <View style={styles.coverWrap}>
          <Image source={{ uri: story.coverUrl }} style={StyleSheet.absoluteFillObject} />
          <LinearGradient colors={["rgba(10,10,15,0.4)", "rgba(10,10,15,0.95)", "#0A0A0F"]} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={[`${accent}44`, "transparent"]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={["top"]}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
                <Ionicons name="chevron-back" size={22} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity hitSlop={12} style={styles.iconBtn}>
                <Ionicons name="share-outline" size={20} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          <View style={styles.coverBottom}>
            <Text style={styles.title}>{story.title}</Text>
            <View style={styles.metaRow}>
              <View style={[styles.genreTag, { backgroundColor: accent }]}>
                <Ionicons name="heart" size={11} color={COLORS.bg} />
                <Text style={styles.genreTagText}>{cap(story.genre)}</Text>
              </View>
              <Text style={styles.meta}>{story.ageRating || "16+"}</Text>
              {formatReadCount((story.seedReads || 0) + (story.totalReads || 0)) && (
                <Text style={styles.meta}>· {formatReadCount((story.seedReads || 0) + (story.totalReads || 0))}</Text>
              )}
            </View>
            {story.tropeTags?.length > 0 && (
              <View style={styles.trope}>
                {story.tropeTags.map((t) => (
                  <View key={t} style={styles.tropeTag}>
                    <Text style={styles.tropeText}>{t}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Synopsis */}
        <View style={styles.section}>
          <Text style={styles.synopsis}>{story.synopsis}</Text>
        </View>

        {/* Characters */}
        {story.characters?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>starring</Text>
            <View style={styles.charRow}>
              {/* Player card */}
              <View style={styles.charCard}>
                <View style={[styles.playerAvatar, { borderColor: accent }]}>
                  <AvatarPreview
                    layers={user?.avatarConfig?.layers || {}}
                    catalog={catalog}
                    presetImageUrl={user?.avatarConfig?.imageUrl}
                    size={64}
                  />
                </View>
                <Text style={styles.charName}>You</Text>
                <Text style={styles.charRole} numberOfLines={1}>{user?.avatarConfig?.trait || "the MC"}</Text>
              </View>
              {story.characters.filter((c) => c.id !== "narrator").map((c) => (
                <View key={c.id} style={styles.charCard}>
                  <Image source={{ uri: c.avatarUrl }} style={styles.charImg} />
                  <Text style={styles.charName} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.charRole} numberOfLines={1}>{c.role}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Chapters */}
        {story.chapters?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.chapHead}>
              <Text style={styles.sectionTitle}>chapters</Text>
              <Text style={styles.chapMeta}>{story.chapters.length} chapters · {story.status === "live" ? "ongoing" : "coming soon"}</Text>
            </View>
            {story.chapters.map((ch, i) => {
              const isFree = i < 3;
              const done = progress && (progress.chapterIndex || 0) > i;
              const current = progress && (progress.chapterIndex || 0) === i;
              const locked = !isFree && !done && !current && (!progress || (progress.chapterIndex || 0) < i);
              return (
                <TouchableOpacity
                  key={ch.id}
                  testID={`chapter-${i}`}
                  activeOpacity={0.85}
                  disabled={locked}
                  style={[styles.chapRow, locked && { opacity: 0.5 }, current && { borderLeftWidth: 3, borderLeftColor: accent, paddingLeft: 12 }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    router.push(`/reader/${story.id}?chapter=${i}`);
                  }}
                >
                  <View style={[styles.chapNum, done && { backgroundColor: `${COLORS.success}22` }, current && { backgroundColor: `${accent}22` }]}>
                    <Text style={[styles.chapNumText, done && { color: COLORS.success }, current && { color: accent }]}>{String(i + 1).padStart(2, "0")}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.chapTitle} numberOfLines={1}>{ch.title}</Text>
                    <Text style={styles.chapBadge}>
                      {done ? "COMPLETED" : current ? "IN PROGRESS" : isFree ? "FREE" : locked ? "LOCKED" : ""}
                    </Text>
                  </View>
                  {done ? (
                    <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
                  ) : locked ? (
                    <View style={styles.chapLockPill}>
                      <View style={styles.chapGem} />
                      <Text style={styles.chapLockText}>15</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={22} color={accent} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      {canRead && (
        <View style={styles.stickyCtaWrap}>
          <TouchableOpacity
            testID="story-start-reading"
            activeOpacity={0.9}
            onPress={startReading}
            style={[styles.startBtn, { backgroundColor: accent }]}
          >
            <Ionicons name="book" size={18} color={COLORS.bg} />
            <Text style={styles.startBtnText}>{progress ? "continue reading" : "start reading"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  coverWrap: { height: 460, position: "relative", overflow: "hidden" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", padding: SPACING.md },
  iconBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  coverBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACING.lg, gap: 10 },
  title: { color: COLORS.text, fontSize: 34, fontWeight: "900", letterSpacing: -1, lineHeight: 36 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  genreTag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
  genreTagText: { color: COLORS.bg, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  meta: { color: COLORS.secondary, fontSize: 12 },
  trope: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tropeTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.glass },
  tropeText: { color: COLORS.text, fontSize: 11, fontWeight: "600" },
  section: { padding: SPACING.lg, gap: SPACING.md },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  synopsis: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  charRow: { flexDirection: "row", gap: SPACING.md, flexWrap: "wrap" },
  charCard: { width: 84, alignItems: "center", gap: 4 },
  charImg: { width: 72, height: 72, borderRadius: 999, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.elevated },
  playerAvatar: { width: 72, height: 72, borderRadius: 999, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surface, overflow: "hidden" },
  charName: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  charRole: { color: COLORS.secondary, fontSize: 10 },
  chapHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  chapMeta: { color: COLORS.secondary, fontSize: 12 },
  chapRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: 14, paddingHorizontal: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginBottom: 6 },
  chapNum: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.elevated, alignItems: "center", justifyContent: "center" },
  chapNumText: { color: COLORS.secondary, fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  chapTitle: { color: COLORS.text, fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  chapBadge: { color: COLORS.secondary, fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 2 },
  chapLockPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: "rgba(255,201,74,0.15)", borderWidth: 1, borderColor: COLORS.gemGold },
  chapGem: { width: 8, height: 8, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  chapLockText: { color: COLORS.gemGold, fontWeight: "900", fontSize: 12, fontVariant: ["tabular-nums"] },
  stickyCtaWrap: { position: "absolute", left: 0, right: 0, bottom: 0, padding: SPACING.md, paddingBottom: SPACING.lg, backgroundColor: "rgba(10,10,15,0.9)", borderTopWidth: 1, borderTopColor: COLORS.border },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: RADIUS.pill },
  startBtnText: { color: COLORS.bg, fontWeight: "800", fontSize: 16 },
});
