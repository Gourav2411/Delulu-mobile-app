// Gem store — daily claim + packs (mock IAP)
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { gemsApi } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { COLORS, RADIUS, SPACING, VOICE } from "@/src/theme";
import { detectCurrency, formatPrice } from "@/src/currency";
import { storage } from "@/src/utils/storage";
import { useToast } from "@/src/Toast";

const CURRENCY_KEY = "delulu.currency.override";
const CURRENCIES = [
  { code: "USD", label: "US Dollar", flag: "🇺🇸" },
  { code: "INR", label: "Indian Rupee", flag: "🇮🇳" },
  { code: "EUR", label: "Euro", flag: "🇪🇺" },
  { code: "GBP", label: "British Pound", flag: "🇬🇧" },
  { code: "AED", label: "UAE Dirham", flag: "🇦🇪" },
  { code: "BRL", label: "Brazilian Real", flag: "🇧🇷" },
  { code: "JPY", label: "Japanese Yen", flag: "🇯🇵" },
  { code: "CAD", label: "Canadian Dollar", flag: "🇨🇦" },
  { code: "AUD", label: "Australian Dollar", flag: "🇦🇺" },
  { code: "SGD", label: "Singapore Dollar", flag: "🇸🇬" },
  { code: "MXN", label: "Mexican Peso", flag: "🇲🇽" },
  { code: "PHP", label: "Philippine Peso", flag: "🇵🇭" },
  { code: "IDR", label: "Indonesian Rupiah", flag: "🇮🇩" },
];

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function Gems() {
  const { user, refresh } = useAuth();
  const { msg } = useLocalSearchParams();
  const toast = useToast();
  const [packs, setPacks] = useState([]);
  const [currency, setCurrency] = useState("USD");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(msg || null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (curCode) => {
    try {
      const { packs } = await gemsApi.packs(curCode);
      setPacks(packs);
    } catch {}
  };

  const changeCurrency = async (code) => {
    Haptics.selectionAsync();
    setCurrency(code);
    setShowCurrencyPicker(false);
    await storage.setItem(CURRENCY_KEY, code);
    await load(code);
    const cur = CURRENCIES.find((c) => c.code === code);
    toast.show(`prices now in ${cur?.flag || ""} ${code}`, { icon: "cash" });
  };

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem(CURRENCY_KEY, null);
      const chosen = saved || detectCurrency();
      setCurrency(chosen);
      await load(chosen);
      setLoading(false);
    })();
  }, []);

  const claim = async () => {
    setBusy(true);
    setNotice(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const res = await gemsApi.daily();
      await refresh();
      setNotice(`+${res.awarded} gems. ${VOICE.streakClaimed}`);
    } catch (e) {
      setNotice(e.detail || "already claimed");
    } finally {
      setBusy(false);
    }
  };

  const buy = async (packId) => {
    setBusy(true);
    setNotice(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const res = await gemsApi.buyMock(packId);
      await refresh();
      setNotice(`+${res.awarded} gems. dev tap — real Play Billing wires later.`);
    } catch (e) {
      setNotice(e.detail || "purchase failed");
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await load(currency); await refresh(); setRefreshing(false); };

  const streak = user?.streak ?? 0;

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
            {DAYS.map((d, i) => {
              const done = i < (streak % 7);
              const today = i === (streak % 7);
              return (
                <View key={i} style={[styles.streakDay, done && { backgroundColor: `${COLORS.romance}22`, borderColor: COLORS.romance }, today && { backgroundColor: COLORS.romance, borderColor: COLORS.romance }]}>
                  <Ionicons name={done || today ? "flame" : "flame-outline"} size={16} color={today ? COLORS.bg : done ? COLORS.romance : COLORS.secondary} />
                  <Text style={[styles.streakDayLabel, today && { color: COLORS.bg }]}>{d}</Text>
                </View>
              );
            })}
          </View>
          <TouchableOpacity
            testID="gems-daily-claim"
            onPress={claim}
            disabled={busy}
            activeOpacity={0.9}
            style={styles.claimBtn}
          >
            <Text style={styles.claimBtnText}>{busy ? "..." : "claim 5 gems"}</Text>
          </TouchableOpacity>
        </View>

        {/* Packs */}
        <View style={{ gap: SPACING.sm }}>
          <View style={styles.packsHead}>
            <Text style={styles.sectionHeader}>gem packs</Text>
            <TouchableOpacity
              testID="currency-picker-btn"
              onPress={() => { Haptics.selectionAsync(); setShowCurrencyPicker(true); }}
              activeOpacity={0.85}
              style={styles.currencyChip}
            >
              <Ionicons name="globe-outline" size={14} color={COLORS.text} />
              <Text style={styles.currencyChipText}>{currency}</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sectionNote}>real Play Billing wires later — these use a mock service.</Text>
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
                  <Text style={styles.packGemNum}>{p.gems}</Text>
                </View>
              </View>
              <View style={styles.priceBtn}>
                <Text style={styles.priceText}>{formatPrice(p.price) || `$${p.usd}`}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.legal}>MOCK PurchaseService · dev buttons for now</Text>
      </ScrollView>

      {/* Currency picker modal */}
      <Modal visible={showCurrencyPicker} transparent animationType="fade" onRequestClose={() => setShowCurrencyPicker(false)}>
        <View style={styles.currBackdrop}>
          <View style={styles.currSheet}>
            <View style={styles.currHandle} />
            <Text style={styles.currTitle}>currency</Text>
            <Text style={styles.currSub}>Play Store handles real IAP per country · this preview lets you switch anytime.</Text>
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: SPACING.md, gap: 6 }}>
              {CURRENCIES.map((c) => {
                const active = currency === c.code;
                return (
                  <TouchableOpacity
                    key={c.code}
                    testID={`currency-option-${c.code}`}
                    onPress={() => changeCurrency(c.code)}
                    activeOpacity={0.85}
                    style={[styles.currRow, active && { borderColor: COLORS.romance, backgroundColor: `${COLORS.romance}18` }]}
                  >
                    <Text style={{ fontSize: 22 }}>{c.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.currCode}>{c.code}</Text>
                      <Text style={styles.currLabel}>{c.label}</Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={COLORS.romance} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowCurrencyPicker(false)} style={styles.currClose}>
              <Text style={{ color: COLORS.text, fontWeight: "800" }}>done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  streakDay: { flex: 1, marginHorizontal: 3, alignItems: "center", padding: 6, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.elevated, gap: 2 },
  streakDayLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: "700" },
  claimBtn: { backgroundColor: COLORS.gemGold, padding: 14, borderRadius: RADIUS.md, alignItems: "center" },
  claimBtnText: { color: COLORS.bg, fontSize: 15, fontWeight: "800" },
  sectionHeader: { color: COLORS.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  sectionNote: { color: COLORS.secondary, fontSize: 11, marginTop: -4 },
  packCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden" },
  packsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  currencyChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  currencyChipText: { color: COLORS.text, fontWeight: "800", fontSize: 12, letterSpacing: 0.5 },
  currBackdrop: { flex: 1, backgroundColor: "rgba(10,10,15,0.85)", justifyContent: "flex-end" },
  currSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: COLORS.border, paddingBottom: SPACING.lg },
  currHandle: { alignSelf: "center", width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 999, marginTop: 8 },
  currTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", paddingHorizontal: SPACING.lg, marginTop: SPACING.md, letterSpacing: -0.5 },
  currSub: { color: COLORS.secondary, fontSize: 12, paddingHorizontal: SPACING.lg, marginTop: 4 },
  currRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.elevated },
  currCode: { color: COLORS.text, fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
  currLabel: { color: COLORS.secondary, fontSize: 12, marginTop: 2 },
  currClose: { alignSelf: "center", paddingHorizontal: 24, paddingVertical: 12, marginTop: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border },
  packIcon: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  packLabel: { color: COLORS.text, fontWeight: "800" },
  packGems: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  gemSmall: { width: 10, height: 10, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  packGemNum: { color: COLORS.gemGold, fontWeight: "800", fontVariant: ["tabular-nums"] },
  priceBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border },
  priceText: { color: COLORS.text, fontWeight: "800" },
  legal: { color: COLORS.muted, fontSize: 11, textAlign: "center" },
});
