// Delulu client-side token resolver — mirrors backend/token_engine.py.
// Kept intentionally small so it can be called on every message render without cost.

const PRONOUNS = {
  female:    { they: "she",  them: "her",  their: "her",   theirs: "hers",   themself: "herself",  is: "is",  was: "was"  },
  male:      { they: "he",   them: "him",  their: "his",   theirs: "his",    themself: "himself",  is: "is",  was: "was"  },
  nonbinary: { they: "they", them: "them", their: "their", theirs: "theirs", themself: "themself", is: "are", was: "were" },
};
const VARIANT_TO_GENDER = { masc: "male", femme: "female" };

const TOKEN_RE = /\{(p|c_[a-zA-Z0-9_]+)_([a-zA-Z]+)\}/g;

function pronounsForGender(gender) {
  return PRONOUNS[gender] || PRONOUNS.nonbinary;
}

function capitalizeSentenceStarts(text) {
  // Cap first letter after start-of-string OR ". "/"? "/"! "
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead, ch) => lead + ch.toUpperCase());
}

/**
 * Resolve every {p_*} and {c_<id>_*} token in `text`.
 * @param {string} text
 * @param {{gender: string, name?: string}} player
 * @param {Array} characters — full story.characters
 * @param {Object} castings — { [charId]: "masc"|"femme" }
 */
export function resolveTokens(text, player, characters, castings) {
  if (!text || text.indexOf("{") === -1) return text || "";
  player = player || { gender: "female", name: "you" };
  characters = characters || [];
  castings = castings || {};
  const charById = {};
  for (const c of characters) {
    if (c && c.id) charById[c.id] = c;
  }
  const resolved = text.replace(TOKEN_RE, (match, entity, prop) => {
    const propLower = prop.toLowerCase();
    if (entity === "p") {
      if (propLower === "name") return String(player.name || "you");
      return pronounsForGender(player.gender || "female")[propLower] ?? match;
    }
    if (entity.startsWith("c_")) {
      const cid = entity.slice(2);
      const char = charById[cid];
      if (!char) return match;
      const variantKey = castings[cid];
      const variant = variantKey && char.variants ? char.variants[variantKey] : null;
      if (propLower === "name") {
        if (variant && variant.name) return variant.name;
        return char.name || cid;
      }
      if (variant && variant.pronouns && variant.pronouns[propLower]) return variant.pronouns[propLower];
      if (variantKey) {
        const g = VARIANT_TO_GENDER[variantKey] || "nonbinary";
        return pronounsForGender(g)[propLower] ?? match;
      }
      const g = char.gender || "nonbinary";
      return pronounsForGender(g)[propLower] ?? match;
    }
    return match;
  });
  return capitalizeSentenceStarts(resolved);
}

/**
 * Convenience: resolve tokens using the current user's identity + casting for
 * a specific story. Used inside components.
 */
export function makeResolver(user, story) {
  const identity = user?.identity || { playerGender: "female", romancePreference: "men" };
  const castings = (user?.storyCastings || {})[story?.id] || {};
  const player = {
    gender: identity.playerGender,
    name: user?.avatarConfig?.displayName || user?.displayName || "you",
  };
  return (text) => resolveTokens(text, player, story?.characters || [], castings);
}
