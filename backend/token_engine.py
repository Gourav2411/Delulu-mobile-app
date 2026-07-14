"""
Delulu token resolver (server side).

Tokens embedded in story text so one chapter file works for every casting.

  Player tokens (resolved from user's playerGender):
    {p_name}       — display name (falls back to "you")
    {p_they}       — subject pronoun     (she | he | they)
    {p_them}       — object pronoun      (her | him | them)
    {p_their}      — possessive det.     (her | his | their)
    {p_theirs}     — possessive pronoun  (hers | his | theirs)
    {p_themself}   — reflexive           (herself | himself | themself)
    {p_is}         — copula              (is | is | are)
    {p_was}        — past copula         (was | was | were)

  Character tokens (charId comes from story.characters[].id, variant from
  user.storyCastings[storyId][charId]):
    {c_<id>_name}, {c_<id>_they}, {c_<id>_them}, {c_<id>_their},
    {c_<id>_theirs}, {c_<id>_themself}, {c_<id>_is}, {c_<id>_was}

Sentence-start capitalization: any token immediately following a period + space
(or at the very start of the string) is automatically capitalized. This lets
authors write "{p_they} smile." without needing a "{P_they}" variant.

The validator function detects:
  • Unknown tokens (typos)
  • Hard-coded player pronouns (she/he/they + her/him/them etc.)
  • Literal love-interest names appearing in prose (which would break the variant swap)
"""

from __future__ import annotations
import re
from typing import Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Pronoun sets by gender / variant
# ---------------------------------------------------------------------------
_PRONOUNS = {
    "female":     {"they": "she",  "them": "her",  "their": "her",   "theirs": "hers",   "themself": "herself",  "is": "is",  "was": "was"},
    "male":       {"they": "he",   "them": "him",  "their": "his",   "theirs": "his",    "themself": "himself",  "is": "is",  "was": "was"},
    "nonbinary":  {"they": "they", "them": "them", "their": "their", "theirs": "theirs", "themself": "themself", "is": "are", "was": "were"},
}
# Variants map directly onto pronoun sets. A "masc" variant character uses male
# pronouns, "femme" uses female. Non-binary variants aren't part of the
# love-interest system in V1.1.
_VARIANT_TO_GENDER = {"masc": "male", "femme": "female"}


def _pronouns_for_gender(gender: str) -> Dict[str, str]:
    return _PRONOUNS.get(gender, _PRONOUNS["nonbinary"]).copy()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

TOKEN_RE = re.compile(r"\{(p|c_[a-zA-Z0-9_]+)_([a-zA-Z]+)\}")


def resolve_tokens(
    text: str,
    player: Optional[Dict] = None,
    characters: Optional[List[Dict]] = None,
    castings: Optional[Dict[str, str]] = None,
) -> str:
    """Resolve every {p_*} and {c_<id>_*} token in `text`.

    Parameters
    ----------
    text : str
        Raw chapter text with tokens.
    player : dict, optional
        { "gender": str, "name": str? }
    characters : list of dicts
        Full story.characters array. Each item may have `variants` sub-dict.
    castings : dict
        { charId: "masc"|"femme" } — as stored on user.storyCastings[storyId].
    """
    if not text or "{" not in text:
        return text or ""
    player = player or {"gender": "female", "name": "you"}
    characters = characters or []
    castings = castings or {}

    # Build a lookup so we don't do an O(n) scan per token.
    char_by_id = {c.get("id"): c for c in characters if c.get("id")}

    def _resolve_token(entity: str, prop: str) -> Optional[str]:
        prop = prop.lower()
        # Player token
        if entity == "p":
            if prop == "name":
                return str(player.get("name") or "you")
            return _pronouns_for_gender(player.get("gender") or "female").get(prop)
        # Character token: entity is "c_<id>"
        if entity.startswith("c_"):
            cid = entity[2:]
            char = char_by_id.get(cid)
            if not char:
                return None
            variant_key = castings.get(cid)
            variant = None
            if variant_key and (char.get("variants") or {}).get(variant_key):
                variant = char["variants"][variant_key]
            if prop == "name":
                if variant and variant.get("name"):
                    return variant["name"]
                return char.get("name") or cid
            # Pronoun lookup uses variant's own explicit `pronouns` if present,
            # else derives from the variant key (masc/femme). Non-variant
            # characters use their own `gender` field if set, else neutral.
            if variant and variant.get("pronouns"):
                return variant["pronouns"].get(prop)
            if variant_key:
                gender = _VARIANT_TO_GENDER.get(variant_key, "nonbinary")
                return _pronouns_for_gender(gender).get(prop)
            gender = char.get("gender", "nonbinary")
            return _pronouns_for_gender(gender).get(prop)
        return None

    def _capitalize_at_sentence_start(text: str) -> str:
        """After token substitution, capitalize any word that sits at a
        sentence start (start of string OR after `. `, `? `, `! `)."""
        def _cap_match(m):
            leading, word = m.group(1), m.group(2)
            return leading + (word[0].upper() + word[1:] if word else word)
        # Anchored: start-of-string OR sentence-ending punctuation + whitespace
        return re.sub(r"(^|[.!?]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), text)

    def _replace(match: re.Match) -> str:
        entity, prop = match.group(1), match.group(2)
        v = _resolve_token(entity, prop)
        # Fallback: keep the token bare (obvious in QA)
        return v if v is not None else match.group(0)

    resolved = TOKEN_RE.sub(_replace, text)
    return _capitalize_at_sentence_start(resolved)


# ---------------------------------------------------------------------------
# Story validator
# ---------------------------------------------------------------------------

_ALLOWED_TOKEN_PROPS = {"name", "they", "them", "their", "theirs", "themself", "is", "was"}
# Hard-coded pronouns that we forbid in author prose (they would break gender awareness)
_HARD_CODED_PRONOUNS = {
    "she", "he",  # subject (they is intentionally allowed — often used generically)
    "her", "him",
    "hers", "his",
    "herself", "himself",
}


def lint_chapter_text(text: str, story: Dict) -> List[Dict]:
    """Return a list of {severity, code, message, snippet} findings for a single
    chapter text blob. Empty list = passes lint."""
    findings: List[Dict] = []
    if not text:
        return findings

    # 1. Unknown token props (e.g. {p_hey} typo)
    for m in TOKEN_RE.finditer(text):
        entity, prop = m.group(1), m.group(2).lower()
        if prop not in _ALLOWED_TOKEN_PROPS:
            findings.append({
                "severity": "error", "code": "unknown_token_prop",
                "message": f"unknown token property '{prop}' — allowed: {sorted(_ALLOWED_TOKEN_PROPS)}",
                "snippet": m.group(0),
            })
        if entity.startswith("c_"):
            cid = entity[2:]
            if cid not in {c.get("id") for c in (story.get("characters") or [])}:
                findings.append({
                    "severity": "error", "code": "unknown_character",
                    "message": f"token refers to unknown character '{cid}'",
                    "snippet": m.group(0),
                })

    # 2. Hard-coded player pronouns. We only flag whole-word matches. Author-facing
    #    action text (like italic setup lines: "he closed the door") should be
    #    templated. This is intentionally aggressive — false positives can be
    #    fixed by rewriting to a token.
    pronoun_re = re.compile(r"\b(" + "|".join(_HARD_CODED_PRONOUNS) + r")\b", flags=re.IGNORECASE)
    for m in pronoun_re.finditer(text):
        findings.append({
            "severity": "warning", "code": "hard_coded_pronoun",
            "message": f"hard-coded pronoun '{m.group(1)}' — swap for a {{p_...}} or {{c_<id>_...}} token",
            "snippet": _snippet(text, m.start(), m.end()),
        })

    # 3. Literal love-interest names in prose (for characters that have variants
    #    — because the variant name would differ and the literal name would leak
    #    the "other" casting).
    for c in story.get("characters", []) or []:
        variants = c.get("variants") or {}
        if not (variants.get("masc") and variants.get("femme")):
            continue
        for _, variant in variants.items():
            name = (variant.get("name") or "").strip()
            if len(name) < 2:
                continue
            for m in re.finditer(rf"\b{re.escape(name)}\b", text):
                findings.append({
                    "severity": "warning", "code": "literal_variant_name",
                    "message": f"literal variant name '{name}' in text — use {{c_{c.get('id')}_name}} instead",
                    "snippet": _snippet(text, m.start(), m.end()),
                })
    return findings


def _snippet(text: str, s: int, e: int, radius: int = 24) -> str:
    left = max(0, s - radius)
    right = min(len(text), e + radius)
    return text[left:right].replace("\n", " ")


def validate_story(story: Dict) -> Dict:
    """Run the full validator over every chapter/message text plus check variant
    completeness. Returns a summary suitable for the admin panel."""
    findings: List[Dict] = []
    for chap in story.get("chapters", []) or []:
        for msg in chap.get("messages", []) or []:
            for f in lint_chapter_text(msg.get("text", ""), story):
                findings.append({"chapterId": chap.get("id"), "messageId": msg.get("id"), **f})
        # Choice options can also carry text
        for msg in chap.get("messages", []) or []:
            cp = msg.get("choicePoint") or {}
            for opt in cp.get("options", []) or []:
                for f in lint_chapter_text(opt.get("text", ""), story):
                    findings.append({"chapterId": chap.get("id"), "messageId": msg.get("id"),
                                     "choiceId": opt.get("id"), **f})

    # Variant completeness
    variant_issues: List[Dict] = []
    for c in story.get("characters", []) or []:
        variants = c.get("variants") or {}
        if variants:
            for key in ("masc", "femme"):
                v = variants.get(key)
                if not v:
                    variant_issues.append({"severity": "error", "code": "missing_variant",
                                            "message": f"character '{c.get('id')}' missing '{key}' variant",
                                            "characterId": c.get("id")})
                    continue
                if not v.get("name"):
                    variant_issues.append({"severity": "error", "code": "missing_variant_name",
                                            "message": f"variant '{key}' of '{c.get('id')}' missing name",
                                            "characterId": c.get("id")})
                # portraitUrls must have all six expressions to go live
                pu = v.get("portraitUrls") or {}
                required = {"neutral", "happy", "flirty", "sad", "angry", "surprised"}
                missing = required - set(pu.keys())
                if missing:
                    variant_issues.append({"severity": "warning", "code": "incomplete_portraits",
                                            "message": f"variant '{key}' of '{c.get('id')}' missing expressions: {sorted(missing)}",
                                            "characterId": c.get("id")})

    error_count = sum(1 for f in findings + variant_issues if f.get("severity") == "error")
    warning_count = sum(1 for f in findings + variant_issues if f.get("severity") == "warning")
    # Compact character summary for the admin panel — powers the per-character
    # variant caster in preview mode.
    char_summary = [
        {
            "id": c.get("id"),
            "name": c.get("name"),
            "role": c.get("role"),
            "isLoveInterest": bool(c.get("isLoveInterest")),
            "hasVariants": bool((c.get("variants") or {}).get("masc") and (c.get("variants") or {}).get("femme")),
        }
        for c in (story.get("characters") or [])
    ]
    return {
        "storyId": story.get("id"),
        "canGoLive": error_count == 0,
        "errors": error_count,
        "warnings": warning_count,
        "findings": findings,
        "variantIssues": variant_issues,
        "characters": char_summary,
    }
