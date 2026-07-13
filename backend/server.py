"""
Delulu — Interactive Fiction Backend
FastAPI + MongoDB. All gem mutations server-authoritative.
Schema mirrors the Firestore layout in the spec so migration is a rename job later.
"""
from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
import httpx
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "delulu-dev-secret-change-me")
JWT_ALGO = "HS256"
JWT_TTL_HOURS = 24 * 30  # 30 days

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Delulu API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("delulu")


# ============================================================================
# UTILITIES
# ============================================================================

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _clean(doc):
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


def make_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}" if prefix else uuid.uuid4().hex


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def issue_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": int(utcnow().timestamp()),
        "exp": int((utcnow() + timedelta(hours=JWT_TTL_HOURS)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_user_from_token(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing token")
    token = authorization.split(" ", 1)[1].strip()

    # Try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="user not found")
        return user
    except jwt.InvalidTokenError:
        pass

    # Fall back to Emergent session token
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="invalid token")
    exp = sess.get("expires_at")
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < utcnow():
        raise HTTPException(status_code=401, detail="session expired")
    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="user not found")
    return user


# ============================================================================
# MODELS
# ============================================================================

class SignupIn(BaseModel):
    email: EmailStr
    password: str
    displayName: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class EmergentSessionIn(BaseModel):
    session_token: str


class AvatarConfig(BaseModel):
    layers: Dict[str, str] = Field(default_factory=dict)  # slotId -> assetId
    displayName: Optional[str] = None
    activePose: str = "neutral"


class SaveLookIn(BaseModel):
    name: str
    layers: Dict[str, str]


class SetAvatarIn(BaseModel):
    layers: Dict[str, str]
    displayName: Optional[str] = None


class ChoiceIn(BaseModel):
    storyId: str
    chapterId: str
    messageId: str  # choicePoint anchor
    optionIndex: int


class ProgressUpdateIn(BaseModel):
    storyId: str
    chapterIndex: int
    messageIndex: int
    choicesMade: List[Dict[str, Any]] = []


class UnlockChapterIn(BaseModel):
    storyId: str
    chapterIndex: int


class SkipTimerIn(BaseModel):
    storyId: str
    chapterIndex: int


class BuyItemIn(BaseModel):
    itemId: str


class BuyGemsIn(BaseModel):
    packId: str  # mock IAP


class CompleteChapterIn(BaseModel):
    storyId: str
    chapterIndex: int


class RecordEndingIn(BaseModel):
    storyId: str
    endingId: str


class AnalyticsIn(BaseModel):
    event: str
    props: Dict[str, Any] = {}


# ============================================================================
# INDEXES & SEED
# ============================================================================

async def ensure_indexes():
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    # Drop legacy sparse index if it exists (sparse treats explicit null as a value → dup key on signup)
    try:
        idx_info = await db.users.index_information()
        if "username_1" in idx_info:
            existing = idx_info["username_1"]
            if not existing.get("partialFilterExpression"):
                await db.users.drop_index("username_1")
    except Exception as _e:
        log.warning("username index cleanup: %s", _e)
    await db.users.create_index(
        "username",
        unique=True,
        partialFilterExpression={"username": {"$type": "string"}},
    )
    await db.user_sessions.create_index("session_token", unique=True)
    await db.stories.create_index("id", unique=True)
    await db.avatar_assets.create_index("id", unique=True)
    await db.friendships.create_index([("userA", 1), ("userB", 1)])
    await db.co_read_sessions.create_index("id", unique=True)


# ============================================================================
# AUTH
# ============================================================================

def _default_user_doc(user_id: str, email: str, display_name: str, provider: str, password_hash: Optional[str] = None) -> Dict:
    return {
        "user_id": user_id,
        "email": email,
        "displayName": display_name,
        "provider": provider,
        "passwordHash": password_hash,
        "createdAt": utcnow(),
        # Gem economy
        "gemBalance": 100,  # starter gems
        "streak": 0,
        "lastDailyClaim": None,
        # Reading
        "ownedEndings": [],
        "genrePreferences": [],
        "progress": {},  # storyId -> {chapterIndex, messageIndex, choicesMade, unlockedAt}
        # Avatar
        "avatarConfig": {"layers": {}, "activePose": "neutral", "displayName": None},
        "savedLooks": [],
        "ownedItems": [],
        # PHASE 2/3 stubs (schema present, features disabled)
        "username": None,
        "displayAvatarPoseId": "neutral",
        "friendCodes": [],
        "blockedUsers": [],
        "reportCount": 0,
        "privacySettings": {"showReading": True, "allowFriendRequests": False, "showEndings": True},
    }


@api.post("/auth/signup")
async def signup(body: SignupIn):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="that email's already delulu-ing on another account")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="password needs at least 6 chars, bestie")

    user_id = "u_" + uuid.uuid4().hex[:16]
    doc = _default_user_doc(
        user_id, email, body.displayName or email.split("@")[0], "password", hash_password(body.password)
    )
    await db.users.insert_one(doc)
    token = issue_jwt(user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "passwordHash": 0})
    return {"token": token, "user": user}


@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("passwordHash"):
        raise HTTPException(status_code=401, detail="no account with those vibes")
    if not verify_password(body.password, user["passwordHash"]):
        raise HTTPException(status_code=401, detail="that password isn't giving")
    user.pop("_id", None)
    user.pop("passwordHash", None)
    return {"token": issue_jwt(user["user_id"]), "user": user}


@api.post("/auth/emergent")
async def auth_emergent(body: EmergentSessionIn):
    """Exchange an Emergent session_id token for a Delulu session."""
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_token},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="emergent session invalid")
    data = r.json()
    email = data["email"].lower().strip()
    session_token = data.get("session_token")

    user = await db.users.find_one({"email": email})
    if not user:
        user_id = "u_" + uuid.uuid4().hex[:16]
        user = _default_user_doc(user_id, email, data.get("name") or email.split("@")[0], "google")
        user["picture"] = data.get("picture")
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"email": email}, {"$set": {"picture": data.get("picture")}})

    if session_token:
        await db.user_sessions.update_one(
            {"session_token": session_token},
            {"$set": {
                "session_token": session_token,
                "user_id": user["user_id"],
                "expires_at": utcnow() + timedelta(days=7),
                "created_at": utcnow(),
            }},
            upsert=True,
        )
    token = issue_jwt(user["user_id"])
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "passwordHash": 0})
    return {"token": token, "session_token": session_token, "user": user}


@api.get("/auth/me")
async def me(user = Depends(get_user_from_token)):
    user.pop("passwordHash", None)
    return user


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ============================================================================
# AVATAR
# ============================================================================

@api.get("/avatar/catalog")
async def avatar_catalog():
    items = await db.avatar_assets.find({}, {"_id": 0}).to_list(500)
    return {"items": items}


@api.put("/avatar/config")
async def set_avatar(body: SetAvatarIn, user = Depends(get_user_from_token)):
    update = {"avatarConfig.layers": body.layers}
    if body.displayName is not None:
        update["avatarConfig.displayName"] = body.displayName
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    return {"ok": True}


@api.post("/avatar/looks")
async def save_look(body: SaveLookIn, user = Depends(get_user_from_token)):
    look_id = "l_" + uuid.uuid4().hex[:10]
    looks = user.get("savedLooks", [])
    if len(looks) >= 5:
        # replace oldest
        looks = looks[1:]
    looks.append({"id": look_id, "name": body.name, "layers": body.layers, "createdAt": utcnow().isoformat()})
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"savedLooks": looks}})
    return {"looks": looks}


@api.delete("/avatar/looks/{look_id}")
async def delete_look(look_id: str, user = Depends(get_user_from_token)):
    looks = [l for l in user.get("savedLooks", []) if l["id"] != look_id]
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"savedLooks": looks}})
    return {"looks": looks}


@api.post("/avatar/buy-item")
async def buy_item(body: BuyItemIn, user = Depends(get_user_from_token)):
    item = await db.avatar_assets.find_one({"id": body.itemId}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="item's ghosted")
    if body.itemId in user.get("ownedItems", []):
        raise HTTPException(status_code=400, detail="already in your closet")
    if item.get("storyLockId"):
        raise HTTPException(status_code=403, detail="finish the story to unlock this fit")
    cost = int(item.get("gemCost", 0))
    if user["gemBalance"] < cost:
        raise HTTPException(status_code=402, detail="not enough gems bestie")
    new_balance = user["gemBalance"] - cost
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"gemBalance": new_balance}, "$addToSet": {"ownedItems": body.itemId}},
    )
    return {"gemBalance": new_balance, "ownedItems": user.get("ownedItems", []) + [body.itemId]}


# ============================================================================
# STORIES
# ============================================================================

@api.get("/stories")
async def list_stories():
    stories = await db.stories.find({"status": {"$ne": "hidden"}}, {"_id": 0}).to_list(200)
    return {"stories": stories}


@api.get("/stories/{story_id}")
async def get_story(story_id: str):
    story = await db.stories.find_one({"id": story_id}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="story not found")
    return story


@api.post("/progress")
async def update_progress(body: ProgressUpdateIn, user = Depends(get_user_from_token)):
    progress = user.get("progress", {}) or {}
    cur = progress.get(body.storyId, {})
    progress[body.storyId] = {
        **cur,
        "chapterIndex": body.chapterIndex,
        "messageIndex": body.messageIndex,
        "choicesMade": body.choicesMade or cur.get("choicesMade", []),
        "updatedAt": utcnow().isoformat(),
    }
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"progress": progress}})
    return {"progress": progress[body.storyId]}


@api.post("/progress/choice")
async def record_choice(body: ChoiceIn, user = Depends(get_user_from_token)):
    story = await db.stories.find_one({"id": body.storyId}, {"_id": 0})
    if not story:
        raise HTTPException(status_code=404, detail="story not found")
    # Find the choicePoint
    chapter = next((c for c in story["chapters"] if c["id"] == body.chapterId), None)
    if not chapter:
        raise HTTPException(status_code=404, detail="chapter not found")
    msg = next((m for m in chapter["messages"] if m["id"] == body.messageId), None)
    if not msg or not msg.get("choicePoint"):
        raise HTTPException(status_code=400, detail="not a choice point")
    options = msg["choicePoint"]["options"]
    if body.optionIndex < 0 or body.optionIndex >= len(options):
        raise HTTPException(status_code=400, detail="bad option index")
    option = options[body.optionIndex]
    new_balance = user["gemBalance"]
    if option.get("isPremium"):
        cost = int(option.get("gemCost", 25))
        if user["gemBalance"] < cost:
            raise HTTPException(status_code=402, detail="not enough gems for the delulu path")
        new_balance = user["gemBalance"] - cost
    progress = user.get("progress", {}) or {}
    cur = progress.get(body.storyId, {"chapterIndex": 0, "messageIndex": 0, "choicesMade": []})
    cur["choicesMade"] = (cur.get("choicesMade") or []) + [{
        "chapterId": body.chapterId,
        "messageId": body.messageId,
        "optionIndex": body.optionIndex,
        "endingWeight": option.get("endingWeight", {}),
        "isPremium": bool(option.get("isPremium")),
        "at": utcnow().isoformat(),
    }]
    progress[body.storyId] = cur
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"gemBalance": new_balance, "progress": progress}},
    )
    return {"gemBalance": new_balance, "nextMessageId": option.get("nextMessageId")}


@api.post("/chapters/unlock")
async def unlock_chapter(body: UnlockChapterIn, user = Depends(get_user_from_token)):
    """Free unlock — validates the 3-hour timer server-side."""
    if body.chapterIndex < 3:
        # first 3 chapters are always free
        return {"ok": True, "gemBalance": user["gemBalance"]}
    progress = user.get("progress", {}) or {}
    p = progress.get(body.storyId, {})
    completed_at_raw = p.get(f"chapter{body.chapterIndex - 1}CompletedAt")
    if not completed_at_raw:
        raise HTTPException(status_code=400, detail="finish the previous chapter first")
    completed_at = datetime.fromisoformat(completed_at_raw)
    if completed_at.tzinfo is None:
        completed_at = completed_at.replace(tzinfo=timezone.utc)
    unlocks_at = completed_at + timedelta(hours=3)
    if utcnow() < unlocks_at:
        raise HTTPException(status_code=403, detail=f"still cooking. unlocks at {unlocks_at.isoformat()}")
    return {"ok": True, "gemBalance": user["gemBalance"]}


@api.post("/chapters/skip-timer")
async def skip_timer(body: SkipTimerIn, user = Depends(get_user_from_token)):
    COST = 15
    if user["gemBalance"] < COST:
        raise HTTPException(status_code=402, detail="not enough gems to skip")
    new_balance = user["gemBalance"] - COST
    progress = user.get("progress", {}) or {}
    p = progress.get(body.storyId, {})
    # backdate the previous chapter completion to 3h+1min ago so unlock passes
    p[f"chapter{body.chapterIndex - 1}CompletedAt"] = (utcnow() - timedelta(hours=3, minutes=1)).isoformat()
    progress[body.storyId] = p
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"gemBalance": new_balance, "progress": progress}},
    )
    return {"ok": True, "gemBalance": new_balance}


@api.post("/chapters/complete")
async def complete_chapter(body: CompleteChapterIn, user = Depends(get_user_from_token)):
    progress = user.get("progress", {}) or {}
    p = progress.get(body.storyId, {"chapterIndex": 0, "messageIndex": 0, "choicesMade": []})
    p[f"chapter{body.chapterIndex}CompletedAt"] = utcnow().isoformat()
    p["chapterIndex"] = body.chapterIndex + 1
    p["messageIndex"] = 0
    progress[body.storyId] = p
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"progress": progress}})
    server_ts = utcnow().isoformat()
    unlocks_at = (utcnow() + timedelta(hours=3)).isoformat()
    return {"ok": True, "serverTime": server_ts, "unlocksAt": unlocks_at}


@api.post("/endings/record")
async def record_ending(body: RecordEndingIn, user = Depends(get_user_from_token)):
    key = f"{body.storyId}:{body.endingId}"
    owned = user.get("ownedEndings", [])
    if key not in owned:
        owned.append(key)
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"ownedEndings": owned}})
    await db.ending_completions.insert_one({
        "storyId": body.storyId,
        "endingId": body.endingId,
        "user_id": user["user_id"],
        "at": utcnow(),
    })
    # rarity is stored on the ending itself; return it
    story = await db.stories.find_one({"id": body.storyId}, {"_id": 0, "endings": 1})
    rarity = 0
    if story:
        ending = next((e for e in story["endings"] if e["id"] == body.endingId), None)
        rarity = int(ending.get("rarityPercent", 0)) if ending else 0
    return {"ok": True, "ownedEndings": owned, "rarityPercent": rarity}


# ============================================================================
# GEM ECONOMY: DAILY / PACKS
# ============================================================================

GEM_PACKS = {
    "starter": {"gems": 80, "usd": 0.99, "label": "Starter"},
    "popular": {"gems": 500, "usd": 4.99, "label": "Popular"},
    "best": {"gems": 1200, "usd": 9.99, "label": "Best Value"},
    "treasure": {"gems": 3000, "usd": 19.99, "label": "Treasure Chest"},
}


@api.get("/gems/packs")
async def gem_packs():
    return {"packs": [{"id": k, **v} for k, v in GEM_PACKS.items()]}


@api.post("/gems/daily-claim")
async def daily_claim(user = Depends(get_user_from_token)):
    now = utcnow()
    last = user.get("lastDailyClaim")
    streak = int(user.get("streak", 0))
    if last:
        if isinstance(last, str):
            last = datetime.fromisoformat(last)
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        # same day already claimed
        if (now - last).total_seconds() < 20 * 3600:
            raise HTTPException(status_code=429, detail="already claimed today, greedy queen")
        # if more than 48h gap, streak resets
        streak = streak + 1 if (now - last).total_seconds() < 48 * 3600 else 1
    else:
        streak = 1
    bonus = 5 + (5 if streak % 7 == 0 else 0)  # weekly bonus
    new_balance = int(user["gemBalance"]) + bonus
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"gemBalance": new_balance, "streak": streak, "lastDailyClaim": now}},
    )
    return {"gemBalance": new_balance, "streak": streak, "awarded": bonus}


@api.post("/gems/buy-mock")
async def buy_gems_mock(body: BuyGemsIn, user = Depends(get_user_from_token)):
    """MOCK IAP. Real Play Billing/App Store wiring lives behind PurchaseService on the client."""
    pack = GEM_PACKS.get(body.packId)
    if not pack:
        raise HTTPException(status_code=400, detail="unknown pack")
    new_balance = int(user["gemBalance"]) + int(pack["gems"])
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"gemBalance": new_balance}})
    return {"gemBalance": new_balance, "awarded": pack["gems"]}


# ============================================================================
# ANALYTICS
# ============================================================================

@api.post("/analytics")
async def analytics(body: AnalyticsIn, request: Request):
    doc = {
        "id": make_id("ev_"),
        "event": body.event,
        "props": body.props,
        "at": utcnow(),
        "ip": request.client.host if request.client else None,
    }
    # Attach user if authorized
    auth = request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        try:
            payload = jwt.decode(auth.split(" ", 1)[1], JWT_SECRET, algorithms=[JWT_ALGO])
            doc["user_id"] = payload["sub"]
        except Exception:
            pass
    await db.analytics_events.insert_one(doc)
    return {"ok": True}


# ============================================================================
# HEALTH
# ============================================================================

@api.get("/")
async def health():
    return {"ok": True, "service": "delulu", "time": utcnow().isoformat()}


# ============================================================================
# APP WIRING
# ============================================================================

app.include_router(api)

# Static media mount for AI-generated portraits + panels.
# Prefixed with /api/media so k8s ingress routes it to backend.
MEDIA_DIR = ROOT_DIR / "media"
MEDIA_DIR.mkdir(exist_ok=True)
app.mount("/api/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await ensure_indexes()
    # seed on startup if empty
    from seed_data import seed_all
    await seed_all(db)
    log.info("delulu backend ready")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
