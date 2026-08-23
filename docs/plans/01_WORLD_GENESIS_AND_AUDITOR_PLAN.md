# Plan 01: World Genesis Generator & Lore Contradiction Radar

> **Module Target**: `web/src/app/studio/world/page.tsx`, `web/src/app/api/studio/generate/route.ts`, `web/src/lib/engines/world/`  
> **Phase**: 1  
> **Status**: ✅ Completed & Verified (29/29 tests passing, clean TypeScript check)


---

## 🎯 1. Overview & Objectives

This plan implements two flagship AI capabilities inside the **World Bible (`/studio/world`)**:
1. **Seed-to-Cosmos "Genesis Generator"**: Turns a high-concept premise into a complete, interconnected starter world package (World Laws, 3 Factions, 4 Locations, 2 Deities, 1 Core Campaign Mystery) in a single structured transaction.
2. **"Contradiction Radar" (World Lore Consistency Auditor)**: An automated AI diagnostic engine that analyzes the entire World Bible to detect continuity breaks, magic law violations, timeline paradoxes, and species/faction mismatches.
3. **Thematic Style & Tone Presets**: A persistent setting injecting literary tone filters (*Grimdark Gothic, Mythic Persian, Cosmic Horror, Steampunk Intrigue*) into all studio generators.

---

## 🏗️ 2. Data Structures & Schemas

### A. Genesis Generator Output Schema (Zod)

```typescript
import { z } from 'zod';

export const GenesisWorldSchema = z.object({
  worldName: z.string().min(2),
  tagline: z.string().min(5),
  summary: z.string().min(20),
  themeNotes: z.string(),
  aiSystemPrompt: z.string(),
  laws: z.array(
    z.object({
      id: z.string(),
      rule: z.string(),
      description: z.string(),
      category: z.enum(['magic', 'physics', 'society', 'divine']),
      isImmutable: z.literal(true),
    })
  ).length(4),
  factions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      alignment: z.string(),
      publicGoals: z.string(),
      secretAgendas: z.string(),
      rivalFactionIds: z.array(z.string()).default([]),
      alliedFactionIds: z.array(z.string()).default([]),
      territoryIds: z.array(z.string()).default([]),
    })
  ).length(3),
  locations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      region: z.string(),
      description: z.string(),
      atmosphere: z.string(),
      dangerLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
      specialRules: z.array(z.string()).default([]),
      connectedLocationIds: z.array(z.string()).default([]),
    })
  ).length(4),
  religions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      title: z.string(),
      domain: z.enum(['light', 'death', 'war', 'secrets', 'nature', 'chaos', 'forge']),
      sacredSymbol: z.string(),
      coreDogma: z.string(),
      taboos: z.array(z.string()),
      divineBlessings: z.array(z.string()),
    })
  ).length(2),
  coreCampaignMystery: z.string(),
});

export type GenesisWorldData = z.infer<typeof GenesisWorldSchema>;
```


### B. Contradiction Radar Diagnostic Schema (Zod)

```typescript
export const ContradictionAuditReportSchema = z.object({
  score: z.number().min(0).max(100), // Overall consistency score (100 = flawless)
  summary: z.string(),
  findings: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(['error', 'warning', 'suggestion']),
      category: z.enum(['law_conflict', 'timeline_paradox', 'faction_rivalry', 'magic_violation', 'missing_link']),
      title: z.string(),
      description: z.string(),
      involvedEntities: z.array(
        z.object({
          entityType: z.string(),
          name: z.string(),
        })
      ),
      suggestedFix: z.string(),
    })
  ),
});

export type ContradictionAuditReport = z.infer<typeof ContradictionAuditReportSchema>;
```

---

## 🔧 3. Backend Implementation Steps

### Step 1: Add `type: 'genesis'` and `type: 'audit_world'` to `/api/studio/generate/route.ts`
* Construct tailored prompt templates with dual-language (Persian/English) instructions.
* Inject the entire `buildWorldContextString(story)` into the audit prompt.
* Use `generateStructuredJson` with `GenesisWorldSchema` and `ContradictionAuditReportSchema`.

### Step 2: Create Core Logic in `web/src/lib/engines/world/LoreAuditor.ts`
* Helper class to prepare World Bible JSON payloads for auditing and to calculate rule checks (e.g. detect empty fields, orphaned faction leaders, and missing locations).

---

## 🎨 4. Frontend Studio UI Steps

### Step 1: Genesis Modal in `/studio/world/page.tsx`
* Add a prominent **"✨ One-Click Genesis Generator"** button in the header.
* Modal input: Author prompt / seed input with presets (e.g. *"Sunless Archipelago"*, *"Grimdark Alchemical Empire"*, *"Silk Road Mythic Fantasy"*).
* Loading state: Visual animated cosmos loader.
* Preview & Apply: Inspect generated laws, factions, and locations side-by-side with a **"Commit to World Bible"** action.

### Step 2: Contradiction Radar Panel in `/studio/world/page.tsx`
* A floating diagnostic badge with health score (e.g. `🛡️ Lore Consistency: 92/100`).
* Clicking opens a sliding drawer listing all identified contradictions.
* Each finding includes an **"⚡ Auto-Resolve with AI"** button that applies the `suggestedFix`.

---

## 🧪 5. Testing & Verification

1. **Unit Test**: `web/src/lib/engines/world/LoreAuditor.test.ts`
   - Test detection of intentional contradictions (e.g. a Law banning fire magic vs. an Artifact casting inferno).
2. **API Route Test**: `StudioGenerate.test.ts`
   - Verify `POST /api/studio/generate` with `type: 'genesis'` and `type: 'audit_world'`.
3. **Manual UI Validation**:
   - Generate a complete world from a single prompt.
   - Run the audit pass and verify that resolved suggestions update state in `StudioStoryContext`.
