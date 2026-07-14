// Tiny formatting helpers shared across the app.
// Delulu voice — nothing here should feel corporate.

/**
 * Standard English pluralization for known units used across the UI.
 * Examples:
 *   pluralize(1, "day")     -> "1 day"
 *   pluralize(2, "day")     -> "2 days"
 *   pluralize(3, "gem")     -> "3 gems"
 *   pluralize(1, "chapter") -> "1 chapter"
 *
 * If `singular` and `plural` differ irregularly, pass both.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  const n = Number(count) || 0;
  const word = n === 1 ? singular : plural ?? singular + "s";
  return `${formatCount(n)} ${word}`;
}

/**
 * Human-friendly formatter for large counts (e.g. read counts, gems, followers).
 * 999    -> "999"
 * 1200   -> "1.2k"
 * 34567  -> "34.5k"
 * 128400 -> "128k"
 * 1_200_000 -> "1.2M"
 */
export function formatCount(n: number): string {
  const v = Math.abs(Number(n) || 0);
  if (v < 1000) return String(v);
  if (v < 10_000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (v < 1_000_000) return Math.round(v / 1000) + "k";
  return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

/**
 * Threshold below which read counts should be hidden entirely (never seed rooky
 * stories with a tiny "42 reads" badge — bad optics).
 */
export const READ_COUNT_HIDE_BELOW = 1000;

/**
 * Convenience: returns a formatted "X.Yk reads" string or null if the count
 * is below the display threshold.
 */
export function formatReadCount(n: number): string | null {
  const v = Number(n) || 0;
  if (v < READ_COUNT_HIDE_BELOW) return null;
  return `${formatCount(v)} reads`;
}
