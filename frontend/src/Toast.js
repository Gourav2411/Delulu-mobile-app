// Lightweight toast system — mount ToastProvider at root, call useToast().show(msg).
// Slides in from top-safe-area, dismisses after 2s.
import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SPACING } from "@/src/theme";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(-20)).current;
  const timer = useRef(null);

  const show = useCallback((text, opts = {}) => {
    setMsg({ text, icon: opts.icon || "sparkles" });
    if (timer.current) clearTimeout(timer.current);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }),
    ]).start();
    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(translate, { toValue: -12, duration: 260, useNativeDriver: true }),
      ]).start(() => setMsg(null));
    }, opts.duration || 2000);
  }, [opacity, translate]);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {msg && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            { top: insets.top + 8, opacity, transform: [{ translateY: translate }] },
          ]}
        >
          <View style={styles.pill} testID="toast">
            <Ionicons name={msg.icon} size={14} color={COLORS.gemGold} />
            <Text style={styles.text} numberOfLines={2}>{msg.text}</Text>
          </View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) return { show: () => {} }; // no-op if provider missing
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 9999, elevation: 20 },
  pill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    backgroundColor: COLORS.elevated, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.gemGold,
    shadowColor: COLORS.gemGold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10,
    maxWidth: "90%",
  },
  text: { color: COLORS.text, fontSize: 13, fontWeight: "700", letterSpacing: -0.2 },
});
