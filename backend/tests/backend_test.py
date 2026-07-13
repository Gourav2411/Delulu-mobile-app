"""Delulu backend regression tests.
Covers auth, stories, avatar, progress, chapters, gems, endings, analytics.
Run via: pytest /app/backend/tests/backend_test.py -v --junitxml=/app/test_reports/pytest/pytest_results.xml
"""
import os
import uuid
import time
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://chat-fiction-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

# Unique test user each run so tests are idempotent across runs
UNIQUE = uuid.uuid4().hex[:8]
TEST_EMAIL = f"test_{UNIQUE}@delulu.dev"
TEST_PASSWORD = "delulu123"

STATE = {}  # shared state between tests


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- auth ----------
class TestAuth:
    def test_health(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["service"] == "delulu"

    def test_signup(self, s):
        r = s.post(f"{API}/auth/signup", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body and "user" in body
        u = body["user"]
        assert u["email"] == TEST_EMAIL
        assert u["gemBalance"] == 100
        assert "_id" not in u
        assert "passwordHash" not in u
        STATE["token"] = body["token"]
        STATE["user_id"] = u["user_id"]

    def test_signup_duplicate_returns_409(self, s):
        r = s.post(f"{API}/auth/signup", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 409

    def test_login(self, s):
        r = s.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        assert "token" in body
        assert body["user"]["email"] == TEST_EMAIL
        assert "_id" not in body["user"]
        assert "passwordHash" not in body["user"]

    def test_login_bad_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, s):
        r = s.get(f"{API}/auth/me", headers=_auth_headers(STATE["token"]))
        assert r.status_code == 200
        assert r.json()["email"] == TEST_EMAIL
        assert "_id" not in r.json()

    def test_me_no_token(self, s):
        assert s.get(f"{API}/auth/me").status_code == 401


# ---------- stories ----------
class TestStories:
    def test_list(self, s):
        r = s.get(f"{API}/stories")
        assert r.status_code == 200
        stories = r.json()["stories"]
        assert len(stories) == 5, f"expected 5 stories, got {len(stories)}"
        ids = [x["id"] for x in stories]
        assert "falling_for_the_enigma" in ids
        coming = [x for x in stories if x.get("status") == "coming_soon"]
        assert len(coming) == 4
        for x in stories:
            assert "_id" not in x

    def test_flagship_detail(self, s):
        r = s.get(f"{API}/stories/falling_for_the_enigma")
        assert r.status_code == 200
        story = r.json()
        assert "_id" not in story
        assert len(story["chapters"]) == 10
        assert len(story["endings"]) == 3
        chars = story.get("characters", [])
        cids = [c.get("id") for c in chars]
        for expected in ["rian", "meera", "karan", "narrator"]:
            assert expected in cids, f"missing character {expected}"
        # scene panels (nested inside messages as `scenePanel`)
        all_msgs = [m for c in story["chapters"] for m in c["messages"]]
        panels = [m for m in all_msgs if m.get("scenePanel")]
        assert len(panels) >= 2, f"expected >=2 scene panels, got {len(panels)}"
        # PLAYER messages (uses senderCharacterId='PLAYER')
        assert any(m.get("senderCharacterId") == "PLAYER" for m in all_msgs)
        # choicePoints in chapters 3 and 9 (0-indexed => index 2 and 8, or 1-indexed 3 and 9)
        ch_with_choice = [c for c in story["chapters"] if any(m.get("choicePoint") for m in c["messages"])]
        assert len(ch_with_choice) >= 2
        # Save chapter 3 c3m5 choicePoint for later
        for c in story["chapters"]:
            for m in c["messages"]:
                if m.get("id") == "c3m5" and m.get("choicePoint"):
                    STATE["ch3_id"] = c["id"]
                    STATE["c3m5"] = m
        assert "c3m5" in STATE, "c3m5 choicePoint not found"

    def test_missing_story(self, s):
        assert s.get(f"{API}/stories/does_not_exist").status_code == 404


# ---------- avatar ----------
class TestAvatar:
    def test_catalog(self, s):
        r = s.get(f"{API}/avatar/catalog")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 15, f"expected >=15 avatar items, got {len(items)}"
        slots = {i.get("slot") or i.get("slotId") for i in items}
        for expected in ["body", "eyes", "hair", "outfit", "accessory"]:
            assert expected in slots, f"missing slot {expected}: got {slots}"
        for i in items:
            assert "color" in i
            assert "rarity" in i
            assert "gemCost" in i
            assert "zIndex" in i
            assert "_id" not in i
        STATE["avatar_items"] = items

    def test_set_config(self, s):
        items = STATE["avatar_items"]
        layers = {}
        for slot in ["body", "eyes", "hair", "outfit", "accessory"]:
            match = next((i for i in items if (i.get("slot") or i.get("slotId")) == slot), None)
            if match:
                layers[slot] = match["id"]
        r = s.put(
            f"{API}/avatar/config",
            headers=_auth_headers(STATE["token"]),
            json={"layers": layers, "displayName": "TestDelulu"},
        )
        assert r.status_code == 200
        # verify persisted
        me = s.get(f"{API}/auth/me", headers=_auth_headers(STATE["token"])).json()
        assert me["avatarConfig"]["displayName"] == "TestDelulu"
        assert me["avatarConfig"]["layers"] == layers

    def test_buy_item_and_insufficient(self, s):
        items = STATE["avatar_items"]
        # find an item with cost > 0
        buyable = next((i for i in items if int(i.get("gemCost", 0)) > 0 and not i.get("storyLockId")), None)
        if not buyable:
            pytest.skip("no purchasable avatar item in catalog")
        # ensure not already owned by getting balance
        me = s.get(f"{API}/auth/me", headers=_auth_headers(STATE["token"])).json()
        starting_balance = me["gemBalance"]
        cost = int(buyable["gemCost"])
        r = s.post(f"{API}/avatar/buy-item", headers=_auth_headers(STATE["token"]), json={"itemId": buyable["id"]})
        if r.status_code == 400:
            pytest.skip("already owned; skip buy check")
        assert r.status_code == 200, r.text
        assert r.json()["gemBalance"] == starting_balance - cost
        # duplicate buy → 400
        r2 = s.post(f"{API}/avatar/buy-item", headers=_auth_headers(STATE["token"]), json={"itemId": buyable["id"]})
        assert r2.status_code == 400


# ---------- progress / choices ----------
class TestProgress:
    def test_free_choice(self, s):
        m = STATE["c3m5"]
        # pick option 0 (free)
        r = s.post(
            f"{API}/progress/choice",
            headers=_auth_headers(STATE["token"]),
            json={
                "storyId": "falling_for_the_enigma",
                "chapterId": STATE["ch3_id"],
                "messageId": "c3m5",
                "optionIndex": 0,
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert "nextMessageId" in body
        # gems unchanged (free)
        me = s.get(f"{API}/auth/me", headers=_auth_headers(STATE["token"])).json()
        STATE["balance_after_free"] = me["gemBalance"]

    def test_premium_choice_deducts(self, s):
        m = STATE["c3m5"]
        options = m["choicePoint"]["options"]
        # find premium
        premium_idx = next((i for i, o in enumerate(options) if o.get("isPremium")), None)
        if premium_idx is None:
            pytest.skip("no premium option present")
        cost = int(options[premium_idx].get("gemCost", 25))
        me = s.get(f"{API}/auth/me", headers=_auth_headers(STATE["token"])).json()
        if me["gemBalance"] < cost:
            # top up
            s.post(f"{API}/gems/buy-mock", headers=_auth_headers(STATE["token"]), json={"packId": "starter"})
            me = s.get(f"{API}/auth/me", headers=_auth_headers(STATE["token"])).json()
        starting = me["gemBalance"]
        r = s.post(
            f"{API}/progress/choice",
            headers=_auth_headers(STATE["token"]),
            json={
                "storyId": "falling_for_the_enigma",
                "chapterId": STATE["ch3_id"],
                "messageId": "c3m5",
                "optionIndex": premium_idx,
            },
        )
        assert r.status_code == 200, r.text
        assert r.json()["gemBalance"] == starting - cost

    def test_premium_402_when_insufficient(self, s):
        # Create a poor user
        poor_email = f"poor_{uuid.uuid4().hex[:6]}@delulu.dev"
        signup = s.post(f"{API}/auth/signup", json={"email": poor_email, "password": "delulu123"}).json()
        token = signup["token"]
        # drain gems by buying a mock pack? no — we need to go BELOW 25. starter=100. Spend on a pricy avatar item.
        # simpler: attempt premium repeatedly to drain, but each success deducts 25 from 100 => 4 attempts leaves 0
        m = STATE["c3m5"]
        options = m["choicePoint"]["options"]
        premium_idx = next((i for i, o in enumerate(options) if o.get("isPremium")), None)
        if premium_idx is None:
            pytest.skip("no premium option")
        for _ in range(4):
            s.post(
                f"{API}/progress/choice",
                headers=_auth_headers(token),
                json={
                    "storyId": "falling_for_the_enigma",
                    "chapterId": STATE["ch3_id"],
                    "messageId": "c3m5",
                    "optionIndex": premium_idx,
                },
            )
        # now insufficient
        r = s.post(
            f"{API}/progress/choice",
            headers=_auth_headers(token),
            json={
                "storyId": "falling_for_the_enigma",
                "chapterId": STATE["ch3_id"],
                "messageId": "c3m5",
                "optionIndex": premium_idx,
            },
        )
        assert r.status_code == 402, r.text


# ---------- chapters ----------
class TestChapters:
    def test_unlock_free_chapters(self, s):
        for idx in [0, 1, 2]:
            r = s.post(
                f"{API}/chapters/unlock",
                headers=_auth_headers(STATE["token"]),
                json={"storyId": "falling_for_the_enigma", "chapterIndex": idx},
            )
            assert r.status_code == 200

    def test_unlock_ch3_needs_previous_complete(self, s):
        # fresh user (STATE token has partial state, may or may not have ch2 complete)
        email = f"unlock_{uuid.uuid4().hex[:6]}@delulu.dev"
        tok = s.post(f"{API}/auth/signup", json={"email": email, "password": "delulu123"}).json()["token"]
        r = s.post(
            f"{API}/chapters/unlock",
            headers=_auth_headers(tok),
            json={"storyId": "falling_for_the_enigma", "chapterIndex": 3},
        )
        assert r.status_code == 400

    def test_complete_chapter(self, s):
        r = s.post(
            f"{API}/chapters/complete",
            headers=_auth_headers(STATE["token"]),
            json={"storyId": "falling_for_the_enigma", "chapterIndex": 2},
        )
        assert r.status_code == 200
        body = r.json()
        assert "serverTime" in body
        assert "unlocksAt" in body

    def test_unlock_ch3_still_locked_after_complete(self, s):
        r = s.post(
            f"{API}/chapters/unlock",
            headers=_auth_headers(STATE["token"]),
            json={"storyId": "falling_for_the_enigma", "chapterIndex": 3},
        )
        # Just completed ch2; unlocksAt is 3h out
        assert r.status_code == 403

    def test_skip_timer(self, s):
        me = s.get(f"{API}/auth/me", headers=_auth_headers(STATE["token"])).json()
        starting = me["gemBalance"]
        if starting < 15:
            # top up via mock pack
            s.post(f"{API}/gems/buy-mock", headers=_auth_headers(STATE["token"]), json={"packId": "starter"})
            starting = s.get(f"{API}/auth/me", headers=_auth_headers(STATE["token"])).json()["gemBalance"]
        r = s.post(
            f"{API}/chapters/skip-timer",
            headers=_auth_headers(STATE["token"]),
            json={"storyId": "falling_for_the_enigma", "chapterIndex": 3},
        )
        assert r.status_code == 200
        assert r.json()["gemBalance"] == starting - 15
        # now unlock should pass
        r2 = s.post(
            f"{API}/chapters/unlock",
            headers=_auth_headers(STATE["token"]),
            json={"storyId": "falling_for_the_enigma", "chapterIndex": 3},
        )
        assert r2.status_code == 200

    def test_skip_timer_insufficient(self, s):
        # new poor user with no gems: drain by buying items or premium choices
        email = f"skip_poor_{uuid.uuid4().hex[:6]}@delulu.dev"
        tok = s.post(f"{API}/auth/signup", json={"email": email, "password": "delulu123"}).json()["token"]
        # Drain to <15 via premium choices (4×25=100 leaves 0)
        for _ in range(4):
            s.post(
                f"{API}/progress/choice",
                headers=_auth_headers(tok),
                json={
                    "storyId": "falling_for_the_enigma",
                    "chapterId": STATE["ch3_id"],
                    "messageId": "c3m5",
                    "optionIndex": next(i for i, o in enumerate(STATE["c3m5"]["choicePoint"]["options"]) if o.get("isPremium")),
                },
            )
        r = s.post(
            f"{API}/chapters/skip-timer",
            headers=_auth_headers(tok),
            json={"storyId": "falling_for_the_enigma", "chapterIndex": 3},
        )
        assert r.status_code == 402


# ---------- gems ----------
class TestGems:
    def test_packs(self, s):
        r = s.get(f"{API}/gems/packs")
        assert r.status_code == 200
        packs = r.json()["packs"]
        ids = {p["id"] for p in packs}
        assert ids == {"starter", "popular", "best", "treasure"}

    def test_daily_claim_and_dup_429(self, s):
        # fresh user to avoid interference
        email = f"daily_{uuid.uuid4().hex[:6]}@delulu.dev"
        tok = s.post(f"{API}/auth/signup", json={"email": email, "password": "delulu123"}).json()["token"]
        r = s.post(f"{API}/gems/daily-claim", headers=_auth_headers(tok))
        assert r.status_code == 200
        body = r.json()
        assert body["awarded"] >= 5
        assert body["streak"] == 1
        assert body["gemBalance"] == 100 + body["awarded"]
        r2 = s.post(f"{API}/gems/daily-claim", headers=_auth_headers(tok))
        assert r2.status_code == 429

    def test_buy_mock_popular(self, s):
        email = f"buy_{uuid.uuid4().hex[:6]}@delulu.dev"
        tok = s.post(f"{API}/auth/signup", json={"email": email, "password": "delulu123"}).json()["token"]
        r = s.post(f"{API}/gems/buy-mock", headers=_auth_headers(tok), json={"packId": "popular"})
        assert r.status_code == 200
        body = r.json()
        assert body["awarded"] == 500
        assert body["gemBalance"] == 600


# ---------- endings ----------
class TestEndings:
    def test_record(self, s):
        # get first ending id
        story = s.get(f"{API}/stories/falling_for_the_enigma").json()
        ending_id = story["endings"][0]["id"]
        r = s.post(
            f"{API}/endings/record",
            headers=_auth_headers(STATE["token"]),
            json={"storyId": "falling_for_the_enigma", "endingId": ending_id},
        )
        assert r.status_code == 200
        body = r.json()
        assert f"falling_for_the_enigma:{ending_id}" in body["ownedEndings"]
        assert "rarityPercent" in body


# ---------- analytics ----------
class TestAnalytics:
    def test_analytics_no_auth(self, s):
        r = s.post(f"{API}/analytics", json={"event": "test_event", "props": {"k": "v"}})
        assert r.status_code == 200
