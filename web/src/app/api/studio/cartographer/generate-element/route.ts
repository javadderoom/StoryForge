import { NextRequest, NextResponse } from 'next/server';
import { requireStudioWrite } from '@/lib/auth/studioAuth';
import { generateDeepSeekStructuredJson } from '@/lib/ai/aiPrimeClient';
import {
  EnvironmentalContext,
  extractEnvironmentalContext,
} from '@/lib/engines/world/environmentalContext';
import {
  WorldBible,
  WorldCreature,
  NPCDossier,
  TimelineEvent,
  WorldArtifact,
  WorldLocation,
  MapEntityPlacement,
  MapEntityPlacementType,
} from '@/lib/types/world';

export interface CartographerGenerateRequest {
  worldId?: string;
  worldName?: string;
  worldTheme?: string;
  coordinates: { x: number; y: number };
  environmentalContext: EnvironmentalContext;
  entityType: 'beast' | 'npc' | 'story_event' | 'timeline' | 'artifact' | 'settlement';
  parameters?: {
    dc?: number;
    dangerLevel?: number;
    role?: string;
    category?: string;
    rarity?: string;
    factionId?: string;
    factionName?: string;
    customPrompt?: string;
  };
}

export async function POST(req: NextRequest) {
  const authResult = await requireStudioWrite(req);
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const body: CartographerGenerateRequest = await req.json();
    const { coordinates, environmentalContext, entityType, parameters = {} } = body;

    if (!coordinates || typeof coordinates.x !== 'number' || typeof coordinates.y !== 'number') {
      return NextResponse.json({ error: 'Valid (x, y) coordinates are required.' }, { status: 400 });
    }

    if (!environmentalContext) {
      return NextResponse.json(
        { error: 'Environmental context is required.' },
        { status: 400 }
      );
    }

    const worldName = body.worldName || 'The Known Realm';
    const worldTheme = body.worldTheme || 'Epic high-fantasy world';

    const systemPromptBase = `You are the master worldbuilding cartographer and lorekeeper for "${worldName}".
Theme & Artistic Vision: ${worldTheme}

You are generating a canon element directly pinned to a specific location on the world map.
CRITICAL CONSTRAINT: You MUST ground the creature, person, relic, or encounter completely in the local geography, biome, elevation, and climate provided. No generic or out-of-place elements.
Always provide rich, literary descriptions suitable for high-end interactive fiction.
Respond ONLY with a valid JSON object matching the requested schema.`;

    const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    if (entityType === 'beast') {
      const dangerLevel = (parameters.dangerLevel && parameters.dangerLevel >= 1 && parameters.dangerLevel <= 5)
        ? parameters.dangerLevel
        : 3;
      const targetDc = parameters.dc || (dangerLevel === 5 ? 22 : dangerLevel === 4 ? 18 : 15);
      const role = parameters.role || (dangerLevel >= 5 ? 'Ancient Calamity' : 'Apex Predator');
      const rarity = parameters.rarity || (dangerLevel >= 5 ? 'legendary' : dangerLevel === 4 ? 'rare' : 'uncommon');

      const dangerScaleDirective =
        dangerLevel === 5
          ? `CRITICAL REQUIREMENT - DANGER LEVEL 5 (UNAPPROACHABLE MYTHIC CALAMITY / CATASTROPHIC LEVIATHAN):
- ABSOLUTE LETHALITY & AURA: This is NOT a mundane wild animal or standard predator. It is an unapproachable primeval force of nature, an ancient monstrosity or dread leviathan that mortals cannot casually approach without imminent death. Merely being in its presence warps the local atmosphere (seismic tremors, suffocating heat, freezing dread, or toxic miasma).
- IMPENETRABLE DEFENSES: Conventional iron, steel, and common arrows bounce off its hide. Mortals cannot duel it in close quarters without being crushed or obliterated.
- NO TRIVIAL WEAKNESSES: Do NOT give it petty mundane animal flaws (DO NOT write: afraid of campfire smoke, blind spot under jaw, sluggish in daytime, or easily tricked). Its weaknesses must require epic scale, ancient lost relics, sacred incantations, or massive military siege sacrifice to exploit.
- TERRIFYING SCALE: Make its physiology and presence colossal, majestic, and terrifying.`
          : dangerLevel === 4
          ? `DANGER LEVEL 4 (Regional Apex Terror): A colossal monstrosity or dreaded apex beast capable of wiping out fortified outposts and caravans. Requires seasoned heroes and high-level preparation.`
          : dangerLevel === 3
          ? `DANGER LEVEL 3 (Lethal Monster): A fierce predator or territorial alpha dangerous to armed adventurers.`
          : `DANGER LEVEL ${dangerLevel} (Mild / Standard Wilderness Creature): Local native fauna adapted to the climate.`;

      const userPrompt = `${environmentalContext.promptContext}

REQUESTED ENTITY: Wild Creature / Monster
- Ecological Role / Niche: ${role}
- Target Danger Level: ${dangerLevel}/5
- Target Encounter DC: ${targetDc}
- Target Rarity: ${rarity}
${parameters.customPrompt ? `- Author's Custom Note: "${parameters.customPrompt}"` : ''}

${dangerScaleDirective}

Generate a creature specifically adapted to survive and rule in this ${environmentalContext.biomeLabel}.
Explain its physiology, hunting or devastation tactics, supernatural or evolutionary presence, and extreme adaptations.

Return JSON in this EXACT structure:
{
  "name": "Creature Name",
  "speciesCategory": "beast" | "monstrosity" | "draconic" | "elemental" | "undead" | "flora" | "mineral",
  "dangerLevel": ${dangerLevel},
  "rarity": "${rarity}",
  "isDomesticated": false,
  "behavioralTactics": "Tactics in combat and hunting...",
  "weaknesses": ["Profound or mythic weakness 1", "Weakness 2"],
  "resistances": ["Resistance 1", "Resistance 2"],
  "harvestableLoot": [{"name": "Pelt / Scale / Essence / Core", "dropRate": "${rarity}"}],
  "loreDescription": "Rich literary description of physiology, dreadful scale, and terrifying presence...",
  "predatorPreyNiche": "${role} of the ${environmentalContext.biomeLabel}"
}`;

      const genResult = await generateDeepSeekStructuredJson<any>(
        userPrompt,
        systemPromptBase,
        { temperature: 0.7 }
      );
      const data = genResult?.data;

      if (!data) {
        return NextResponse.json(
          { error: 'AI generation service is currently unavailable or returned empty output.' },
          { status: 503 }
        );
      }

      const creatureId = `creat_${uniqueSuffix}`;
      const creature: WorldCreature = {
        id: creatureId,
        name: data.name || 'Wild Beast',
        speciesCategory: data.speciesCategory || 'beast',
        dangerLevel: (data.dangerLevel || dangerLevel) as 1 | 2 | 3 | 4 | 5,
        rarity: data.rarity || rarity,
        isDomesticated: data.isDomesticated ?? false,
        habitatLocationIds: environmentalContext.linkedLocation
          ? [environmentalContext.linkedLocation.id]
          : environmentalContext.nearestSettlement
          ? [environmentalContext.nearestSettlement.id]
          : [],
        behavioralTactics: data.behavioralTactics || 'Fierce and territorial.',
        weaknesses: Array.isArray(data.weaknesses) ? data.weaknesses : [],
        resistances: Array.isArray(data.resistances) ? data.resistances : [],
        harvestableLoot: Array.isArray(data.harvestableLoot)
          ? data.harvestableLoot.map((l: any, idx: number) => ({
              itemId: `loot_${creatureId}_${idx}`,
              name: l.name || 'Pelt',
              dropRate: l.dropRate || 'common',
            }))
          : [],
        loreDescription: data.loreDescription || '',
        predatorPreyNiche: data.predatorPreyNiche || role,
      };

      const placement: MapEntityPlacement = {
        id: `pl_${uniqueSuffix}`,
        entityId: creature.id,
        entityType: 'bestiary',
        x: Math.round(coordinates.x),
        y: Math.round(coordinates.y),
        customLabel: creature.name,
        customIcon: '🐉',
        notes: `DC ${targetDc} • ${creature.predatorPreyNiche}`,
      };

      return NextResponse.json({
        success: true,
        entityType: 'bestiary',
        entity: creature,
        placement,
      });
    }

    if (entityType === 'npc') {
      const targetDc = parameters.dc || 14;
      const role = parameters.role || 'Nomad Traveler';
      const factionHint = parameters.factionName ? `Affiliated with faction: ${parameters.factionName}` : 'Independent / Solitary';

      const userPrompt = `${environmentalContext.promptContext}

REQUESTED ENTITY: Stationed NPC
- Role / Archetype: ${role}
- Stance / Allegiance: ${factionHint}
- Interaction Difficulty DC: ${targetDc}
${parameters.customPrompt ? `- Author's Custom Note: "${parameters.customPrompt}"` : ''}

Generate an NPC stationed or dwelling at these exact coordinates in the ${environmentalContext.biomeLabel}.
Their attire, survival equipment, physical appearance, and personality must reflect how they survive in this climate.

Return JSON in this EXACT structure:
{
  "name": "Full Name",
  "title": "Honorific or Epithet",
  "role": "${role}",
  "personalityTraits": ["Trait 1", "Trait 2", "Trait 3"],
  "speechStyle": "Directives on voice, cadence, and vernacular...",
  "appearance": "Sensory visual description of clothing, gear, dust, posture...",
  "goals": ["Immediate goal in this region", "Long term objective"],
  "secrets": [{"description": "Hidden secret or past shame..."}]
}`;

      const genResult = await generateDeepSeekStructuredJson<any>(
        userPrompt,
        systemPromptBase,
        { temperature: 0.7 }
      );
      const data = genResult?.data;

      if (!data) {
        return NextResponse.json(
          { error: 'AI generation service is currently unavailable or returned empty output.' },
          { status: 503 }
        );
      }

      const npcId = `npc_${uniqueSuffix}`;
      const npc: NPCDossier = {
        id: npcId,
        name: data.name || 'Desert Wanderer',
        title: data.title || role,
        role: data.role || role,
        kind: 'individual',
        factionId: parameters.factionId,
        currentLocationId: environmentalContext.linkedLocation?.id || environmentalContext.nearestSettlement?.id || '',
        initialTrust: 0,
        personalityTraits: Array.isArray(data.personalityTraits) ? data.personalityTraits : ['Resilient', 'Vigilant'],
        speechStyle: data.speechStyle || 'Speaks slowly, conserving breath.',
        appearance: data.appearance || 'Wears layered dust-cloth and traveling leathers.',
        goals: Array.isArray(data.goals) ? data.goals : ['Survive the crossing.'],
        secrets: Array.isArray(data.secrets)
          ? data.secrets.map((s: any, idx: number) => ({
              id: `sec_${npcId}_${idx}`,
              description: typeof s === 'string' ? s : s.description || 'Holds an ancient token.',
              requiredTrustLevel: typeof s?.requiredTrustLevel === 'number' ? s.requiredTrustLevel : 50,
            }))
          : [],
      };

      const placement: MapEntityPlacement = {
        id: `pl_${uniqueSuffix}`,
        entityId: npc.id,
        entityType: 'npc',
        x: Math.round(coordinates.x),
        y: Math.round(coordinates.y),
        customLabel: `${npc.name}, ${npc.title}`,
        customIcon: '👤',
        notes: `DC ${targetDc} • ${npc.role}`,
      };

      return NextResponse.json({
        success: true,
        entityType: 'npc',
        entity: npc,
        placement,
      });
    }

    if (entityType === 'story_event' || entityType === 'timeline') {
      const category = parameters.category || 'Encounter & Dilemma';
      const targetDc = parameters.dc || 15;

      const userPrompt = `${environmentalContext.promptContext}

REQUESTED ENTITY: Local Story Event / Encounter Pin
- Event Category: ${category}
- Challenge / Resolution DC: ${targetDc}
${parameters.customPrompt ? `- Author's Custom Note: "${parameters.customPrompt}"` : ''}

Generate a dramatic, atmospheric story encounter or historical event pinned to this exact geographic location in the ${environmentalContext.biomeLabel}.
Include sensory terrain hazards, a compelling dilemma, and an immediate choice for an adventurer.

Return JSON in this EXACT structure:
{
  "title": "Title of the Encounter or Event",
  "yearOrEra": "Present Era",
  "summary": "Compelling narrative scene setting the danger or discovery...",
  "significance": "Why this site matters to the region...",
  "eraCategory": "recent",
  "knownByPublic": false,
  "secretDetails": "Hidden truth or underlying twist..."
}`;

      const genResult = await generateDeepSeekStructuredJson<any>(
        userPrompt,
        systemPromptBase,
        { temperature: 0.7 }
      );
      const data = genResult?.data;

      if (!data) {
        return NextResponse.json(
          { error: 'AI generation service is currently unavailable or returned empty output.' },
          { status: 503 }
        );
      }

      const eventId = `time_${uniqueSuffix}`;
      const validEra = ['ancient', 'war', 'reign', 'cataclysm', 'present'].includes(data.eraCategory)
        ? data.eraCategory
        : 'present';

      const event: TimelineEvent = {
        id: eventId,
        title: data.title || 'Mysterious Site',
        yearOrEra: data.yearOrEra || 'Present',
        summary: data.summary || 'An uncharted site marked by peculiar signs in the earth.',
        significance: data.significance || 'Unresolved landmark.',
        knownByPublic: data.knownByPublic ?? false,
        eraCategory: validEra,
        secretDetails: data.secretDetails || '',
      };

      const placement: MapEntityPlacement = {
        id: `pl_${uniqueSuffix}`,
        entityId: event.id,
        entityType: 'timeline',
        x: Math.round(coordinates.x),
        y: Math.round(coordinates.y),
        customLabel: event.title,
        customIcon: '⚔️',
        notes: `DC ${targetDc} • ${category}`,
      };

      return NextResponse.json({
        success: true,
        entityType: 'timeline',
        entity: event,
        placement,
      });
    }

    if (entityType === 'artifact') {
      const rarity = parameters.rarity || 'rare';
      const targetDc = parameters.dc || 16;

      const userPrompt = `${environmentalContext.promptContext}

REQUESTED ENTITY: Hidden Relic / Ancient Artifact
- Rarity: ${rarity}
- Attunement / Discovery DC: ${targetDc}
${parameters.customPrompt ? `- Author's Custom Note: "${parameters.customPrompt}"` : ''}

Generate a wondrous artifact buried, enshrined, or lost at this exact location in the ${environmentalContext.biomeLabel}.
Its materials, origin, and powers should reflect the geology or mystical history of this environment.

Return JSON in this EXACT structure:
{
  "name": "Name of the Artifact",
  "title": "Epithet (e.g. Blade of the Dune Sea)",
  "originEra": "First Dawn",
  "rarity": "${rarity}",
  "description": "Literary description of appearance, patina, weight, and aura...",
  "powers": ["Power 1", "Power 2"],
  "curseOrCost": "Cost or caveat of wielding this relic...",
  "attunementRules": "Requires attunement at DC ${targetDc} in this biome."
}`;

      const genResult = await generateDeepSeekStructuredJson<any>(
        userPrompt,
        systemPromptBase,
        { temperature: 0.7 }
      );
      const data = genResult?.data;

      if (!data) {
        return NextResponse.json(
          { error: 'AI generation service is currently unavailable or returned empty output.' },
          { status: 503 }
        );
      }

      const artifactId = `art_${uniqueSuffix}`;
      const holderId = environmentalContext.linkedLocation?.id || environmentalContext.nearestSettlement?.id || '';
      const artifact: WorldArtifact = {
        id: artifactId,
        name: data.name || 'Ancient Relic',
        title: data.title || 'Lost Wonder',
        originEra: data.originEra || 'Ancient',
        rarity: (data.rarity || rarity) as any,
        description: data.description || '',
        powers: Array.isArray(data.powers) ? data.powers : ['Grants passage across treacherous terrain.'],
        curseOrCost: data.curseOrCost || 'Demands a sacrifice of water.',
        attunementRules: data.attunementRules || `DC ${targetDc}`,
        currentHolderType: holderId ? 'location' : 'unknown',
        currentHolderId: holderId,
      };

      const placement: MapEntityPlacement = {
        id: `pl_${uniqueSuffix}`,
        entityId: artifact.id,
        entityType: 'artifact',
        x: Math.round(coordinates.x),
        y: Math.round(coordinates.y),
        customLabel: artifact.name,
        customIcon: '✨',
        notes: `${artifact.rarity.toUpperCase()} • DC ${targetDc}`,
      };

      return NextResponse.json({
        success: true,
        entityType: 'artifact',
        entity: artifact,
        placement,
      });
    }

    if (entityType === 'settlement') {
      const category = parameters.category || 'settlement';
      const dangerLevel = (parameters.dangerLevel && parameters.dangerLevel >= 1 && parameters.dangerLevel <= 5)
        ? parameters.dangerLevel
        : 2;

      const userPrompt = `${environmentalContext.promptContext}

REQUESTED ENTITY: New Frontier Settlement / Outpost
- Settlement Type / Category: ${category}
- Local Danger Level: ${dangerLevel}/5
${parameters.customPrompt ? `- Author's Custom Note: "${parameters.customPrompt}"` : ''}

Generate a frontier settlement, outpost, or oasis station built at these exact coordinates in the ${environmentalContext.biomeLabel}.
Describe its architectural vernacular, defense against local wildlife and weather, and local atmosphere.

Return JSON in this EXACT structure:
{
  "name": "Settlement Name",
  "region": "${environmentalContext.featureName || environmentalContext.biomeLabel}",
  "description": "Architectural and social description of this settlement...",
  "atmosphere": "Sensory tone (e.g. Smell of dried spices, howl of dune winds, clatter of weapons...)",
  "category": "${category}",
  "dangerLevel": ${dangerLevel}
}`;

      const genResult = await generateDeepSeekStructuredJson<any>(
        userPrompt,
        systemPromptBase,
        { temperature: 0.7 }
      );
      const data = genResult?.data;

      if (!data) {
        return NextResponse.json(
          { error: 'AI generation service is currently unavailable or returned empty output.' },
          { status: 503 }
        );
      }

      const locationId = `loc_${uniqueSuffix}`;
      const location: WorldLocation = {
        id: locationId,
        name: data.name || 'Frontier Post',
        region: data.region || environmentalContext.linkedLocation?.name || environmentalContext.featureName || 'Uncharted Expanse',
        description: data.description || 'A rugged settlement built to endure.',
        atmosphere: data.atmosphere || 'Dusty winds and quiet vigilance.',
        dangerLevel: (data.dangerLevel || dangerLevel) as 1 | 2 | 3 | 4 | 5,
        connectedLocationIds: environmentalContext.linkedLocation
          ? [environmentalContext.linkedLocation.id]
          : environmentalContext.nearestSettlement
          ? [environmentalContext.nearestSettlement.id]
          : [],
        coordinates: { x: Math.round(coordinates.x), y: Math.round(coordinates.y) },
        elevation: environmentalContext.elevation,
        category: data.category || category,
      };

      const placement: MapEntityPlacement = {
        id: `pl_${uniqueSuffix}`,
        entityId: location.id,
        entityType: 'location',
        x: Math.round(coordinates.x),
        y: Math.round(coordinates.y),
        customLabel: location.name,
        customIcon: '🏰',
        notes: `Danger ${location.dangerLevel}/5`,
      };

      return NextResponse.json({
        success: true,
        entityType: 'location',
        entity: location,
        placement,
      });
    }

    return NextResponse.json({ error: `Unsupported entityType: ${entityType}` }, { status: 400 });
  } catch (error: any) {
    console.error('[Cartographer Generate Element API Error]:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate cartographer element.' },
      { status: 500 }
    );
  }
}
