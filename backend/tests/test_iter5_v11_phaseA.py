"""Iter5 — Delulu V1.1 Phase A backend regression.

Verifies:
1. /api/stories: exactly 32 stories, includes falling_for_the_enigma + burn_notice + s01..s30,
   legacy (the_last_signal / midnight_house / understudy) absent, every story has coverUrl 200
   (spot-check 6) and integer seedReads > 0. burn_notice + falling_for_the_enigma have seedReads > 1000.
2. Existing v1 endpoints still work post-reseed:
   - POST /api/endings/record (burn_notice:burn_burn) returns rarityPercent + endingUnlockTimes
   - POST /api/endings/share increments endingShareCounts
   - POST /api/analytics accepts `share_card_shared` event with props
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    # frontend/.env source of truth
    from pathlib import Path
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")

TEST_EMAIL = "test1@delulu.dev"
TEST_PASSWORD = "delulu123"


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api):
    # Login. Fallback to signup if 401.
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if r.status_code != 200:
        r = api.post(f"{BASE_URL}/api/auth/signup",
                     json={"email": TEST_EMAIL, "password": TEST_PASSWORD,
                           "displayName": "Test One"})
    assert r.status_code == 200, f"auth failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in {r.json()}"
    return tok


@pytest.fixture(scope="session")
def stories(api):
    r = api.get(f"{BASE_URL}/api/stories")
    assert r.status_code == 200
    return r.json()["stories"]


# ---------------- Story catalog ----------------

class TestStoryCatalog:
    def test_exactly_32_stories(self, stories):
        assert len(stories) == 32, f"expected 32 stories, got {len(stories)}"

    def test_includes_required_ids(self, stories):
        ids = {s["id"] for s in stories}
        assert "falling_for_the_enigma" in ids
        assert "burn_notice" in ids
        for n in range(1, 31):
            assert f"s{n:02d}" in ids, f"missing s{n:02d}"

    def test_legacy_ids_absent(self, stories):
        ids = {s["id"] for s in stories}
        for legacy in ("the_last_signal", "midnight_house", "understudy"):
            assert legacy not in ids, f"legacy id present: {legacy}"

    def test_every_story_has_int_seedReads_gt_zero(self, stories):
        bad = []
        for s in stories:
            v = s.get("seedReads")
            if not isinstance(v, int) or v <= 0:
                bad.append((s["id"], v))
        assert not bad, f"bad seedReads: {bad}"

    def test_flagship_seedReads_gt_1000(self, stories):
        by = {s["id"]: s for s in stories}
        assert by["burn_notice"]["seedReads"] > 1000, by["burn_notice"]["seedReads"]
        assert by["falling_for_the_enigma"]["seedReads"] > 1000, by["falling_for_the_enigma"]["seedReads"]

    def test_every_story_has_coverUrl(self, stories):
        missing = [s["id"] for s in stories if not s.get("coverUrl")]
        assert not missing, f"missing coverUrl: {missing}"

    @pytest.mark.parametrize("sid", ["burn_notice", "s01", "s10", "s13", "s20", "s30"])
    def test_cover_url_200(self, api, stories, sid):
        s = next(x for x in stories if x["id"] == sid)
        url = s["coverUrl"]
        # coverUrl may be absolute or relative to backend
        if url.startswith("/"):
            url = BASE_URL + url
        r = api.get(url, timeout=15)
        assert r.status_code == 200, f"{sid} coverUrl {url} => {r.status_code}"
        assert int(r.headers.get("content-length", "1")) > 100 or r.content, f"empty cover {sid}"


# ---------------- V1 endpoint regression ----------------

class TestEndingRecord:
    def test_record_burn_notice_burn_burn(self, api, auth_token):
        h = {"Authorization": f"Bearer {auth_token}"}
        r = api.post(f"{BASE_URL}/api/endings/record",
                     json={"storyId": "burn_notice", "endingId": "burn_burn"},
                     headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "rarityPercent" in body, body
        assert isinstance(body["rarityPercent"], (int, float))
        assert "endingUnlockTimes" in body
        key = "burn_notice:burn_burn"
        assert key in body["endingUnlockTimes"], body["endingUnlockTimes"]


class TestEndingShare:
    def test_share_increments_and_analytics_event(self, api, auth_token):
        h = {"Authorization": f"Bearer {auth_token}"}
        # Baseline via /me
        me0 = api.get(f"{BASE_URL}/api/auth/me", headers=h).json()
        prior = (me0.get("endingShareCounts") or {}).get("burn_notice:burn_burn", 0)

        r = api.post(f"{BASE_URL}/api/endings/share",
                     json={"storyId": "burn_notice", "endingId": "burn_burn",
                           "surface": "ending_wall_banner"},
                     headers=h)
        assert r.status_code == 200, r.text
        body = r.json()
        # backend historically returns shareCount top-level
        new_count = body.get("shareCount") or (body.get("endingShareCounts") or {}).get("burn_notice:burn_burn")
        assert new_count is not None, body
        assert new_count > prior, f"share did not increment: {prior} -> {new_count}"


class TestAnalyticsShareCardShared:
    def test_share_card_shared_accepted(self, api, auth_token):
        h = {"Authorization": f"Bearer {auth_token}"}
        r = api.post(f"{BASE_URL}/api/analytics",
                     json={"event": "share_card_shared",
                           "props": {"storyId": "burn_notice",
                                     "endingId": "burn_burn",
                                     "surface": "ending_wall_banner"}},
                     headers=h)
        assert r.status_code in (200, 201, 204), r.text
