// READER — immersive chat-fiction reader.
// - tap-anywhere to reveal next message with typing indicator honoring delayMs
// - reactive NPC portrait with 6 expressions
// - PLAYER messages render your avatar
// - scene panel full-screen takeover
// - choice moment with premium options
// - top-edge tap-to-exit strip
// - server-authoritative chapter completion + choice recording
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, ScrollView, Image, Animated, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import ReAnimated, { FadeInDown, FadeInUp, ZoomIn } from "react-native-reanimated";
import { storyApi, avatarApi, analyticsApi } from "@/src/api";
import { AvatarPreview } from "@/src/AvatarPreview";
import ChatWithCharacterSheet from "@/src/ChatWithCharacterSheet";
import { useAuth } from "@/src/AuthContext";
import { COLORS, RADIUS, SPACING, VOICE } from "@/src/theme";
import { storage } from "@/src/utils/storage";
import { makeResolver } from "@/src/utils/tokens";

// Persisted flag: has the user seen the reader coach overlay at least once?
const COACH_SEEN_KEY = "delulu.reader.coachSeen.v1";

export default function Reader() {
  const router = useRouter();
  const { id, chapter } = useLocalSearchParams();
  const { user, refresh } = useAuth();

  const [story, setStory] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [chapterIdx, setChapterIdx] = useState(parseInt(chapter || "0", 10));
  const [revealed, setRevealed] = useState([]); // list of message indices revealed
  const [typing, setTyping] = useState(false);
  const [choice, setChoice] = useState(null); // {message, options}
  const [panel, setPanel] = useState(null); // scenePanel object
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);
  const [chatSheet, setChatSheet] = useState(false);
  const [showCoach, setShowCoach] = useState(false); // one-time reader coach overlay
  const [needsPicker, setNeedsPicker] = useState([]); // charIds still needing a manual pick
  const scrollRef = useRef(null);
  const activeCharRef = useRef({ id: null, expression: "neutral" });
  const refreshUser = refresh; // alias so the cast-load block reads clearly

  // Token resolver + variant-aware character lookup. Recomputed whenever
  // identity/casting/story changes.
  const resolveText = useMemo(() => makeResolver(user, story), [user, story]);
  const characterFor = useCallback((charId) => {
    if (!story || !charId) return null;
    const char = story.characters.find((c) => c.id === charId);
    if (!char) return null;
    const variantKey = (user?.storyCastings || {})[story.id]?.[charId];
    const variant = variantKey && char.variants ? char.variants[variantKey] : null;
    if (!variant) return char;
    // Return a merged view: variant's name/portraits/avatarUrl override the
    // base character's for the current casting.
    return {
      ...char,
      name: variant.name || char.name,
      avatarUrl: variant.avatarUrl || char.avatarUrl,
      portraitUrls: variant.portraitUrls || char.portraitUrls,
    };
  }, [story, user]);

  // First-ever chapter → show a one-time coach mark explaining the auto-play flow.
  // The overlay dismisses on tap and never blocks reading progression again.
  useEffect(() => {
    (async () => {
      const seen = await storage.getItem(COACH_SEEN_KEY, null);
      if (!seen) setShowCoach(true);
    })();
  }, []);

  const dismissCoach = useCallback(async () => {
    setShowCoach(false);
    try { await storage.setItem(COACH_SEEN_KEY, "1"); } catch {}
    Haptics.selectionAsync();
    analyticsApi.track("reader_coach_dismissed", {});
  }, []);

  useEffect(() => {
    (async () => {
      const [s, c] = await Promise.all([storyApi.get(id), avatarApi.catalog()]);
      setStory(s);
      setCatalog(c.items);
      // Identity-aware casting: on story open, ensure the love interests
      // have been cast for this user. `storyApi.cast` is idempotent and fires
      // analytics only on freshly-cast characters.
      try {
        const castRes = await storyApi.cast({ storyId: id });
        // If the backend says we still need picker (e.g. preference=everyone),
        // the reader will prompt the user before Chapter 1 auto-plays.
        if (castRes?.needsPicker?.length) {
          setNeedsPicker(castRes.needsPicker);
        }
        // Refresh user to pull the latest storyCastings into context
        try { await refreshUser(); } catch {}
      } catch {}
      setLoading(false);
      analyticsApi.track("story_start", { storyId: id, chapterIndex: chapterIdx });
      // Auto-reveal first message
      setTimeout(() => revealNext(s, 0, []), 400);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const chapterData = useMemo(() => story?.chapters?.[chapterIdx], [story, chapterIdx]);
  const messages = chapterData?.messages || [];

  const revealNext = useCallback((s, chIdx, revealedList) => {
    const ch = s.chapters[chIdx];
    if (!ch) return;
    const nextIdx = revealedList.length;
    if (nextIdx >= ch.messages.length) {
      onChapterComplete(s, chIdx);
      return;
    }
    const nextMsg = ch.messages[nextIdx];

    // Choice point pauses the reveal loop for player action
    if (nextMsg.choicePoint) {
      // reveal it silently, show the choice modal
      const newList = [...revealedList, nextIdx];
      setRevealed(newList);
      setChoice({ message: nextMsg, chapterId: ch.id });
      return;
    }

    // Scene panel takeover
    if (nextMsg.scenePanel) {
      setPanel({ ...nextMsg.scenePanel, messageIdx: nextIdx, chIdx });
      return;
    }

    // Handle typing indicator for NPC messages (not narrator, not PLAYER)
    const isNpc = nextMsg.senderCharacterId && nextMsg.senderCharacterId !== "PLAYER" && nextMsg.senderCharacterId !== "narrator";
    const delay = Math.max(400, nextMsg.delayMs || 1200);
    if (isNpc) {
      activeCharRef.current = { id: nextMsg.senderCharacterId, expression: "neutral" };
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        activeCharRef.current = { id: nextMsg.senderCharacterId, expression: nextMsg.expression || "neutral" };
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRevealed((r) => [...r, nextIdx]);
      }, delay);
    } else {
      setTimeout(() => {
        Haptics.selectionAsync();
        setRevealed((r) => [...r, nextIdx]);
      }, 300);
    }
  }, []);

  // Tap anywhere → advance
  const onTapReveal = useCallback(() => {
    if (choice || panel || typing || complete) return;
    revealNext(story, chapterIdx, revealed);
  }, [story, chapterIdx, revealed, choice, panel, typing, complete, revealNext]);

  const onChapterComplete = useCallback(async (s, chIdx) => {
    setComplete(true);
    try {
      await storyApi.completeChapter({ storyId: s.id, chapterIndex: chIdx });
      analyticsApi.track("chapter_complete", { storyId: s.id, chapterIndex: chIdx });
    } catch {}
    // Offer end-of-chapter chat if authored
    const currentCh = s.chapters[chIdx];
    if (currentCh?.endChat) {
      setChatSheet({ characterId: currentCh.endChat.characterId, prompt: currentCh.endChat.prompt, chIdx });
      return;
    }
    _proceedAfterChapter(s, chIdx);
  }, []);

  const _proceedAfterChapter = useCallback(async (s, chIdx) => {
    if (chIdx + 1 >= s.chapters.length) {
      const endingId = pickEndingId(s, user);
      try {
        await storyApi.recordEnding({ storyId: s.id, endingId });
        await refresh();
      } catch {}
      router.replace(`/ending/${s.id}?endingId=${endingId}`);
    } else {
      router.replace(`/chapter-end?storyId=${s.id}&chapterIndex=${chIdx}`);
    }
  }, [router, refresh, user]);

  const onChoicePick = useCallback(async (option, index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await storyApi.choice({
        storyId: story.id,
        chapterId: chapterData.id,
        messageId: choice.message.id,
        optionIndex: index,
      });
      await refresh();
      analyticsApi.track("choice_made", { storyId: story.id, chapterId: chapterData.id, isPremium: !!option.isPremium });
      setChoice(null);
      // continue
      setTimeout(() => revealNext(story, chapterIdx, revealed), 200);
    } catch (e) {
      if (e.status === 402) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        router.push(`/(tabs)/gems?msg=${encodeURIComponent(VOICE.notEnoughGems)}`);
      }
    }
  }, [story, chapterData, choice, revealed, chapterIdx, refresh, router, revealNext]);

  const closePanel = useCallback(() => {
    if (!panel) return;
    const isEndingPanel = panel.isEndingPanel;
    const chIdx = panel.chIdx;
    const nextIdx = revealed.length;
    setRevealed((r) => [...r, panel.messageIdx]);
    setPanel(null);
    if (isEndingPanel) {
      setTimeout(() => onChapterComplete(story, chIdx), 400);
    } else {
      setTimeout(() => revealNext(story, chIdx, [...revealed, nextIdx]), 300);
    }
  }, [panel, story, revealed, onChapterComplete, revealNext]);

  useEffect(() => {
    // auto-scroll to bottom on new message
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [revealed.length, typing]);

  if (loading || !story || !chapterData) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.romance} />
        <Text style={styles.loadingText}>{VOICE.loading}</Text>
      </View>
    );
  }

  const accent = story.accentColor || COLORS.romance;
  const activeChar = story.characters.find((c) => c.id === activeCharRef.current.id);
  const activePortrait = activeChar?.portraitUrls?.[activeCharRef.current.expression] || activeChar?.avatarUrl;

  return (
    <View style={styles.root}>
      {/* Cinematic backdrop — the story cover blurred behind everything */}
      {story?.coverUrl && (
        <>
          <Image source={{ uri: story.coverUrl }} style={styles.backdrop} blurRadius={30} />
          <View style={styles.backdropTint} />
          <LinearGradient
            colors={[`${accent}22`, "transparent", "rgba(10,10,15,0.65)"]}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      {/* Top edge exit + chapter title */}
      <SafeAreaView edges={["top"]}>
        <View style={styles.topBar}>
          <TouchableOpacity testID="reader-exit" onPress={() => router.back()} hitSlop={12} style={styles.exitBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.chapTitle} numberOfLines={1}>Ch. {chapterIdx + 1}: {chapterData.title}</Text>
          <TouchableOpacity hitSlop={12} style={styles.exitBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <View style={[styles.progressBar]}>
          <View style={{ height: 2, width: `${(revealed.length / Math.max(1, messages.length)) * 100}%`, backgroundColor: accent }} />
        </View>
      </SafeAreaView>

      {/* Chat area */}
      <TouchableWithoutFeedback onPress={onTapReveal} testID="reader-tap-area">
        <View style={{ flex: 1 }}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ padding: SPACING.md, paddingBottom: 160 }}
            keyboardShouldPersistTaps="handled"
          >
            {revealed.map((mIdx) => {
              const m = messages[mIdx];
              if (!m) return null;
              if (m.choicePoint || m.scenePanel) return null; // handled elsewhere
              return <MessageBubble key={m.id} message={m} story={story} accent={accent} user={user} catalog={catalog} resolveText={resolveText} characterFor={characterFor} />;
            })}

            {typing && activeChar && (
              <View style={[styles.msgRow, { justifyContent: "flex-start" }]}>
                <Image source={{ uri: activePortrait }} style={styles.smallPortrait} />
                <View style={[styles.bubble, styles.npcBubble]}>
                  <TypingDots />
                </View>
              </View>
            )}

            {revealed.length === 0 && !typing && (
              <View style={styles.tapHint}>
                <Text style={styles.tapHintText}>tap anywhere{"\n"}to reveal</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* SCENE PANEL TAKEOVER */}
      {panel && (
        <TouchableOpacity activeOpacity={1} onPress={closePanel} style={styles.panelOverlay} testID="scene-panel-overlay">
          <View style={styles.panelFrame}>
            <Image source={{ uri: panel.imageUrl }} style={StyleSheet.absoluteFillObject} />
            <LinearGradient colors={[`${accent}55`, "transparent", "rgba(10,10,15,0.7)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.halftoneBurst} />
            <View style={[styles.panelBorder, { borderColor: accent, pointerEvents: "none" }]} />
            {panel.caption && (
              <View style={styles.panelCaption}>
                <Text style={styles.panelCaptionText}>{panel.caption.toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.panelTapHint}>tap to continue</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* CHOICE MOMENT */}
      {choice && (
        <View style={styles.choiceOverlay} testID="choice-overlay">
          <View style={StyleSheet.absoluteFill}>
            <LinearGradient colors={["rgba(10,10,15,0.6)", "rgba(10,10,15,0.94)"]} style={StyleSheet.absoluteFill} />
          </View>
          {activeChar && (
            <View style={styles.choiceCharWrap}>
              <Image source={{ uri: activeChar.portraitUrls?.flirty || activeChar.avatarUrl }} style={styles.choiceCharImg} />
              <LinearGradient colors={["transparent", "rgba(10,10,15,0.95)"]} locations={[0, 1]} style={StyleSheet.absoluteFill} />
            </View>
          )}
          <View style={styles.choicePanel}>
            <Text style={styles.choicePrompt}>one choice. and everything changes.</Text>
            {choice.message.choicePoint.options.map((opt, i) => (
              <TouchableOpacity
                key={i}
                testID={`choice-option-${i}`}
                activeOpacity={0.85}
                onPress={() => onChoicePick(opt, i)}
                style={[styles.choiceCard, opt.isPremium && styles.choiceCardPremium]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.choiceText, opt.isPremium && { color: COLORS.gemGold }]}>{resolveText ? resolveText(opt.text) : opt.text}</Text>
                  {opt.isPremium && <Text style={styles.choicePremiumHelper}>premium choice · more impact</Text>}
                </View>
                {opt.isPremium ? (
                  <View style={styles.gemPill}>
                    <View style={styles.gemDotSm} />
                    <Text style={styles.gemPillText}>{opt.gemCost || 25}</Text>
                  </View>
                ) : (
                  <Text style={styles.freeText}>Free</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* CHAT WITH CHARACTER (end-of-chapter LLM-driven free chat) */}
      {chatSheet && (
        <ChatWithCharacterSheet
          visible={!!chatSheet}
          onClose={() => {
            const chIdx = chatSheet.chIdx;
            setChatSheet(null);
            _proceedAfterChapter(story, chIdx);
          }}
          story={story}
          chapterIndex={chatSheet.chIdx}
          characterId={chatSheet.characterId}
          playerAvatarNode={
            <AvatarPreview
              layers={user?.avatarConfig?.layers || {}}
              catalog={catalog}
              presetImageUrl={user?.avatarConfig?.imageUrl}
              size={32}
            />
          }
        />
      )}

      {/* First-run reader coach mark — dismiss on any tap */}
      {showCoach && (
        <TouchableWithoutFeedback onPress={dismissCoach}>
          <View style={styles.coachOverlay} testID="reader-coach-overlay">
            <View style={styles.coachCard}>
              <View style={styles.coachIconWrap}>
                <Ionicons name="hand-left" size={26} color={COLORS.gemGold} />
              </View>
              <Text style={styles.coachTitle}>welcome to the drama</Text>
              <Text style={styles.coachBody}>{VOICE.coachFirstChapter}</Text>
              <View style={styles.coachCta}>
                <Text style={styles.coachCtaText}>{VOICE.coachDismiss}</Text>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Love-interest picker (romancePreference == "everyone") */}
      {needsPicker.length > 0 && story && (
        <LoveInterestPicker
          story={story}
          charIds={needsPicker}
          onCast={async (map) => {
            try {
              await storyApi.cast({ storyId: id, castings: map });
              try { await refreshUser(); } catch {}
            } catch {}
            setNeedsPicker([]);
          }}
        />
      )}
    </View>
  );
}

/**
 * Bottom-sheet-style overlay shown when the user's romance preference is
 * "everyone" and a story hasn't been cast yet. Presents each love interest
 * with masc + femme variant thumbnails; user taps to lock in the casting.
 */
function LoveInterestPicker({ story, charIds, onCast }) {
  const [pending, setPending] = useState(() => ({}));
  const remaining = charIds.filter((cid) => !pending[cid]);
  const allChosen = remaining.length === 0;

  return (
    <View style={styles.pickerOverlay} testID="reader-li-picker">
      <View style={styles.pickerCard}>
        <Ionicons name="sparkles" size={24} color={COLORS.romance} />
        <Text style={styles.pickerTitle}>who's your lead?</Text>
        <Text style={styles.pickerBody}>you can only pick once per story. choose your fighter.</Text>
        {charIds.map((cid) => {
          const char = story.characters.find((c) => c.id === cid);
          if (!char) return null;
          const chosen = pending[cid];
          return (
            <View key={cid} style={styles.pickerRow}>
              <Text style={styles.pickerCharLabel}>{char.role || "Love Interest"}</Text>
              <View style={styles.pickerOptRow}>
                {["masc", "femme"].map((v) => {
                  const variant = char.variants?.[v];
                  if (!variant) return null;
                  const active = chosen === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      testID={`li-picker-${cid}-${v}`}
                      activeOpacity={0.85}
                      onPress={() => { Haptics.selectionAsync(); setPending((s) => ({ ...s, [cid]: v })); }}
                      style={[styles.pickerOptCard, active && { borderColor: COLORS.romance, backgroundColor: `${COLORS.romance}22` }]}
                    >
                      <Image source={{ uri: variant.avatarUrl }} style={styles.pickerOptImg} />
                      <Text style={styles.pickerOptName} numberOfLines={1}>{variant.name}</Text>
                      {active && <View style={styles.pickerCheck}><Ionicons name="checkmark" size={12} color={COLORS.bg} /></View>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
        <TouchableOpacity
          testID="li-picker-confirm"
          activeOpacity={0.9}
          disabled={!allChosen}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onCast(pending); }}
          style={[styles.pickerConfirm, !allChosen && { opacity: 0.4 }]}
        >
          <Text style={styles.pickerConfirmText}>{allChosen ? "start the spiral" : "pick a lead"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------
// Bubble + supporting components
// -----------------------------------------------------------------------

function MessageBubble({ message, story, accent, user, catalog, resolveText, characterFor }) {
  const isPlayer = message.senderCharacterId === "PLAYER";
  const isNarrator = message.senderCharacterId === "narrator";
  const char = characterFor ? characterFor(message.senderCharacterId) : story.characters.find((c) => c.id === message.senderCharacterId);
  const portrait = char?.portraitUrls?.[message.expression || "neutral"] || char?.avatarUrl;
  // Resolve any {p_*} / {c_*} tokens embedded in the text so player and
  // variant-cast characters read correctly.
  const textResolved = resolveText ? resolveText(message.text) : message.text;

  if (isNarrator) {
    return (
      <View style={styles.narratorRow}>
        <Text style={styles.narrator}>{textResolved}</Text>
        {message.sfxText && <SfxText text={message.sfxText} accent={accent} />}
      </View>
    );
  }

  const align = isPlayer ? "flex-end" : "flex-start";
  return (
    <View style={{ marginVertical: 6 }}>
      {char && !isPlayer && <Text style={styles.senderName}>{char.name}</Text>}
      <View style={[styles.msgRow, { justifyContent: align }]}>
        {!isPlayer && (
          <Image source={{ uri: portrait }} style={styles.smallPortrait} />
        )}
        <View style={[
          styles.bubble,
          isPlayer ? [styles.playerBubble, { borderColor: accent }] : styles.npcBubble,
        ]}>
          <Text style={styles.bubbleText}>{textResolved}</Text>
          <Text style={styles.bubbleTs}>{fmtTime()}</Text>
        </View>
        {isPlayer && (
          <View style={styles.playerAvatarWrap}>
            <AvatarPreview
              layers={user?.avatarConfig?.layers || {}}
              catalog={catalog}
              presetImageUrl={user?.avatarConfig?.imageUrl}
              size={40}
            />
          </View>
        )}
      </View>
      {message.sfxText && <SfxText text={message.sfxText} accent={accent} />}
    </View>
  );
}

function SfxText({ text, accent }) {
  return (
    <View style={{ alignSelf: "center", marginVertical: 8, transform: [{ rotate: "-4deg" }] }}>
      <Text style={[styles.sfx, { color: accent, textShadowColor: `${accent}88`, textShadowRadius: 12 }]}>{text}</Text>
    </View>
  );
}

function TypingDots() {
  const a1 = useRef(new Animated.Value(0.3)).current;
  const a2 = useRef(new Animated.Value(0.3)).current;
  const a3 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = (v, delay) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.3, duration: 300, useNativeDriver: true }),
    ]));
    loop(a1, 0).start();
    loop(a2, 150).start();
    loop(a3, 300).start();
  }, [a1, a2, a3]);
  return (
    <View style={{ flexDirection: "row", gap: 4, paddingVertical: 6, paddingHorizontal: 4 }}>
      <Animated.View style={[styles.typingDot, { opacity: a1 }]} />
      <Animated.View style={[styles.typingDot, { opacity: a2 }]} />
      <Animated.View style={[styles.typingDot, { opacity: a3 }]} />
    </View>
  );
}

function fmtTime() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

// Very simple ending picker: pick the ending with highest matched weight based on choicesMade.
function pickEndingId(story, user) {
  if (!story.endings?.length) return null;
  const progress = user?.progress?.[story.id];
  const choices = progress?.choicesMade || [];
  const tally = {};
  for (const c of choices) {
    const w = c.endingWeight || {};
    for (const k of Object.keys(w)) tally[k] = (tally[k] || 0) + w[k];
  }
  const map = { safe: "ending_safe", bold: "ending_bold", delulu: "ending_delulu" };
  let best = "ending_safe";
  let bestScore = -1;
  for (const k of Object.keys(tally)) {
    if (tally[k] > bestScore && map[k]) {
      bestScore = tally[k];
      best = map[k];
    }
  }
  return best;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  backdrop: { ...StyleSheet.absoluteFillObject, opacity: 0.35 },
  backdropTint: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,10,15,0.82)" },
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { color: COLORS.secondary },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingVertical: 8, backgroundColor: "rgba(10,10,15,0.6)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  exitBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  chapTitle: { flex: 1, color: COLORS.text, fontSize: 13, fontWeight: "700", textAlign: "center" },
  progressBar: { height: 2, backgroundColor: COLORS.elevated },
  narratorRow: { alignSelf: "center", maxWidth: "80%", paddingVertical: SPACING.sm },
  narrator: { color: COLORS.secondary, fontSize: 13, textAlign: "center", fontStyle: "italic", lineHeight: 20 },
  senderName: { color: COLORS.secondary, fontSize: 11, marginLeft: 44, marginBottom: 4, fontWeight: "600" },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  smallPortrait: { width: 32, height: 32, borderRadius: 999, backgroundColor: COLORS.elevated },
  bubble: { maxWidth: "72%", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1 },
  npcBubble: { backgroundColor: COLORS.elevated, borderColor: COLORS.border, borderBottomLeftRadius: 4 },
  playerBubble: { backgroundColor: "rgba(255,62,138,0.18)", borderColor: COLORS.romance, borderBottomRightRadius: 4 },
  bubbleText: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  bubbleTs: { color: COLORS.muted, fontSize: 10, marginTop: 4, fontVariant: ["tabular-nums"] },
  playerAvatarWrap: { width: 40, height: 40, borderRadius: 999, backgroundColor: COLORS.surface, overflow: "hidden", borderWidth: 1, borderColor: COLORS.romance, alignItems: "center", justifyContent: "center" },
  sfx: { fontSize: 42, fontWeight: "900", letterSpacing: -2, textTransform: "uppercase" },
  typingDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: COLORS.text },
  tapHint: { alignSelf: "center", padding: SPACING.md, marginTop: SPACING.xl },
  tapHintText: { color: COLORS.secondary, textAlign: "center", fontSize: 13, letterSpacing: 0.5 },

  // Scene panel
  panelOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: SPACING.md },
  panelFrame: { width: "100%", height: "80%", borderRadius: RADIUS.md, overflow: "hidden", backgroundColor: COLORS.surface },
  panelBorder: { ...StyleSheet.absoluteFillObject, borderWidth: 4, borderRadius: RADIUS.md },
  halftoneBurst: { position: "absolute", top: -100, right: -100, width: 300, height: 300, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)" },
  panelCaption: { position: "absolute", left: 20, bottom: 20, right: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(10,10,15,0.85)", borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm },
  panelCaptionText: { color: COLORS.text, fontWeight: "900", letterSpacing: 1, fontSize: 13 },
  panelTapHint: { position: "absolute", top: 20, alignSelf: "center", color: COLORS.secondary, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },

  // Choice moment
  choiceOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  choiceCharWrap: { position: "absolute", left: 0, right: 0, top: 40, bottom: 300, opacity: 0.95 },
  choiceCharImg: { ...StyleSheet.absoluteFillObject, resizeMode: "cover", opacity: 0.9 },
  choicePanel: { padding: SPACING.lg, gap: 10, paddingBottom: SPACING.xl },
  choicePrompt: { color: COLORS.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.5, textAlign: "center", marginBottom: SPACING.sm, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 12 },
  choiceCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: 14, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(22,22,31,0.85)" },
  choiceCardPremium: { borderColor: COLORS.gemGold, borderWidth: 2, backgroundColor: "rgba(255,201,74,0.12)", shadowColor: COLORS.gemGold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
  choiceText: { color: COLORS.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  choicePremiumHelper: { color: COLORS.gemGold, fontSize: 11, marginTop: 3, fontWeight: "700" },
  freeText: { color: COLORS.secondary, fontSize: 12, fontWeight: "700" },
  gemPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: "rgba(255,201,74,0.15)", borderWidth: 1, borderColor: COLORS.gemGold },
  gemDotSm: { width: 8, height: 8, backgroundColor: COLORS.gemGold, transform: [{ rotate: "45deg" }] },
  gemPillText: { color: COLORS.gemGold, fontWeight: "800", fontVariant: ["tabular-nums"] },
  // Reader coach overlay
  coachOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,10,15,0.72)", alignItems: "center", justifyContent: "center", padding: SPACING.xl, zIndex: 999 },
  coachCard: { width: "100%", maxWidth: 320, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.gemGold, padding: SPACING.lg, gap: 10, alignItems: "center", shadowColor: COLORS.gemGold, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20 },
  coachIconWrap: { width: 56, height: 56, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: `${COLORS.gemGold}22`, borderWidth: 1, borderColor: COLORS.gemGold },
  coachTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", letterSpacing: -0.4, marginTop: 4 },
  coachBody: { color: COLORS.secondary, fontSize: 13, textAlign: "center", lineHeight: 18 },
  coachCta: { marginTop: 6, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: COLORS.gemGold, borderRadius: RADIUS.pill },
  coachCtaText: { color: COLORS.bg, fontWeight: "900", fontSize: 13, letterSpacing: 0.3 },
  // Love-interest picker overlay
  pickerOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,10,15,0.85)", alignItems: "center", justifyContent: "center", padding: SPACING.xl, zIndex: 1000 },
  pickerCard: { width: "100%", maxWidth: 360, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.romance, padding: SPACING.lg, gap: SPACING.md, alignItems: "center", shadowColor: COLORS.romance, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 20 },
  pickerTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.4 },
  pickerBody: { color: COLORS.secondary, fontSize: 12, textAlign: "center", lineHeight: 16, marginTop: -6 },
  pickerRow: { alignSelf: "stretch", gap: 8 },
  pickerCharLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },
  pickerOptRow: { flexDirection: "row", gap: 10 },
  pickerOptCard: { flex: 1, alignItems: "center", padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.elevated, borderWidth: 1.5, borderColor: COLORS.border, gap: 6, position: "relative" },
  pickerOptImg: { width: 64, height: 64, borderRadius: 999, backgroundColor: COLORS.bg },
  pickerOptName: { color: COLORS.text, fontSize: 12, fontWeight: "800", letterSpacing: -0.1 },
  pickerCheck: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 999, backgroundColor: COLORS.romance, alignItems: "center", justifyContent: "center" },
  pickerConfirm: { alignSelf: "stretch", backgroundColor: COLORS.romance, paddingVertical: 14, borderRadius: RADIUS.pill, alignItems: "center", marginTop: 6 },
  pickerConfirmText: { color: COLORS.bg, fontWeight: "900", fontSize: 15, letterSpacing: -0.2 },
});
