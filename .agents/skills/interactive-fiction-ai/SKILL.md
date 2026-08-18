---
name: interactive-fiction-ai
description: Principles and algorithms for AI-powered interactive fiction, World Bible lore consistency, deterministic RPG engine mechanics, and hierarchical memory retrieval.
---

# Interactive Fiction & AI Narrative Architecture

This skill defines the mathematical, structural, and prompt engineering principles for **StoryForge**.

## 1. Golden Law: AI Is Narrator, Not Game Engine
- Never ask the LLM to decide HP deductions, dice rolls, or inventory updates.
- All state calculations run **deterministically** before prompt generation:
  $$\text{Check Result} = \text{Dice Roll} + \text{Stat Mod} + \text{Skill Mod} + \text{Env Mod} \ge \text{DC}$$
- The LLM receives the pre-calculated outcome and dramatizes it in literary prose.

## 2. Action Validation Guardrail Pipeline
Before sending a free-text action to the Game Engine:
1. **Physical Feasibility**: Is the action plausible given human anatomy and known world physics/magic?
2. **Inventory Verification**: Does the character have the physical item in their current inventory?
3. **World Lore Consistency**: Does the action violate any immutable rules in the World Bible?
4. **Knowledge Boundary**: Is the player attempting to act on secrets their character hasn't discovered?

If invalid, return an immersion-preserving refusal or guidance without breaking character.

## 3. Hierarchical Memory Management (0–10 Scoring)
- **World Memory**: Static laws, faction goals, timeline. (Permanent)
- **Character Memory**: NPC trust, relationship scores, promises. (Entity-scoped)
- **Story Memory**: Major plot milestones and faction wars. (Permanent dynamic)
- **Player Memory**: Active status, inventory, injuries, decisions. (State-driven)
- **Recent Context**: Last 2–3 scene paragraphs. (Sliding window)

### Importance Scoring Rules:
- **0–2**: Discarded from long-term memory.
- **3–5**: Minor detail (decays).
- **6–8**: Significant story/relationship turn (stored in vector/graph DB).
- **9–10**: World-altering or critical event (pinned in prompt context).

## 4. Structured Output Format
Always instruct the AI to generate structured outputs containing:
1. `narrative`: 200–350 words of rich literary prose (atmospheric, Show-Don't-Tell).
2. `choices`: Exactly 3 contextual choices classified by risk (Low, Medium, High) and style (Defensive, Agile, Aggressive, etc.).
