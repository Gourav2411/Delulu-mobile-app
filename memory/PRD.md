# Delulu — Product Requirements Doc (v1)

## Product
Delulu is a dark-mode-only interactive fiction ("chat story") mobile app built with React Native + Expo Router. Stories unfold as comic-styled chat conversations with reactive character portraits, branching choices, key scene panels, and a persistent player avatar the user builds and dresses. Audience: 15-28. Brand voice: "chronically online bestie". Tagline: *delulu is the solulu*.

## v1 Scope (this release)

### Playable end-to-end
- **Onboarding**: 3-slide hook → genre picker → notification-ask (brand voice throughout)
- **Auth**: email/password + Emergent Google Auth (JWT bearer, `expo-secure-store`)
- **Avatar Builder v2 (preset-first)**: two modes — **Quick Pick** (6 AI-generated webtoon portrait presets via Nano Banana) or **Customize** (layered vector body/hair/eyes/outfit/accessory with common/rare/iconic/story-locked tiers, randomize dice, server-authoritative purchases). Preset choice writes an `imageUrl` on the user's avatarConfig; layered choice writes the `layers` map.
- **Home**: gems + streak topbar, flagship hero with genre gradient, genre pills, continue-reading rail, genre rails
- **Story Detail**: cover, "starring YOU" avatar slot in the character lineup (renders the chosen preset portrait), synopsis, trope tags, chapter list with lock states, sticky Start Reading CTA
- **Reader (hero surface)**: immersive full-screen with top-edge exit, tap-anywhere reveal honoring `delayMs`, typing indicator, dockable NPC portrait with 6-expression reaction system (neutral/happy/flirty/angry/shocked/sad), speech-balloon bubbles, comic SFX lettering with rotate + shadow, PLAYER avatar rendered live inline (preset portrait or layered composition)
- **Choice Moments**: **8 choicePoints across the 10 chapters** (chapters 1,3,4,5,7,9 each have a choice; some with premium gold options costing 25g). Free choices route via `nextMessageId`; premium options deduct gems server-side.
- **Live LLM chat with characters (new)**: at the end of each chapter the reader offers a bottom-sheet chat with the relevant NPC (Rian / Meera / Karan). Free-form typing → in-character reply via **Claude Haiku 4.5** with hand-tuned personality prompts. Two-to-three bubble replies mimic real texting rhythm. Server rate-limits to 4 exchanges per chapter per character. Every message bumps `progress.vibeScore.{characterId}` for future ending biasing.
- **Scene Panel**: full-screen takeover with genre-accent halftone burst, comic border, caption overlay, tap-to-continue
- **Chapter End**: broken-heart / genre-themed cliffhanger, live HH:MM:SS countdown, gold Unlock Now (15 gem skip) + "i'll wait" link — server-authoritative timer skip. **Chapters 1–3 free, chapter 4+ gated behind gems or 3-hour timer** (matches the "get people hooked, then charge" spec).
- **Ending Share Card**: big rarity headline (RARE/EPIC/GOOD based on rarityPercent), *only X% of readers were delulu enough…* subtitle, native Share sheet
- **Gems (tab, localized)**: daily claim strip with 7-day streak flames, streak calendar, gem packs (Starter/Popular/Best Value/Treasure Chest). **Prices auto-localize per device locale** via `expo-localization` → 13 supported currencies (USD/INR/EUR/GBP/AED/BRL/JPY/CAD/AUD/SGD/MXN/PHP/IDR). e.g., India shows `₹79 / ₹399 / ₹799 / ₹1499`; US shows `$0.99 / $4.99 / $9.99 / $19.99`. MOCK PurchaseService — real Play Billing wires later with same interface.
- **Profile (tab)**: layered avatar showcase with edit CTA, "Lore Seeker" badge, stats trio (Stories Read / Choices Made / Gems Spent), streak card, endings collected shelf with rarity dots
- **Library / Search tabs**: continue reading + horizontal chip-row genre filter + result grid

### AI content pipeline
- **`generate_assets.py`** — CLI producing NPC × 6 expression sheets + cover + scene panels via `gemini-3.1-flash-image-preview`. 21 assets seeded.
- **`generate_avatar_presets.py`** — CLI producing 6 diverse avatar portrait presets (femme/masc/androgynous, varied skin tones, distinct wardrobes). Ships with the app.
- Manifest at `/app/backend/media/manifest.json` is auto-picked up by seed.
- Assets served through k8s ingress at `GET /api/media/*.png`.

### Backend (FastAPI + MongoDB)
- Schemas mirror the Firestore spec exactly (`stories`, `avatar_assets`, `users` with `avatarConfig{layers|imageUrl|presetId, displayName}/savedLooks/ownedItems/progress{chapterIndex, choicesMade, vibeScore, chapterNCompletedAt}/chatQuota`)
- Server-authoritative gem mutations for premium choices (25g), skip timer (15g), avatar item buys, daily claim (+5g, weekly bonus)
- **`POST /api/story/chat`** — Claude Haiku 4.5 in-character replies with per-chapter server-side rate limit
- **`GET /api/gems/packs?currency=INR`** — returns per-currency pricing
- **`GET /api/avatar/presets`** + **`PUT /api/avatar/preset`** — preset picker endpoints
- `/api/analytics` ingest for `story_start`, `chapter_complete`, `choice_made`
- Seeded: 1 flagship romance story **Falling for the Enigma** (10 chapters, **8 choicePoints**, 3 endings, 2 scene panels, PLAYER messages, endChat prompts) + 4 coming-soon covers + 15 avatar catalog assets

### Phase 2/3 schema foundations (present, no UI)
- `users.username` (unique sparse), `displayAvatarPoseId`, `friendCodes[]`, `blockedUsers[]`, `reportCount`, `privacySettings`
- `friendships`, `co_read_sessions`, `user_chats` collections (indexed, unused)

## Deferred (explicit follow-ups)
- Admin web panel (backend endpoints ready — story JSON editor, avatar asset uploader, per-story metrics)
- ~~AI generation pipeline for NPC expression sets + scene panels via Nano Banana~~ ✅ **DONE** — see `/app/backend/generate_assets.py`. Produces 3 chars × 6 expressions + 1 cover + 2 scene panels using gemini-3.1-flash-image-preview. Manifest at `/app/backend/media/manifest.json`. Assets served at `/api/media/*`. Seed auto-swaps to AI URLs when manifest is present.
- Real Google Play Billing / Apple IAP via RevenueCat (native build required)
- Push notifications (Emergent-managed; requires native build)
- Offline caching of unlocked chapters
- Full closet shop UI, multi-look manager (basic save present)
- Nightly ending-rarity recalculation Cloud Function

## Non-goals for v1
- Any social/multiplayer surface (chat between users, matchmaking, co-read) — schemas exist, UI does not
- Apple Sign-In (requires native build)
- Any dating features

## Architecture rules held
1. Stories are **DATA**, never code. All flow lives in Firestore-shaped JSON.
2. The player has ONE persistent avatar across all stories.
3. User + social schemas support future multiplayer without migration.

## Success signals
- User can complete 1 full playthrough of Falling for the Enigma from onboarding to ending share
- Choice + timer + gem spend all validated server-side
- Avatar renders as "you" in the chat
