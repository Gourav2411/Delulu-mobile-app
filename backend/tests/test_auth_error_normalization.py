"""
Iteration 3 — verify FastAPI 422 shape on /api/auth/signup for invalid inputs.
The frontend fix lives in /app/frontend/src/api.js (Array.isArray(detail) → join msgs),
but we assert the backend contract that necessitated it, plus that the string-detail
paths (400/401) are unchanged.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://chat-fiction-lab.preview.emergentagent.com").rstrip("/")


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- 422 shape: list of Pydantic error dicts (this was the crash trigger) ---
def test_signup_invalid_email_returns_422_with_list_detail(client):
    r = client.post(f"{BASE_URL}/api/auth/signup", json={"email": "not-an-email", "password": "delulu123"})
    assert r.status_code == 422, r.text
    body = r.json()
    assert isinstance(body.get("detail"), list), f"expected list detail, got {type(body.get('detail'))}"
    assert body["detail"], "detail list empty"
    first = body["detail"][0]
    assert "msg" in first and "loc" in first
    # msg must be a readable string that the frontend can join
    assert "email" in first["msg"].lower()


# --- 400/401 remain string detail (regression) ---
def test_login_wrong_creds_returns_string_detail(client):
    r = client.post(f"{BASE_URL}/api/auth/login", json={"email": "nobody_xyz@delulu.dev", "password": "wrongwrong"})
    assert r.status_code == 401, r.text
    body = r.json()
    assert isinstance(body.get("detail"), str)
    assert "vibes" in body["detail"].lower() or "no account" in body["detail"].lower()


def test_signup_short_password_returns_string_detail(client):
    # Backend guards password length with a string 400, not Pydantic 422
    r = client.post(f"{BASE_URL}/api/auth/signup", json={"email": "shortpw_probe@delulu.dev", "password": "12"})
    assert r.status_code == 400, r.text
    body = r.json()
    assert isinstance(body.get("detail"), str)
    assert "6" in body["detail"] or "chars" in body["detail"].lower()
