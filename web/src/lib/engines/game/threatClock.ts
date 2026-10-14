import { DiceOutcome, TensionClock } from '@/lib/types/gameplay';
import { WorldBible, WorldLocation } from '@/lib/types/world';

/**
 * Plan 13: D&D "Director & Scribe" — Tension & Threat Clocks + Hazard Displacement.
 * Pure deterministic helpers (no AI, no randomness) so they are unit-testable.
 */

/** Tick delta per dice outcome. critical_success relieves pressure (-1, floored at 0). */
export function clockTickDelta(outcome: DiceOutcome): number {
  switch (outcome) {
    case 'critical_success':
      return -1;
    case 'success':
      return 0;
    case 'mixed_success':
    case 'failure':
      return 1;
    case 'critical_failure':
      return 2;
    default:
      return 0;
  }
}

export function tickTensionClock(
  clock: TensionClock,
  outcome: DiceOutcome
): { newSegments: number; isCrisis: boolean } {
  const max = Math.max(2, clock.maxSegments || 4);
  const next = Math.min(max, Math.max(0, (clock.currentSegments || 0) + clockTickDelta(outcome)));
  return { newSegments: next, isCrisis: next >= max };
}

/**
 * Resolves the effective location declaring a threat clock for the given location,
 * traversing up the ancestry chain (parentLocationId) if the current location has no clock.
 */
export function resolveLocationWithThreatClock(
  location: WorldLocation | undefined,
  worldBible?: WorldBible
): WorldLocation | null {
  if (!location) return null;
  if (location.threatClockDefault?.name) return location;
  if (!location.parentLocationId || !worldBible?.locations) return null;

  const visited = new Set<string>([location.id]);
  let currentParentId: string | undefined = location.parentLocationId;

  while (currentParentId) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);
    const parentLoc = worldBible.locations.find((l) => l.id === currentParentId);
    if (!parentLoc) break;
    if (parentLoc.threatClockDefault?.name) {
      return parentLoc;
    }
    currentParentId = parentLoc.parentLocationId;
  }
  return null;
}

/** Clock id convention: one active clock per zone (or shared regional ancestor). */
export function clockIdForLocation(locationId: string, worldBible?: WorldBible): string {
  if (worldBible?.locations) {
    const loc = worldBible.locations.find((l) => l.id === locationId);
    const effectiveLoc = resolveLocationWithThreatClock(loc, worldBible);
    if (effectiveLoc) {
      return `clock_${effectiveLoc.id}`;
    }
  }
  return `clock_${locationId}`;
}

/**
 * Ensures an active clock exists for the zone when the location (or its regional ancestor)
 * declares a threatClockDefault. Returns the clock to use (existing or freshly spawned),
 * or null when neither exists.
 */
export function ensureClockForLocation(
  activeClocks: TensionClock[] | undefined,
  location: WorldLocation | undefined,
  worldBible?: WorldBible
): TensionClock | null {
  if (!location) return null;
  const effectiveLoc = resolveLocationWithThreatClock(location, worldBible) || location;
  const id = `clock_${effectiveLoc.id}`;
  const existing = (activeClocks ?? []).find((c) => c.id === id);
  if (existing) return existing;
  const def = effectiveLoc.threatClockDefault;
  if (!def?.name) return null;
  return {
    id,
    name: def.name,
    currentSegments: 0,
    maxSegments: Math.max(2, def.maxSegments || 4),
    crisisDescription: def.crisisDescription || '',
    isTriggered: false,
  };
}

/**
 * Hazard displacement: only on high-risk failure/critical_failure when the
 * current location declares a valid hazardFallbackLocationId.
 * Returns the fallback location id, or undefined.
 * Warns (does not throw) on dangling ids so old Bibles stay playable.
 */
export function resolveDisplacement(
  worldBible: WorldBible | undefined,
  currentLocationId: string | undefined,
  riskLevel: string | undefined,
  outcome: DiceOutcome
): string | undefined {
  if (riskLevel !== 'high') return undefined;
  if (outcome !== 'failure' && outcome !== 'critical_failure') return undefined;
  if (!worldBible || !currentLocationId) return undefined;
  const current = (worldBible.locations ?? []).find((l) => l.id === currentLocationId);
  const fallbackId = current?.hazardFallbackLocationId;
  if (!fallbackId) return undefined;
  const target = (worldBible.locations ?? []).find((l) => l.id === fallbackId);
  if (!target) {
    console.warn(`[threatClock] dangling hazardFallbackLocationId "${fallbackId}" on "${currentLocationId}" — ignoring.`);
    return undefined;
  }
  if (target.id === currentLocationId) return undefined;
  return target.id;
}

/**
 * Prunes location/regional threat clocks when the player leaves their region or reaches
 * a destination city/safe zone that does not belong to that threat region.
 */
export function pruneInactiveZoneClocks(
  activeClocks: TensionClock[] | undefined,
  currentLocationId: string | undefined,
  worldBible?: WorldBible
): TensionClock[] {
  if (!activeClocks || activeClocks.length === 0) return [];
  if (!currentLocationId || !worldBible?.locations) return activeClocks;

  const currentLoc = worldBible.locations.find((l) => l.id === currentLocationId);
  const activeZoneWithClock = resolveLocationWithThreatClock(currentLoc, worldBible);
  const activeZoneClockId = activeZoneWithClock ? `clock_${activeZoneWithClock.id}` : null;

  return activeClocks.filter((clock) => {
    // Only prune location-scoped clocks (starting with clock_loc_); non-location clocks stay.
    if (!clock.id.startsWith('clock_loc_')) return true;
    return clock.id === activeZoneClockId;
  });
}
