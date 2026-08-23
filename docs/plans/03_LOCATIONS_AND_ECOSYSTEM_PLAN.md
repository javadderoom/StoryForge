# Plan 03: Geography, Sub-Zones & Location Ecosystems

> **Module Target**: `web/src/app/studio/locations/page.tsx`, `web/src/app/api/studio/generate/route.ts`  
> **Phase**: 2  
> **Status**: Ready for Implementation

---

## 🎯 1. Overview & Objectives

Transform the Geography tab (`/studio/locations`) from a flat list of places into an **interactive geographical ecosystem**:
1. **Hierarchical Sub-Zone & Dungeon Spawner**: Automatically break down a parent region (e.g. *The Obsidian Citadel*) into 3–5 interconnected sub-locations (*The Inquisitor's Sunken Vault*, *The Whispering Armory*, *The Scaffolds of the Deserters*).
2. **"Populate Location" Micro-Ecosystem Macro**: With one click, generate a complete lore packet native to the selected place:
   - 2 Resident NPCs (with local roles and secrets).
   - 1 Native Creature/Beast (adapted to the biome).
   - 1 Hidden Relic or Quest Objective.
3. **Interactive Points of Interest (POIs) & Environmental Hazards**: Auto-generate tangible interactive objects and skill-check DC gates (Perception, Athletics, Arcana) ready for reader gameplay.

---

## 🏗️ 2. Data Structures & Schemas

### A. Sub-Zones Generator Schema (Zod)

```typescript
import { z } from 'zod';

export const LocationSubZoneSchema = z.object({
  parentLocationId: z.string(),
  subZones: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      subType: z.enum(['dungeon', 'sanctuary', 'ruin', 'vault', 'market', 'hazard_zone']),
      dangerLevel: z.number().min(1).max(5),
      atmosphere: z.string(),
      explorationHooks: z.array(z.string()),
      pointsOfInterest: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          skillCheck: z.object({
            attribute: z.string(),
            dc: z.number().min(8).max(25),
            failureConsequence: z.string(),
          }).optional(),
        })
      ),
    })
  ).min(3).max(5),
});

export type LocationSubZones = z.infer<typeof LocationSubZoneSchema>;
```

### B. Micro-Ecosystem Macro Schema (Zod)

```typescript
export const PopulateLocationSchema = z.object({
  locationId: z.string(),
  npcs: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      title: z.string(),
      role: z.string(),
      currentLocationId: z.string(),
      personalityTraits: z.array(z.string()),
      speechStyle: z.string(),
      goals: z.array(z.string()),
      secrets: z.array(
        z.object({
          id: z.string(),
          description: z.string(),
          requiredTrustLevel: z.number().default(20),
          revealed: z.literal(false),
        })
      ),
      initialTrust: z.number().default(0),
    })
  ).length(2),
  creature: z.object({
    id: z.string(),
    name: z.string(),
    speciesCategory: z.enum(['beast', 'monstrosity', 'undead', 'elemental', 'flora', 'draconic']),
    dangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    habitatLocationIds: z.array(z.string()),
    behavioralTactics: z.string(),
    weaknesses: z.array(z.string()),
    resistances: z.array(z.string()),
    harvestableLoot: z.array(
      z.object({
        itemId: z.string(),
        name: z.string(),
        dropRate: z.string(),
      })
    ),
    loreDescription: z.string(),
  }),
  hiddenRelic: z.object({
    id: z.string(),
    name: z.string(),
    title: z.string(),
    originEra: z.string().default('Ancient'),
    rarity: z.enum(['uncommon', 'rare', 'epic', 'legendary', 'mythic']),
    description: z.string(),
    powers: z.array(z.string()),
    curseOrCost: z.string(),
    attunementRules: z.string(),
    currentHolderType: z.literal('location'),
    currentHolderId: z.string(),
    secretLore: z.string(),
  }),
});

export type PopulateLocationPayload = z.infer<typeof PopulateLocationSchema>;
```


---

## 🔧 3. Backend Implementation Steps

### Step 1: Add Generators in `/api/studio/generate/route.ts`
* `type: 'location_subzones'`: Receives parent location summary and biome, outputs interconnected sub-zones.
* `type: 'populate_location'`: Receives location lore and returns synchronized NPCs, creature, and relic.

### Step 2: Update Context Assembler
* Ensure `buildWorldContextString` includes existing sub-zones and registered place names to avoid duplicate naming.

---

## 🎨 4. Frontend Studio UI Steps

### Step 1: Sub-Zones Accordion in `/studio/locations/page.tsx`
* Under each location card, add a **"🗺️ Manage Sub-Zones"** collapsible section.
* Provide a button: **"✨ Generate Sub-Zones with AI"**.
* Clicking allows reviewing generated sub-zones and adding them directly to the location's data.

### Step 2: "⚡ Populate Micro-Ecosystem" Action Button
* Add a one-click macro button on each location card.
* Displays a summary preview card showing the 2 NPCs, 1 creature, and 1 relic before batch-inserting them into their respective Studio tabs (`/studio/npcs`, `/studio/bestiary`, `/studio/artifacts`).

---

## 🧪 5. Testing & Verification

1. **Unit Test**: Verify Zod parsing for `LocationSubZoneSchema` and `PopulateLocationSchema`.
2. **Integration Test**: Verify batch insertion adds entities across multiple tabs in `StudioStoryContext` without losing state.
3. **UI Test**: Verify sub-zone accordions render cleanly on both desktop and mobile viewports.
