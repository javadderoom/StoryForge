import { WorkingContextEnvelope } from '@/lib/types/memory';

export interface GenerationPromptPayload {
  systemPrompt: string;
  userPrompt: string;
  isEnglish: boolean;
  /** Plan 08: valid stat ids of the active RPG system, for choice validation. */
  playerStatIds?: Record<string, number>;
}

/**
 * Renders the expanded World Bible context (summary, theme, factions, timeline,
 * artifacts, bestiary, religions, NPC relationships, ontology) into labeled
 * blocks. Each section is only emitted when present, keeping the prompt bounded.
 */
function worldContextBlock(context: WorkingContextEnvelope, isEnglish: boolean): string[] {
  const labels = isEnglish
    ? {
        summary: 'WORLD SUMMARY',
        theme: 'THEMATIC DIRECTION',
        factions: 'FACTIONS & POWER BLOCS',
        timeline: 'TIMELINE & HISTORY',
        artifacts: 'ARTIFACTS & RELICS',
        bestiary: 'BESTIARY & CREATURES',
        religions: 'RELIGIONS & DEITIES',
        bonds: 'NPC RELATIONSHIPS',
        ontology: 'WORLD ONTOLOGY',
      }
    : {
        summary: 'خلاصه جهان / WORLD SUMMARY',
        theme: 'جهت تماتیک / THEMATIC DIRECTION',
        factions: 'گروه‌ها و قدرت‌ها / FACTIONS',
        timeline: 'تاریخ و زمان / TIMELINE',
        artifacts: 'اشیاء و یادگارها / ARTIFACTS',
        bestiary: 'موجودات / BESTIARY',
        religions: 'ادیان و خدایان / RELIGIONS',
        bonds: 'روابط شخصیت‌ها / NPC RELATIONSHIPS',
        ontology: 'ساختار جهان / ONTOLOGY',
      };

  const out: string[] = [];
  if (context.worldSummary) out.push(`[${labels.summary}]\n${context.worldSummary}`);
  if (context.themeNotes) out.push(`[${labels.theme}]\n${context.themeNotes}`);
  if (context.factions?.length) out.push(`[${labels.factions}]\n${context.factions.map((x) => `• ${x}`).join('\n')}`);
  if (context.timeline?.length) out.push(`[${labels.timeline}]\n${context.timeline.map((x) => `• ${x}`).join('\n')}`);
  if (context.artifacts?.length) out.push(`[${labels.artifacts}]\n${context.artifacts.map((x) => `• ${x}`).join('\n')}`);
  if (context.bestiary?.length) out.push(`[${labels.bestiary}]\n${context.bestiary.map((x) => `• ${x}`).join('\n')}`);
  if (context.religions?.length) out.push(`[${labels.religions}]\n${context.religions.map((x) => `• ${x}`).join('\n')}`);
  if (context.dramaBonds?.length) out.push(`[${labels.bonds}]\n${context.dramaBonds.map((x) => `• ${x}`).join('\n')}`);
  if (context.ontologySummary) out.push(`[${labels.ontology}]\n${context.ontologySummary}`);
  return out;
}

export class PromptAssembler {
  /**
   * Builds the structured, high-density prompt envelope for Gemini 3.7.
   * Accurately adapts language and format based on the story manifest language.
   */
  public static buildNarrativePrompt(context: WorkingContextEnvelope): GenerationPromptPayload {
    const isExplicitlyPersian =
      context.languageDirective === 'fa' ||
      /[\u0600-\u06FF]/.test(context.storyTitle || '') ||
      /[\u0600-\u06FF]/.test(context.worldSummary || '');
    const isEnglish = !isExplicitlyPersian && context.languageDirective === 'en';
    // Plan 08: only the story's real stats may appear in AI-proposed choices —
    // hardcoded generic stat names produced ids that silently rolled with 0.
    const validStatIds = Object.keys(context.playerStatus?.stats || {});

    const authorDirective = context.authoredSystemPrompt
      ? `\n\n[AUTHOR'S DIRECTIVE — honor the story author's voice, rules, and constraints below]\n${context.authoredSystemPrompt}`
      : '';

    const worldBlock = worldContextBlock(context, isEnglish);

    const statsDirective = validStatIds.length
      ? isEnglish
        ? `4. Provide 2 to 4 natural, contextual next choices for the reader in English. Every choice's "requiredStatId" MUST be one of exactly these stat ids: [${validStatIds.join(', ')}].`
        : `4. برای خواننده ۲ تا ۴ انتخاب زمینه‌ای و طبیعی ارائه کن. «requiredStatId» هر انتخاب باید دقیقاً یکی از این شناسه‌ها باشد: [${validStatIds.join('، ')}].`
      : isEnglish
      ? '4. Provide 2 to 4 natural, contextual next choices for the reader in English.'
      : '4. برای خواننده ۲ تا ۴ انتخاب زمینه‌ای طبیعی ارائه کن. هر انتخاب باید شامل آمار مناسب و درجه سختی (۹ تا ۱۶) باشد.';

    const systemPrompt = isEnglish
      ? `[ROLE & PERSONA: LITERARY NOVELIST & RPG NARRATIVE DIRECTOR]
You are the narrative author for an interactive dark RPG novel titled "${context.storyTitle}".
Your writing style is visceral, atmospheric, and literary (Show, Don't Tell).${authorDirective}
Base Language: Write the entire narrative and choices in pure, literary ENGLISH.

[CORE DIRECTIVE: AI IS THE NARRATOR, NOT THE GAME ENGINE]
1. All game mechanics (dice rolls, stats, and consequences) are ALREADY pre-resolved deterministically.
2. You MUST strictly depict the pre-calculated outcome. Do NOT contradict or alter the mechanical result.
3. Keep the prose focused (between 200 and 350 words). Maintain narrative momentum and visceral tension.
${statsDirective}

[OUTPUT FORMAT]
You MUST respond with a valid JSON object matching this schema:
{
  "narrative": "Visceral, atmospheric next scene prose in English...",
  "choices": [
    { "id": "choice_1", "text": "First choice description in English...", "style": "defensive", "riskLevel": "low", "targetDC": 10, "requiredStatId": "${validStatIds[0] || 'might'}" },
    { "id": "choice_2", "text": "Second choice description in English...", "style": "tactical", "riskLevel": "medium", "targetDC": 12, "requiredStatId": "${validStatIds[1] || validStatIds[0] || 'might'}" }
  ],
  "extractedMemories": [
    { "category": "character", "importance": 7, "summary": "Key discovery about a character in English..." }
  ]
}`
      : `[ROLE & PERSONA: LITERARY NOVELIST & RPG NARRATIVE DIRECTOR]
You are the narrative author for an interactive dark RPG novel titled "${context.storyTitle}".
Your writing style is visceral, atmospheric, and literary (Show, Don't Tell).${authorDirective}
Base Language: Write the narrative and choices in PERSIAN (فارسی - شیوا و ادبی).

[CORE DIRECTIVE: AI IS THE NARRATOR, NOT THE GAME ENGINE]
1. All game mechanics (dice rolls, stats, and consequences) are ALREADY pre-resolved deterministically.
2. You MUST strictly depict the pre-calculated outcome. Do NOT contradict or alter the mechanical result.
3. Keep the prose focused (between 200 and 350 words). Maintain narrative momentum and visceral tension.
${statsDirective}

[OUTPUT FORMAT]
You MUST respond with a valid JSON object matching this schema:
{
  "narrative": "متن ادبی و فضاسازی صحنه بعدی...",
  "choices": [
    { "id": "choice_1", "text": "متن تصمیم اول...", "style": "defensive", "riskLevel": "low", "targetDC": 10, "requiredStatId": "${validStatIds[0] || 'might'}" },
    { "id": "choice_2", "text": "متن تصمیم دوم...", "style": "tactical", "riskLevel": "medium", "targetDC": 12, "requiredStatId": "${validStatIds[1] || validStatIds[0] || 'might'}" }
  ],
  "extractedMemories": [
    { "category": "character", "importance": 7, "summary": "کشف رازی مهم در مورد شخصیت..." }
  ]
}`;

    // Build the user prompt context envelope
    const parts: string[] = [];

    if (isEnglish) {
      // English Context
      if (context.worldLaws.length > 0) {
        parts.push(`[ACTIVE WORLD LAWS]\n${context.worldLaws.map((l) => `• ${l}`).join('\n')}`);
      }

      parts.push(...worldBlock);

      parts.push(
        `[CURRENT LOCATION: ${context.currentLocationName}]\nDescription: ${context.currentLocationDescription}`
      );

      if (context.activeNpcDossiers.length > 0) {
        const npcs = context.activeNpcDossiers
          .map((npc) => `• ${npc.name} (Trust: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - Speech: ${npc.speechStyle}`)
          .join('\n');
        parts.push(`[PRESENT NPCS]\n${npcs}`);
      }

      if (context.relevantMemories.length > 0) {
        const mems = context.relevantMemories
          .map((m) => `• [${m.category.toUpperCase()}] (Importance: ${m.importance}/10): ${m.summary}`)
          .join('\n');
        parts.push(`[RELEVANT MEMORIES]\n${mems}`);
      }

      if (context.resolvedGameOutcome) {
        parts.push(
          `[PRE-RESOLVED GAME ENGINE OUTCOME]\n` +
          `• Player Action: "${context.resolvedGameOutcome.actionText}"\n` +
          `• Check Result: ${context.resolvedGameOutcome.outcome.toUpperCase()}\n` +
          `• Consequence: ${context.resolvedGameOutcome.consequence}`
        );
      }

      if (context.recentSceneSnippets.length > 0) {
        parts.push(`[RECENT SCENE PROSE]\n${context.recentSceneSnippets.join('\n\n')}`);
      }

      // Narrative goal / upcoming milestone encounter directive
      if (context.activeChapterGoal || context.activeChapterTitle) {
        parts.push(
          `[UPCOMING MILESTONE & NARRATIVE DIRECTION]\n` +
          (context.activeChapterTitle ? `Chapter: ${context.activeChapterTitle}\n` : '') +
          (context.activeChapterGoal ? `Target Milestone / Encounter: "${context.activeChapterGoal}"\n` : '') +
          `• DIRECTIVE: Act as the connective tissue! Subtly steer the environment, obstacles, and choice opportunities across turns toward this milestone encounter without forcing an unnatural instant teleport.`
        );
      }
      if (context.episodicRollup?.length) {
        parts.push(`[EPISODIC MILESTONE ROLLUP — completed chapters]\n${context.episodicRollup.map((x) => `• ${x}`).join('\n')}`);
      }
      if (context.livingWorldLedger?.length) {
        parts.push(
          `[LIVING WORLD LEDGER — immutable play history]\n${context.livingWorldLedger.map((x) => `• ${x}`).join('\n')}\n(Never resurrect dead or transformed NPCs; honor faction standings.)`
        );
      }

      parts.push(`[FINAL INSTRUCTION]\nWrite the next scene prose in English reflecting the pre-resolved check outcome and return 2 to 4 contextual choices in pure JSON.`);
    } else {
      // Persian Context
      if (context.worldLaws.length > 0) {
        parts.push(`[قوانین و محدودیت‌های جهان / ACTIVE WORLD LAWS]\n${context.worldLaws.map((l) => `• ${l}`).join('\n')}`);
      }

      parts.push(...worldBlock);

      parts.push(
        `[موقعیت مکانی فعلی / CURRENT LOCATION: ${context.currentLocationName}]\nتوضیحات: ${context.currentLocationDescription}`
      );

      if (context.activeNpcDossiers.length > 0) {
        const npcs = context.activeNpcDossiers
          .map((npc) => `• ${npc.name} (میزان اعتماد: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - لحن صحبت: ${npc.speechStyle}`)
          .join('\n');
        parts.push(`[شخصیت‌های حاضر / PRESENT NPCS]\n${npcs}`);
      }

      if (context.relevantMemories.length > 0) {
        const mems = context.relevantMemories
          .map((m) => `• [${m.category.toUpperCase()}] (اهمیت: ${m.importance}/10): ${m.summary}`)
          .join('\n');
        parts.push(`[حافظه و رویدادهای گذشته / RELEVANT MEMORIES]\n${mems}`);
      }

      if (context.resolvedGameOutcome) {
        parts.push(
          `[نتیجه محاسباتی موتور بازی / PRE-RESOLVED OUTCOME]\n` +
          `• عمل انجام شده توسط بازیکن: "${context.resolvedGameOutcome.actionText}"\n` +
          `• نتیجه تاس و بررسی: ${context.resolvedGameOutcome.outcome.toUpperCase()}\n` +
          `• پیامد: ${context.resolvedGameOutcome.consequence}`
        );
      }

      if (context.recentSceneSnippets.length > 0) {
        parts.push(`[خلاصه صحنه قبلی / RECENT SCENE]\n${context.recentSceneSnippets.join('\n\n')}`);
      }

      // Narrative goal / upcoming milestone encounter directive
      if (context.activeChapterGoal || context.activeChapterTitle) {
        parts.push(
          `[جهت‌گیری روایی و برخورد پیش‌رو / UPCOMING MILESTONE]\n` +
          (context.activeChapterTitle ? `فصل: ${context.activeChapterTitle}\n` : '') +
          (context.activeChapterGoal ? `هدف روایی / برخورد هدف: «${context.activeChapterGoal}»\n` : '') +
          `• دستور راوی: شکاف داستانی را پر کن! وقایع، سرنخ‌ها و انتخاب‌ها را در طول نوبت‌ها به شکلی نامحسوس به سمت تحقق این برخورد روایی هدایت کن تا بازیکن در جریان ماجرا به این اتفاق برسد.`
        );
      }
      if (context.episodicRollup?.length) {
        parts.push(`[خلاصه فصل‌های گذشته / EPISODIC ROLLUP]\n${context.episodicRollup.map((x) => `• ${x}`).join('\n')}`);
      }
      if (context.livingWorldLedger?.length) {
        parts.push(
          `[دفتر جهان زنده / LIVING WORLD LEDGER]\n${context.livingWorldLedger.map((x) => `• ${x}`).join('\n')}\n(هرگز شخصیات مرده یا دگرگون‌شده را زنده نکن؛ به جایگاه جناح‌ها پایبند بمان.)`
        );
      }

      parts.push(`[دستور نهایی]\nصحنه بعدی داستان را با نثر ادبی و تاثیر نتیجه تاس بنویس و ۲ تا ۴ انتخاب زمینه ای در قالب JSON برگردان.`);
    }

    return {
      systemPrompt,
      userPrompt: parts.join('\n\n'),
      isEnglish,
      playerStatIds: context.playerStatus?.stats || {},
    };
  }
}
