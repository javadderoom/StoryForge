import { StoryBeat } from '@/lib/types/world';

/**
 * Standard factory template texts that designate a seed placeholder beat.
 */
const PLACEHOLDER_PREFIXES = [
  'نقطه شروع داستان. اینجا روایت آغاز می‌شود',
  'نقطه شروع داستان',
  'The story begins here. Write the opening narrative',
  'The story begins here',
];

/**
 * Identifies whether a given story beat is an unmodified factory placeholder.
 */
export function isPlaceholderBeat(beat?: StoryBeat | null): boolean {
  if (!beat) return false;
  // A placeholder typically has no choices and empty/default location
  const hasNoChoices = !beat.choices || beat.choices.length === 0;
  const isDefaultLoc = !beat.locationId || beat.locationId === 'loc_hub';
  const text = (beat.narrativeText || '').trim();

  const matchesPlaceholderText = PLACEHOLDER_PREFIXES.some((prefix) => text.startsWith(prefix));

  return hasNoChoices && isDefaultLoc && matchesPlaceholderText;
}

/**
 * Evicts placeholder seed beats from a story's beat list when real authored beats exist.
 * If all beats in the list are placeholders, keeps the first one to avoid an empty array.
 */
export function evictPlaceholderBeats(beats: StoryBeat[]): StoryBeat[] {
  if (!beats || beats.length === 0) return [];
  const nonPlaceholders = beats.filter((b) => !isPlaceholderBeat(b));
  return nonPlaceholders.length > 0 ? nonPlaceholders : [beats[0]];
}

/**
 * Normalizes an identifier or title string for fuzzy edge-matching.
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
    .replace(/[«»""''،,.:;!؟?\-_/\\()[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ResolveEdgesResult {
  resolvedBeats: StoryBeat[];
  unresolvedCount: number;
  warnings: string[];
}

/**
 * Resolves choice target links across available story beats.
 *
 * Matching hierarchy:
 * 1. Exact match on sceneId
 * 2. Exact match on title / narrative slug
 * 3. Normalized fuzzy match on sceneId or title
 *
 * If a target cannot be resolved to any real scene, the edge is set to undefined
 * so hallucinated IDs are not persisted into the manifest.
 */
export function resolveSceneChoiceEdges(
  newOrEditedBeats: StoryBeat[],
  contextScenes: StoryBeat[] = []
): ResolveEdgesResult {
  // Combine all known candidate scenes: both context scenes and the beats themselves
  const candidateScenes = new Map<string, StoryBeat>();
  for (const scene of contextScenes) {
    if (scene && scene.sceneId) candidateScenes.set(scene.sceneId, scene);
  }
  for (const scene of newOrEditedBeats) {
    if (scene && scene.sceneId) candidateScenes.set(scene.sceneId, scene);
  }

  const allCandidates = Array.from(candidateScenes.values());
  const warnings: string[] = [];
  let unresolvedCount = 0;

  const resolvedBeats: StoryBeat[] = newOrEditedBeats.map((beat) => {
    const choices = (beat.choices || []).map((choice: any) => {
      const rawTarget = (choice.targetSceneId || choice.destinationSceneId || choice.leadToSceneId || '').trim();

      if (!rawTarget) {
        // Clean edge without destination
        const cleanChoice = { ...choice };
        delete cleanChoice.destinationSceneId;
        delete cleanChoice.leadToSceneId;
        cleanChoice.targetSceneId = undefined;
        return cleanChoice;
      }

      // 1. Exact sceneId match
      if (candidateScenes.has(rawTarget)) {
        const cleanChoice = { ...choice };
        delete cleanChoice.destinationSceneId;
        delete cleanChoice.leadToSceneId;
        cleanChoice.targetSceneId = rawTarget;
        return cleanChoice;
      }

      // 2. Exact match against scene title or prefix in narrativeText
      const normalizedTarget = normalizeForComparison(rawTarget);
      let matchedScene: StoryBeat | undefined = allCandidates.find((c) => {
        // Check if rawTarget matches sceneId case-insensitively
        if (c.sceneId.toLowerCase() === rawTarget.toLowerCase()) return true;
        // Check if rawTarget matches scene title in narrative
        const firstLine = (c.narrativeText || '').split('\n')[0] || '';
        return normalizeForComparison(firstLine) === normalizedTarget;
      });

      // 3. Fuzzy match
      if (!matchedScene) {
        matchedScene = allCandidates.find((c) => {
          const normSceneId = normalizeForComparison(c.sceneId);
          if (normSceneId === normalizedTarget) return true;
          const firstLine = normalizeForComparison((c.narrativeText || '').split('\n')[0] || '');
          if (firstLine && (firstLine.includes(normalizedTarget) || normalizedTarget.includes(firstLine))) {
            return true;
          }
          return false;
        });
      }

      const cleanChoice = { ...choice };
      delete cleanChoice.destinationSceneId;
      delete cleanChoice.leadToSceneId;

      if (matchedScene) {
        cleanChoice.targetSceneId = matchedScene.sceneId;
      } else {
        // Unmatched: clear hallucinated ID and record warning
        cleanChoice.targetSceneId = undefined;
        unresolvedCount++;
        warnings.push(
          `Unresolved choice target: Choice "${choice.text || choice.id}" in scene "${beat.sceneId}" targeted missing scene "${rawTarget}". Cleared dangling edge.`
        );
      }

      return cleanChoice;
    });

    return {
      ...beat,
      choices,
    };
  });

  return {
    resolvedBeats,
    unresolvedCount,
    warnings,
  };
}
