// Delulu theme system — dark mode only, exact tokens from the design brief.
// Use TOKEN references, never hardcode colors in screens.

export const COLORS = {
  bg: "#0A0A0F",
  surface: "#16161F",
  elevated: "#1E1E2A",
  glass: "rgba(22, 22, 31, 0.72)",
  text: "#F5F5F7",
  secondary: "#9B9BA8",
  muted: "#6E6E7A",
  border: "#2A2A38",
  gemGold: "#FFC94A",
  success: "#4ADE80",
  danger: "#E5273E",
  romance: "#FF3E8A",
  thriller: "#3E9BFF",
  horror: "#E5273E",
  scifi: "#7C5CFF",
  drama: "#FF8A3E",
};

export const GENRE_ACCENT = {
  romance: COLORS.romance,
  thriller: COLORS.thriller,
  horror: COLORS.horror,
  scifi: COLORS.scifi,
  drama: COLORS.drama,
};

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

// System font fallbacks — actual Space Grotesk / Inter would need a font file bundle.
// We use fontWeight + letterSpacing to approximate the display feel.
export const FONTS = {
  display: undefined, // system, override with weight + letterSpacing
  body: undefined,
};

export const TYPO = {
  display: {
    fontWeight: "800",
    letterSpacing: -0.5,
    color: COLORS.text,
  },
  h1: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8, color: COLORS.text },
  h2: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, color: COLORS.text },
  h3: { fontSize: 18, fontWeight: "700", letterSpacing: -0.2, color: COLORS.text },
  body: { fontSize: 16, lineHeight: 24, color: COLORS.text },
  bodySm: { fontSize: 14, lineHeight: 20, color: COLORS.text },
  caption: { fontSize: 12, letterSpacing: 0.5, color: COLORS.secondary, textTransform: "uppercase" },
  num: { fontVariant: ["tabular-nums"], color: COLORS.text },
};

// Brand voice copy
export const VOICE = {
  loading: "manifesting...",
  emptyLibrary: "it's giving... nothing. let's find you a story.",
  emptyCloset: "you can't romance the lead in THAT fit",
  timer: "patience isn't very delulu of you...",
  timerSkip: "15 gems says otherwise",
  wifiError: "bestie the wifi is acting up, give it a sec",
  notEnoughGems: "gems say no bestie. top up?",
  endingRareTemplate: (pct) => `only ${pct}% of readers were delulu enough to get this ending`,
  streakClaimed: "streak secured. delulu certified.",
  needAvatar: "before we spiral together, you need a face",
};
