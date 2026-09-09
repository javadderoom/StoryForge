# StoryForge (AfsanehSaz) — Comprehensive System & Gameplay Audit

> **Audit Date:** September 2026  
> **Auditor Perspective:** Brutal Critic & Systems Architect  
> **Scope:** Core Game Engine, Narrative Director, Combat & Dialogue Mechanics, Client-Server Synchronization, and the Active Production Story (`story_mt4ofllt` / Faravand — Zarrin Pol).

---

## 1. Executive Summary

StoryForge is architected around a compelling doctrine:
> *"The player can change the story, but cannot change the rules of the world without a reason."*  
> *The AI is the narrator and director, never the game engine or database.*

While the declarative world-building ontology (World Bible, factions, locations, timeline, religions, drama bonds) is robust, **the runtime gameplay layer suffers from critical structural disconnects, client-server sync breakdowns, and game engine blind spots that actively harm narrative consistency and player immersion.**

Currently, a player launching the active production story encounters:
1. **Empty Character Creation:** 0 archetypes and 0 backgrounds defined in the production manifest.
2. **Broken Opening Beat:** Initial scene contains placeholder text, an empty location ID, and 0 choices.
3. **The Phantom Playthrough:** The Flutter client omits `sessionId` when sending actions, preventing turn history, memories, and living world ledger entries from ever saving to PostgreSQL.
4. **The Immortal Player Bug:** The Game Engine hardcodes `'hp'` for damage, but the story's actual vital resource is `'health'`. Real player health never decreases.
5. **The One-Way Relationship Downward Spiral:** NPC trust can only decrease through coercion/threats; there is no mechanic to earn trust peacefully through diplomacy, making high-trust secrets impossible to unlock naturally.
6. **Relics as Cosmetic Text:** Relics possess zero mechanical stats, cannot be equipped with bonuses, and trigger false-positive action blocks in dialogue.

---

## 2. Detailed Architectural Findings

### 2.1 The Relic & Artifact Mirage (Lore Without Mechanics)

#### A. Schema Disconnect (`WorldArtifact` vs. `GameItem`)
* In [`web/src/lib/types/world.ts`](file:///d:/Code/StoryForge/web/src/lib/types/world.ts), `WorldArtifact` defines lore records:
  ```typescript
  export interface WorldArtifact {
    id: string;
    name: string;
    title: string;
    originEra: string;
    rarity: 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
    description: string;
    powers: string[]; // Unstructured string array
    curseOrCost?: string;
    attunementRules?: string;
    currentHolderType: 'npc' | 'location' | 'faction' | 'vault' | 'unknown';
    currentHolderId: string;
  }
  ```
* In [`web/src/lib/types/rpg.ts`](file:///d:/Code/StoryForge/web/src/lib/types/rpg.ts), `GameItem` defines tangible gameplay inventory:
  ```typescript
  export interface GameItem {
    id: string;
    name: string;
    type: 'weapon' | 'armor' | 'shield' | 'consumable' | 'quest_item' | 'relic';
    statModifiers?: Record<string, number>;
    healValue?: number;
    staminaValue?: number;
    grip?: WeaponGrip;
  }
  ```
* **There is no bridge between `WorldArtifact` and `GameItem`.** An author writes *"Powers: Grants +3 Might and fire immunity"* in Studio. Because this is free-form text in `WorldArtifact.powers`, the Game Engine never parses it. Equipping an artifact provides **+0 mechanical benefit**.

#### B. UI Omissions
* **Studio Editor ([artifacts/page.tsx](file:///d:/Code/StoryForge/web/src/app/studio/artifacts/page.tsx)):** Provides no inputs for numeric stat bonuses, target equipment slots, active ability cooldowns, or passive check modifiers.
* **Flutter Compendium ([compendium_screen.dart](file:///d:/Code/StoryForge/app/lib/ui/screens/compendium_screen.dart)):** Displays only `name`, `rarity` badge, and `description`. Power descriptions, curses, attunement rules, and stat bonuses are completely hidden from the player.

#### C. False-Positive Action Block in `ActionValidator`
In [`web/src/lib/engines/validator/ActionValidator.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/validator/ActionValidator.ts):
```typescript
private static checkUnownedArtifact(lowerAction: string, playerState: PlayerState, worldBible: WorldBible): string | null {
  for (const artifact of worldBible.artifacts ?? []) {
    const name = artifact.name.toLowerCase();
    if (name.length < 4 || !lowerAction.includes(name)) continue;
    const owned = playerState.inventory.some(...);
    if (!owned) {
      return `"${artifact.name}" is not in your possession. You must obtain it within the story first.`;
    }
  }
  return null;
}
```
**This check lacks a verb filter.** If a player types:
> *"از کاتب درباره تاج زرین سوال می‌پرسم"* (I ask the scribe about the Golden Crown)  
> or *"به دنبال خنجر باستانی در ویرانه‌ها می‌گردم"* (I search the ruins for the ancient dagger)

`ActionValidator` sees the artifact name in the prompt, observes it is not in the player's inventory, and **rejects the action as an inventory violation.** Players are forbidden from investigating or seeking artifacts unless they already possess them.

---

### 2.2 Client-Server Synchronization Breakdown (The Phantom Playthrough)

#### A. Missing `sessionId` in Flutter API Calls
* In [`app/lib/services/game_api_service.dart`](file:///d:/Code/StoryForge/app/lib/services/game_api_service.dart), `GameApiService.sendAction` constructs the payload sent to `/api/play/action`.
* **It does not include `sessionId` in the payload or function signature.**
* On the backend ([`web/src/app/api/play/action/route.ts`](file:///d:/Code/StoryForge/web/src/app/api/play/action/route.ts)):
  ```typescript
  const session = sessionId ? await SessionRepository.getSession(sessionId) : null;
  // ...
  if (sessionId) {
    // Persist TurnHistory, MemoryLog, and Living World Ledger
  }
  ```
* Because `sessionId` is missing:
  1. No turns are ever written to `TurnHistory` in PostgreSQL.
  2. No hierarchical memories are written to `MemoryLog`.
  3. The `WorldStateLedger` is never updated.
  4. Closing or restarting the mobile app wipes out the entire playthrough.

#### B. Client Equipment Overridden on Next Turn
* In [`app/lib/providers/game_session_provider.dart`](file:///d:/Code/StoryForge/app/lib/providers/game_session_provider.dart), `equipItem` and `unequipItem` mutate local client memory but **never send an HTTP PATCH** to `/api/play/session`.
* Under Plan 08 Phase 2 ([`route.ts`](file:///d:/Code/StoryForge/web/src/app/api/play/action/route.ts)), the server enforces server-authoritative `PlayerState`:
  ```typescript
  const playerState: PlayerState = (session?.playerState as PlayerState | undefined) ?? incomingPlayerState;
  ```
* Whenever a session exists, the server uses its own stored state. Since client equipment changes were never patched, **the server reverts the player's equipment on the very next turn.**

---

### 2.3 Combat Mechanics Void & The Immortal Player

#### A. Hardcoded `'hp'` Bug (Immortal Player)
* In [`web/src/lib/engines/game/GameEngine.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/game/GameEngine.ts):
  ```typescript
  stateDiff.resourceChanges = { hp: (stateDiff.resourceChanges?.hp || 0) - 10 };
  ```
* The engine hardcodes `'hp'` and `'stamina'`.
* In [`story_mt4ofllt`](file:///d:/Code/StoryForge/docs/temp/story_mt4ofllt_manifest%20%285%29.json), the primary health resource is defined with `id: "health"`.
* When `applyStateMutation` runs, it finds no resource definition for `'hp'`. It writes to an orphaned key `resources['hp'] = 90`, while the player's visible `resources['health']` **remains at 20/20 forever**.
* The player cannot take visible damage in combat.

#### B. Total Absence of Death / Defeat Conditions
* Neither `GameEngine.ts` nor `action/route.ts` contains any check for `current <= 0`, `isDead`, or `gameOver`.
* Reaching 0 health produces no narrative defeat, no checkpoint reload, and no notification to the AI narrator. The character continues taking turns indefinitely at 0 HP.

#### C. Enemies Have No State
* In StoryForge, combat is currently a **single generic D20 roll against a static DC (12 or 15).**
* Enemies have:
  * No HP or wound thresholds.
  * No armor class or damage mitigation.
  * No counter-attack turn or initiative order.
* The World Bible contains **26 fully defined bestiary creatures** with danger ratings (1–5), vulnerabilities, resistances, and loot tables. **`GameEngine.ts` does not reference the Bestiary at all.** Fighting a Danger-5 cosmic leviathan uses the exact same mechanics as fighting a tavern thug.

---

### 2.4 Conversation & Relationship Collapse (The One-Way Downward Spiral)

#### A. Trust Only Decreases
* In [`web/src/app/api/play/action/route.ts`](file:///d:/Code/StoryForge/web/src/app/api/play/action/route.ts):
  * Coercion and threats (`applyPressureOutcome`) reduce trust: `-10`, `-15`, `-25`, `-30`.
  * **There is no code in the engine to award positive `trustDelta`.**
* If an NPC starts at trust 0, and their secret requires trust 40:
  * Diplomatic successes, favors, and polite dialogue yield **+0 trust**.
  * The secret can **never** be unlocked peacefully.
  * The only way to crack secrets is through threats (`pressure`), which damages trust further.

#### B. Every Utterance is a High-Stakes D20 Check
* There is no dialogue mode or conversation buffer. Saying *"Good morning"* and *"Tell me your secrets or die"* are both evaluated through the same high-stakes D20 roll. A bad roll on casual dialogue inflicts physical damage (`-10 HP`) or relationship ruin (`-10 Trust`).

---

### 2.5 Narrative Director & Pacing Holes

#### A. The Saga Bypass Schism
* When [`/api/play/session`](file:///d:/Code/StoryForge/web/src/app/api/play/session/route.ts) initializes a session, it assigns:
  ```typescript
  const initialBeat = story.initialStoryBeats[0];
  ```
  It ignores `story.saga.chapters[0].scenes[0]` and leaves `session.currentChapterId` empty.
* In [`action/route.ts`](file:///d:/Code/StoryForge/web/src/app/api/play/action/route.ts), `activeChapter` resolves to `null`.
* As a result, chapter goals, milestone directives, scope tier filtering (`street` $\to$ `regional` $\to$ `continental`), and episodic rollups are omitted from the LLM prompt. The story never progresses through its chapters.

#### B. Silent Choice Dropping in `normalizeChoices`
* In [`web/src/lib/providers/GeminiAdapter.ts`](file:///d:/Code/StoryForge/web/src/lib/providers/GeminiAdapter.ts), `normalizeChoices` drops any choice whose `requiredStatId` does not strictly match the story's stat IDs.
* If Gemini returns synonymous stats (e.g. `"strength"` instead of `"might"`, or `"dexterity"` instead of `"agility"`), the choice is silently discarded.
* If all choices contain minor terminology differences, the player receives an empty choice list (`choices: []`).

---

## 3. Active Production Story Audit (`story_mt4ofllt` — Faravand / Zarrin Pol)

The intended vision is:
> *"The story is set in the city of Zarrin Pol (زرین پل). Based on the character chosen by the player, different storylines should take shape."*

A direct inspection of [`docs/temp/story_mt4ofllt_manifest (5).json`](file:///d:/Code/StoryForge/docs/temp/story_mt4ofllt_manifest%20%285%29.json) reveals:

| Manifest Field | Current Production Value | Gameplay Impact |
|---|---|---|
| **Archetypes** | `archetypes: []` (0 defined) | Flutter Step 1 shows: *"هیچ تخصصی برای این سرگذشت تعریف نشده است"* (Empty box). |
| **Backgrounds** | `backgrounds: []` (0 defined) | Flutter Step 2 shows: *"هیچ پیشینه‌ای برای این سرگذشت تعریف نشده است"* (Empty box). |
| **Artifacts** | `artifacts: []` (0 defined) | No relics exist in the story world. |
| **Starting Inventory** | `startingInventory: []` (0 items) | Inventory is empty, but session code hardcodes `iron_dagger` in `mainHand`. |
| **Initial Beat** | `locationId: ""` (empty), `choices: []` | Starting scene is placeholder text (`"نقطه شروع داستان..."`), has 0 choices, and has no assigned location! |
| **Chapter 1 Location** | `locationId: "loc_mtovfpvv_fp48"` | Assigned to `قارهٔ فراوند` (root continent), not Zarrin Pol (`loc_mtr1h3jy_8dv6`). |
| **Zarrin Pol Assets** | 5 sub-locations, 5 NPCs ready in World Bible | Rich world building exists in the database, but is completely unlinked to the story's opening flow. |

---

## 4. Comprehensive Remediation Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│                        REMEDIATION ROADMAP                             │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: Production Story Ignition (Faravand / Zarrin Pol)             │
│   1.1 Author 4 Zarrin Pol Archetypes & 4 Background Origins.           │
│   1.2 Anchor Chapter 1 to Zarrin Pol (loc_mtr1h3jy_8dv6).              │
│   1.3 Implement Archetype-driven prologue branching in session init.   │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: Client-Server Synchronization Fix                             │
│   2.1 Pass sessionId in Flutter GameApiService.sendAction.             │
│   2.2 Implement PATCH /api/play/session on Flutter equip/unequip.      │
│   2.3 Assign currentChapterId on session creation.                     │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Relic & Artifact Unification                                  │
│   3.1 Extend WorldArtifact with statModifiers, slot, and passiveBuffs. │
│   3.2 Render stat bonuses and equip controls in Flutter Compendium.    │
│   3.3 Add verb filtering to ActionValidator.checkUnownedArtifact.      │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 4: Vital Systems & Tactical Combat                               │
│   4.1 Dynamically resolve primary health/stamina resource IDs.         │
│   4.2 Implement defeat/death states at 0 HP.                           │
│   4.3 Link Bestiary danger levels, weaknesses, and loot to combat.     │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 5: Two-Way Conversational Engine                                 │
│   5.1 Award positive trustDelta on successful social/diplomacy checks. │
│   5.2 Enable natural secret unlocks through earned trust.              │
│   5.3 Introduce low-stakes dialogue mode (conversation without D20).   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Architectural Specifications for Fixes

### 5.1 Dynamic Vital System Fix (`GameEngine.ts`)
```typescript
// Resolve primary health and stamina IDs dynamically instead of hardcoding 'hp'
const healthRes = rpgSystem.resources.find(r => 
  ['health', 'hp', 'سلامت', 'تندرستی'].includes(r.id.toLowerCase())
) || rpgSystem.resources[0];

const staminaRes = rpgSystem.resources.find(r => 
  ['stamina', 'energy', 'استقامت', 'انرژی'].includes(r.id.toLowerCase())
);

const healthKey = healthRes ? healthRes.id : 'health';
const staminaKey = staminaRes ? staminaRes.id : 'stamina';

if (outcome === 'failure') {
  stateDiff.resourceChanges = { [healthKey]: -10 };
} else if (outcome === 'mixed_success') {
  stateDiff.resourceChanges = {
    [healthKey]: -5,
    ...(staminaKey ? { [staminaKey]: -10 } : {})
  };
}
```

### 5.2 Two-Way Trust Award Specification (`GameEngine.ts`)
```typescript
// When an action is social/diplomatic and results in success, award earned trust:
if (isSocialAction && (outcome === 'success' || outcome === 'critical_success')) {
  const targetNpc = detectSocialTarget(actionText, npcs);
  if (targetNpc) {
    const trustGain = outcome === 'critical_success' ? 15 : 8;
    stateDiff.relationshipChanges = {
      [targetNpc.id]: { trustDelta: trustGain }
    };
  }
}
```

### 5.3 Verb Filtering in `ActionValidator.ts`
```typescript
// Only block artifact claims if the player is claiming to USE or WIELD it,
// NOT when they are asking about, investigating, or searching for it:
const isUsingOrWielding = /\b(use|wield|equip|brandish|activate|cast with|استفاده|به دست گرفتن|مجهز|زدن با)\b/i.test(lowerAction);
if (isUsingOrWielding && !owned) {
  return `"${artifact.name}" is not in your possession. You must obtain it within the story first.`;
}
```

---

## 6. Completed Fixes Log

The following high-priority fixes have been implemented and verified:

### 6.1 Fix 1: Session Continuity & Flutter `sessionId` Transmission
* **Problem**: Flutter client omitted `sessionId` in [`game_api_service.dart`](file:///d:/Code/StoryForge/app/lib/services/game_api_service.dart) when calling `/api/play/action`. The server could not locate the active database session and reverted to unpersisted fallback state.
* **Resolution**:
  * Updated [`GameApiService.sendAction`](file:///d:/Code/StoryForge/app/lib/services/game_api_service.dart) to accept `sessionId` and serialize it into the request payload.
  * In [`GameSessionNotifier.sendAction`](file:///d:/Code/StoryForge/app/lib/providers/game_session_provider.dart), passed `state.sessionId` directly to `sendAction`.

### 6.2 Fix 2: Dynamic Vital Resource Resolution (Immortal Player Remediation)
* **Problem**: In [`GameEngine.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/game/GameEngine.ts), damage and consequence mutations hardcoded the string `'hp'`. In stories where health is keyed as `'health'` (e.g. Faravand), damage mutations fell through to an unlinked resource key, rendering the player invincible.
* **Resolution**:
  * Added dynamic vital key lookup in [`GameEngine.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/game/GameEngine.ts) scanning `rpgSystem.resources` for health aliases (`health`, `hp`, `سلامت`, `تندرستی`) and stamina aliases (`stamina`, `energy`, `استقامت`, `انرژی`).
  * Consequence penalties on failure and mixed success now target the story's actual primary health and stamina keys.
  * Healing potion item effects dynamically replenish the story's primary health resource.

### 6.3 Fix 3: Action Validator Conversational Freedom
* **Problem**: In [`ActionValidator.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/validator/ActionValidator.ts), `checkUnownedArtifact` rejected any player action mentioning an artifact's name if the player didn't own it, blocking legitimate roleplay (e.g., *"Do you know the legend of the Sunstone?"*).
* **Resolution**:
  * Added `isWieldOrUsageClaim` regex check in [`ActionValidator.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/validator/ActionValidator.ts) targeting action verbs (`use`, `wield`, `equip`, `brandish`, `cast with`, `استفاده`, `مجهز`, `زدن با`).
  * Questions, dialogue, and investigations about unowned artifacts pass cleanly without validation rejection, while wielding/using unowned artifacts remains strictly prevented.

### 6.4 Fix 4: Relic Stat Modifiers & Option A Equipment Slots
* **Problem**: Artifacts in the World Bible had descriptions and lore, but zero mechanical stat modifiers, no slot designations, and no UI presentation in either Studio or Flutter Compendium.
* **Resolution**:
  * **Option A Data Model**: Extended `WorldArtifact` and `WorldArtifactSchema` in [`web/src/lib/types/world.ts`](file:///d:/Code/StoryForge/web/src/lib/types/world.ts) with `statModifiers: Record<string, number>`, `slot: 'relic' | 'main_hand' | 'two_handed' | 'off_hand' | 'shield' | 'armor'`, and `passiveBuffs: string[]`.
  * **Session Lore Projection**: Updated [`web/src/app/api/play/session/route.ts`](file:///d:/Code/StoryForge/web/src/app/api/play/session/route.ts) to serialize `statModifiers`, `slot`, `powers`, and `curseOrCost` into `lore.artifacts`.
  * **Studio Editor UI**: Updated [`web/src/app/studio/artifacts/page.tsx`](file:///d:/Code/StoryForge/web/src/app/studio/artifacts/page.tsx) with Option A slot dropdown selector, dynamic stat bonus numeric inputs for every active story stat, and responsive slot/stat card badges.
  * **Flutter Compendium UI**: Updated [`app/lib/ui/screens/compendium_screen.dart`](file:///d:/Code/StoryForge/app/lib/ui/screens/compendium_screen.dart) with `_formatSlotName` localized badges, LTR-safe stat modifier badges (`Directionality(textDirection: TextDirection.ltr)`), powers list, and curse warning alerts.

### 6.5 Fix 5: Unified Studio Sidebar Scrolling & Layout Trap Remediation
* **Problem**: In [`web/src/app/studio/layout.tsx`](file:///d:/Code/StoryForge/web/src/app/studio/layout.tsx), the desktop `<aside>` had an inner scroll lock (`overflow-y-auto min-h-0 flex-1`) restricted strictly to the navigation menu links. The header and user profile were trapped, causing an unnatural nested scrolling behavior.
* **Resolution**:
  * Removed the nested inner scroll trap from the navigation container.
  * Configured the entire `<aside>` as a unified scroll container (`sticky top-0 h-screen overflow-y-auto`).
  * Pinned the user footer cleanly with `mt-auto pt-6 shrink-0`.

### 6.6 Fix 6: Oracle Artifact Ingestion & Rarity Stat Budget Matrix
* **Problem**:
  * When asking the Oracle to generate equipment or items, it produced artifacts without mechanical stat bonuses or equipment slots because:
    1. The Oracle prompt instructions lacked an explicit Easy Insert code block for `artifact`.
    2. The Oracle drawer was not receiving active story RPG stats in its prompt context.
    3. The equipment slot list was restricted to `relic | weapon | armor | accessory` (lacking 2H weapons, off-hand/parrying daggers, and shields).
    4. There was no stat ceiling or budget matrix per rarity tier, allowing common items to roll legendary modifiers or illegal curses.
* **Resolution**:
  * **Expanded Slots**: Added `main_hand`, `two_handed`, `off_hand`, `shield`, `armor`, `relic` to `WorldArtifact`.
  * **Stat Budget Matrix**: Exported `ARTIFACT_RARITY_BUDGETS` in [`web/src/lib/types/world.ts`](file:///d:/Code/StoryForge/web/src/lib/types/world.ts) (`common`: max +1 single, max +1 total, 1 power, no curse; `uncommon`: +2/+2; `rare`: +3/+4; `epic`: +4/+6; `legendary`: +5/+8; `mythic`: +8/+12 with mandatory curse).
  * **Two-Handed 2x Stat Budget Rule**: Because two-handed weapons (`two_handed`) occupy both hand slots and forfeit the off-hand item slot, they receive double (`2x`) the stat budget of 1-handed weapons across all rarity tiers (e.g. Common up to +2, Rare up to +8 total / +6 single, Legendary up to +16 total / +10 single, Mythic up to +24 total / +16 single), implemented in `getArtifactStatBudget`.
  * **Active Stat Context**: Injected active story RPG stats into [`StudioOracleDrawer.tsx`](file:///d:/Code/StoryForge/web/src/components/studio/StudioOracleDrawer.tsx) prompt context.
  * **Automatic Normalization**: Added slot resolution and 2-hand aware stat budget clamping to [`ActionNormalizer.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/world/ActionNormalizer.ts).
  * **Studio Budget Indicator**: Added a dynamic stat budget badge and validation ceiling in [`web/src/app/studio/artifacts/page.tsx`](file:///d:/Code/StoryForge/web/src/app/studio/artifacts/page.tsx) reflecting the 2x boost whenever a two-handed weapon is selected.

### 6.7 Fix 7: Studio Artifact Form Null-Safety (`undefined.trim()` Crash)
* **Problem**: In [`web/src/app/studio/artifacts/page.tsx`](file:///d:/Code/StoryForge/web/src/app/studio/artifacts/page.tsx), when opening an artifact created via the Oracle or imported without optional fields (`title`, `originEra`, `curseOrCost`, `powers`, `vaultLore`), `handleOpenEditModal` passed `undefined` directly into state. Submitting the form called `artTitle.trim()`, triggering `Uncaught TypeError: Cannot read properties of undefined (reading 'trim') at onSubmit`.
* **Resolution**:
  * Added safe null/undefined fallback accessors across all fields in `handleSaveArtifact` (e.g., `(artTitle || '').trim()`).
  * Ensured `handleOpenEditModal`, `applyAiFill`, and form input `value` props default to empty strings (`''`).
  * Verified with `npx tsc --noEmit` and full automated test suite.

### 6.8 Architecture Findings: Ghost Quest System & Trade Route Separation
* **Finding 1 (Resource Extraction vs. Market Presence)**:
  * Minerals and flora are modeled in `WorldCreature` where `habitatLocationIds` represents natural extraction veins. Setting a city in `habitatLocationIds` deceived the AI into treating the city as an active mine.
  * **Remediation**: Formulated and documented **[Plan 10: Trade Routes, Caravans & Dynamic Economy](file:///d:/Code/StoryForge/docs/plans/10_TRADE_ROUTES_CARAVANS_AND_ECONOMY_PLAN.md)** to let goods flow organically along caravan arteries.
* **Finding 2 (The Ghost Quest Architecture)**:
  * Runtime player state tracked `activeQuestIds`, `completedQuestIds`, and `questUpdates`, and NPC secrets had `SecretRevealMethodKind = 'quest'`, but `WorldBible` had no `WorldQuest` entity. Quests could not be authored or commissioned.
  * **Remediation**: Formulated and documented **[Plan 11: Quests, Quest Lines & NPC Trust Progression](file:///d:/Code/StoryForge/docs/plans/11_QUESTS_OBJECTIVES_AND_TRUST_PROGRESSION_PLAN.md)**, establishing trigger items, turn-in items, sequential quest lines, and direct NPC trust / secret unlocks.


