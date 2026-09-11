import { StoryManifest } from '@/lib/types';
import { StoryBeat, StoryBeatChoiceSchema } from '@/lib/types/world';

/**
 * Strips legacy `[Arc X]` or `[پرده X]` prefixes that may have been injected into scene prose.
 */
export function stripLegacyArcPrefix(text: string): string {
  if (!text) return '';
  return text.replace(/^\[(?:arc|پرده)\s*[\d\w\u06F0-\u06F9]+\]\s*/i, '').trim();
}

/**
 * Normalizes a single StoryBeat, ensuring legacy choice keys like
 * `destinationSceneId` are cleanly remapped to `targetSceneId`
 * and legacy arc bracket prefixes are cleaned from narrative prose.
 */
export function normalizeBeatChoices(beat: StoryBeat): StoryBeat {
  const choices = (beat.choices || []).map((choice: any) => {
    const targetSceneId = choice.targetSceneId || choice.destinationSceneId || choice.leadToSceneId;
    const clean = {
      id: choice.id,
      text: choice.text,
      style: choice.style || 'inquisitive',
      riskLevel: choice.riskLevel || 'medium',
      targetDC: choice.targetDC,
      requiredStatId: choice.requiredStatId,
      targetSceneId: targetSceneId || undefined,
    };
    return clean;
  });

  const narrativeText = stripLegacyArcPrefix(beat.narrativeText || '');

  return {
    ...beat,
    narrativeText,
    choices,
  };
}

/**
 * Migrates a StoryManifest to the Plan 12 Unified Beat Graph.
 *
 * In Plan 12:
 * 1. All scenes live in `story.initialStoryBeats` as a single unified collection.
 * 2. Each beat carries an optional `chapterId` tag:
 *    - `chapterId === undefined` or `null`: opening / prologue / unassigned beat
 *    - `chapterId === '<id>'`: belongs to that specific saga chapter
 * 3. Chapters in `story.saga.chapters` become metadata-only containers
 *    (storing title, scopeTier, narrativeGoal, prerequisiteFlags, etc.).
 * 4. Legacy `destinationSceneId` edge properties are migrated to `targetSceneId`.
 * 5. The migration is strictly idempotent.
 */
export function migrateStoryManifestToUnifiedGraph(manifest: StoryManifest): StoryManifest {
  if (!manifest) return manifest;

  const clone: StoryManifest = JSON.parse(JSON.stringify(manifest));

  const existingBeatsMap = new Map<string, StoryBeat>();

  // 1. Ingest existing flat beats
  for (const rawBeat of clone.initialStoryBeats || []) {
    const normalized = normalizeBeatChoices(rawBeat);
    existingBeatsMap.set(normalized.sceneId, normalized);
  }

  // 2. Ingest scenes from saga chapters, tagging them with chapterId
  if (clone.saga?.chapters && Array.isArray(clone.saga.chapters)) {
    for (const chapter of clone.saga.chapters) {
      const chapterScenes = chapter.scenes || [];
      for (const rawScene of chapterScenes) {
        const normalized = normalizeBeatChoices(rawScene);
        normalized.chapterId = chapter.id;

        if (existingBeatsMap.has(normalized.sceneId)) {
          // Merge metadata / ensure chapterId is tagged
          const existing = existingBeatsMap.get(normalized.sceneId)!;
          existing.chapterId = chapter.id;
          if (!existing.narrativeText && normalized.narrativeText) {
            existing.narrativeText = normalized.narrativeText;
          }
          if ((!existing.choices || existing.choices.length === 0) && normalized.choices?.length > 0) {
            existing.choices = normalized.choices;
          }
        } else {
          existingBeatsMap.set(normalized.sceneId, normalized);
        }
      }

      // In the unified graph, chapter scenes array is emptied (metadata-only chapter)
      chapter.scenes = [];
    }
  }

  // 3. Assemble unified beats list
  const unifiedBeats = Array.from(existingBeatsMap.values());

  clone.initialStoryBeats = unifiedBeats;
  (clone as any).graphVersion = 2;

  // 4. Ensure initialSceneId points to a valid scene if available
  if (unifiedBeats.length > 0) {
    const hasInitial = unifiedBeats.some((b) => b.sceneId === clone.initialSceneId);
    if (!hasInitial) {
      // Find first unassigned opening beat, or first beat overall
      const opening = unifiedBeats.find((b) => !b.chapterId) || unifiedBeats[0];
      clone.initialSceneId = opening.sceneId;
    }
  }

  return clone;
}

/**
 * Returns all beats belonging to a specific chapter in the unified graph.
 * Backwards-compatible: if chapter.scenes still contains legacy items, merges them.
 */
export function getBeatsForChapter(story: StoryManifest, chapterId: string): StoryBeat[] {
  const fromUnified = (story.initialStoryBeats || []).filter((b) => b.chapterId === chapterId);
  if (fromUnified.length > 0) return fromUnified;

  const legacyChapter = story.saga?.chapters?.find((c) => c.id === chapterId);
  return legacyChapter?.scenes || [];
}

/**
 * Returns all opening/prologue beats in the unified graph (beats without a chapterId).
 */
export function getOpeningBeats(story: StoryManifest): StoryBeat[] {
  return (story.initialStoryBeats || []).filter((b) => !b.chapterId);
}

/**
 * Replaces or updates the scenes belonging to a specific chapter inside the unified graph.
 */
export function updateUnifiedChapterScenes(
  story: StoryManifest,
  chapterId: string,
  newScenes: StoryBeat[]
): StoryManifest {
  const tagged = newScenes.map((s) => ({ ...normalizeBeatChoices(s), chapterId }));
  const remaining = (story.initialStoryBeats || []).filter((b) => b.chapterId !== chapterId);

  return {
    ...story,
    initialStoryBeats: [...remaining, ...tagged],
  };
}
