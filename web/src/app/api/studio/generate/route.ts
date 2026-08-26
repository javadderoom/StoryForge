import { NextRequest, NextResponse } from 'next/server';
import { generateStructuredJson } from '@/lib/ai/geminiClient';
import {
  GenesisWorldSchema,
  ContradictionAuditReportSchema,
  buildGenesisUserPrompt,
  buildAuditUserPrompt,
  GENESIS_SYSTEM_DIRECTIVES,
  AUDIT_SYSTEM_DIRECTIVES,
  GenesisWorldData,
  ContradictionFinding,
  normalizeGenesisData,
} from '@/lib/engines/world/GenesisSchemas';
import { LoreAuditor } from '@/lib/engines/world/LoreAuditor';
import { WorldBible, SagaManifest } from '@/lib/types/world';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';

interface GenerateRequest {
  type:
    | 'world'
    | 'location'
    | 'npc'
    | 'faction'
    | 'artifact'
    | 'creature'
    | 'deity'
    | 'timeline_event'
    | 'world_law'
    | 'scene'
    | 'location_subzones'
    | 'populate_location'
    | 'npc_relationships'
    | 'npc_voice_guide'
    | 'npc_stat_calibration'
    | 'epoch_arc'
    | 'timeline_ripple'
    | 'artifact_enhanced'
    | 'creature_ecology'
    | 'religion_schisms'
    | 'rpg_system_synthesis'
    | 'branching_story_tree'
    | 'epic_saga_synthesis'
    | 'genesis'
    | 'audit_world';


  prompt?: string;
  themeContext?: string;
  customSystemPrompt?: string;
  taskType?: 'world' | 'scene' | 'default';
  isPersian?: boolean;
  worldBible?: WorldBible;
  // Author-controlled generation constraints (the "type" they want the AI to honor)
  rarity?: 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
  speciesCategory?: 'beast' | 'monstrosity' | 'undead' | 'elemental' | 'flora' | 'draconic';
  domain?: 'light' | 'secrets' | 'death' | 'war' | 'nature' | 'chaos' | 'forge';
  category?: 'magic' | 'physics' | 'society' | 'divine';
  eraCategory?: 'ancient' | 'war' | 'reign' | 'cataclysm' | 'present';
  dangerLevel?: 1 | 2 | 3 | 4 | 5;
  npcRole?: string;
  worldContext?: string;
  anchor?: string;
  // Plan 08: optional saga payload for deterministic saga-graph auditing
  saga?: SagaManifest;
}

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const {
      type,
      prompt = '',
      themeContext = '',
      customSystemPrompt,
      taskType = (type === 'world' ? 'world' : 'scene'),
      isPersian = true,
      rarity,
      speciesCategory,
      domain,
      category,
      eraCategory,
      dangerLevel,
      npcRole,
      worldContext,
      anchor,
      worldBible,
    } = body;

    // ----------------------------------------------------------------
    // Plan 01: Seed-to-Cosmos Genesis Generator
    // ----------------------------------------------------------------
    if (type === 'genesis') {
      const systemInstruction = `${GENESIS_SYSTEM_DIRECTIVES}\n\n${
        isPersian
          ? 'زبان خروجی: فارسی ادبی (رشته‌های id انگلیسی بمانند).'
          : 'Output language: literary English (keep id strings in English).'
      }`;
      const userPrompt = buildGenesisUserPrompt({ prompt, isPersian, themeContext });

      const aiResult = await generateStructuredJson<GenesisWorldData>(
        userPrompt,
        systemInstruction,
        { temperature: 0.85, taskType: 'world', maxOutputTokens: 8000 }
      );

      if (aiResult && aiResult.data) {
        const normalized = normalizeGenesisData(aiResult.data);
        return NextResponse.json({
          success: true,
          data: normalized,
          isAiGenerated: true,
          modelUsed: aiResult.modelUsed,
        });
      }



      return NextResponse.json(
        {
          success: false,
          error: isPersian
            ? 'تولید هوش مصنوعی جهان با شکست مواجه شد. لطفاً دوباره تلاش کنید.'
            : 'Genesis AI generation failed across all available models. Please check your connection or API key and try again.',
        },
        { status: 503 }
      );
    }


    // ----------------------------------------------------------------
    // Plan 01: Contradiction Radar (Lore Consistency Auditor)
    // ----------------------------------------------------------------
    if (type === 'audit_world') {
      const wb = worldBible;
      if (!wb || !wb.worldId) {
        return NextResponse.json(
          { success: false, error: 'A worldBible payload is required for audit_world.' },
          { status: 400 }
        );
      }

      const deterministic = LoreAuditor.audit(wb);

      // Plan 08: union deterministic saga-graph findings when a saga is sent.
      const sagaAudit = body.saga ? LoreAuditor.auditSaga(body.saga as SagaManifest) : null;
      if (sagaAudit) {
        deterministic.findings.push(...sagaAudit.findings);
        deterministic.score = Math.max(0, Math.min(deterministic.score, sagaAudit.score));
        deterministic.summary =
          `${deterministic.summary} ${sagaAudit.findings.length} saga issue(s) detected.`.trim();
      }

      // Try to enrich with an AI audit; if unavailable, return the deterministic one.
      const aiResult = await generateStructuredJson(
        buildAuditUserPrompt({ isPersian, worldContext: buildWorldContextString({ worldBible: wb }) }),
        AUDIT_SYSTEM_DIRECTIVES,
        { temperature: 0.3, taskType: 'world', maxOutputTokens: 6000 }
      );

      if (aiResult && aiResult.data) {
        const parsed = ContradictionAuditReportSchema.safeParse(aiResult.data);
        if (parsed.success) {
          // Union deterministic findings into the AI report so hard violations always surface.
          const mergedFindings = mergeFindings(deterministic.findings, parsed.data.findings);
          return NextResponse.json({
            success: true,
            data: {
              score: parsed.data.score,
              summary: parsed.data.summary,
              findings: mergedFindings,
            },
            isAiGenerated: true,
            modelUsed: aiResult.modelUsed,
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: deterministic,
        isAiGenerated: false,
      });
    }

    // Build author constraints so the AI honors the chosen "type" (rarity/species/domain/...)
    const constraints: string[] = [];
    if (type === 'artifact' && rarity) {
      constraints.push(`The author explicitly requested an item of RARITY "${rarity}". Output exactly that rarity value.`);
    }
    if (type === 'creature' && speciesCategory) {
      constraints.push(`The author explicitly requested a creature of SPECIES CATEGORY "${speciesCategory}". Output exactly that speciesCategory value.`);
    }
    if (type === 'deity' && domain) {
      constraints.push(`The author explicitly requested a deity of DOMAIN "${domain}". Output exactly that domain value.`);
    }
    if (type === 'world_law' && category) {
      constraints.push(`The author explicitly requested a law of CATEGORY "${category}". Output exactly that category value.`);
    }
    if (type === 'timeline_event' && eraCategory) {
      constraints.push(`The author explicitly requested a timeline event of ERA CATEGORY "${eraCategory}". Output exactly that eraCategory value.`);
    }
    if (type === 'location' && dangerLevel) {
      constraints.push(`The author explicitly requested a location with DANGER LEVEL ${dangerLevel}. Output exactly that dangerLevel value.`);
    }
    if (type === 'npc' && npcRole?.trim()) {
      constraints.push(`The author explicitly requested an NPC whose ROLE is "${npcRole.trim()}".`);
    }
    const constraintLine = constraints.length
      ? `\n\nAUTHOR CONSTRAINTS (you MUST honor these):\n- ${constraints.join('\n- ')}`
      : '';

    // Explicitly forbid duplicating existing lore. The world context lists what
    // ALREADY exists; without this directive the model imitates it and produces
    // near-clones (similar names/descriptions across generations).
    const uniquenessInstruction = isPersian
      ? worldContext
        ? '\n\nمهم — یگانگی: بخش «زمینه جهان» بالا، موجودیت‌هایی را فهرست می‌کند که هم‌اکنون در جهان وجود دارند. باید یک موجودیت کاملاً جدید و متمایز بسازی. نام، لقب یا توصیف هیچ موجودیت موجود را بازاستفاده، کپی یا بازنویسی نکن. خروجی باید از نظر نام و مفهوم کاملاً یگانه و متمایز باشد.'
        : '\n\nمهم — یگانگی: خروجی باید کاملاً بدیع، منحصربه‌فرد و متمایز باشد و با تولیدهای پیشین هم‌پوشانی نداشته باشد.'
      : worldContext
        ? '\n\nIMPORTANT — UNIQUENESS: The "World context" above lists entities that ALREADY EXIST in this world. Generate a single brand-new, distinct entity. Do NOT reuse, copy, or closely paraphrase the name, title, or description of any existing entity. Your output must be clearly unique in both name and concept.'
        : '\n\nIMPORTANT — UNIQUENESS: Ensure your output is wholly original and distinct, with no overlap with previously generated content.';

    const diversityInstruction = isPersian
      ? '\n\nتنوع مضمونی — تعادل در استفاده از خاطرات: از تمرکز مداوم و افراطی روی موضوعات «فراموشی، قربانی کردن خاطرات و از دست دادن حافظه» خودداری کن. این موضوع را فقط به عنوان یک جنبه نادر در نظر بگیر و از مضامین متنوع دیگر مانند کیمیای سیاه، نفرین‌های فیزیکی، پیمان‌های خونی، متریال‌های فاسد و دسیسه‌های سیاسی استفاده کن.'
      : '\n\nTHEMATIC DIVERSITY — MODERATE MEMORY USAGE: Do NOT overuse tropes related to memory loss, memory sacrifice, or fading recollection. Treat memory-related costs as a rare, specific mechanic rather than the default trope for every entity. Draw broadly from other dark-fantasy concepts: blood alchemy, corrosive ash, bodily transformations, political espionage, or ancient metallurgy.';


    // Use custom system prompt from UI if provided, otherwise default to context-rich prompt
    const systemPrompt =
      customSystemPrompt?.trim() ||
      `You are the Master World-Building & Narrative AI Co-Pilot for StoryForge, an advanced Interactive Fiction RPG engine.
Generate a high-quality JSON object for a ${type} within a dark fantasy / grim-arcane setting.
${isPersian ? 'Output all narrative text, names, descriptions in literary Persian (Farsi).' : 'Output in literary English.'}
Theme context: ${themeContext || 'Dark basalt mountain fortress, political tension, forbidden alchemy'}
User guidance: ${prompt || 'Create something rich with atmospheric depth and literary gravitas.'}
${worldContext ? `World context (existing lore — stay consistent with it):\n${worldContext}` : ''}${uniquenessInstruction}${diversityInstruction}${anchor ? `\n\nANCHOR — This new ${type} MUST be thematically tied to the following existing lore element; derive its concept, theme, powers/flavor, and relations from it rather than introducing an unrelated motif:\n${anchor}` : ''}
Strictly output a valid JSON object matching the requested schema. Do not enclose in markdown blocks if possible, or return clean JSON.${constraintLine}`;


    let schemaInstruction = '';
    if (type === 'world') {
      schemaInstruction = `Schema: { "worldName": string, "summary": string, "themeNotes": string, "aiSystemPrompt": string, "laws": [{ "rule": string, "category": "magic"|"physics"|"society"|"divine", "description": string, "isImmutable": true }], "factions": [{ "id": string, "name": string, "description": string, "alignment": string, "publicGoals": string, "secretAgendas": string, "scope": "street"|"regional"|"continental"|"mythic" }] } (Faction scope = the chapter tier where it becomes narratively active: street gangs/city guards are "street", kingdoms and trade leagues are "regional", empire-spanning orders are "continental", cosmic/trans-planarial dominions of gods or devils are "mythic")`;
    } else if (type === 'faction') {
      schemaInstruction = `Schema: { "name": string, "description": string, "alignment": string, "publicGoals": string, "secretAgendas": string, "territoryIds": string[], "rivalFactionIds": string[], "alliedFactionIds": string[], "scope": "street"|"regional"|"continental"|"mythic" } (scope = the chapter tier where this faction becomes narratively active; use "mythic" for cosmic dominions of gods/devils that should stay hidden until the saga's climax)`;
    } else if (type === 'location') {
      schemaInstruction = `Schema: { "name": string, "region": string, "description": string, "dangerLevel": 1|2|3|4|5, "atmosphere": string, "specialRules": string[] }`;
    } else if (type === 'npc') {
      schemaInstruction = `Schema: { "name": string, "title": string, "role": string, "currentLocationId": string, "personalityTraits": string[], "speechStyle": string, "goals": string[], "secrets": [{ "id": string, "description": string, "requiredTrustLevel": number, "revealed": false }], "initialTrust": number }`;
    } else if (type === 'artifact') {
      schemaInstruction = `Schema: { "name": string, "title": string, "originEra": string, "rarity": "uncommon"|"rare"|"epic"|"legendary"|"mythic", "description": string, "powers": string[], "curseOrCost": string, "attunementRules": string, "secretLore": string } (IMPORTANT: Prioritize tangible physical equipment — swords, daggers, axes, wands, staves, plate armor, shields, cloaks, and gauntlets — over abstract stones or conceptual trinkets. Swords, wands, and martial armor must be much more frequent. If rarity is "uncommon", "rare", or "epic", curseOrCost MUST be an empty string "" and attunementRules should be simple/clean with no drawbacks. Curses and severe attunement costs are strictly reserved for "legendary" and "mythic" tiers)`;
    } else if (type === 'creature') {
      schemaInstruction = `Schema: { "name": string, "speciesCategory": "beast"|"monstrosity"|"undead"|"elemental"|"flora"|"draconic", "dangerLevel": 1|2|3|4|5, "behavioralTactics": string, "weaknesses": string[], "resistances": string[], "harvestableLoot": [{ "itemId": string, "name": string, "dropRate": string }], "loreDescription": string }`;
    } else if (type === 'deity') {
      schemaInstruction = `Schema: { "name": string, "title": string, "domain": "light"|"secrets"|"death"|"war"|"nature"|"chaos"|"forge", "sacredSymbol": string, "coreDogma": string, "taboos": string[], "divineBlessings": string[] }`;
    } else if (type === 'timeline_event') {
      schemaInstruction = `Schema: { "yearOrEra": string, "title": string, "summary": string, "significance": string, "knownByPublic": boolean, "eraCategory": "ancient"|"war"|"reign"|"present" }`;
    } else if (type === 'world_law') {
      schemaInstruction = `Schema: { "rule": string, "category": "magic"|"physics"|"society"|"divine", "description": string, "isImmutable": true }`;
    } else if (type === 'location_subzones') {
      schemaInstruction = `Schema: { "parentLocationId": string, "subZones": [{ "id": string, "name": string, "subType": "dungeon"|"sanctuary"|"ruin"|"vault"|"market"|"hazard_zone", "dangerLevel": 1|2|3|4|5, "atmosphere": string, "explorationHooks": string[], "pointsOfInterest": [{ "name": string, "description": string, "skillCheck": { "attribute": string, "dc": number, "failureConsequence": string } }] }] } (Generate 3 to 5 deeply atmospheric, interconnected sub-zones with tangible points of interest and reader skill checks)`;
    } else if (type === 'populate_location') {
      schemaInstruction = `Schema: { "locationId": string, "npcs": [{ "id": string, "name": string, "title": string, "role": string, "currentLocationId": string, "personalityTraits": string[], "speechStyle": string, "goals": string[], "secrets": [{ "id": string, "description": string, "requiredTrustLevel": number, "revealed": false }], "initialTrust": number }], "creature": { "id": string, "name": string, "speciesCategory": "beast"|"monstrosity"|"undead"|"elemental"|"flora"|"draconic", "dangerLevel": 1|2|3|4|5, "habitatLocationIds": string[], "behavioralTactics": string, "weaknesses": string[], "resistances": string[], "harvestableLoot": [{ "itemId": string, "name": string, "dropRate": string }], "loreDescription": string }, "hiddenRelic": { "id": string, "name": string, "title": string, "originEra": string, "rarity": "uncommon"|"rare"|"epic"|"legendary"|"mythic", "description": string, "powers": string[], "curseOrCost": string, "attunementRules": string, "currentHolderType": "location", "currentHolderId": string, "secretLore": string } } (Generate a synchronized micro-ecosystem: 2 resident NPCs, 1 native creature, and 1 hidden artifact all themed to the location. Note: The hiddenRelic should preferably be a tangible weapon, wand, stave, shield, or armor piece. If hiddenRelic is uncommon/rare/epic, curseOrCost must be "" with clean attunement; reserve curses strictly for legendary and mythic tiers)`;
    } else if (type === 'npc_relationships') {
      schemaInstruction = `Schema: { "sourceNpcId": string, "sourceNpcName": string, "bonds": [{ "id": string, "sourceNpcId": string, "targetNpcId": string, "targetNpcName": string, "relationTypeId": "blood_debt"|"mentor_apprentice"|"ally"|"rival"|"faction_ally"|"custom", "affinity": number (-100 to 100), "secretTension": string, "isPublic": boolean }] } (Generate 2 to 4 dramatic interpersonal bonds between this character and other existing NPCs in the world context. MUST connect to real characters in the world when available)`;
    } else if (type === 'npc_voice_guide') {
      schemaInstruction = `Schema: { "npcName": string, "speechQuirks": string[], "sampleDialogue": [{ "context": "greeting"|"bargaining"|"threatened"|"dying", "quote": string }], "negotiationVulnerabilities": string[], "psychologicalBreakingPoint": string } (Generate a Voice & Dialogue Style Guide with 4 distinct sample quotes for greeting, bargaining, threatened, and dying contexts)`;
    } else if (type === 'npc_stat_calibration') {
      schemaInstruction = `Schema: { "npcId": string, "npcName": string, "combatTier": "civilian"|"apprentice"|"veteran"|"elite"|"boss"|"mythic", "challengeRating": number (1 to 20), "statRatings": { [stat: string]: number }, "signatureAbilities": string[], "equippedGear": [{ "name": string, "type": string, "description": string }] } (Calibrate RPG stats, combat rating, signature powers, and martial/spellcasting equipment for this character)`;
    } else if (type === 'epoch_arc') {
      schemaInstruction = `Schema: { "eras": [{ "eraName": string, "timeframe": string, "description": string, "majorCataclysm": string, "legacyFactions": string[] }], "keyEvents": [{ "title": string, "eraName": string, "narrativeSummary": string, "lastingConsequences": string }] } (Generate a cohesive 3-era historical macro-arc: 1. Age of Creation / Mythic Dawn, 2. The Great Cataclysm / War of Ruin, 3. The Present Ash / Modern Age, along with at least 4 key turning point events across these eras)`;
    } else if (type === 'timeline_ripple') {
      schemaInstruction = `Schema: { "sourceEventTitle": string, "modernRepercussions": [{ "targetType": "faction"|"location"|"artifact"|"religion", "targetName": string, "effectDescription": string }] } (Propagate 2 to 4 cascading historical consequences across modern factions, sacred sites, relics, or religious schisms resulting from this ancient event)`;
    } else if (type === 'artifact_enhanced') {
      schemaInstruction = `Schema: { "name": string, "rarity": "uncommon"|"rare"|"epic"|"legendary"|"mythic", "attunementCost": string, "activePower": string, "doubleEdgedCurse": string, "vaultLore": { "creator": string, "currentVaultLocation": string, "unsealingRitual": string, "rivalSeekers": string[] } } (IMPORTANT: Prioritize tangible physical equipment — swords, daggers, axes, wands, staves, plate armor, shields, gauntlets, cloaks. If rarity is uncommon, rare, or epic, doubleEdgedCurse MUST be "" and attunementCost should be simple without negative drawbacks. Curses and severe sacrifices are strictly reserved for legendary and mythic tiers. Vault location and rival seekers must tie into existing world locations and factions when possible)`;
    } else if (type === 'creature_ecology') {
      schemaInstruction = `Schema: { "name": string, "speciesCategory": "beast"|"monstrosity"|"undead"|"elemental"|"flora"|"draconic"|"humanoid", "habitatLocationName": string, "predatorPreyNiche": string, "nonCombatPacificationMethod": string, "alchemicalYields": [{ "reagentName": string, "rarity": "uncommon"|"rare"|"epic", "craftingUse": string }] } (Generate ecological food chain dynamics, behavioral tactics, non-lethal pacification methods, and 1 to 3 harvestable alchemical / crafting reagents used for potions, forging, or ritual spellcraft)`;
    } else if (type === 'religion_schisms') {
      schemaInstruction = `Schema: { "name": string, "domain": string, "sacredTaboos": string[], "divineOmensForViolation": string, "divineBlessing": string, "sectarianSchisms": [{ "cultName": string, "heresyDoctrine": string, "headquartersLocation": string }] } (Generate strict sacred taboos, chilling divine omens/wrath triggers for blasphemers, blessings for faithful devotees, and 1 to 3 underground heresy splinter cults/schisms)`;
    } else if (type === 'rpg_system_synthesis') {
      schemaInstruction = `Schema: { "themeJustification": string, "stats": [{ "id": string, "nameFa": string, "nameEn": string, "description": string, "defaultValue": number }], "resources": [{ "id": string, "nameFa": string, "nameEn": string, "maxValue": number, "decayRule": string }], "archetypes": [{ "name": string, "description": string, "startingStats": Record<string, number>, "signaturePerk": string, "startingInventory": string[] }] } (Synthesize 4 to 6 core attributes, 2 to 4 vital resources/pools, and 4 thematic starting archetypes directly derived from the story's theme notes and world laws. Prioritize unique thematic flavor, e.g. Sanity/Paranoia for cosmic horror, Lineage/Guile for political intrigue)`;
    } else if (type === 'branching_story_tree') {
      schemaInstruction = `Schema: { "title": string, "premise": string, "acts": [{ "actNumber": number, "actTitle": string, "scenes": [{ "sceneId": string, "title": string, "settingLocationName": string, "primaryConflict": string, "presentedChoices": [{ "style": "defensive_diplomatic"|"tactical_agile"|"aggressive_daring", "textFa": string, "textEn": string, "statCheck": { "stat": string, "dc": number }, "leadToSceneId": string }] }] }] } (Synthesize a complete 3-Act branching story graph where Act 1 introduces the hook, Act 2 builds rising tension with branching pathways, and Act 3 delivers climactic payoffs. Every scene MUST feature 3 distinct choice archetypes: 1. defensive_diplomatic, 2. tactical_agile, 3. aggressive_daring. Stat checks must use realistic DCs between 10 and 20)`;
    } else if (type === 'epic_saga_synthesis') {
      schemaInstruction = `Schema: { "sagaTitle": string, "premise": string, "chapters": [{ "chapterNumber": number, "title": string, "scopeTier": "street"|"regional"|"continental"|"mythic", "narrativeGoal": string, "prerequisiteFlags": string[], "completionSummaryPrompt": string, "scenes": [{ "sceneId": string, "title": string, "settingLocationName": string, "primaryConflict": string, "presentedChoices": [{ "style": "defensive_diplomatic"|"tactical_agile"|"aggressive_daring", "textFa": string, "textEn": string, "statCheck": { "stat": string, "dc": number }, "leadToSceneId": string }] }] }] } (👑 Synthesize a FULL 5-CHAPTER EPIC SAGA with strictly escalating narrative scope: Chapter 1 must stay street-level and grounded (threat level 1-2, personal stakes), Chapter 2 expands to city/faction politics ("street" or "regional"), Chapter 3 escalates to a regional conflict that breaks the seal on a larger war, Chapter 4 becomes a continental campaign ("continental"), and Chapter 5 delivers the mythic climax and epoch dawn ("mythic"). Each chapter contains 3 to 5 linked scenes; every scene features exactly 3 choice archetypes: defensive_diplomatic, tactical_agile, aggressive_daring. Choices may chain within a chapter via leadToSceneId using declared sceneIds. Use settingLocationName values that match existing world locations when possible. DCs must be realistic (10-20). Each chapter's completionSummaryPrompt is a one-sentence directive for how the AI should compress the chapter into an episodic milestone rollup.)`;
    } else if (type === 'scene') {
      schemaInstruction = `Schema: { "sceneId": string, "locationId": string, "narrativeText": string, "choices": [{ "id": string, "text": string, "style": "defensive"|"agile"|"aggressive"|"diplomatic"|"inquisitive", "riskLevel": "low"|"medium"|"high", "targetDC": number, "requiredStatId": string }] }`;
    }



    const effectiveSchemaInstruction = constraints.length
      ? `${constraintLine}\n${schemaInstruction}`
      : schemaInstruction;

    const userPromptText = customSystemPrompt?.trim()
      ? `Apply the requested changes to the existing ${type} entity and return the complete updated JSON strictly matching the schema:\n${effectiveSchemaInstruction}`
      : `Generate a ${type} entity with creative literary depth.\n${effectiveSchemaInstruction}`;

    const aiResult = await generateStructuredJson(
      userPromptText,
      systemPrompt,
      {
        temperature: customSystemPrompt?.trim() ? 0.7 : 0.8,
        taskType: type === 'world' ? 'world' : taskType,
      }
    );

    if (aiResult && aiResult.data) {
      return NextResponse.json({
        success: true,
        data: aiResult.data,
        isAiGenerated: true,
        modelUsed: aiResult.modelUsed,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: isPersian
          ? `تولید هوش مصنوعی برای «${type}» با شکست مواجه شد. لطفاً اتصال اینترنت یا کلید API را بررسی کرده و دوباره تلاش کنید.`
          : `AI generation for "${type}" failed across all available models after automated retries. Please check your connection or API key and try again.`,
      },
      { status: 503 }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to generate lore content' },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------------
// Plan 01 helper: audit finding merge
// ----------------------------------------------------------------------------

function mergeFindings(
  deterministic: ContradictionFinding[],
  aiFindings: ContradictionFinding[]
): ContradictionFinding[] {
  const seen = new Set<string>();
  const merged: ContradictionFinding[] = [];
  for (const f of [...deterministic, ...aiFindings]) {
    const key = `${f.category}:${f.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(f);
  }
  return merged;
}


