import { WorkingContextEnvelope } from '@/lib/types/memory';

export interface GenerationPromptPayload {
  systemPrompt: string;
  userPrompt: string;
}

export class PromptAssembler {
  /**
   * Builds the structured, high-density prompt envelope for Gemini 3.7.
   * Default language is Persian (Farsi).
   */
  public static buildNarrativePrompt(context: WorkingContextEnvelope): GenerationPromptPayload {
    const isEnglish = context.languageDirective === 'en';

    const systemPrompt = `[ROLE & PERSONA: LITERARY NOVELIST & RPG NARRATIVE DIRECTOR]
You are the narrative author for an interactive dark RPG novel titled "${context.storyTitle}".
Your writing style is visceral, atmospheric, and literary (Show, Don't Tell).
Base Language: Write the narrative and choices in ${isEnglish ? 'ENGLISH' : 'PERSIAN (فارسی - شیوا و ادبی)'}.

[CORE DIRECTIVE: AI IS THE NARRATOR, NOT THE GAME ENGINE]
1. All game mechanics (dice rolls, stats, and consequences) are ALREADY pre-resolved deterministically.
2. You MUST strictly depict the pre-calculated outcome. Do NOT contradict or alter the mechanical result.
3. Keep the prose focused (between 200 and 350 words). Maintain narrative momentum and visceral tension.
4. Provide 2 to 4 natural, contextual next choices for the reader. Let the narrative scene dictate the options rather than forcing fixed risk tiers.

[OUTPUT FORMAT]
You MUST respond with a valid JSON object matching this schema:
{
  "narrative": "متن ادبی و فضاسازی صحنه بعدی...",
  "choices": [
    { "id": "choice_1", "text": "متن تصمیم اول...", "style": "defensive", "riskLevel": "low" },
    { "id": "choice_2", "text": "متن تصمیم دوم...", "style": "tactical", "riskLevel": "medium" }
  ],
  "extractedMemories": [
    { "category": "character", "importance": 7, "summary": "کشف رازی مهم در مورد شخصیت..." }
  ]
}`;

    // Build the user prompt context envelope
    const parts: string[] = [];

    // 1. World Laws
    if (context.worldLaws.length > 0) {
      parts.push(`[قوانین و محدودیت‌های جهان / ACTIVE WORLD LAWS]\n${context.worldLaws.map((l) => `• ${l}`).join('\n')}`);
    }

    // 2. Current Location & Atmosphere
    parts.push(
      `[موقعیت مکانی فعلی / CURRENT LOCATION: ${context.currentLocationName}]\nتوضیحات: ${context.currentLocationDescription}`
    );

    // 3. Active NPCs
    if (context.activeNpcDossiers.length > 0) {
      const npcs = context.activeNpcDossiers
        .map((npc) => `• ${npc.name} (میزان اعتماد: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - لحن صحبت: ${npc.speechStyle}`)
        .join('\n');
      parts.push(`[شخصیت‌های حاضر / PRESENT NPCS]\n${npcs}`);
    }

    // 4. Relevant Long-Term Memories
    if (context.relevantMemories.length > 0) {
      const mems = context.relevantMemories
        .map((m) => `• [${m.category.toUpperCase()}] (اهمیت: ${m.importance}/10): ${m.summary}`)
        .join('\n');
      parts.push(`[حافظه و رویدادهای گذشته / RELEVANT MEMORIES]\n${mems}`);
    }

    // 5. Pre-Resolved Game Engine Outcome
    if (context.resolvedGameOutcome) {
      parts.push(
        `[نتیجه محاسباتی موتور بازی / PRE-RESOLVED OUTCOME]\n` +
        `• عمل انجام شده توسط بازیکن: "${context.resolvedGameOutcome.actionText}"\n` +
        `• نتیجه تاس و بررسی: ${context.resolvedGameOutcome.outcome.toUpperCase()}\n` +
        `• پیامد: ${context.resolvedGameOutcome.consequence}`
      );
    }

    // 6. Recent Scene History
    if (context.recentSceneSnippets.length > 0) {
      parts.push(`[خلاصه صحنه قبلی / RECENT SCENE]\n${context.recentSceneSnippets.join('\n\n')}`);
    }

    parts.push(`[دستور نهایی]\nصحنه بعدی داستان را با نثر ادبی و تاثیر نتیجه تاس بنویس و ۲ تا ۴ انتخاب زمینه ای در قالب JSON برگردان.`);

    return {
      systemPrompt,
      userPrompt: parts.join('\n\n'),
    };
  }
}
