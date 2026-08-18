# StoryForge — Interactive RPG Novel
## Master Plan & Technical Specification

> **Project Vision:**
> *An AI-powered interactive RPG novel where players read, choose, act, and shape the story while the underlying world remains consistent, persistent, and rule-bound.*
>
> **Golden Principle:**
> *"The player can change the story, but cannot change the rules of the world without a reason."*

---

## Table of Contents
1. [Executive Summary & Core Philosophy](#1-executive-summary--core-philosophy)
2. [Product & User Experience (UX)](#2-product--user-experience-ux)
3. [System Architecture](#3-system-architecture)
4. [StoryForge Studio (Authoring & World-Building Admin Suite)](#4-storyforge-studio-authoring--world-building-admin-suite)
5. [The 4 Core Engines](#5-the-4-core-engines)
   - [5.1 World Engine & World Bible](#51-world-engine--world-bible)
   - [5.2 Game Engine & Deterministic Mechanics](#52-game-engine--deterministic-mechanics)
   - [5.3 Action Validation Layer](#53-action-validation-layer)
   - [5.4 Multi-Tier Hierarchical Memory System](#54-multi-tier-hierarchical-memory-system)
6. [AI Narrative Director & Prompt Assembly](#6-ai-narrative-director--prompt-assembly)
7. [Data Schemas & Definitions](#7-data-schemas--definitions)
8. [Client Architecture (Flutter Reader App)](#8-client-architecture-flutter-reader-app)
9. [Project Directory Structure](#9-project-directory-structure)
10. [Development Roadmap & Milestones](#10-development-roadmap--milestones)

---

## 1. Executive Summary & Core Philosophy

StoryForge is not an AI chat app or a generic chatbot wrapper. It is an **Interactive Fiction + RPG Platform** designed with a **"Story First, Reader First"** ethos.

```
Story → Decision / Free Action → Validation → Deterministic Consequence → Dynamic Narrative
```

### The 7 Pillars of StoryForge:

1. **Story First, RPG Second**: The product is primarily a rich literary novel. Stats, HP, and dice rolls exist to provide tangible stakes and mechanical consequence, not to turn the experience into an arcade game.
2. **World Before Narrative**: Every world, its timeline, factions, geography, magic/tech limitations, and lore are immutable facts defined in a **World Bible** before generation begins. The AI cannot reinvent or break the world.
3. **AI Is Not the Game Engine or Database**: LLMs (Gemini, Claude, GPT) are *Narrators and Directors*, not databases or rule evaluators. Math, dice checks, state transitions, and inventory updates are computed deterministically by the backend.
4. **Choices Have Real, Lasting Consequences**: Decisions branch the state graph and permanently mutate relationships, world states, and memory logs.
5. **Consistency Over Hallucinatory Creativity**: A dedicated **Action Validation Layer** intercepts free-text inputs that violate physics, inventory, or lore (e.g. summoning an extinct dragon).
6. **Story-Dependent RPG Systems**: There is no rigid global class system. A Dark Fantasy story may use *Might, Agility, and Blood Magic*, whereas a Detective Noir story uses *Observation, Logic, Persuasion, and Intuition*.
7. **Reader-Centric UI**: Clean book typography with discreet, non-intrusive RPG drawers and HUDs.

---

## 2. Product & User Experience (UX)

### 2.1 The Reading Flow
1. **Story Library**: Users browse diverse stories across genres (Dark Fantasy, Sci-Fi, Mystery/Detective, Horror, Historical, Romance, Iranian & Global folklore).
2. **Book View**: The story unfolds as beautifully formatted text chapters with customizable fonts, margins, line heights, and reading themes (Light, Sepia, Charcoal, OLED Dark).
3. **Decision Points**: At climactic or pivotal moments, the narrative pauses and presents structured options along with a **Free-Text Action Bar**.

### 2.2 The 3-Style Choice System
Choices are not random text variations. They are mapped to behavioral styles and risk profiles:

| Choice Type | Style | Risk Level | Example Action |
| :--- | :--- | :--- | :--- |
| **Option 1** | *Defensive / Diplomatic / Cautious* | Low | Prepare shield and look for an escape route |
| **Option 2** | *Tactical / Agile / Inquisitive* | Medium | Roll behind the pillar to flank the guard |
| **Option 3** | *Aggressive / Daring / High-Stakes* | High | Unleash an all-out counterattack |

### 2.3 Free-Text Actions & Plausibility
Players are not confined to the 3 choices. They can type custom actions:
- *Example*: `"I smash the oil lamp on the wooden table to create a fire wall and sprint toward the stables."`
- The system parses the action, checks against the active environment and inventory, and resolves the outcome.

### 2.4 Narrative Combat (No Turn-Based Grid)
Combat is embedded seamlessly within the prose rather than switching to an arcade battle screen.
> *"You swing your blade toward his shoulder. He recoils at the last second, but the steel catches his arm, drawing a dark crimson line as his grip on the dagger weakens."*

---

## 3. System Architecture

```
                    ┌──────────────────────────────┐       ┌──────────────────────────────┐
                    │      Flutter Mobile App      │       │     StoryForge Studio        │
                    │   (Reader + Discreet HUD)    │       │ (Next.js Web Admin & Studio) │
                    └──────────────┬───────────────┘       └──────────────┬───────────────┘
                                   │ HTTPS / SSE                          │ HTTPS / REST
                                   ▼                                      ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                Vercel Serverless & Edge API                 │
                    │               (Next.js 16 App Router / Node.js)             │
                    │                                                             │
                    │   • /api/play/*   -> Flutter Client Endpoints (SSE Stream)  │
                    │   • /api/studio/* -> Studio Admin Endpoints                 │
                    │   • /studio/*     -> Studio Web UI Dashboard                │
                    └──────────────────────────────┬──────────────────────────────┘
                                                   │
             ┌─────────────────────────────────────┼─────────────────────────────────────┐
             ▼                                     ▼                                     ▼
     ┌──────────────┐                      ┌──────────────┐                      ┌──────────────┐
     │ World Engine │                      │ Game Engine  │                      │  Validator   │
     │ (Lore/Bible) │                      │ (Dice/Stats) │                      │ (Guardrails) │
     └──────┬───────┘                      └──────┬───────┘                      └──────┬───────┘
            │                                     │                                     │
            └─────────────────────────────────────┼─────────────────────────────────────┘
                                                  ▼
                                    ┌──────────────────────────────┐
                                    │    Memory Engine (0-10)      │
                                    │ (World/Char/Story/Player/Rec)│
                                    └──────────────┬───────────────┘
                                                   │
                                                   ▼
                                    ┌──────────────────────────────┐
                                    │       AI Router Layer        │
                                    │ (Gemini 3.7 Flash/Pro Tiered)│
                                    └──────────────┬───────────────┘
                                                   │
                                     ┌─────────────┴─────────────┐
                                     ▼                           ▼
                            Gemini 3.7 Flash/Pro          Claude / OpenAI / Local
```

---

## 4. StoryForge Studio (Authoring & World-Building Admin Suite)

While end-readers interact exclusively through the Flutter reading app, **StoryForge Studio** is the visual control room for the author/creator to build, configure, test, and balance stories and worlds without editing raw JSON files by hand.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             StoryForge Studio Suite                              │
├─────────────────┬──────────────────┬──────────────────┬──────────────────────────┤
│ 🌍 World Bible  │ ⚔️ RPG Ruleset   │ 👤 NPC Dossiers  │ 🧪 AI Simulation Sandbox │
│    Builder      │    Designer      │    & Secrets     │    & Prompt Inspector    │
└─────────────────┴──────────────────┴──────────────────┴──────────────────────────┘
```

### 4.1 World Bible & Lore Graph Editor
- **Law & Constraint Manager**: Define immutable world rules (e.g. *"Dragons are extinct"*, *"Magic requires blood sacrifice"*).
- **Faction & Territory System**: Map factions, ideologies, alignments, rivalries, and controlled regions.
- **Lore Hierarchy & Timeline**: Visual timeline of historical events and geographical codices that the AI can cite.

### 4.2 RPG Ruleset & Stat Schema Designer
- **Custom Stat Matrix**: Visually add story-specific stats (e.g. *Might/Agility* vs *Logic/Perception*).
- **Resource Pools**: Configure HP, Stamina, Sanity, Credits, Mana, or Strain with min/max caps.
- **Difficulty Curve (DC) Configurator**: Set standard difficulty thresholds for actions across Low, Medium, and High risk tiers.
- **Starting Inventory & Items**: Define item databases with tags, modifiers, and descriptions.

### 4.3 NPC Dossier & Relationship Manager
- **Character Profiles**: Define background, voice/speech tone directives, goals, and hidden agendas.
- **Secret Knowledge Flags**: Mark secrets that the NPC knows or can reveal under specific conditions (e.g., Trust > 15).
- **Initial Trust & Affiliation**: Configure default player-NPC relationship scores.

### 4.4 Story & Scene Director
- **Opening Beats**: Author the foundational starting scene, initial location, and opening hooks.
- **Quest & Objective Tracker**: Define main storylines, branching milestones, and failure states.

### 4.5 AI Simulation Sandbox & Prompt Inspector
- **Test-Drive Prompts**: Run mock player choices or adversarial free-text actions against the World Bible in real-time.
- **Guardrail Testing**: Verify that the Action Validator correctly catches illegal actions (e.g. summoning prohibited creatures or using non-existent items).
- **Context & Token Inspector**: View the exact assembled prompt envelope, token count, and memory injection slots.

### 4.6 Live Playtest & Memory Inspector
- **Playthrough State Debugger**: Step through a playthrough turn-by-turn.
- **Memory Graph Inspector**: Inspect dynamic memories formed after each turn, along with their 0–10 importance scores.

---

## 5. The 4 Core Engines

### 5.1 World Engine & World Bible
The **World Bible** acts as the immutable ground truth for each universe.
- **Lore & Geography**: Continents, cities, factions, politics, technology/magic level.
- **Rules & Laws**: Immutable constraints (e.g., *"Dragons have been extinct for 300 years"*, *"Magic requires a catalyst"*).
- **Timeline & History**: Fixed historical events that NPCs can recall and reference.

### 5.2 Game Engine & Deterministic Mechanics
The Game Engine owns all state mutations, inventory management, and probabilistic calculations.
- **Stat Checks & Modifiers**:
  $$\text{Score} = \text{Base Stat} + \text{Skill Bonus} + \text{Tool / Item Modifier} + \text{Environmental Penalty} + \text{Dice Roll}$$
- **Outcome Resolution Table**:
  - $\text{Critical Failure}$: Serious setback, damage taken, or lost item.
  - $\text{Failure}$: Objective fails, new obstacle introduced.
  - $\text{Mixed Success (Success with Cost)}$: Objective met, but resource consumed or minor complication.
  - $\text{Success}$: Objective cleanly accomplished.
  - $\text{Critical Success}$: Exceptional outcome with narrative bonus or insight.
- The outcome is decided **before** invoking the AI. The AI is simply instructed on how to dramatize the result.

### 5.3 Action Validation Layer
Guards the story against hallucinations and game-breaking inputs:
```
Player Action
      ↓
[Check 1: Physical Plausibility] (Can human body/active magic perform this?)
      ↓
[Check 2: Inventory & Skill Check] (Does the player possess the required item?)
      ↓
[Check 3: World Lore Check] (Does this contradict the World Bible?)
      ↓
Result: PASS -> Game Engine | REJECT -> Narrative Immersion Correction
```

### 5.4 Multi-Tier Hierarchical Memory System

To minimize token cost and eliminate memory drift across 50+ chapters, memory is partitioned into 5 distinct tiers:

```
┌───────────────────────────────────────────────────────────┐
│ 1. World Memory     │ Static immutable lore & rules       │
├─────────────────────┼─────────────────────────────────────┤
│ 2. Character Memory │ NPC personality, trust, secrets     │
├─────────────────────┼─────────────────────────────────────┤
│ 3. Story Memory     │ Significant world events & quest log│
├─────────────────────┼─────────────────────────────────────┤
│ 4. Player Memory    │ Inventory, injuries, player choices │
├─────────────────────┼─────────────────────────────────────┤
│ 5. Recent Context   │ Last 2-3 scene paragraphs & action  │
└───────────────────────────────────────────────────────────┘
```

#### Memory Importance Scoring (0 to 10 Scale):
- **Score 0–2 (Ephemeral)**: Minor chit-chat, eating a meal $\rightarrow$ Discarded.
- **Score 3–5 (Moderate)**: Information gathering, minor barter $\rightarrow$ Decays over time.
- **Score 6–8 (Significant)**: Quest milestones, promises made, injuries $\rightarrow$ Permanent storage.
- **Score 9–10 (Critical)**: Betrayals, deaths, major discoveries $\rightarrow$ High-priority persistent injection.

---

## 6. AI Narrative Director & Prompt Assembly

The backend builds a focused, high-density context envelope for the LLM:

```
┌─────────────────────────────────────────────────────────────────┐
│                      CONTEXT ENVELOPE                           │
├─────────────────────────────────────────────────────────────────┤
│ [SYSTEM INSTRUCTION]                                            │
│ - Act as a literary author for this specific genre.             │
│ - Strict adherence to Show-Don't-Tell and atmospheric tone.    │
│ - Adhere strictly to the pre-calculated Game Engine outcome.    │
├─────────────────────────────────────────────────────────────────┤
│ [ACTIVE WORLD LAWS & RELEVANT LORE]                             │
│ - Law: Dragons are extinct. Magic is illegal in this city.      │
├─────────────────────────────────────────────────────────────────┤
│ [ACTIVE ENTITIES & NPC TRUST]                                   │
│ - NPC: Captain Rolan (Trust: +10, remembers you saved his son)  │
├─────────────────────────────────────────────────────────────────┤
│ [DETERMINISTIC GAME OUTCOME]                                    │
│ - Action: "Persuade Rolan to unlock the secret gate."           │
│ - Result: SUCCESS (Rolled 16 vs DC 14, Cunning bonus applied).  │
│ - State Mutation: Bronze Key added to Inventory, Guard alerted. │
├─────────────────────────────────────────────────────────────────┤
│ [RECENT CONTEXT & LAST SCENE SUMMARY]                           │
│ - Last beat summary and dialogue.                               │
├─────────────────────────────────────────────────────────────────┤
│ [OUTPUT DIRECTIVE]                                              │
│ - Write 250-400 words of narrative prose in selected language.   │
│ - Generate 3 distinct next choices (Low, Medium, High risk).    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Data Schemas & Definitions

### 7.1 Story Manifest (`story.json`)
```json
{
  "id": "shadow_over_solis",
  "title": "Shadow Over Solis",
  "genre": ["Sci-Fi", "Cyberpunk", "Noir"],
  "language": "en",
  "cover_image": "assets/covers/solis.webp",
  "author": "StoryForge Core",
  "rpg_schema": {
    "stats": [
      { "id": "logic", "name": "Logic", "description": "Deduction and hacking capability", "base": 12 },
      { "id": "persuasion", "name": "Persuasion", "description": "Charm, interrogation, and deceit", "base": 10 },
      { "id": "perception", "name": "Perception", "description": "Spotting clues and hidden threats", "base": 14 }
    ],
    "resources": [
      { "id": "cred", "name": "Credits", "current": 250 },
      { "id": "cyberware_strain", "name": "Neural Strain", "max": 100, "current": 15 }
    ]
  },
  "initial_location_id": "neon_alley_sector_4"
}
```

### 7.2 Playthrough Session State
```json
{
  "session_id": "sess_98a72b1c",
  "user_id": "usr_001",
  "story_id": "shadow_over_solis",
  "current_scene_id": "scene_chapter1_beat3",
  "player_state": {
    "stats": { "logic": 12, "persuasion": 10, "perception": 14 },
    "resources": { "cred": 250, "cyberware_strain": 15 },
    "inventory": [
      { "id": "encrypted_datadrive", "name": "Encrypted Datadrive", "quantity": 1 }
    ],
    "relationships": {
      "npc_detective_vance": { "trust": 15, "known_secrets": ["bribe_taken"] }
    }
  },
  "turn_count": 8
}
```

---

## 8. Client Architecture (Flutter Reader App)

### 8.1 Key UI Modules
1. **Novel Viewport**:
   - Typography settings (Custom Persian fonts e.g. Vazirmatn / Shabnam & English fonts e.g. Merriweather / Outfit).
   - Adjustable line spacing, paragraph margins, and reading themes.
   - Smooth text-streaming and paragraph fade-in effects.
2. **Discreet RPG Sheet**:
   - Slide-over drawer or non-intrusive top-status pill.
   - Shows active inventory, stats, health/resources, and tracked quest clues.
3. **Choice & Free Action Hub**:
   - 3 colored pills showing Risk & Style indicators (🛡 Defensive, 🤸 Agile, ⚔️ Aggressive).
   - "Type Your Own Action" expandable input bar.
   - Interactive 3D/2D dice-roll animation on skill checks.

---

## 9. Project Directory Structure

```
StoryForge/
├── MASTER_PLAN.md                  # Comprehensive Master Plan
├── README.md                       # Repository overview
│
├── web/                            # Next.js 15 Full-Stack App (Vercel-ready: Studio UI + Backend API)
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── src/
│   │   ├── app/                    # Next.js App Router
│   │   │   ├── (studio)/           # StoryForge Studio Admin Web Pages
│   │   │   │   ├── studio/
│   │   │   │   │   ├── worlds/     # World Bible & Lore Graph Editor
│   │   │   │   │   ├── rules/      # RPG Stats, Resources & DC Tables
│   │   │   │   │   ├── npcs/       # NPC Dossier & Secrets Manager
│   │   │   │   │   ├── sandbox/    # AI Prompt Inspector & Guardrail Tester
│   │   │   │   │   └── playtest/   # Real-time Memory & State Debugger
│   │   │   │   └── layout.tsx
│   │   │   └── api/                # Vercel Serverless / Edge API Route Handlers
│   │   │       ├── play/           # Endpoints for Flutter Reader App
│   │   │       │   ├── stories/    # GET /api/play/stories (Library catalog)
│   │   │       │   ├── session/    # POST /api/play/session (Start playthrough)
│   │   │       │   └── action/     # POST /api/play/action (Stream narrative via SSE)
│   │   │       └── studio/         # Admin endpoints for World Bible CRUD
│   │   │
│   │   ├── lib/
│   │   │   ├── engines/            # Core Engine Modules
│   │   │   │   ├── world/          # World Bible parser & Lore entity graph
│   │   │   │   ├── game/           # Stat checks, DC calculator, Dice engine
│   │   │   │   ├── validator/      # Free-text plausibility & safety validator
│   │   │   │   ├── memory/         # Importance scorer (0-10), retriever & extractor
│   │   │   │   └── narrative/      # Prompt template assembler & AI context envelope
│   │   │   ├── providers/          # LLM Adapters (Gemini 3.7 / 3.6 / 3.5 via Vercel AI SDK / Google GenAI)
│   │   │   └── db/                 # Serverless DB client (Prisma / Drizzle with Neon/Supabase)
│   │   └── content/                # Built-in Story World Bibles & Schemas (JSON/YAML)
│   └── tests/
│
├── app/                            # Flutter Cross-Platform Reader Client (iOS, Android, Web/Desktop)
│   ├── pubspec.yaml
│   ├── lib/
│   │   ├── core/                   # E-reader design system, themes, bilingual fonts
│   │   ├── features/
│   │   │   ├── library/            # Story catalog & detail screens
│   │   │   ├── reader/             # Text viewport, streaming view
│   │   │   ├── rpg_hud/            # Character sheet, inventory, quest tracker
│   │   │   ├── choices/            # Choice pills, free-text bar, dice animation
│   │   │   └── session/            # Session state management (Riverpod)
│   │   └── main.dart
│   └── test/
│
└── docs/                           # Schemas, World Bible guides, and prompt documentation
```

---

## 10. Development Roadmap & Milestones

### Phase 1: Domain Foundation & Deterministic Mechanics
- [ ] Define Story Manifest & World Bible JSON/YAML schemas.
- [ ] Implement deterministic Game Engine (Stats, Modifiers, DC table, Dice roller, Inventory/Resource Reducer).
- [ ] Write unit tests to guarantee 100% deterministic state mutation independent of LLM outputs.

### Phase 2: StoryForge Studio (Admin & World-Building Suite)
- [ ] Build Studio Web Dashboard (World Bible Builder, Faction & Timeline Editor).
- [ ] Implement RPG Ruleset & Stat Schema Visual Configurator.
- [ ] Build NPC Dossier & Secret Knowledge Manager.
- [ ] Implement Prompt & Guardrail Simulation Sandbox.

### Phase 3: Memory Hierarchy, Guardrails & AI Pipeline
- [ ] Implement Action Validator (Rule checker & physical sanity check).
- [ ] Implement Hierarchical Memory Manager (Importance scoring 0–10, dynamic post-scene memory extraction).
- [ ] Build Prompt Context Assembler with Gemini 3.7 integration and structured output parsing.

### Phase 4: Backend API & Persistence
- [ ] Build Fastify backend API for story library, session creation, turn processing, and narrative streaming.
- [ ] Connect Studio Admin APIs for live World Bible persistence.
- [ ] Persist session states, playthrough logs, and dynamic memories in SQLite / PostgreSQL.

### Phase 5: Flutter Reader Client
- [ ] Implement reader interface with custom typography, bilingual RTL/LTR support, and themes.
- [ ] Build collapsible RPG character sheet & HUD.
- [ ] Implement 3-style choice selector, free-text action box, and dice roll animations.

### Phase 6: Pilot Stories & End-to-End Polish
- [ ] Author Pilot Story 1 using StoryForge Studio: *The Obsidian Citadel* (Dark Fantasy).
- [ ] Author Pilot Story 2 using StoryForge Studio: *Neon Requiem* (Cyberpunk Detective).
- [ ] Stress-test continuity, memory recall across 25+ turns, and anti-hallucination guardrails.

