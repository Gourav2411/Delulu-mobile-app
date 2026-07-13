"""
Delulu — AI asset generation via Nano Banana (gemini-3.1-flash-image-preview).

Generates:
- NPC character portraits: 3 chars × 6 expressions = 18 PNGs
- Story cover: 1 PNG
- Scene panels: 2 PNGs

Outputs to /app/backend/media/ served at /api/media/{filename}.
On completion, patches /app/backend/media/manifest.json with resolved URLs so
seed_data.py can rehydrate the story with real art.

Run:
    cd /app/backend && python generate_assets.py [--only <char|panels|cover>] [--force]

Uses EMERGENT_LLM_KEY from .env.
"""
import argparse
import asyncio
import base64
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT = Path(__file__).parent
MEDIA_DIR = ROOT / "media"
MEDIA_DIR.mkdir(exist_ok=True)
MANIFEST_PATH = MEDIA_DIR / "manifest.json"

load_dotenv(ROOT / ".env")
API_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL_ID = "gemini-3.1-flash-image-preview"

# ---------------------------------------------------------------------------
# Style bible — repeated verbatim in every prompt for consistency.
# ---------------------------------------------------------------------------

STYLE = (
    "Modern Webtoon graphic-novel comic style. Bold clean ink outlines, cel shading with "
    "2-tone shadows, halftone texture in shadow areas, high contrast, dramatic rim light. "
    "Painted digital comic illustration, NOT 3D render, NOT photorealistic. "
    "Solid deep-black background (#0A0A0F). No text, no watermarks, no signatures, no borders."
)

# ---------------------------------------------------------------------------
# Character sheet — descriptions carry across all 6 expressions for consistency.
# ---------------------------------------------------------------------------

CHARACTERS = {
    "rian": {
        "name": "Rian Aster",
        "base": (
            "Male lead in his late 20s. Sharp jawline, dark tousled hair falling over one eye, "
            "high cheekbones, olive skin, piercing dark eyes with long lashes. "
            "Wearing an unbuttoned black silk shirt with a thin silver chain. Confident, dangerous energy. "
            "Rim light in HOT PINK (#FF3E8A) from behind. Head-and-shoulders portrait."
        ),
        "rim": "#FF3E8A",
    },
    "meera": {
        "name": "Meera",
        "base": (
            "Best-friend supporting character, early 20s South Asian woman. Long wavy dark brown hair with subtle "
            "burgundy highlights, warm brown skin, expressive almond eyes with winged eyeliner, glossy lips. "
            "Wearing a cropped cream cardigan with gold hoop earrings. Bubbly, chronically-online energy. "
            "Rim light in HOT PINK (#FF3E8A). Head-and-shoulders portrait."
        ),
        "rim": "#FF3E8A",
    },
    "karan": {
        "name": "Karan",
        "base": (
            "Rival male character, late 20s. Clean-cut jet-black slicked-back hair, sharp features, tan skin, "
            "cool grey-blue eyes. Wearing a fitted charcoal turtleneck. Cold, calculating aura. "
            "Rim light in ELECTRIC BLUE (#3E9BFF) from behind. Head-and-shoulders portrait."
        ),
        "rim": "#3E9BFF",
    },
}

EXPRESSIONS = {
    "neutral": "neutral calm expression, faint hint of intensity, eyes forward, closed mouth",
    "happy":   "genuine warm smile showing slight teeth, crinkled eyes, cheeks lifted with soft blush",
    "flirty":  "smirking with one raised eyebrow, half-lidded seductive eyes, tongue slightly touching upper lip",
    "angry":   "furrowed brows, tight jaw, teeth barely visible, sharp glare, small anime-style anger vein on temple",
    "shocked": "wide surprised eyes, mouth slightly open, comic sweat drop near temple",
    "sad":     "downcast eyes, slight frown, single tear on cheek, faint red rim around eyes",
}

# ---------------------------------------------------------------------------
# Scene panels + cover
# ---------------------------------------------------------------------------

SCENES = {
    "cover": (
        f"{STYLE} Book cover illustration. Female protagonist silhouette in the foreground (back "
        f"turned, silhouette only — no visible face) facing the male lead RIAN in the background who is "
        f"gazing intensely at the viewer, standing on a neon-lit rain-slicked rooftop bar at midnight. "
        f"City skyline glowing with pink and purple lights. Dramatic composition. Vertical portrait 3:4."
    ),
    "panel_rooftop": (
        f"{STYLE} Full-scene comic panel. Wide shot of a moody rooftop bar at 9pm, rain misting the neon "
        f"signs, string lights, wet floor reflecting hot-pink neon. A silhouetted male figure (Rian, "
        f"unbuttoned black silk shirt, tousled dark hair) leans against the bar counter alone, glass in hand, "
        f"waiting. Cinematic composition. Halftone burst effect in the sky corner. Horizontal 16:9."
    ),
    "panel_ending": (
        f"{STYLE} Full-scene ending panel. Two figures — a female silhouette (back to viewer) and RIAN "
        f"(male lead, unbuttoned black shirt, tousled dark hair) — standing close together on a moonlit "
        f"balcony overlooking a city at midnight. Pink neon rim light. Dramatic emotional composition. "
        f"Sparks / petals falling. Horizontal 16:9."
    ),
}

# ---------------------------------------------------------------------------
# Generation helpers
# ---------------------------------------------------------------------------

def _load_manifest():
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {"characters": {}, "scenes": {}, "cover": None}


def _save_manifest(manifest):
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))


async def _gen_one(prompt, out_path, retries=2):
    """Generate a single image, save PNG bytes to disk, return True on success."""
    for attempt in range(retries + 1):
        try:
            # Fresh chat instance each call (playbook requirement)
            chat = (
                LlmChat(api_key=API_KEY, session_id=f"delulu-{out_path.stem}-{int(time.time())}",
                        system_message="You are a comic book illustrator.")
                .with_model("gemini", MODEL_ID)
                .with_params(modalities=["image", "text"])
            )
            msg = UserMessage(text=prompt)
            text, images = await chat.send_message_multimodal_response(msg)
            if not images:
                print(f"  ! no image returned, retrying ({attempt+1})")
                continue
            data = base64.b64decode(images[0]["data"])
            out_path.write_bytes(data)
            return True
        except Exception as e:
            print(f"  ! error on attempt {attempt+1}: {str(e)[:200]}")
            await asyncio.sleep(1.5)
    return False


async def gen_characters(force=False):
    manifest = _load_manifest()
    total = success = 0
    for char_id, char in CHARACTERS.items():
        manifest["characters"].setdefault(char_id, {})
        for expr_id, expr_desc in EXPRESSIONS.items():
            total += 1
            filename = f"char_{char_id}_{expr_id}.png"
            out = MEDIA_DIR / filename
            if out.exists() and not force:
                manifest["characters"][char_id][expr_id] = filename
                success += 1
                print(f"  = skip (exists) {filename}")
                continue
            prompt = (
                f"{STYLE} {char['base']} Facial expression: {expr_desc}. "
                f"Rim light color: {char['rim']}. Portrait crop head-and-shoulders 3:4."
            )
            print(f"→ generating {filename} …")
            ok = await _gen_one(prompt, out)
            if ok:
                manifest["characters"][char_id][expr_id] = filename
                success += 1
                print(f"  ✓ saved {filename}")
            _save_manifest(manifest)
            await asyncio.sleep(0.5)
    print(f"\ncharacters: {success}/{total}")


async def gen_scenes(force=False):
    manifest = _load_manifest()
    for scene_id, prompt in SCENES.items():
        if scene_id == "cover":
            continue
        filename = f"scene_{scene_id}.png"
        out = MEDIA_DIR / filename
        if out.exists() and not force:
            manifest["scenes"][scene_id] = filename
            print(f"  = skip (exists) {filename}")
            continue
        print(f"→ generating {filename} …")
        ok = await _gen_one(prompt, out)
        if ok:
            manifest["scenes"][scene_id] = filename
            print(f"  ✓ saved {filename}")
        _save_manifest(manifest)
        await asyncio.sleep(0.5)


async def gen_cover(force=False):
    manifest = _load_manifest()
    filename = "cover_flagship.png"
    out = MEDIA_DIR / filename
    if out.exists() and not force:
        manifest["cover"] = filename
        print(f"  = skip (exists) {filename}")
    else:
        print(f"→ generating {filename} …")
        ok = await _gen_one(prompt=SCENES["cover"], out_path=out)
        if ok:
            manifest["cover"] = filename
            print(f"  ✓ saved {filename}")
    _save_manifest(manifest)


async def main(only, force):
    if only in (None, "all", "char"):
        await gen_characters(force=force)
    if only in (None, "all", "panels"):
        await gen_scenes(force=force)
    if only in (None, "all", "cover"):
        await gen_cover(force=force)
    manifest = _load_manifest()
    print("\nmanifest:")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=["all", "char", "panels", "cover"], default="all")
    ap.add_argument("--force", action="store_true", help="regenerate even if file exists")
    args = ap.parse_args()
    asyncio.run(main(args.only, args.force))
