"""Iteration 2 backend tests — currency-aware gem packs, avatar presets, story chat."""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://chat-fiction-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def token(s):
    email = f"iter2_{uuid.uuid4().hex[:8]}@delulu.dev"
    r = s.post(f"{API}/auth/signup", json={"email": email, "password": "delulu123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- currency-aware gem packs ----------
class TestGemPacksCurrency:
    def test_inr(self, s):
        r = s.get(f"{API}/gems/packs", params={"currency": "INR"})
        assert r.status_code == 200
        packs = r.json()["packs"]
        by_id = {p["id"]: p for p in packs}
        expected = {"starter": 79, "popular": 399, "best": 799, "treasure": 1499}
        for k, amt in expected.items():
            assert by_id[k]["price"]["currency"] == "INR"
            assert by_id[k]["price"]["symbol"] == "₹"
            assert by_id[k]["price"]["amount"] == amt, f"{k} expected {amt}, got {by_id[k]['price']['amount']}"

    def test_usd(self, s):
        r = s.get(f"{API}/gems/packs", params={"currency": "USD"})
        assert r.status_code == 200
        by_id = {p["id"]: p for p in r.json()["packs"]}
        expected = {"starter": 0.99, "popular": 4.99, "best": 9.99, "treasure": 19.99}
        for k, amt in expected.items():
            assert by_id[k]["price"]["currency"] == "USD"
            assert by_id[k]["price"]["symbol"] == "$"
            assert by_id[k]["price"]["amount"] == amt

    def test_unknown_falls_back_to_usd(self, s):
        r = s.get(f"{API}/gems/packs", params={"currency": "XYZ"})
        assert r.status_code == 200
        packs = r.json()["packs"]
        for p in packs:
            assert p["price"]["currency"] == "USD"
            assert p["price"]["symbol"] == "$"

    def test_supported_currencies_listed(self, s):
        r = s.get(f"{API}/gems/packs", params={"currency": "USD"})
        supported = r.json()["supportedCurrencies"]
        for c in ["USD", "INR", "EUR", "GBP", "AED", "BRL", "JPY", "CAD", "AUD", "SGD", "MXN", "PHP", "IDR"]:
            assert c in supported, f"missing {c}"


# ---------- avatar presets ----------
class TestAvatarPresets:
    def test_presets_list(self, s):
        r = s.get(f"{API}/avatar/presets")
        assert r.status_code == 200
        items = r.json()["presets"]
        assert len(items) == 6, f"expected 6 presets, got {len(items)}"
        ids = [i["id"] for i in items]
        for k in ["preset_avatar_1", "preset_avatar_2", "preset_avatar_3", "preset_avatar_4", "preset_avatar_5", "preset_avatar_6"]:
            assert k in ids
        for i in items:
            assert "imageUrl" in i
            assert "/api/media/preset_avatar_" in i["imageUrl"]
            assert i["imageUrl"].endswith(".png")

    def test_preset_image_served(self, s):
        # verify at least one is actually served
        r = s.get(f"{API}/media/preset_avatar_1.png")
        assert r.status_code == 200
        assert len(r.content) > 100

    def test_set_preset(self, s, token):
        r = s.put(
            f"{API}/avatar/preset",
            headers=_auth(token),
            json={"presetId": "preset_avatar_2", "displayName": "Kai"},
        )
        assert r.status_code == 200, r.text
        assert "imageUrl" in r.json()
        # verify persisted
        me = s.get(f"{API}/auth/me", headers=_auth(token)).json()
        assert me["avatarConfig"]["presetId"] == "preset_avatar_2"
        assert "/api/media/preset_avatar_2.png" in me["avatarConfig"]["imageUrl"]
        assert me["avatarConfig"]["displayName"] == "Kai"

    def test_set_preset_unknown_404(self, s, token):
        r = s.put(
            f"{API}/avatar/preset",
            headers=_auth(token),
            json={"presetId": "preset_avatar_99", "displayName": "Bad"},
        )
        assert r.status_code == 404


# ---------- story chat ----------
class TestStoryChat:
    def test_chat_with_rian(self, s):
        # Fresh user so quota is clean
        email = f"chat_{uuid.uuid4().hex[:8]}@delulu.dev"
        tok = s.post(f"{API}/auth/signup", json={"email": email, "password": "delulu123"}).json()["token"]
        r = s.post(
            f"{API}/story/chat",
            headers=_auth(tok),
            json={
                "storyId": "falling_for_the_enigma",
                "chapterIndex": 0,
                "characterId": "rian",
                "userMessage": "why are you being so mysterious",
                "history": [],
            },
            timeout=45,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "reply" in body and isinstance(body["reply"], str) and body["reply"].strip()
        assert "bubbles" in body and isinstance(body["bubbles"], list) and len(body["bubbles"]) >= 1
        # no literal \n\n text
        for b in body["bubbles"]:
            assert "\\n\\n" not in b, f"literal backslash-n in bubble: {b}"
            assert "\\n" not in b, f"literal backslash-n in bubble: {b}"
        # vibeScore rian incremented to 1
        assert body["vibeScore"].get("rian") == 1
        # remaining should be 3 (max 4 - used 1)
        assert body["remaining"] == 3

    def test_chat_unknown_character(self, s, token):
        r = s.post(
            f"{API}/story/chat",
            headers=_auth(token),
            json={
                "storyId": "falling_for_the_enigma",
                "chapterIndex": 0,
                "characterId": "nonexistent",
                "userMessage": "hi",
                "history": [],
            },
            timeout=15,
        )
        assert r.status_code == 400

    def test_chat_rate_limit_403_on_5th(self, s):
        email = f"chatlim_{uuid.uuid4().hex[:8]}@delulu.dev"
        tok = s.post(f"{API}/auth/signup", json={"email": email, "password": "delulu123"}).json()["token"]
        payload = {
            "storyId": "falling_for_the_enigma",
            "chapterIndex": 1,
            "characterId": "rian",
            "userMessage": "keep talking",
            "history": [],
        }
        for i in range(4):
            r = s.post(f"{API}/story/chat", headers=_auth(tok), json=payload, timeout=45)
            assert r.status_code == 200, f"call {i+1}: {r.status_code} {r.text}"
        # 5th call must be blocked
        r5 = s.post(f"{API}/story/chat", headers=_auth(tok), json=payload, timeout=15)
        assert r5.status_code == 403, f"expected 403 on 5th, got {r5.status_code} {r5.text}"
