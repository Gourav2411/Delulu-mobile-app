"""
Delulu seed data:
- 15 avatar assets across skin / eyes / mouth / hair / outfit / accessory slots (color-encoded placeholders)
- 1 flagship romance story "Falling for the Enigma" — 10 chapters, 2 choice points, 3 endings, 2 scene panels, PLAYER messages
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path


def utcnow():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# AI-asset manifest (produced by /app/backend/generate_assets.py)
# ---------------------------------------------------------------------------

BASE_URL = (os.environ.get("PUBLIC_BASE_URL") or "").rstrip("/")
MANIFEST_PATH = Path(__file__).parent / "media" / "manifest.json"


def _load_manifest():
    if not MANIFEST_PATH.exists():
        return None
    try:
        return json.loads(MANIFEST_PATH.read_text())
    except Exception:
        return None


def _media_url(filename):
    if not filename:
        return None
    if BASE_URL:
        return f"{BASE_URL}/api/media/{filename}"
    return f"/api/media/{filename}"


_MANIFEST = _load_manifest()


# ============================================================================
# AVATAR ASSETS — colored layer placeholders. z-order matches AvatarBuilderCanvas.
# ============================================================================

# We encode layer color into the id so the frontend can render placeholder shapes
# without needing pre-rendered PNGs. Real PNGs slot in later without a schema change.

AVATAR_ASSETS = [
    # BODY / SKIN (slot: "body", z: 20) — 3 tones
    {"id": "body_porcelain", "slot": "body", "rarity": "common", "gemCost": 0, "zIndex": 20, "color": "#F3D6C0", "label": "Porcelain"},
    {"id": "body_light_tan",  "slot": "body", "rarity": "common", "gemCost": 0, "zIndex": 20, "color": "#D9A277", "label": "Light Tan"},
    {"id": "body_deep_ebony", "slot": "body", "rarity": "common", "gemCost": 0, "zIndex": 20, "color": "#4B2E22", "label": "Deep Ebony"},
    # EYES (slot: "eyes", z: 40)
    {"id": "eyes_soft",   "slot": "eyes", "rarity": "common", "gemCost": 0, "zIndex": 40, "color": "#1E1E2A", "label": "Soft"},
    {"id": "eyes_sharp",  "slot": "eyes", "rarity": "common", "gemCost": 0, "zIndex": 40, "color": "#0A0A0F", "label": "Sharp"},
    {"id": "eyes_dreamy", "slot": "eyes", "rarity": "rare",   "gemCost": 80, "zIndex": 40, "color": "#7C5CFF", "label": "Dreamy"},
    # HAIR (slot: "hair", z: 60)
    {"id": "hair_shag_black",   "slot": "hair", "rarity": "common", "gemCost": 0,   "zIndex": 60, "color": "#0F0F14", "label": "Shag · Black"},
    {"id": "hair_wavy_wine",    "slot": "hair", "rarity": "rare",   "gemCost": 80,  "zIndex": 60, "color": "#6B0F2A", "label": "Wavy · Wine"},
    {"id": "hair_pixie_platinum","slot": "hair", "rarity": "iconic", "gemCost": 200, "zIndex": 60, "color": "#E8E4DA", "label": "Pixie · Platinum"},
    # OUTFIT (slot: "outfit", z: 50)
    {"id": "outfit_night_in",         "slot": "outfit", "rarity": "common", "gemCost": 30,  "zIndex": 50, "color": "#2A2A38", "label": "Night In"},
    {"id": "outfit_city_lights",      "slot": "outfit", "rarity": "rare",   "gemCost": 80,  "zIndex": 50, "color": "#3E9BFF", "label": "City Lights"},
    {"id": "outfit_obsidian_charmer", "slot": "outfit", "rarity": "iconic", "gemCost": 200, "zIndex": 50, "color": "#FF3E8A", "label": "Obsidian Charmer"},
    {"id": "outfit_midnight_gala",    "slot": "outfit", "rarity": "iconic", "gemCost": 0,   "zIndex": 50, "color": "#FFC94A", "label": "Midnight Gala", "storyLockId": "falling_for_the_enigma:rare_ending"},
    # ACCESSORY (slot: "accessory", z: 70)
    {"id": "acc_glasses_thin", "slot": "accessory", "rarity": "common", "gemCost": 30, "zIndex": 70, "color": "#F5F5F7", "label": "Thin Glasses"},
    {"id": "acc_gold_chain",   "slot": "accessory", "rarity": "rare",   "gemCost": 80, "zIndex": 70, "color": "#FFC94A", "label": "Gold Chain"},
]


# ============================================================================
# STORY: FALLING FOR THE ENIGMA
# ============================================================================

STORY_ID = "falling_for_the_enigma"
ACCENT = "#FF3E8A"

# Use royalty-free style image URLs (unsplash placeholders) for cover / panels / character portraits
# NPC has 6 expressions: neutral / happy / flirty / angry / shocked / sad
def _char_portraits(char_id, fallback):
    """Return {expression: url} — AI-generated when manifest exists, fallback otherwise."""
    if _MANIFEST and _MANIFEST.get("characters", {}).get(char_id):
        m = _MANIFEST["characters"][char_id]
        return {expr: _media_url(m.get(expr)) or fallback[expr] for expr in fallback}
    return fallback


_RIAN_FALLBACK = {
    "neutral": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&q=80",
    "happy":   "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&q=80",
    "flirty":  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=500&q=80",
    "angry":   "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=500&q=80",
    "shocked": "https://images.unsplash.com/photo-1520975916090-3105956dac38?w=500&q=80",
    "sad":     "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&q=80",
}
_MEERA_FALLBACK = {
    "neutral": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&q=80",
    "happy":   "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&q=80",
    "flirty":  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80",
    "angry":   "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&q=80",
    "shocked": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&q=80",
    "sad":     "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=500&q=80",
}
_KARAN_FALLBACK = {
    "neutral": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&q=80",
    "happy":   "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=500&q=80",
    "flirty":  "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=500&q=80",
    "angry":   "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&q=80",
    "shocked": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&q=80",
    "sad":     "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500&q=80",
}

RIAN_PORTRAITS = _char_portraits("rian", _RIAN_FALLBACK)
MEERA_PORTRAITS = _char_portraits("meera", _MEERA_FALLBACK)
KARAN_PORTRAITS = _char_portraits("karan", _KARAN_FALLBACK)

COVER = (_MANIFEST and _media_url(_MANIFEST.get("cover"))) or \
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1000&q=80"
SCENE_PANEL_ROOFTOP = (_MANIFEST and _media_url(_MANIFEST.get("scenes", {}).get("panel_rooftop"))) or \
    "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&q=80"
SCENE_PANEL_ENDING = (_MANIFEST and _media_url(_MANIFEST.get("scenes", {}).get("panel_ending"))) or \
    "https://images.unsplash.com/photo-1502224562085-639556652f33?w=1200&q=80"


def m(mid, sender, text, delay=1400, expression="neutral", size="small", react=None, sfx=None, panel=None, choice=None):
    return {
        "id": mid,
        "senderCharacterId": sender,
        "text": text,
        "delayMs": delay,
        "expression": expression,
        "portraitSize": size,
        "reactTo": react,
        "sfxText": sfx,
        "scenePanel": panel,
        "choicePoint": choice,
    }


def build_story():
    chapters = []

    # ── Chapter 1: A Chance Encounter ─────────────────────────────────────
    chapters.append({
        "id": "ch1",
        "index": 0,
        "title": "A Chance Encounter",
        "messages": [
            m("c1m1", "narrator", "Rooftop bar. Rain misting the neon. You didn't come here to meet anyone.", 1200, "neutral", "small"),
            m("c1m2", "rian", "You lost?", 1500, "neutral", "small"),
            m("c1m3", "PLAYER", "I don't get lost.", 900, "smug", "small"),
            m("c1m4", "rian", "Cute. That's exactly what lost people say.", 1600, "flirty", "large"),
            m("c1m5", "PLAYER", "And what would a not-lost person say?", 900, "flirty", "small"),
            m("c1m6", "rian", "\"Come sit with me.\"", 1500, "flirty", "large"),
            m("c1m7", "narrator", "He slides a second glass across the bar without asking.", 1400, "neutral", "small",
              sfx="CLINK"),
            m("c1m8", "PLAYER", "Bold assumption.", 800, "smug", "small"),
            m("c1m9", "rian", "You're still standing here.", 1300, "flirty", "small"),
        ],
    })

    # ── Chapter 2: Rules Are Made to Break ────────────────────────────────
    chapters.append({
        "id": "ch2",
        "index": 1,
        "title": "Rules Are Made to Break",
        "messages": [
            m("c2m1", "meera", "you did WHAT last night??", 900, "shocked", "small"),
            m("c2m2", "PLAYER", "nothing happened.", 700, "neutral", "small"),
            m("c2m3", "meera", "you had a WHOLE drink with rian aster.", 1200, "shocked", "small"),
            m("c2m4", "meera", "the rian aster.", 700, "shocked", "small", react={"characterId": "PLAYER", "expression": "shocked"}),
            m("c2m5", "PLAYER", "who?", 700, "neutral", "small"),
            m("c2m6", "meera", "girl. GOOGLE.", 900, "angry", "small", sfx="!!!"),
        ],
    })

    # ── Chapter 3: Lines We Don't Cross ───────────────────────────────────
    chapters.append({
        "id": "ch3",
        "index": 2,
        "title": "Lines We Don't Cross",
        "messages": [
            m("c3m1", "rian", "Meet me. Tonight. Same roof.", 1400, "flirty", "large"),
            m("c3m2", "PLAYER", "I have work.", 800, "neutral", "small"),
            m("c3m3", "rian", "Then blow it off.", 1200, "flirty", "small"),
            m("c3m4", "narrator", "The cursor blinks. Your reply hasn't been sent.", 1300, "neutral", "small"),
            # First choice point
            m("c3m5", "PLAYER", "", 500, "neutral", "small", choice={
                "options": [
                    {"text": "See you at 9.", "isPremium": False, "gemCost": 0, "nextMessageId": "c3m6a", "endingWeight": {"bold": 1}},
                    {"text": "I can't. Sorry.", "isPremium": False, "gemCost": 0, "nextMessageId": "c3m6b", "endingWeight": {"safe": 1}},
                    {"text": "Send a selfie back. No words.", "isPremium": True, "gemCost": 25, "nextMessageId": "c3m6c", "endingWeight": {"delulu": 2}},
                ]
            }),
            m("c3m6a", "rian", "Good girl.", 1200, "flirty", "large"),
            m("c3m6b", "rian", "...Okay.", 1200, "sad", "small"),
            m("c3m6c", "rian", "You're going to ruin me.", 1500, "flirty", "large"),
        ],
    })

    # ── Chapters 4-9: Slow burn beats ────────────────────────────────────
    ch4_msgs = [
        m("c4m1", "narrator", "Rooftop. 9:03 PM. He's already there.", 1200, "neutral", "small",
          panel={"imageUrl": SCENE_PANEL_ROOFTOP, "caption": "9:03 PM — the roof is his.", "isEndingPanel": False}),
        m("c4m2", "rian", "You came.", 1200, "happy", "large"),
        m("c4m3", "PLAYER", "Don't get used to it.", 800, "smug", "small"),
        m("c4m4", "rian", "Too late.", 1200, "flirty", "large"),
    ]
    chapters.append({"id": "ch4", "index": 3, "title": "The First Crack", "messages": ch4_msgs})

    chapters.append({"id": "ch5", "index": 4, "title": "Names You Shouldn't Say", "messages": [
        m("c5m1", "karan", "we need to talk about him.", 1000, "angry", "small"),
        m("c5m2", "PLAYER", "no we don't.", 800, "angry", "small"),
        m("c5m3", "karan", "he burns everything he touches.", 1400, "sad", "large"),
    ]})

    chapters.append({"id": "ch6", "index": 5, "title": "Two AM", "messages": [
        m("c6m1", "rian", "you awake?", 900, "neutral", "small"),
        m("c6m2", "PLAYER", "now i am.", 800, "neutral", "small"),
        m("c6m3", "rian", "good. i wanted to tell you something.", 1300, "flirty", "small"),
        m("c6m4", "rian", "...never mind.", 1200, "sad", "small"),
    ]})

    chapters.append({"id": "ch7", "index": 6, "title": "Unsaid Truths", "messages": [
        m("c7m1", "rian", "You think I don't notice the way you look at me?", 1400, "flirty", "large"),
        m("c7m2", "PLAYER", "Maybe I do look.", 900, "flirty", "small"),
        m("c7m3", "rian", "Careful, sweetheart. Looking is the easy part. Falling? That's dangerous.", 1800, "flirty", "large",
          react={"characterId": "PLAYER", "expression": "shocked"}),
    ]})

    chapters.append({"id": "ch8", "index": 7, "title": "The Fight", "messages": [
        m("c8m1", "rian", "You told KARAN?", 1000, "angry", "large"),
        m("c8m2", "PLAYER", "he asked.", 800, "sad", "small"),
        m("c8m3", "rian", "of course he did.", 1200, "angry", "small", sfx="SLAM"),
    ]})

    chapters.append({"id": "ch9", "index": 8, "title": "Come Back", "messages": [
        m("c9m1", "rian", "i'm sorry.", 900, "sad", "small"),
        m("c9m2", "rian", "i shouldn't have raised my voice.", 1200, "sad", "small"),
        m("c9m3", "PLAYER", "", 500, "neutral", "small", choice={
            "options": [
                {"text": "Come over.", "isPremium": False, "gemCost": 0, "nextMessageId": "c9m4a", "endingWeight": {"bold": 2}},
                {"text": "I need space.", "isPremium": False, "gemCost": 0, "nextMessageId": "c9m4b", "endingWeight": {"safe": 2}},
                {"text": "Meet me at the Midnight Gala.", "isPremium": True, "gemCost": 25, "nextMessageId": "c9m4c", "endingWeight": {"delulu": 3}},
            ]
        }),
        m("c9m4a", "rian", "on my way.", 1000, "happy", "large"),
        m("c9m4b", "rian", "okay. take your time.", 1200, "sad", "small"),
        m("c9m4c", "rian", "in a suit. at 9. don't be late.", 1400, "flirty", "large"),
    ]})

    # ── Chapter 10: Ending panel ─────────────────────────────────────────
    chapters.append({"id": "ch10", "index": 9, "title": "The Truth We Chose", "messages": [
        m("c10m1", "rian", "This is the part where I tell you the truth.", 1500, "neutral", "large"),
        m("c10m2", "PLAYER", "I'm listening.", 900, "neutral", "small"),
        m("c10m3", "rian", "I was never going to stay away.", 1600, "flirty", "large",
          react={"characterId": "PLAYER", "expression": "happy"}),
        m("c10m4", "narrator", "", 1200, "neutral", "small",
          panel={"imageUrl": SCENE_PANEL_ENDING, "caption": "choices matter. stories stay with us.", "isEndingPanel": True}),
    ]})

    endings = [
        {"id": "ending_safe",   "name": "The Cautious Heart", "rarityPercent": 36,
         "shareCardConfig": {"headline": "I got the GOOD ending", "subtitle": "Choices matter. Stories stay with us.", "accent": ACCENT}},
        {"id": "ending_bold",   "name": "Falling In Anyway",  "rarityPercent": 18,
         "shareCardConfig": {"headline": "I got the EPIC ending", "subtitle": "Falling? That's dangerous.", "accent": ACCENT}},
        {"id": "ending_delulu", "name": "Midnight Gala",      "rarityPercent": 4,
         "shareCardConfig": {"headline": "I got the RARE ending", "subtitle": "only 4% were delulu enough for this", "accent": "#FFC94A"}},
    ]

    characters = [
        {"id": "rian",  "name": "Rian Aster",    "role": "Male Lead",   "avatarUrl": RIAN_PORTRAITS["neutral"],  "portraitUrls": RIAN_PORTRAITS},
        {"id": "meera", "name": "Meera",         "role": "Best Friend", "avatarUrl": MEERA_PORTRAITS["neutral"], "portraitUrls": MEERA_PORTRAITS},
        {"id": "karan", "name": "Karan",         "role": "Rival",       "avatarUrl": KARAN_PORTRAITS["neutral"], "portraitUrls": KARAN_PORTRAITS},
        {"id": "narrator", "name": "Narrator",   "role": "narration",   "avatarUrl": None, "portraitUrls": {}},
    ]

    return {
        "id": STORY_ID,
        "title": "Falling for the Enigma",
        "genre": "romance",
        "accentColor": ACCENT,
        "coverUrl": COVER,
        "synopsis": "She swore she'd never get involved. He didn't believe in love. Then one night changed the rules. Choices change everything.",
        "tropeTags": ["Enemies to Lovers", "Forbidden Love", "Billionaire"],
        "characters": characters,
        "chapters": chapters,
        "endings": endings,
        "status": "live",
        "isFlagship": True,
        "ageRating": "16+",
        "totalReads": 63421,
    }


# ============================================================================
# SEED RUNNER
# ============================================================================

async def seed_all(db):
    # Avatar assets — upsert each so we can bump the catalog safely
    for a in AVATAR_ASSETS:
        await db.avatar_assets.update_one({"id": a["id"]}, {"$set": a}, upsert=True)

    # Story
    story = build_story()
    await db.stories.update_one({"id": story["id"]}, {"$set": story}, upsert=True)

    # A couple of coming-soon stubs so the home page has genre variety
    coming_soon = [
        {
            "id": "the_last_signal", "title": "The Last Signal", "genre": "scifi", "accentColor": "#7C5CFF",
            "coverUrl": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1000&q=80",
            "synopsis": "One transmission. Twelve survivors. And a voice that knows your name.",
            "tropeTags": ["Space Horror", "Slow Burn"], "characters": [], "chapters": [], "endings": [],
            "status": "coming_soon", "isFlagship": False, "totalReads": 0,
        },
        {
            "id": "burn_notice", "title": "Burn Notice", "genre": "thriller", "accentColor": "#3E9BFF",
            "coverUrl": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1000&q=80",
            "synopsis": "You had one job. Don't answer his calls.",
            "tropeTags": ["Spy", "Second Chance"], "characters": [], "chapters": [], "endings": [],
            "status": "coming_soon", "isFlagship": False, "totalReads": 0,
        },
        {
            "id": "midnight_house", "title": "The House on Midnight Row", "genre": "horror", "accentColor": "#E5273E",
            "coverUrl": "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=1000&q=80",
            "synopsis": "Every mirror in the house lies. Except one.",
            "tropeTags": ["Haunted", "Mystery"], "characters": [], "chapters": [], "endings": [],
            "status": "coming_soon", "isFlagship": False, "totalReads": 0,
        },
        {
            "id": "understudy", "title": "Understudy", "genre": "drama", "accentColor": "#FF8A3E",
            "coverUrl": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1000&q=80",
            "synopsis": "The lead can't perform tonight. And you know exactly why.",
            "tropeTags": ["Fame", "Rivalry"], "characters": [], "chapters": [], "endings": [],
            "status": "coming_soon", "isFlagship": False, "totalReads": 0,
        },
    ]
    for s in coming_soon:
        await db.stories.update_one({"id": s["id"]}, {"$set": s}, upsert=True)
