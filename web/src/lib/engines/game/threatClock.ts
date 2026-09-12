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

/** Clock id convention: one active clock per zone. */
export function clockIdForLocation(locationId: string): string {
  return `clock_${locationId}`;
}

/**
 * Ensures an active clock exists for the zone when the location declares a
 * threatClockDefault. Returns the clock to use (existing or freshly spawned),
 * or null when neither exists.
 */
export function ensureClockForLocation(
  activeClocks: TensionClock[] | undefined,
  location: WorldLocation | undefined
): TensionClock | null {
  if (!location) return null;
  const id = clockIdForLocation(location.id);
  const existing = (activeClocks ?? []).find((c) => c.id === id);
  if (existing) return existing;
  const def = location.threatClockDefault;
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
