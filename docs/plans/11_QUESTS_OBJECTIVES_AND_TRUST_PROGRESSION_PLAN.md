# Plan 11: Quests, Quest Lines & NPC Trust Progression

> **Module Target**: `web/src/lib/types/world.ts`, `web/src/lib/types/rpg.ts`, `web/src/lib/types/gameplay.ts`, `web/src/app/studio/quests/`  
> **Phase**: 7  
> **Status**: Ready for Implementation

---

## 🎯 1. Overview & Objectives

In interactive fiction and roleplaying, **quests are the primary vehicle through which a player earns the trust of others.** In StoryForge, NPC dossiers feature locked secrets with trust thresholds (`requiredTrustLevel`) and explicit quest requirements (`SecretRevealMethodKind = 'quest'`). Meanwhile, the runtime character state tracks `activeQuestIds` and `completedQuestIds`. 

However, until now, the world-building layer lacked a dedicated **`WorldQuest`** entity, leaving quests as disconnected placeholders.

This plan introduces a comprehensive, first-class **Quest & Trust Progression System**:
1. **Quests as Deeds of Trust (No Fake Faction XP)**: Eliminates abstract, gamey MMO faction reputation numbers. Quests purely reward **intimate NPC Trust** (`trustDelta` with specific named NPCs) and narrative consequence.
2. **First-Class Quest Items**:
   - **Trigger Items**: Discovering a cryptic document, blood-stained seal, or unsealed relic naturally starts an investigation quest without needing an immediate dialogue trigger.
   - **Turn-In / Objective Items**: Objectives clearly track required items (`requiredItemId`), automatically removing them from inventory upon completion (`consumeItemOnComplete`).
3. **Structured Quest Lines (Sequential Progression)**: Quests can be chained into ordered narratives (Acts I, II, and III) where later chapters unlock only after earlier deeds are fulfilled and trust thresholds are met.
4. **Direct Secret Unlock Integration**: Completing a quest fulfills `SecretRevealMethod.questId`, seamlessly unmasking the NPC’s darkest secret or hidden dilemma in the narrative.

---

## 🏗️ 2. Data Structures & Schemas

### A. Quest Objective Schema

```typescript
import { z } from 'zod';

export const QuestObjectiveTypeSchema = z.enum([
  'fetch',        // Collect / harvest a resource or item
  'deliver',      // Bring an item to an NPC or drop-point
  'slay',         // Defeat a dangerous beast or enemy
  'infiltrate',   // Sneak into a location or sub-zone undetected
  'escort',       // Protect a caravan or NPC along a route
  'interrogate',  // Question a suspect or witness
  'discover',     // Reach a hidden location, POI, or unseal a vault
]);
export type QuestObjectiveType = z.infer<typeof QuestObjectiveTypeSchema>;

export const QuestObjectiveSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  type: QuestObjectiveTypeSchema,
  
  // Target coordinates
  targetLocationId: z.string().optional(),
  targetNpcId: z.string().optional(),
  targetCreatureId: z.string().optional(),

  // Quest Item integration
  requiredItemId: z.string().optional(),       // References GameItem.id
  requiredItemName: z.string().optional(),     // e.g. "Moon-Silver Ingot"
  requiredQuantity: z.number().int().min(1).default(1),
  consumeItemOnComplete: z.boolean().default(true), // Removes item from player inventory on hand-in

  isOptional: z.boolean().default(false),
});
export type QuestObjective = z.infer<typeof QuestObjectiveSchema>;
```

### B. WorldQuest Schema

```typescript
export const QuestCategorySchema = z.enum([
  'main_arc',         // Drives the central saga / chapter conflict
  'personal_errand',  // Intimate favor for an individual NPC (trust driver)
  'caravan_escort',   // Commercial route protection (tied to Plan 10 Trade Routes)
  'bounty',           // Hunting a registered beast or rogue NPC
  'investigation',    // Uncovering a mystery, forgery, or secret
  'vault_heist',      // Infiltrating a dungeon to retrieve an artifact
]);
export type QuestCategory = z.infer<typeof QuestCategorySchema>;

export const WorldQuestSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  category: QuestCategorySchema.default('personal_errand'),

  // Quest Giver / Initiator
  giverNpcId: z.string().optional(),          // The NPC commissioning the deed
  originLocationId: z.string().optional(),    // Where the quest begins

  // Item-Initiated Trigger (e.g. finding a letter or seal)
  triggerItemId: z.string().optional(),       // If set, obtaining this item activates the quest

  // Plan 10 Trade Route Synergy
  relatedTradeRouteId: z.string().optional(), // If linked to an escort or highway blockage

  // Quest Line Grouping & Sequencing
  questLineId: z.string().optional(),         // e.g. "ql_vesper_conspiracy"
  questLineName: z.string().optional(),       // e.g. "The Vesper Conspiracy"
  orderInLine: z.number().int().min(1).default(1),
  nextQuestId: z.string().optional(),         // Queued automatically on completion

  // Prerequisites
  prerequisites: z.object({
    requiredCompletedQuestIds: z.array(z.string()).default([]),
    requiredTrustLevel: z.number().min(0).max(100).optional(), // NPC won't offer if trust is too low
    requiredPossessedItemIds: z.array(z.string()).default([]),  // e.g. must hold a signet ring
  }).default({ requiredCompletedQuestIds: [], requiredPossessedItemIds: [] }),

  // Objectives
  objectives: z.array(QuestObjectiveSchema).min(1),

  // Rewards (Pure NPC Trust & Narrative Unlocks)
  rewards: z.object({
    trustRewards: z.array(
      z.object({
        npcId: z.string(),
        trustDelta: z.number().int(), // e.g. +25 or -10 if betrayal
      })
    ).default([]),
    unlockedSecretIds: z.array(z.string()).default([]), // Directly unlocks NPCDossier secrets
    itemRewards: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        quantity: z.number().int().default(1),
      })
    ).default([]),
    goldReward: z.number().int().min(0).default(0),
    narrativeResolution: z.string().optional(), // Text summary of world change
  }).default({ trustRewards: [], unlockedSecretIds: [], itemRewards: [], goldReward: 0 }),
});

export type WorldQuest = z.infer<typeof WorldQuestSchema>;
```

### C. GameItem Trigger Extension (`rpg.ts`)

```typescript
// Extended GameItem interface in web/src/lib/types/rpg.ts
export interface GameItem {
  // ... existing fields ...
  startsQuestId?: string; // If possessed or inspected, starts this quest automatically
}
```

### D. WorldBible Integration (`world.ts`)

```typescript
export interface WorldBible {
  // ... existing fields ...
  quests?: WorldQuest[];
}
```

---

## ⚙️ 3. Core Engine Mechanics & Gameplay Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               Quest & Trust Lifecycle                                  │
├───────────────────────┬─────────────────────────┬──────────────────────────────────────┤
│ 1. Activation         │ 2. Objective Execution  │ 3. Resolution & Trust Unlocks        │
├───────────────────────┼─────────────────────────┼──────────────────────────────────────┤
│ • Offered by NPC when │ • Player explores       │ • Objectives satisfied.              │
│   trust matches prereq│   locations/trade routes│ • Required items removed from bag.   │
│ • OR triggered by     │ • Combat, stealth, or   │ • NPC Trust increased (+25 Trust).   │
│   discovering an item │   investigation checks  │ • NPC Secret unmasked in narrative.  │
│   (letter/relic)      │   update progress       │ • Next quest in line queued.         │
└───────────────────────┴─────────────────────────┴──────────────────────────────────────┘
```

### A. Turn-In & Inventory Settlement
When completing an objective of type `'deliver'` or `'fetch'` that has `consumeItemOnComplete: true`:
1. The resolution mutator checks `CharacterState.inventory` for matching `requiredItemId`.
2. Emits `StateMutationDiff`:
   - `itemsRemovedIds`: `[requiredItemId]`
   - `relationshipChanges`: `{ [giverNpcId]: { trustDelta: +30, newSecret: secretContent } }`
   - `questUpdates`: `[{ questId, status: 'completed' }]`
3. Moves `questId` from `activeQuestIds` to `completedQuestIds`.

### B. Dynamic Narrative Prompt Injection (`worldContext.ts`)
The AI scene engine receives active and available quest hooks in the current scene:

```text
[ACTIVE QUESTS IN CURRENT LOCATION]
• Blood-Debt of the Frost Convoy (Step 2 of The Iron Cartel)
  - Commissioned by: Kenneth (Blacksmith)
  - Objective: Retrieve 2 Moon-Silver Ingots from the Sunken Gorge
  - Status: Player possesses required items -> Prompt choice to hand over to Kenneth for +30 Trust!
```

---

## 🎨 4. Studio UI & Author Workflows

1. **Quests Studio Hub (`/studio/quests`)**:
   - Filter by NPC Giver, Location, or Quest Line.
   - Visual Quest Line Timeline showing Step 1 $\rightarrow$ Step 2 $\rightarrow$ Step 3 with prerequisite badges.
2. **NPC Dossier Integration**:
   - In `/studio/npcs`, each NPC card displays their commissioned quests.
   - Direct button: *"Add Quest for this NPC"* which pre-fills the giver, location, and trust reward.
3. **Oracle Easy Insert Support**:
   - `storyforge-action` support for `create: "quest"`:
   ```json
   {
     "action": "create",
     "entity": "quest",
     "data": {
       "title": "راز طومار مهروموم‌شده",
       "giverNpcName": "استاد کنت",
       "category": "investigation",
       "trustReward": 25,
       "objectives": [{ "description": "تحویل سنگ نقره ماه به کوره", "type": "deliver" }]
     }
   }
   ```

---

## 📋 5. Phased Implementation Roadmap

1. **Phase 1: Schemas & Types**: Add `WorldQuestSchema` and `QuestObjectiveSchema` to `web/src/lib/types/world.ts` and update `GameItem` in `rpg.ts`.
2. **Phase 2: Quest Resolution Mutators**: Implement quest activation, item consumption, and trust reward execution in `ActionValidator.ts` and `playthroughEngine`.
3. **Phase 3: Oracle Action Normalizer**: Add quest ingestion support to `ActionNormalizer.ts` and `oracleActions.ts`.
4. **Phase 4: Studio Quest Builder UI**: Create the visual Quest Hub and NPC Quest Drawer.
5. **Phase 5: Automated Testing**: Add unit tests verifying quest sequencing, item requirement checks, and trust delta calculations.
