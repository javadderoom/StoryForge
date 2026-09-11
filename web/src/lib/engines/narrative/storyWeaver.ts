import { StoryBeat } from '@/lib/types/world';
import { StoryManifest } from '@/lib/types';
import { evictPlaceholderBeats, isPlaceholderBeat } from '@/lib/engines/world/sceneResolution';

export type WeaveItemKind = 'anchor' | 'bridge' | 'expansion';

export interface WeaveChoiceDraft {
  textFa?: string;
  textEn?: string;
  style?: 'defensive_diplomatic' | 'tactical_agile' | 'aggressive_daring' | 'inquisitive' | 'defensive' | 'agile' | 'aggressive';
  statCheck?: {
    stat: string;
    dc: number;
  };
  leadToRef?: string; // e.g. "anchor:scene_123" or "new:escape_corridor"
}

export interface WeaveItemDraft {
  order: number;
  kind: WeaveItemKind;
  anchorSceneId?: string; // Reference to existing beat if kind === 'anchor'
  slug?: string; // Slug for newly generated scene e.g. "confrontation_gates"
  title: string;
  settingLocationName?: string;
  narrativeText?: string;
  primaryConflict?: string;
  carryoverSummary?: string;
  introducedEntityNames?: string[];
  choices: WeaveChoiceDraft[];
}

export interface StoryWeaveDraft {
  sagaTitle?: string;
  premise?: string;
  sequence: WeaveItemDraft[];
}

export interface WeavedBeat extends StoryBeat {
  kind: WeaveItemKind;
  order: number;
  title: string;
  carryoverSummary?: string;
  introducedEntityNames?: string[];
}

export interface WeaveQualityFinding {
  severity: 'error' | 'warning' | 'suggestion';
  category: 'anchor_missing' | 'anchor_mutated' | 'opener_weak' | 'introduction_missing' | 'choice_diversity' | 'dangling_edge';
  title: string;
  description: string;
}

export interface WeaveQualityReport {
  score: number;
  summary: string;
  findings: WeaveQualityFinding[];
}

export interface StoryWeaveResult {
  beats: WeavedBeat[];
  qualityReport: WeaveQualityReport;
}

/**
 * Builds the comprehensive Weaver prompt instructing the AI to sequence anchors,
 * draft bridges/expansions, and chain choices using structured references.
 */
export function buildWeavePrompt(params: {
  story: StoryManifest;
  anchors: StoryBeat[];
  scope: 'act' | 'whole_arc';
  actGoal?: string;
  chapterNumber?: number;
  rpgStatIds?: string[];
  existingSceneIds?: string[];
  isPersian?: boolean;
}): { promptText: string; schemaInstruction: string } {
  const { story, anchors, scope, actGoal, chapterNumber, rpgStatIds = [], existingSceneIds = [], isPersian = false } = params;

  // Filter out placeholder seed beats from anchors
  const realAnchors = evictPlaceholderBeats(anchors).filter((b) => !isPlaceholderBeat(b));

  const anchorSummaries = realAnchors.map((a, idx) => {
    const loc = (story.worldBible.locations || []).find((l) => l.id === a.locationId);
    return `[ANCHOR ${idx + 1}] ID: "${a.sceneId}" | Location: "${loc?.name || a.locationId}"\nText: ${a.narrativeText.slice(0, 300)}...`;
  }).join('\n\n');

  const locationNames = (story.worldBible.locations || []).map((l) => `"${l.name}"`).join(', ');
  const npcNames = (story.worldBible.npcs || []).map((n) => `"${n.name}"`).join(', ');
  const factionNames = (story.worldBible.factions || []).map((f) => `"${f.name}"`).join(', ');
  const statList = rpgStatIds.length > 0 ? rpgStatIds.join(', ') : 'might, agility, arcana, cunning, resolve';

  const schemaInstruction = `Schema: {
  "sequence": [
    {
      "order": number,
      "kind": "anchor" | "bridge" | "expansion",
      "anchorSceneId": string (REQUIRED if kind is "anchor", must match exact anchor ID),
      "slug": string (REQUIRED if kind is "bridge" or "expansion", lowercase descriptive slug e.g. "breach_gate"),
      "title": string,
      "settingLocationName": string (Use existing world location name: ${locationNames}),
      "narrativeText": string (For anchors, you may leave empty as text is preserved verbatim. For bridges/expansions, provide 2 to 4 rich narrative paragraphs),
      "primaryConflict": string,
      "carryoverSummary": string (1-sentence describing narrative tension carried over from preceding beat),
      "introducedEntityNames": string[] (List real names of NPCs or Factions introduced for the first time in this beat),
      "choices": [
        {
          "textFa": string,
          "textEn": string,
          "style": "defensive_diplomatic" | "tactical_agile" | "aggressive_daring" | "inquisitive",
          "statCheck": { "stat": string (one of: ${statList}), "dc": number (5 to 30) },
          "leadToRef": string (Reference key: "anchor:<sceneId>" to branch to an anchor, or "new:<slug>" to branch to a bridge/expansion)
        }
      ]
    }
  ]
}`;

  const promptText = `👑 STORY-WEAVER ENGINE (Connected Saga Synthesizer)
You are the Master Story-Weaver. Your mission is to take disconnected narrative anchors and weave them into a coherent, escalating, branching saga graph.

SCOPE: ${scope === 'act' ? `Act / Chapter ${chapterNumber || 1}: ${actGoal || 'Escalating chapter conflict'}` : 'Full Campaign Arc'}
STORY PREMISE: ${story.synopsis || story.tagline || story.title}
LANGUAGE: ${isPersian ? 'Persian (Farsi)' : 'English'}

WORLD ENTITIES (USE THESE EXACT CANONICAL NAMES):
- Locations: ${locationNames || 'None defined'}
- NPCs: ${npcNames || 'None defined'}
- Factions: ${factionNames || 'None defined'}

AUTHORED ANCHOR SCENES (MUST BE INCLUDED VERBATIM):
${anchorSummaries || '(No prior anchors; weave fresh opening sequence)'}

WEAVER QUALITY CONTRACTS:
1. ANCHOR INTEGRITY: Every anchor listed above MUST appear in your output sequence with kind="anchor" and matching anchorSceneId. Do NOT re-write their text.
2. BRIDGES & EXPANSIONS:
   - For every gap between anchors, weave a "bridge" beat that carries over narrative tension.
   - For narrative progression past the anchors, weave "expansion" beats that escalate the drama toward a climax.
3. OPENER CONTRACT: The first beat (order 1) MUST establish protagonist grounding, sensory setting details, and an inciting incident hook.
4. FIRST INTRODUCTIONS: Whenever an NPC or Faction is introduced for the first time, ground them with 1-2 sensory sentences and include their exact name in "introducedEntityNames".
5. CHOICE DIVERSITY: Every beat MUST feature 3 maximally distinct choices (different approaches, risks, and narrative outcomes). Stat checks are optional (DCs 5 to 30) using only valid stats (${statList}).
6. CONNECTED GRAPH: Every choice MUST provide a leadToRef linking either to an anchor ("anchor:<anchorId>") or a new scene ("new:<slug>"). No dead-ends except for the final climax scene. Avoid collisions with existing IDs: ${existingSceneIds.slice(0, 10).join(', ')}.

${schemaInstruction}
Return the JSON object strictly conforming to the schema.`;

  return { promptText, schemaInstruction };
}

/**
 * Coerces AI weave draft into canonical StoryBeats:
 * - Assigns collision-free server-side sceneIds to bridges and expansions.
 * - Preserves anchor beats and their authored text verbatim.
 * - Resolves all choice leadToRef keys into final targetSceneIds.
 */
export function coerceWeave(
  draft: StoryWeaveDraft,
  existingAnchors: StoryBeat[] = [],
  storyLocations: Array<{ id: string; name: string }> = []
): WeavedBeat[] {
  if (!draft || !Array.isArray(draft.sequence)) return [];

  const anchorMap = new Map<string, StoryBeat>();
  for (const a of existingAnchors) {
    if (a && a.sceneId) anchorMap.set(a.sceneId, a);
  }

  const defaultLocId = storyLocations[0]?.id || 'loc_hub';
  const resolveLocationId = (nameOrId?: string): string => {
    if (!nameOrId) return defaultLocId;
    const directMatch = storyLocations.find((l) => l.id === nameOrId);
    if (directMatch) return directMatch.id;
    const nameMatch = storyLocations.find((l) => l.name.toLowerCase() === nameOrId.toLowerCase());
    if (nameMatch) return nameMatch.id;
    return defaultLocId;
  };

  // First pass: Assign canonical scene IDs and build reference lookup map
  const refToSceneId = new Map<string, string>();
  const preppedItems: Array<{
    item: WeaveItemDraft;
    assignedSceneId: string;
    isAnchor: boolean;
    anchorBeat?: StoryBeat;
  }> = [];

  const sortedSequence = [...draft.sequence].sort((a, b) => (a.order || 0) - (b.order || 0));

  for (let i = 0; i < sortedSequence.length; i++) {
    const item = sortedSequence[i];
    const isAnchor = item.kind === 'anchor';
    let assignedSceneId = '';
    let anchorBeat: StoryBeat | undefined;

    if (isAnchor && item.anchorSceneId && anchorMap.has(item.anchorSceneId)) {
      assignedSceneId = item.anchorSceneId;
      anchorBeat = anchorMap.get(item.anchorSceneId);
    } else {
      const cleanSlug = (item.slug || `beat_${i + 1}`).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const uniqueSuffix = Math.random().toString(36).slice(2, 6);
      assignedSceneId = `scene_${cleanSlug}_${uniqueSuffix}`;
    }

    // Register all valid reference patterns
    if (item.anchorSceneId) {
      refToSceneId.set(`anchor:${item.anchorSceneId}`, assignedSceneId);
      refToSceneId.set(item.anchorSceneId, assignedSceneId);
    }
    if (item.slug) {
      refToSceneId.set(`new:${item.slug}`, assignedSceneId);
      refToSceneId.set(item.slug, assignedSceneId);
    }
    refToSceneId.set(`order:${item.order || i + 1}`, assignedSceneId);
    refToSceneId.set(assignedSceneId, assignedSceneId);

    preppedItems.push({
      item,
      assignedSceneId,
      isAnchor: isAnchor && !!anchorBeat,
      anchorBeat,
    });
  }

  // Second pass: Construct canonical StoryBeats and resolve choice targets
  const finalBeats: WeavedBeat[] = [];

  for (let i = 0; i < preppedItems.length; i++) {
    const { item, assignedSceneId, isAnchor, anchorBeat } = preppedItems[i];

    const choices = (item.choices || []).map((c, cIdx) => {
      const choiceId = `choice_${assignedSceneId}_${cIdx + 1}`;
      const choiceText = c.textFa || c.textEn || (c as any).text || `Choice ${cIdx + 1}`;

      // Resolve target scene ID from leadToRef
      let resolvedTarget: string | undefined = undefined;
      const ref = (c.leadToRef || (c as any).leadToSceneId || (c as any).targetSceneId || '').trim();
      if (ref && refToSceneId.has(ref)) {
        resolvedTarget = refToSceneId.get(ref);
      } else if (ref && refToSceneId.has(`new:${ref}`)) {
        resolvedTarget = refToSceneId.get(`new:${ref}`);
      } else if (ref && refToSceneId.has(`anchor:${ref}`)) {
        resolvedTarget = refToSceneId.get(`anchor:${ref}`);
      } else if (!ref && i < preppedItems.length - 1) {
        // Natural linear fallback to next beat if no explicit ref given
        resolvedTarget = preppedItems[i + 1].assignedSceneId;
      }

      const style =
        c.style === 'tactical_agile' || c.style === 'agile'
          ? ('agile' as const)
          : c.style === 'aggressive_daring' || c.style === 'aggressive'
          ? ('aggressive' as const)
          : c.style === 'inquisitive'
          ? ('inquisitive' as const)
          : ('defensive' as const);

      const riskLevel =
        style === 'aggressive'
          ? ('high' as const)
          : style === 'agile'
          ? ('medium' as const)
          : ('low' as const);

      return {
        id: choiceId,
        text: choiceText,
        style,
        riskLevel,
        targetDC: c.statCheck?.dc,
        requiredStatId: c.statCheck?.stat,
        targetSceneId: resolvedTarget,
      };
    });

    if (isAnchor && anchorBeat) {
      // Contract: preserve anchor narrativeText and locationId verbatim!
      finalBeats.push({
        sceneId: assignedSceneId,
        locationId: anchorBeat.locationId,
        narrativeText: anchorBeat.narrativeText,
        imageUrl: anchorBeat.imageUrl,
        choices: choices.length > 0 ? choices : anchorBeat.choices,
        kind: 'anchor',
        order: item.order || i + 1,
        title: item.title || `Anchor ${i + 1}`,
        carryoverSummary: item.carryoverSummary,
        introducedEntityNames: item.introducedEntityNames,
      });
    } else {
      finalBeats.push({
        sceneId: assignedSceneId,
        locationId: resolveLocationId(item.settingLocationName),
        narrativeText: (item.narrativeText || '').trim(),
        choices,
        kind: item.kind === 'expansion' ? 'expansion' : 'bridge',
        order: item.order || i + 1,
        title: item.title || `Beat ${i + 1}`,
        carryoverSummary: item.carryoverSummary,
        introducedEntityNames: item.introducedEntityNames,
      });
    }
  }

  return finalBeats;
}

/**
 * Audits the quality and structural integrity of a synthesized StoryWeave.
 */
export function auditWeaveQuality(params: {
  weavedBeats: WeavedBeat[];
  expectedAnchors: StoryBeat[];
  rpgStatIds?: string[];
}): WeaveQualityReport {
  const { weavedBeats, expectedAnchors, rpgStatIds = [] } = params;
  const findings: WeaveQualityFinding[] = [];

  const realExpectedAnchors = evictPlaceholderBeats(expectedAnchors).filter((b) => !isPlaceholderBeat(b));
  const sceneIds = new Set(weavedBeats.map((b) => b.sceneId));

  // 1. Anchor Preservation Contract
  for (const expected of realExpectedAnchors) {
    const matched = weavedBeats.find((b) => b.sceneId === expected.sceneId && b.kind === 'anchor');
    if (!matched) {
      findings.push({
        severity: 'error',
        category: 'anchor_missing',
        title: 'Missing required anchor scene',
        description: `Authored anchor "${expected.sceneId}" was omitted from the weaved story sequence.`,
      });
    } else if (matched.narrativeText.trim() !== expected.narrativeText.trim()) {
      findings.push({
        severity: 'error',
        category: 'anchor_mutated',
        title: 'Anchor narrative mutated',
        description: `Anchor "${expected.sceneId}" narrative was altered. Authored anchor text must remain verbatim.`,
      });
    }
  }

  // 2. Opener Contract (first beat)
  if (weavedBeats.length > 0) {
    const opener = weavedBeats[0];
    const textLen = (opener.narrativeText || '').trim().length;
    if (textLen < 60) {
      findings.push({
        severity: 'warning',
        category: 'opener_weak',
        title: 'Short or ungrounded opener beat',
        description: `The opening beat (#1) only contains ${textLen} characters. Opening beats must establish clear sensory grounding.`,
      });
    }
  }

  // 3. Graph Integrity: Check for dangling edges
  for (const beat of weavedBeats) {
    for (const choice of beat.choices || []) {
      if (choice.targetSceneId && !sceneIds.has(choice.targetSceneId)) {
        findings.push({
          severity: 'error',
          category: 'dangling_edge',
          title: 'Dangling choice target',
          description: `Choice "${choice.text}" in beat "${beat.sceneId}" links to missing target "${choice.targetSceneId}".`,
        });
      }
    }
  }

  // 4. Choice Diversity & Stat Validity
  const allowedStats = new Set(rpgStatIds);
  for (const beat of weavedBeats) {
    const texts = new Set<string>();
    for (const c of beat.choices || []) {
      const norm = c.text.trim().toLowerCase();
      if (texts.has(norm)) {
        findings.push({
          severity: 'warning',
          category: 'choice_diversity',
          title: 'Duplicate choice text in beat',
          description: `Beat "${beat.sceneId}" contains duplicate choice text "${c.text}". Choices must offer distinct options.`,
        });
      }
      texts.add(norm);

      if (c.requiredStatId && allowedStats.size > 0 && !allowedStats.has(c.requiredStatId)) {
        findings.push({
          severity: 'warning',
          category: 'choice_diversity',
          title: 'Unknown RPG stat referenced in check',
          description: `Choice "${c.text}" references stat "${c.requiredStatId}" which does not exist in the story RPG system.`,
        });
      }

      if (typeof c.targetDC === 'number' && (c.targetDC < 5 || c.targetDC > 30)) {
        findings.push({
          severity: 'warning',
          category: 'choice_diversity',
          title: 'Out of bounds target DC',
          description: `Choice "${c.text}" has DC ${c.targetDC}. Realistic DCs must be between 5 and 30.`,
        });
      }
    }
  }

  // Calculate quality score
  let penalty = 0;
  for (const f of findings) {
    if (f.severity === 'error') penalty += 25;
    else if (f.severity === 'warning') penalty += 8;
    else penalty += 3;
  }
  const score = Math.max(0, 100 - penalty);

  return {
    score,
    summary:
      findings.length === 0
        ? 'Weave quality audit passed flawlessly.'
        : `Weave quality audit completed with ${findings.length} findings (Score: ${score}/100).`,
    findings,
  };
}
