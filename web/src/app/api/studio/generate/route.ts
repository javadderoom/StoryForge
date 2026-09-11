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
  hasPlaceholders,
} from '@/lib/engines/world/GenesisSchemas';
import { LoreAuditor } from '@/lib/engines/world/LoreAuditor';
import { normalizeEntity } from '@/lib/engines/world/ActionNormalizer';
import { WorldBible, SagaManifest } from '@/lib/types/world';
import { StoryManifest } from '@/lib/types';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import {
  buildWeavePrompt,
  coerceWeave,
  auditWeaveQuality,
  StoryWeaveDraft,
} from '@/lib/engines/narrative/storyWeaver';

interface GenerateRequest {
  type:
    | 'world'
    | 'location'
    | 'npc'
    | 'npc_autofill'
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
    | 'chapter_scenes'
    | 'weave_story'
    | 'genesis'
    | 'audit_world';


  prompt?: string;
  themeContext?: string;
  customSystemPrompt?: string;
  taskType?: 'world' | 'scene' | 'default';
  isPersian?: boolean;
  worldBible?: WorldBible;
  // Author-controlled generation constraints (the "type" they want the AI to honor)
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
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
  // Valid RPG stat ids for saga choice validation (sent by Studio beats page)
  rpgStatIds?: string[];
  // Plan 12: Weaver parameters
  anchors?: any[];
  scope?: 'act' | 'whole_arc';
  actGoal?: string;
  chapterNumber?: number;
  existingSceneIds?: string[];
  story?: any;
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
        const toBible = (g: GenesisWorldData): WorldBible =>
          ({
            worldId: 'genesis_draft',
            worldName: g.worldName,
            summary: g.summary,
            themeNotes: g.themeNotes,
            aiSystemPrompt: g.aiSystemPrompt,
            laws: (g.laws || []) as unknown as WorldBible['laws'],
            factions: (g.factions || []) as unknown as WorldBible['factions'],
            locations: (g.locations || []) as unknown as WorldBible['locations'],
            religions: (g.religions || []) as unknown as WorldBible['religions'],
            npcs: [],
            timeline: [],
            artifacts: [],
            bestiary: [],
            dramaBonds: [],
          } as unknown as WorldBible);
        let normalized = normalizeGenesisData(aiResult.data);
        let audit = LoreAuditor.audit(toBible(normalized));
        let placeholders = hasPlaceholders(normalized);
        let repaired = false;
        let attempts = 1;

        const needsRepair =
          placeholders.length > 0 || audit.score < 85 || audit.findings.some((f) => f.severity === 'error');
        if (needsRepair) {
          const repairPrompt =
            `Your previous Genesis output has consistency issues. Fix ONLY the listed issues, preserving all valid ids, names, and cross-references.\n\n` +
            `PREVIOUS OUTPUT:\n${JSON.stringify(normalized)}\n\n` +
            `PLACEHOLDER ISSUES:\n${placeholders.join('\n') || 'none'}\n\n` +
            `AUDIT FINDINGS:\n${JSON.stringify(audit.findings.slice(0, 20))}\n\n` +
            `Return the FULL corrected Genesis JSON matching the original schema. Output valid JSON only.`;
          const retry = await generateStructuredJson<GenesisWorldData>(
            repairPrompt,
            systemInstruction,
            { temperature: 0.4, taskType: 'world', maxOutputTokens: 8000 }
          );
          if (retry && retry.data) {
            const reNormalized = normalizeGenesisData(retry.data);
            const reAudit = LoreAuditor.audit(toBible(reNormalized));
            const rePlaceholders = hasPlaceholders(reNormalized);
            const improved =
              reAudit.score > audit.score || rePlaceholders.length < placeholders.length;
            if (improved) {
              normalized = reNormalized;
              audit = reAudit;
              placeholders = rePlaceholders;
            }
            repaired = true;
            attempts = 2;
          }
        }

        const stillBlocked =
          placeholders.length > 0 || audit.score < 85 || audit.findings.some((f) => f.severity === 'error');
        if (stillBlocked) {
          return NextResponse.json(
            {
              success: false,
              error: isPersian
                ? 'خروجی جهان نیاز به بازبینی دارد. یافته‌های حسابرسی را برطرف کنید.'
                : 'Genesis output needs revision. Resolve the audit findings.',
              data: normalized,
              audit,
              placeholderIssues: placeholders,
              repaired,
              attempts,
            },
            { status: 422 }
          );
        }

        return NextResponse.json({
          success: true,
          data: normalized,
          audit,
          placeholderIssues: placeholders,
          repaired,
          attempts,
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
        const statIds = Array.isArray(body.rpgStatIds)
          ? body.rpgStatIds.filter((s): s is string => typeof s === 'string')
          : [];
        sagaAudit.findings.push(...LoreAuditor.auditSagaStats(body.saga as SagaManifest, statIds));
        sagaAudit.score = Math.max(
          0,
          sagaAudit.score - sagaAudit.findings.filter((f) => f.severity === 'error').length * 10
        );
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
    if ((type === 'creature' || type === 'creature_ecology') && speciesCategory) {
      constraints.push(`The author explicitly requested a creature of SPECIES CATEGORY "${speciesCategory}". Output exactly that speciesCategory value.`);
    }
    if (type === 'creature_ecology' && dangerLevel) {
      constraints.push(`The target creature has DANGER LEVEL ${dangerLevel}. Every predatorSpecies entry must plausibly threaten it (known danger >= ${dangerLevel}); every preySpecies entry must plausibly be hunted by it (known danger <= ${dangerLevel}). Pack hunters, swarms, parasites, ambush predators, and venomous trappers may break this ordering ONLY if predatorPreyNiche explicitly names the mechanism.`);
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
    const uniquenessInstruction = type === 'npc_autofill'
      ? ''
      : isPersian
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
      (type === 'npc_autofill'
        ? `You are the Master World-Building & Narrative AI Co-Pilot for AfsanehSaz, an advanced Interactive Fiction RPG engine.
Complete and enrich the missing or empty sections of an existing NPC using the world's lore, factions, locations, and narrative atmosphere.
${isPersian ? 'Output all narrative text, titles, roles, speech directives, goals, and secrets in literary Persian (Farsi).' : 'Output in literary English.'}
${themeContext ? `Theme context: ${themeContext}\n` : ''}User guidance & Character status: ${prompt || 'Complete missing sections.'}
${worldContext ? `World context (factions and locations to anchor to):\n${worldContext}` : ''}
Strictly output a valid JSON object matching the requested schema. Do not enclose in markdown blocks if possible, or return clean JSON.`
        : `You are the Master World-Building & Narrative AI Co-Pilot for AfsanehSaz, an advanced Interactive Fiction RPG engine.
Generate a high-quality JSON object for a ${type} matching the world's tone and setting.
${isPersian ? 'Output all narrative text, names, descriptions in literary Persian (Farsi).' : 'Output in literary English.'}
${themeContext ? `Theme context: ${themeContext}\n` : ''}User guidance: ${prompt || 'Create something rich with atmospheric depth and literary gravitas.'}
${worldContext ? `World context (existing lore — stay consistent with it):\n${worldContext}` : ''}${uniquenessInstruction}${diversityInstruction}${anchor ? `\n\nANCHOR — This new ${type} MUST be thematically tied to the following existing lore element; derive its concept, theme, powers/flavor, and relations from it rather than introducing an unrelated motif:\n${anchor}` : ''}
Strictly output a valid JSON object matching the requested schema. Do not enclose in markdown blocks if possible, or return clean JSON.${constraintLine}`);


    let schemaInstruction = '';
    if (type === 'world') {
      schemaInstruction = `Schema: { "worldName": string, "summary": string, "themeNotes": string, "aiSystemPrompt": string, "laws": [{ "rule": string, "category": "magic"|"physics"|"society"|"divine", "description": string, "isImmutable": true }], "factions": [{ "id": string, "name": string, "description": string, "alignment": string, "publicGoals": string, "secretAgendas": string, "scope": "street"|"regional"|"continental"|"mythic" }] } (Faction scope = the chapter tier where it becomes narratively active: street gangs/city guards are "street", kingdoms and trade leagues are "regional", empire-spanning orders are "continental", cosmic/trans-planarial dominions of gods or devils are "mythic")`;
    } else if (type === 'faction') {
      schemaInstruction = `Schema: { "name": string, "description": string, "alignment": string, "publicGoals": string, "secretAgendas": string, "territoryIds": string[], "rivalFactionIds": string[], "alliedFactionIds": string[], "relations": [{ "targetFactionId": string, "value": "allied"|"favorable"|"neutral"|"rival"|"hostile", "note": string }], "scope": "street"|"regional"|"continental"|"mythic" } (scope = the chapter tier where this faction becomes narratively active; relations use the 5-state spectrum: allied (+2), favorable (+1), neutral (0), rival (-1), hostile (-2))`;
    } else if (type === 'location') {
      schemaInstruction = `Schema: { "name": string, "region": string, "description": string, "dangerLevel": 1|2|3|4|5, "atmosphere": string, "specialRules": string[] }`;
    } else if (type === 'npc') {
      schemaInstruction = `Schema: { "name": string, "title": string, "role": string, "kind": "individual"|"template", "currentLocationId": string, "applicableLocationIds": string[], "personalityTraits": string[], "speechStyle": string, "goals": string[], "secrets": [{ "id": string, "description": string, "requiredTrustLevel": number, "revealed": false }], "initialTrust": number } (If kind is "template", this represents a generic crowd archetype / mob template e.g. "City Watch Patrol" or "Dockside Broker", with group speech quirks, applicableLocationIds, and general collective goals rather than personal secrets)`;
    } else if (type === 'npc_autofill') {
      schemaInstruction = `Schema: { "title": string, "role": string, "factionId": string, "currentLocationId": string, "applicableLocationIds": string[], "personalityTraits": string[], "speechStyle": string, "goals": string[], "secrets": [{ "id": string, "description": string, "requiredTrustLevel": number, "revealed": false, "revealMethods": [{ "kind": "trust"|"clue"|"item"|"location"|"pressure"|"quest"|"ritual", "detail": string }] }], "initialTrust": number } (Fill in any missing or empty sections of this NPC using world lore. Do NOT contradict or modify what is already provided; organically fill in the blanks.)`;
    } else if (type === 'artifact') {
      schemaInstruction = `Schema: { "name": string, "title": string, "originEra": string, "rarity": "uncommon"|"rare"|"epic"|"legendary"|"mythic", "description": string, "powers": string[], "curseOrCost": string, "attunementRules": string, "secretLore": string } (IMPORTANT: Prioritize tangible physical equipment — swords, daggers, axes, wands, staves, plate armor, shields, cloaks, and gauntlets — over abstract stones or conceptual trinkets. Swords, wands, and martial armor must be much more frequent. If rarity is "uncommon", "rare", or "epic", curseOrCost MUST be an empty string "" and attunementRules should be simple/clean with no drawbacks. Curses and severe attunement costs are strictly reserved for "legendary" and "mythic" tiers)`;
    } else if (type === 'creature') {
      schemaInstruction = `Schema: { "name": string, "speciesCategory": "beast"|"monstrosity"|"undead"|"elemental"|"flora"|"draconic"|"humanoid"|"mineral", "dangerLevel": 1|2|3|4|5, "rarity": "common"|"uncommon"|"rare"|"legendary", "isDomesticated"?: boolean, "habitatLocationIds": string[], "behavioralTactics": string, "weaknesses": string[], "resistances": string[], "harvestableLoot": [{ "itemId": string, "name": string, "dropRate": string }], "loreDescription": string, "extractionMethod"?: string, "craftingProperties"?: string } (If speciesCategory is "flora", this represents a botanical, fungal, or herbal organism: describe growth habits, magical/medicinal properties, seasonal blossoms, or harvesting conditions. If speciesCategory is "mineral", this represents an ore, crystal cluster, geological deposit, or alchemical salt: describe extraction conditions/hazards in extractionMethod, crafting/alchemical uses in craftingProperties, and leave behavioralTactics as mining or stabilization precautions. If the creature is a mount, livestock, guard animal, or otherwise tame/ridable, set isDomesticated true and describe training, handling, and husbandry in behavioralTactics. Rarity reflects world population: "common" for abundant deposits/weeds/fauna, "uncommon" for scattered ores/flora/predators, "rare" for scarce minerals/medicinal herbs/apex beasts, "legendary" for mythic or solitary specimens)`;
    } else if (type === 'deity') {
      schemaInstruction = `Schema: { "name": string, "title": string, "domain": "light"|"secrets"|"death"|"war"|"nature"|"chaos"|"forge", "sacredSymbol": string, "coreDogma": string, "taboos": string[], "divineBlessings": string[] }`;
    } else if (type === 'timeline_event') {
      schemaInstruction = `Schema: { "yearOrEra": string, "title": string, "summary": string, "significance": string, "knownByPublic": boolean, "eraCategory": "ancient"|"war"|"reign"|"present" }`;
    } else if (type === 'world_law') {
      schemaInstruction = `Schema: { "rule": string, "category": "magic"|"physics"|"society"|"divine", "description": string, "isImmutable": true }`;
    } else if (type === 'location_subzones') {
      schemaInstruction = `Schema: { "parentLocationId": string, "subZones": [{ "id": string, "name": string, "subType": "dungeon"|"sanctuary"|"ruin"|"vault"|"market"|"hazard_zone", "dangerLevel": 1|2|3|4|5, "atmosphere": string, "explorationHooks": string[], "pointsOfInterest": [{ "name": string, "description": string, "skillCheck": { "attribute": string, "dc": number, "failureConsequence": string } }] }] } (Generate 3 to 5 deeply atmospheric, interconnected sub-zones with tangible points of interest and reader skill checks)`;
    } else if (type === 'populate_location') {
      schemaInstruction = `Schema: { "locationId": string, "npcs": [{ "id": string, "name": string, "title": string, "role": string, "currentLocationId": string, "personalityTraits": string[], "speechStyle": string, "goals": string[], "secrets": [{ "id": string, "description": string, "requiredTrustLevel": number, "revealed": false }], "initialTrust": number }], "creature": { "id": string, "name": string, "speciesCategory": "beast"|"monstrosity"|"undead"|"elemental"|"flora"|"draconic"|"mineral", "dangerLevel": 1|2|3|4|5, "habitatLocationIds": string[], "behavioralTactics": string, "weaknesses": string[], "resistances": string[], "harvestableLoot": [{ "itemId": string, "name": string, "dropRate": string }], "loreDescription": string, "extractionMethod"?: string, "craftingProperties"?: string }, "hiddenRelic": { "id": string, "name": string, "title": string, "originEra": string, "rarity": "uncommon"|"rare"|"epic"|"legendary"|"mythic", "description": string, "powers": string[], "curseOrCost": string, "attunementRules": string, "currentHolderType": "location", "currentHolderId": string, "secretLore": string } } (Generate a synchronized micro-ecosystem: 2 resident NPCs, 1 native creature or mineral vein, and 1 hidden artifact all themed to the location. Note: The hiddenRelic should preferably be a tangible weapon, wand, stave, shield, or armor piece. If hiddenRelic is uncommon/rare/epic, curseOrCost must be "" with clean attunement; reserve curses strictly for legendary and mythic tiers)`;
    } else if (type === 'npc_relationships') {
      schemaInstruction = `Schema: { "sourceNpcId": string, "sourceNpcName": string, "bonds": [{ "id": string, "sourceNpcId": string, "targetNpcId": string, "targetNpcName": string, "relationTypeId": "blood_debt"|"mentor_apprentice"|"ally"|"rival"|"faction_ally"|"custom", "affinity": number (-100 to 100), "secretTension": string, "isPublic": boolean }] } (Generate 2 to 4 dramatic interpersonal bonds between this character and other existing NPCs in the world context. MUST connect to real characters in the world when available. TARGET NPC ID RULE: The "targetNpcId" field MUST be the exact "id" (e.g. "npc_...") from the Available World NPCs list provided in the prompt. Do NOT invent new slug IDs or transliterated names like "mehrdad_kateb". "targetNpcName" must be the exact name of that NPC. CONSISTENCY & DEDUPLICATION: If existing bonds are provided in the prompt, prioritize forging bonds with other world NPCs who lack existing ties. If synthesizing a bond with an already-linked NPC, evolve and deepen that dynamic without introducing jarring contradictions)`;
    } else if (type === 'npc_voice_guide') {
      schemaInstruction = `Schema: { "npcName": string, "speechQuirks": string[], "sampleDialogue": [{ "context": "greeting"|"bargaining"|"threatened"|"dying", "quote": string }], "negotiationVulnerabilities": string[], "psychologicalBreakingPoint": string } (Generate a Voice & Dialogue Style Guide with 4 distinct sample quotes for greeting, bargaining, threatened, and dying contexts.
GROUP ARCHETYPES & MOB TEMPLATES: If the prompt specifies a group archetype or template (e.g. sentries, watchmen, caravaners, citizens, mobs), "npcName" MUST be the exact name of the group from the prompt. NEVER hallucinate a fictional individual commander, captain, or champion (e.g. "پهلوان سالار ..."). The dialogue quotes, quirks, and psychological breaking points must represent ordinary rank-and-file members of that group.
SECRET HANDLING — ABSOLUTE RULE: The character must NEVER directly reveal, confess, name, or explicitly reference their hidden secrets in ANY sample dialogue quote. Secrets are AUTHOR-ONLY context for shaping psychology and subtext. Instead:
- "greeting" & "bargaining": Normal persona. Zero hint of secrets. Show their public mask.
- "threatened": Show cracks through SUBTEXT — nervous deflection, overreaction to certain topics, cryptic slips, sudden aggression when a sensitive subject is touched. The player should sense something is off without being told what.
- "dying": Anguish, regret, or cryptic final words that ALLUDE to hidden burdens without spelling them out. A dying spy might say "They'll never know what I carried..." not "I was a spy for the Shadow Court."
- "psychologicalBreakingPoint": Describe the PRESSURE TYPE that breaks them (e.g. "exposure of disloyalty", "losing their protégé") — not the literal secret content.
- "negotiationVulnerabilities": Behavioral tells and emotional leverage points, not secret reveals.
DISPOSITION: If an initial trust/disposition value is provided, reflect it in tone — hostile NPCs should have cold, menacing, or contemptuous dialogue; friendly NPCs warm and open.)`;
    } else if (type === 'npc_stat_calibration') {
      schemaInstruction = `Schema: { "npcId": string, "npcName": string, "combatTier": "civilian"|"apprentice"|"veteran"|"elite"|"boss"|"mythic", "challengeRating": number (1 to 30), "crBasis": string (non-combat threat source, or "" when CR is pure combat), "statRatings": { [stat: string]: number }, "signatureAbilities": string[], "equippedGear": [{ "name": string, "type": string, "description": string }], "vitals": { "health": { "current": number, "max": number }, "stamina"?: { "current": number, "max": number }, "mana"?: { "current": number, "max": number } }, "resourcePools": [{ "id": string, "name": string, "current": number, "max": number }] } (👑 REALISTIC LONG-SAGA RPG STAT CALIBRATION (Scale: 1 to 30):
The story is a long-running narrative saga with extensive progression runway. Starting values for ordinary mortals MUST be grounded much lower than 10 so there is room for long-term growth.
CRITICAL ATTRIBUTE KEYS RULE: The dictionary keys in "statRatings" MUST EXACTLY MATCH the canonical ASCII attribute IDs provided in the prompt (e.g. "might", "cunning", "agility", "arcana", "charisma"). NEVER translate dictionary keys into Persian or any other language, and NEVER invent or misspell keys. Keys are strict programmatic code identifiers; only descriptive text (abilities, gear descriptions) should be in the narrative language.
COMBAT TIER ≠ CHALLENGE RATING — two independent axes:
- "combatTier" rates PERSONAL fighting ability only (training, strength, combat magic, gear).
- "challengeRating" (1 to 30) rates OVERALL threat of confronting, defying, or removing the character: political influence, wealth, spy networks, secrets, faction backing, non-combat magic — NOT just swordplay. A civilian-tier schemer can be CR 12+; a veteran-tier drifter with no power base can be CR 3.
- "crBasis": short phrase naming the non-combat threat source whenever CR outruns combat ability (e.g. "commands the city watch", "holds the heir's debts", "archmage patron"); "" when CR is pure combat.
CHALLENGE RATING RUBRIC (anchor here; when in doubt choose the LOWER end):
- CR 1-2: harmless nobody; defying or removing them has no consequences.
- CR 3-5: local nuisance; a few allies, minor resources, neighborhood pull.
- CR 6-8: local power; commands a crew, holds an office, or has real wealth.
- CR 9-12: regional player; faction backing, spy or trade networks, court access.
- CR 13-16: moves kingdoms; armies, courts, or archmages answer to them.
- CR 17-20: continental or epochal consequences; sovereigns, primordials, demigods.
- CR 21-25: world-ending; confronting them reshapes continents, seas, or ages.
- CR 26-30: cosmic / epochal; outer entities, god-slayers, epoch-ending absolutes. Reserve strictly for cosmic bosses and mythic-tier entities.
- CR above 8 REQUIRES concrete assets named in "crBasis". Title, story importance, or hostility alone NEVER justify high CR. CR above 20 additionally REQUIRES mythic combatTier and cosmic-scale assets in "crBasis".
COSMIC SCALE (stats above 20): mythic-tier entities may carry statRatings above 20 (up to ~30) and vitals far beyond mortal bands — do NOT compress a cosmic target into the mortal 1-20 band; rate honestly. Narrator guidance for such entities: checks against them use mythic DCs (25-30), and signatureAbilities should include phase transitions or arena-scale effects so the confrontation stays dramatic instead of collapsing into a single opposed roll.
COMBAT TIERS (fighting ability only):
- "civilian": Everyday commoners, clerks, young merchants, brokers, scholars, servants, elders, children. Typical stats range 2 to 6. Abilities: [] (0 combat abilities; at most 1 mundane trade trick). Gear: simple clothes, ledgers, everyday tools, eating knife.
- "apprentice": Town watch recruits, militia, novice acolytes, petty cutpurses, junior scouts. Typical stats range 5 to 8. Abilities: 1 basic technique or stance. Gear: basic iron weapon, padded or leather armor.
- "veteran": Seasoned mercenaries, knight lieutenants, court battlemages, veteran rangers. Typical stats range 8 to 12 (reaching double digits only through years of combat/discipline). Abilities: 1-2 tactical maneuvers. Gear: forged steel arms, mail/chain armor.
- "elite": Royal champions, archmages, inquisitors, guildmasters, master monks. Peak mortal mastery. Typical stats range 12 to 15. Abilities: 2-3 formidable signature powers. Gear: masterwork or enchanted arms.
- "boss": Sovereign warlords, elder monstrosities, high arch-villains, faction heads. Typical stats range 15 to 18. Abilities: 3-4 phase-defining powers.
- "mythic": Primordial titans, avatars, demigods, epoch-ending entities. Stats 18 to 22+.
VOCATIONAL REALISM & ATTRIBUTE ASYMMETRY:
- Stats must NEVER be flat or uniform across all attributes.
- Reflect physical build, age, and occupation: non-combatants, youth, children, brokers, and scholars MUST have low physical Might (1 to 4) while allocating points to mental, social, or agility strengths (e.g. Cunning: 5-7).
- Burly laborers, smiths, and guards invert this (Might: 5-8, lower Arcana/Cunning).
- If specific RPG stats with base values are provided in the prompt, rate strictly those stats. If a target tier hint is given, it constrains combatTier ONLY — still rate challengeRating and crBasis independently.
VITALS & RESOURCE POOLS (mandatory — never omit):
- "vitals.health" current/max HP scaled to tier and CR: civilians ~4-8, apprentices ~10-20, veterans ~25-45, elites ~50-90, bosses ~100-200, mythic 200-500, cosmic 500+.
- Add "vitals.stamina" for physically active characters; add "vitals.mana" ONLY for casters or supernatural beings.
- Add "resourcePools" for signature expendables fitting the archetype (e.g. Rage, Spell Slots, Focus, Grit, Faith) with id, name, max; civilians usually have none.
- "current" values represent a fully-rested state (current = max).)`;
    } else if (type === 'epoch_arc') {
      schemaInstruction = `Schema: { "eras": [{ "eraName": string, "timeframe": string, "description": string, "majorCataclysm": string, "legacyFactions": string[] }], "keyEvents": [{ "title": string, "eraName": string, "narrativeSummary": string, "lastingConsequences": string }] } (Generate a cohesive 3-era historical macro-arc: 1. Age of Creation / Mythic Dawn, 2. The Great Cataclysm / War of Ruin, 3. The Present Ash / Modern Age, along with at least 4 key turning point events across these eras)`;
    } else if (type === 'timeline_ripple') {
      schemaInstruction = `Schema: { "sourceEventTitle": string, "modernRepercussions": [{ "targetType": "faction"|"location"|"artifact"|"religion", "targetName": string, "effectDescription": string }] } (Propagate 2 to 4 cascading historical consequences across modern factions, sacred sites, relics, or religious schisms resulting from this ancient event)`;
    } else if (type === 'artifact_enhanced') {
      schemaInstruction = `Schema: { "name": string, "rarity": "uncommon"|"rare"|"epic"|"legendary"|"mythic", "attunementCost": string, "activePower": string, "doubleEdgedCurse": string, "vaultLore": { "creator": string, "currentVaultLocation": string, "unsealingRitual": string, "rivalSeekers": string[] } } (IMPORTANT: Prioritize tangible physical equipment — swords, daggers, axes, wands, staves, plate armor, shields, gauntlets, cloaks. If rarity is uncommon, rare, or epic, doubleEdgedCurse MUST be "" and attunementCost should be simple without negative drawbacks. Curses and severe sacrifices are strictly reserved for legendary and mythic tiers. Vault location and rival seekers must tie into existing world locations and factions when possible)`;
    } else if (type === 'creature_ecology') {
      schemaInstruction = `Schema: { "name": string, "speciesCategory": "beast"|"monstrosity"|"undead"|"elemental"|"flora"|"draconic"|"humanoid"|"mineral", "habitatLocationName": string, "predatorPreyNiche": string, "nonCombatPacificationMethod": string, "pacificationReagents": string[], "preySpecies": string[], "predatorSpecies": string[], "alchemicalYields": [{ "reagentName": string, "rarity": "uncommon"|"rare"|"epic", "craftingUse": string }] } (Generate ecosystem role, behavioral dynamics, non-lethal pacification or containment methods, connected preySpecies and predatorSpecies names, and 1 to 3 harvestable alchemical / crafting reagents.
CATEGORY-SPECIFIC DIRECTIVES (CRITICAL):
- If speciesCategory is "monstrosity", "undead", or "elemental": NEVER treat them as mundane wildlife or beasts! They do not belong to a normal animal food chain. In predatorPreyNiche, describe their vector of corruption, how they terrorize, consume, or infect victims (e.g. travelers, reeds dwellers, living settlements), and what natural forces or factional purgers hunt them down (e.g. fire-wielding inquisitors, cleansing beasts, holy guardians). In nonCombatPacificationMethod, describe non-combat containment or neutralizing methods such as alchemical neutralizing agents, cleansing salts/incense, severing their connection to a master/hivemind entity, or sacred containment wards (DO NOT say "throw fresh meat" or "avoid eye contact" like an animal). In alchemicalYields, yield mutated tumors, blighted ichor, parasitic spores, or hardened cysts used in dark alchemy, antitoxins, or resistance salves.
- If speciesCategory is "flora": nonCombatPacificationMethod describes delicate botanical harvesting conditions (e.g. harvest under full moon or use non-iron shears).
- If speciesCategory is "mineral": nonCombatPacificationMethod describes safe excavation or extraction conditions (e.g. temperature, special picks, insulation against shock) and behavioral tactics describe geological stability.
- If speciesCategory is "beast": describe realistic apex/predator/prey ecology and animal baiting or calming methods.
- If the request notes the beast is DOMESTICATED (mount / livestock / guard): nonCombatPacificationMethod must describe training, handling, and husbandry rather than baiting, trapping, or subdual, and predatorPreyNiche should note its kept role.
- REUSE EXISTING ENTITIES: predatorSpecies, preySpecies, and pacificationReagents MUST prefer exact names from existing bestiary / flora / mineral entries in the world context (which lists each with its danger level). Invent a new name only when no existing entry fits.
- DANGER COHERENCE: never make a higher-danger creature the prey of a lower-danger predator without stating the mechanism (pack, swarm, parasite, ambush, venom). Never describe mining, excavation, ore veins, or mineral extraction for a non-mineral species.
IMPORTANT FOR PACIFICATION: In pacificationReagents, list the clean entity names of any plants, herbs, salts, minerals, or reagents required to pacify/contain the creature (e.g. ["نیلوفر مردابی", "نمک معدنی"]). In nonCombatPacificationMethod, surround each required reagent in quotes like «نیلوفر مردابی». Prioritize reusing already-existing flora, minerals, or reagents from the world context when available)`;
    } else if (type === 'religion_schisms') {
      schemaInstruction = `Schema: { "name": string, "domain": string, "sacredTaboos": string[], "divineOmensForViolation": string, "divineBlessing": string, "sectarianSchisms": [{ "cultName": string, "heresyDoctrine": string, "headquartersLocation": string }] } (Generate strict sacred taboos, chilling divine omens/wrath triggers for blasphemers, blessings for faithful devotees, and 1 to 3 underground heresy splinter cults/schisms)`;
    } else if (type === 'rpg_system_synthesis') {
      schemaInstruction = `Schema: { "themeJustification": string, "stats": [{ "id": string, "nameFa": string, "nameEn": string, "description": string, "defaultValue": number }], "resources": [{ "id": string, "nameFa": string, "nameEn": string, "maxValue": number, "decayRule": string }], "archetypes": [{ "name": string, "description": string, "startingStats": Record<string, number>, "signaturePerk": string, "startingInventory": string[] }] } (Synthesize 4 to 6 core attributes, 2 to 4 vital resources/pools, and 4 thematic starting archetypes directly derived from the story's theme notes and world laws. Prioritize unique thematic flavor, e.g. Sanity/Paranoia for cosmic horror, Lineage/Guile for political intrigue)`;
    } else if (type === 'branching_story_tree') {
      schemaInstruction = `Schema: { "title": string, "premise": string, "acts": [{ "actNumber": number, "actTitle": string, "scenes": [{ "sceneId": string, "title": string, "settingLocationName": string, "primaryConflict": string, "presentedChoices": [{ "style": "defensive_diplomatic"|"tactical_agile"|"aggressive_daring", "textFa": string, "textEn": string, "statCheck": { "stat": string, "dc": number }, "leadToSceneId": string }] }] }] } (Synthesize a complete 3-Act branching story graph where Act 1 introduces the hook, Act 2 builds rising tension with branching pathways, and Act 3 delivers climactic payoffs. Every scene MUST feature 3 distinct choice archetypes: 1. defensive_diplomatic, 2. tactical_agile, 3. aggressive_daring. Stat checks must use realistic DCs between 10 and 20)`;
    } else if (type === 'epic_saga_synthesis') {
      schemaInstruction = `Schema: { "sagaTitle": string, "premise": string, "chapters": [{ "chapterNumber": number, "title": string, "scopeTier": "street"|"regional"|"continental"|"mythic", "narrativeGoal": string, "prerequisiteFlags": string[], "completionSummaryPrompt": string, "scenes": [{ "sceneId": string, "title": string, "settingLocationName": string, "primaryConflict": string, "presentedChoices": [{ "style": "defensive_diplomatic"|"tactical_agile"|"aggressive_daring", "textFa": string, "textEn": string, "statCheck": { "stat": string, "dc": number }, "leadToSceneId": string }] }] }] } (👑 Synthesize a FULL 5-CHAPTER EPIC SAGA adapted to the story's authored canvas: Ground early chapters in the opening setting and personal stakes, then escalate tension through faction dynamics, turning points, and climactic payoffs appropriate to the story canvas (whether localized, urban, regional, continental, or mythic). Each chapter contains 3 to 5 linked scenes; every scene features exactly 3 choice archetypes: defensive_diplomatic, tactical_agile, aggressive_daring. Choices may chain within a chapter via leadToSceneId using declared sceneIds. Use settingLocationName values that match existing world locations when possible. DCs must be realistic (10-20). Each chapter's completionSummaryPrompt is a one-sentence directive for how the AI should compress the chapter into an episodic milestone rollup.)`;
    } else if (type === 'scene') {
      schemaInstruction = `Schema: { "sceneId": string, "locationId": string, "narrativeText": string, "choices": [{ "id": string, "text": string, "style": "defensive"|"agile"|"aggressive"|"diplomatic"|"inquisitive", "riskLevel": "low"|"medium"|"high", "targetDC": number, "requiredStatId": string, "leadToSceneId"?: string }] } (If a choice branches or connects to another scene, provide that target scene id in leadToSceneId)`;
    } else if (type === 'chapter_scenes') {
      schemaInstruction = `Schema: { "scenes": [{ "sceneId": string, "title": string, "settingLocationName": string, "narrativeText": string, "primaryConflict": string, "presentedChoices": [{ "textFa": string, "textEn": string, "style"?: "diplomatic"|"tactical"|"aggressive"|"inquisitive"|"evasive"|"bold", "statCheck"?: { "stat": string, "dc": number }, "leadToSceneId"?: string }] }] } (👑 NARRATIVE-FIRST SCENE GENERATION: The author has hand-written this act's storyline. Dramatize EXACTLY the authored narrative — do NOT invent a different plot. Generate 3 to 5 key milestone scenes that dramatize the act's progression: opening dilemma → escalating crisis → pivotal turning point. Assign distinct sceneIds like "act1_s1", "act1_s2". Every scene MUST advance the authored goal and feature the named factions/NPCs from the WORLD BIBLE by their real names. Use settingLocationName values that match existing world locations.

CRITICAL CHOICE DESIGN RULES:
1. Pure Narrative Agency: Each scene must offer 2 to 4 contextual, narratively meaningful choices reflecting different character philosophies, tactical decisions, or ethical dilemmas. Focus strictly on story impact and narrative flavor.
2. NO Difficulty Tiers: NEVER categorize choices as easy, medium, or hard. Strictly avoid artificial difficulty tiers or risk labels.
3. RPG Stat Checks (Optional): Include a statCheck only when a choice genuinely tests a character skill (realistic DC 10-18); otherwise omit statCheck.
4. NO False Convergence: NEVER make all choices in a scene point to the same subsequent scene. Act milestone scenes represent distinct dramatic turning points; choices must NOT be artificially chained with leadToSceneId unless the subsequent scene is specifically written as that exact choice's immediate continuation. If a choice is open-ended or branches dynamically, OMIT leadToSceneId so the reader's AI engine can resolve the branch.)`;
    } else if (type === 'weave_story') {
      const anchors = Array.isArray(body.anchors) ? body.anchors : [];
      const scope = body.scope === 'whole_arc' ? 'whole_arc' : 'act';
      const actGoal = body.actGoal || '';
      const chapterNumber = body.chapterNumber;
      const rpgStatIds = Array.isArray(body.rpgStatIds) ? body.rpgStatIds : [];
      const existingSceneIds = Array.isArray(body.existingSceneIds) ? body.existingSceneIds : [];
      const storyManifest = (body.story || {}) as StoryManifest;

      const weave = buildWeavePrompt({
        story: storyManifest,
        anchors,
        scope,
        actGoal,
        chapterNumber,
        rpgStatIds,
        existingSceneIds,
        isPersian: !!isPersian,
      });
      schemaInstruction = weave.schemaInstruction;
    }



    const effectiveSchemaInstruction = constraints.length
      ? `${constraintLine}\n${schemaInstruction}`
      : schemaInstruction;

    const userPromptText =
      type === 'weave_story'
        ? buildWeavePrompt({
            story: (body.story || {}) as StoryManifest,
            anchors: Array.isArray(body.anchors) ? body.anchors : [],
            scope: body.scope === 'whole_arc' ? 'whole_arc' : 'act',
            actGoal: body.actGoal || '',
            chapterNumber: body.chapterNumber,
            rpgStatIds: Array.isArray(body.rpgStatIds) ? body.rpgStatIds : [],
            existingSceneIds: Array.isArray(body.existingSceneIds) ? body.existingSceneIds : [],
            isPersian: !!isPersian,
          }).promptText
        : customSystemPrompt?.trim()
        ? `Apply the requested changes to the existing ${type} entity and return the complete updated JSON strictly matching the schema:\n${effectiveSchemaInstruction}`
        : `Generate a ${type} entity with creative literary depth.\n${effectiveSchemaInstruction}`;

    // Stat calibration is a rating task, not a creative one — keep it cool and stable.
    const temperature =
      type === 'npc_stat_calibration' ? 0.3 : type === 'weave_story' ? 0.7 : customSystemPrompt?.trim() ? 0.7 : 0.8;
    const aiResult = await generateStructuredJson(
      userPromptText,
      systemPrompt,
      {
        temperature,
        taskType: type === 'world' || type === 'epic_saga_synthesis' ? 'world' : taskType,
      }
    );

    if (aiResult && aiResult.data) {
      // Saga/branch repair loop: validate graph + stats, retry once on failure.
      if (type === 'epic_saga_synthesis' || type === 'branching_story_tree' || type === 'chapter_scenes') {
        const statIds: string[] = Array.isArray((body as { rpgStatIds?: unknown }).rpgStatIds)
          ? ((body as { rpgStatIds?: unknown }).rpgStatIds as string[]).filter((s) => typeof s === 'string')
          : [];
        const asSaga = coerceToSagaManifest(aiResult.data);
        if (asSaga) {
          let sagaAudit = LoreAuditor.auditSaga(asSaga);
          sagaAudit.findings.push(...LoreAuditor.auditSagaStats(asSaga, statIds));
          const blocked =
            sagaAudit.findings.some((f) => f.severity === 'error') ||
            sagaAudit.score < 70;
          if (blocked) {
            const repairPrompt =
              `Your previous saga output has structural issues. Fix ONLY the listed issues, preserving all valid scene ids, titles, and choice text.\n\n` +
              `PREVIOUS OUTPUT:\n${JSON.stringify(aiResult.data)}\n\n` +
              `FINDINGS:\n${JSON.stringify(sagaAudit.findings.slice(0, 20))}\n\n` +
              `SCHEMA:\n${effectiveSchemaInstruction}\n\nReturn the FULL corrected JSON only.`;
            const retry = await generateStructuredJson(
              repairPrompt,
              systemPrompt,
              { temperature: 0.4, taskType: 'world' }
            );
            if (retry && retry.data) {
              const reSaga = coerceToSagaManifest(retry.data);
              if (reSaga) {
                const reAudit = LoreAuditor.auditSaga(reSaga);
                reAudit.findings.push(...LoreAuditor.auditSagaStats(reSaga, statIds));
                const reBlocked =
                  reAudit.findings.some((f) => f.severity === 'error') || reAudit.score < 70;
                if (!reBlocked) {
                  return NextResponse.json({
                    success: true,
                    data: retry.data,
                    sagaAudit: reAudit,
                    repaired: true,
                    isAiGenerated: true,
                    modelUsed: retry.modelUsed,
                  });
                }
                return NextResponse.json(
                  {
                    success: false,
                    error: isPersian ? 'ساختار ساگا نیاز به بازبینی دارد.' : 'Saga structure needs revision.',
                    data: retry.data,
                    sagaAudit: reAudit,
                    repaired: true,
                  },
                  { status: 422 }
                );
              }
            }
            return NextResponse.json(
              {
                success: false,
                error: isPersian ? 'ساختار ساگا نیاز به بازبینی دارد.' : 'Saga structure needs revision.',
                data: aiResult.data,
                sagaAudit,
                repaired: false,
              },
              { status: 422 }
            );
          }
          return NextResponse.json({
            success: true,
            data: aiResult.data,
            sagaAudit,
            repaired: false,
            isAiGenerated: true,
            modelUsed: aiResult.modelUsed,
          });
        }
      }

      if (type === 'weave_story') {
        const anchors = Array.isArray(body.anchors) ? body.anchors : [];
        const storyManifest = (body.story || {}) as StoryManifest;
        const locations = storyManifest.worldBible?.locations || [];
        const statIds = Array.isArray(body.rpgStatIds) ? body.rpgStatIds : [];

        let draft = aiResult.data as StoryWeaveDraft;
        let weavedBeats = coerceWeave(draft, anchors, locations);
        let qualityAudit = auditWeaveQuality({
          weavedBeats,
          expectedAnchors: anchors,
          rpgStatIds: statIds,
        });

        const blocked = qualityAudit.findings.some((f) => f.severity === 'error') || qualityAudit.score < 75;
        if (blocked) {
          const repairPrompt =
            `Your previous story weave output has quality/structural issues. Fix ONLY the listed issues, preserving all anchor references and choice texts.\n\n` +
            `PREVIOUS OUTPUT:\n${JSON.stringify(aiResult.data)}\n\n` +
            `FINDINGS:\n${JSON.stringify(qualityAudit.findings.slice(0, 15))}\n\n` +
            `SCHEMA:\n${effectiveSchemaInstruction}\n\nReturn the FULL corrected JSON only.`;

          const retry = await generateStructuredJson(repairPrompt, systemPrompt, {
            temperature: 0.4,
            taskType: 'world',
          });

          if (retry && retry.data) {
            draft = retry.data as StoryWeaveDraft;
            weavedBeats = coerceWeave(draft, anchors, locations);
            qualityAudit = auditWeaveQuality({
              weavedBeats,
              expectedAnchors: anchors,
              rpgStatIds: statIds,
            });
            const reBlocked = qualityAudit.findings.some((f) => f.severity === 'error') || qualityAudit.score < 75;
            if (!reBlocked) {
              return NextResponse.json({
                success: true,
                data: { sequence: weavedBeats },
                qualityAudit,
                repaired: true,
                isAiGenerated: true,
                modelUsed: retry.modelUsed,
              });
            }
            return NextResponse.json(
              {
                success: false,
                error: isPersian ? 'کیفیت تار و پود داستان نیازمند بازبینی است.' : 'Story weave quality needs revision.',
                data: { sequence: weavedBeats },
                qualityAudit,
                repaired: true,
              },
              { status: 422 }
            );
          }
          return NextResponse.json(
            {
              success: false,
              error: isPersian ? 'کیفیت تار و پود داستان نیازمند بازبینی است.' : 'Story weave quality needs revision.',
              data: { sequence: weavedBeats },
              qualityAudit,
              repaired: false,
            },
            { status: 422 }
          );
        }

        return NextResponse.json({
          success: true,
          data: { sequence: weavedBeats },
          qualityAudit,
          isAiGenerated: true,
          modelUsed: aiResult.modelUsed,
        });
      }
      // Stat calibrations pass through the normalizer so vitals/pools
      // defaults and clamps hold even when the model omits them.
      const responseData =
        type === 'npc_stat_calibration'
          ? normalizeEntity('npc', { name: '', statCalibration: aiResult.data }).statCalibration ?? aiResult.data
          : aiResult.data;
      return NextResponse.json({
        success: true,
        data: responseData,
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

/**
 * Coerces epic_saga / branching-tree / chapter payloads into a SagaManifest
 * shape for deterministic auditing. Returns null when the shape is unknown.
 */
function coerceToSagaManifest(data: unknown): SagaManifest | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (Array.isArray(d.chapters)) {
    const chapters = (d.chapters as Array<Record<string, unknown>>).map((ch, ci) => ({
      id: String(ch.id || `ch_${ci + 1}`),
      chapterNumber: typeof ch.chapterNumber === 'number' ? ch.chapterNumber : ci + 1,
      title: String(ch.title || `Chapter ${ci + 1}`),
      scopeTier: (['street', 'regional', 'continental', 'mythic'] as const).includes(ch.scopeTier as never)
        ? (ch.scopeTier as SagaManifest['chapters'][number]['scopeTier'])
        : 'regional',
      narrativeGoal: String(ch.narrativeGoal || ''),
      prerequisiteFlags: Array.isArray(ch.prerequisiteFlags) ? (ch.prerequisiteFlags as string[]) : [],
      completionSummaryPrompt: String(ch.completionSummaryPrompt || ''),
      scenes: Array.isArray(ch.scenes)
        ? (ch.scenes as Array<Record<string, unknown>>).map((sc) => ({
            sceneId: String(sc.sceneId || sc.id || ''),
            locationId: String(sc.locationId || ''),
            narrativeText: String(sc.narrativeText || ''),
            imageUrl: typeof sc.imageUrl === 'string' ? sc.imageUrl : undefined,
            choices: Array.isArray(sc.choices)
              ? (sc.choices as Array<Record<string, unknown>>).map((c) => ({
                  id: String(c.id || 'choice'),
                  text: String(c.textFa || c.textEn || c.text || ''),
                  style: 'inquisitive' as const,
                  riskLevel: 'medium' as const,
                  targetDC: typeof c.statCheck === 'object' && c.statCheck !== null
                    ? (c.statCheck as Record<string, unknown>).dc as number | undefined
                    : (c.targetDC as number | undefined),
                  requiredStatId: typeof c.statCheck === 'object' && c.statCheck !== null
                    ? (c.statCheck as Record<string, unknown>).stat as string | undefined
                    : (c.requiredStatId as string | undefined),
                  targetSceneId: (c.leadToSceneId || c.targetSceneId) as string | undefined,
                }))
              : Array.isArray(sc.presentedChoices)
              ? (sc.presentedChoices as Array<Record<string, unknown>>).map((c) => ({
                  id: String(c.id || 'choice'),
                  text: String(c.textFa || c.textEn || c.text || ''),
                  style: 'inquisitive' as const,
                  riskLevel: 'medium' as const,
                  targetDC: typeof c.statCheck === 'object' && c.statCheck !== null
                    ? (c.statCheck as Record<string, unknown>).dc as number | undefined
                    : undefined,
                  requiredStatId: typeof c.statCheck === 'object' && c.statCheck !== null
                    ? (c.statCheck as Record<string, unknown>).stat as string | undefined
                    : undefined,
                  targetSceneId: (c.leadToSceneId || c.targetSceneId) as string | undefined,
                }))
              : [],
          }))
        : [],
    }));
    return { chapters } as unknown as SagaManifest;
  }
  return null;
}


