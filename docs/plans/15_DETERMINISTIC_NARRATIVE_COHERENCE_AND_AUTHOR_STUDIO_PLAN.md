# Plan 15: Deterministic Narrative Coherence, Pre-Generation Paradigms, Vitality Bar & Author Studio Plan

## 1. Executive Summary & Problem Diagnosis

StoryForge's dynamic storytelling engine currently relies on the Writer LLM (Gemini) to simultaneously serve two roles:
1. **The Game Physics & World Simulation Engine** (remembering who is standing in the room, where animals live, whether an injury hurts, and which items are nearby).
2. **The Literary Prose Stylist** (generating evocative, immersive Persian or English narrative prose and meaningful choices).

Whenever narrative blunders occur (such as a river creature appearing in an arid desert cave, companions ignoring a companion's bleeding wound, or distant caravan NPCs speaking inside a secluded ravine), previous efforts attempted to fix them by **patching the prompt** with additional negative rules (*"don't spawn marsh snakes in deserts"*, *"don't let caravan NPCs talk if far away"*, *"remember to treat wounds"*).

### 1.1 The "Whack-a-Mole" Dilemma of Prompt Patching
Prompt patching is fundamentally unsustainable for five reasons:
1. **Attention Dilution & Rule Saturation**: As prompts accumulate dozens of negative caveats, the model's adherence to any single constraint drops sharply.
2. **The Negative-Prompting Paradox**: Writing *"Do not use river snakes like the Marsh Viper in this scene"* actually injects the token `Marsh Viper` into the model's immediate context window, increasing its probability of selection.
3. **Context Contradiction (Data vs. Instruction)**: In [`PromptAssembler.ts`](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/PromptAssembler.ts#L66-L70), the engine dumps the entire World Bible bestiary into the prompt and commands:
   > *"When wildlife, predators, or monstrosities appear, you MUST draw from these canonical creatures..."*
   If the story only has a marsh serpent defined, and the player is in a desert cave, the LLM is trapped between an imperative command to use canonical creatures and an absence of desert beasts. It chooses the marsh serpent.
4. **Blanket Caravan Presence**: In [`tradeRoutes.ts`](file:///g:/Code/StoryForge/web/src/lib/engines/world/tradeRoutes.ts#L144-L195), touching any waypoint on a trade route tags **all caravan NPCs** as physically active at that location. Furthermore, `tradeRoutes.ts:114-115` explicitly prints the traveling retinue names into the prompt, giving the model double exposure. The model naturally has them speak, even if the player snuck down a cliff alone.
5. **Forward-Momentum Bias**: Pre-trained LLMs naturally rush toward action tropes. Without an explicit, mechanical mandate forcing an emotional pause, companions will step over a friend's bleeding wound to trigger the next combat encounter.

### 1.2 The "Dead Status" Problem in the Reader Client
At the beginning of each beat in the Flutter app, the player's status is rendered by [`ConditionChips`](file:///g:/Code/StoryForge/app/lib/ui/widgets/condition_chips.dart):
> `وضعیت: [کویر سرخ هیام] [ناآشنا] [هوشیار]`

This component is currently **lifeless and ineffective**:
1. **Flat Developer Aesthetic**: Small, undifferentiated grey and colored pills dumped next to a generic `"وضعیت:"` label. It reads like a debug inspector rather than a vital storytelling dashboard.
2. **Missing Spatial Depth**: Location is rendered as a flat string (e.g. `[کویر سرخ هیام]`). If the player descends into a ravine, enters a hidden cave, or rests at the caravan campfire, this micro-location is invisible.
3. **Static & Uncommunicative**: If no explicit conditions are active, the bar either vanishes or stays stuck on static character-creation traits (like `ناآشنا`). It fails to communicate vitality, somatic strain (wounds, thirst, exhaustion), or psychological tension (fear, shock, focus).

---

## 2. Strategic Evaluation of Generation Paradigms

### 2.1 The Pre-Generation Question: "What if we pre-generate every scene?"

A natural question arises: *Can we eliminate all AI hallucinations and latency by pre-generating all scenes in Studio ahead of time?*

Evaluating pre-generation reveals four distinct approaches with stark trade-offs:

```
                            PRE-GENERATION APPROACHES
                                       |
    +-------------------+--------------+--------------+--------------------+
    |                   |                             |                    |
[1. Pure Tree]     [2. Folded Graph]             [3. AOT Cache]       [4. Hybrid Reader]
Branching explosion  Convergent Milestones         Background JIT       Authored Spine +
(9^D paths; fails)  (15-25 nodes/chapter)         (0ms, state-aware)   AI Bridges (Plan 12)
```

#### Approach 1: The Pure Branching Tree (Combinatorial Trap)
- **Math**: If each turn offers 3 choices and 3 RPG check outcomes (Success, Mixed, Failure), branching factor $B = 9$:
  - Turn 1: 1 scene
  - Turn 3: 81 scenes
  - Turn 5: 6,561 scenes
  - Turn 7: **531,441 scenes!**
- **The Verdict**: Pure tree pre-generation is mathematically unviable for long stories. 98% of generated content is never seen by a single player, and no human author can review 50,000 scenes. Furthermore, pre-generated text cannot anticipate dynamic player state (inventory combinations, custom trust scores, specific limb injuries).

#### Approach 2: The Folded "Diamond" Graph (The Inkle / Telltale Model)
- **Concept**: Instead of an endless tree, story chapters use **Convergent Milestones (Bottlenecks)**:
  - Turn 1 (Oasis Camp) offers 3 divergent choices (Scout ahead, Guard camels, Interrogate traveler).
  - Turn 2 branches diverge into 3 distinct scenes.
  - Turn 3 **folds back** into a single mandatory milestone: *The Night Sandstorm Strikes*.
  - Scene variations in Turn 3 are handled by **conditional state tags** (*"if player scouted ahead: caught in the open"*; *"if player guarded camels: holding reins"*).
- **The Verdict**: Highly practical! A chapter contains only **15–25 total scenes**. Authors can generate, review, and polish all 25 scenes in Studio. Delivers 100% quality control, 0ms mobile latency, and offline play.

#### Approach 3: Predictive Ahead-of-Time (AOT) Pre-Caching
- **Concept**: Generate just-in-time while the player is reading:
  - While the player spends 30–60 seconds reading Scene 2, a background worker pre-generates the 3 possible Scene 3 continuations based on their exact current inventory, health, and relationship scores.
  - When the player taps a choice, the next scene renders **instantly (0ms)** with zero combinatorial waste.
- **The Verdict**: Combines dynamic, state-aware AI generation with zero player latency.

#### Approach 4: The Hybrid Reader (Plan 12)
- **Concept**: 8–12 canonical authored beats form the chapter's backbone. Runtime AI (Director/Scribe) acts as an adaptive bridge whenever players roll failures, get displaced into hazards, or improvise unusual tactics, guiding them back toward the canon spine.

---

### 2.2 Paradigm Comparison Matrix

| Paradigm | Quality & Control | Turn Latency | Story Length & Freedom | Author Workload |
| :--- | :--- | :--- | :--- | :--- |
| **A. Pure Runtime AI (Current)** | Variable (hallucination risk) | 2–5s | Infinite dynamic branching | Low (author writes Bible) |
| **B. More Expensive LLM (Pro/Opus)** | Higher literary polish | 8–15s (unacceptable for mobile) | Infinite dynamic branching | Low (higher API bill) |
| **C. Post-Generation LLM Critic** | Catches blunders before render | 6–10s (doubled latency) | Infinite dynamic branching | Low (timeout prone) |
| **D. Folded Bottleneck Graph (CYOA)** | **100% human-vetted** | **0ms (instant)** | Fixed chapter length (15–25 scenes) | Moderate (author reviews 20 scenes) |
| **E. Predictive AOT Pre-Caching** | Strong (with strict scoper) | **0ms on hit** (miss = full generation + wasted background call) | Infinite dynamic branching | Low (fully automated) |
| **F. Hybrid Reader (Plan 12)** | 90% (anchored to canon) | 0ms on canon, 2s on bridges | High | Moderate (author sets 10 beats) |

### 2.3 Reader Dwell-Time Compute Program

The 30–60s a player spends reading a scene is the only free compute in the loop. Spend it in four tiers, cheapest first:

1. **Asset prefetch (near-free, never wasted)** — next-likely location art, undecided discovery-card portraits, ambient audio. Pure client work, no model cost.
2. **Snap pre-judgments (~1s, tiny cost)** — run the turn's bounded decisions (wound check, confrontation classification, discovery mention validation) during reading via the in-repo `SubQAdapter` (`subq-snap-preview`), so choice-tap time does zero decision work. Results cache on the turn; fast tappers fall through to the live timeout+regex path.
3. **Context precompute (free, deterministic)** — build pruned world-context blocks for each choice's likely next location now; pure CPU off the next turn's critical path.
4. **AOT narrative pre-generation, Snap-gated (expensive, gated)** — instead of generating all 2–4 continuations, Snap predicts the single most likely choice (session history + traits/relationships + presented choices; 384K context fits full history), the server pre-rolls that choice's check during reading (free RNG, stored, revealed on tap), and the writer pre-generates that exact branch. Predicted tap → instant render; anything else (including free text) → live path as today. Cost per turn: 1 Snap + at most 1 wasted writer call on a miss.

**Constraints**: all background work cancels the moment the user acts (AbortController); the dice pre-roll is a design change — tap-time dice animation must reveal the stored value, not roll fresh; free-text actions always miss (unpredictable input); AOT ships only behind a measured-hit-rate gate — every prediction is logged to `snap_decision_logs` at render and resolved on tap (`hit`: true = predicted tap, false = wrong choice or free text, null = abandoned), and promotion to live AOT requires the measured hit rate over that table, not intuition.

---

## 3. The Five Architectural Pillars

```
                                  [ Player Action + Check Result ]
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 1: DETERMINISTIC SPATIAL & ECOLOGICAL SCOPER                                          |
  | - Habitat filter: Creature habitatLocationIds MUST match current location.                    |
  | - If no match, inject [ENVIRONMENTAL GUIDANCE] fallback (no predator beasts).                 |
  | - Party Co-Presence filter: Only accompanyingNpcIds or resident NPCs are active.              |
  | - Narrow caravan retinue: Do not dump traveling retinue into active scene dossiers.           |
  +-----------------------------------------------------------------------------------------------+
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 2: MECHANICAL CONDITIONS & EMOTIONAL ANCHORS                                           |
  | - Parse playerState.conditions for untreated injuries (e.g. bleeding_wound, severe trauma).    |
  | - Inject a capped single-line [MANDATORY EMOTIONAL DIRECTIVE] for immediate human reaction.   |
  +-----------------------------------------------------------------------------------------------+
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 3: PRE-GENERATION SCENE FRAMING (DIRECTOR PASS)                                       |
  | - Hook into existing momentumGuardrail.ts to enforce pacing (reflective vs. kinetic beats).   |
  | - Whitelist up to 2–4 physical interactables derived from the location's `pointsOfInterest` / `subZones` entries (or carried inventory props) — no invented metric distances; no `20m bubble` data source exists. |
  +-----------------------------------------------------------------------------------------------+
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 4: LIVING VITALITY & SCENE PRESENCE BAR (FLUTTER FULL REWORK)                          |
  | - Full rework of beat header tags: Macro/Micro-location + Body (physical) + Mind (mental).    |
  | - Dynamic baseline derivation: always alive and communicative, never empty.                  |
  +-----------------------------------------------------------------------------------------------+
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 5: STUDIO ENVELOPE INSPECTOR & SANDBOX UI                                              |
  | - Extend /studio/sandbox: inspect included vs. excluded entities with explicit rationale.     |
  | - Optional Chapter Graph Generator: generate and hand-polish 15–25 scene folded graphs.       |
  +-----------------------------------------------------------------------------------------------+
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 6: COPY-ON-WRITE LIVING WORLD STATE OVERLAY (PER-PLAYTHROUGH BRANCH ISOLATION)         |
  | - Persistent delta overlay in sagaLedger (locationStatuses, factionStatuses, worldEvents).     |
  | - Cataclysm projection: destroyed cities, severed bridges, dead mentors stay dead per player. |
  | - Zero database bloat: canonical World Bible remains immutable; delta projected at runtime.   |
  +-----------------------------------------------------------------------------------------------+
```

---

## 4. Detailed Specifications

### 4.1 Narrow Live Bug Fixes (Zero Migration)

#### Bug 1: The Bestiary Habitat Loophole & "MUST Draw" Trap
- **Current Problem**: In `worldContext.ts:463-467`, creatures pass if `habitatLocationIds.length === 0`. If authors haven't filled in habitats, all creatures pass. Then `PromptAssembler.ts:68` commands: *"When wildlife, predators, or monstrosities appear, you MUST draw from these canonical creatures"*. The model is trapped into placing wetland creatures in desert caves.
- **Fix**:
  1. If `habitatLocationIds` is specified, strictly require matching the current location.
  2. If a creature lacks `habitatLocationIds`, keep it eligible in Phase 1 (no strict exclusion) and surface a Studio habitat-coverage nudge ("N creatures lack habitats") so authors fill the data. Strict exclusion is deferred: it needs a new `globalRoaming` flag on `WorldCreature` (does not exist today) plus a location biome tag (`category` today is only stronghold/dungeon/ruins/settlement/wilderness — no desert/arctic/underwater concept), i.e. an explicit data migration, not zero-migration.
  3. When no creature matches the location, replace the imperative command at BOTH MUST-draw sites in `PromptAssembler.ts` — the context-header directive (`:66-70`) AND the continuity `BESTIARY GROUNDING & VISCERAL TRAITS` directive (`:250`, plus its Persian protocol twin if authored separately) — with:
     > `[ENVIRONMENTAL GUIDANCE]: No predatory beasts inhabit this immediate terrain. Focus tension on terrain hazards, physical exhaustion, harsh weather, and environmental atmosphere.`

#### Bug 2: Blanket Caravan Retinue Exposure
- **Current Problem**: In `worldContext.ts:421-428`, every trade route touching the location pulls all `travelingNpcIds`. Then `tradeRoutes.ts:114-115` prints the retinue names into the prompt string.
- **Fix**:
  1. Only pull caravan travelers into `activeNpcDossiers` when the traveler's `currentLocationId` equals the scene location (data that exists today — locations carry no camp/waypoint concept, so rules keyed on "Caravan Camp" are not computable).
  2. Scope the retinue string in `tradeRoutes.ts` to omit individual retinue names unless at least one traveler satisfies rule 1 (caravan physically present); otherwise list only the route/cargo summary with no names.

#### Bug 3: Teleporting NPCs without Heavy Sub-Zone Migrations
- **Fix**: Introduce `accompanyingNpcIds: string[]` on `PlayerState`.
- Only resident NPCs of the current location OR NPCs in `accompanyingNpcIds` are eligible to speak in immediate dialogue. Caravan members resting at camp remain in the background.
- **Roster Writer Architecture (Completed)**:
  1. **Deterministic Action Parser**: Implemented via `GameEngine.detectPartyChange` and `applyPartyChange` in `socialEngine.ts`. Rewrites the accompanying roster purely based on reader actions with zero LLM model calls or schema drift.
     - **Join**: "come with / join me / follow me / با من بیا" + mentioned NPC adds them to `accompanyingNpcIds`.
     - **Leave**: "stay here / wait here / اینجا بمان / نگهبانی بده" + mentioned NPC removes them.
     - **Go Alone**: "by myself / on my own / scout alone / تنها می‌روم / به‌تنهایی" sets `accompanyingNpcIds: []` (explicitly alone).
     - **Camp Return & Regroup**: "return to camp / head back to caravan / regroup with caravan / بازگشت به کاروان / برگشت به اردوگاه" automatically rejoins with caravan base companions (excluding deceased/missing NPCs).
  2. **Session Seeding**: Initialized in `session/route.ts` from canonical companions (`worldBible.npcs` where `status === 'companion'` or `role === 'companion'`) and pre-authored `saga.ledger.npcStatuses`.
  3. **State Mutation & Round-Trip**: Emitted through `resolution.stateDiff.accompanyingNpcIds`, applied via `applyStateMutation`, stored on `playerState`, and synced to Flutter `GameState.accompanyingNpcIds` with full tri-state preservation (`undefined` = legacy ledger fallback, `[]` = alone, `[id, ...]` = active party). Localized consequence summaries (EN + FA) narrate the party change.

#### Bug 4: Companion Apathy Toward Wounds
- **Current Representation**: Conditions in `PlayerState` are currently `List<string>` (e.g. `['ناآشنا', 'هوشیار']`) and describe the *protagonist*, not companions (companion injuries are tracked nowhere — per-NPC wound storage is a separate schema decision, not part of this fix).
- **Fix**: Support string tags like `'injury:bleeding:severe'` or `'wound:arrow'` without breaking existing sessions.
- Inject a single-line directive for the *player's* untreated wound, which present allies must acknowledge:
  > `[CRITICAL EMOTIONAL BEAT]: The protagonist suffered an untreated injury last turn. Present allies must acknowledge this (checking the wound, offering water, or bandaging) before advancing.`

---

### 4.2 Pillar 4: Living Vitality & Scene Presence Bar (Flutter Rework)

Rework the beat header from the flat `ConditionChips` into a cohesive, atmospheric **Vitality & Scene Presence Bar** placed directly above each beat's narrative prose.

```
+----------------------------------------------------------------------------------------------------+
|  📍 SPATIAL PRESENCE (موقعیت و خرد‌مکان)       ❤️ BODY (جسم و تن)            🧠 MIND (روان و ذهن)     |
|  [ کویر سرخ هیام • کاروان‌گاه دشت‌بانان ]     [ 🩸 جراحت خونین ] [ 💧 تشنه ]    [ 👁️ هوشیار و مراقب ]  |
+----------------------------------------------------------------------------------------------------+
```

#### A. Zone 1: Spatial Presence & Micro-Location (Sphere of Presence)
- **Hierarchical Display**: Shows `[Macro Location] • [Micro-Location / Sub-Zone]`.
  - E.g.: `کویر سرخ هیام • کاروان‌گاه دشت‌بانان` (*Hiram Red Desert • Drover's Camp*)
  - Or: `کویر سرخ هیام • شیب درهٔ خاموش` (*Hiram Red Desert • Silent Ravine Slopes*)
  - Or: `غار نمک • مدخل بادگیر` (*Salt Cavern • Windswept Mouth*)
- **Resolution**:
  - `PlayerState` tracks `currentLocationId` and `currentSubZoneId`.
  - `GameSessionState.locationWithSubZone(lore, locationId, subZoneId)` resolves the parent location and the matching entry in `location.subZones[]` (or active point of interest).
- **Visual**: Glassmorphic dark cyan/amber badge with compass/pin icon and subtle ambient border glow.

#### B. Zone 2: The Physical Body (جسم و تن)
Tracks somatic integrity, wounds, and physical needs. **Never empty or dead**:
- **Dynamic Baseline Derivation**:
  - If $HP \le 35\%$ or explicit injury tag: **`🩸 جراحت خونین / Wounded`** (Crimson pulse badge).
  - If $Stamina \le 25\%$: **`💨 فرسوده و بی‌رمق / Exhausted`** (Warm amber badge).
  - If $WaterClock \ge 2$: **`💧 تشنه و خشک‌لب / Parched`** (Sky-blue badge).
  - If $Poisoned$: **`🧪 مسموم / Venomed`** (Toxic lime badge).
  - If healthy & unburdened ($HP > 75\%$ & no debuffs): **`🛡️ تندرست و قبراق / Vigorous`** (Soft emerald badge).

#### C. Zone 3: The Mind & Morale (روان و ذهن)
Tracks focus, shock, fear, and mental posture:
- If surprised / in shock: **`⚡ شوک‌زده و مبهوت / Shaken`** (Violet badge).
- If focused & alert: **`👁️ هوشیار و گوش‌به‌زنگ / Vigilant`** (Teal badge).
- If disoriented / concussed: **`🌀 سرگیجه و گیجی / Dazed`** (Deep purple badge).
- If in a strange, unexplored land: **`🧭 غریبه در اقلیم / Outsider`** (Indigo badge).
- If resolute under pressure: **`⚔️ ارادهٔ پولادین / Resolute`** (Steel-blue badge).

#### D. Tactical Stance / Environment (موقعیت و کنش)
Contextual environmental stance tags:
- `در پناه سایه‌ها / Concealed`, `در تیررس و بی‌پناه / Exposed`, `موقعیت مسلط / High Ground`.

#### E. Visual Polish & Interactions (Emil Kowalski Philosophy)
1. **Glassmorphism Styling**: `surfaceContainer` dark translucent styling with rounded 16px contours, subtle directional borders, and responsive wrap.
2. **Interactive Literary Tooltips**: Tapping or holding any badge opens a rich, lore-grounded tooltip explaining the physical state and its gameplay consequences (e.g. *"جراحت بر بازو: در صورت درگیری فیزیکی سنگین، استقامت بیشتری از دست می‌دهید."*).
3. **RTL Directionality Enforcement**: Explicit `Directionality.ltr` or Left-to-Right Marks (`\u200E`) on all numbers, icons, and separators to guarantee clean typography in Persian and English.

---

### 4.3 Pillar 6: Copy-on-Write (CoW) Living World State Overlay & Playthrough Isolation

#### A. The Problem: Irreversible World Cataclysms & Player Divergence
When a player makes high-stakes decisions during a campaign:
- **Major Character Deaths**: A mentor, companion, or imperial monarch is executed or falls in battle (e.g. Borzou dies defending the caravan, or Baroness Vey is slain).
- **Macro Cataclysms / Cities Wiped Off the Map**: A siege breaches the walls, an earthquake shatters the mountain pass, or a plague/curse renders an entire metropolis a ruined, uninhabitable wasteland (e.g. the Citadel of Winds collapses into a smoking crater; its sub-zones are obliterated; bridges are severed).
- **Faction Fracture & Geopolitical Collapse**: A dominant faction is overthrown, a civil war breaks out, or an underground guild seizes power.
- **Relic / Artifact Destinies**: Legendary world relics are consumed, shattered, stolen, or unsealed.

**The Danger**: If world modifications overwrite canonical entities, every player's campaign or the master Story Bible is permanently corrupted. If they are not recorded, the AI hallucinates living dead characters and intact bustling cities in subsequent turns, completely shattering narrative immersion. Full JSON cloning of the entire World Bible for each session causes database bloat, breaks schema migrations, and severs upstream author updates.

#### B. The Solution: Copy-on-Write (CoW) Delta Overlay Architecture
We treat the canonical `story.worldBible` as an immutable **Base Layer** (version-pinned via `worldBibleVersion`). Each player playthrough maintains a lightweight **Delta Overlay Layer** directly inside `session.sagaLedger`:

```ts
export interface LocationStatusEntry {
  locationId: string;
  locationName: string;
  status: 'intact' | 'damaged' | 'ruined' | 'destroyed' | 'occupied' | 'inaccessible';
  nameOverride?: string;             // e.g. "خرابه‌های ارگ بادها / Ruins of the Citadel"
  descriptionPatch?: string;         // Literary atmosphere describing devastation/occupation
  destroyedSubZoneIds?: string[];    // Micro-locations that no longer exist
  hazardLevelDelta?: number;         // Danger level escalation (+1 to +5)
  severedConnectionIds?: string[];   // Cut travel links (collapsed bridges / blockaded roads)
  note?: string;                     // Chapter/turn summary of why this change occurred
}

export interface FactionStatusEntry {
  factionId: string;
  factionName: string;
  status: 'active' | 'weakened' | 'dissolved' | 'dominant' | 'civil_war';
  leaderNpcId?: string;              // Succession after leader assassination
  powerLevelDelta?: number;          // Military/economic drift
  note?: string;
}

// Extended WorldStateLedger Schema (in world.ts)
export interface WorldStateLedger {
  factionReputations: FactionReputationEntry[];
  npcStatuses: NpcLifeStatusEntry[];
  keyItems: KeyItemLedgerEntry[];
  chapterSummaries: ChapterSummaryEntry[];
  openPlotThreads: string[];
  worldBibleVersion?: number;
  
  // Pillar 6: Per-Playthrough Cataclysm & World State Overlay
  locationStatuses?: LocationStatusEntry[];
  factionStatuses?: FactionStatusEntry[];
  irreversibleWorldEvents?: string[]; // e.g. ["cataclysm:citadel_collapsed", "breach:salt_cavern_flooded"]
}
```

#### C. Runtime Projection: `projectPlaythroughWorld(baseBible, sagaLedger)`
Before prompt assembly and narrative generation (`worldContext.ts:buildWorldContextBlocks` and `pruneWorldBibleToScope`), the engine dynamically projects the playthrough overlay onto a working view:
1. **Destroyed Locations**:
   - Status, description patches, and name overrides replace canonical fields in the active context envelope.
   - Connected locations listed in `severedConnectionIds` are removed from the 1-hop travel graph.
   - Sub-zones listed in `destroyedSubZoneIds` are purged from selectable destinations.
   - If the player is at or near a destroyed location, prompt directives enforce the devastation:
     > `[WORLD STATE INVARIANT]: The Citadel of Winds was destroyed in Chapter 2. It is a lifeless, smoldering ruin. Under NO circumstances depict functioning taverns, guards on patrol, or thriving markets.`
2. **Deceased / Transformed NPCs**:
   - Any NPC marked `status: 'dead'` in `ledger.npcStatuses` is strictly barred from active dialogue pools, companion rosters, and living scene encounters.
   - If mentioned, they are referred to only in the past tense or as an underlying emotional memory.
3. **Faction Realignment**:
   - Dissolved factions lose their standing and presence; successor leaders take over command directives.

#### D. Snapshot Promotion ("Fork Playthrough into Custom Sandbox World")
Authors and players can take an extraordinarily divergent playthrough in StoryForge Studio and execute **"Fork World from Playthrough"**:
- The projected `base + overlay` state is materialized into a brand-new canonical `World` and `Story` row in PostgreSQL.
- Allows authors to playtest catastrophic campaign paths and instantly turn them into official sequel modules (e.g. *StoryForge: Fall of the Citadel*).

---

## 5. Pragmatic Implementation Roadmap

```
                                  EXECUTION ROADMAP
                                          |
  +-----------------------------------------------------------------------------------+
  | PHASE 1: IMMEDIATE ZERO-MIGRATION BACKEND FIXES                                   |
  | 1. worldContext.ts: specified habitats must match; empty-habitat stays      |
  |    eligible in Phase 1 + Studio coverage nudge (strict exclusion deferred).  |
  | 2. Fix PromptAssembler.ts: inject [ENVIRONMENTAL GUIDANCE] when bestiary is empty.|
  | 3. Fix tradeRoutes.ts & worldContext.ts: stop blanket caravan retinue exposure.   |
  +-----------------------------------------------------------------------------------+
                                          |
                                          v
  +-----------------------------------------------------------------------------------+
  | PHASE 2: LIVING VITALITY BAR & MICRO-LOCATION CLIENT REWORK                       |
  | 1. Extend PlayerState in Flutter & web with currentSubZoneId.                     |
  | 2. Implement GameSessionState.locationWithSubZone resolution in provider.         |
  | 3. Completely rebuild ConditionChips into VitalityPresenceBar in Flutter app.     |
  | 4. Implement dynamic baseline derivation for Body and Mind (zero dead state).     |
  +-----------------------------------------------------------------------------------+
                                          |
                                          v
  +-----------------------------------------------------------------------------------+
  | PHASE 3: ACCOMPANYING PARTY ROSTER & WOUND DIRECTIVES (COMPLETED)                 |
  | 1. Support accompanyingNpcIds on PlayerState & deterministic Roster Writer.        |
  | 2. Add single-line emotional reaction directive for untreated wound conditions.   |
  +-----------------------------------------------------------------------------------+
                                          |
                                          v
  +-----------------------------------------------------------------------------------+
  | PHASE 4: STUDIO SANDBOX ENVELOPE INSPECTOR                                        |
  | 1. Extend /studio/sandbox with an Envelope Inspector panel.                       |
  | 2. Display included vs. excluded entities with explicit exclusion rationale.      |
  +-----------------------------------------------------------------------------------+
                                          |
                                          v
  +-----------------------------------------------------------------------------------+
  | PHASE 5: STUDIO FOLDED GRAPH GENERATOR (OPTIONAL PRE-GENERATION)                  |
  | 1. Studio tool to generate a 15–25 node folded bottleneck graph for a chapter.    |
  | 2. In-browser editor to review, polish, and lock in 100% human-vetted scenes.     |
  +-----------------------------------------------------------------------------------+
                                           |
                                           v
  +-----------------------------------------------------------------------------------+
  | PHASE 6: READER DWELL-TIME COMPUTE (§2.3)                                         |
  | 1. Asset prefetch + context precompute (no gate, pure win).                       |
  | 2. Snap pre-judgments during reading, timeout+regex fallback (needs SUBQ key).     |
  | 3. Log choice-prediction hit rate; promote Snap-gated AOT only behind data.       |
  +-----------------------------------------------------------------------------------+
                                           |
                                           v
  +-----------------------------------------------------------------------------------+
  | PHASE 7: COPY-ON-WRITE WORLD STATE OVERLAY & PROJECTION (§4.3)                     |
  | 1. Extend WorldStateLedger with locationStatuses, factionStatuses, worldEvents.    |
  | 2. Implement projectPlaythroughWorld() in worldContext.ts before context build.    |
  | 3. Add Studio "Fork World from Playthrough" action for persistent divergent lore.  |
  +-----------------------------------------------------------------------------------+
```

---

## 6. Success Metrics & Verification

1. **Ecology Verification**: Zero cross-biome creatures spawned across 50 test turns in desert/cave environments.
2. **Co-Presence Verification**: Zero dialogue lines spoken by camped caravan members when the player is scouting away from the main camp.
3. **Vitality Bar Liveness**: The beat header is 100% active on every single turn, displaying valid Body (physical) and Mind (mental) statuses with zero empty states.
4. **Micro-Location Accuracy**: Sub-zones render alongside macro-locations in the beat header whenever defined in the World Bible.
5. **Emotional Continuity**: 100% of severe injuries acknowledged by present companions in subsequent narrative turns.
6. **Latency Budget**: Maintained turn latency $\le 2.5\text{s}$ pinned to the `gemini-3.5-flash-lite` default. 0ms for pre-generated/cached nodes on hit.
7. **Author Visibility**: Complete context envelope and entity exclusion rationale visible in `/studio/sandbox` in $< 1\text{s}$.
8. **Dwell-Time Efficiency**: Snap pre-judgments cached before tap on measured turns; AOT pre-generation promotes from logging-only to live only behind the measured hit rate over `snap_decision_logs`.
9. **Multiverse Isolation Verification**: Zero state bleed across distinct playthroughs of the same story; cataclysms and character deaths remain 100% contained within the session's ledger overlay.

---

## 7. Review Notes & Code-Verified Amendments

> Added during implementation review (October 2026). Every file, line range, and claim was re-verified against the working tree.

### 7.1 Verification Ledger

| Claim | Status | Detail |
| :--- | :--- | :--- |
| Bestiary "MUST draw" imperative | Confirmed | [`PromptAssembler.ts:66-70`](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/PromptAssembler.ts#L66-L70) — directive is verbatim; fires whenever `context.bestiary?.length > 0`. |
| Habitat loophole passes all empty-habitat creatures | Confirmed | [`worldContext.ts:463-467`](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/worldContext.ts#L463-L467) — `c.habitatLocationIds.length === 0 \|\|` short-circuit as described. |
| Blanket caravan retinue exposure | Confirmed, understated | [`worldContext.ts:421-429`](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/worldContext.ts#L421-L429) tests against `activeLocSet`, which also contains connected locations ([L402](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/worldContext.ts#L402)) and location ancestors ([L403-404](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/worldContext.ts#L403-L404)). Routes touching an *adjacent* location leak their retinues into the current scene. Double exposure via [`tradeRoutes.ts:114-115`](file:///g:/Code/StoryForge/web/src/lib/engines/world/tradeRoutes.ts#L114-L115) and [`getActiveNpcsForLocation` L144-195](file:///g:/Code/StoryForge/web/src/lib/engines/world/tradeRoutes.ts#L144-L195) confirmed. |
| Location sub-zones schema exists | Confirmed | [`world.ts:183`](file:///g:/Code/StoryForge/web/src/lib/types/world.ts#L183) — `subZones?: LocationSubZone[]` already exists in WorldLocation schema. |
| `momentumGuardrail.ts` and `/studio/sandbox` exist as extension points | Confirmed | No rebuild needed for Pillars 3 & 5. |

### 7.2 Vitality Bar Compatibility Note
- In existing sessions where `playerState.conditions` is a simple `List<String>` (e.g. `['ناآشنا', 'هوشیار']`), the new `VitalityPresenceBar` classifies them gracefully:
  - Tags matching physical keywords (`'زخمی'`, `'خسته'`, `'تشنه'`, `'مسموم'`) map to the **Body** column.
  - Tags matching mental keywords (`'هوشیار'`, `'گیج'`, `'ناآشنا'`, `'مظنون'`) map to the **Mind** column.
  - If either column has no explicit condition, the dynamic baseline auto-derives healthy/vigorous status from $HP$ and stamina, guaranteeing **zero dead states**.

### 7.3 State Ownership
- `accompanyingNpcIds`: Fully implemented & resolved. Home is `PlayerState.accompanyingNpcIds` (mirrored in Flutter `GameState.accompanyingNpcIds`). Written deterministically by `GameEngine.detectPartyChange` / `applyPartyChange` in `socialEngine.ts` and `action/route.ts` (§2b¾). Seeded at session initialization in `session/route.ts`. Cleared (`[]`) on explicit "scout alone / go alone" actions. Regroups with camp companions on "return to camp / caravan" actions.
- `currentSubZoneId`: no writer exists today. Decide who sets it on movement and where it lives; the Flutter client parses zero subZones today, so `locationWithSubZone` is new model + provider work, not an extension of `locationName` (`game_session_provider.dart:195`).
- Wound tags (`'injury:bleeding:severe'` style strings on the protagonist's `conditions`) need no migration; per-NPC wounds are out of scope for Bug 4.

### 7.4 Phase 3 v1 Decisions (2026-10-16, implemented)
- **Roster tri-state**: `accompanyingNpcIds` `undefined` = legacy (derive from ledger `companion` statuses); `[]` = explicitly alone; non-empty = authoritative. Nullable end-to-end (web + Flutter `PlayerState`) so the tri-state survives the JSON round-trip.
- **Roster Writer (Completed)**: Pure deterministic action parser in `socialEngine.ts` (`detectPartyChange`, `applyPartyChange`) executed at `action/route.ts:371`. Supports recruitment/follow (`join`), leave-behind (`leave`), standalone scouting (`clear` -> `[]`), and camp return/regroup (`regroup` -> unions with canonical companions, filtering deceased/missing NPCs). Seeded at session creation in `session/route.ts`.
- **Wound tags**: `injury|wound|bleed|lesion|trauma|lacerat|زخم|جراحت|خونریزی|مجروح` (case-insensitive), suppressed by treated markers (`treated|bandaged|healed|…|مداوا|پانسمان|بهبود|بخیه`). Single-line beat, language-picked, appended to the continuity directive; empty when no tag.
