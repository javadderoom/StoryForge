import { WorkingContextEnvelope } from '@/lib/types/memory';
import { promptVisibleConditions } from '@/lib/engines/game/conditionCatalog';
import {
  worldContextBlock,
  buildStatIdAliases,
  outcomeDirective,
  failureForwardBlock,
  journeyBlock,
} from './prompts/promptMechanics';
import {
  buildDCDirective,
  buildStatsDirective,
  buildWoundBeats,
  buildBestiaryGrounding,
  buildContinuityDirective,
  buildNarrativeSystemPrompt,
} from './prompts/promptDirectives';
import {
  buildOpeningChoicesPrompt,
  buildChoicesOnlyPrompt,
  GenerationPromptPayload,
} from './prompts/promptSpecialized';

// Re-export prompt modules and payload type for complete backward compatibility
export type { GenerationPromptPayload };
export {
  worldContextBlock,
  buildStatIdAliases,
  outcomeDirective,
  failureForwardBlock,
  journeyBlock,
  buildDCDirective,
  buildStatsDirective,
  buildWoundBeats,
  buildBestiaryGrounding,
  buildContinuityDirective,
  buildNarrativeSystemPrompt,
  buildOpeningChoicesPrompt,
  buildChoicesOnlyPrompt,
};

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

    const statsDefs = context.statsConfig || [];
    const validStatIds = Object.keys(context.playerStatus?.stats || {});
    const statDescriptors = statsDefs.length > 0
      ? statsDefs.map((s) => `${s.id}${s.name ? ` (${s.name})` : ''}`).join(', ')
      : validStatIds.join(', ');

    const isLowBase = context.universalBaseValue !== undefined
      ? context.universalBaseValue < 8
      : statsDefs.length > 0
      ? statsDefs.every((s) => (s.baseValue ?? 10) < 8)
      : false;

    const exampleMedDC = isLowBase ? 9 : 12;

    const authorDirective = context.authoredSystemPrompt
      ? `\n\n[AUTHOR'S DIRECTIVE — honor the story author's voice, rules, and constraints below]\n${context.authoredSystemPrompt}`
      : '';

    const worldBlock = worldContextBlock(context, isEnglish);

    const dcDirective = buildDCDirective(isLowBase, isEnglish);

    const statsDirective = buildStatsDirective({
      isEnglish,
      validStatIds,
      statDescriptors,
      dcDirective,
    });

    // Plan 13: contextual choice material shared by both language branches.
    const choiceMaterial = [
      context.inventoryTerms?.length ? `Equipped gear / inventory: ${context.inventoryTerms.join(', ')}` : '',
      context.environmentInteractables?.length ? `Environmental interactables: ${context.environmentInteractables.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const dialogueDirective = isEnglish
      ? '5. Wrap every line of direct speech in double quotation marks ("...") so dialogue stays visually distinct from narration.'
      : '۵. هر گفت‌وگوی مستقیم را داخل «...» بنویس تا از روایت متمایز بماند.';

    const secretGuardDirective = isEnglish
      ? '6. KNOWLEDGE BOUNDARY & NO PREMATURE LEAKS: Never expose or offer choices that act upon unrevealed NPC secrets or hidden plot twists. The protagonist only knows what has been explicitly discovered or experienced in the story. In early turns (Turns 1-3), never dump overarching conspiracies or treasonous plots unless critically unlocked by the engine. Third-party sentries and environmental adversaries do not possess or leak unrelated NPC secrets.'
      : '۶. مرز دانش شخصیت و منع افشای زودهنگام رازها: هرگز در گزینه‌های انتخابی یا روایت، اسرار پنهان و ناگفته شخصیت‌ها یا توطئه‌های کلان را پیش از کشف منطقی و گام‌به‌گام توسط بازیکن لو نده. انتخاب‌ها باید صرفاً بر اساس دانسته‌ها و شواهد ملموس صحنه باشند. گزمه‌ها و نگهبانان صحنه نمی‌توانند رازهای پنهان و توطئه‌های کاروانیان یا اشخاص دیگر را که ربطی به آن‌ها ندارد فاش کنند.';

    const bestiaryGrounding = buildBestiaryGrounding(Boolean(context.bestiary?.length), isEnglish);

    const { woundBeat, treatedWoundBeat } = buildWoundBeats(
      context.playerStatus?.conditions,
      isEnglish
    );

    const continuityDirective = buildContinuityDirective({
      bestiaryGrounding,
      woundBeat,
      treatedWoundBeat,
    });

    const systemPrompt = buildNarrativeSystemPrompt({
      isEnglish,
      storyTitle: context.storyTitle || 'Story',
      authorDirective,
      statsDirective,
      dialogueDirective,
      secretGuardDirective,
      continuityDirective,
      exampleMedDC,
      validStatIds,
    });

    // Build Protagonist Status & Capabilities block
    const playerStats = context.playerStatus?.stats || {};
    const playerResources = context.playerStatus?.resources || {};
    const playerEquipped = context.playerStatus?.equippedItems || [];

    const statsLineEn = Object.entries(playerStats)
      .map(([id, val]) => {
        const def = statsDefs.find((s) => s.id?.toLowerCase() === id.toLowerCase());
        const label = def?.nameEn || def?.name || id;
        return `${label}: ${val}`;
      })
      .join(', ');

    const statsLineFa = Object.entries(playerStats)
      .map(([id, val]) => {
        const def = statsDefs.find((s) => s.id?.toLowerCase() === id.toLowerCase());
        const label = def?.nameFa || def?.name || id;
        return `${label}: ${val}`;
      })
      .join('، ');

    const resourcesLine = Object.entries(playerResources)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const powerRanksLineEn = context.activePowerRanks?.length
      ? context.activePowerRanks
          .map((pr) => `• ${pr.schoolName}: Rank ${pr.rank} - ${pr.rankName}${pr.rankTitle ? ` (${pr.rankTitle})` : ''} [Tier: ${pr.scope || 'seasoned'}] — ${pr.capabilities}`)
          .join('\n')
      : '';

    const powerRanksLineFa = context.activePowerRanks?.length
      ? context.activePowerRanks
          .map((pr) => `• ${pr.schoolName}: مرتبه ${pr.rank} - ${pr.rankName}${pr.rankTitle ? ` (${pr.rankTitle})` : ''} [سطح: ${pr.scope || 'seasoned'}] — ${pr.capabilities}`)
          .join('\n')
      : '';

    const playerTraits = context.playerStatus?.traits || [];
    const traitsLineEn = playerTraits.length
      ? playerTraits
          .map((t) =>
            t.effects.length > 0 ? `• ${t.name} — ${t.effects.join(' | ')}` : `• ${t.name}`
          )
          .join('\n')
      : '';
    const traitsLineFa = traitsLineEn;

    const enProtagonistBlock = (statsLineEn || resourcesLine || playerEquipped.length || context.playerStatus?.abilities?.length || traitsLineEn || powerRanksLineEn || context.playerStatus?.itemInteractionsCatalog || context.powerScaleContext)
      ? [
          '[PROTAGONIST STATUS & CAPABILITIES]',
          context.playerStatus?.characterName
            ? `• Name: ${context.playerStatus.characterName}${context.playerStatus.archetypeName ? ` (${context.playerStatus.archetypeName})` : ''}`
            : '',
          statsLineEn ? `• Attributes: ${statsLineEn}` : '',
          resourcesLine ? `• Vitals: ${resourcesLine}` : '',
          playerEquipped.length ? `• Equipped / Carried Gear: ${playerEquipped.join(', ')}` : '',
          context.playerStatus?.abilities?.length
            ? context.playerStatus.abilities.length === 1
              ? `• Known Abilities / Spells: ${context.playerStatus.abilities[0]}`
              : `• Known Abilities / Spells:\n  ${context.playerStatus.abilities.map((a) => `• ${a}`).join('\n  ')}`
            : '',
          traitsLineEn
            ? `• Background Traits (these ALREADY altered this turn's roll — depict them as real):\n  ${traitsLineEn}`
            : '',
          context.playerStatus?.conditions?.length
            ? `• Active Character Conditions (MANDATORY sensory reflection in prose & tone): ${promptVisibleConditions(context.playerStatus.conditions).join(', ')}`
            : '',
          powerRanksLineEn ? `\n[POWER SCHOOL RANKINGS & MASTERY]\n${powerRanksLineEn}` : '',
          context.powerScaleContext ? `\n[MORTAL BASELINE & POWER SCALE CONTRAST]\n${context.powerScaleContext}` : '',
          context.playerStatus?.itemInteractionsCatalog ? `\n${context.playerStatus.itemInteractionsCatalog}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    const faProtagonistBlock = (statsLineFa || resourcesLine || playerEquipped.length || context.playerStatus?.abilities?.length || traitsLineFa || context.playerStatus?.conditions?.length || powerRanksLineFa || context.playerStatus?.itemInteractionsCatalog || context.powerScaleContext)
      ? [
          '[وضعیت و توانمندی‌های قهرمان داستان / PROTAGONIST STATUS]',
          context.playerStatus?.characterName
            ? `• نام: ${context.playerStatus.characterName}${context.playerStatus.archetypeName ? ` (${context.playerStatus.archetypeName})` : ''}`
            : '',
          statsLineFa ? `• ویژگی‌ها و صفات: ${statsLineFa}` : '',
          resourcesLine ? `• منابع و وضعیت حیاتی: ${resourcesLine}` : '',
          playerEquipped.length ? `• تجهیزات و اشیاء همراه: ${playerEquipped.join('، ')}` : '',
          context.playerStatus?.abilities?.length
            ? context.playerStatus.abilities.length === 1
              ? `• توانایی‌ها و جادوهای فعال: ${context.playerStatus.abilities[0]}`
              : `• توانایی‌ها و جادوهای فعال:\n  ${context.playerStatus.abilities.map((a) => `• ${a}`).join('\n  ')}`
            : '',
          traitsLineFa
            ? `• ویژگی‌های پیشینه (همین‌ها بر تاس این نوبت اثر گذاشته‌اند — آن‌ها را واقعی و ملموس روایت کن):\n  ${traitsLineFa}`
            : '',
          context.playerStatus?.conditions?.length
            ? `• حالت‌ها و وضعیت‌های فعلی کاراکتر (بسیار مهم: حتماً این احوال، تنش و فرسودگی را در نثر، تنفس و توصیف حسی منعکس کن): ${promptVisibleConditions(context.playerStatus.conditions).join('، ')}`
            : '',
          powerRanksLineFa ? `\n[مکاتب قدرت و درجات تسلط / POWER SYSTEM RANKINGS]\n${powerRanksLineFa}` : '',
          context.powerScaleContext ? `\n[سنجش مقیاس قدرت در برابر انسان فانی / POWER SCALE CONTRAST]\n${context.powerScaleContext}` : '',
          context.playerStatus?.itemInteractionsCatalog ? `\n${context.playerStatus.itemInteractionsCatalog}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : '';

    // Build the user prompt context envelope
    const parts: string[] = [];

    if (isEnglish) {
      // English Context
      if (context.worldLaws.length > 0) {
        parts.push(`[ACTIVE WORLD LAWS]\n${context.worldLaws.map((l) => `• ${l}`).join('\n')}`);
      }

      parts.push(...worldBlock);

      if (enProtagonistBlock) {
        parts.push(enProtagonistBlock);
      }

      parts.push(
        `[CURRENT LOCATION: ${context.currentLocationName}]\nDescription: ${context.currentLocationDescription}`
      );

      // Plan 17 (§4.5): the road is real — journey leg / arrival discipline.
      const enJourneyBlock = journeyBlock(context, true);
      if (enJourneyBlock) {
        parts.push(enJourneyBlock);
      }

      if (context.activeNpcDossiers.length > 0) {
        const npcs = context.activeNpcDossiers
          .map((npc) => {
            const caravanTag = npc.caravanAffiliation
              ? ` [WITH ACTIVE CARAVAN: ${npc.caravanAffiliation}]`
              : '';
            const statusTag = npc.presenceStatus === 'nearby_resident'
              ? ' [STATIONED AT LOCATION — NOT currently in this immediate scene]'
              : (npc.presenceStatus === 'present' ? ' [PRESENT IN SCENE]' : '');
            const appearanceTag = npc.appearance ? ` - Appearance & Attire: ${npc.appearance}` : '';
            return `• ${npc.name}${caravanTag}${statusTag} (Trust: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - Speech: ${npc.speechStyle}${appearanceTag}${npc.vitalsLine ? ` - Vitals: ${npc.vitalsLine}` : ''}${npc.powerAffiliationLine ? ` - Power: [${npc.powerAffiliationLine}]` : ''}`;
          })
          .join('\n');
        parts.push(
          `[PRESENT NPCS]\n${npcs}\n` +
          `• LITERARY CHARACTER PORTRAIT DIRECTIVE: When introducing an NPC for the first time, or when an NPC performs an action or speaks, DO NOT treat them as an abstract floating name or talking head! Ground them in rich, tangible sensory prose: describe their physical stature and frame (height, broad/gaunt build, posture, gait), facial features and gaze (skin weathered by sun/cold, lines, scars, beard/hair, eye sharpness), attire and fabrics (coarse wool, leather, linen, stains, signature colors, footwear), and hands/mannerisms. Paint them vividly like a literary novel!\n` +
          `• DIRECTIVE ON NPC PRESENCE & SPATIAL CONTINUITY: NPCs marked as [STATIONED AT LOCATION — NOT currently in this immediate scene] are stationed somewhere in this broad location/garrison, but are NOT currently in front of the protagonist. DO NOT place the protagonist face-to-face with them unless an action or event explicitly summons or seeks them out. Furthermore, if the protagonist stepped away to a secluded micro-location (e.g. riverbank reeds, shadows, alleys), the scene remains strictly secluded; NPCs left at camp or the gate remain at their post and are completely oblivious to muffled, low-profile struggles within the reeds. Maintain realistic physical space!\n` +
          `• CARAVAN & TRAVELING ENTITY PRESENCE: NPCs marked with [WITH ACTIVE CARAVAN: ...] travel with the trade routes touching this location. Even if their permanent residence or home city in the World Bible is registered in another settlement, they are physically present here at the local caravanserai, baggage train, way-station, or market gates alongside their pack beasts, wagons, and wares. They are valid conversational partners, potential employers for escort contracts, and witnesses.\n` +
          `• STRICT DIRECTIVE ON ORGANIC INTRODUCTION VS CHOICES: Characters marked as [STATIONED AT LOCATION — NOT currently in this immediate scene] have NOT met or interacted with the protagonist yet. If the protagonist's action moves toward their domain (e.g. going to baggage wagons, searching for a guide), you MAY organically introduce them in your narrative prose with dialogue. However, you MUST NOT offer their names in the choice options until they have been explicitly introduced and named in the narrative text!`
        );
      }

      if (context.relevantMemories.length > 0) {
        const mems = context.relevantMemories
          .map((m) => `• [${m.category.toUpperCase()}] (Importance: ${m.importance}/10): ${m.summary}`)
          .join('\n');
        parts.push(`[RELEVANT MEMORIES]\n${mems}`);
      }

      if (context.resolvedGameOutcome) {
        const mixedDirective = outcomeDirective(context.resolvedGameOutcome.outcome, true);
        const failureBlock = failureForwardBlock(context.resolvedGameOutcome, true);
        parts.push(
          `[PRE-RESOLVED GAME ENGINE OUTCOME]\n` +
          `• Player Action: "${context.resolvedGameOutcome.actionText}"\n` +
          `• Check Result: ${context.resolvedGameOutcome.outcome.toUpperCase()}\n` +
          `• Consequence: ${context.resolvedGameOutcome.consequence}\n` +
          (context.resolvedGameOutcome.costLine ? `• Cost (MANDATORY — depict in prose): ${context.resolvedGameOutcome.costLine}\n` : '') +
          (mixedDirective ? `${mixedDirective}\n` : '') +
          (failureBlock ? `${failureBlock}\n` : '') +
          `• DIRECTIVE: Immediately open with the protagonist performing this exact action and depict the direct, personal reaction of the target NPC or environment! Respond to the exact target addressed, not an off-scene commander. If speaking or asking a question, use direct dialogue.`
        );
      }

      if (context.recentSceneSnippets.length > 0) {
        parts.push(`[RECENT SCENE PROSE]\n${context.recentSceneSnippets.join('\n\n')}`);
      }

      if (context.recentCompletedActions && context.recentCompletedActions.length > 0) {
        parts.push(
          `[RECENTLY COMPLETED ACTIONS — FORWARD MOMENTUM & NO RECYCLING]\n` +
          `The protagonist has ALREADY performed and resolved these actions in recent turns:\n` +
          context.recentCompletedActions.map((a) => `• ${a}`).join('\n') +
          `\n• STRICT ANTI-REPETITION DIRECTIVE: These actions are DONE. The scene has advanced beyond them. You are STRICTLY FORBIDDEN from offering choices that re-attempt, re-phrase, or cycle through these completed actions. The protagonist must move FORWARD into the new space or deal with the new dilemma created by their success.`
        );
      }

      // Narrative goal / upcoming milestone encounter directive & Arc Stages
      if (context.activeChapterGoal || context.activeChapterTitle || context.activeChapterStages?.length) {
        const stageLines = context.activeChapterStages?.length
          ? `\nNarrative Arc Stages:\n` +
            context.activeChapterStages
              .map((st) => `  ${st.order}. [${st.title}]: ${st.description}`)
              .join('\n')
          : '';
        parts.push(
          `[UPCOMING MILESTONE & NARRATIVE DIRECTION]\n` +
          (context.activeChapterTitle ? `Chapter: ${context.activeChapterTitle}\n` : '') +
          (context.activeChapterGoal ? `Chapter Narrative Goal: "${context.activeChapterGoal}"\n` : '') +
          stageLines +
          `\n• DIRECTIVE: Act as the connective tissue! Subtly steer the environment, physical clues, and choice opportunities across turns toward these authored arc stages. Ensure current obstacles, clues, and choices in the prose align with the active arc stage rather than spinning in generic loops.`
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
          `[ACTIVE THREAT CLOCKS]\n${context.activeClocks.map((x) => `• ${x}`).join('\n')}\nReflect rising tension in the prose; declare every movement in "clockChanges" (see the TENSION CLOCK CONTRACT). When a clock hits its maximum, unleash its crisis event NOW in the prose, then stand the clock down.`
        );
      }
      if (context.displacementDirective) {
        parts.push(context.displacementDirective);
      }
      if (choiceMaterial) {
        parts.push(`[CONTEXTUAL CHOICE MATERIAL — weave into proposed choices]\n${choiceMaterial}`);
      }

      parts.push(`[FINAL INSTRUCTION]\nWrite the next scene prose in English reflecting the pre-resolved check outcome and return 2 to 4 contextual choices strictly grounded in the scene prose in pure JSON.`);
    } else {
      // Persian Context
      if (context.worldLaws.length > 0) {
        parts.push(`[قوانین و محدودیت‌های جهان / ACTIVE WORLD LAWS]\n${context.worldLaws.map((l) => `• ${l}`).join('\n')}`);
      }

      parts.push(...worldBlock);

      if (faProtagonistBlock) {
        parts.push(faProtagonistBlock);
      }

      parts.push(
        `[موقعیت مکانی فعلی / CURRENT LOCATION: ${context.currentLocationName}]\nتوضیحات: ${context.currentLocationDescription}`
      );

      // Plan 17 (§4.5): the road is real — journey leg / arrival discipline.
      const faJourneyBlock = journeyBlock(context, false);
      if (faJourneyBlock) {
        parts.push(faJourneyBlock);
      }

      if (context.activeNpcDossiers.length > 0) {
        const npcs = context.activeNpcDossiers
          .map((npc) => {
            const caravanTag = npc.caravanAffiliation
              ? ` [همراه کاروان تجاری: ${npc.caravanAffiliation}]`
              : '';
            const statusTag = npc.presenceStatus === 'nearby_resident'
              ? ' [مستقر در این پایگاه/مکان — هنوز در صحنه حاضر نیست]'
              : (npc.presenceStatus === 'present' ? ' [حاضر در صحنه]' : '');
            const appearanceTag = npc.appearance ? ` - سیما، اندام و پوشش: ${npc.appearance}` : '';
            return `• ${npc.name}${caravanTag}${statusTag} (میزان اعتماد: ${npc.trust > 0 ? '+' : ''}${npc.trust}) - لحن صحبت: ${npc.speechStyle}${appearanceTag}${npc.vitalsLine ? ` - علائم حیاتی: ${npc.vitalsLine}` : ''}${npc.powerAffiliationLine ? ` - قدرت: [${npc.powerAffiliationLine}]` : ''}`;
          })
          .join('\n');
        parts.push(
          `[شخصیت‌های حاضر / PRESENT NPCS]\n${npcs}\n` +
          `• دستور شاهکار ادبی برای توصیف سیمای شخصیت‌ها (LITERARY CHARACTER PORTRAIT DIRECTIVE): هنگام معرفی هر شخصیت برای نخستین بار، یا زمانی که شخصیتی لب به سخن می‌گشاید یا واکنشی نشان می‌دهد، هرگز او را مانند یک «نام انتزاعی» یا صرفاً متکلم دیالوگ توصیف نکن! شخصیت‌ها باید مانند رمان‌های ادبی کلاسیک و فانتزی عینی و جاندار باشند: حتماً اندام و قامت (بلندی یا کوتاهی، ستبر یا لاغر بودن، خمیدگی یا استواری شانه، طرز راه رفتن)، سیمای چهره و نگاه (رنگ و شیار پوست در اثر آفتاب و باد، زبری ریش و مو، خطوط اخم یا خنده، تیزی و رنگ چشم‌ها)، پوشش و جامه (جنس پارچه اعم از پشم زبر، کرباس، چرم کهنه، رنگ جامه، لکه‌های خاک و کار، شال کمر، پاپوش و سلاح آویخته)، و دست‌ها یا حرکات بدنی (پینه‌های انگشتان، تکیه بر عصا، مالیدن تسمه) را با نثری حسی و ملموس در دل روایت بتن!\n` +
          `• دستور حضور شخصیت‌ها و پیوستگی مکانی: شخصیت‌هایی که برچسب «مستقر در این پایگاه/مکان — هنوز در صحنه حاضر نیست» دارند، در این مکان کلی حضور یا اقامت دارند اما هنوز در این صحنهٔ مشخص رو در روی بازیکن نیستند. هرگز آنها را بدون مقدمه، بدون صدا زدن یا بدون تغییر تدریجی صحنه ناگهان رو در روی قهرمان قرار نده! اگر قهرمان به حاشیهٔ رودخانه یا میان نی‌ها رفته، صحنه در خلوت و انزوای کامل است؛ افراد مستقر کنار آتش یا بارانداز از حوادث بی‌صدا یا درگیری‌های محدود در دل نی‌زار کاملاً بی‌خبرند و در جای خود باقی می‌مانند.\n` +
          `• دستور حضور کاروان‌ها و شخصیت‌های مسافر: شخصیت‌هایی که برچسب [همراه کاروان تجاری: ...] دارند، همراه با کاروان‌های تجاری که به این مکان می‌رسند در این محل حضور دارند. حتی اگر شهر یا اقامتگاه دائمی آنها در شناسنامه جهان در شهر دیگری ثبت شده باشد، به واسطهٔ حضور کاروان، آنها هم‌اکنون به صورت ملموس در کاروانسرا، بارانداز، کنار شترها و ارابه‌ها یا دروازهٔ بازار این مکان حضور دارند و شخصیت‌هایی واقعی برای گفت‌وگو، دادوستد، گرفتن مأموریت محافظت از کاروان یا پرس‌وجو هستند.\n` +
          `• دستور مؤکد معرفی تدریجی در روایت در برابر گزینه‌ها: شخصیت‌هایی که برچسب «مستقر در این پایگاه/مکان — هنوز در صحنه حاضر نیست» دارند، هنوز با قهرمان داستان رو در رو نشده‌اند. در صورتی که اقدام بازیکن به سمت قلمرو آنها باشد (مثلاً رفتن به سمت کجاوه‌ها یا جست‌وجوی راه‌بلد)، می‌توانی آنها را به شکلی طبیعی و با دیالوگ در نثر صحنه معرفی کنی. اما اکیداً نباید نام آنها را تا پیش از معرفی در متن، در گزینه‌های انتخابی (choices) بیاوری!`
        );
      }

      if (context.relevantMemories.length > 0) {
        const mems = context.relevantMemories
          .map((m) => `• [${m.category.toUpperCase()}] (اهمیت: ${m.importance}/10): ${m.summary}`)
          .join('\n');
        parts.push(`[حافظه و رویدادهای گذشته / RELEVANT MEMORIES]\n${mems}`);
      }

      if (context.resolvedGameOutcome) {
        const mixedDirectiveFa = outcomeDirective(context.resolvedGameOutcome.outcome, false);
        const failureBlockFa = failureForwardBlock(context.resolvedGameOutcome, false);
        parts.push(
          `[نتیجه محاسباتی موتور بازی / PRE-RESOLVED OUTCOME]\n` +
          `• عمل انجام شده توسط بازیکن: "${context.resolvedGameOutcome.actionText}"\n` +
          `• نتیجه تاس و بررسی: ${context.resolvedGameOutcome.outcome.toUpperCase()}\n` +
          `• پیامد: ${context.resolvedGameOutcome.consequence}\n` +
          (context.resolvedGameOutcome.costLine ? `• هزینه (اجباری — حتماً در متن نشان بده): ${context.resolvedGameOutcome.costLine}\n` : '') +
          (mixedDirectiveFa ? `${mixedDirectiveFa}\n` : '') +
          (failureBlockFa ? `${failureBlockFa}\n` : '') +
          `• دستور مؤکد روایی: روایت را بلافاصله با انجام همین اقدام توسط قهرمان داستان آغاز کن و واکنش مستقیم، شخصی و عینیِ شخصیت یا مانع مورد اقدام (نه یک فرمانده غایب) را با دیالوگ مستقیم («...») نشان بده! از ابداع موانع فیزیکیِ ذکرنشده (مثل بارهای انباشته) بپرهیز و هرگز صحنه را با توصیفات منفعل پس‌زمینه که این اقدام در آن گم شود پر نکن.`
        );
      }

      if (context.recentSceneSnippets.length > 0) {
        parts.push(`[خلاصه صحنه قبلی / RECENT SCENE]\n${context.recentSceneSnippets.join('\n\n')}`);
      }

      if (context.recentCompletedActions && context.recentCompletedActions.length > 0) {
        parts.push(
          `[اقدامات اخیراً انجام‌شده و حل‌شده — لزوم پیشروی داستان و ممنوعیت تکرار / COMPLETED ACTIONS]\n` +
          `قهرمان داستان این اقدامات را در نوبت‌های اخیر به انجام رسانده و پشت سر گذاشته است:\n` +
          context.recentCompletedActions.map((a) => `• ${a}`).join('\n') +
          `\n• دستور اکید جلوگیری از درجا زدن و تکرار: این اقدامات پایان یافته‌اند و مانع مربوطه پشت سر گذاشته شده است. پیشنهاد دادن انتخاب‌هایی که همان کارهای قبلی را با بیانی دیگر تکرار کنند (مانند عبور مجدد از معبری که قبلاً از آن گذشته، یا تکرار همان اقدام موفق) اکیداً ممنوع است! داستان و شخصیت باید وارد فاز بعدی، معبر بعدی یا فضای جدید پس از این اقدام شوند و گزینه‌های جدیدی متناسب با موقعیت پیش‌رو به بازیکن ارائه دهی.`
        );
      }

      // Narrative goal / upcoming milestone encounter directive & Arc Stages
      if (context.activeChapterGoal || context.activeChapterTitle || context.activeChapterStages?.length) {
        const stageLines = context.activeChapterStages?.length
          ? `\nمراحل قوس روایی فصل / Arc Stages:\n` +
            context.activeChapterStages
              .map((st) => `  ${st.order}. [${st.title}]: ${st.description}`)
              .join('\n')
          : '';
        parts.push(
          `[جهت‌گیری روایی و مراحل قوس داستانی / UPCOMING MILESTONE & ARC STAGES]\n` +
          (context.activeChapterTitle ? `فصل: ${context.activeChapterTitle}\n` : '') +
          (context.activeChapterGoal ? `هدف کلی روایی فصل: «${context.activeChapterGoal}»\n` : '') +
          stageLines +
          `\n• دستور مؤکد راوی: وقایع، سرنخ‌های محیطی، بن‌بست‌ها و گزینه‌ها باید دقیقاً در راستای مراحل همین قوس روایی پیش بروند! اگر بازیکن در ساحل گل‌آلود و نیزار است، این پیشروی باید سرنخی ملموس از معبر پنهان نفوذ به پایاب زیرین پل، پایه‌های سنگی، یا بلم‌رانان هور آشکار کند نه اینکه در حلقه‌ای بی‌هدف از خطرات نامربوط بچرخد.`
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
          `[ساعت‌های تهدید فعال / ACTIVE THREAT CLOCKS]\n${context.activeClocks.map((x) => `• ${x}`).join('\n')}\nتنش فزاینده را در نثر منعکس کن؛ هر جابه‌جایی را در «clockChanges» اعلام کن (قرارداد ساعت تنش را ببین). وقتی ساعتی به سقف رسید، بحرانش را همین حالا در نثر آزاد کن و سپس آن را بخوابان.`
        );
      }
      if (context.displacementDirective) {
        parts.push(context.displacementDirective);
      }
      if (choiceMaterial) {
        parts.push(`[مصالح انتخاب زمینه‌ای / CONTEXTUAL CHOICE MATERIAL]\n${choiceMaterial}`);
      }

      parts.push(`[دستور نهایی]\nصحنه بعدی داستان را با نثر ادبی و تاثیر نتیجه تاس بنویس و ۲ تا ۴ انتخاب کاملاً منطبق بر متن صحنه (بدون ابداع موارد ذکرنشده) در قالب JSON برگردان.`);
    }

    return {
      systemPrompt,
      userPrompt: parts.join('\n\n'),
      isEnglish,
      playerStatIds: context.playerStatus?.stats || {},
      isLowBase,
      statIdAliases: buildStatIdAliases(statsDefs),
    };
  }

  /**
   * Generates opening choices tailored specifically to an already-authored opening
   * beat narrative text. Unlike buildNarrativePrompt, this does NOT instruct the
   * model to author a new narrative beat or advance the timeline, avoiding
   * phantom beast attacks, ungrounded combat paranoia, or narrative desynchronization.
   */
  public static buildOpeningChoicesPrompt = buildOpeningChoicesPrompt;

  /**
   * Generates ONLY choices tailored to an already established, validated narrative scene.
   * Used when prose validation passed, but choices were invalid, dropped by sanitizers,
   * or flagged by AOT audits. Avoids discarding or rewriting high-quality 700-word prose.
   */
  public static buildChoicesOnlyPrompt = buildChoicesOnlyPrompt;

  // Private static helpers preserved for backwards-compatible internal access
  private static buildStatIdAliases = buildStatIdAliases;
  private static outcomeDirective = outcomeDirective;
  private static failureForwardBlock = failureForwardBlock;
  private static journeyBlock = journeyBlock;
}
