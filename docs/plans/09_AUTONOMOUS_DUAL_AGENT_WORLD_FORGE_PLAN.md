# Plan 09: Autonomous Dual-Agent World Forge (Architect & Auditor)

> **Status:** Paused / Ready for Implementation  
> **Target Subsystem:** Studio Web Suite (`web/src/app/studio/forge`, `web/src/components/studio/forge`, `web/src/lib/engines/world`)  
> **Goal:** Enable authors to delegate the role of Studio Administrator to a collaborating pair of AI agents (*The World Architect* and *The Lore Auditor*), transforming a 30–60 minute manual creation workflow into an autonomous 3–5 minute procedural pipeline with optional milestone checkpoints.

---

## 1. Executive Summary & Problem Context

Currently in StoryForge Studio:
- Crafting a new, rich universe requires dozens of sequential manual clicks: Genesis → Factions → Locations → NPCs → Secrets → Drama Bonds → RPG Stats → Voice Guides → Chapter Sagas → Scene Graphs.
- The author must individually review, tweak, and approve each generated entity modal.
- While high in control, this is time-consuming and repetitive when creating multiple stories or exploring new universe concepts.

**The Solution:** Implement the industry-standard **Dual-Agent Generator–Critic (Architect–Auditor) Loop**. An author supplies a high-level creative seed (theme, genre, scale, conflict), and the two agents autonomously build, cross-examine, validate, and commit the universe across a 6-phase pipeline.

---

## 2. The Dual-Agent Architecture

```
                      ┌─────────────────────────────────────────┐
                      │        Author Seed Configuration        │
                      │ (Theme, Tone, Scale, Language, Conflict)│
                      └────────────────────┬────────────────────┘
                                           │
                                           ▼
      ┌─────────────────────────────────────────────────────────────────────────┐
      │                       Autonomous Pipeline Engine                        │
      │                     (In-Studio Step Orchestrator)                       │
      └───────────┬─────────────────────────────────────────────────▲───────────┘
                  │                                                 │
         [Step Task & Context]                              [Audit & Approval]
                  │                                                 │
                  ▼                                                 │
      ┌─────────────────────────┐                         ┌─────────┴─────────────┐
      │   Agent 1: Architect    │ ── Draft Entities Lore ─►   Agent 2: Auditor    │
      │        (Creator)        │ ◄── Targeted Critique ── │     (Admin Proxy)     │
      └─────────────────────────┘      (Max 1 retry)      └─────────┬─────────────┘
                                                                    │ Auto-Commit
                                                                    ▼
                                                          ┌───────────────────┐
                                                          │ Story / Manifest  │
                                                          │    (Database)     │
                                                          └───────────────────┘
```

### Agent 1: 🏛️ The World Architect (Generator)
- **Role**: Creative generative intelligence.
- **Tone & Persona**: Visionary world-builder, literary author, atmospheric dramatist.
- **Responsibilities**:
  - Synthesizes core world laws, factions, and cosmological themes from the seed prompt.
  - Builds a multi-tiered spatial tree (Regions → Districts → Specific Hubs).
  - Populates locations with diverse characters (named champions + group mob templates) with hidden secrets and personal agendas.
  - Links characters with dramatic bonds, conflicting loyalties, and hidden tensions.
  - Calibrates RPG attributes grounded in the story's actual RPG system and crafts speech guides.
  - Structures a 3–5 chapter escalating saga arc with branching scene nodes.

### Agent 2: ⚖️ The Lore Auditor (Admin Proxy / Critic)
- **Role**: Quality control, schema enforcement, and narrative coherence.
- **Tone & Persona**: Meticulous archivist, impartial critic, system administrator.
- **Responsibilities**:
  - Replaces manual user approval by evaluating each batch against the deterministic `LoreAuditor` and schema boundary gates.
  - Validates entity references: Ensures locations have parent locations, drama bonds connect existing hex IDs, and stats use canonical keys.
  - Checks vocational balance: Ensures civilian characters do not receive overpowered combat stats.
  - **Decision Protocol**:
    - **Approve**: Auto-commits the batch into the world database.
    - **Refine**: Returns precise critique to the Architect for an immediate targeted revision (capped at 1 retry per phase to prevent stalling).

---

## 3. The 6-Phase Pipeline

Each phase executes as an independent, timeout-safe step with live visual feedback:

| Phase | Generator Focus | Auditor Verification |
| :--- | :--- | :--- |
| **Phase 1: Genesis Lore** | World summary, 3–4 immutable laws, theme notes, 4–6 major factions (alignments, rivalries), religions | No placeholder names, faction rivalry symmetry, valid laws |
| **Phase 2: Geography Tree** | 8–12 locations structured across 3 tiers (Regions, Districts/Settlements, Hubs/Sites), atmosphere, danger ratings | No orphan locations, parent IDs valid, non-cyclical hierarchy |
| **Phase 3: Society & Cast** | 8–12 NPCs: Major named characters + 3–4 Group Archetypes (crowd templates) assigned to locations and factions | Valid location IDs, faction links, group templates flagged properly |
| **Phase 4: Web of Intrigue** | 15–25 Drama Bonds linking characters (positive/negative affinities, secret tensions, public vs secret) | All `sourceNpcId` and `targetNpcId` match real hex IDs, no conflicting duplicates |
| **Phase 5: Mechanics & Voice** | Stat calibrations for combatants/civilians (anchored in story RPG stats) + voice guides for key actors | Canonical ASCII stat keys (`might`, `cunning`), group templates not hallucinated as single commanders |
| **Phase 6: Epic Saga Arc** | 3–5 Chapter escalating saga with themes, milestone goals, and initial branching scene graphs | Valid scene graph edges, scope tier escalation, no duplicate scene IDs |

---

## 4. Operating Modes

### Mode A: 🚀 Full Autopilot
- Runs uninterrupted from Phase 1 through Phase 6.
- Ideal when the author wants a completely finished universe and adventure generated while they step away for 3–5 minutes.
- When finished, displays a celebratory overview with one-click **"Play Story"** and **"Explore in Studio"** buttons.

### Mode B: 🚦 Milestone Checkpoints (Recommended Co-Pilot)
- Autonomous within blocks, but pauses at two key checkpoints for author inspection:
  - **Checkpoint 1 (After Phase 2: Geography)**: World & Geography Review. Shows faction spectrum graph and location tree. Author clicks *"Approve & Forge Cast"* or tweaks world tone.
  - **Checkpoint 2 (After Phase 5: Mechanics & Voice)**: Dramatis Personae & Mechanics Review. Shows character cards, drama web, and stat breakdowns. Author clicks *"Approve & Synthesize Saga"*.
- Author can also switch to Autopilot at any checkpoint.

---

## 5. User Interface & Experience (`/studio/forge`)

A dedicated interactive workspace within the Studio featuring:
1. **Seed & Configuration Drawer**:
   - World Theme / Pitch input (supporting literary Persian and English).
   - Canvas Scale selector (`localized`, `urban`, `regional`, `continental`, `mythic`).
   - Mode Toggle: `🚀 Full Autopilot` vs. `🚦 Milestone Checkpoints`.
   - Action Button: `✨ Forge Universe (شروع آفرینش جهان)`.
2. **Live Dual-Agent Activity Stream**:
   - Dialogue stream showing the conversation between **Architect** (cyan/indigo) and **Auditor** (amber/emerald).
   - Real-time audit verdicts: *"Auditor: Approved 8 locations. Discarded 1 duplicate link. Committed to world."*
3. **Phase Progress Stepper**:
   - Horizontal status tracker: `1. Genesis` → `2. Geography` → `3. Cast` → `4. Drama` → `5. Stats` → `6. Saga`.
   - Displays real-time counts (e.g. `12 Locations · 14 NPCs · 22 Bonds`).
4. **Checkpoint Summary Cards**:
   - Clean visual snapshots displayed when a milestone checkpoint is reached, with a single **"Continue to Next Phase"** button.

---

## 6. Technical Implementation Blueprint

### File Structure:
```
web/
├── src/
│   ├── app/
│   │   ├── studio/
│   │   │   ├── forge/
│   │   │   │   └── page.tsx                    # Main Autonomous World Forge Studio page
│   │   │   └── layout.tsx                      # Studio Navigation link to Forge
│   │   └── api/
│   │       └── studio/
│   │           └── forge/
│   │               └── step/
│   │                   └── route.ts            # Discrete phase execution API endpoint
│   ├── components/
│   │   └── studio/
│   │       └── forge/
│   │           ├── ForgeSeedForm.tsx           # Initial seed configuration card
│   │           ├── ForgeActivityFeed.tsx       # Live dialogue between Architect & Auditor
│   │           ├── ForgeProgressStepper.tsx    # 6-Phase visual progress bar & counter
│   │           └── ForgeCheckpointModal.tsx    # Milestone review card
│   └── lib/
│       └── engines/
│           └── world/
│               ├── AutonomousForgeEngine.ts    # Pipeline engine & validation runner
│               └── AutonomousForgeEngine.test.ts # Unit tests for pipeline phases
```

---

## 7. Verification Plan (When Resumed)

1. **Automated Unit Tests**:
   - Verify phase-by-phase state machine transitions.
   - Verify Auditor critique and retry mechanism (capping at 1 revision pass).
   - Validate that all generated entities adhere strictly to `WorldBibleSchema` and `SagaManifestSchema`.
2. **TypeScript Integrity**:
   - Ensure `npx tsc --noEmit` produces 0 errors.
3. **Manual Studio Verification**:
   - Run in Checkpoint Mode: verify pauses, inspect generated entities, confirm continuation.
   - Run in Full Autopilot Mode: verify end-to-end execution without user intervention.
