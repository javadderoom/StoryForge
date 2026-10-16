# Plan 15: Deterministic Narrative Coherence & Author Studio Plan

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
4. **Blanket Caravan Presence**: In [`tradeRoutes.ts`](file:///g:/Code/StoryForge/web/src/lib/engines/world/tradeRoutes.ts#L144-L195), touching any waypoint on a trade route tags **all caravan NPCs** as physically active at that location. The model receives 6 full NPC dossiers and naturally has them participate in the conversation, even if the player snuck down a cliff alone.
5. **Forward-Momentum Bias**: Pre-trained LLMs naturally rush toward action tropes. Without an explicit, mechanical mandate forcing an emotional pause, companions will step over a friend's bleeding wound to trigger the next combat encounter.

---

## 2. Strategic Evaluation of Proposed Paradigms

| Paradigm | Pros | Cons & Bottlenecks | Verdict |
| :--- | :--- | :--- | :--- |
| **A. Upgrading to Expensive Models (Gemini 1.5 Pro, Claude Opus, GPT-4o)** | Stronger logical deduction, richer emotional prose, better nuanced instruction following. | **Latency (8–15s per turn)** kills interactive reader flow. **10x–30x API cost**. Crucially: *A smarter model given the wrong context will still hallucinate.* If 6 caravan NPCs are listed in the prompt context, Claude Opus will also assume they are present. | **Complementary, not a root fix.** Better models cannot compensate for dirty context. |
| **B. Post-Generation LLM Critic / Referee** | Catches continuity and canon errors before displaying text to the player. | **Doubles turn latency** (Player waits 3s for writer + 3s for critic + 4s for re-drafting = 10s total). Rejection loops cause frequent timeouts. | **Reject for live runtime**; reserve for offline automated story test suites. |
| **C. Pre-Generation Scene Framing (Director Pass)** | Pre-determines the immediate 20m radius, emotional stakes, and active participants in <200ms before calling the writer. | Requires lightweight schema and state-driven triggers. | **Core Recommendation**. |
| **D. Strict Deterministic Scoping (Micro-Locations & Biomes)** | **100% mathematically prevents entity misuse.** If an entity is not in the immediate scene, it is completely removed from the prompt context. The LLM cannot hallucinate an entity it never saw. | Requires structuring location sub-zones and party presence. | **Foundational Pillar**. |
| **E. Author Studio Narrative & Prompt Dashboard** | Author gains complete visual inspection of the context envelope, token counts, and entity filters, plus an in-browser turn simulator. | Requires building Next.js Studio UI components. | **Highest Value for Author Productivity & Quality Assurance**. |

---

## 3. The Four Architectural Pillars

```
                                  [ Player Action + Check Result ]
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 1: DETERMINISTIC SPATIAL & ECOLOGICAL SCOPER                                          |
  | - Micro-location filter: Is player at "Caravan Camp" or "Deep Ravine"?                         |
  | - Party Co-Presence filter: Who is physically walking with player? (Strip absent NPCs)        |
  | - Bestiary Habitat filter: Does creature biome match current location? (Strip invalid beasts)  |
  +-----------------------------------------------------------------------------------------------+
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 2: MECHANICAL CONDITIONS & EMOTIONAL ANCHORS                                           |
  | - Check for active untreated wounds/trauma on player or party members.                       |
  | - Inject Mandatory Immediate Beat: "Companion wounded; must provide aid before proceeding."    |
  +-----------------------------------------------------------------------------------------------+
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 3: PRE-GENERATION SCENE FRAMING (DIRECTOR PASS)                                       |
  | - Consolidate immediate 20-meter zone, tension level, and active interactables.              |
  | - Assemble clean, minimal WorkingContextEnvelope.                                             |
  +-----------------------------------------------------------------------------------------------+
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | WRITER LLM (GEMINI 3.8 FLASH / HIGH)                                                          |
  | - Focuses 100% of capacity on high-literary prose dramatization.                              |
  +-----------------------------------------------------------------------------------------------+
                                                 |
                                                 v
  +-----------------------------------------------------------------------------------------------+
  | PILLAR 4: STUDIO NARRATIVE INSPECTOR & PLAYGROUND                                             |
  | - Author visualizes envelope, overrides rules, and simulates turns live in Web Studio.        |
  +-----------------------------------------------------------------------------------------------+
```

---

## 4. Detailed Specification of the Pillars

### Pillar 1: Deterministic Spatial & Ecological Scoping

#### 1.1 Bestiary Habitat & Biome Exclusion
In [`PromptAssembler.ts`](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/PromptAssembler.ts) and [`worldContext.ts`](file:///g:/Code/StoryForge/web/src/lib/engines/narrative/worldContext.ts):
- A creature is **only** eligible for context injection if its `habitatLocationIds` includes the player's current `locationId` (or its designated biome matches).
- If no creature in the World Bible matches the current location, **do not inject any creature records**.
- Instead, inject an explicit environmental guidance line:
  > *`[ENVIRONMENTAL GUIDANCE]: No predatory beasts inhabit this immediate barren terrain. Focus narrative tension on environmental perils, physical exhaustion, harsh winds, and rockfall.`*

#### 1.2 Micro-Locations (Sub-Zones) & Point of Interest Scoping
Locations in the World Bible already support `subZones` and `pointsOfInterest`.
- When an action moves the player into a sub-zone (e.g. `Ravine Floor`, `Hidden Cavern`, `Scout Ridge`), the engine updates `playerState.currentSubZoneId`.
- NPCs possess an explicit co-presence state:
  - `resident`: Static inhabitants of a specific sub-zone.
  - `camped`: Members of the caravan resting at the primary campsite.
  - `accompanying`: Explicit companions currently walking beside the player (maximum 1–2).
- Any NPC whose location does not match the active sub-zone is marked `ABSENT_FROM_SCENE`. Their dossiers are **completely omitted** from the prompt's `[ACTIVE NPCS]` block.

---

### Pillar 2: Mechanical Conditions & Emotional Directives

#### 2.1 Condition Tracking
Characters and companions maintain structured conditions in `PlayerState`:
```typescript
export interface CharacterCondition {
  id: string;
  targetId: string; // 'player' or npcId
  type: 'bleeding_wound' | 'broken_bone' | 'exhaustion' | 'hypothermia' | 'trauma';
  severity: 'minor' | 'moderate' | 'severe';
  treated: boolean;
  acquiredAtTurn: number;
}
```

#### 2.2 Mandatory Emotional Beat Injection
If `playerState.conditions` contains an untreated condition (e.g., severe wound from previous turn's combat):
- The engine injects a mandatory directive into the prompt:
  > *`[MANDATORY EMOTIONAL DIRECTIVE — UNTREATED INJURY]: {TargetName} suffered a {severity} {type} during the last turn. Before introducing any new physical confrontation or moving forward, companions present MUST react realistically to this injury (expressing alarm, offering water, halting to dress or bind the wound, or questioning whether to turn back). Purely brushing off physical trauma is forbidden.`*

---

### Pillar 3: Fast Scene Director (Plan 13 Runtime Integration)

Before triggering the full literary prose generator:
1. **Physical Boundary**: Establish a 20-meter bubble around the player.
2. **Interactable Whitelist**: List 2–4 physical items in that radius (e.g. canteen, loose slate, walking staff).
3. **Pacing Guardrail**: If the previous 2 turns were intense combat checks, enforce a "Reflective / Breathing" beat before the next check.

---

### Pillar 4: Author Narrative Studio & Sandbox (Studio UI)

To give the creator complete transparency and command over the narrative engine without editing backend TypeScript code or running Flutter builds:

#### 4.1 Narrative Envelope Inspector (`/studio/sandbox` & `/studio/story/[id]/narrative`)
A dedicated visual dashboard in the Next.js web application displaying:
1. **Live Context Envelope Viewer**:
   - Tabbed view showing exactly what is included in the prompt: *World Laws*, *Active Sub-Zone*, *Present NPCs (with presence rationale)*, *Eligible Bestiary*, *Active Conditions*, and *Retrieved Memories*.
   - Red highlights for entities that were **excluded** (e.g., *"Marsh Serpent excluded: biome mismatch"*, *"Parviz Kateb excluded: camped at main trail"*).
2. **Modular Tone & Behavior Controls**:
   - Story-level and chapter-level configuration sliders:
     - **Atmospheric Register**: Gritty/Grounded vs. Mythic/High Fantasy vs. Accessible/Modern Literary.
     - **Pacing**: Reflective (high dialogue & character beats) vs. Kinetic (fast obstacles).
     - **Entity Constraint Strictness**: Hard Canon (only listed entities) vs. Fluid (allow minor ambient fauna like desert beetles or crows).
3. **Interactive Turn Simulator**:
   - Author selects starting location, companions, and character condition.
   - Author types an action (or picks a choice) and clicks **"Execute Narrative Turn"**.
   - Displays the raw prompt, the generated prose, the choices, and any warnings from `ProseValidator` side-by-side.
   - Allows instant re-roll or parameter adjustment.

---

## 5. Phased Implementation Roadmap

### Phase 1: Context Sanitization & Strict Exclusion (Immediate Core Fix)
- [ ] Filter `bestiary` by `habitatLocationIds` and biome before building `WorkingContextEnvelope`.
- [ ] Omit absent caravan NPCs from `activeNpcDossiers` when player is not in the caravan camp.
- [ ] Strip out-of-context creature directives from `PromptAssembler.ts`.

### Phase 2: Condition & Emotional Reaction Directives
- [ ] Connect `playerState.conditions` to narrative generation.
- [ ] Inject `MANDATORY EMOTIONAL DIRECTIVE` when untreated wounds or trauma exist.

### Phase 3: Micro-Location & Sub-Zone Co-Presence
- [ ] Add `subZoneId` tracking to `PlayerState` and World Bible locations.
- [ ] Tag NPCs with `residentLocationId` / `currentSubZoneId` and `isAccompanyingPlayer`.

### Phase 4: Author Narrative Studio & Sandbox UI
- [ ] Build the Context Envelope Inspector in StoryForge Studio.
- [ ] Add the interactive Turn Simulator with live prompt/output diffing.
- [ ] Add author-facing tone and pacing controls to Story Settings.

---

## 6. Success Metrics
- **Zero Cross-Biome Hallucinations**: 0 occurrences of wetland creatures in desert zones across automated eval runs.
- **Zero NPC Teleportation**: 0 instances of camped NPCs speaking in secluded sub-zones.
- **Consistent Emotional Continuity**: 100% of severe injuries acknowledged by present companions in subsequent narrative turns.
- **Author Transparency**: The author can inspect the complete prompt payload and debug generation in under 5 seconds from the Studio UI.
