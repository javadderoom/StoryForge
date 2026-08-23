# StoryForge — AI World-Building System Specification

> **Architectural Specification & Module Blueprint**  
> *Enhancing authoring workflows with deeply connected, consistent, and literary AI co-pilots across every section of StoryForge Studio.*

---

## 📖 1. Vision & Core Principles

StoryForge is built on the **Story First, World Before Narrative** doctrine:
> *"The player can change the story, but cannot change the rules of the world without a reason."*

In StoryForge Studio, AI is not a generic text generator, but a **Master Lore Architect and World-Building Co-Pilot**. Every AI generation tool must satisfy four core principles:

1. **Deterministic Lore Anchoring**: New entities must tie directly to existing factions, historical eras, laws, or deities rather than floating as disconnected tropes.
2. **Uniqueness & Anti-Cloning**: The AI must cross-reference existing entities to prevent repetitive naming patterns, recycled concepts, or near-clones.
3. **Contradiction-Free Consistency**: Every generated law, relic, or creature must respect established immutable world laws (e.g. magic limitations, extinct species).
4. **Bilingual Literary Quality**: Native, high-register prose and atmospheric tone in both Persian (Farsi) and English with zero generic clichés.

---

## 🏛️ 2. Studio Module Specifications

```
                               ┌────────────────────────────────────────────────┐
                               │           StoryForge Studio Suite              │
                               └───────────────────────┬────────────────────────┘
                                                       │
         ┌───────────────────┬───────────────────┼───────────────────┬───────────────────┐
         ▼                   ▼                   ▼                   ▼                   ▼
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │ World Bible │     │ Locations   │     │ NPCs & Web  │     │ Relics &    │     │ Bestiary &  │
  │ & Cosmology │     │ & Geography │     │ of Drama    │     │ Artifacts   │     │ Fauna/Flora │
  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
         │                   │                   │                   │                   │
         ▼                   ▼                   ▼                   ▼                   ▼
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │ Religions   │     │ Historical  │     │ RPG Ruleset │     │ Story Beats │     │ Global AI   │
  │ & Deities   │     │ Timeline    │     │ & Mechanics │     │ & Plot Tree │     │ Assistant   │
  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

### 2.1 🌌 Global World Bible & Cosmology (`/studio/world`)

#### A. "Genesis Generator" (One-Click Seed-to-Cosmos)
* **Goal**: Enable an author to turn a single concept prompt into a coherent starter universe in seconds.
* **Input**: A high-concept premise (e.g., *"A sunless archipelago where memory is currency and the tides are made of black mercury"*).
* **AI Output**:
  * **World Name & Synopsis**: Atmospheric title, tagline, and philosophical theme notes.
  * **4 Immutable World Laws**: Fundamental physics, magical costs, or cosmic taboos.
  * **3 Interconnected Factions**: Rival groups with conflicting ideologies, leaders, and secrets.
  * **4 Key Locations**: Capital citadel, dangerous wilderness, sacred sanctuary, and forbidden zone.
  * **2 Deities / Cosmic Powers**: One dominant orthodox faith, one outlawed mystery cult.
  * **1 Central Campaign Mystery**: The core tension driving the narrative.

#### B. "Contradiction Radar" (World Lore Consistency Auditor)
* **Goal**: Continuously scan all world entities to detect plot holes, logic discrepancies, or canon violations before narrative generation.
* **Audit Checks**:
  * *Law vs. Relic/Magic*: Checks if an artifact grants power forbidden by world laws.
  * *Timeline vs. Faction*: Checks if a faction leader exists before their faction's founding date.
  * *Religion vs. NPC*: Flags NPC affiliations with deities that are strictly hostile to their faction.
  * *Species vs. Bestiary*: Checks if extinct species are placed in active location encounters.
* **UI Presentation**: Real-time diagnostic panel with severity tags (`ERROR`, `WARNING`, `LORE ADVICE`) and one-click AI resolution suggestions.

#### C. Thematic Style & Tone Presets
* **Global Tone Filters**: *Grimdark Gothic, Mythic Persian Epic, Eldritch Cosmic Horror, Steampunk Political Intrigue, High-Stakes Detective Noir*.
* Automatically injects vocabulary, stylistic constraints, and narrative cadence into all downstream generation prompts.

---

### 2.2 🏰 World Geography & Locations (`/studio/locations`)

#### A. Hierarchical Sub-Zone & Dungeon Spawner
* **Goal**: Instantly flesh out complex parent regions into exploreable sub-locations.
* **Workflow**: Select a location (e.g., *The Obsidian Citadel*) $\rightarrow$ click **"Generate Sub-Zones"** $\rightarrow$ AI generates 3–5 interconnected areas:
  * *The Inquisitor's Sunken Vault* (Dungeon / High Danger)
  * *The Whispering Armory* (Sanctuary / Secret Cache)
  * *The Scaffolds of the Deserters* (Ruin / Combat Encounter)

#### B. Points of Interest (POIs) & Environmental Hazards
* Auto-generates interactive objects within the location:
  * **Interactive Objects**: Ancient levers, locked reliquaries, stained-glass lore murals.
  * **Skill Check Gates**: DC targets for *Perception, Athletics, Arcana, or Thieves' Tools*.
  * **Dynamic Hazards**: Toxic miasma, collapsing scaffolding, magical dampening zones.

#### C. Travel Route & Danger Topology
* AI calculates route descriptions between regions, suggesting travel hazards, waypoints, and encounter probabilities based on connected danger levels.

---

### 2.3 👥 NPCs & Social Drama Web (`/studio/npcs`)

#### A. Interpersonal Relationship Web Synthesizer
* **Goal**: Transform isolated NPC sheets into an interconnected web of social intrigue.
* **Mechanic**: Given a target NPC, AI generates relationships to existing characters:
  * *Relationship Types*: `Blood Debt`, `Secret Romance`, `Master & Renegade Apprentice`, `Blackmail Target`, `Co-Conspirator`.
  * *Conflict Hooks*: Immediate dramatic catalysts (e.g., *"Garrison Captain knows Lady Vesper poisoned the previous lord, but stays silent because she holds his son hostage"*).

#### B. Voice & Dialogue Style Guide Generator
* Produces actionable guidance for the AI Narrative Director:
  * **Speech Quirks & Dialects**: Arrogant courtly diction, guttural miner slang, whispered riddles.
  * **Negotiation Triggers**: What makes this NPC fold, bargain, or draw steel.
  * **Psychological Breaking Point**: How the character reacts under extreme torture, grief, or bribery.

#### C. Lore-to-RPG Stat Auto-Calibration
* Automatically aligns NPC stats, health, and equipment with the story's custom RPG schema and character lore rank (Novice, Veteran, Elite, Mythic Boss).

---

### 2.4 ⏳ Historical Eras & Chronicle Timeline (`/studio/timeline`)

#### A. Epoch Arc Generator (3-Era History Synthesizer)
* Generates a coherent macro-history for the world:
  1. **Era 1: Age of Myth / Creation**: Origin of magic, primordial deities, first empire.
  2. **Era 2: The Cataclysm / Great Schism**: World-shattering war, celestial fall, or technological collapse.
  3. **Era 3: The Ash Age / Present Era**: Fragile peace, rise of current factions, active campaign setting.

#### B. Historical "Ripple Effects" Propagator
* Modifying an ancient timeline event prompts the AI to suggest logical reverberations across the present:
  * Modern factions that trace their origin to the event.
  * Ruined locations created during the war.
  * Cursed artifacts left behind as relics.

---

### 2.5 ⚔️ Mythic Relics & Arcane Artifacts (`/studio/artifacts`)

#### A. Double-Edged Curses & Lore Attunements
* Avoids flat stat sticks by generating dramatic, high-stakes trade-offs:
  * *Example*: *"The Ashen Veil grants absolute invisibility to the living, but causes spirits of the restless dead to relentlessly pursue the wielder."*
  * Mechanical triggers tied directly to RPG resources (sanity drain, HP burn, luck decay).

#### B. Origin, Vault & Quest Hook Synthesizer
* Automatically answers 4 narrative questions for every relic:
  1. Who originally crafted or discovered it?
  2. Where is it currently hidden or locked?
  3. What riddle, key, or blood sacrifice unseals its vault?
  4. Which competing factions or bosses are actively searching for it?

---

### 2.6 🐉 Bestiary & Ecological Systems (`/studio/bestiary`)

#### A. Food Chain Dynamics & Non-Combat Pacification
* Detailed behavioral ecology for creatures:
  * Natural predators and prey relationships.
  * Territorial nesting and hunting habits.
  * **Non-Lethal Solutions**: Pheromone bait, musical frequencies, mirrored light distractions, or sacred offerings.

#### B. Alchemical Harvest & Crafting Yields
* Specifies exact anatomical parts, harvested reagents, and crafting recipes:
  * *Example*: Harvesting an *Ashen Wyrm* yields `Wyrm Bile` (fire resistance draughts) and `Basalt Scale` (fire-forged armor plating).

---

### 2.7 🔮 Pantheons, Deities & Faiths (`/studio/religions`)

#### A. Divine Dogmas, Sacred Taboos & Intervention Triggers
* **Taboos**: Concrete actions forbidden by the deity (e.g., *"Never spill noble blood upon sacred soil"*).
* **Divine Omen / Retribution**: Specific narrative and mechanical penalties for taboos broken during gameplay.
* **Blessings**: Temporary or permanent condition buffs granted to pious characters.

#### B. Sectarian Schisms & Holy War Engine
* Generates heresy factions, radical monastic orders, and theological rivalries between competing gods.

---

### 2.8 🎲 Story-Specific RPG Mechanics (`/studio/rpg`)

#### A. Theme-to-RPG System Synthesizer
* Derives an entire RPG mechanics sheet directly from the story's theme and World Bible:
  * *Cosmic Horror*: Attributes $\rightarrow$ `Sanity`, `Perception`, `Occultism`, `Grit`.
  * *Political Intrigue*: Attributes $\rightarrow$ `Eloquence`, `Guile`, `Lineage`, `Insight`.
  * *Grimdark Fantasy*: Attributes $\rightarrow$ `Might`, `Agility`, `Blood Purity`, `Resolve`.

#### B. Archetype & Background Trait Generator
* Synthesizes 4 distinct player starting classes with custom equipment kits, signature perks, and unique narrative dialogue options.

---

### 2.9 🎭 Branching Story Beats & Encounter Design (`/studio/beats`)

#### A. 3-Act Branching Plot Tree Generator
* Generates a multi-node scene graph with escalating stakes, pivotal choice forks, DC skill check gates, and multiple victory/loss branches.

#### B. 3-Style Choice Auto-Balancer
* For any generated or authored scene, automatically constructs the 3 core player choices:
  1. **Cautious / Diplomatic** (Low Risk $\rightarrow$ gathers info, conserves resources).
  2. **Tactical / Agile** (Medium Risk $\rightarrow$ positional advantage, moderate DC check).
  3. **Aggressive / High-Stakes** (High Risk $\rightarrow$ maximum danger, lethal DC check, massive reward).

---

### 2.10 ⚡ Cross-Studio Global AI Utilities

#### A. Contextual Floating AI Assistant Drawer ("The Oracle")
* A persistent, collapsible sidebar available across all Studio pages that is always aware of the active story, open tab, and selected entity.
* Supports contextual quick-actions:
  * *"Expand this NPC's secret into a quest line"*
  * *"Critique this location for world law inconsistencies"*
  * *"Translate and elevate this prose into high literary Persian/English"*

#### B. "Populate Location" Micro-Ecosystem Macro
* A single-click macro on any Location page that generates a synchronized micro-package:
  * 2 Relevant NPCs (e.g. Master Smith + Mysterious Outcast).
  * 1 Local Creature/Beast (native to the location's biome).
  * 1 Hidden Relic or Quest Item.

#### C. Smart `@mentions` Autocompletion & Cross-Linking
* Typing `@` inside any description field displays a dropdown of all registered entities (NPCs, Factions, Relics, Places), linking them in the underlying Lore Graph.

---

### 2.11 🧙‍♂️ The AI World-Building Adviser & Oracle Suite (`/studio/chat`)

The **AI Adviser (مشاور جهان‌سازی)** is the core conversational thinking partner for authors, capable of both deep lore brainstorming and executing structured real-time mutations to the World Bible.

#### A. Multi-Persona Advisory Modes
The author can toggle specialized advisory personas to fit their creative need:
1. **The Lore Inquisitor (منتقد سخت‌گیر)**:
   * Aggressively audits logic, challenges unearned stakes, and hunts down continuity paradoxes or power-scaling breaks.
2. **The Story Weaver (طراح درام و گره‌افکنی)**:
   * Proposes dramatic interpersonal conflict hooks, betrayal catalysts, and tragic character arcs.
3. **The Grand Cosmologist (معمار کیهان و قوانین)**:
   * Ensures metaphysical consistency, magic costs, divine pantheon balance, and era-scale historical logic.
4. **The Literary Stylist (ویرایشگر ادبی)**:
   * Polishes names, titles, flavor text, and lore entries into evocative, high-register prose in Persian or English.

#### B. Conversational World Mutation (`storyforge-action`)
* The Adviser does not merely chat; it executes real-time database/state operations via structured protocol blocks:
  * **Create**: Generates a new fully-formed entity (NPC, Faction, Deity, Relic, Location) tailored to the conversation.
  * **Update**: Surgically modifies existing entities by name without duplicating entries or wiping fields.
  * **Delete**: Removes obsolete entities while warning if orphaned references exist.
* **Diff Preview & Confirmation**: Authors can inspect the proposed changes before accepting or reverting.

#### C. Proactive Lore Gap & Orphan Entity Detection
* The Adviser scans the active world and surfaces proactive advisory recommendations:
  * *"You have 5 factions, but only 2 have defined leadership figures."*
  * *"The 'Basalt Spire' location has danger level 5 but no assigned bestiary threats."*
  * *"Era 2 'The Sundering' has no surviving relics recorded in the Mythic Vault."*

#### D. Tab-Aware Entity Focus & Surgical Refinement
* When opened alongside an active entity (e.g., editing a specific NPC or Deity), the Adviser receives the complete entity payload as immediate working memory, enabling targeted commands like:
  * *"Give this NPC 3 conflicting secrets they would kill to protect."*
  * *"Add a third taboo to this deity that directly conflicts with the Crimson Court faction."*


---

## 🛠️ 3. Generation Action Protocol

Studio AI operations use structured command blocks that the Studio UI parses and executes:

```storyforge-action
{
  "op": "create" | "update" | "delete" | "audit" | "batch",
  "entity": "faction" | "location" | "npc" | "artifact" | "creature" | "deity" | "timeline_event" | "world_law" | "rpg_system" | "scene",
  "anchor": "<optional existing entity name to tie lore to>",
  "match": {
    "byName": "<existing entity name for updates/deletions>"
  },
  "prompt": "<full structured instruction or delta payload>"
}
```

---

## 📅 4. Implementation Phasing & Detailed Execution Plans

For exhaustive technical blueprints, Zod schemas, prompt templates, and UI component architectures, refer to the dedicated plan documents:

| Phase | Milestone | Execution Plan Document | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Core Genesis & Advisory** | 📘 **[Plan 01: World Genesis & Lore Auditor](file:///g:/Code/StoryForge/docs/plans/01_WORLD_GENESIS_AND_AUDITOR_PLAN.md)** | Seed-to-Cosmos Genesis Generator, Contradiction Radar in `/studio/world`. |
| **Phase 1 & 5** | **AI Adviser & Oracle** | 🧙‍♂️ **[Plan 02: AI Adviser & Oracle Suite](file:///g:/Code/StoryForge/docs/plans/02_AI_ADVISER_AND_ORACLE_PLAN.md)** | Multi-Persona Advisory Council, `storyforge-action` Protocol, Visual Diff Previews in `/studio/chat`. |
| **Phase 2** | **Ecosystem & Geography** | 🏰 **[Plan 03: Locations & Sub-Zones](file:///g:/Code/StoryForge/docs/plans/03_LOCATIONS_AND_ECOSYSTEM_PLAN.md)** | Sub-Zone Dungeon Spawner, "Populate Location" Macro, POI generator in `/studio/locations`. |
| **Phase 3** | **Social Intrigue & Web** | 👥 **[Plan 04: NPCs & Social Drama](file:///g:/Code/StoryForge/docs/plans/04_NPCS_AND_SOCIAL_DRAMA_PLAN.md)** | Interpersonal Relationship Web Synthesizer, Dialogue Style Guides in `/studio/npcs`. |
| **Phase 4** | **Deep Lore Vaults** | ⚔️ **[Plan 05: Chronicles, Relics, Bestiary & Religions](file:///g:/Code/StoryForge/docs/plans/05_CHRONICLES_RELICS_BESTIARY_RELIGIONS_PLAN.md)** | 3-Era Epoch Arc, Double-Edged Curses, Ecology/Alchemical Yields, Divine Taboos. |
| **Phase 5** | **RPG, Beats & Global UX** | 🎲 **[Plan 06: RPG, Branching Beats & Studio Oracle](file:///g:/Code/StoryForge/docs/plans/06_RPG_AND_BRANCHING_BEATS_PLAN.md)** | Theme-to-RPG Synthesizer, 3-Act Plot Tree & Choice Balancer, Floating Oracle Drawer, `@mentions`. |

> 🗺️ **Master Plan Overview**: [docs/plans/AI_SYSTEM_UPGRADE_MASTER_PLAN.md](file:///g:/Code/StoryForge/docs/plans/AI_SYSTEM_UPGRADE_MASTER_PLAN.md)


