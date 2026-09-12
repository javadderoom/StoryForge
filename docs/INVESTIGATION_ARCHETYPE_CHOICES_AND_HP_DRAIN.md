# Investigation: Archetype Blindness in Choice Generation & Indiscriminate HP Drain

This document details the root causes and findings regarding two core gameplay issues reported during playtesting:
1. **Archetype Blindness**: The player plays multiple consecutive scenes where none of the generated choices relate to their chosen character archetype or primary stats.
2. **Indiscriminate HP Drain ("0 HP Over Nothing")**: The character drops to 0 HP in just 4–5 turns during ordinary exploration and dialogue, triggering defeat and permanent stat scarring without ever entering physical combat.

---

## 1. Issue 1: Archetype Blindness in Choice Generation

### The Problem
When a player creates a character (e.g., an Arcane Scholar with high `arcana`, or a Shadow Rogue with high `agility`), the AI choice generator frequently produces 3–4 choices per scene that only test unrelated stats (e.g., `might` or `cunning`), offering zero opportunities for the player to utilize their character's signature strengths.

### Root Causes in the Codebase

#### A. Omission of Character Identity in `WorkingContextEnvelope`
In [`web/src/app/api/play/action/route.ts`](file:///d:/Code/StoryForge/web/src/app/api/play/action/route.ts#L517-L521), the context envelope assembled for the AI model includes only raw numbers:
```typescript
playerStatus: {
  stats: updatedPlayerState.stats,
  resources: updatedPlayerState.resources,
  equippedItems: updatedPlayerState.inventory.map((i) => i.name),
}
```
**What is missing:**
- `updatedPlayerState.archetypeName` / `archetypeId` is **never passed**.
- `updatedPlayerState.backgroundName` / `backgroundId` is **never passed**.
- The player's primary / highest stats are **never highlighted**.

The AI narrative director has no concept of whether the player is a stealth assassin, a battle-hardened knight, or an occult mystic.

#### B. Flat Unordered Stat Directives in `PromptAssembler.ts`
In [`web/src/lib/engines/narrative/PromptAssembler.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/narrative/PromptAssembler.ts#L76-L90):
```typescript
const validStatIds = Object.keys(context.playerStatus?.stats || {});
// Directive given to the LLM:
`Every choice's "requiredStatId" MUST be one of exactly these stat ids: [${validStatIds.join(', ')}].`
```
And in the few-shot JSON template:
```json
"choices": [
  { "requiredStatId": "${validStatIds[0] || 'might'}" },
  { "requiredStatId": "${validStatIds[1] || validStatIds[0] || 'might'}" }
]
```
The prompt gives equal weight to every stat and provides zero guidance to:
1. Offer at least one choice tailored to the character's primary archetype and highest stat.
2. Align choice actions with what the character is actually good at.

Consequently, the LLM selects stat IDs arbitrarily based on whatever verbs it happens to write, often omitting the player's core attributes for turns at a time.

---

## 2. Issue 2: Indiscriminate HP Drain ("0 HP Over Nothing")

### The Problem
Players experience rapid, unavoidable collapse to 0 HP within 4–5 turns of casual play (investigation, dialogue, looking around, reading signs), which then triggers the defeat system and permanently scars their stats.

### Root Causes in the Codebase

#### A. Universal Hardcoded Bodily Damage in `GameEngine.ts`
In [`web/src/lib/engines/game/GameEngine.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/game/GameEngine.ts#L1062-L1095):
```typescript
if (isNatMin) {
  // Critical failure: -15 HP
  stateDiff.resourceChanges = { [healthKey]: -15 };
} else if (totalScore >= baseDC - 3) {
  // Mixed success: -5 HP and -10 Stamina
  stateDiff.resourceChanges = { [healthKey]: -5, [staminaKey]: -10 };
} else {
  // Failure: -10 HP
  stateDiff.resourceChanges = { [healthKey]: -10 };
}
```

#### B. Total Disregard for Action Context & Risk Level
The engine applies this flat bodily damage **unconditionally**, without checking what the action actually was:
- **Talking to an NPC**: Saying the wrong thing or failing a persuasion roll deals **-10 physical HP damage**.
- **Inspecting a Book or Ancient Rune**: Failing an Arcana or Cunning check deals **-10 physical HP damage**.
- **Low Risk Actions (`riskLevel: 'low'`)**: A minor check intended to be safe still inflicts **-10 HP** on failure and **-5 HP** on mixed success.

#### C. The "Ghost Zero-HP" Bug: Why Defeat Triggered on Turn 1 With High HP
In [`web/src/app/api/play/action/route.ts`](file:///d:/Code/StoryForge/web/src/app/api/play/action/route.ts#L375):
```typescript
const hpAfterMutation = updatedPlayerState.resources?.hp ?? 0;
if (hpAfterMutation <= 0) { ... }
```
- In default and Persian stories created by `storyFactory.ts`, the primary health resource is named **`'health'`**, not `'hp'`.
- `updatedPlayerState.resources?.hp` evaluated to **`undefined`**.
- `undefined ?? 0` became **`0`**, causing `hpAfterMutation <= 0` to evaluate to **`true` on the very first turn!**
- Even though the player had 10 or 20 HP, the system falsely concluded the player was dead and commanded the AI narrator:
  `"DEFEAT: The player has fallen in battle... Narrate the defeat, unconsciousness, and grim awakening..."`
- The AI was not hallucinating; the backend literally instructed it that the player had blacked out on Turn 1!
- On Turn 3, this false trigger reached Defeat Tier 3, which permanently deducted `-1` from the player's Arcana (`جادو`).

#### D. The Inevitable Death Spiral
In stories where starting HP is between 20 and 50 (or even the default 100):
- Turn 1 (Mixed Success on dialogue): `-5 HP`
- Turn 2 (Failure on perception): `-10 HP`
- Turn 3 (Failure on stealth): `-10 HP`
- Turn 4 (Mixed Success on search): `-5 HP`
- Turn 5 (Failure on investigation): `-10 HP`

**Total Damage in 5 non-combat scenes = -40 HP.**

The character's HP drops to $\le 0$ without facing a single enemy, blade, or trap. This immediately triggers `GameEngine.resolveDefeat`, which reduces gold, lowers all NPC trust, and—on the 3rd occurrence—permanently deducts a stat point (e.g. Arcana from 2 to 1).

---

## 3. Recommended Architectural Solutions

### Solution 1: Archetype & Primary Stat Priority in Choices
1. **Pass Archetype to the Context Envelope**:
   In `route.ts`, forward `archetypeName`, `backgroundName`, and compute `primaryStatIds` (stats sorted descending by player investment).
2. **Enforce Archetype Choice Quota in `PromptAssembler.ts`**:
   Instruct the AI:
   - *Archetype Anchor*: At least **1 choice** in every scene MUST directly test the character's primary stat / archetype expertise (e.g. Arcana for a Mage, Agility for a Rogue, Might for a Warrior).
   - *Diverse Alternatives*: The remaining 1–2 choices can test alternative or secondary attributes, giving the player tactical variety without locking them out of their core identity.

### Solution 2: Contextual Consequence Mapping (No HP Bleed on Mental/Social Checks)
Replace the flat `-10 HP` penalty in `GameEngine.resolveActionCheck` with domain-aware consequences:
1. **Domain Differentiation**:
   - **Physical / Combat / Lethal Hazards** (`might`, physical `agility` in combat/traps): Inflict HP damage scaled by risk level (`low: 0`, `medium: -5 to -8`, `high: -10 to -15`).
   - **Social / Dialogue** (`charm`, social dialogue): Inflict **Trust loss** (`-5 to -10 trust`) or social embarrassment—**0 HP damage**.
   - **Cognitive / Lore / Perception** (`arcana`, `cunning`, `wit`): Inflict **Time loss / Threat Clock ticks** or false information—**0 HP damage**.
2. **Risk-Level Scaling**:
   - `riskLevel === 'low'`: Can **never** deal lethal bodily damage on a standard failure (at most -1 or -2 Stamina/stress, never HP).
