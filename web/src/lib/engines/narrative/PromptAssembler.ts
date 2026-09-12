import { WorkingContextEnvelope } from '@/lib/types/memory';

export interface GenerationPromptPayload {
  systemPrompt: string;
  userPrompt: string;
  isEnglish: boolean;
  /** Plan 08: valid stat ids of the active RPG system, for choice validation. */
  playerStatIds?: Record<string, number>;
  /** Low-base calibration flag: true when story uses low starting attributes (< 8) */
  isLowBase?: boolean;
  /**
   * Story-aware stat aliases (canonical stat id -> its authored display names,
   * e.g. might -> ['نیرو']). Lets choice normalization survive the model using
   * synonyms or localized names instead of silently dropping the choice.
   */
  statIdAliases?: Record<string, string[]>;
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
        factionRelations: 'FACTION RELATIONS',
        timeline: 'TIMELINE & HISTORY',
        artifacts: 'ARTIFACTS & RELICS',
        bestiary: 'BESTIARY & CREATURES',
        religions: 'RELIGIONS & DEITIES',
        bonds: 'NPC RELATIONSHIPS',
        ontology: 'WORLD ONTOLOGY',
        locations: 'KNOWN LOCATIONS',
        npcs: 'KNOWN NPCS',
      }
    : {
        summary: 'خلاصه جهان / WORLD SUMMARY',
        theme: 'جهت تماتیک / THEMATIC DIRECTION',
        factions: 'گروه‌ها و قدرت‌ها / FACTIONS',
        factionRelations: 'روابط جناح‌ها / FACTION RELATIONS',
        timeline: 'تاریخ و زمان / TIMELINE',
        artifacts: 'اشیاء و یادگارها / ARTIFACTS',
        bestiary: 'موجودات / BESTIARY',
        religions: 'ادیان و خدایان / RELIGIONS',
        bonds: 'روابط شخصیت‌ها / NPC RELATIONSHIPS',
        ontology: 'ساختار جهان / ONTOLOGY',
        locations: 'مکان‌های شناخته‌شده / LOCATIONS',
        npcs: 'شخصیت‌های شناخته‌شده / NPCS',
      };

  const out: string[] = [];
  if (context.worldSummary) out.push(`[${labels.summary}]\n${context.worldSummary}`);
  if (context.themeNotes) out.push(`[${labels.theme}]\n${context.themeNotes}`);
  if (context.factions?.length) out.push(`[${labels.factions}]\n${context.factions.map((x) => `• ${x}`).join('\n')}`);
  if (context.factionRelations?.length) out.push(`[${labels.factionRelations} — honor these stances: allied fights together, favorable cooperates quietly, neutral does not intervene, rival contests without open war, hostile wages open war]\n${context.factionRelations.map((x) => `• ${x}`).join('\n')}`);
  if (context.locations?.length) out.push(`[${labels.locations}]\n${context.locations.map((x) => `• ${x}`).join('\n')}`);
  if (context.npcs?.length) out.push(`[${labels.npcs}]\n${context.npcs.map((x) => `• ${x}`).join('\n')}`);
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
   * Builds a canonical stat-id -> authored display names map so choice
   * normalization can tolerate the model emitting a stat's Persian/English
   * name or a synonym instead of the exact schema id.
   */
  private static buildStatIdAliases(
    statsDefs: NonNullable<WorkingContextEnvelope['statsConfig']>
  ): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const s of statsDefs) {
      const id = s.id?.trim().toLowerCase();
      if (!id) continue;
      const names = [s.name, s.nameFa, s.nameEn]
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
        .map((n) => n.trim());
      if (names.length) out[id] = names;
    }
    return out;
  }

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
    // Plan 08 & Custom stats: real stats from RPG system or player status
    const statsDefs = context.statsConfig || [];
    const validStatIds = Object.keys(context.playerStatus?.stats || {});
    const statDescriptors = statsDefs.length > 0
      ? statsDefs.map((s) => `${s.id}${s.name ? ` (${s.name})` : ''}`).join(', ')
      : validStatIds.join(', ');

    const isLowBase = statsDefs.length > 0
      ? statsDefs.some((s) => (s.baseValue ?? 10) < 8)
      : Object.values(context.playerStatus?.stats || {}).some((v) => v < 8);

    const exampleLowDC = isLowBase ? 7 : 10;
    const exampleMedDC = isLowBase ? 9 : 12;

    const authorDirective = context.authoredSystemPrompt
      ? `\n\n[AUTHOR'S DIRECTIVE — honor the story author's voice, rules, and constraints below]\n${context.authoredSystemPrompt}`
      : '';

    const worldBlock = worldContextBlock(context, isEnglish);

    const dcDirective = isLowBase
      ? isEnglish
        ? `Difficulty targets (targetDC) for choices MUST be calibrated between 6 and 11 (Low risk: 6-7, Medium risk: 8-9, High risk: 10-11). Because character base attributes are low, avoid DCs above 10 for standard choices so outcomes are not purely luck-dependent.`
        : `درجه سختی (targetDC) برای انتخاب‌ها باید بین ۶ تا ۱۱ باشد (ساده: ۶-۷، متوسط: ۸-۹، دشوار: ۱۰-۱۱). با توجه به اینکه مقادیر ویژگی‌های پایه پایین است، از درجات سختی بالای ۱۰ برای انتخاب‌های عادی پرهیز کن تا موفقیت وابسته به شانس صرف نباشد.`
      : isEnglish
      ? `Difficulty targets (targetDC) for choices MUST be calibrated between 9 and 15 (Low risk: 9-10, Medium risk: 11-13, High risk: 14-15).`
      : `درجه سختی (targetDC) برای انتخاب‌ها باید بین ۹ تا ۱۵ باشد (ساده: ۹-۱۰، متوسط: ۱۱-۱۳، دشوار: ۱۴-۱۵).`;

    const statsDirective = validStatIds.length
      ? isEnglish
        ? `4. Provide 2 to 4 natural, contextual next choices for the reader in English. Every choice's "requiredStatId" MUST be one of exactly these stat ids: [${validStatIds.join(', ')}] (Authored stats: ${statDescriptors}). ${dcDirective} Ground choices in equipped gear, environmental interactables, and discovered clues. NEVER reveal or base choices on hidden/undiscovered NPC secrets; choices must strictly offer actions based on what the protagonist currently knows and directly observes. Span distinct philosophies (tactical, aggressive, defensive, inquisitive).`
        : `۴. برای خواننده ۲ تا ۴ انتخاب زمینه‌ای و طبیعی ارائه کن. «requiredStatId» هر انتخاب باید دقیقاً یکی از این شناسه‌ها باشد: [${validStatIds.join('، ')}] (نام‌های ویژگی: ${statDescriptors}). ${dcDirective} انتخاب‌ها را بر تجهیزات همراه، عناصر محیطی و سرنخ‌های فاش‌شده استوار کن. هرگز اسرار کشف‌نشده یا پنهان را در گزینه‌ها نیاور و انتخاب‌ها نباید بر پایه رازهای ناگفته شخصیت‌ها باشند. فلسفه‌های متفاوت (تاکتیکی، تهاجمی، تدافعی، کنجکاوانه) را پوشش بده.`
      : isEnglish
      ? `4. Provide 2 to 4 natural, contextual next choices for the reader in English. ${dcDirective} Ground choices in equipped gear and environmental interactables. NEVER reveal or base choices on hidden NPC secrets; span distinct philosophies (tactical, aggressive, defensive, inquisitive).`
      : `۴. برای خواننده ۲ تا ۴ انتخاب زمینه‌ای طبیعی ارائه کن. ${dcDirective} انتخاب‌ها را بر تجهیزات و محیط استوار کن و هرگز اسرار کشف‌نشده را لو نده.`;

    // Plan 13: contextual choice material shared by both language branches.
    const choiceMaterial = [
      context.inventoryTerms?.length ? `Equipped gear / inventory: ${context.inventoryTerms.join(', ')}` : '',
      context.environmentInteractables?.length ? `Environmental interactables: ${context.environmentInteractables.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const dialogueDirective = isEnglish
      ? '5. Wrap every line of direct speech in double quotation marks ("...") so dialogue stays visually distinct from narration.'
      : '۵. هر گفت‌وگوی مستقیم را داخل «...» بنویس تا از روایت متمایز بماند.';

    const secretGuardDirective = isEnglish
      ? '6. KNOWLEDGE BOUNDARY: Never expose or offer choices that act upon unrevealed NPC secrets or hidden plot twists. The protagonist only knows what has been explicitly discovered or experienced in the story.'
      : '۶. مرز دانش شخصیت: هرگز در گزینه‌های انتخابی یا روایت، اسرار پنهان و ناگفته شخصیت‌ها را پیش از کشف توسط بازیکن لو نده. انتخاب‌ها باید صرفاً بر اساس دانسته‌ها و شواهد ملموس صحنه باشند.';

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
${dialogueDirective}
${secretGuardDirective}

[OUTPUT FORMAT]
You MUST respond with a valid JSON object matching this schema:
{
  "narrative": "Visceral, atmospheric next scene prose in English...",
  "choices": [
    { "id": "choice_1", "text": "First choice description in English...", "style": "defensive", "riskLevel": "low", "targetDC": ${exampleLowDC}, "requiredStatId": "${validStatIds[0] || 'might'}" },
    { "id": "choice_2", "text": "Second choice description in English...", "style": "tactical", "riskLevel": "medium", "targetDC": ${exampleMedDC}, "requiredStatId": "${validStatIds[1] || validStatIds[0] || 'might'}" }
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
${dialogueDirective}
${secretGuardDirective}

[OUTPUT FORMAT]
You MUST respond with a valid JSON object matching this schema:
{
  "narrative": "متن ادبی و فضاسازی صحنه بعدی...",
  "choices": [
    { "id": "choice_1", "text": "متن تصمیم اول...", "style": "defensive", "riskLevel": "low", "targetDC": ${exampleLowDC}, "requiredStatId": "${validStatIds[0] || 'might'}" },
    { "id": "choice_2", "text": "متن تصمیم دوم...", "style": "tactical", "riskLevel": "medium", "targetDC": ${exampleMedDC}, "requiredStatId": "${validStatIds[1] || validStatIds[0] || 'might'}" }
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
          .map((npc) => `• ${npc.name} (Trust: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - Speech: ${npc.speechStyle}${npc.vitalsLine ? ` - Vitals: ${npc.vitalsLine}` : ''}`)
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

      // Plan 13: threat clocks, displacement, contextual choice material.
      if (context.activeClocks?.length) {
        parts.push(
          `[ACTIVE THREAT CLOCKS]\n${context.activeClocks.map((x) => `• ${x}`).join('\n')}\nReflect rising tension in the prose; when a clock hits its maximum, unleash its crisis event NOW, then stand the clock down.`
        );
      }
      if (context.displacementDirective) {
        parts.push(context.displacementDirective);
      }
      if (choiceMaterial) {
        parts.push(`[CONTEXTUAL CHOICE MATERIAL — weave into proposed choices]\n${choiceMaterial}`);
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
          .map((npc) => `• ${npc.name} (میزان اعتماد: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - لحن صحبت: ${npc.speechStyle}${npc.vitalsLine ? ` - علائم حیاتی: ${npc.vitalsLine}` : ''}`)
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

      // Plan 13: threat clocks, displacement, contextual choice material.
      if (context.activeClocks?.length) {
        parts.push(
          `[ساعت‌های تهدید فعال / ACTIVE THREAT CLOCKS]\n${context.activeClocks.map((x) => `• ${x}`).join('\n')}\nتنش فزاینده را در نثر منعکس کن؛ وقتی ساعتی به سقف رسید، بحرانش را همین حالا آزاد کن و سپس آن را بخوابان.`
        );
      }
      if (context.displacementDirective) {
        parts.push(context.displacementDirective);
      }
      if (choiceMaterial) {
        parts.push(`[مصالح انتخاب زمینه‌ای / CONTEXTUAL CHOICE MATERIAL]\n${choiceMaterial}`);
      }

      parts.push(`[دستور نهایی]\nصحنه بعدی داستان را با نثر ادبی و تاثیر نتیجه تاس بنویس و ۲ تا ۴ انتخاب زمینه ای در قالب JSON برگردان.`);
    }

    return {
      systemPrompt,
      userPrompt: parts.join('\n\n'),
      isEnglish,
      playerStatIds: context.playerStatus?.stats || {},
      isLowBase,
      statIdAliases: PromptAssembler.buildStatIdAliases(statsDefs),
    };
  }
}
