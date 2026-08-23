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
} from '@/lib/engines/world/GenesisSchemas';
import { LoreAuditor } from '@/lib/engines/world/LoreAuditor';
import { WorldBible } from '@/lib/types/world';
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
        const parsed = GenesisWorldSchema.safeParse(aiResult.data);
        if (parsed.success) {
          return NextResponse.json({
            success: true,
            data: parsed.data,
            isAiGenerated: true,
            modelUsed: aiResult.modelUsed,
          });
        }
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

    // Use custom system prompt from UI if provided, otherwise default to context-rich prompt
    const systemPrompt =
      customSystemPrompt?.trim() ||
      `You are the Master World-Building & Narrative AI Co-Pilot for StoryForge, an advanced Interactive Fiction RPG engine.
Generate a high-quality JSON object for a ${type} within a dark fantasy / grim-arcane setting.
${isPersian ? 'Output all narrative text, names, descriptions in literary Persian (Farsi).' : 'Output in literary English.'}
Theme context: ${themeContext || 'Dark basalt mountain fortress, political tension, forbidden alchemy'}
User guidance: ${prompt || 'Create something rich with atmospheric depth and literary gravitas.'}
${worldContext ? `World context (existing lore — stay consistent with it):\n${worldContext}` : ''}${uniquenessInstruction}${anchor ? `\n\nANCHOR — This new ${type} MUST be thematically tied to the following existing lore element; derive its concept, theme, powers/flavor, and relations from it rather than introducing an unrelated motif:\n${anchor}` : ''}
Strictly output a valid JSON object matching the requested schema. Do not enclose in markdown blocks if possible, or return clean JSON.${constraintLine}`;

    let schemaInstruction = '';
    if (type === 'world') {
      schemaInstruction = `Schema: { "worldName": string, "summary": string, "themeNotes": string, "aiSystemPrompt": string, "laws": [{ "rule": string, "category": "magic"|"physics"|"society"|"divine", "description": string, "isImmutable": true }], "factions": [{ "id": string, "name": string, "description": string, "alignment": string, "publicGoals": string }] }`;
    } else if (type === 'faction') {
      schemaInstruction = `Schema: { "name": string, "description": string, "alignment": string, "publicGoals": string, "secretAgendas": string, "territoryIds": string[], "rivalFactionIds": string[], "alliedFactionIds": string[] }`;
    } else if (type === 'location') {
      schemaInstruction = `Schema: { "name": string, "region": string, "description": string, "dangerLevel": 1|2|3|4|5, "atmosphere": string, "specialRules": string[] }`;
    } else if (type === 'npc') {
      schemaInstruction = `Schema: { "name": string, "title": string, "role": string, "currentLocationId": string, "personalityTraits": string[], "speechStyle": string, "goals": string[], "secrets": [{ "id": string, "description": string, "requiredTrustLevel": number, "revealed": false }], "initialTrust": number }`;
    } else if (type === 'artifact') {
      schemaInstruction = `Schema: { "name": string, "title": string, "originEra": string, "rarity": "uncommon"|"rare"|"epic"|"legendary"|"mythic", "description": string, "powers": string[], "curseOrCost": string, "attunementRules": string, "secretLore": string }`;
    } else if (type === 'creature') {
      schemaInstruction = `Schema: { "name": string, "speciesCategory": "beast"|"monstrosity"|"undead"|"elemental"|"flora"|"draconic", "dangerLevel": 1|2|3|4|5, "behavioralTactics": string, "weaknesses": string[], "resistances": string[], "harvestableLoot": [{ "itemId": string, "name": string, "dropRate": string }], "loreDescription": string }`;
    } else if (type === 'deity') {
      schemaInstruction = `Schema: { "name": string, "title": string, "domain": "light"|"secrets"|"death"|"war"|"nature"|"chaos"|"forge", "sacredSymbol": string, "coreDogma": string, "taboos": string[], "divineBlessings": string[] }`;
    } else if (type === 'timeline_event') {
      schemaInstruction = `Schema: { "yearOrEra": string, "title": string, "summary": string, "significance": string, "knownByPublic": boolean, "eraCategory": "ancient"|"war"|"reign"|"present" }`;
    } else if (type === 'world_law') {
      schemaInstruction = `Schema: { "rule": string, "category": "magic"|"physics"|"society"|"divine", "description": string, "isImmutable": true }`;
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


