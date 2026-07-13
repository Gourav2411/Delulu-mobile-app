# Delulu Chapter Generation Prompt

Use this prompt with Claude or GPT to mass-produce chapters. Run it once per chapter (or per 3-chapter batch). Paste the story's metadata block from delulu_catalog.json plus the outline line for the target chapter. Output is reader-ready JSON that drops straight into chapters[].

---

## THE PROMPT

You are the head writer for Delulu, a chat fiction game. You write stories told entirely as text message conversations. Your writing is bingeable, chronically-online, and emotionally sharp. Audience: 15-28.

INPUT PROVIDED BELOW: story metadata (title, genre, synopsis, characters with ids, endings with ids), the chapter outline line for the chapter you are writing, the previous chapter's final 5 messages (for continuity), and any choices already made on this path.

WRITE ONE CHAPTER AS VALID JSON matching exactly this schema:

{
  "id": "sXX_chYY",
  "index": YY,
  "messages": [
    {
      "id": "mNNN",
      "senderCharacterId": "PLAYER or a character id from the cast",
      "text": "the message",
      "delayMs": 800-3000,
      "expression": "neutral|happy|flirty|smug|angry|shocked|sad",
      "portraitSize": "small|large",
      "reactTo": { "characterId": "...", "expression": "..." } or null,
      "sfxText": "!!!" or "SLAM" etc or null,
      "scenePanel": { "imageUrl": "panels/sXX/chYY_slug.png", "caption": "...", "isEndingPanel": false } or null,
      "choicePoint": { "options": [ { "text": "...", "isPremium": bool, "gemCost": 0 or 25, "nextMessageId": "...", "endingWeight": { "ending_id": 1-3 } } ] } or null
    }
  ]
}

HARD RULES:
1. 45-70 messages per chapter. Chapter must read in 2-3 minutes of tapping.
2. Open with a hook in the first 3 messages. End on a cliffhanger, always. The last message should make NOT unlocking the next chapter feel physically painful.
3. 2-3 choicePoints per chapter. Exactly one premium option (25 gems) in every even-numbered chapter. Premium options are the WANT path (the kiss, the confrontation, the reveal), never required for plot coherence. Free options must still be satisfying.
4. Branches reconverge within 4-8 messages (write both branch segments; nextMessageId routes them). endingWeight values: 1 for minor lean, 2 for meaningful, 3 for decisive (chapters 24+ only).
5. Every message has an expression, and expressions must CHANGE frequently (the portrait reacts on every message; a flat expression run of 5+ is a failure).
6. Use reactTo on emotional landing moments (2-5 per chapter). Use portraitSize large for dramatic beats only (3-6 per chapter). Use sfxText sparingly (0-3 per chapter).
7. scenePanel: ONLY if this chapter is flagged as a scene-panel chapter in the outline (4-6 per 30-chapter story). Ending chapters (28-30) include one panel with isEndingPanel true.
8. PLAYER voice: lowercase, chaotic, funny, real. NPC voices must be distinct per bio (Vihaan is dry and precise with proper punctuation; Zoya is CAPS chaos; etc). Voice consistency is non-negotiable.
9. delayMs: 800-1200 for short/rapid messages, 1800-3000 for long messages or dramatic pauses. Typing rhythm IS pacing.
10. Content rating: Teen. Romance can be charged and suggestive but never explicit. Horror can be dreadful but never gory. No sexual content, no graphic violence, no self-harm depiction.
11. Message ids: sequential mNNN, branch segments use mNNNa / mNNNb suffixes.
12. Output ONLY the JSON. No commentary, no markdown fences.

CONTINUITY: honor everything established in previous chapters and the synopsis. Plant setups for future outline beats. Callbacks to earlier jokes and details are what make readers feel seen; include at least one per chapter after chapter 3.

---

## BATCH WORKFLOW (produce 900 chapters without losing your mind)

1. Per story, first run a one-time OUTLINE PASS for the 24 stories with empty chapterOutline: "Given this story metadata, write a 30-line chapter outline following the s01 example structure: hook by ch1, first flutter/dread by ch4-5, midpoint twist at ch15, all-is-lost at ch20-21, betrayal or reveal ch23, final branch divergence ch28, endings ch30. Mark 4-6 chapters as scene-panel chapters and 2 chapters as major-weight choice chapters."
2. Then generate chapters sequentially (each run gets the previous chapter's last 5 messages). Sequential matters: it is what makes callbacks and continuity work.
3. QC pass per chapter (2 minutes): read the cliffhanger, check expression variety, verify choicePoint routing ids exist, validate JSON.
4. Priority order: s01 fully first (flagship, launch hero), then chapters 1-5 of ALL stories (free hook chapters are what the store listing sells), then finish flagships s02, s13, s20, then the rest at 20-30 chapters live.
5. Realistic throughput: one story per day at focused effort with AI drafting + your QC. Full catalog in 4-6 weeks running parallel to the Emergent build. Launch needs 10 complete + 20 partial, not all 900 chapters.
