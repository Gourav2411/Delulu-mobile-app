"""Iteration 4 backend regression — catalog merge, burn_notice cover,
endings/record with unlock times, endings/share with analytics event,
analytics endpoint sanity, chapter/choice smoke."""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://chat-fiction-lab.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

# Prefer the seeded test user (referenced in /app/memory/test_credentials.md);
# fall back to a signup if login fails so the suite is idempotent.
SEED_EMAIL = "test1@delulu.dev"
SEED_PASSWORD = "delulu123"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def token(s):
    r = s.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASSWORD})
    if r.status_code == 200:
        return r.json()["token"]
    # Fallback: sign up a fresh user
    email = f"iter4_{uuid.uuid4().hex[:8]}@delulu.dev"
    r2 = s.post(f"{API}/auth/signup", json={"email": email, "password": "delulu123"})
    assert r2.status_code == 200, r2.text
    return r2.json()["token"]


def _auth(t):
    return {"Authorization": f"Bearer {t}"}


# ---------- Task 1: catalog merge + burn_notice cover ----------
class TestCatalogMerge:
    def test_stories_list_contains_catalog(self, s):
        r = s.get(f"{API}/stories")
        assert r.status_code == 200
        stories = r.json()["stories"]
        assert len(stories) >= 33, f"expected >=33 stories, got {len(stories)}"
        ids = {x["id"] for x in stories}
        # local flagship + burn_notice
        assert "falling_for_the_enigma" in ids
        assert "burn_notice" in ids
        # 30 catalog entries s01..s30
        for i in range(1, 31):
            sid = f"s{i:02d}"
            assert sid in ids, f"missing catalog story {sid}"
        # no leaked mongo _id
        for x in stories:
            assert "_id" not in x

    def test_burn_notice_cover_url_and_reachable(self, s):
        r = s.get(f"{API}/stories/burn_notice")
        assert r.status_code == 200
        story = r.json()
        cover = story.get("coverUrl", "")
        assert cover.endswith("/api/media/cover_burn_notice.png"), f"unexpected coverUrl: {cover}"
        # verify the media is actually served
        rc = s.get(cover if cover.startswith("http") else f"{BASE}{cover}")
        assert rc.status_code == 200
        assert len(rc.content) > 1000

    def test_s01_s30_have_three_endings_and_coming_soon(self, s):
        r = s.get(f"{API}/stories")
        assert r.status_code == 200
        by_id = {x["id"]: x for x in r.json()["stories"]}
        # List endpoint may not include full endings — fetch each detail
        missing_endings = []
        wrong_status = []
        for i in range(1, 31):
            sid = f"s{i:02d}"
            det = s.get(f"{API}/stories/{sid}")
            assert det.status_code == 200, f"detail 404 for {sid}"
            j = det.json()
            endings = j.get("endings", [])
            if len(endings) != 3:
                missing_endings.append((sid, len(endings)))
            status = j.get("status") or by_id[sid].get("status")
            if status != "coming_soon":
                wrong_status.append((sid, status))
        assert not missing_endings, f"stories with != 3 endings: {missing_endings}"
        assert not wrong_status, f"stories not coming_soon: {wrong_status}"


# ---------- Task 2: endings/record writes unlock times + rarityPercent ----------
class TestEndingRecord:
    def test_record_burn_notice_burn_burn(self, s, token):
        r = s.post(
            f"{API}/endings/record",
            headers=_auth(token),
            json={"storyId": "burn_notice", "endingId": "burn_burn"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert "rarityPercent" in body and isinstance(body["rarityPercent"], int)
        assert isinstance(body.get("endingUnlockTimes"), dict)
        assert "burn_notice:burn_burn" in body["endingUnlockTimes"]
        ts = body["endingUnlockTimes"]["burn_notice:burn_burn"]
        # basic ISO-like check
        assert isinstance(ts, str) and "T" in ts and len(ts) >= 15, f"unexpected ts: {ts}"

    def test_me_reflects_ownership_and_unlock_times(self, s, token):
        me = s.get(f"{API}/auth/me", headers=_auth(token)).json()
        assert "burn_notice:burn_burn" in me.get("ownedEndings", [])
        ut = me.get("endingUnlockTimes", {})
        assert "burn_notice:burn_burn" in ut
        assert isinstance(ut["burn_notice:burn_burn"], str)


# ---------- Task 3: endings/share increments and logs analytics ----------
class TestEndingShareAndAnalytics:
    def test_share_increments_and_analytics_row(self, s, token):
        # Baseline count
        me0 = s.get(f"{API}/auth/me", headers=_auth(token)).json()
        base = int(me0.get("endingShareCounts", {}).get("burn_notice:burn_burn", 0))

        payload = {
            "storyId": "burn_notice",
            "endingId": "burn_burn",
            "surface": "ending_wall_banner",
        }
        r1 = s.post(f"{API}/endings/share", headers=_auth(token), json=payload)
        assert r1.status_code == 200, r1.text
        b1 = r1.json()
        assert b1["ok"] is True
        assert b1["shareCount"] == base + 1
        assert "burn_notice:burn_burn" in b1["endingShareCounts"]

        r2 = s.post(f"{API}/endings/share", headers=_auth(token), json=payload)
        assert r2.status_code == 200
        assert r2.json()["shareCount"] == base + 2

        r3 = s.post(f"{API}/endings/share", headers=_auth(token), json=payload)
        assert r3.status_code == 200
        assert r3.json()["shareCount"] == base + 3

        # persistence via /me
        me = s.get(f"{API}/auth/me", headers=_auth(token)).json()
        assert me["endingShareCounts"]["burn_notice:burn_burn"] == base + 3


# ---------- Task 4: analytics still works ----------
class TestAnalyticsEndpoint:
    def test_analytics_no_auth_ok(self, s):
        r = s.post(f"{API}/analytics", json={
            "event": "iter4_regression_event",
            "props": {"k": "v", "n": 42},
        })
        assert r.status_code == 200

    def test_analytics_with_auth(self, s, token):
        r = s.post(
            f"{API}/analytics",
            headers=_auth(token),
            json={"event": "iter4_auth_event", "props": {"foo": "bar"}},
        )
        assert r.status_code == 200


# ---------- Task 5: chapter/complete + choice sanity smoke ----------
class TestChapterAndChoiceSmoke:
    def test_choice_free_and_complete_flow(self, s):
        # fresh user so state is clean
        email = f"iter4smoke_{uuid.uuid4().hex[:8]}@delulu.dev"
        tok = s.post(f"{API}/auth/signup", json={"email": email, "password": "delulu123"}).json()["token"]
        # find c3m5 choicePoint via flagship story
        story = s.get(f"{API}/stories/falling_for_the_enigma").json()
        c3m5, ch3_id = None, None
        for c in story["chapters"]:
            for m in c["messages"]:
                if m.get("id") == "c3m5" and m.get("choicePoint"):
                    c3m5 = m
                    ch3_id = c["id"]
        assert c3m5 is not None and ch3_id is not None

        # unlock 0,1,2 then complete 2
        for idx in [0, 1, 2]:
            r = s.post(f"{API}/chapters/unlock", headers=_auth(tok),
                       json={"storyId": "falling_for_the_enigma", "chapterIndex": idx})
            assert r.status_code == 200, f"unlock {idx}: {r.text}"
        # free choice on c3m5 (option 0)
        r = s.post(f"{API}/progress/choice", headers=_auth(tok), json={
            "storyId": "falling_for_the_enigma",
            "chapterId": ch3_id,
            "messageId": "c3m5",
            "optionIndex": 0,
        })
        assert r.status_code == 200, r.text
        assert "nextMessageId" in r.json()

        # complete chapter 2
        r2 = s.post(f"{API}/chapters/complete", headers=_auth(tok),
                    json={"storyId": "falling_for_the_enigma", "chapterIndex": 2})
        assert r2.status_code == 200
        body = r2.json()
        assert "serverTime" in body and "unlocksAt" in body
