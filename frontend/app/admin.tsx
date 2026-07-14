// Admin panel — validator + preview mode.
// Gated by X-Admin-Pass header (env: ADMIN_PASSWORD). The passphrase is entered
// once and cached in memory only (no storage) so leaving the page requires
// re-entry.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { adminApi } from "@/src/api";
import { COLORS, RADIUS, SPACING } from "@/src/theme";
import { pluralize } from "@/src/utils/format";

export default function AdminHome() {
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stories, setStories] = useState([]);
  const [selected, setSelected] = useState(null); // storyId
  const [details, setDetails] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewParams, setPreviewParams] = useState({ playerGender: "female", chapterIndex: 0, castings: {} });

  const auth = async () => {
    if (!pass) return;
    adminApi.setPass(pass);
    setLoading(true);
    try {
      const { stories } = await adminApi.listStories();
      setStories(stories);
      setAuthed(true);
    } catch (e) {
      Alert.alert("auth failed", e?.detail || "wrong password");
      adminApi.setPass(null);
    }
    setLoading(false);
  };

  const openStory = async (id) => {
    setSelected(id);
    setDetails(null);
    setPreview(null);
    try {
      const d = await adminApi.validateStory(id);
      setDetails(d);
    } catch {}
  };

  const runPreview = async () => {
    if (!selected) return;
    try {
      const res = await adminApi.preview({ storyId: selected, ...previewParams });
      setPreview(res);
    } catch (e) {
      Alert.alert("preview failed", e?.detail || "error");
    }
  };

  if (!authed) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", padding: SPACING.lg }}>
        <View style={styles.gateCard}>
          <Ionicons name="lock-closed" size={28} color={COLORS.gemGold} />
          <Text style={styles.gateTitle}>admin panel</Text>
          <Text style={styles.gateBody}>enter the admin passphrase to continue.</Text>
          <TextInput
            testID="admin-pass"
            value={pass}
            onChangeText={setPass}
            secureTextEntry
            placeholder="passphrase"
            placeholderTextColor={COLORS.secondary}
            style={styles.gateInput}
            autoCapitalize="none"
          />
          <TouchableOpacity testID="admin-auth" onPress={auth} style={styles.gateBtn} activeOpacity={0.9}>
            <Text style={styles.gateBtnText}>{loading ? "checking..." : "unlock"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.gateBack}>back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.head}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headTitle}>admin · validator</Text>
          <View style={styles.iconBtn} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
        {/* Story list */}
        <View style={{ padding: SPACING.lg, gap: 8 }}>
          <Text style={styles.sectionHead}>{pluralize(stories.length, "story", "stories")}</Text>
          {stories.map((s) => {
            const isSelected = selected === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                testID={`admin-story-${s.id}`}
                onPress={() => openStory(s.id)}
                activeOpacity={0.85}
                style={[styles.storyRow, isSelected && { borderColor: COLORS.gemGold }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.storyTitle}>{s.title}</Text>
                  <Text style={styles.storySub}>{s.genre} · ch:{s.chapters} · char:{s.characters} · end:{s.endings}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <View style={[styles.pill, { backgroundColor: s.canGoLive ? COLORS.success : COLORS.danger }]}>
                    <Text style={styles.pillText}>{s.canGoLive ? "OK" : "BLOCK"}</Text>
                  </View>
                  <Text style={styles.storyFindings}>{s.errors}E · {s.warnings}W</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Details */}
        {selected && details && (
          <View style={styles.detailBlock}>
            <Text style={styles.sectionHead}>findings — {selected}</Text>
            {details.errors === 0 && details.warnings === 0 && (
              <Text style={styles.emptyFindings}>✨ clean. no lint findings.</Text>
            )}
            {details.findings.map((f, i) => (
              <View key={`f${i}`} style={[styles.findingRow, { borderLeftColor: f.severity === "error" ? COLORS.danger : COLORS.gemGold }]}>
                <Text style={styles.findingMeta}>
                  {f.severity.toUpperCase()} · {f.code}
                  {f.chapterId ? ` · ${f.chapterId}` : ""}
                  {f.messageId ? `:${f.messageId}` : ""}
                </Text>
                <Text style={styles.findingMsg}>{f.message}</Text>
                {f.snippet && <Text style={styles.findingSnippet}>“…{f.snippet}…”</Text>}
              </View>
            ))}
            {details.variantIssues.length > 0 && (
              <>
                <Text style={[styles.sectionHead, { marginTop: SPACING.lg }]}>variant issues</Text>
                {details.variantIssues.map((v, i) => (
                  <View key={`v${i}`} style={[styles.findingRow, { borderLeftColor: v.severity === "error" ? COLORS.danger : COLORS.gemGold }]}>
                    <Text style={styles.findingMeta}>{v.severity.toUpperCase()} · {v.code} · {v.characterId}</Text>
                    <Text style={styles.findingMsg}>{v.message}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Preview mode */}
            <Text style={[styles.sectionHead, { marginTop: SPACING.lg }]}>preview any identity</Text>
            <View style={styles.previewBar}>
              {["female", "male", "nonbinary"].map((g) => (
                <TouchableOpacity
                  key={g}
                  testID={`admin-preview-gender-${g}`}
                  onPress={() => setPreviewParams((p) => ({ ...p, playerGender: g }))}
                  style={[styles.previewChip, previewParams.playerGender === g && { backgroundColor: COLORS.romance, borderColor: COLORS.romance }]}
                >
                  <Text style={[styles.previewChipText, previewParams.playerGender === g && { color: COLORS.bg }]}>{g}</Text>
                </TouchableOpacity>
              ))}
              <TextInput
                value={String(previewParams.chapterIndex)}
                onChangeText={(v) => setPreviewParams((p) => ({ ...p, chapterIndex: parseInt(v || "0", 10) || 0 }))}
                keyboardType="number-pad"
                style={styles.chapInput}
                placeholder="ch"
                placeholderTextColor={COLORS.secondary}
              />
              <TouchableOpacity testID="admin-preview-run" onPress={runPreview} style={[styles.gateBtn, { paddingHorizontal: 12, marginTop: 0 }]}>
                <Text style={styles.gateBtnText}>render</Text>
              </TouchableOpacity>
            </View>

            {/* Per-character variant casting — surfaces every LI with variants so
                the reviewer can toggle between masc/femme and instantly re-render.
                Without this, preview defaulted to `they/them` fallbacks which
                break subject-verb agreement in prose like "They slides…". */}
            {details.characters?.length > 0 && (
              <View style={styles.variantBar}>
                <Text style={styles.variantBarLabel}>casting</Text>
                {details.characters.filter((c) => c.hasVariants).map((c) => (
                  <View key={c.id} style={styles.variantChipGroup}>
                    <Text style={styles.variantCharName}>{c.name || c.id}</Text>
                    {["masc", "femme"].map((v) => {
                      const active = (previewParams.castings || {})[c.id] === v;
                      return (
                        <TouchableOpacity
                          key={v}
                          testID={`admin-preview-cast-${c.id}-${v}`}
                          onPress={() => setPreviewParams((p) => ({ ...p, castings: { ...(p.castings || {}), [c.id]: v } }))}
                          style={[styles.previewChip, active && { backgroundColor: COLORS.gemGold, borderColor: COLORS.gemGold }]}
                        >
                          <Text style={[styles.previewChipText, active && { color: COLORS.bg, fontWeight: "900" }]}>{v}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}

            {preview && (
              <View style={styles.previewBox}>
                <Text style={styles.previewMeta}>chapter #{preview.chapter?.index || 0}: {preview.chapter?.title || "-"}</Text>
                {(preview.chapter?.messages || []).map((m, i) => (
                  <View key={i} style={styles.previewMsg}>
                    <Text style={styles.previewMsgAuthor}>{m.senderCharacterId}</Text>
                    <Text style={styles.previewMsgText}>{m.text}</Text>
                    {m.choicePoint && (
                      <View style={{ marginTop: 4, gap: 2 }}>
                        {m.choicePoint.options.map((opt, j) => (
                          <Text key={j} style={styles.previewChoice}>· {opt.text}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  gateCard: { padding: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, gap: SPACING.md, alignItems: "center" },
  gateTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  gateBody: { color: COLORS.secondary, textAlign: "center", fontSize: 13 },
  gateInput: { width: "100%", padding: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text, fontSize: 15 },
  gateBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: RADIUS.pill, backgroundColor: COLORS.gemGold, marginTop: 6 },
  gateBtnText: { color: COLORS.bg, fontWeight: "900", letterSpacing: 0.2 },
  gateBack: { color: COLORS.secondary, marginTop: 8 },
  head: { flexDirection: "row", alignItems: "center", padding: SPACING.md },
  iconBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  headTitle: { flex: 1, textAlign: "center", color: COLORS.text, fontWeight: "800", fontSize: 15, letterSpacing: 0.5 },
  sectionHead: { color: COLORS.text, fontSize: 14, fontWeight: "900", letterSpacing: 0.4, marginBottom: 6, textTransform: "uppercase" },
  storyRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  storyTitle: { color: COLORS.text, fontWeight: "800", fontSize: 14 },
  storySub: { color: COLORS.secondary, fontSize: 11, marginTop: 2 },
  storyFindings: { color: COLORS.secondary, fontSize: 10 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm },
  pillText: { color: COLORS.bg, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  detailBlock: { padding: SPACING.lg, gap: 8 },
  emptyFindings: { color: COLORS.success, fontStyle: "italic" },
  findingRow: { padding: 10, borderRadius: RADIUS.sm, backgroundColor: COLORS.surface, borderLeftWidth: 3, borderColor: COLORS.border, gap: 4 },
  findingMeta: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  findingMsg: { color: COLORS.text, fontSize: 13 },
  findingSnippet: { color: COLORS.secondary, fontSize: 11, fontStyle: "italic" },
  previewBar: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" },
  previewChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  previewChipText: { color: COLORS.text, fontWeight: "700", fontSize: 11 },
  chapInput: { width: 44, padding: 6, borderRadius: RADIUS.sm, backgroundColor: COLORS.elevated, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text, textAlign: "center" },
  variantBar: { marginTop: 4, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  variantBarLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },
  variantChipGroup: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  variantCharName: { color: COLORS.text, fontWeight: "800", fontSize: 12, marginRight: 4 },
  previewBox: { padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  previewMeta: { color: COLORS.gemGold, fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  previewMsg: { paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  previewMsgAuthor: { color: COLORS.secondary, fontSize: 10, fontWeight: "900" },
  previewMsgText: { color: COLORS.text, fontSize: 13, marginTop: 2 },
  previewChoice: { color: COLORS.romance, fontSize: 12, fontStyle: "italic" },
});
