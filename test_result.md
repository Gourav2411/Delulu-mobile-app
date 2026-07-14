#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================
## user_problem_statement:
User uploaded delulu_catalog.json + chapter_generation_prompt.md and requested 5 additive tasks:
(1) integrate catalog and prompt docs, (2) generate a real Burn Notice cover, (3) small progress
ring on the Ending Wall card, (4) cycling banner between rarest/newest/most-shared, (5) fire a
share_card_shared analytics event when the share sheet closes.

## backend:
  - task: "Catalog merge (delulu_catalog.json → db.stories)"
    implemented: true
    working: true
    file: "/app/backend/seed_data.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Additively merges 30 catalog stories at seed time. s01 has 1 chapter → coming_soon (needs 3+ chapters to go live). Local IDs falling_for_the_enigma & burn_notice remain source of truth. /api/stories now returns 35 stories total."

  - task: "/api/endings/share endpoint + endingShareCounts/endingUnlockTimes on user"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "New endpoint increments per-ending share count on the user and logs a share_card_shared event to db.analytics_events. record_ending also stores endingUnlockTimes for the newest-banner rotation. Verified via curl."

  - task: "Burn Notice cover generation (Nano Banana)"
    implemented: true
    working: true
    file: "/app/backend/generate_assets.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "Added SCENES.cover_burn_notice thriller-noir prompt and updated gen_cover to produce it. cover_burn_notice.png generated (684KB) and served at /api/media/cover_burn_notice.png. Reflected via manifest.covers.burn_notice."

## frontend:
  - task: "Ending Wall — progress ring + cycling banner + share analytics"
    implemented: true
    working: true
    file: "/app/frontend/app/endings.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Header now has SVG progress ring (X/Y over live-story endings). Featured banner cycles between YOUR RAREST / JUST UNLOCKED / MOST SHARED every 4s with fade transition and dot indicators. Share tap fires analyticsApi.track('share_card_shared', {...}) + storyApi.shareEnding(). Verified visually via screenshot showing rotation."

  - task: "Profile — Ending Wall progress ring on row"
    implemented: true
    working: true
    file: "/app/frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Small SVG ring shows collected/total endings inline with the 'ending wall' row. Total is scoped to live stories only so it renders 3/6 for the current data set."

  - task: "Ending screen share analytics (reader flow)"
    implemented: true
    working: true
    file: "/app/frontend/app/ending/[id].tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Share button now fires share_card_shared with surface=reader_ending after the native sheet closes, and calls storyApi.shareEnding for the counter."

## metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 4
  run_ui: false

## test_plan:
  current_focus:
    - "/api/endings/share endpoint + endingShareCounts/endingUnlockTimes on user"
    - "Catalog merge (delulu_catalog.json → db.stories)"
    - "Ending Wall — progress ring + cycling banner + share analytics"
    - "Profile — Ending Wall progress ring on row"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

## agent_communication:
    -agent: "main"
    -message: "Shipped 5 additive tasks on top of the existing MVP. Please verify: (a) /api/endings/share increments endingShareCounts and logs a share_card_shared event in db.analytics_events; (b) /api/endings/record now also writes endingUnlockTimes; (c) /api/stories returns ~35 stories including 30 s01-s30 catalog entries; (d) /api/stories/burn_notice.coverUrl points to the newly generated cover_burn_notice.png; (e) new Ending Wall UI shows the X/Y progress ring, and the banner rotates every ~4s between YOUR RAREST / JUST UNLOCKED / MOST SHARED (only when at least one share has happened); (f) Profile row 'ending wall' shows the 3/6 gold ring. Test credentials: test1@delulu.dev / delulu123 (user already has 3 recorded endings and 2 share counts from seed testing)."

## user_problem_statement:
DELULU V1.1 — PHASE A. Delete placeholder seeds, import 30 catalog stories with UNIQUE covers via Nano Banana; hide read counts under 1000; use seeded starting counts. UI/UX: home dedupe (continue > hero > rails), remove dev/mock copy from gems, remove currency selector (display-only), plural helper for days/gems/reads/chapters, daily-gems calendar with distinct claimed/today/future states, delulu-voice copy pass (empty library, claim CTA, logout confirm), profile fix (unclipped streak + dynamic reader title), search 2:3 cards with caption outside image, reader one-time coach overlay.

## backend:
  - task: "Catalog-only story roster with unique covers + seedReads"
    implemented: true
    working: true
    file: "/app/backend/seed_data.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "seed_all now purges legacy stubs (the_last_signal/midnight_house/understudy) and merges all 30 catalog stories with per-story cover URLs (cover_sNN.png via manifest.covers). Each story now carries `seedReads` derived from a deterministic hash of the id — flagships 60k-150k, non-flagships 1.2k-24k. All 30 catalog covers regenerated via Nano Banana (unique per story)."

  - task: "generate_assets.py --only catalog batch"
    implemented: true
    working: true
    file: "/app/backend/generate_assets.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "New gen_catalog_covers() reads delulu_catalog.json and produces one unique cover per story with genre-specific art direction (romance/thriller/horror/scifi/drama palettes). Skips existing files unless --force. Verified 30/30 PNGs saved, all md5-unique."

## frontend:
  - task: "Plural helper + hide-below-1000 read counts"
    implemented: true
    working: true
    file: "/app/frontend/src/utils/format.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "New pluralize(count, singular, plural?), formatCount, formatReadCount helpers. Read count below 1000 returns null and the caller hides the badge. Used in home hero + featured, story detail meta, gems packs, profile streak card, home continue-reading."

  - task: "Home dedupe (continue > hero > featured > rails)"
    implemented: true
    working: true
    file: "/app/frontend/app/(tabs)/home.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Explicit priority pipeline: continue-reading claims ids first, hero picks best unstarted flagship, featured rail sorts remaining by flagship-first + seedReads (cap 6), genre rails render whatever is left. No story can appear in more than one module."

  - task: "Gems screen: no dev copy, no currency selector, pluralize, calendar states"
    implemented: true
    working: true
    file: "/app/frontend/app/(tabs)/gems.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Full rewrite. Removed the 'mock service' section note and the 'MOCK PurchaseService' legal footer. Removed the currency picker modal — currency is inferred at load-time from device locale and shown as a small read-only chip. Daily calendar is now a `DayCell` component with three visual states (claimed=filled flame + romance tint, today=dashed gold outline + pulse animation, future=dim outline). Claim button disabled once today is claimed and label switches to 'back tomorrow ✨'. Pack gem counts pluralized ('1.2k gems', '80 gems')."

  - task: "Profile: unclipped streak card + dynamic reader title + logout confirm"
    implemented: true
    working: true
    file: "/app/frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Streak card gets minHeight, includeFontPadding:false, lineHeight, numberOfLines=1 to prevent clipping. 'Lore Seeker' placeholder replaced by a dynamic reader title (getReaderTitle in theme.js) that upgrades from Delulu Rookie → Certified Delulu → Terminally Delulu → Delulu Royalty at 0/1/3/5 stories finished (distinct storyIds with an unlocked ending). Logout now confirms via a native Alert with delulu-voice copy ('leaving? the cliffhangers will wait. they always do.')."

  - task: "Search: uniform 2:3 cards with caption outside image"
    implemented: true
    working: true
    file: "/app/frontend/app/(tabs)/search.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "Cover is aspect-ratio: 2/3, image fills with resizeMode='cover'. Title/genre now sit BELOW the image on a caption line so text never overlaps a face. Small genre initial chip in the top-left, SOON pill top-right when applicable."

  - task: "Reader: one-time coach overlay"
    implemented: true
    working: true
    file: "/app/frontend/app/reader/[id].tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "First open of any reader shows a full-screen tap-to-dismiss overlay with the message 'tap anywhere to keep the drama going. we'll auto-play the rest.' Persistence key delulu.reader.coachSeen.v1 (AsyncStorage). Fires analytics event `reader_coach_dismissed`. Verified via screenshot: overlay appears once, dismiss persists across reload."

  - task: "Delulu-voice system copy pass"
    implemented: true
    working: true
    file: "/app/frontend/src/theme.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        -working: true
        -agent: "main"
        -comment: "New VOICE tokens: emptyLibrary ('no stories yet? that's your villain origin story.'), emptyLibraryCta, claimCTA ('claim my daily delulu'), claimBusy, claimAlready, logoutConfirmTitle/Body/Yes/No, endingsEmpty/Cta, coachFirstChapter/Dismiss. All screens updated to consume these tokens."

## metadata:
  created_by: "main_agent"
  version: "1.1-phaseA"
  test_sequence: 5

## test_plan:
  current_focus:
    - "Catalog-only story roster with unique covers + seedReads"
    - "Home dedupe (continue > hero > featured > rails)"
    - "Gems screen: no dev copy, no currency selector, pluralize, calendar states"
    - "Profile: unclipped streak card + dynamic reader title + logout confirm"
    - "Search: uniform 2:3 cards with caption outside image"
    - "Reader: one-time coach overlay"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

## agent_communication:
    -agent: "main"
    -message: "V1.1 Phase A shipped. Please verify: (a) GET /api/stories returns exactly 32 stories: 2 hand-authored flagships + 30 catalog (s01–s30). No legacy stubs (the_last_signal, midnight_house, understudy) exist. (b) Every catalog story has seedReads > 0 and a coverUrl matching /api/media/cover_sNN.png that returns 200. (c) Read counts <1000 must not display anywhere (helper returns null). Frontend: home dedupe (a story appears in ONE module only), gems currency picker removed, mock copy removed, daily calendar has three distinct visual states, streak card unclipped, reader coach appears once and persists dismissal, search cards are uniform 2:3 with caption outside image. Test creds: test1@delulu.dev / delulu123."
