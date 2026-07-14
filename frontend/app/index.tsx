// Router — decides landing based on auth state + avatar completeness.
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/AuthContext";
import { COLORS } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/onboarding");
      return;
    }
    const hasLayered = user.avatarConfig && Object.keys(user.avatarConfig.layers || {}).length >= 3;
    const hasPreset = !!user.avatarConfig?.imageUrl || !!user.avatarConfig?.presetId;
    if (!hasLayered && !hasPreset) {
      router.replace("/avatar-builder");
      return;
    }
    // Phase B: identity picker sits AFTER the avatar step. Users who never
    // saved their identity are routed there once before hitting home.
    if (!user.identitySetAt) {
      router.replace("/identity?onboarding=1");
      return;
    }
    router.replace("/(tabs)/home");
  }, [loading, user, router]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={COLORS.romance} size="large" />
    </View>
  );
}
