---
name: storyforge-engine-debug
description: Rapid investigation & triage guide for StoryForge AI World Engine, Oracle Easy Insert, and Entity Mutation Pipeline.
---

# StoryForge AI Engine & Oracle Debug Guide

Use this skill immediately whenever investigating issues where:
- The AI Oracle generates wrong or unexpected entity fields (e.g. category defaults to city).
- Fields, descriptions, or special rules appear missing or dropped after Easy Insert.
- Action blocks fail to emit, parse, or execute.
- Relationships, territory links, or parent/grandparent location links fail to resolve.

---

## 1. End-to-End Ingestion Pipeline Map

```
┌────────────────────────┐
│  User Input in Studio  │ (Raw text / Persian form)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│   /api/studio/chat     │ (Gemini model invocation)
└───────────┬────────────┘
            │ System Instruction: ActionPrompts.ts (buildAdviserSystemPrompt)
            ▼
┌────────────────────────┐
│   LLM Reply Output     │ (Markdown containing ```storyforge-action { op, entity, data } ```)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│   ActionParser.ts      │ (parseActionBlocks, sanitizeJsonSnippet, validateActionBlock)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  ActionNormalizer.ts   │ (normalizeEntity, PERSIAN_FIELD_MAP, category/rules sanitation)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│   oracleActions.ts     │ (prepareWorldChanges: resolves parent IDs, target IDs, mutators)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ StudioStoryContext.tsx │ (applyWorldChange: writes directly to active WorldBible in React state)
└────────────────────────┘
```

---

## 2. Instant Triage Matrix (What File to Check)

| Symptom / Bug Report | Root Cause Location | Key Function / Variable to Inspect |
| :--- | :--- | :--- |
| **"Category was set to city/settlement instead of wilderness/dungeon"** | `web/src/lib/engines/world/ActionNormalizer.ts` | `normalizeEntity` $\to$ category keyword matching block |
| **"Special rules or custom field ignored or dropped"** | `web/src/lib/engines/world/ActionNormalizer.ts` | `PERSIAN_FIELD_MAP` dictionary & `specialRules` string-to-array parser |
| **"Description or Atmosphere was empty/omitted"** | `web/src/lib/engines/world/ActionPrompts.ts` | `buildActionProtocolSection` Easy Insert format instructions |
| **"Parent location was not linked or grandparent not found"** | `web/src/lib/engines/world/oracleActions.ts` | `prepareWorldChanges` $\to$ `parentLocationName` resolver |
| **"Model did not emit any ```storyforge-action``` block"** | `web/src/lib/engines/world/ActionPrompts.ts` | `buildActionProtocolSection` / `buildAdviserSystemPrompt` |
| **"Action JSON syntax error or bad fence"** | `web/src/lib/engines/world/ActionParser.ts` | `sanitizeJsonSnippet` & `extractJsonObjectsFromBlock` |
| **"Entity match by name failed or loose typo"** | `web/src/lib/engines/world/ActionProtocol.ts` | `resolveEntityTarget`, `nameMatch`, `normalizeSearchText` |

---

## 3. Ultra-Fast Micro Test Commands

Do **NOT** run the entire test suite just to test one component. Use these targeted micro commands that finish in **under 200 milliseconds**:

```bash
# In web/ directory:

# Test Easy Insert & Field Normalization:
npx tsx --test src/lib/engines/world/oracleEasyInsert.test.ts

# Test Action Protocol & Prompts:
npx tsx --test src/lib/engines/world/ActionProtocol.test.ts

# Test World Actions & Entity Mutators:
npx tsx --test src/lib/engines/world/oracleActions.test.ts

# Test Faction Relations & Aliases:
npx tsx --test src/lib/engines/world/factionRelations.test.ts
```

---

## 4. Live Action Debugging in Studio UI

In `StudioOracleDrawer`, each pending change card contains a **Debug Payload** toggle.
- When an author says an import failed, check the debug payload:
  - If `raw.category` was missing: **Prompt issue** (`ActionPrompts.ts`).
  - If `raw.category` was present but `normalized.category` changed: **Normalizer issue** (`ActionNormalizer.ts`).
  - If `normalized.parentLocationId` is undefined: **Resolver issue** (`oracleActions.ts`).
