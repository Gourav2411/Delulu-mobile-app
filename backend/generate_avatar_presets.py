"""
Generate 6 avatar portrait presets (comic style, dark bg, transparent-adjacent) so the
character builder can offer a 'quick pick' row that looks like the real webtoon art.

Outputs: /app/backend/media/preset_avatar_{n}.png  and updates manifest.
"""
import argparse
import asyncio
import base64
import json
import os
import time
from pathlib import Path
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT = Path(__file__).parent
MEDIA = ROOT / "media"
MEDIA.mkdir(exist_ok=True)
MANIFEST_PATH = MEDIA / "manifest.json"
load_dotenv(ROOT / ".env")
API_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL = "gemini-3.1-flash-image-preview"

STYLE = (
    "Modern Webtoon graphic-novel comic style. Bold clean ink outlines, cel shading with "
    "2-tone shadows, halftone texture, high contrast, hot-pink (#FF3E8A) rim light. "
    "Solid deep-black background (#0A0A0F). Head-and-shoulders portrait 3:4. "
    "No text, no watermarks, no signatures, no borders."
)

# Diverse cast — different skin tones, hair, style vibes. All comic-consistent.
PRESETS = [
    ("preset_avatar_1", "Femme lead, late teens, wavy caramel-brown shoulder-length hair, warm brown skin, big expressive dark eyes, glossy lips, wearing a black satin slip dress with a delicate gold chain. Confident smirk."),
    ("preset_avatar_2", "Masc lead, early 20s, tousled dark hair, olive skin, sharp jawline, wearing a fitted black bomber jacket over a white t-shirt with a silver chain. Neutral cool expression."),
    ("preset_avatar_3", "Femme lead, early 20s, jet-black straight bob with blunt bangs, porcelain skin, red lips, sharp cat-eye eyeliner, wearing a black corset top. Icy confident stare."),
    ("preset_avatar_4", "Masc lead, late teens, curly dark brown hair with faded undercut, medium brown skin, warm smile, dimples, wearing a burgundy hoodie under a leather jacket. Genuine happy expression."),
    ("preset_avatar_5", "Androgynous lead, early 20s, platinum-blonde slicked-back hair, deep tan skin, high cheekbones, thin gold hoop earring, wearing an oversized black blazer with nothing underneath. Sultry half-smile."),
    ("preset_avatar_6", "Femme lead, early 20s, long wavy pastel-pink hair with dark roots, deep ebony skin, glowing highlighter, wearing a black mesh top with silver body chain. Playful raised eyebrow."),
]


def load_manifest():
    if MANIFEST_PATH.exists():
        try: return json.loads(MANIFEST_PATH.read_text())
        except: return {}
    return {}


def save_manifest(m):
    MANIFEST_PATH.write_text(json.dumps(m, indent=2))


async def gen_one(prompt, out_path, retries=2):
    for attempt in range(retries + 1):
        try:
            chat = (LlmChat(api_key=API_KEY, session_id=f"preset-{out_path.stem}-{int(time.time())}",
                            system_message="You are a comic book illustrator.")
                    .with_model("gemini", MODEL)
                    .with_params(modalities=["image", "text"]))
            text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
            if not images:
                print(f"  ! no image, retry {attempt+1}")
                continue
            out_path.write_bytes(base64.b64decode(images[0]["data"]))
            return True
        except Exception as e:
            print(f"  ! err {attempt+1}: {str(e)[:150]}")
            await asyncio.sleep(1.2)
    return False


async def main(force):
    manifest = load_manifest()
    manifest.setdefault("presets", {})
    total = ok = 0
    for pid, desc in PRESETS:
        total += 1
        out = MEDIA / f"{pid}.png"
        if out.exists() and not force:
            manifest["presets"][pid] = f"{pid}.png"
            ok += 1
            print(f"  = skip (exists) {pid}")
            continue
        prompt = f"{STYLE} {desc}"
        print(f"→ generating {pid} …")
        if await gen_one(prompt, out):
            manifest["presets"][pid] = f"{pid}.png"
            ok += 1
            print(f"  ✓ saved {pid}")
        save_manifest(manifest)
        await asyncio.sleep(0.4)
    print(f"presets: {ok}/{total}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    asyncio.run(main(args.force))
