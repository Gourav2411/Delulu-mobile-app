// Currency helpers — detect device locale via expo-localization,
// pick a currency the backend supports, and format prices consistently.
import * as Localization from "expo-localization";

const BACKEND_SUPPORTED = new Set([
  "USD", "INR", "EUR", "GBP", "AED", "BRL", "JPY", "CAD", "AUD", "SGD", "MXN", "PHP", "IDR",
]);

// Rough country → currency mapping for currencies our backend prices in
const COUNTRY_TO_CUR = {
  US: "USD", GB: "GBP", IN: "INR", AE: "AED", SA: "AED",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", IE: "EUR", PT: "EUR", GR: "EUR", FI: "EUR",
  BR: "BRL", JP: "JPY", CA: "CAD", AU: "AUD", SG: "SGD", MX: "MXN", PH: "PHP", ID: "IDR",
};

/**
 * Determine best-guess currency code for the current device.
 * Falls back to USD.
 */
export function detectCurrency() {
  try {
    const locales = Localization.getLocales?.() || [];
    // First try the currencyCode reported by the OS
    for (const l of locales) {
      if (l.currencyCode && BACKEND_SUPPORTED.has(l.currencyCode.toUpperCase())) {
        return l.currencyCode.toUpperCase();
      }
    }
    // Fall back to region mapping
    for (const l of locales) {
      const cur = COUNTRY_TO_CUR[(l.regionCode || "").toUpperCase()];
      if (cur && BACKEND_SUPPORTED.has(cur)) return cur;
    }
  } catch {}
  return "USD";
}

/** Format an amount using the currency's symbol from the backend price payload. */
export function formatPrice(price) {
  if (!price) return "";
  const { amount, symbol, currency } = price;
  // Whole-number currencies (JPY / INR / IDR / PHP) don't need decimals
  const noDecimals = ["JPY", "INR", "IDR", "PHP", "MXN"].includes(currency);
  const num = noDecimals ? Math.round(amount).toLocaleString() : amount.toFixed(2);
  // Attach symbol on the correct side
  const suffixSymbols = new Set([]);
  if (suffixSymbols.has(currency)) return `${num} ${symbol}`;
  return `${symbol}${num}`;
}
