// Onboarding — 3 slides: hook, genre picker, notification ask (brand voice).
import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Animated } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, GENRE_ACCENT, RADIUS, SPACING, TYPO } from "@/src/theme";

const { width } = Dimensions.get("window");

const GENRES = [
  { id: "romance", label: "Romance", icon: "heart" },
  { id: "thriller", label: "Thriller", icon: "flash" },
  { id: "horror", label: "Horror", icon: "flame" },
  { id: "scifi", label: "Sci-Fi", icon: "planet" },
  { id: "drama", label: "Drama", icon: "cafe" },
];

export default function Onboarding() {
  const router = useRouter();
  const scroll = useRef(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(new Set());

  const next = () => {
    if (idx < 2) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scroll.current?.scrollTo({ x: (idx + 1) * width, animated: true });
      setIdx(idx + 1);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.replace("/auth");
    }
  };

  const toggle = (id) => {
    Haptics.selectionAsync();
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#FF3E8A", "#0A0A0F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,10,15,0.65)" }]} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <View style={styles.brand}>
            <Text style={styles.wordmark}>delulu</Text>
            <View style={styles.gemDot} />
          </View>
          <TouchableOpacity
            testID="onboarding-skip"
            onPress={() => router.replace("/auth")}
            hitSlop={10}
          >
            <Text style={styles.skipText}>skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scroll}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          style={{ flex: 1 }}
        >
          {/* Slide 1 */}
          <View style={[styles.slide, { width }]}>
            <View style={styles.heroArtCircle}>
              <View style={styles.heroInner} />
              <Text style={styles.heroEmojiish}>♥</Text>
            </View>
            <Text style={styles.slideEyebrow}>chat fiction. rewritten.</Text>
            <Text style={styles.slideTitle}>your choices.{"\n"}<Text style={{ color: COLORS.romance }}>their stories.</Text></Text>
            <Text style={styles.slideBody}>every text hides a world.  every choice writes it.</Text>
          </View>

          {/* Slide 2 */}
          <View style={[styles.slide, { width }]}>
            <Text style={styles.slideEyebrow}>pick your poison</Text>
            <Text style={styles.slideTitle}>pick your <Text style={{ color: COLORS.romance }}>vibes</Text></Text>
            <Text style={styles.slideBody}>{"we'll tailor stories you'll love."}</Text>
            <View style={{ marginTop: SPACING.xl, gap: SPACING.sm, alignSelf: "stretch" }}>
              {GENRES.map((g) => {
                const active = picked.has(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    testID={`onboarding-genre-${g.id}`}
                    activeOpacity={0.85}
                    onPress={() => toggle(g.id)}
                    style={[
                      styles.genrePill,
                      active && { borderColor: GENRE_ACCENT[g.id], backgroundColor: `${GENRE_ACCENT[g.id]}22` },
                    ]}
                  >
                    <Ionicons name={g.icon} size={18} color={GENRE_ACCENT[g.id]} />
                    <Text style={styles.genrePillText}>{g.label}</Text>
                    {active ? <Ionicons name="checkmark-circle" size={20} color={GENRE_ACCENT[g.id]} /> : <View style={{ width: 20 }} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Slide 3 */}
          <View style={[styles.slide, { width }]}>
            <View style={styles.notifCard}>
              <Ionicons name="notifications" size={28} color={COLORS.gemGold} />
              <Text style={styles.notifTitle}>never miss a moment</Text>
              <Text style={styles.notifBody}>{"we ping you when a new chapter drops or your streak's about to die."}</Text>
            </View>
            <Text style={[styles.slideTitle, { marginTop: SPACING.xl }]}>never miss <Text style={{ color: COLORS.romance }}>a moment</Text></Text>
            <Text style={styles.slideBody}>{"we'll behave. mostly."}</Text>
          </View>
        </ScrollView>

        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, idx === i && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity testID="onboarding-next" onPress={next} activeOpacity={0.9} style={styles.cta}>
          <Text style={styles.ctaText}>{idx === 2 ? "let's go" : "next"}</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.bg} />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 6 },
  wordmark: { fontSize: 24, fontWeight: "900", color: COLORS.text, letterSpacing: -1 },
  gemDot: { width: 8, height: 8, borderRadius: 2, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  skipText: { color: COLORS.secondary, fontSize: 14 },
  slide: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, alignItems: "flex-start", justifyContent: "center" },
  slideEyebrow: { ...TYPO.caption, marginBottom: SPACING.sm },
  slideTitle: { fontSize: 40, fontWeight: "900", letterSpacing: -1.2, color: COLORS.text, lineHeight: 44 },
  slideBody: { color: COLORS.secondary, fontSize: 16, marginTop: SPACING.md, lineHeight: 24 },
  heroArtCircle: {
    width: 180, height: 180, borderRadius: 999, alignSelf: "center",
    backgroundColor: `${COLORS.romance}22`, borderWidth: 1, borderColor: COLORS.romance,
    alignItems: "center", justifyContent: "center", marginBottom: SPACING.xl,
  },
  heroInner: { position: "absolute", width: 120, height: 120, borderRadius: 999, backgroundColor: COLORS.romance, opacity: 0.35 },
  heroEmojiish: { fontSize: 84, color: COLORS.text, opacity: 0.85, fontWeight: "900" },
  genrePill: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  genrePillText: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: "600" },
  notifCard: {
    alignSelf: "center", width: "100%", padding: SPACING.lg, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  notifTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, letterSpacing: -0.3 },
  notifBody: { color: COLORS.secondary, fontSize: 14, lineHeight: 20 },
  dots: { flexDirection: "row", gap: 8, alignSelf: "center", marginBottom: SPACING.md },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.romance, width: 22 },
  cta: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.romance,
    paddingVertical: 16,
    borderRadius: RADIUS.pill,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: { color: COLORS.bg, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
});
