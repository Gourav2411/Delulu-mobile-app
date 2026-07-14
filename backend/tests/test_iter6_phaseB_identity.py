"""Iter6 — Delulu Phase B (identity-aware story engine) backend regression.

Verifies:
1. GET/POST /api/users/identity: default (female/men), first-save analytics event
2. POST /api/story/cast: preference-based casting (masc/femme), idempotency, override wins
3. POST /api/endings/record: analytics `story_complete` includes castings prop
4. Admin endpoints: 401 without header, list of 32 stories sorted worst-first,
   validate + preview with token resolution.
"""
import os
import time
import pytest
import requests
from pathlib import Path
from pymongo import MongoClient

# --- config ---
BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().strip('"')
            break
BASE_URL = BASE_URL.rstrip("/")

ADMIN_PASS = "delulu-admin-2026"
TEST_EMAIL = "test1@delulu.dev"
TEST_PASSWORD = "delulu123"

# Mongo direct access for analytics_events verification
_MONGO_URL = None
_DB_NAME = None
for line in Path("/app/backend/.env").read_text().splitlines():
    if line.startswith("MONGO_URL="):
        _MONGO_URL = line.split("=", 1)[1].strip().strip('"')
    if line.startswith("DB_NAME="):
        _DB_NAME = line.split("=", 1)[1].strip().strip('"')

mongo = MongoClient(_MONGO_URL)
db = mongo[_DB_NAME]


# --- fixtures ---
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
    if r.status_code != 200:
        r = api.post(f"{BASE_URL}/api/auth/signup",
                     json={"email": TEST_EMAIL, "password": TEST_PASSWORD,
                           "displayName": "Test One"})
    assert r.status_code == 200, f"auth failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="session")
def user_id(auth_token, api):
    h = {"Authorization": f"Bearer {auth_token}"}
    me = api.get(f"{BASE_URL}/api/auth/me", headers=h).json()
    return me.get("user_id") or me.get("id")


@pytest.fixture
def auth_h(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture
def admin_h():
    return {"X-Admin-Pass": ADMIN_PASS}


# --- Identity ---

class TestIdentity:
    def test_get_identity_returns_shape(self, api, auth_h):
        r = api.get(f"{BASE_URL}/api/users/identity", headers=auth_h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "identity" in body
        identity = body["identity"]
        assert identity.get("playerGender") in ("female", "male", "nonbinary")
        assert identity.get("romancePreference") in ("men", "women", "everyone", "surprise")
        # storyCastings key expected in response (may be {} for new users)
        assert "storyCastings" in body

    def test_post_identity_updates_and_fires_analytics(self, api, auth_h, user_id):
        # Set to male/women
        before_ct = db.analytics_events.count_documents({
            "event": "identity_set", "user_id": user_id
        })
        r = api.post(f"{BASE_URL}/api/users/identity",
                     json={"playerGender": "male", "romancePreference": "women"},
                     headers=auth_h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("identity", {}).get("playerGender") == "male"
        assert body.get("identity", {}).get("romancePreference") == "women"
        assert "firstSave" in body

        # analytics event inserted
        after_ct = db.analytics_events.count_documents({
            "event": "identity_set", "user_id": user_id
        })
        assert after_ct == before_ct + 1, f"analytics_events not inserted: {before_ct} -> {after_ct}"

        # Verify latest event has matching props
        latest = list(db.analytics_events.find(
            {"event": "identity_set", "user_id": user_id}
        ).sort("at", -1).limit(1))
        assert latest, "no identity_set event found"
        props = latest[0].get("props") or {}
        assert props.get("playerGender") == "male"
        assert props.get("romancePreference") == "women"

    def test_reset_identity_to_female_men(self, api, auth_h):
        # Reset to female/men for downstream test stability
        r = api.post(f"{BASE_URL}/api/users/identity",
                     json={"playerGender": "female", "romancePreference": "men"},
                     headers=auth_h)
        assert r.status_code == 200
        assert r.json()["identity"]["playerGender"] == "female"
        assert r.json()["identity"]["romancePreference"] == "men"


# --- Story cast ---

class TestStoryCast:
    def test_cast_female_men_yields_masc_rian(self, api, auth_h, user_id):
        # Ensure identity=female/men
        api.post(f"{BASE_URL}/api/users/identity",
                 json={"playerGender": "female", "romancePreference": "men"},
                 headers=auth_h)
        # Clear existing storyCastings for falling_for_the_enigma so preference re-applies
        db.users.update_one(
            {"user_id": user_id},
            {"$unset": {"storyCastings.falling_for_the_enigma": ""}},
        )
        r = api.post(f"{BASE_URL}/api/story/cast",
                     json={"storyId": "falling_for_the_enigma"},
                     headers=auth_h)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        castings = body.get("castings") or {}
        assert castings.get("rian") == "masc", f"expected rian=masc, got {castings}"
        assert body.get("needsPicker") == []

    def test_cast_is_idempotent(self, api, auth_h, user_id):
        # Second call should not fire another li_cast_selected event
        before = db.analytics_events.count_documents({
            "event": "li_cast_selected", "user_id": user_id,
            "props.storyId": "falling_for_the_enigma",
        })
        r = api.post(f"{BASE_URL}/api/story/cast",
                     json={"storyId": "falling_for_the_enigma"},
                     headers=auth_h)
        assert r.status_code == 200
        after = db.analytics_events.count_documents({
            "event": "li_cast_selected", "user_id": user_id,
            "props.storyId": "falling_for_the_enigma",
        })
        assert after == before, f"second call double-fired analytics: {before} -> {after}"

    def test_cast_female_women_yields_femme_rian(self, api, auth_h, user_id):
        # Switch to women pref, wipe cast, then cast
        api.post(f"{BASE_URL}/api/users/identity",
                 json={"playerGender": "female", "romancePreference": "women"},
                 headers=auth_h)
        db.users.update_one(
            {"user_id": user_id},
            {"$unset": {"storyCastings.falling_for_the_enigma": ""}},
        )
        r = api.post(f"{BASE_URL}/api/story/cast",
                     json={"storyId": "falling_for_the_enigma"},
                     headers=auth_h)
        assert r.status_code == 200, r.text
        castings = r.json().get("castings") or {}
        assert castings.get("rian") == "femme", f"expected rian=femme, got {castings}"

        # Reset back to female/men
        api.post(f"{BASE_URL}/api/users/identity",
                 json={"playerGender": "female", "romancePreference": "men"},
                 headers=auth_h)

    def test_cast_override_wins_and_fires_source_override(self, api, auth_h, user_id):
        # From current state (rian=femme in storyCastings), send an override to masc
        # First, clear existing casting so we can observe the override newly cast
        db.users.update_one(
            {"user_id": user_id},
            {"$unset": {"storyCastings.falling_for_the_enigma": ""}},
        )
        r = api.post(f"{BASE_URL}/api/story/cast",
                     json={"storyId": "falling_for_the_enigma",
                           "castings": {"rian": "masc"}},
                     headers=auth_h)
        assert r.status_code == 200, r.text
        castings = r.json().get("castings") or {}
        assert castings.get("rian") == "masc"

        # Analytics event with source="override" recorded for this override
        ev = list(db.analytics_events.find({
            "event": "li_cast_selected", "user_id": user_id,
            "props.storyId": "falling_for_the_enigma",
            "props.source": "override",
            "props.characterId": "rian",
            "props.variant": "masc",
        }).sort("at", -1).limit(1))
        assert ev, "expected li_cast_selected with source=override"

        # DB user.storyCastings updated
        u = db.users.find_one({"user_id": user_id}, {"_id": 0, "storyCastings": 1})
        assert (u.get("storyCastings") or {}).get("falling_for_the_enigma", {}).get("rian") == "masc"


# --- Endings record analytics ---

class TestEndingsRecordAnalytics:
    def test_record_ending_inserts_story_complete_event(self, api, auth_h, user_id):
        before = db.analytics_events.count_documents({
            "event": "story_complete", "user_id": user_id,
        })
        r = api.post(f"{BASE_URL}/api/endings/record",
                     json={"storyId": "falling_for_the_enigma", "endingId": "enigma_win"},
                     headers=auth_h)
        # Some ending IDs may not exist — accept 200 or 400
        # Prefer to try burn_notice known ending if this fails
        if r.status_code != 200:
            r = api.post(f"{BASE_URL}/api/endings/record",
                         json={"storyId": "burn_notice", "endingId": "burn_burn"},
                         headers=auth_h)
        assert r.status_code == 200, r.text

        after = db.analytics_events.count_documents({
            "event": "story_complete", "user_id": user_id,
        })
        assert after > before, f"story_complete not inserted: {before} -> {after}"

        latest = list(db.analytics_events.find({
            "event": "story_complete", "user_id": user_id,
        }).sort("at", -1).limit(1))
        assert latest
        props = latest[0].get("props") or {}
        # castings prop must be populated (empty dict acceptable only if story has none)
        assert "castings" in props, f"story_complete missing castings prop: {props}"


# --- Admin ---

class TestAdmin:
    def test_no_header_returns_401(self, api):
        r = api.get(f"{BASE_URL}/api/admin/stories")
        assert r.status_code == 401, r.status_code
        assert r.json().get("detail") == "admin credentials required"

    def test_list_stories_with_admin_header(self, api, admin_h):
        r = api.get(f"{BASE_URL}/api/admin/stories", headers=admin_h)
        assert r.status_code == 200, r.text
        body = r.json()
        stories = body.get("stories")
        assert isinstance(stories, list)
        assert len(stories) == 32, f"expected 32 stories, got {len(stories)}"
        # Sorted worst-first: errors desc, warnings desc
        errs = [s["errors"] for s in stories]
        assert errs == sorted(errs, reverse=True), f"stories not sorted worst-first: {errs}"

    def test_validate_falling_for_the_enigma(self, api, admin_h):
        r = api.get(
            f"{BASE_URL}/api/admin/stories/falling_for_the_enigma/validate",
            headers=admin_h,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("canGoLive") is True
        findings = body.get("findings") or []
        codes = [f.get("code") for f in findings]
        assert any(c == "hard_coded_pronoun" for c in codes), \
            f"expected hard_coded_pronoun in findings, got {codes}"
        variant_issues = body.get("variantIssues") or []
        # Look for incomplete_portraits on rian for both masc + femme mentioning 'surprised'
        rian_surprised_masc = [
            v for v in variant_issues
            if v.get("code") == "incomplete_portraits"
            and v.get("characterId") == "rian"
            and "'masc'" in v.get("message", "")
            and "surprised" in v.get("message", "")
        ]
        rian_surprised_femme = [
            v for v in variant_issues
            if v.get("code") == "incomplete_portraits"
            and v.get("characterId") == "rian"
            and "'femme'" in v.get("message", "")
            and "surprised" in v.get("message", "")
        ]
        assert rian_surprised_masc and rian_surprised_femme, \
            f"expected incomplete_portraits on rian:surprised for masc+femme, got {variant_issues}"

    def test_preview_female_femme_yields_she(self, api, admin_h):
        r = api.post(
            f"{BASE_URL}/api/admin/preview",
            json={
                "storyId": "falling_for_the_enigma",
                "chapterIndex": 0,
                "playerGender": "female",
                "castings": {"rian": "femme"},
            },
            headers=admin_h,
        )
        assert r.status_code == 200, r.text
        msgs = r.json().get("chapter", {}).get("messages") or []
        joined = " ".join(m.get("text", "") for m in msgs)
        assert "She slides a second glass across the bar" in joined, \
            f"expected 'She slides a second glass...' in: {joined[:600]}"

    def test_preview_female_masc_yields_he(self, api, admin_h):
        r = api.post(
            f"{BASE_URL}/api/admin/preview",
            json={
                "storyId": "falling_for_the_enigma",
                "chapterIndex": 0,
                "playerGender": "female",
                "castings": {"rian": "masc"},
            },
            headers=admin_h,
        )
        assert r.status_code == 200, r.text
        msgs = r.json().get("chapter", {}).get("messages") or []
        joined = " ".join(m.get("text", "") for m in msgs)
        assert "He slides a second glass across the bar" in joined, \
            f"expected 'He slides a second glass...' in: {joined[:600]}"
