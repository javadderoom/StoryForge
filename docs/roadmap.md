# StoryForge — Feature Roadmap & Architecture Milestones

This document outlines the upcoming feature roadmap and planned capabilities for the StoryForge platform across both the Flutter Reader Client and the Next.js Studio & Engine Backend.

---

## 🗺️ High-Level Feature Roadmap

### 1. 📜 Full-Page RPG Character & Realm Compendium
* **Beyond the HUD Drawer**: Evolve the sidebar HUD into a full-screen, tabbed Character & Realm Compendium with rich fantasy aesthetics:
  * **Hero Sheet**: Attribute modifiers, dynamic stat allocations, health/stamina/mana meters, and visual paperdoll equipment slots.
  * **Inventory & Stash**: Categorized inventory grid (Weapons, Armor, Consumables, Quest Relics, Books) with detailed inspect sheets.
  * **NPCs & Factions Dossier**: Track known characters, dynamic trust affinity meters, unlocked secrets, and faction standing.
  * **Quest Journal & Chronicle**: Active main/side objectives, completed milestones, and player journal entries.
  * **World Codex & Discovered Lore**: Interactive map of discovered locations, historical records, and creature bestiary.

---

### 2. 🎭 Interactive Character Creation & Archetypes
* **Prologue Character Setup**: Choose or customize character archetypes (*Shadowblade, Arcane Scholar, Silver-Tongued Diplomat, Iron Vanguard*) when starting a story.
* **Point Allocation & Background Traits**: Allocate initial stat points and choose personality backgrounds that unlock unique narrative choice branches.
* **Progression & Leveling**: Gain experience from skill checks and quest completions to unlock new perks and abilities.

---

### 3. 🔊 Ambient Soundscapes & Physical Audio Feedback
* **Adaptive Soundscapes**: Dynamic background audio that shifts based on scene atmosphere (howling wind in the citadel, bustling tavern, dripping catacombs).
* **Tactile Audio**: Crisp sound effects for D20 dice rolling, critical hits, potion consumption, and parchment page turns.

---

### 4. 🏛️ StoryForge Web Authoring Studio Suite
* **Visual World Bible Editor**: Graph-based node editor for locations, NPCs, factions, and immutable world laws.
* **Branching Story Beats**: Visual scene tree showing possible story paths, choice branches, and DC checkpoints.
* **AI Director Sandbox**: Test narrative prompts, verify action guardrails, and calibrate Gemini responses in real-time.
* **World Ontology & Custom Type Registry**: Dynamic taxonomy manager for custom relation types, place biomes, law classifications, and NPC roles.

---

### 5. 🌍 Deep World-Building & Lore Engine (New Target Goals)
* 📖 **[Detailed AI World-Building Architecture Spec](file:///g:/Code/StoryForge/docs/AI_WORLDBUILDING_SPEC.md)**
* **⏳ Historical Eras & Interactive Timeline (`/studio/timeline`)**:
  * Visual chronological timeline editor for world history, ancient wars, cosmic catastrophes, and historical schisms.
  * Era-based lore injection into AI prompts and history/arcana skill check resolutions.
* **⚔️ Mythic Relics & Ancient Artifacts Catalog**:
  * Structured registry for legendary weapons, arcane tomes, and cursed relics with origin lore, attunement rules, and location/vault holders.
* **🐉 Bestiary & Native Flora/Fauna Catalog**:
  * Regional monster and creature dossiers with habitat locations, behavioral tactics, elemental weaknesses, and alchemical loot.
* **🔮 Pantheons, Deities & Faith Systems**:
  * Modeling cosmic deities, religious dogmas, sacred taboos, divine blessings, and heretical cults that influence faction standing and NPC morals.
* **👥 NPC-to-NPC Interpersonal Relationship Web**:
  * Visualizing and tracking direct character-to-character bonds (*Blood Debt, Master & Apprentice, Secret Romance, Blood Feud, Blackmail*) to power dramatic narrative betrayal and alliance mechanics.
* **🪄 AI World-Building Co-Pilot & Studio Upgrades**:
  * *Seed-to-Cosmos Genesis Generator* and *Contradiction Radar (Consistency Auditor)* in `/studio/world`.
  * *Sub-Zone & Dungeon Spawner* and *"Populate Location" Ecosystem Macro* in `/studio/locations`.
  * *Dialogue Style Guides & RPG Stat Alignment* in `/studio/npcs`.
  * *Theme-to-RPG System Synthesizer* in `/studio/rpg`.
  * *3-Act Branching Plot Tree & Choice Balancer* in `/studio/beats`.
  * *Contextual Floating AI Assistant Drawer ("The Oracle")* across all studio pages.

---

### 6. ⚔️ High-Stakes Tactical Combat Mode (Deferred / Future Milestone)
* **Encounter Mode**: Dedicated turn-based encounter interface for boss battles and combat beats.
* **Maneuver Options**: Offensive strikes, defensive parries, spellcasting, and tactical item consumption.
* **Dynamic Enemy AI**: Enemy intent indicators, armor/health tracking, and deterministic dice resolution.

---

### 7. 🛡️ Narrative Consistency Hardening (Next Engineering Priority)
* 📖 **[Full Audit & Implementation Plan](file:///g:/Code/StoryForge/docs/plans/08_CONSISTENCY_HARDENING_PLAN.md)**
* Stop canon corruption: no silent mock-fallback persistence, post-validate AI choices/memories against the active RPG schema.
* Server-authoritative PlayerState; write the Living World State Ledger at play time.
* Implement the spec'd "World Lore Check" action guardrail and LoreAuditor v2 (saga graph, duplicate names, cross-vault references).



