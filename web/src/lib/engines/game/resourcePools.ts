import { RPGSystemSchema } from '@/lib/types/rpg';
import { PlayerState } from '@/lib/types/gameplay';
import { computeMaxResources } from './vitalScaling';

/**
 * Single source of truth for reading a resource pool maximum.
 * Prefers the scaled `playerState.maxResources` (archetype/background/
 * stat-effects/equipment) and falls back to the story definition.
 */
export function resolveResourceMax(
  resourceId: string,
  rpgSystem?: RPGSystemSchema | any,
  playerState?: PlayerState | any
): number {
  const scaled = playerState?.maxResources?.[resourceId];
  if (typeof scaled === 'number' && Number.isFinite(scaled)) return scaled;
  const def = (rpgSystem?.resources ?? []).find((r: any) => r.id === resourceId);
  if (def && typeof def.max === 'number' && Number.isFinite(def.max)) return def.max;
  return 100;
}

export function resolveResourceMin(
  resourceId: string,
  rpgSystem?: RPGSystemSchema | any
): number {
  const def = (rpgSystem?.resources ?? []).find((r: any) => r.id === resourceId);
  if (def && typeof def.min === 'number' && Number.isFinite(def.min)) return def.min;
  return 0;
}

function resolveEquippedArtifacts(playerState: PlayerState, storyArtifacts: any[] = []): any[] {
  const ids = [
    playerState.equipment?.mainHand,
    playerState.equipment?.offHand,
    playerState.equipment?.armor,
    playerState.equipment?.relic,
  ].filter((x): x is string => !!x);
  const byId = new Map<string, any>();
  for (const item of playerState.inventory ?? []) byId.set(item.id, item);
  for (const art of storyArtifacts ?? []) if (art?.id && !byId.has(art.id)) byId.set(art.id, art);
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * Reconciles a persisted playerState against the CURRENT story RPG definitions.
 * Handles Studio edits to Resource Pools after a session was created:
 * - adds newly created pools (seeded from definition current, clamped to scaled max)
 * - removes deleted pools from resources/maxResources
 * - recomputes scaled maximums (archetype/background/stat-effects/equipment)
 * - clamps current values into [min, max]
 *
 * Returns the (possibly new) playerState and whether anything changed.
 */
export function reconcilePlayerResources(
  playerState: PlayerState,
  rpgSystem: RPGSystemSchema | any,
  storyWorldBible?: any
): { playerState: PlayerState; changed: boolean } {
  const defs: any[] = rpgSystem?.resources ?? [];
  const defIds = new Set(defs.map((d) => d.id));
  let changed = false;

  const archetype = (rpgSystem?.archetypes ?? []).find((a: any) => a.id === playerState.archetypeId);
  const background = (rpgSystem?.backgrounds ?? []).find((b: any) => b.id === playerState.backgroundId);
  const equippedArtifacts = resolveEquippedArtifacts(playerState, storyWorldBible?.artifacts);

  const maxResources = computeMaxResources(playerState.stats ?? {}, rpgSystem, {
    archetype,
    background,
    equippedArtifacts,
  });

  const prevMaxSource: Record<string, number> = playerState.maxResources ?? {};
  if (JSON.stringify(prevMaxSource) !== JSON.stringify(maxResources)) changed = true;

  const nextResources: Record<string, number> = {};
  for (const def of defs) {
    const max = maxResources[def.id] ?? def.max ?? 100;
    const min = typeof def.min === 'number' ? def.min : 0;
    const existing = playerState.resources?.[def.id];
    const prevMax: number | undefined = prevMaxSource[def.id];
    let seed: number;
    if (typeof existing !== 'number') {
      // New pool (studio added it mid-campaign): start full like a new character.
      seed = max;
    } else if (prevMax !== undefined && existing >= prevMax && max !== prevMax) {
      // Pool was full before the studio max edit: stay full, move with max.
      seed = max;
    } else {
      seed = existing;
    }
    const clamped = Math.min(max, Math.max(min, seed));
    nextResources[def.id] = clamped;
    if (existing === undefined || existing !== clamped) changed = true;
  }
  // Detect removed pools
  for (const key of Object.keys(playerState.resources ?? {})) {
    if (!defIds.has(key)) changed = true;
  }

  if (!changed) {
    // Still ensure maxResources object is attached for readers that prefer it
    if (!playerState.maxResources) {
      return { playerState: { ...playerState, maxResources }, changed: true };
    }
    return { playerState, changed: false };
  }

  return {
    playerState: { ...playerState, resources: nextResources, maxResources },
    changed: true,
  };
}
