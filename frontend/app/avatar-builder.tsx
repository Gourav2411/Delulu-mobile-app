// Avatar builder — layered live preview + category tabs + item grid + randomize + save.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Modal } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { AvatarPreview } from "@/src/AvatarPreview";
import { avatarApi } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { COLORS, GENRE_ACCENT, RADIUS, SPACING, VOICE } from "@/src/theme";

const SLOTS = [
  { id: "body",      label: "Body",     icon: "person" },
  { id: "hair",      label: "Hair",     icon: "cut" },
  { id: "eyes",      label: "Eyes",     icon: "eye" },
  { id: "outfit",    label: "Fit",      icon: "shirt" },
  { id: "accessory", label: "Extras",   icon: "sparkles" },
];

const RARITY_META = {
  common: { color: COLORS.secondary, label: "COMMON" },
  rare:   { color: COLORS.thriller,  label: "RARE" },
  iconic: { color: COLORS.gemGold,   label: "ICONIC" },
};

export default function AvatarBuilder() {
  const router = useRouter();
  const { user, refresh } = useAuth();

  const [catalog, setCatalog] = useState([]);
  const [layers, setLayers] = useState({});
  const [displayName, setDisplayName] = useState("");
  const [activeSlot, setActiveSlot] = useState("body");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { items } = await avatarApi.catalog();
        setCatalog(items);
        // Seed initial layers with first item per slot
        const initial = {};
        const slots = ["body", "hair", "eyes", "mouth", "outfit"];
        for (const s of slots) {
          const first = items.find((i) => i.slot === s && (i.gemCost === 0 || user?.ownedItems?.includes(i.id)));
          if (first) initial[s] = first.id;
        }
        // If user has an existing avatar, use it
        if (user?.avatarConfig?.layers && Object.keys(user.avatarConfig.layers).length) {
          setLayers({ ...initial, ...user.avatarConfig.layers });
        } else {
          setLayers(initial);
        }
        setDisplayName(user?.avatarConfig?.displayName || user?.displayName || "");
      } catch (e) {
        setErrMsg(VOICE.wifiError);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const bySlot = useMemo(() => {
    const map = {};
    for (const c of catalog) {
      map[c.slot] = map[c.slot] || [];
      map[c.slot].push(c);
    }
    return map;
  }, [catalog]);

  const ownsOrFree = (item) => item.gemCost === 0 || user?.ownedItems?.includes(item.id);

  const equip = (item) => {
    if (item.storyLockId && !user?.ownedEndings?.includes(item.storyLockId)) {
      setErrMsg("finish the rare ending to unlock this fit");
      return;
    }
    if (!ownsOrFree(item)) {
      // buy first
      buy(item);
      return;
    }
    Haptics.selectionAsync();
    setLayers((prev) => ({ ...prev, [item.slot]: item.id }));
  };

  const buy = async (item) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await avatarApi.buyItem(item.id);
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setLayers((prev) => ({ ...prev, [item.slot]: item.id }));
      setErrMsg(null);
    } catch (e) {
      setErrMsg(e.detail || VOICE.notEnoughGems);
    }
  };

  const randomize = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = { ...layers };
    for (const s of ["body", "hair", "eyes", "outfit"]) {
      const options = (bySlot[s] || []).filter(ownsOrFree);
      if (options.length) {
        next[s] = options[Math.floor(Math.random() * options.length)].id;
      }
    }
    setLayers(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      await avatarApi.setConfig(layers, displayName || null);
      await refresh();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/home");
    } catch (e) {
      setErrMsg(e.detail || "save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.romance} size="large" />
        <Text style={styles.loadingText}>{VOICE.loading}</Text>
      </View>
    );
  }

  const activeItems = bySlot[activeSlot] || [];

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#1a0a15", "#0A0A0F"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        {/* header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>build your MC</Text>
          <View style={styles.gemChip}>
            <View style={styles.gem} />
            <Text style={styles.gemText}>{user?.gemBalance ?? 0}</Text>
          </View>
        </View>

        {/* Preview area with halftone accent */}
        <View style={styles.previewWrap}>
          <View style={styles.halftone} />
          <AvatarPreview layers={layers} catalog={catalog} size={260} showHalo />
          <TouchableOpacity
            testID="avatar-randomize"
            onPress={randomize}
            style={styles.diceBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="dice" size={20} color={COLORS.bg} />
          </TouchableOpacity>
        </View>

        {/* Slot tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.slotRow}
        >
          {SLOTS.map((s) => {
            const active = activeSlot === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                testID={`avatar-slot-${s.id}`}
                onPress={() => { Haptics.selectionAsync(); setActiveSlot(s.id); }}
                style={[styles.slotChip, active && styles.slotChipActive]}
                activeOpacity={0.85}
              >
                <Ionicons name={s.icon} size={14} color={active ? COLORS.bg : COLORS.secondary} />
                <Text style={[styles.slotText, active && styles.slotTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {errMsg && <Text style={styles.errMsg}>{errMsg}</Text>}

        {/* Item grid */}
        <ScrollView contentContainerStyle={styles.grid}>
          {activeItems.map((it) => {
            const owned = ownsOrFree(it);
            const equipped = layers[it.slot] === it.id;
            const locked = it.storyLockId && !user?.ownedEndings?.includes(it.storyLockId);
            const rarity = RARITY_META[it.rarity] || RARITY_META.common;
            return (
              <TouchableOpacity
                key={it.id}
                testID={`avatar-item-${it.id}`}
                activeOpacity={0.85}
                onPress={() => equip(it)}
                style={[
                  styles.itemCard,
                  equipped && { borderColor: COLORS.romance, borderWidth: 2 },
                  locked && { opacity: 0.5 },
                ]}
              >
                <View style={[styles.itemSwatch, { backgroundColor: it.color }]} />
                <View style={styles.itemFoot}>
                  <Text style={styles.itemLabel} numberOfLines={1}>{it.label}</Text>
                  {locked ? (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={11} color={COLORS.gemGold} />
                      <Text style={styles.lockText}>rare</Text>
                    </View>
                  ) : owned ? (
                    <Text style={[styles.ownedText, equipped && { color: COLORS.romance }]}>
                      {equipped ? "EQUIPPED" : "OWNED"}
                    </Text>
                  ) : (
                    <View style={styles.priceRow}>
                      <View style={styles.gemDot} />
                      <Text style={styles.priceText}>{it.gemCost}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.rarityBadge, { backgroundColor: `${rarity.color}22`, borderColor: rarity.color }]}>
                  <Text style={[styles.rarityText, { color: rarity.color }]}>{rarity.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Save button */}
        <View style={styles.footer}>
          <TouchableOpacity
            testID="avatar-save"
            onPress={() => setShowNameModal(true)}
            style={styles.saveBtn}
            activeOpacity={0.9}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.bg} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color={COLORS.bg} />
                <Text style={styles.saveText}>save look</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Name character modal */}
      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>name your MC</Text>
            <Text style={styles.modalSub}>this is what NPCs call you.</Text>
            <TextInput
              testID="avatar-name-input"
              placeholder="e.g., Rae"
              placeholderTextColor={COLORS.muted}
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.nameInput}
              autoFocus
              maxLength={24}
            />
            <View style={{ flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md }}>
              <TouchableOpacity onPress={() => setShowNameModal(false)} style={[styles.modalBtn, { backgroundColor: COLORS.elevated }]}>
                <Text style={{ color: COLORS.text, fontWeight: "700" }}>back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="avatar-name-confirm"
                onPress={() => { setShowNameModal(false); save(); }}
                style={[styles.modalBtn, { backgroundColor: COLORS.romance }]}
                disabled={!displayName.trim()}
              >
                <Text style={{ color: COLORS.bg, fontWeight: "800" }}>lock in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", gap: SPACING.md },
  loadingText: { color: COLORS.secondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  headerTitle: { color: COLORS.text, fontWeight: "800", fontSize: 16 },
  gemChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill },
  gem: { width: 10, height: 10, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  gemText: { color: COLORS.gemGold, fontWeight: "800", fontVariant: ["tabular-nums"] },
  previewWrap: { alignItems: "center", justifyContent: "center", paddingVertical: SPACING.md, marginHorizontal: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, position: "relative", overflow: "hidden" },
  halftone: { position: "absolute", top: -60, right: -40, width: 220, height: 220, borderRadius: 999, backgroundColor: COLORS.romance, opacity: 0.14 },
  diceBtn: { position: "absolute", right: 16, bottom: 16, width: 44, height: 44, borderRadius: 999, backgroundColor: COLORS.gemGold, alignItems: "center", justifyContent: "center" },
  slotRow: { paddingHorizontal: SPACING.lg, gap: 8, paddingVertical: SPACING.md, alignItems: "center" },
  slotChip: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, height: 36 },
  slotChipActive: { backgroundColor: COLORS.romance, borderColor: COLORS.romance },
  slotText: { color: COLORS.secondary, fontSize: 13, fontWeight: "600" },
  slotTextActive: { color: COLORS.bg },
  errMsg: { color: COLORS.danger, fontSize: 13, paddingHorizontal: SPACING.lg, marginBottom: 4 },
  grid: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl, flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  itemCard: { width: "31%", aspectRatio: 0.9, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, overflow: "hidden", position: "relative" },
  itemSwatch: { flex: 1, alignItems: "center", justifyContent: "center" },
  itemFoot: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: COLORS.elevated, gap: 2 },
  itemLabel: { color: COLORS.text, fontSize: 11, fontWeight: "700" },
  ownedText: { color: COLORS.secondary, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  gemDot: { width: 8, height: 8, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  priceText: { color: COLORS.gemGold, fontSize: 12, fontWeight: "800" },
  lockBadge: { flexDirection: "row", alignItems: "center", gap: 4 },
  lockText: { color: COLORS.gemGold, fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  rarityBadge: { position: "absolute", top: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.sm, borderWidth: 1 },
  rarityText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  footer: { padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveBtn: { backgroundColor: COLORS.romance, padding: 16, borderRadius: RADIUS.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveText: { color: COLORS.bg, fontSize: 16, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(10,10,15,0.85)", alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  modalSheet: { width: "100%", maxWidth: 400, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  modalSub: { color: COLORS.secondary, marginTop: 4, marginBottom: SPACING.md },
  nameInput: { backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 14, color: COLORS.text, fontSize: 16 },
  modalBtn: { flex: 1, padding: 14, borderRadius: RADIUS.pill, alignItems: "center" },
});
