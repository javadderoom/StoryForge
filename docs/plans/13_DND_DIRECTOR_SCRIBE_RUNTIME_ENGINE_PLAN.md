# Plan 13: D&D "Director & Scribe" Runtime Engine

Shift the StoryForge gameplay model from rigid, static branching trees to emergent, high-stakes tabletop roleplaying mechanics inspired by D&D and *Blades in the Dark*:
1. **Dynamic Hazard Location Displacement**: Displace the player to fallback danger zones (e.g. underground river, sewers, dungeon cells) upon catastrophic failure of high-risk checks.
2. **Tension & Threat Clocks**: Segmented danger meters (e.g. `[■■□□] 2/4 Alert`) that tick on complications and trigger crisis events when filled.
3. **Contextual Inventory & Environmental Choices**: AI choice generator dynamically incorporates active inventory items, local environmental interactables, and distinct character philosophies into proposed choices.

---

## 1. Problem & Paradigm Shift

### The Flaw of Pre-Generating Massive Static Trees
Attempting to pre-author or pre-generate all possible branches ahead of time in Studio creates a combinatorial explosion ($3 \times 2 \times 4 \text{ turns} = \text{thousands of dead-end pages}$). 
Furthermore:
* In high-stakes storytelling, success and failure produce **100% different results** (e.g., leaping across a gorge: Success ➔ *Ancient Spire*; Failure ➔ *Underground River* 200 feet below).
* A pre-authored static scene for the destination breaks the moment the player rolls a failure and lands somewhere else.

### The D&D Solution: "Director & Scribe"
Instead of scripting every possible step:
* **The Author is the Director (Campaign Creator)**: Defines rich World Bible lore, key locations, factions, and overarching chapter milestones.
* **The Runtime Engine is the Scribe (Living Dungeon Master)**: Resolves dice rolls across **4 Consequence Vectors** and generates the immediate continuation dynamically, honoring the exact outcome and current world state.

```
                       [ D20 Skill Check ]
                                |
       +----------------+-------+--------+----------------+
       |                |                |                |
  [Trajectorial]   [Economical]     [Social/Moral]   [Environmental]
  Where you go     What you lose    Who remembers    What changes in
  or are pushed    (HP, gear,       (Trust, bounty,  the scene (Alarms,
  (Dungeon, ledge,  gold, slots)    grudges, debt)   fire, time clock)
  vault, river)
```

---

## 2. Core Architecture & Features

### Feature 1: Dynamic Hazard Location Displacement on High-Risk Failure
In high-risk physical or infiltration maneuvers (e.g., jumping a chasm, scaling battlements, slipping past the Grand Inquisitor):
* Locations in the World Bible can declare a `hazardFallbackLocationId` (e.g., *Castle Battlements* ➔ *Outer Moat & Trenches*; *Palace Hall* ➔ *Dungeon Cells*; *High Chasm* ➔ *Underground River*).
* When a check with `riskLevel === 'high'` resolves as `failure` or `critical_failure`:
  1. `GameEngine.ts` mechanically sets `displacedLocationId` to the active location's fallback hazard zone.
  2. Applies fall/capture damage to `playerState.resources.hp`.
  3. `api/play/action/route.ts` switches `playerState.currentLocationId` to the new location and shifts ambient background audio to match.
  4. `PromptAssembler.ts` injects an explicit displacement directive:
     > `[CRITICAL LOCATION DISPLACEMENT]: The action failed catastrophically. The player was knocked/fell from {Old Location} into {New Location}. Dramatize the bone-jarring impact, physical damage, and the sudden survival crisis in this new environment!`

### Feature 2: Tension & Threat Clocks (*Blades in the Dark* / D&D Mechanics)
Every encounter or chapter has an active **Tension Clock** representing rising danger (e.g., `City Watch Alert: 2/4`, `Ritual of the Blood Moon: 1/6`):
* **Resolution Ticking**:
  * `critical_success`: 0 ticks (or reduces tension by 1 if relieving pressure).
  * `success`: 0 ticks (objective achieved cleanly).
  * `mixed_success`: +1 tick ("Yes, but the threat advances").
  * `failure`: +1 tick (objective blocked and threat advances).
  * `critical_failure`: +2 ticks (catastrophic escalation).
* **Crisis Trigger**:
  * When `currentSegments >= maxSegments`, the clock triggers `isCrisisTriggered = true`.
  * The AI is commanded to unleash a **Crisis Event** (e.g., royal guards breach the doors, the cave ceiling collapses, or the monster ambushes the party).
* **UI**: A segmented, glowing runic threat meter in the Reader header displaying current progress, name, and impending consequence.

### Feature 3: Contextual Inventory & Environmental Choice Generation
To prevent generated choices from feeling generic:
* `PromptAssembler.ts` guides Gemini to construct choices that explicitly leverage:
  1. **Equipped Gear / Inventory**: e.g., *"Use the Smoke Pellets from your pouch to blind the archers"*, *"Anchor your climbing pitons into the rock face"*.
  2. **Environmental Interactables**: e.g., *"Cut the rope holding the timber cargo"*, *"Dive into the flooded aqueduct"*.
  3. **NPC Knowledge & Secrets**: e.g., *"Mention the Captain's hidden debts to make him hesitate"*.
  4. **4 Distinct Philosophies**: Tactical, Aggressive, Defensive, Inquisitive.

---

## 3. Detailed Data Models & Schemas

### 1. `web/src/lib/types/world.ts`
```typescript
export const WorldLocationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  // Existing fields...
  /** Location to which a character falls or is displaced upon catastrophic failure */
  hazardFallbackLocationId: z.string().optional(),
  /** Optional default threat clock for this zone */
  threatClockDefault: z
    .object({
      name: z.string(),
      maxSegments: z.number().int().default(4),
      crisisDescription: z.string(),
    })
    .optional(),
});
```

### 2. `web/src/lib/types/gameplay.ts`
```typescript
export interface TensionClock {
  id: string;
  name: string;
  currentSegments: number;
  maxSegments: number; // typically 4 or 6
  crisisDescription: string;
  isTriggered?: boolean;
}

export interface PlayerState {
  // Existing fields...
  activeTensionClocks?: TensionClock[];
}

export interface StateMutationDiff {
  // Existing fields...
  displacedLocationId?: string;
  clockUpdates?: Array<{
    id: string;
    delta: number;
    isCrisis: boolean;
  }>;
}

export interface CheckResolution {
  // Existing fields...
  displacedLocationId?: string;
  clockUpdate?: {
    clockId: string;
    newSegments: number;
    maxSegments: number;
    isCrisis: boolean;
  };
}
```

---

## 4. Implementation Steps

| Step | Component | File | Description |
| :--- | :--- | :--- | :--- |
| **1** | **Data Models** | `world.ts`, `gameplay.ts` | Add `hazardFallbackLocationId`, `threatClockDefault`, `TensionClock` interface, and diff fields. |
| **2** | **Game Engine** | `GameEngine.ts` | Implement clock ticking logic in `resolveActionCheck`, fallback location lookup on high-risk failure, and state mutation handling. |
| **3** | **Prompt Assembler** | `PromptAssembler.ts` | Inject active threat clock status, critical displacement directives, and inventory/environment choice guidelines into prompt envelope. |
| **4** | **Turn API Route** | `api/play/action/route.ts` | Persist clock state in session, handle location displacement, and trigger ambient audio shifts. |
| **5** | **UI Widget** | `TensionClockWidget.tsx` | Build dark fantasy glowing segmented threat clock widget with pulsing warning states and tooltips. |
| **6** | **Reader Integration** | `page.tsx` | Embed `TensionClockWidget` in header and handle animated location banner transitions on displacement. |

---

## 5. Verification Plan

### Automated Tests
* Create `web/tests/engines/game/threatClock.test.ts`:
  * Verify clock ticks by 1 on `mixed_success` and `failure`.
  * Verify clock ticks by 2 on `critical_failure`.
  * Verify crisis flag is raised when `currentSegments >= maxSegments`.
  * Verify displacement to `hazardFallbackLocationId` on high-risk failure.
* Type safety: `npx tsc --noEmit` (0 errors).
* Regression suite: `npm test` (all 328+ tests passing).

### Manual Acceptance Testing
1. Launch reader at `http://localhost:3000`.
2. Verify threat clock renders in header (e.g., `City Watch Alert [□□□□]`).
3. Make an action check that rolls a mixed success or failure:
   * Clock increments visually (`[■□□□]`).
   * Narrative reflects rising tension.
4. Intentionally trigger a high-risk failure check:
   * Player location switches to the hazard fallback zone.
   * Ambient audio shifts to match the new location.
   * Prose dramatizes the catastrophic arrival and survival dilemma.
