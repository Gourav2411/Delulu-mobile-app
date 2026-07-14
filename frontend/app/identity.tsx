// Identity picker — Step A (playerGender) + Step B (romancePreference).
// Used both in the first-time onboarding flow (via ?onboarding=1) and as an
// editable page reachable from Profile > my identity later.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import ReAnimated, { FadeIn } from "react-native-reanimated";
import { identityApi, analyticsApi } from "@/src/api";
import { useAuth } from "@/src/AuthContext";
import { COLORS, RADIUS, SPACING } from "@/src/theme";

// Two-step tiny wizard. Both defaults land on female / men to preserve the
// existing feel of the app before we introduced the picker.
const GENDER_OPTIONS = [
  { id: "female",    label: "Female",     hint: "she / her" },
  { id: "male",      label: "Male",       hint: "he / him"  },
  { id: "nonbinary", label: "Non-binary", hint: "they / them" },
];

// Never label the user with an orientation term. Preference is always phrased
// as who they want to romance.
const ROMANCE_OPTIONS = [
  { id: "men",       label: "Men",         hint: "male leads only" },
  { id: "women",     label: "Women",       hint: "female leads only" },
  { id: "everyone",  label: "Everyone",    hint: "we'll ask per story" },
  { id: "surprise",  label: "Surprise me", hint: "let the stars decide" },
];

export default function IdentityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isOnboarding = String(params.onboarding || "") === "1";
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [playerGender, setPlayerGender] = useState("female");
  const [romancePreference, setRomancePreference] = useState("men");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      // Prefill from user's current identity so this doubles as an edit page.
      try {
        const { identity } = await identityApi.get();
        if (identity) {
          setPlayerGender(identity.playerGender || "female");
          setRomancePreference(identity.romancePreference || "men");
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const done = async () => {
    if (saving) return;
    setSaving(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await identityApi.save({ playerGender, romancePreference });
      await refresh();
      analyticsApi.track("identity_set_client_confirm", { playerGender, romancePreference, isOnboarding });
      router.replace(isOnboarding ? "/(tabs)/home" : "/(tabs)/profile");
    } catch {
      setSaving(false);
    }
  };

  const skip = async () => {
    Haptics.selectionAsync();
    // Skipping still saves defaults so identitySetAt is populated and the router
    // doesn't loop the user back here. Skippable → literally accepts defaults.
    try {
      await identityApi.save({ playerGender: "female", romancePreference: "men" });
      await refresh();
    } catch {}
    router.replace(isOnboarding ? "/(tabs)/home" : "/(tabs)/profile");
  };

  if (!loaded) return <View style={styles.loading}><ActivityIndicator color={COLORS.romance} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <LinearGradient
        colors={[`${COLORS.romance}22`, "transparent"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <View style={styles.headRow}>
          <TouchableOpacity onPress={() => step === 0 ? router.back() : setStep(0)} hitSlop={12} style={styles.iconBtn} testID="identity-back">
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.eyebrow}>{isOnboarding ? "ONE LAST THING" : "MY IDENTITY"}</Text>
            <Text style={styles.title}>{"who's the main character?"}</Text>
          </View>
          {isOnboarding ? (
            <TouchableOpacity onPress={skip} hitSlop={12} testID="identity-skip">
              <Text style={styles.skipText}>skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* progress dots */}
        <View style={styles.dots}>
          {[0, 1].map((i) => <View key={i} style={[styles.dot, step === i && styles.dotActive]} />)}
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.xxl }}>
          {step === 0 ? (
            <ReAnimated.View entering={FadeIn.duration(300)} style={{ gap: SPACING.md }}>
              <View style={styles.stepHead}>
                <Text style={styles.stepLead}>Step A</Text>
                <Text style={styles.stepTitle}>how do you want to appear in stories?</Text>
                <Text style={styles.stepBody}>{"we'll use this to pick pronouns across every scene."}</Text>
              </View>
              {GENDER_OPTIONS.map((opt) => (
                <OptionRow
                  key={opt.id}
                  testID={`identity-gender-${opt.id}`}
                  active={playerGender === opt.id}
                  onPress={() => { Haptics.selectionAsync(); setPlayerGender(opt.id); }}
                  label={opt.label}
                  hint={opt.hint}
                  accent={COLORS.romance}
                />
              ))}
              <TouchableOpacity
                testID="identity-next"
                activeOpacity={0.9}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(1); }}
                style={styles.primaryCta}
              >
                <Text style={styles.primaryCtaText}>next</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.bg} />
              </TouchableOpacity>
            </ReAnimated.View>
          ) : (
            <ReAnimated.View entering={FadeIn.duration(300)} style={{ gap: SPACING.md }}>
              <View style={styles.stepHead}>
                <Text style={styles.stepLead}>Step B</Text>
                <Text style={styles.stepTitle}>who do you want to romance?</Text>
                <Text style={styles.stepBody}>{"we'll cast the love interests to match. you can change this anytime — it only affects stories you haven't started yet."}</Text>
              </View>
              {ROMANCE_OPTIONS.map((opt) => (
                <OptionRow
                  key={opt.id}
                  testID={`identity-romance-${opt.id}`}
                  active={romancePreference === opt.id}
                  onPress={() => { Haptics.selectionAsync(); setRomancePreference(opt.id); }}
                  label={opt.label}
                  hint={opt.hint}
                  accent={COLORS.gemGold}
                />
              ))}
              <TouchableOpacity
                testID="identity-done"
                activeOpacity={0.9}
                onPress={done}
                disabled={saving}
                style={[styles.primaryCta, { backgroundColor: COLORS.gemGold }, saving && { opacity: 0.6 }]}
              >
                <Text style={[styles.primaryCtaText, { color: COLORS.bg }]}>{saving ? "saving..." : (isOnboarding ? "start reading" : "save")}</Text>
                {!saving && <Ionicons name="checkmark" size={18} color={COLORS.bg} />}
              </TouchableOpacity>
            </ReAnimated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function OptionRow({ active, onPress, label, hint, accent, testID }) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      style={[
        styles.optRow,
        active && { borderColor: accent, backgroundColor: `${accent}22`, shadowColor: accent, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.optLabel}>{label}</Text>
        <Text style={styles.optHint}>{hint}</Text>
      </View>
      {active
        ? <Ionicons name="checkmark-circle" size={22} color={accent} />
        : <View style={styles.optDotEmpty} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  headRow: { flexDirection: "row", alignItems: "center", padding: SPACING.md },
  iconBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: COLORS.secondary, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: "900", letterSpacing: -0.3, marginTop: 2 },
  skipText: { color: COLORS.secondary, fontSize: 14 },
  dots: { flexDirection: "row", alignSelf: "center", gap: 8, marginTop: 6, marginBottom: SPACING.sm },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.romance, width: 22 },
  stepHead: { gap: 4, marginBottom: SPACING.sm },
  stepLead: { color: COLORS.gemGold, fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  stepTitle: { color: COLORS.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.6, lineHeight: 28 },
  stepBody: { color: COLORS.secondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  optRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.md, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
  },
  optLabel: { color: COLORS.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  optHint: { color: COLORS.secondary, fontSize: 12, marginTop: 2 },
  optDotEmpty: { width: 22, height: 22, borderRadius: 999, borderWidth: 1.5, borderColor: COLORS.border },
  primaryCta: {
    backgroundColor: COLORS.romance,
    paddingVertical: 16, marginTop: SPACING.md,
    borderRadius: RADIUS.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  primaryCtaText: { color: COLORS.bg, fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
});
