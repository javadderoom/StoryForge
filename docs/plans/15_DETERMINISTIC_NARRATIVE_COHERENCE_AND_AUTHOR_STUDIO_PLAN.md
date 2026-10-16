# Plan 15: Deterministic Narrative Coherence, Pre-Generation Paradigms & Author Studio Plan

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
| **E. Predictive AOT Pre-Caching** | Strong (with strict scoper) | **0ms (instant)** | Infinite dynamic branching | Low (fully automated) |
| **F. Hybrid Reader (Plan 12)** | 90% (anchored to canon) | 0ms on canon, 2s on bridges | High | Moderate (author sets 10 beats) |

---

## 3. The Four Architectural Pillars

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
  | WRITER LLM (GEMINI 3.8 FLASH / HIGH) OR FOLDED GRAPH NODE                                     |
  | - Focuses 100% of capacity on high-literary prose dramatization without context noise.        |
  +-----------------------------------------------------------------------------------------------+
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 4: STUDIO ENVELOPE INSPECTOR & SANDBOX UI                                              |
  | - Extend /studio/sandbox: inspect included vs. excluded entities with explicit rationale.     |
  | - Optional Chapter Graph Generator: generate and hand-polish 15–25 scene folded graphs.       |
  +-----------------------------------------------------------------------------------------------+
```

---

## 4. Codebase Reality & Refined Specifications

### 4.1 What Already Exists (Do Not Rebuild)
- **Location-anchored NPC filtering** ([`worldContext.ts:408-431`](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/worldContext.ts#L408-L431)): NPCs are already filtered by `currentLocationId`, `applicableLocationIds`, and `firstAppearanceChapter`. New party scoping composes with this.
- **Holder-based artifact filtering** ([`worldContext.ts:469-483`](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/worldContext.ts#L469-L483)): Already correctly scoped by NPC, location, and faction holders.
- **Sandbox UI Shell** ([`/studio/sandbox`](file:///g:/Code/StoryForge/web/src/app/studio/sandbox/page.tsx)): Already provides an Action & Guardrail Simulator. Pillar 4 extends this page rather than building a redundant route.
- **Pacing Guardrail** ([`momentumGuardrail.ts`](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/momentumGuardrail.ts)): Already tracks dramatic tension. Breathing beats hook into this existing guardrail.

### 4.2 Narrow Live Bug Fixes (Zero Migration)

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
  1. Only pull caravan travelers into `activeNpcDossiers` if the player is explicitly at the Caravan Camp or waypoint.
  2. Scope the retinue string in `tradeRoutes.ts` to omit individual retinue names unless the caravan is the primary interaction point.

#### Bug 3: Teleporting NPCs without Heavy Sub-Zone Migrations
- **Fix**: Introduce `accompanyingNpcIds: string[]` on `PlayerState` (or defaulting to the 1–2 party companions).
- Only resident NPCs of the current location OR NPCs in `accompanyingNpcIds` are eligible to speak in immediate dialogue. Caravan members resting at camp remain in the background.

#### Bug 4: Companion Apathy Toward Wounds
- **Current Representation**: Conditions in `PlayerState` are currently `List<string>` (e.g. `['ناآشنا', 'هوشیار']`).
- **Fix**: Support string tags like `'injury:bleeding:severe'` or `'wound:arrow'` without breaking existing sessions.
- Inject a single-line directive when an active untreated wound tag exists:
  > `[CRITICAL EMOTIONAL BEAT]: A companion suffered an untreated injury last turn. Present allies must acknowledge this (checking the wound, offering water, or bandaging) before advancing.`

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
  | PHASE 2: ACCOMPANYING PARTY ROSTER & WOUND DIRECTIVES                             |
  | 1. Support accompanyingNpcIds on PlayerState (caps immediate dialogue).           |
  | 2. Add single-line emotional reaction directive for untreated wound conditions.   |
  +-----------------------------------------------------------------------------------+
                                          |
                                          v
  +-----------------------------------------------------------------------------------+
  | PHASE 3: STUDIO SANDBOX ENVELOPE INSPECTOR                                        |
  | 1. Extend /studio/sandbox with an Envelope Inspector panel.                       |
  | 2. Display included vs. excluded entities with explicit exclusion rationale.      |
  +-----------------------------------------------------------------------------------+
                                          |
                                          v
  +-----------------------------------------------------------------------------------+
  | PHASE 4: STUDIO FOLDED GRAPH GENERATOR (OPTIONAL PRE-GENERATION)                  |
  | 1. Studio tool to generate a 15–25 node folded bottleneck graph for a chapter.    |
  | 2. In-browser editor to review, polish, and lock in 100% human-vetted scenes.     |
  +-----------------------------------------------------------------------------------+
```

---

## 6. Success Metrics & Verification

1. **Ecology Verification**: Zero cross-biome creatures spawned across 50 test turns in desert/cave environments.
2. **Co-Presence Verification**: Zero dialogue lines spoken by camped caravan members when the player is scouting away from the main camp.
3. **Emotional Continuity**: 100% of severe injuries acknowledged by present companions in subsequent narrative turns.
4. **Latency Budget**: Maintained turn latency $\le 2.5\text{s}$ on Flash model; 0ms for pre-generated/cached nodes.
5. **Author Visibility**: Complete context envelope and entity exclusion rationale visible in `/studio/sandbox` in $< 1\text{s}$.
