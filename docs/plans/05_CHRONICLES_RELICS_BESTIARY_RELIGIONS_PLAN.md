# Plan 05: Deep Lore Vaults — Chronicles, Relics, Bestiary & Religions

> **Module Target**: `/studio/timeline`, `/studio/artifacts`, `/studio/bestiary`, `/studio/religions`, `/api/studio/generate/route.ts`  
> **Phase**: 4  
> **Status**: Ready for Implementation

---

## 🎯 1. Overview & Objectives

Elevate the core lore catalogs into **dynamic, interconnected world-building pillars**:
1. **Historical Eras & Timeline (`/studio/timeline`)**:
   - **3-Era Epoch Arc Synthesizer**: Generates macro-history (*Age of Creation $\rightarrow$ The Great Cataclysm $\rightarrow$ The Present Ash Age*).
   - **"Ripple Effects" Propagator**: Suggests modern fallout when an ancient historical event is altered.
2. **Mythic Relics & Arcane Artifacts (`/studio/artifacts`)**:
   - **Double-Edged Curses & Attunement**: Generates narrative and mechanical trade-offs.
   - **Origin & Vault Quest Hooks**: Who crafted it, where it is locked, and what ritual opens the vault.
3. **Bestiary & Ecological Systems (`/studio/bestiary`)**:
   - **Food Chain & Non-Lethal Pacification**: Behavioral tactics and pacification methods.
   - **Alchemical Harvest Yields**: Exact crafting reagents for potions, forging, and rituals.
4. **Pantheons & Faith Systems (`/studio/religions`)**:
   - **Divine Taboos, Omens & Blessings**: Behavioral rules that trigger gameplay consequences.
   - **Sectarian Schisms & Holy War Engine**: Generates splinter cults and religious conflicts.

---

## 🏗️ 2. Data Structures & Schemas

### A. Epoch Arc & Timeline Ripple Schema (Zod)

```typescript
import { z } from 'zod';

export const EpochArcSchema = z.object({
  eras: z.array(
    z.object({
      eraName: z.string(),
      timeframe: z.string(),
      description: z.string(),
      majorCataclysm: z.string(),
      legacyFactions: z.array(z.string()),
    })
  ).length(3),
  keyEvents: z.array(
    z.object({
      title: z.string(),
      eraName: z.string(),
      narrativeSummary: z.string(),
      lastingConsequences: z.string(),
    })
  ).min(4),
});

export const TimelineRippleSchema = z.object({
  sourceEventTitle: z.string(),
  modernRepercussions: z.array(
    z.object({
      targetType: z.enum(['faction', 'location', 'artifact', 'religion']),
      targetName: z.string(),
      effectDescription: z.string(),
    })
  ).min(2),
});
```

### B. Relic Vault & Double-Edged Curse Schema (Zod)

```typescript
export const EnhancedArtifactSchema = z.object({
  name: z.string(),
  rarity: z.enum(['uncommon', 'rare', 'epic', 'legendary', 'mythic']),
  attunementCost: z.string(),
  activePower: z.string(),
  doubleEdgedCurse: z.string(), // Mechanical + Narrative penalty
  vaultLore: z.object({
    creator: z.string(),
    currentVaultLocation: z.string(),
    unsealingRitual: z.string(),
    rivalSeekers: z.array(z.string()),
  }),
});
```

### C. Bestiary Ecology & Alchemical Harvest Schema (Zod)

```typescript
export const EnhancedCreatureSchema = z.object({
  name: z.string(),
  speciesCategory: z.enum(['beast', 'monstrosity', 'undead', 'elemental', 'flora', 'draconic']),
  habitatLocationName: z.string(),
  predatorPreyNiche: z.string(),
  nonCombatPacificationMethod: z.string(),
  alchemicalYields: z.array(
    z.object({
      reagentName: z.string(),
      rarity: z.string(),
      craftingUse: z.string(),
    })
  ).min(1).max(3),
});
```

### D. Religion Dogmas, Taboos & Schisms Schema (Zod)

```typescript
export const EnhancedReligionSchema = z.object({
  name: z.string(),
  domain: z.string(),
  sacredTaboos: z.array(z.string()),
  divineOmensForViolation: z.string(),
  divineBlessing: z.string(),
  sectarianSchisms: z.array(
    z.object({
      cultName: z.string(),
      heresyDoctrine: z.string(),
      headquartersLocation: z.string(),
    })
  ),
});
```

---

## 🔧 3. Backend & Frontend Implementation

### Step 1: Update `/api/studio/generate/route.ts`
* Add generation types: `epoch_arc`, `timeline_ripple`, `artifact_enhanced`, `creature_ecology`, `religion_schisms`.

### Step 2: Update Studio Pages
* **Timeline (`/studio/timeline/page.tsx`)**: Add **"⏳ Generate 3-Era Epoch Arc"** button and Ripple Detector.
* **Artifacts (`/studio/artifacts/page.tsx`)**: Add **"⚔️ Generate Vault & Curses"** section.
* **Bestiary (`/studio/bestiary/page.tsx`)**: Add **"🐉 Ecology & Reagents"** section.
* **Religions (`/studio/religions/page.tsx`)**: Add **"🔮 Taboos & Cult Schisms"** section.

---

## 🧪 4. Testing & Verification

1. **Schema Validation Tests**: Automated unit tests for all 4 enhanced schemas.
2. **Context Anchoring Test**: Verify that relics cite real locations and deities cite existing factions.
