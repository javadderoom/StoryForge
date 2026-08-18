import { WorkingContextEnvelope } from '@/lib/types/memory';

export interface GenerationPromptPayload {
  systemPrompt: string;
  userPrompt: string;
}

export class PromptAssembler {
  /**
   * Builds the structured, high-density prompt envelope for Gemini 3.7.
   */
  public static buildNarrativePrompt(context: WorkingContextEnvelope): GenerationPromptPayload {
    const isPersian = context.languageDirective === 'fa';

    const systemPrompt = `[ROLE & PERSONA: LITERARY NOVELIST & RPG NARRATIVE DIRECTOR]
You are the narrative author for an interactive dark RPG novel titled "${context.storyTitle}".
Your writing style is visceral, atmospheric, and literary. Practice "Show, Don't Tell".
Language: Write the narrative and choices in ${isPersian ? 'PERSIAN (Farsi)' : 'ENGLISH'}.

[CORE DIRECTIVE: AI IS THE NARRATOR, NOT THE GAME ENGINE]
1. All game mechanics (dice rolls, stats, and consequences) are ALREADY pre-resolved deterministically.
2. You MUST strictly depict the pre-calculated outcome. Do NOT contradict or alter the mechanical result.
3. Keep the prose focused (between 200 and 350 words). Maintain narrative momentum and visceral tension.
4. Always provide exactly 3 distinct, contextual next choices for the reader:
   - Choice 1: Low Risk (Defensive / Diplomatic / Cautious / Observant)
   - Choice 2: Medium Risk (Tactical / Agile / Inquisitive / Stealthy)
   - Choice 3: High Risk (Aggressive / Daring / Audacious / Risky)

[OUTPUT FORMAT]
You MUST respond with a valid JSON object matching this schema:
{
  "narrative": "The story prose for this scene...",
  "choices": [
    { "id": "choice_1", "text": "Option 1 description", "style": "defensive", "riskLevel": "low" },
    { "id": "choice_2", "text": "Option 2 description", "style": "agile", "riskLevel": "medium" },
    { "id": "choice_3", "text": "Option 3 description", "style": "aggressive", "riskLevel": "high" }
  ],
  "extractedMemories": [
    { "category": "character", "importance": 7, "summary": "Player discovered Rolan doubts the Chancellor" }
  ]
}`;

    // Build the user prompt context envelope
    const parts: string[] = [];

    // 1. World Laws
    if (context.worldLaws.length > 0) {
      parts.push(`[ACTIVE WORLD LAWS & PROHIBITIONS]\n${context.worldLaws.map((l) => `• ${l}`).join('\n')}`);
    }

    // 2. Current Location & Atmosphere
    parts.push(
      `[CURRENT LOCATION: ${context.currentLocationName}]\nDescription: ${context.currentLocationDescription}`
    );

    // 3. Active NPCs
    if (context.activeNpcDossiers.length > 0) {
      const npcs = context.activeNpcDossiers
        .map((npc) => `• ${npc.name} (Trust: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - Tone: ${npc.speechStyle}`)
        .join('\n');
      parts.push(`[PRESENT CHARACTERS & RELATIONSHIPS]\n${npcs}`);
    }

    // 4. Relevant Long-Term Memories
    if (context.relevantMemories.length > 0) {
      const mems = context.relevantMemories
        .map((m) => `• [${m.category.toUpperCase()}] (Importance: ${m.importance}/10): ${m.summary}`)
        .join('\n');
      parts.push(`[RELEVANT PAST MEMORIES & FACTS]\n${mems}`);
    }

    // 5. Pre-Resolved Game Engine Outcome
    if (context.resolvedGameOutcome) {
      parts.push(
        `[PRE-RESOLVED GAME ENGINE OUTCOME]\n` +
        `• Player Attempted: "${context.resolvedGameOutcome.actionText}"\n` +
        `• Mechanical Result: ${context.resolvedGameOutcome.outcome.toUpperCase()}\n` +
        `• Consequence: ${context.resolvedGameOutcome.consequence}`
      );
    }

    // 6. Recent Scene History
    if (context.recentSceneSnippets.length > 0) {
      parts.push(`[RECENT SCENE SUMMARY]\n${context.recentSceneSnippets.join('\n\n')}`);
    }

    parts.push(`[INSTRUCTION]\nWrite the next scene beat weaving the pre-resolved outcome into the prose, then present the 3 next choices in valid JSON.`);

    return {
      systemPrompt,
      userPrompt: parts.join('\n\n'),
    };
  }
}
