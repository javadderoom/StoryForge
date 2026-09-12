# Defeat, Lingering Injuries, and Stat Consequences

This document explains the mechanics of action check failures, HP depletion, and the escalating consequences of defeat in StoryForge.

---

## 1. Action Check Damage & Failure Consequences

During active gameplay, every D20 action check resolves into one of five deterministic outcomes:

| Outcome | HP Consequence | Stamina Consequence | Stat / Attribute Consequence |
| :--- | :--- | :--- | :--- |
| **Critical Success (Nat 20 / DC+5)** | None | None | None |
| **Success (Score $\ge$ DC)** | None | None | None |
| **Mixed Success (Score $\ge$ DC - 3)** | `-5 HP` | `-10 Stamina` (if stamina pool exists) | None |
| **Failure (Score < DC - 3)** | `-10 HP` | None | None |
| **Critical Failure (Nat 1)** | `-15 HP` | None | None |

> [!NOTE]
> Standard action failures and critical failures **do not** directly deduct attribute points (Might, Agility, Arcana, Cunning). They only deduct **vital resources** (HP and Stamina).

---

### The Critical Bug: `resources['hp']` vs `resources['health']` (The False 0-HP Defeat Trigger)

> [!CAUTION]
> **Why you passed out on the very first turn with high HP:**
> In [`web/src/app/api/play/action/route.ts`](file:///d:/Code/StoryForge/web/src/app/api/play/action/route.ts#L375):
> ```typescript
> const hpAfterMutation = updatedPlayerState.resources?.hp ?? 0;
> if (hpAfterMutation <= 0) { ... }
> ```
> 1. In [`storyFactory.ts`](file:///d:/Code/StoryForge/web/src/lib/storyFactory.ts#L41) and Persian/bilingual stories, the health resource ID is defined as **`'health'`**, not `'hp'`.
> 2. `updatedPlayerState.resources['hp']` is **`undefined`** (the actual health is stored in `resources['health']`).
> 3. `undefined ?? 0` evaluates to **`0`**.
> 4. The condition `0 <= 0` evaluates to **`true` on every single turn**, even when the player has 10, 15, or 20 health!
> 5. Consequently, the engine erroneously declared the player defeated on **Turn 1**, commanding the AI:
>    `"DEFEAT: The player has fallen in battle... Narrate the defeat, unconsciousness, and grim awakening..."`
> 6. On Turn 2, it triggered Defeat Tier 2 (Item loss).
> 7. On Turn 3, it triggered Defeat Tier 3 (**Permanent Scar: -1 to Arcana/جادو**), reducing the stat from 2 to 1 even though the player had never actually dropped to 0 health!
>
> **The Fix**: Resolve the primary health key dynamically (matching `rpgSystem.resources` for `'health'`, `'hp'`, `'سلامت'`, etc.):
> ```typescript
> const healthKey = story.rpgSystem?.resources?.find((r) =>
>   ['hp', 'health', 'سلامت', 'جان'].includes(r.id.toLowerCase())
> )?.id || 'hp';
> const hpAfterMutation = updatedPlayerState.resources?.[healthKey] ?? 100;
> ```

---

## 3. Escalating Defeat Penalties & The Permanent Scar Rule

Defeats are tracked on the player state via `playerState.defeatCount`. With each subsequent fall in battle, the consequences escalate:

### Defeat Tier 1 (First Fall)
- Revived at Safe Haven with 25% HP.
- 50% gold loss.
- -5 NPC trust.
- **Core stats: Unchanged.**
- **Inventory: Unchanged.**

### Defeat Tier 2 (Second Fall)
- Revived at Safe Haven with 25% HP.
- 50% gold loss.
- -5 NPC trust.
- **Item Loss**: Loses **1 random non-quest item** from inventory (quest items, keys, and relics are protected).
- **Core stats: Unchanged.**

### Defeat Tier 3+ (Third and Subsequent Falls — Permanent Scar)
- Revived at Safe Haven with 25% HP.
- 50% gold loss.
- -5 NPC trust.
- Item loss (1 random non-quest item).
- **Permanent Stat Penalty (Lingering Injury)**:
  - The engine permanently deducts **`-1` from the stat used during the fatal action check**:
    ```typescript
    // web/src/lib/engines/game/GameEngine.ts
    if (count >= 3) {
      const statId = checkedStatId || rpgSystem.stats[0]?.id;
      if (statId) {
        diff.statChanges = { [statId]: -1 };
      }
    }
    ```
  - **Example**: If a player attempts an action check using **جادو (Arcana)** and fails, and the resulting damage reduces their HP to 0 for the 3rd time in their run, their `arcana` stat is permanently reduced by 1 (e.g. from `2` to `1`).

---

## 4. The "Passing Out & Waking Up" Death Loop (Root Cause Analysis)

Playtesters report that **almost every critical loss or failure results in their character passing out, blacking out, and waking up losing HP/items**, completely breaking immersion and the storytelling flow.

### Why This Happens (The Mathematical Death Loop)

1. **Disproportionate Damage vs Low Base HP**:
   - In [`storyFactory.ts`](file:///d:/Code/StoryForge/web/src/lib/storyFactory.ts#L41), default story creation sets:
     `{ id: 'health', current: 20, max: 30, min: 0 }`
   - In [`GameEngine.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/game/GameEngine.ts#L1067-L1133), damage is hardcoded as flat constants:
     - **Critical Failure (Nat 1)**: `-15 HP` (75% of max HP!).
     - **Hazard Displacement (High Risk)**: Additional `-15 HP` fall damage (Total: `-30 HP`, an instant one-shot death).
     - **Standard Failure**: `-10 HP` (50% of the player's entire health pool!).
     - **Mixed Success**: `-5 HP` (25% of the player's health).

2. **The 25% Revive Trap**:
   - When HP drops to 0, `GameEngine.resolveDefeat` revives the player with `Math.floor(hpMax * 0.25)`.
   - With `hpMax = 30`, the player wakes up with **only 7 HP**.
   - With `hpMax = 20`, the player wakes up with **only 5 HP**.

3. **Guaranteed Re-Death on the Next Turn**:
   - Because the player now has only 5–7 HP, **the very next check that fails (`-10 HP`) instantly drops them to 0 HP again**.
   - This creates an inescapable, repetitive cycle:
     $$\text{Fail check} \longrightarrow \text{HP drops to 0} \longrightarrow \text{Pass out} \longrightarrow \text{Wake up with 7 HP} \longrightarrow \text{Next failure (-10 HP)} \longrightarrow \text{Pass out AGAIN!}$$
   - By the 3rd iteration of this loop, the player also loses 50% gold, non-quest inventory items, and permanently loses a core stat point (`-1 Arcana` or `-1 Might`).

4. **Narrative Derailment by AI Prompt Directives**:
   - In [`GameEngine.ts`](file:///d:/Code/StoryForge/web/src/lib/engines/game/GameEngine.ts#L646), the engine injects:
     `"Narrate the defeat, unconsciousness, and grim awakening with escalating consequences. DO NOT kill the character."`
   - The AI narrator faithfully carries out this order: the scene abruptly cuts off, the protagonist blacks out, faints, and wakes up hours later in a bed or jail cell.
   - Doing this repeatedly every 1–2 turns shatters narrative continuity, resets location progress, and turns the game into a frustrating fainting simulator.

---

## 5. Architectural Solutions to Fix the Gameplay Experience

To restore a compelling, high-stakes narrative without constant blackouts:

1. **Remove Bodily HP Damage from Non-Combat Actions**:
   - Social dialogue, library research, stealth, and puzzle checks should **never** deduct physical HP. 
   - Consequences should match the domain: lost trust, raised alert, consumed time, or Threat Clock advancement.
2. **Break the 25% Revive Trap**:
   - When a character is defeated and rests at a safe haven, revive them at **75%–100% HP** (or full health).
   - This gives the player breathing room and prevents immediate one-shot re-defeat on the subsequent turn.
3. **Scale Damage to Max HP and Risk Level**:
   - Replace flat `-10` / `-15` damage with proportional amounts or low-risk thresholds:
     - `low` risk: `0 HP` damage.
     - `medium` risk: `10%–15% max HP` (2–4 HP on a 20 HP character).
     - `high` risk / lethal combat: `25%–40% max HP`.
4. **Diversify Defeat Narratives Beyond Fainting / Passing Out**:
   - Instead of mandating unconsciousness, allow tactical retreats, hostage situations, dramatic bargains, or heroic close calls where the character stays conscious and active in the narrative.

