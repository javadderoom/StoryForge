# Plan 10: Trade Routes, Caravans & Dynamic Economy

> **Module Target**: `web/src/lib/types/world.ts`, `web/src/lib/engines/narrative/worldContext.ts`, `web/src/app/studio/geography/`, `web/src/app/studio/trade/`  
> **Phase**: 6  
> **Status**: Ready for Implementation

---

## 🎯 1. Overview & Objectives

In interactive fiction and dynamic world-building, a world where items and minerals merely "exist" in local shop inventories feels static and artificial. **Trade routes, caravan corridors, and commodity flows transform geography into an active engine for organic storytelling, factional conflict, and emergent quest hooks.**

This plan introduces a dedicated, first-class **Trade & Caravan Routes System** to AfsanehSaz / StoryForge:
1. **Separation of Extraction vs. Market Availability**: Minerals, flora, and crafted goods originate at their natural extraction habitats or production workshops (e.g. Northern Mountain veins), but flow automatically into connected market settlements via designated trade routes without entity duplication.
2. **Dynamic Route Status & Supply Shocks**: Routes experience real-time narrative states (`active`, `blockaded`, `raided`, `seasonal`, `secret`), triggering realistic market shortages, price surges, economic friction, and civilian unrest in destination cities.
3. **Organic Quest & Choice Generation**: The Oracle and narrative scene engines gain instant awareness of route dangers, enabling procedural caravan escort contracts, bandit ambushes, contraband smuggling, and geopolitical embargoes.
4. **Faction Cartels & Toll Geopolitics**: Routes are linked to controlling or escorting factions, tying trade prosperity directly to inter-faction diplomacy, wars, and territorial influence.

---

## 🏗️ 2. Data Structures & Schemas

### A. Trade Route Schema (`WorldTradeRoute`)

```typescript
import { z } from 'zod';

export const TradeFlowDirectionSchema = z.enum(['forward', 'backward', 'bilateral']);
export type TradeFlowDirection = z.infer<typeof TradeFlowDirectionSchema>;

export const TradeRouteStatusSchema = z.enum([
  'active',      // Flowing normally; goods readily accessible at destination
  'raided',      // Harassed by bandits/beasts; prices inflated, shipments delayed
  'blockaded',   // Completely severed by war, collapse, or hostile decree; shortage in effect
  'seasonal',    // Only passable during specific seasons (e.g. frozen passes, monsoon seas)
  'secret',      // Illicit smuggling corridor; circumvents customs, taxes, and bans
]);
export type TradeRouteStatus = z.infer<typeof TradeRouteStatusSchema>;

export const TradeCommoditySchema = z.object({
  entityId: z.string().min(1), // References a WorldCreature (speciesCategory: 'mineral' | 'flora'), crafted good, or artifact
  name: z.string().min(1),
  flowDirection: TradeFlowDirectionSchema.default('forward'),
  significance: z.string().optional(), // e.g. "Primary iron supply for the Royal Armory"
});
export type TradeCommodity = z.infer<typeof TradeCommoditySchema>;

export const WorldTradeRouteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1), // e.g. "شاهراه زمهریر" / "The Frost-Peak Highway"
  description: z.string().default(''),
  originLocationId: z.string().min(1),      // e.g. Northern Mining Outpost
  destinationLocationId: z.string().min(1), // e.g. Southern Capital / Port
  intermediateLocationIds: z.array(z.string()).default([]), // Waypoints, oasis outposts, mountain passes
  
  commodities: z.array(TradeCommoditySchema).default([]),

  controllingFactionId: z.string().optional(), // Guild of Caravaneers, Northern Warlords, etc.
  patrollingFactionId: z.string().optional(),  // Military force or mercenary company providing security
  rivalRaidingFactionId: z.string().optional(),// Bandits, rebel cell, or rival kingdom targeting the route

  dangerLevel: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]).default(2),

  status: TradeRouteStatusSchema.default('active'),
  disruptionReason: z.string().optional(), // e.g. "Winter blizzards have buried the High Pass"
  smugglingRiskDC: z.number().min(8).max(25).optional(), // Sleight of hand / Deception DC for contraband
  secretLore: z.string().optional(),
});

export type WorldTradeRoute = z.infer<typeof WorldTradeRouteSchema>;
```

### B. WorldBible Integration

```typescript
// Extended WorldBible schema in web/src/lib/types/world.ts
export interface WorldBible {
  // ... existing fields ...
  tradeRoutes?: WorldTradeRoute[];
}
```

---

## ⚙️ 3. Core Engine Mechanics

### A. Automatic Market Availability Resolution
Instead of requiring creators to manually copy mineral names into every city's description:
1. When evaluating a settlement's available resources (e.g. `isResourceAvailableInLocation(locationId, entityId, worldBible)`):
   - Check if `locationId` is the native habitat (`habitatLocationIds.includes(locationId)`).
   - If not, check all active trade routes where `destinationLocationId === locationId` (or bidirectional routes).
   - If a route carries that commodity and `status !== 'blockaded'`, the resource is resolved as **Imported (Commercial Presence)**.
2. If `status === 'raided'`, the resource is resolved as **Scarce / Inflated Price**.
3. If `status === 'blockaded'`, the resource is resolved as **Unavailable (Severe Shortage)**.

### B. Dynamic Narrative Context Injection (`worldContext.ts`)
The narrative prompt builder formats active trade networks for the AI author/director:

```text
[COMMERCIAL ARTERIES & TRADE ROUTES]
• The Frost-Peak Highway (Danger 3, Status: RAIDED by Frost-Clan Bandits)
  - Transports: Azure-Iron Ore (Forward), Smelted Silver (Bilateral)
  - Origin: Northern Dwarf Mines -> Destination: Sunstone Capital
  - Economic Impact: Azure-Iron is scarce in Sunstone Capital; smithies face weapon shortages; caravan guard escorts in high demand.
```

### C. Procedural Quest Hooks & Player Choice Triggers
When the player is in an origin, waypoint, or destination location, the choice generator surfaces contextual options:
* **Escort & Guard**: *"Accept 80 gold pieces to escort Master Kenneth's spice caravan across the Sunken Gorge."*
* **Plunder & Ambush**: *"Tip off the Desert Jackals about the silver convoy in exchange for a 20% cut."*
* **Smuggle Contraband**: *"Conceal raw soul-quartz in wine barrels to bypass the South Gate customs tax (DC 14 Stealth)."*
* **Relieve Shortage**: *"Clear the mountain pass of yeti packs to restore iron shipments to the local forge."*

---

## 🎨 4. Studio UI & Author Workflows

1. **Trade Routes Manager**:
   - Integrated into Studio under Geography (`/studio/locations` or a dedicated `/studio/trade` sub-view).
   - Visual route cards connecting Origin $\rightarrow$ Destination with intermediate waypoints.
   - Commodity selector picking from existing World Minerals (`bestiary` where `speciesCategory === 'mineral' | 'flora'`), Relics, or Custom Goods.
2. **One-Click Route Generator (AI Oracle)**:
   - Oracle examines existing geographical connections and factions.
   - Automatically suggests 3 realistic economic trade lines (e.g. Food from fertile valleys to mining peaks; Ores from mountains to coastal shipyards).
3. **Route Health & Crisis Simulator**:
   - Toggle route status between `active`, `raided`, `blockaded`, and `secret`.
   - Live preview showing which cities gain or lose access to critical reagents and crafting ores.

---

## 📋 5. Phased Implementation Roadmap

1. **Phase 1: Types & Zod Schemas**: Add `WorldTradeRouteSchema` to `web/src/lib/types/world.ts` and test runtime validation.
2. **Phase 2: Narrative Context & Engine Resolvers**: Implement `getMarketGoodsForLocation()` and integrate active routes into `worldContext.ts` and Action prompts.
3. **Phase 3: Oracle Easy Insert & Mutators**: Add `tradeRoute` action handlers in `ActionNormalizer.ts` and `oracleActions.ts`.
4. **Phase 4: Studio UI Component**: Build the interactive Route builder with origin/destination dropdowns, commodity chips, and status badges.
5. **Phase 5: Automated Testing**: Add unit tests verifying commodity resolution, shortage propagation, and schema validation.
