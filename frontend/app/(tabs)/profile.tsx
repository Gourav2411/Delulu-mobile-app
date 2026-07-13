// Profile — avatar showcase + stats + endings + logout
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { AvatarPreview } from "@/src/AvatarPreview";
import { avatarApi, storyApi } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { COLORS, RADIUS, SPACING } from "@/src/theme";

export default function Profile() {
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, s] = await Promise.all([avatarApi.catalog(), storyApi.list()]);
        setCatalog(c.items);
        setStories(s.stories);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const progress = user?.progress || {};
    const choicesMade = Object.values(progress).reduce((n, p) => n + (p?.choicesMade?.length || 0), 0);
    return {
      storiesRead: Object.values(progress).filter((p) => (p?.chapterIndex || 0) >= 3).length,
      choicesMade,
      gemsSpent: Math.max(0, 100 + choicesMade * 5 - (user?.gemBalance || 0)),
    };
  }, [user]);

  const endings = useMemo(() => {
    if (!user?.ownedEndings || !stories.length) return [];
    return user.ownedEndings.map((key) => {
      const [storyId, endingId] = key.split(":");
      const story = stories.find((s) => s.id === storyId);
      const ending = story?.endings?.find((e) => e.id === endingId);
      return story && ending ? { storyId, endingId, name: ending.name, rarity: ending.rarityPercent, cover: story.coverUrl } : null;
    }).filter(Boolean);
  }, [user, stories]);

  if (loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.romance} /></View>;

  const displayName = user?.avatarConfig?.displayName || user?.displayName || "MC";

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <SafeAreaView edges={["top"]}>
          <View style={styles.top}>
            <Text style={styles.title}>Profile</Text>
            <TouchableOpacity testID="profile-settings" onPress={() => {}}>
              <Ionicons name="settings-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Avatar showcase */}
        <View style={styles.showcase}>
          <LinearGradient colors={[`${COLORS.romance}44`, "transparent"]} style={StyleSheet.absoluteFill} />
          <View style={styles.avatarBox} testID="profile-avatar">
            <AvatarPreview
              layers={user?.avatarConfig?.layers || {}}
              catalog={catalog}
              presetImageUrl={user?.avatarConfig?.imageUrl}
              size={180}
              showHalo
            />
          </View>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.badge}>
            <Ionicons name="book" size={12} color={COLORS.romance} />
            <Text style={styles.badgeText}>Lore Seeker</Text>
          </View>
          <TouchableOpacity
            testID="profile-edit-avatar"
            onPress={() => { Haptics.selectionAsync(); router.push("/avatar-builder"); }}
            style={styles.editAvatar}
          >
            <Ionicons name="create-outline" size={14} color={COLORS.text} />
            <Text style={styles.editAvatarText}>edit look</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard label="Stories Read" value={stats.storiesRead} />
          <StatCard label="Choices Made" value={stats.choicesMade} />
          <StatCard label="Gems Spent" value={stats.gemsSpent} accent />
        </View>

        {/* Streak */}
        <View style={styles.section}>
          <View style={styles.streakCard}>
            <Ionicons name="flame" size={28} color={COLORS.gemGold} />
            <View style={{ flex: 1 }}>
              <Text style={styles.streakNum}>{user?.streak ?? 0} days</Text>
              <Text style={styles.streakCap}>current streak · keep it going</Text>
            </View>
          </View>
        </View>

        {/* Endings collected */}
        {endings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>endings collected</Text>
              <Text style={styles.sectionLink}>{endings.length} unlocked</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {endings.map((e) => (
                <View key={`${e.storyId}:${e.endingId}`} style={styles.endingChip}>
                  <View style={styles.endingCover}>
                    <View style={[styles.rarityDot, { backgroundColor: rarityColor(e.rarity) }]} />
                  </View>
                  <Text style={styles.endingLabel} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.endingPct}>{e.rarity}%</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Row items */}
        <View style={styles.section}>
          <RowItem icon="trophy" label="achievements" />
          <RowItem icon="bookmark" label="bookmarks" />
          <RowItem icon="settings" label="settings" />
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity
            testID="profile-logout"
            onPress={async () => { await logout(); router.replace("/onboarding"); }}
            style={styles.logoutBtn}
          >
            <Text style={styles.logoutText}>log out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statVal, accent && { color: COLORS.gemGold }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RowItem({ icon, label }) {
  return (
    <TouchableOpacity style={styles.rowItem} activeOpacity={0.8}>
      <Ionicons name={icon} size={18} color={COLORS.secondary} />
      <Text style={styles.rowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
    </TouchableOpacity>
  );
}

function rarityColor(pct) {
  if (pct <= 5) return COLORS.gemGold;
  if (pct <= 20) return COLORS.scifi;
  return COLORS.success;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.lg, paddingBottom: SPACING.sm },
  title: { color: COLORS.text, fontSize: 26, fontWeight: "900", letterSpacing: -0.6 },
  showcase: { alignItems: "center", paddingVertical: SPACING.lg, position: "relative" },
  avatarBox: { width: 190, height: 220, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  name: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: SPACING.md, letterSpacing: -0.5 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill, backgroundColor: `${COLORS.romance}22`, borderWidth: 1, borderColor: COLORS.romance },
  badgeText: { color: COLORS.romance, fontSize: 11, fontWeight: "800" },
  editAvatar: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, marginTop: 10 },
  editAvatarText: { color: COLORS.text, fontSize: 12, fontWeight: "600" },
  statsRow: { flexDirection: "row", padding: SPACING.lg, gap: SPACING.sm },
  statCard: { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: "center" },
  statVal: { color: COLORS.text, fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] },
  statLabel: { color: COLORS.secondary, fontSize: 11, marginTop: 2 },
  section: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, gap: SPACING.sm },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  sectionLink: { color: COLORS.secondary, fontSize: 12 },
  streakCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  streakNum: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  streakCap: { color: COLORS.secondary, fontSize: 12, marginTop: 2 },
  endingChip: { width: 100, gap: 4, alignItems: "center" },
  endingCover: { width: 80, height: 100, borderRadius: RADIUS.sm, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, alignItems: "flex-end", padding: 6 },
  rarityDot: { width: 10, height: 10, borderRadius: 999 },
  endingLabel: { color: COLORS.text, fontSize: 11, fontWeight: "700" },
  endingPct: { color: COLORS.secondary, fontSize: 10 },
  rowItem: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  rowText: { flex: 1, color: COLORS.text, fontWeight: "600" },
  logoutBtn: { padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.danger, alignItems: "center" },
  logoutText: { color: COLORS.danger, fontWeight: "700" },
});
