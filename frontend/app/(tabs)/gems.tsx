// Gem store — daily claim + packs.
// Prices come from the store's localized billing; UI is display-only.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { gemsApi } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { COLORS, RADIUS, SPACING, VOICE } from "@/src/theme";
import { detectCurrency, formatPrice } from "@/src/currency";
import { useToast } from "@/src/Toast";
import { pluralize } from "@/src/utils/format";

// Days of the week — starts on Monday to match global streak conventions
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function Gems() {
  const { user, refresh } = useAuth();
  const { msg } = useLocalSearchParams();
  const toast = useToast();
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(msg || null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Store the currency the backend used to price these packs (from IP / device
  // locale). We only display it in a small footer chip — the user can't switch
  // manually because real Play Billing / App Store handle regional pricing.
  const currency = useRef(detectCurrency()).current;

  const load = async () => {
    try {
      const { packs } = await gemsApi.packs(currency);
      setPacks(packs);
    } catch {}
  };

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claim = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const res = await gemsApi.daily();
      await refresh();
      setNotice(`+${res.awarded} gems. ${VOICE.streakClaimed}`);
      toast.show(`+${res.awarded} gems`, { icon: "flame" });
    } catch (e) {
      setNotice(e?.detail || VOICE.claimAlready);
    } finally {
      setBusy(false);
    }
  };

  const buy = async (packId) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const res = await gemsApi.buyMock(packId);
      await refresh();
      setNotice(`+${res.awarded} gems. enjoy the spiral.`);
    } catch (e) {
      setNotice(e?.detail || "purchase didn't go through, try again.");
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await load(); await refresh(); setRefreshing(false); };

  const streak = user?.streak ?? 0;
  // Determine if today has already been claimed. Backend returns lastDailyClaim
  // as an ISO datetime; if the calendar day matches "today" in the user's local
  // tz, they've claimed today.
  const claimedToday = (() => {
    const last = user?.lastDailyClaim;
    if (!last) return false;
    const d = new Date(last);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    return d.getFullYear() === today.getFullYear()
      && d.getMonth() === today.getMonth()
      && d.getDate() === today.getDate();
  })();
  // Today's index in the streak row (0..6). If claimed today, "today" advances
  // to the *next* day (dim/future). Otherwise it's the day the user should tap.
  const todayIdx = claimedToday ? (streak % 7) : (streak % 7);
  const daysClaimed = claimedToday ? (streak % 7) + 1 : (streak % 7);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.romance} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.top}>
          <Text style={styles.title}>Gems</Text>
          <View style={styles.gemChip}>
            <View style={styles.gem} />
            <Text style={styles.gemNum}>{user?.gemBalance ?? 0}</Text>
          </View>
        </View>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.lg, paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.romance} />}
      >
        {notice && (
          <View style={styles.notice} testID="gems-notice">
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        )}

        {/* Daily claim */}
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View>
              <Text style={styles.cardTitle}>daily gems</Text>
              <Text style={styles.cardSub}>come back every day for more.</Text>
            </View>
            <View style={styles.dailyGem}><View style={styles.gemBig} /><Text style={styles.dailyGemText}>+5</Text></View>
          </View>
          <View style={styles.streakRow}>
            {DAYS.map((d, i) => (
              <DayCell
                key={i}
                label={d}
                state={i < daysClaimed ? "claimed" : i === todayIdx && !claimedToday ? "today" : "future"}
              />
            ))}
          </View>
          <TouchableOpacity
            testID="gems-daily-claim"
            onPress={claim}
            disabled={busy || claimedToday}
            activeOpacity={0.9}
            style={[styles.claimBtn, (busy || claimedToday) && { opacity: 0.5 }]}
          >
            <Text style={styles.claimBtnText}>
              {busy ? VOICE.claimBusy : claimedToday ? "back tomorrow ✨" : VOICE.claimCTA}
            </Text>
          </TouchableOpacity>
          {streak > 0 && (
            <Text style={styles.streakLine}>
              🔥 {pluralize(streak, "day")} in a row · keep it going
            </Text>
          )}
        </View>

        {/* Packs */}
        <View style={{ gap: SPACING.sm }}>
          <View style={styles.packsHead}>
            <Text style={styles.sectionHeader}>gem packs</Text>
            <View style={styles.currencyChip} testID="currency-display">
              <Ionicons name="globe-outline" size={12} color={COLORS.secondary} />
              <Text style={styles.currencyChipText}>{currency}</Text>
            </View>
          </View>
          {packs.map((p) => (
            <TouchableOpacity
              key={p.id}
              testID={`gem-pack-${p.id}`}
              activeOpacity={0.85}
              onPress={() => buy(p.id)}
              disabled={busy}
              style={styles.packCard}
            >
              <LinearGradient colors={[`${packAccent(p.id)}30`, "transparent"]} start={{x:0,y:0}} end={{x:1,y:0}} style={StyleSheet.absoluteFill} />
              <View style={[styles.packIcon, { backgroundColor: packAccent(p.id) }]}>
                <Ionicons name="gift" size={20} color={COLORS.bg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.packLabel}>{p.label}</Text>
                <View style={styles.packGems}>
                  <View style={styles.gemSmall} />
                  <Text style={styles.packGemNum}>{pluralize(p.gems, "gem")}</Text>
                </View>
              </View>
              <View style={styles.priceBtn}>
                <Text style={styles.priceText}>{formatPrice(p.price) || `$${p.usd}`}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * One cell of the 7-day streak calendar.
 * - "claimed": filled flame, subtle romance-tinted background
 * - "today":   dashed gold outline that PULSES; the CTA of the whole card
 * - "future":  dim outline
 * Claimed and today never look identical.
 */
function DayCell({ label, state }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (state === "today") {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulse.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.06 }],
    shadowOpacity: 0.35 + pulse.value * 0.4,
  }), []);

  const isClaimed = state === "claimed";
  const isToday = state === "today";
  const isFuture = state === "future";

  const container = [
    styles.streakDay,
    isClaimed && { backgroundColor: `${COLORS.romance}22`, borderColor: COLORS.romance, borderStyle: "solid" },
    isToday && { backgroundColor: COLORS.elevated, borderColor: COLORS.gemGold, borderStyle: "dashed", shadowColor: COLORS.gemGold, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
    isFuture && { opacity: 0.42 },
  ];
  const iconName = isClaimed ? "flame" : isToday ? "flame" : "flame-outline";
  const iconColor = isClaimed ? COLORS.romance : isToday ? COLORS.gemGold : COLORS.secondary;
  const labelColor = isClaimed ? COLORS.romance : isToday ? COLORS.gemGold : COLORS.secondary;

  const Wrapper: any = isToday ? ReAnimated.View : View;
  return (
    <Wrapper style={[container, isToday && animStyle]} testID={`day-cell-${state}`}>
      <Ionicons name={iconName} size={16} color={iconColor} />
      <Text style={[styles.streakDayLabel, { color: labelColor }]}>{label}</Text>
    </Wrapper>
  );
}

function packAccent(id) {
  return { starter: COLORS.scifi, popular: COLORS.romance, best: COLORS.gemGold, treasure: COLORS.drama }[id] || COLORS.romance;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.lg, paddingBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.6 },
  gemChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill },
  gem: { width: 10, height: 10, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  gemNum: { color: COLORS.gemGold, fontWeight: "800", fontVariant: ["tabular-nums"] },
  notice: { padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.romance },
  noticeText: { color: COLORS.text, fontSize: 13 },
  card: { padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  cardSub: { color: COLORS.secondary, fontSize: 12, marginTop: 2 },
  dailyGem: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: `${COLORS.gemGold}22`, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.gemGold },
  gemBig: { width: 12, height: 12, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  dailyGemText: { color: COLORS.gemGold, fontWeight: "900" },
  streakRow: { flexDirection: "row", justifyContent: "space-between" },
  streakDay: { flex: 1, marginHorizontal: 3, alignItems: "center", padding: 6, borderRadius: RADIUS.sm, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.elevated, gap: 2 },
  streakDayLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  claimBtn: { backgroundColor: COLORS.gemGold, padding: 14, borderRadius: RADIUS.md, alignItems: "center" },
  claimBtnText: { color: COLORS.bg, fontSize: 15, fontWeight: "800", letterSpacing: 0.2 },
  streakLine: { color: COLORS.secondary, fontSize: 12, textAlign: "center", marginTop: -4 },
  sectionHeader: { color: COLORS.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  packCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  packsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  currencyChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  currencyChipText: { color: COLORS.secondary, fontWeight: "700", fontSize: 10, letterSpacing: 0.5 },
  packIcon: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  packLabel: { color: COLORS.text, fontWeight: "800" },
  packGems: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  gemSmall: { width: 10, height: 10, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  packGemNum: { color: COLORS.gemGold, fontWeight: "800", fontVariant: ["tabular-nums"] },
  priceBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border },
  priceText: { color: COLORS.text, fontWeight: "800" },
});
