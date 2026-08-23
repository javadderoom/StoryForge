# Plan 06: RPG Mechanics, Branching Story Beats & Global Studio Oracle

> **Module Target**: `/studio/rpg`, `/studio/beats`, `/studio/layout.tsx`, `/api/studio/generate/route.ts`  
> **Phase**: 5  
> **Status**: Ready for Implementation

---

## 🎯 1. Overview & Objectives

This plan finalizes the studio AI upgrade by empowering gameplay mechanics, story structure, and global authoring UX:
1. **Theme-to-RPG System Synthesizer (`/studio/rpg`)**: Derives bespoke attributes, resources, skills, and starting archetypes directly from the story's theme notes and World Laws (e.g. *Sanity & Paranoia* for Cosmic Horror, *Lineage & Guile* for Political Drama).
2. **3-Act Branching Plot Tree & Choice Balancer (`/studio/beats`)**:
   - Generates a complete 3-act narrative graph with DC gates, branching nodes, and failure states.
   - Balances every scene with the 3 distinct choice archetypes (*Defensive/Diplomatic*, *Tactical/Agile*, *Aggressive/High-Stakes*).
3. **Contextual Floating AI Assistant Drawer ("The Studio Oracle")**: A persistent collapsible sidebar on all Studio screens aware of the open tab and active entity.
4. **Smart `@mentions` Autocompletion**: Typing `@` inside any description field dynamically lists registered world entities for instant cross-linking.

---

## 🏗️ 2. Data Structures & Schemas

### A. Theme-to-RPG System Schema (Zod)

```typescript
import { z } from 'zod';

export const ThemeRpgSystemSchema = z.object({
  themeJustification: z.string(),
  stats: z.array(
    z.object({
      id: z.string(),
      nameFa: z.string(),
      nameEn: z.string(),
      description: z.string(),
      defaultValue: z.number().default(10),
    })
  ).min(4).max(6),
  resources: z.array(
    z.object({
      id: z.string(),
      nameFa: z.string(),
      nameEn: z.string(),
      maxValue: z.number(),
      decayRule: z.string().optional(),
    })
  ).min(2).max(4),
  archetypes: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      startingStats: z.record(z.string(), z.number()),
      signaturePerk: z.string(),
      startingInventory: z.array(z.string()),
    })
  ).length(4),
});

export type ThemeRpgSystemPayload = z.infer<typeof ThemeRpgSystemSchema>;
```

### B. 3-Act Branching Plot Tree Schema (Zod)

```typescript
export const BranchingStoryTreeSchema = z.object({
  title: z.string(),
  premise: z.string(),
  acts: z.array(
    z.object({
      actNumber: z.number().min(1).max(3),
      actTitle: z.string(),
      scenes: z.array(
        z.object({
          sceneId: z.string(),
          title: z.string(),
          settingLocationName: z.string(),
          primaryConflict: z.string(),
          presentedChoices: z.array(
            z.object({
              style: z.enum(['defensive_diplomatic', 'tactical_agile', 'aggressive_daring']),
              textFa: z.string(),
              textEn: z.string(),
              statCheck: z.object({
                stat: z.string(),
                dc: z.number().min(8).max(25),
              }).optional(),
              leadToSceneId: z.string().optional(),
            })
          ).length(3),
        })
      ),
    })
  ).length(3),
});

export type BranchingStoryTree = z.infer<typeof BranchingStoryTreeSchema>;
```

---

## 🔧 3. Backend & Studio Shell Implementation

### Step 1: Add RPG & Beat Generators in `/api/studio/generate/route.ts`
* `type: 'rpg_system_synthesis'`: Synthesizes tailored stats, resources, and archetypes from `story.worldBible`.
* `type: 'branching_story_tree'`: Generates 3-act scene graphs with 3-risk-tier choices.

### Step 2: Implement Persistent Floating Oracle in `web/src/app/studio/layout.tsx`
* Collapsible right-hand drawer accessible from any Studio route.
* Automatically includes the current URL path (e.g. `/studio/bestiary`), active story manifest, and active item context in every message.

### Step 3: Implement `@mentions` Input Component
* Create `web/src/components/studio/MentionTextarea.tsx`.
* Detects `@` character and opens a search popover of all entities in `StudioStoryContext`.

---

## 🧪 4. Testing & Verification

1. **Unit Test**: Test RPG synthesis and 3-Act story tree schema parsing.
2. **UI Integration Test**: Verify floating Oracle drawer opens smoothly on all studio routes without layout shifts.
3. **Persian / RTL Text Verification**: Verify `@mentions` popover aligns correctly in RTL mode.
