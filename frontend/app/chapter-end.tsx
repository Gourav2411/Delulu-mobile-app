// Chapter end — cliffhanger + live countdown + Unlock Now + I'll wait.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { storyApi } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { COLORS, RADIUS, SPACING, VOICE } from "@/src/theme";

const SKIP_COST = 15;

export default function ChapterEnd() {
  const router = useRouter();
  const { storyId, chapterIndex } = useLocalSearchParams();
  const chIdx = parseInt(chapterIndex, 10);
  const { user, refresh } = useAuth();

  const target = useMemo(() => Date.now() + 3 * 60 * 60 * 1000, []); // 3-hour timer
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remain = Math.max(0, target - now);
  const hh = Math.floor(remain / 3600000);
  const mm = Math.floor((remain % 3600000) / 60000);
  const ss = Math.floor((remain % 60000) / 1000);

  const canSkip = (user?.gemBalance ?? 0) >= SKIP_COST;

  const unlockNow = async () => {
    if (!canSkip) {
      router.push(`/(tabs)/gems?msg=${encodeURIComponent(VOICE.notEnoughGems)}`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await storyApi.skipTimer({ storyId, chapterIndex: chIdx + 1 });
      await refresh();
      router.replace(`/reader/${storyId}?chapter=${chIdx + 1}`);
    } catch (e) {
      setErr(e.detail || "skip fumbled");
    } finally {
      setBusy(false);
    }
  };

  const wait = () => router.replace("/(tabs)/home");

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#1a0a15", "#0A0A0F"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.content}>
          <View style={styles.brokenHeart}>
            <Ionicons name="heart-dislike" size={92} color={COLORS.romance} />
          </View>
          <Text style={styles.title}>to be continued...</Text>
          <Text style={styles.sub}>{VOICE.timer}</Text>

          <View style={styles.timerRow}>
            <TimeBlock label="HRS" value={hh} />
            <Text style={styles.timeColon}>:</Text>
            <TimeBlock label="MINS" value={mm} />
            <Text style={styles.timeColon}>:</Text>
            <TimeBlock label="SECS" value={ss} />
          </View>

          {err && <Text style={styles.err}>{err}</Text>}

          <TouchableOpacity
            testID="chapter-end-unlock"
            onPress={unlockNow}
            disabled={busy}
            activeOpacity={0.9}
            style={styles.unlockBtn}
          >
            <Ionicons name="flash" size={16} color={COLORS.bg} />
            <Text style={styles.unlockText}>unlock now</Text>
            <View style={styles.gemPill}>
              <View style={styles.gemDot} />
              <Text style={styles.gemNum}>{SKIP_COST}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity testID="chapter-end-wait" onPress={wait}>
            <Text style={styles.waitText}>{"i'll wait"}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function TimeBlock({ label, value }) {
  return (
    <View style={styles.timeBlock}>
      <Text style={styles.timeVal}>{String(value).padStart(2, "0")}</Text>
      <Text style={styles.timeLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg, gap: SPACING.md },
  brokenHeart: { padding: SPACING.lg, marginBottom: SPACING.md, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: `${COLORS.romance}22`, borderWidth: 1, borderColor: `${COLORS.romance}66` },
  title: { color: COLORS.text, fontSize: 32, fontWeight: "900", letterSpacing: -0.8, textAlign: "center" },
  sub: { color: COLORS.secondary, fontSize: 14, textAlign: "center", marginTop: -6 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: SPACING.lg },
  timeColon: { color: COLORS.text, fontSize: 28, fontWeight: "900" },
  timeBlock: { alignItems: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, minWidth: 72 },
  timeVal: { color: COLORS.text, fontSize: 30, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -0.5 },
  timeLabel: { color: COLORS.secondary, fontSize: 10, letterSpacing: 1, marginTop: 4 },
  unlockBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.gemGold, paddingHorizontal: 20, paddingVertical: 14, borderRadius: RADIUS.pill },
  unlockText: { color: COLORS.bg, fontSize: 15, fontWeight: "800" },
  gemPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill, backgroundColor: "rgba(10,10,15,0.35)" },
  gemDot: { width: 8, height: 8, backgroundColor: COLORS.bg, transform: [{ rotate: "45deg" }] },
  gemNum: { color: COLORS.bg, fontWeight: "900", fontVariant: ["tabular-nums"] },
  waitText: { color: COLORS.secondary, fontSize: 13, marginTop: SPACING.md, textDecorationLine: "underline" },
  err: { color: COLORS.danger, fontSize: 12 },
});
