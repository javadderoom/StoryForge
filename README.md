# StoryForge — Interactive RPG Novel

An AI-powered interactive RPG novel platform where readers make high-stakes choices and input free-text actions while the underlying world maintains strict lore, continuity, and deterministic RPG state consistency.

> **"The player can change the story, but cannot change the rules of the world without a reason."**

---

## 📖 Documentation & Architecture
 
 * 🚀 **[Run Guide (Local Setup)](file:///g:/Code/StoryForge/docs/run.md)**
 * 🗺️ **[Feature Roadmap & Milestones](file:///g:/Code/StoryForge/docs/roadmap.md)**
 * 🪄 **[AI World-Building Architecture Spec](file:///g:/Code/StoryForge/docs/AI_WORLDBUILDING_SPEC.md)**
 * 🏛️ **[Master Plan & Technical Spec](file:///g:/Code/StoryForge/docs/MASTER_PLAN.md)**


---

## 🏛️ Core Engines Overview

1. **World Engine (World Bible)**: Immutable laws, timeline, factions, and lore defined prior to narrative generation.
2. **Game Engine**: Deterministic stat calculations, DC resolution, dice rolls, and state mutations (AI is narrator, not game engine).
3. **Action Validator**: Multi-tier plausibility check ensuring free-text player actions respect physics, inventory, and world lore.
4. **Hierarchical Memory (0–10 Importance)**: Segmented memory (World, Character, Story, Player, Recent Context) preventing memory drift across long campaigns.
5. **Flutter Reader App**: Reader-first typography with discreet RPG HUD, 3-risk-tier choices, and interactive dice rolls.