// Auth screen — email + Emergent Google.
import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/src/AuthContext";
import { COLORS, RADIUS, SPACING } from "@/src/theme";

export default function Auth() {
  const { signup, login, loginWithEmergent, user } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  // Deep-link handler for Google auth session_id return
  useEffect(() => {
    const handle = async (url) => {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        const sid = parsed.queryParams?.session_id || (parsed.hostname?.includes("session_id") ? null : null);
        // parse fragment ourselves
        const idx = url.indexOf("session_id=");
        const token = idx >= 0 ? url.slice(idx + "session_id=".length).split(/[&#]/)[0] : sid;
        if (token) {
          setBusy(true);
          try {
            await loginWithEmergent(token);
            router.replace("/");
          } catch (e) {
            setErr(e.detail || "sign-in fumbled");
          } finally {
            setBusy(false);
          }
        }
      } catch {}
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
  }, [loginWithEmergent, router]);

  const submit = async () => {
    setErr(null);
    setBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (mode === "signup") {
        await signup(email.trim(), password, name.trim() || undefined);
      } else {
        await login(email.trim(), password);
      }
      router.replace("/");
    } catch (e) {
      setErr(e.detail || e.message || "something went sideways");
    } finally {
      setBusy(false);
    }
  };

  const googleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const redirect = Linking.createURL("");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
      if (result.type === "success" && result.url) {
        const idx = result.url.indexOf("session_id=");
        if (idx >= 0) {
          const token = result.url.slice(idx + "session_id=".length).split(/[&#]/)[0];
          setBusy(true);
          await loginWithEmergent(token);
          router.replace("/");
        }
      }
    } catch (e) {
      setErr("google sign-in ghosted us");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={["#1a0a15", "#0A0A0F"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.brand}>
              <Text style={styles.wordmark}>delulu</Text>
              <View style={styles.gemDot} />
            </View>
            <Text style={styles.tagline}>chat stories. your choices. endless possibilities.</Text>

            {/* Google */}
            <TouchableOpacity testID="auth-google" onPress={googleSignIn} activeOpacity={0.85} style={styles.socialBtn} disabled={busy}>
              <Ionicons name="logo-google" size={18} color={COLORS.text} />
              <Text style={styles.socialText}>continue with google</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity onPress={() => setMode("login")} style={[styles.tab, mode === "login" && styles.tabActive]}>
                <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>log in</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode("signup")} style={[styles.tab, mode === "signup" && styles.tabActive]}>
                <Text style={[styles.tabText, mode === "signup" && styles.tabTextActive]}>sign up</Text>
              </TouchableOpacity>
            </View>

            {mode === "signup" && (
              <TextInput
                testID="auth-name"
                placeholder="your name (or made-up one, we get it)"
                placeholderTextColor={COLORS.muted}
                value={name}
                onChangeText={setName}
                style={styles.input}
                autoCapitalize="words"
              />
            )}
            <TextInput
              testID="auth-email"
              placeholder="email"
              placeholderTextColor={COLORS.muted}
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
            <TextInput
              testID="auth-password"
              placeholder="password"
              placeholderTextColor={COLORS.muted}
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry
            />

            {err && <Text testID="auth-error" style={styles.err}>{err}</Text>}

            <TouchableOpacity
              testID="auth-submit"
              onPress={submit}
              activeOpacity={0.9}
              style={styles.cta}
              disabled={busy || !email || !password}
            >
              {busy ? (
                <ActivityIndicator color={COLORS.bg} />
              ) : (
                <>
                  <Text style={styles.ctaText}>{mode === "signup" ? "create account" : "log in"}</Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.bg} />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.legal}>
              by continuing you agree to our <Text style={{ color: COLORS.text }}>terms</Text> and{" "}
              <Text style={{ color: COLORS.text }}>privacy</Text> policy.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { padding: SPACING.lg, paddingTop: SPACING.xxl, gap: SPACING.md },
  brand: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center" },
  wordmark: { fontSize: 36, fontWeight: "900", color: COLORS.text, letterSpacing: -1.5 },
  gemDot: { width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  tagline: { color: COLORS.secondary, textAlign: "center", marginBottom: SPACING.lg, fontSize: 14 },
  socialBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1,
    padding: 14, borderRadius: RADIUS.md,
  },
  socialText: { color: COLORS.text, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.secondary, fontSize: 12 },
  tabs: { flexDirection: "row", backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 4, borderWidth: 1, borderColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.sm, alignItems: "center" },
  tabActive: { backgroundColor: COLORS.elevated },
  tabText: { color: COLORS.secondary, fontWeight: "600" },
  tabTextActive: { color: COLORS.text },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: 14, color: COLORS.text, fontSize: 16,
  },
  err: { color: COLORS.danger, fontSize: 13 },
  cta: {
    backgroundColor: COLORS.romance, padding: 16, borderRadius: RADIUS.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: SPACING.sm,
  },
  ctaText: { color: COLORS.bg, fontSize: 16, fontWeight: "800" },
  legal: { color: COLORS.muted, fontSize: 11, textAlign: "center", marginTop: SPACING.sm },
});
