# Plan 02: AI World-Building Adviser & Oracle Suite

> **Module Target**: `web/src/app/studio/chat/page.tsx`, `web/src/app/api/studio/chat/route.ts`, `web/src/components/studio/DiffPreviewModal.tsx`  
> **Phase**: 1 & 5  
> **Status**: Ready for Implementation

---

## 🎯 1. Overview & Objectives

The **AI Adviser (مشاور جهان‌سازی)** is the central collaborative intelligence for authors. This plan upgrades the chat experience with:
1. **Multi-Persona Advisory Council**: Choose between *The Lore Inquisitor*, *The Story Weaver*, *The Grand Cosmologist*, and *The Literary Stylist*.
2. **Interactive Visual Diff Preview Modal**: Before any `storyforge-action` (`create`, `update`, `delete`) mutates the World Bible, the UI displays a clean side-by-side diff for author review and one-click commit or rejection.
3. **Proactive Lore Gap & Orphan Entity Radar**: The Adviser highlights incomplete lore nodes (e.g. factions without leaders, locations without threats) directly within the chat stream.
4. **Active Entity Memory Injection**: When editing a specific NPC, relic, or deity, opening the chat automatically passes that entity's full JSON context for surgical fine-tuning.

---

## 🏗️ 2. Advisory Personas & System Prompts

```typescript
export type AdviserPersona = 'inquisitor' | 'weaver' | 'cosmologist' | 'stylist';

export const ADVISER_PERSONAS: Record<AdviserPersona, { nameFa: string; nameEn: string; prompt: string }> = {
  inquisitor: {
    nameFa: 'منتقد سخت‌گیر (The Inquisitor)',
    nameEn: 'The Lore Inquisitor',
    prompt: `You are The Lore Inquisitor. Your duty is to rigorously challenge the author's world-building logic.
Hunt for continuity errors, unearned stakes, overpowered magical artifacts, and clichéd tropes.
Be direct, razor-sharp, constructive, and uncompromising on quality.`,
  },
  weaver: {
    nameFa: 'طراح درام و گره‌افکنی (The Story Weaver)',
    nameEn: 'The Story Weaver',
    prompt: `You are The Story Weaver. Your focus is dramatic conflict, tragedy, betrayal, and high-stakes choices.
Connect isolated characters with secrets, ancient blood debts, forbidden romances, and political powderkegs.`,
  },
  cosmologist: {
    nameFa: 'معمار کیهان و قوانین (The Cosmologist)',
    nameEn: 'The Grand Cosmologist',
    prompt: `You are The Grand Cosmologist. Your domain is the fundamental metaphysical order, ancient history, pantheons, and magic costs.
Ensure all entities honor immutable world laws and cosmic equilibrium.`,
  },
  stylist: {
    nameFa: 'ویرایشگر ادبی (The Literary Stylist)',
    nameEn: 'The Literary Stylist',
    prompt: `You are The Literary Stylist. You elevate narrative descriptions, titles, epithets, and dialogue into breathtaking, atmospheric prose.
Ensure exquisite literary cadence in both Persian and English.`,
  },
};
```

---

## 🔧 3. The `storyforge-action` Protocol & Diff Engine

### A. Action Protocol Specification
The AI Adviser outputs executable blocks:

```storyforge-action
{
  "op": "update",
  "entity": "npc",
  "match": { "byName": "Vesper" },
  "prompt": "Change Vesper's secret to: He poisoned the Grand Archon and framed the Crimson Guild."
}
```

### B. Visual Diff Preview Flow
```
User Prompt $\rightarrow$ AI generates storyforge-action $\rightarrow$ Client intercepts action
                                                                     │
                                                                     ▼
                                                   Render Visual Diff Modal
                                           ┌─────────────────────────────────────────┐
                                           │ Original Field      │ Modified Field    │
                                           ├─────────────────────┼───────────────────┤
                                           │ secret: "Loyal"     │ secret: "Traitor" │
                                           └─────────────────────┴───────────────────┘
                                                   │                         │
                                            [❌ Reject]               [✅ Commit Diff]
```

---

## 🎨 4. Frontend Studio UI Steps

### Step 1: Persona Selector in `/studio/chat/page.tsx`
* Segmented button group or dropdown to toggle between the 4 personas.
* Persona avatar badge dynamically reflects active counselor tone.

### Step 2: Implement `DiffPreviewModal.tsx`
* Create reusable component `web/src/components/studio/DiffPreviewModal.tsx`.
* Displays old values vs. proposed new values highlighted with green (added) and red (removed) typography.
* Supports manual inline edits before final commit to `StudioStoryContext`.

### Step 3: Proactive Suggestions Chips
* Top of the chat interface displays auto-generated suggestions based on World Bible gaps:
  * *"⚠️ 2 factions have no leaders. Ask me to generate them."*
  * *"✨ The Sunken Vault has no assigned guardian beast. Brainstorm one?"*

### Step 4: Inline "Entity Workshop Drawer" (`EntityWorkshopDrawer.tsx`)
* A dedicated side-panel accessible from any entity card across `/studio/npcs`, `/studio/locations`, `/studio/artifacts`, `/studio/religions`, etc.
* Allows conversational back-and-forth iteration directly on that entity:
  * *"Give me 3 alternate motives for this faction leader."*
  * *"Make this law harsher and specify a blood-magic penalty."*
  * *"Translate and refine this lore into poetic Persian."*
* Includes a **Variant Selector** (Compare Option A vs B vs C) and one-click field replacement.


---

## 🧪 5. Testing & Verification

1. **Unit Test**: `web/src/lib/engines/world/ActionProtocol.test.ts`
   - Test parsing of valid and invalid `storyforge-action` JSON blocks.
   - Verify entity matching logic (case-insensitive name lookups and alias normalizations).
2. **API Route Test**: `web/src/app/api/studio/chat/chat.test.ts`
   - Verify that custom persona system prompts are correctly injected into Gemini chat calls.
3. **Manual UI Verification**:
   - Issue natural language update commands in Persian and English.
   - Verify that the diff modal displays accurate changes and commits cleanly.
