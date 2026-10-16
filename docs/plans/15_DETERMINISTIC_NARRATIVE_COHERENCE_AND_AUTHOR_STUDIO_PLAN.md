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
  | - Whitelist 2–4 physical interactables in the immediate 20m bubble.                           |
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
```

---

## 4. Detailed Specifications

### 4.1 Narrow Live Bug Fixes (Zero Migration)

#### Bug 1: The Bestiary Habitat Loophole & "MUST Draw" Trap
- **Current Problem**: In `worldContext.ts:463-467`, creatures pass if `habitatLocationIds.length === 0`. If authors haven't filled in habitats, all creatures pass. Then `PromptAssembler.ts:68` commands: *"When wildlife, predators, or monstrosities appear, you MUST draw from these canonical creatures"*. The model is trapped into placing wetland creatures in desert caves.
- **Fix**:
  1. If `habitatLocationIds` is specified, strictly require matching the current location.
  2. If a creature lacks `habitatLocationIds`, require an explicit `global_roaming` flag or omit from extreme biomes (desert, arctic, underwater).
  3. When no creature matches the location, replace the imperative command in `PromptAssembler.ts` with:
     > `[ENVIRONMENTAL GUIDANCE]: No predatory beasts inhabit this immediate terrain. Focus tension on terrain hazards, physical exhaustion, harsh weather, and environmental atmosphere.`

#### Bug 2: Blanket Caravan Retinue Exposure
- **Current Problem**: In `worldContext.ts:421-428`, every trade route touching the location pulls all `travelingNpcIds`. Then `tradeRoutes.ts:114-115` prints the retinue names into the prompt string.
- **Fix**:
  1. Only pull caravan travelers into `activeNpcDossiers` when the traveler's `currentLocationId` equals the scene location (data that exists today; see §7.2-E).
  2. Scope the retinue string in `tradeRoutes.ts` to omit individual retinue names unless the caravan is the primary interaction point.

#### Bug 3: Teleporting NPCs without Heavy Sub-Zone Migrations
- **Fix**: Introduce `accompanyingNpcIds: string[]` on `PlayerState`.
- Only resident NPCs of the current location OR NPCs in `accompanyingNpcIds` are eligible to speak in immediate dialogue. Caravan members resting at camp remain in the background.

#### Bug 4: Companion Apathy Toward Wounds
- **Current Representation**: Conditions in `PlayerState` are currently `List<string>` (e.g. `['ناآشنا', 'هوشیار']`) and describe the *protagonist*, not companions (companion injuries are tracked nowhere — see §7.2-A).
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

## 5. Pragmatic Implementation Roadmap

```
                                  EXECUTION ROADMAP
                                          |
  +-----------------------------------------------------------------------------------+
  | PHASE 1: IMMEDIATE ZERO-MIGRATION BACKEND FIXES                                   |
  | 1. Fix worldContext.ts: plug habitatLocationIds.length === 0 loophole.            |
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
  | PHASE 3: ACCOMPANYING PARTY ROSTER & WOUND DIRECTIVES                             |
  | 1. Support accompanyingNpcIds on PlayerState (caps immediate dialogue).           |
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
