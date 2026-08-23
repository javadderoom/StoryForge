# Plan 04: NPCs & Social Drama Web

> **Module Target**: `web/src/app/studio/npcs/page.tsx`, `web/src/app/api/studio/generate/route.ts`  
> **Phase**: 3  
> **Status**: Ready for Implementation

---

## 🎯 1. Overview & Objectives

Transform the Character registry (`/studio/npcs`) from static stat blocks into a **high-stakes web of social drama**:
1. **Interpersonal Relationship Web Synthesizer**: Connect isolated NPCs with dynamic bonds (*Blood Debt, Forbidden Romance, Secret Blackmail, Master & Apostate, Co-Conspirators*).
2. **Voice & Dialogue Style Guide Generator**: Generate distinct dialect quirks, negotiation triggers, and psychological breaking points for the AI Narrative Director.
3. **Lore-to-RPG Stat Auto-Calibration**: Automatically generate combat stats, inventory gear, and skill ratings matching the story's custom RPG system and the character's narrative rank.

---

## 🏗️ 2. Data Structures & Schemas

### A. Interpersonal Relationship Schema (Zod)

```typescript
import { z } from 'zod';

export const NpcRelationshipWebSchema = z.object({
  sourceNpcId: z.string(),
  sourceNpcName: z.string(),
  bonds: z.array(
    z.object({
      id: z.string(),
      sourceNpcId: z.string(),
      targetNpcId: z.string(),
      targetNpcName: z.string(),
      relationTypeId: z.enum([
        'blood_debt',
        'mentor_apprentice',
        'ally',
        'rival',
        'faction_ally',
        'custom',
      ]),
      affinity: z.number().min(-100).max(100),
      secretTension: z.string(), // The hidden truth or conflict trigger
      isPublic: z.boolean().default(true),
    })
  ).min(2).max(4),
});

export type NpcRelationshipWeb = z.infer<typeof NpcRelationshipWebSchema>;
```


### B. Voice & Dialogue Style Guide Schema (Zod)

```typescript
export const NpcVoiceGuideSchema = z.object({
  npcName: z.string(),
  speechQuirks: z.array(z.string()), // e.g. "Speaks in short, clipped sentences", "Uses maritime metaphors"
  sampleDialogue: z.array(
    z.object({
      context: z.enum(['greeting', 'bargaining', 'threatened', 'dying']),
      quote: z.string(),
    })
  ).length(4),
  negotiationVulnerabilities: z.array(z.string()), // What makes them agree
  psychologicalBreakingPoint: z.string(), // How they react to torture or extreme grief
});

export type NpcVoiceGuide = z.infer<typeof NpcVoiceGuideSchema>;
```

---

## 🔧 3. Backend Implementation Steps

### Step 1: Add NPC Generators in `/api/studio/generate/route.ts`
* `type: 'npc_relationships'`: Passes all existing NPCs in context, returns dynamic bonds between the target NPC and other characters.
* `type: 'npc_voice_guide'`: Generates speech guide, negotiation triggers, and voice samples in chosen language.
* `type: 'npc_stat_calibration'`: Generates RPG attributes and equipment tailored to the story's `RpgSystem` schema.

---

## 🎨 4. Frontend Studio UI Steps

### Step 1: Interpersonal Web Tab on NPC Card
* Inside each NPC card in `/studio/npcs/page.tsx`, add a **"👥 Social Web & Bonds"** section.
* Button: **"✨ Generate Relationships with AI"**.
* Displays interactive relationship pills with color-coded bond types (`Blood Debt` $\rightarrow$ Red, `Romance` $\rightarrow$ Rose, `Blackmail` $\rightarrow$ Purple).

### Step 2: "🎭 Voice & Dialogue Guide" Drawer
* Collapsible panel with sample voice quotes and roleplay instructions for the AI Director.

---

## 🧪 5. Testing & Verification

1. **Unit Test**: Test Zod schema validation and bond type assignments.
2. **Context Integrity Test**: Verify that the AI selects real existing NPCs from the World Bible for relationship targets rather than hallucinating phantom characters.
3. **UI Test**: Verify relationship badges render cleanly with Persian & English labels.
