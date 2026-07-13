// Ending share card — big banner, rarity %, native share.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Share } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { storyApi } from "@/src/api";
import { COLORS, RADIUS, SPACING, VOICE } from "@/src/theme";

export default function EndingScreen() {
  const router = useRouter();
  const { id, endingId } = useLocalSearchParams();
  const [story, setStory] = useState(null);
  const [ending, setEnding] = useState(null);

  useEffect(() => {
    (async () => {
      const s = await storyApi.get(id);
      setStory(s);
      const e = s.endings.find((x) => x.id === endingId);
      setEnding(e || s.endings[0]);
    })();
  }, [id, endingId]);

  if (!story || !ending) return null;
  const accent = ending.shareCardConfig?.accent || story.accentColor;
  const rarity = ending.rarityPercent ?? 10;

  const share = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `i just got the ${rarityLabel(rarity).toLowerCase()} ending in ${story.title}. ${VOICE.endingRareTemplate(rarity)}. #Delulu #deluluIsTheSolulu`,
      });
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Image source={{ uri: story.coverUrl }} style={StyleSheet.absoluteFillObject} />
      <LinearGradient colors={["rgba(10,10,15,0.2)", "rgba(10,10,15,0.6)", "rgba(10,10,15,0.98)"]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[`${accent}55`, "transparent"]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.replace("/(tabs)/home")} hitSlop={12}>
            <Ionicons name="close" size={26} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.eyebrow}>I got the</Text>
          <Text style={[styles.rarityTitle, { color: accent }]}>{rarityLabel(rarity)}</Text>
          <Text style={styles.rarityWord}>ending</Text>
          <Text style={styles.pct}>({rarity}% of readers)</Text>

          <View style={[styles.divider, { backgroundColor: accent }]} />

          <Text style={styles.storyTitle}>{story.title}</Text>
          <Text style={styles.endingName}>{ending.name}</Text>
          <Text style={styles.tagline}>choices matter. stories stay with us.</Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.shareRow}>
            <ShareIcon icon="logo-instagram" onPress={share} label="Insta" testID="share-instagram" />
            <ShareIcon icon="logo-whatsapp" onPress={share} label="WhatsApp" testID="share-whatsapp" />
            <ShareIcon icon="share-social" onPress={share} label="More" testID="share-more" />
          </View>
          <TouchableOpacity
            testID="ending-continue"
            onPress={() => router.replace("/(tabs)/home")}
            activeOpacity={0.9}
            style={[styles.continueBtn, { backgroundColor: accent }]}
          >
            <Text style={styles.continueText}>back to home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ShareIcon({ icon, onPress, label, testID }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={styles.shareIcon} activeOpacity={0.8}>
      <Ionicons name={icon} size={22} color={COLORS.text} />
      <Text style={styles.shareLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function rarityLabel(pct) {
  if (pct <= 5) return "RARE";
  if (pct <= 20) return "EPIC";
  return "GOOD";
}

const styles = StyleSheet.create({
  topRow: { padding: SPACING.lg, alignItems: "flex-end" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg, gap: 4 },
  eyebrow: { color: COLORS.text, fontSize: 20, fontWeight: "500", letterSpacing: -0.2 },
  rarityTitle: { fontSize: 72, fontWeight: "900", letterSpacing: -3, marginTop: -6 },
  rarityWord: { color: COLORS.text, fontSize: 32, fontWeight: "300", fontStyle: "italic", letterSpacing: -0.6, marginTop: -12 },
  pct: { color: COLORS.secondary, fontSize: 13, marginTop: 6 },
  divider: { width: 60, height: 3, marginVertical: SPACING.lg },
  storyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  endingName: { color: COLORS.text, fontSize: 18, fontWeight: "600", marginTop: 4 },
  tagline: { color: COLORS.secondary, fontSize: 13, marginTop: SPACING.md, textAlign: "center" },
  actions: { padding: SPACING.lg, gap: SPACING.md },
  shareRow: { flexDirection: "row", justifyContent: "space-around", padding: SPACING.md, backgroundColor: COLORS.glass, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  shareIcon: { alignItems: "center", gap: 4, padding: 8 },
  shareLabel: { color: COLORS.secondary, fontSize: 11 },
  continueBtn: { padding: 16, borderRadius: RADIUS.pill, alignItems: "center" },
  continueText: { color: COLORS.bg, fontSize: 16, fontWeight: "800" },
});
