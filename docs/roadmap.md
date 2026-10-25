# AfsanehSaz — Feature Roadmap & Architecture Milestones

This document outlines the upcoming feature roadmap and planned capabilities for the AfsanehSaz platform across both the Flutter Reader Client and the Next.js Studio & Engine Backend.

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

### 4. 🏛️ AfsanehSaz Web Authoring Studio Suite
* **Visual World Bible Editor**: Graph-based node editor for locations, NPCs, factions, and immutable world laws.
* **Branching Story Beats**: Visual scene tree showing possible story paths, choice branches, and DC checkpoints.
* **AI Director Sandbox**: Test narrative prompts, verify action guardrails, and calibrate Gemini responses in real-time.
* **World Ontology & Custom Type Registry**: Dynamic taxonomy manager for custom relation types, place biomes, law classifications, and NPC roles.

---

### 5. 🌍 Deep World-Building & Lore Engine (New Target Goals)
* 📖 **[Detailed AI World-Building Architecture Spec](file:///g:/Code/AfsanehSaz/docs/AI_WORLDBUILDING_SPEC.md)**
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
* 📖 **[Full Audit & Implementation Plan](file:///docs/plans/08_CONSISTENCY_HARDENING_PLAN.md)**
* Stop canon corruption: no silent mock-fallback persistence, post-validate AI choices/memories against the active RPG schema.
* Server-authoritative PlayerState; write the Living World State Ledger at play time.
* Implement the spec'd "World Lore Check" action guardrail and LoreAuditor v2 (saga graph, duplicate names, cross-vault references).

---

### 8. 🤖 Autonomous Dual-Agent World Forge (Plan 09)
* 📖 **[Autonomous Dual-Agent World Forge Specification](plans/09_AUTONOMOUS_DUAL_AGENT_WORLD_FORGE_PLAN.md)**
* **Architect & Auditor Loop**: Delegating studio administration to collaborating AI agents (Generator + Critic / Admin Proxy).
* **6-Phase Pipeline**: Genesis Lore → Geography Tree → Society & Cast → Drama Web → Mechanics & Voice → Epic Saga Arc.

---

### 9. 🔍 System & Gameplay Audit & Remediation (Plan 10)
* 📖 **[Full System & Gameplay Audit Specification](SYSTEM_AND_GAMEPLAY_AUDIT.md)**
* **Core Fixes**:
  * Pass `sessionId` in Flutter `GameApiService.sendAction` and patch equipment mutations to server.
  * Dynamically resolve primary health/stamina resource IDs in `GameEngine` and implement death/defeat at 0 HP.
  * Connect `WorldArtifact` to `GameItem` with mechanical stat bonuses, UI equipment slots, and verb-filtered action validation.
  * Implement positive `trustDelta` awards for social and diplomatic successes.
  * Populate Zarrin Pol (`story_mt4ofllt`) Archetypes, Backgrounds, and character-driven Prologue starting scenes.

### 10. 🗺️ World Cartographer Truth Audit & Remediation
* 📖 **[World Cartographer Truth Audit](CARTOGRAPHER_TRUTH_AUDIT.md)**
* **Core Fixes**:
  * Make the "AI Cartographer Oracle" a real generation route (or relabel it — it currently fakes AI with `Math.random()` and claims otherwise).
  * Render every terrain type the tools create (`valley`, `peak`, `canyon`, `oasis`) and delete the dead layer toggles (`valleys`, `timeline`, `factionBorders`).
  * Wire `settings.theme` to the renderer, give the travel ruler a distance/days readout, and render the seed terrain on open.
  * ✅ **Delivered:** undo/redo for every Cartographer action (`Ctrl+Z` / `Ctrl+Shift+Z`, plus header buttons) with field-level merge semantics.

### 11. 📱 Generative Webtoon & LitRPG Reader Integration
* 📖 **[Competitive UX Analysis & LitRPG Webtoon Integration](COMPETITIVE_ANALYSIS_AND_LITRPG_WEBTOON_INTEGRATION.md)**
* **Core Capabilities**:
  * Inline LitRPG "System Window" cards with animated HP/MP gauges and real-time XP counters ($0/100 \to 80/100$).
  * Floating resource feedback pills (`-120 MP`, `+80 XP`, `[Unique Skill: Active]`) directly inside the narrative stream.
  * Episodic visual beat generation (Webtoon mode): embedding scene illustrations dynamically between dramatic beats.
  * Concentric danger ring zoning on the Cartographer canvas and in regional lore checks.
  * Action-first input bar (`"What do you do?"`) with markdown action shortcuts, slash commands, and one-tap voice reading.

### 12. 🏰 Illuminated Manuscript Cartography & Natural Landforms Engine (Plan 27)
* 📖 **[Plan 27: Cartographer Reference Fidelity & Natural Landforms Engine](plans/27_CARTOGRAPHER_REFERENCE_FIDELITY_AND_NATURAL_LANDFORMS_PLAN.md)**
* **Target Reference**: Hand-inked illuminated fantasy manuscript map of *FARAVAND* (`docs/images/reference_faravand_map.jpg`).
* **Delivered Capabilities (Phases A, B, C)**:
  * ✅ **Direct Vertex Anchor Reshaping**: Interactive white vertex circular handles on rivers, mountain ridges, and polygon biomes; midpoint `+` insertion handles; keyboard deletion (`Delete`/`Backspace`); real-time Catmull-Rom spline recalculation at 60 FPS.
  * ✅ **8-Point Bounding Box Transform Gizmo**: Uniform/non-uniform scale handles + top rotation arm with 360° centroid rotation; dual-mode interaction (transform bounding box on single click, vertex reshaping on double click).
  * ✅ **Civil Infrastructure & Bridge Crossings**: Procedural stone masonry bridge generation (`bridgeGenerator.ts`, `bridgeRenderer.ts`) with under-deck parchment masking, flared riverbank abutments, cutwater piers in the water channel with downstream wake ripples, and automatic snapping for *Zarrin-Pol* (`loc_mtr1h3jy_8dv6`).
  * ✅ **Hydrology V2 River Delta Engine**: Branching distributary fans (`deltaGenerator.ts`), discharge-weighted channel widths, alluvial silt/sandbar islands with manuscript hatching, and Studio Inspector delta controls.
* **Upcoming Milestones (Phases D & E)**:
  * ⏳ **Specialized Biomes**: Voronoi salt crust playa for *Sepidchal*, sinuous barchan dune fields for *Hiram Steppe*, and continuous forest canopy massing (*Jangal-e Shabnam*).
  * ⏳ **Shoreline Waterlining**: Concentric multi-ring wave contours hugging coastlines and inland lakes.
  * ⏳ **Typography & Manuscript Furniture**: Spline-aligned curved typography, nautical compass rose, world title cartouche, and dual-unit scale bar.


