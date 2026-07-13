# Delulu — Product Requirements Doc (v1)

## Product
Delulu is a dark-mode-only interactive fiction ("chat story") mobile app built with React Native + Expo Router. Stories unfold as comic-styled chat conversations with reactive character portraits, branching choices, key scene panels, and a persistent player avatar the user builds and dresses. Audience: 15-28. Brand voice: "chronically online bestie". Tagline: *delulu is the solulu*.

## v1 Scope (this release)

### Playable end-to-end
- **Onboarding**: 3-slide hook → genre picker → notification-ask (brand voice throughout)
- **Auth**: email/password + Emergent Google Auth (JWT bearer, `expo-secure-store`)
- **Avatar Builder**: layered live preview (body/hair/eyes/mouth/outfit/accessory) with z-index compositor, category tabs, item grid, randomize dice, name modal. Common (30g) / Rare (80g) / Iconic (200g) / Story-locked tiers. Server-authoritative purchases.
- **Home**: gems + streak topbar, flagship hero with genre gradient, genre pills, continue-reading rail, genre rails
- **Story Detail**: cover, "starring YOU" avatar slot in the character lineup, synopsis, trope tags, chapter list with lock states, sticky Start Reading CTA
- **Reader (hero surface)**: immersive full-screen with top-edge exit, tap-anywhere reveal honoring `delayMs`, typing indicator, dockable NPC portrait with 6-expression reaction system (neutral/happy/flirty/angry/shocked/sad), speech-balloon bubbles, comic SFX lettering with rotate + shadow, PLAYER avatar rendered live inline
- **Choice Moment**: dimmed backdrop, reacting character portrait, glassmorphic option cards, premium options in gold with gem cost badge and helper line; insufficient gems routes to Gems tab with a witty notice
- **Scene Panel**: full-screen takeover with genre-accent halftone burst, comic border, caption overlay, tap-to-continue
- **Chapter End**: broken-heart / genre-themed cliffhanger, live HH:MM:SS countdown, gold Unlock Now (15 gem skip) + "i'll wait" link — server-authoritative timer skip
- **Ending Share Card**: big rarity headline (RARE/EPIC/GOOD based on rarityPercent), *only X% of readers were delulu enough…* subtitle, native Share sheet
- **Gems (tab)**: daily claim strip with 7-day streak flames, streak calendar, gem packs (Starter/Popular/Best Value/Treasure Chest) via **MOCK PurchaseService** (dev button credits gems via backend; real Play Billing wires later)
- **Profile (tab)**: layered avatar showcase with edit CTA, "Lore Seeker" badge, stats trio (Stories Read / Choices Made / Gems Spent), streak card, endings collected shelf with rarity dots
- **Library / Search tabs**: continue reading + horizontal chip-row genre filter + result grid

### Backend (FastAPI + MongoDB)
- Schemas mirror the Firestore spec exactly (`stories`, `avatar_assets`, `users` with `avatarConfig/savedLooks/ownedItems/progress`)
- Server-authoritative gem mutations for premium choices (25g), skip timer (15g), avatar item buys, daily claim (+5g, weekly bonus)
- `/api/analytics` ingest for `story_start`, `chapter_complete`, `choice_made`
- Seeded: 1 flagship romance story **Falling for the Enigma** (10 chapters, 2 choice points w/ premium option, 3 endings, 2 scene panels, PLAYER messages) + 4 coming-soon covers + 15 avatar catalog assets

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
