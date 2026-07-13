// Avatar layer compositor — renders the layered stack as pure vector shapes so it
// works out of the box with our colour-encoded catalog. Real PNGs can drop in later
// without changing this component (just swap the layer render to <Image />).
import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { COLORS } from "@/src/theme";

// A layer maps to a very simple stylised shape by slot. This is intentionally
// stylised (not photoreal) — comic silhouette.
function Layer({ slot, color, expression = "neutral" }) {
  if (slot === "body") {
    return (
      <View style={[styles.abs, { alignItems: "center", justifyContent: "flex-end", pointerEvents: "none" }]}>
        {/* shoulders */}
        <View style={{ width: "76%", height: "40%", borderTopLeftRadius: 120, borderTopRightRadius: 120, backgroundColor: color }} />
      </View>
    );
  }
  if (slot === "head") {
    return (
      <View style={[styles.abs, { alignItems: "center", pointerEvents: "none" }]}>
        <View style={{ marginTop: "12%", width: "48%", aspectRatio: 0.82, borderRadius: 999, backgroundColor: color }} />
      </View>
    );
  }
  if (slot === "eyes") {
    // draw two dots on the head area
    const isShocked = expression === "shocked";
    const isHappy = expression === "happy";
    return (
      <View style={[styles.abs, { alignItems: "center", pointerEvents: "none" }]}>
        <View style={{ marginTop: "34%", flexDirection: "row", gap: 22 }}>
          <View style={{ width: isShocked ? 12 : 10, height: isHappy ? 4 : (isShocked ? 12 : 10), borderRadius: 8, backgroundColor: color }} />
          <View style={{ width: isShocked ? 12 : 10, height: isHappy ? 4 : (isShocked ? 12 : 10), borderRadius: 8, backgroundColor: color }} />
        </View>
      </View>
    );
  }
  if (slot === "mouth") {
    return (
      <View style={[styles.abs, { alignItems: "center", pointerEvents: "none" }]}>
        <View style={{ marginTop: "44%", width: 22, height: 3, borderRadius: 2, backgroundColor: color }} />
      </View>
    );
  }
  if (slot === "hair") {
    return (
      <View style={[styles.abs, { alignItems: "center", pointerEvents: "none" }]}>
        {/* hair cap over head */}
        <View style={{ marginTop: "10%", width: "56%", aspectRatio: 1.3, borderTopLeftRadius: 999, borderTopRightRadius: 999, backgroundColor: color, opacity: 0.98 }} />
        {/* fringe */}
        <View style={{ marginTop: -18, width: "48%", height: 22, borderBottomLeftRadius: 999, borderBottomRightRadius: 999, backgroundColor: color }} />
      </View>
    );
  }
  if (slot === "outfit") {
    return (
      <View style={[styles.abs, { alignItems: "center", justifyContent: "flex-end", pointerEvents: "none" }]}>
        <View style={{ width: "72%", height: "32%", borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: color }} />
        {/* collar accent */}
        <View style={{ position: "absolute", bottom: "28%", width: 14, height: 14, borderRadius: 3, backgroundColor: COLORS.text, opacity: 0.15, transform: [{ rotate: "45deg" }] }} />
      </View>
    );
  }
  if (slot === "accessory") {
    return (
      <View style={[styles.abs, { alignItems: "center", pointerEvents: "none" }]}>
        {/* chain / glasses shown as a bar */}
        <View style={{ marginTop: "38%", width: 46, height: 4, borderRadius: 2, backgroundColor: color }} />
      </View>
    );
  }
  return null;
}

/**
 * Compose an avatar from a layers map { slot: assetId } and a catalog list.
 * The catalog entry has { id, slot, color, zIndex }.
 * Also renders a head layer using the body colour + optional expression.
 *
 * If `presetImageUrl` is provided (preset avatar chosen instead of layered),
 * render the portrait PNG directly. This is the "quick pick" hero path.
 */
export function AvatarPreview({ layers, catalog, expression = "neutral", size = 240, showHalo = false, presetImageUrl }) {
  if (presetImageUrl) {
    return (
      <View style={{ width: size, aspectRatio: 0.82, position: "relative" }} testID="avatar-preview">
        {showHalo && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute", top: "12%", left: "8%", right: "8%",
              aspectRatio: 1, borderRadius: 999,
              backgroundColor: COLORS.romance, opacity: 0.22,
              transform: [{ scale: 1.15 }],
            }}
          />
        )}
        <Image
          source={{ uri: presetImageUrl }}
          style={{ width: "100%", height: "100%", borderRadius: 12 }}
          resizeMode="cover"
        />
      </View>
    );
  }

  const bg = "transparent";
  const bodyAsset = catalog.find((c) => c.id === layers?.body);
  const skinColor = bodyAsset?.color || "#D9A277";

  // We render slots in fixed order matching the spec.
  const order = [
    { slot: "body",      asset: bodyAsset },
    { slot: "head",      asset: { color: skinColor } },
    { slot: "hair",      asset: catalog.find((c) => c.id === layers?.hair) },
    { slot: "eyes",      asset: catalog.find((c) => c.id === layers?.eyes) },
    { slot: "mouth",     asset: catalog.find((c) => c.id === layers?.mouth) },
    { slot: "outfit",    asset: catalog.find((c) => c.id === layers?.outfit) },
    { slot: "accessory", asset: catalog.find((c) => c.id === layers?.accessory) },
  ];

  return (
    <View style={{ width: size, aspectRatio: 0.82, backgroundColor: bg }} testID="avatar-preview">
      {showHalo && (
        <View
          style={{
            position: "absolute",
            top: "18%",
            left: "12%",
            right: "12%",
            aspectRatio: 1,
            borderRadius: 999,
            backgroundColor: COLORS.romance,
            opacity: 0.18,
            transform: [{ scale: 1.2 }],
            pointerEvents: "none",
          }}
        />
      )}
      {order.map(({ slot, asset }) => asset ? (
        <Layer key={slot} slot={slot} color={asset.color || "#F5F5F7"} expression={expression} />
      ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
});
