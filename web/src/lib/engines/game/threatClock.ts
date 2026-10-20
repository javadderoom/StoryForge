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
 * If the location or its active sub-zone declares `suppressThreatClock: true` (or is a sanctuary),
 * it returns null, silencing any inherited parent threat clocks.
 */
export function resolveLocationWithThreatClock(
  location: WorldLocation | undefined,
  worldBible?: WorldBible,
  currentSubZoneId?: string
): WorldLocation | null {
  if (!location) return null;

  // 1. Check if the active sub-zone suppresses clocks
  if (currentSubZoneId && location.subZones) {
    const subZone = location.subZones.find((sz) => sz.id === currentSubZoneId);
    if (subZone && (subZone.suppressThreatClock || subZone.subType === 'sanctuary')) {
      return null;
    }
  }

  // 2. Check if the location itself explicitly suppresses clocks
  if (location.suppressThreatClock) return null;

  // 3. Direct clock declaration
  if (location.threatClockDefault?.name) return location;

  // 4. Ancestor inheritance (parentLocationId)
  if (!location.parentLocationId || !worldBible?.locations) return null;

  const visited = new Set<string>([location.id]);
  let currentParentId: string | undefined = location.parentLocationId;

  while (currentParentId) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);
    const parentLoc = worldBible.locations.find((l) => l.id === currentParentId);
    if (!parentLoc) break;
    if (parentLoc.suppressThreatClock) return null;
    if (parentLoc.threatClockDefault?.name) {
      return parentLoc;
    }
    currentParentId = parentLoc.parentLocationId;
  }
  return null;
}

/** Clock id convention: one active clock per zone (or shared regional ancestor). */
export function clockIdForLocation(
  locationId: string,
  worldBible?: WorldBible,
  currentSubZoneId?: string
): string | null {
  if (worldBible?.locations) {
    const loc = worldBible.locations.find((l) => l.id === locationId);
    const effectiveLoc = resolveLocationWithThreatClock(loc, worldBible, currentSubZoneId);
    if (effectiveLoc) {
      return `clock_${effectiveLoc.id}`;
    }
    // If the location or active sub-zone explicitly suppressed the clock, return null
    if (loc?.suppressThreatClock) return null;
    if (currentSubZoneId && loc?.subZones) {
      const sz = loc.subZones.find((s) => s.id === currentSubZoneId);
      if (sz && (sz.suppressThreatClock || sz.subType === 'sanctuary')) return null;
    }
  }
  return `clock_${locationId}`;
}

/**
 * Ensures an active clock exists for the zone when the location (or its regional ancestor)
 * declares a threatClockDefault. Returns the clock to use (existing or freshly spawned),
 * or null when neither exists or when suppressed.
 */
export function ensureClockForLocation(
  activeClocks: TensionClock[] | undefined,
  location: WorldLocation | undefined,
  worldBible?: WorldBible,
  currentSubZoneId?: string
): TensionClock | null {
  if (!location) return null;
  const effectiveLoc = resolveLocationWithThreatClock(location, worldBible, currentSubZoneId);
  if (!effectiveLoc) return null;
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
 * Ensures the zone's ambient clock is present in the active list. Unlike
 * `ensureClockForLocation` — which is called from the dice tick and therefore
 * only ever ran when a check produced a clock delta — this is the entry-path
 * seeder: session start, resume, and every location change. It makes authored
 * clocks visible at 0/max before any complication happens.
 */
export function seedAmbientClock(
  activeClocks: TensionClock[] | undefined,
  locationId: string | undefined,
  worldBible?: WorldBible,
  currentSubZoneId?: string
): TensionClock[] {
  const clocks = activeClocks ?? [];
  if (!locationId || !worldBible?.locations) return clocks;
  const location = worldBible.locations.find((l) => l.id === locationId);
  if (!location) return clocks;
  const id = clockIdForLocation(locationId, worldBible, currentSubZoneId);
  if (!id) {
    // Clock is suppressed for this location or sub-zone
    return clocks;
  }
  if (clocks.some((c) => c.id === id)) return clocks;
  const seeded = ensureClockForLocation(clocks, location, worldBible, currentSubZoneId);
  return seeded ? [...clocks, seeded] : clocks;
}

// ---------------------------------------------------------------------------
// Writer-declared clock movement (Plan 13 follow-up — narrative tension authority)
//
// Dice outcomes are the only deterministic clock source, which meant diceless /
// authored play could never move a clock, and a clean success at a clock zone
// never even materialised one. The writer now declares evidence-gated movement
// in `clockChanges` (see the prompt contract); this is its server-side gate.
// ---------------------------------------------------------------------------

/** Per-turn bound for writer-declared clock movement (per clock). */
export const MAX_CLOCK_DELTA_PER_TURN = 2;
/** At most this many distinct clocks may move in one scene. */
export const MAX_CLOCK_CHANGES_PER_TURN = 2;

export interface DeclaredClockChange {
  clockId?: string;
  clockName?: string;
  delta: number;
  reason?: string;
}

export interface AppliedClockChange {
  clockId: string;
  clockName: string;
  delta: number;
  reason: string;
  previousSegments: number;
  newSegments: number;
  maxSegments: number;
  isCrisis: boolean;
  crisisDescription?: string;
}

export interface ClockChangeResolutionInput {
  declared: DeclaredClockChange[];
  activeClocks?: TensionClock[];
  locationId?: string;
  worldBible?: WorldBible;
  /**
   * Clocks already advanced deterministically by this turn's dice check.
   * They are skipped so the same complication is never counted twice.
   */
  skipClockIds?: string[];
}

function clampClockDelta(delta: number): number {
  const rounded = Math.round(delta);
  return Math.sign(rounded) * Math.min(MAX_CLOCK_DELTA_PER_TURN, Math.abs(rounded));
}

function normalizeClockMatchText(text: string): string {
  return (text || '')
    .replace(/[\u200c\u200b\u200d\u00ad]/g, ' ')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[«»"'`.,،؟!؛:()\[\]{}_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Adapter-side normalization; resolution below is the authority. */
export function normalizeClockChanges(raw: unknown): DeclaredClockChange[] {
  if (!Array.isArray(raw)) return [];
  const out: DeclaredClockChange[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const clockId =
      typeof entry.clockId === 'string'
        ? entry.clockId.trim().slice(0, 80)
        : typeof entry.id === 'string'
          ? entry.id.trim().slice(0, 80)
          : '';
    const clockName =
      typeof entry.clockName === 'string'
        ? entry.clockName.trim().slice(0, 120)
        : typeof entry.name === 'string'
          ? entry.name.trim().slice(0, 120)
          : '';
    const rawDelta =
      typeof entry.delta === 'number' ? entry.delta : Number(entry.delta);
    if (!Number.isFinite(rawDelta) || rawDelta === 0) continue;
    if (!clockId && !clockName) continue;
    const reasonSource =
      typeof entry.reason === 'string'
        ? entry.reason
        : typeof entry.evidence === 'string'
          ? entry.evidence
          : '';
    const reason = reasonSource.trim().slice(0, 240);
    out.push({
      ...(clockId ? { clockId } : {}),
      ...(clockName ? { clockName } : {}),
      delta: clampClockDelta(rawDelta),
      ...(reason ? { reason } : {}),
    });
    if (out.length >= MAX_CLOCK_CHANGES_PER_TURN) break;
  }
  return out;
}

function resolveClockIndex(
  entry: DeclaredClockChange,
  clocks: TensionClock[]
): number {
  const id = entry.clockId?.trim();
  if (id) {
    const byId = clocks.findIndex((clock) => clock.id === id);
    if (byId >= 0) return byId;
  }
  const wanted = normalizeClockMatchText(entry.clockName || '');
  if (!wanted) return -1;
  const exact = clocks.findIndex(
    (clock) => normalizeClockMatchText(clock.name) === wanted
  );
  if (exact >= 0) return exact;
  const contained = clocks
    .map((clock, index) => ({ name: normalizeClockMatchText(clock.name), index }))
    .filter(({ name }) => Boolean(name) && (name.includes(wanted) || wanted.includes(name)));
  return contained.length === 1 ? contained[0].index : -1;
}

/**
 * Evidence-gated resolution of the writer's `clockChanges`:
 *  - seed the current zone's ambient clock first (so a fresh session can move it),
 *  - only active clocks may move (id or normalized name),
 *  - every change needs a prose reason,
 *  - triggered clocks are spent and never move again,
 *  - deltas clamp to ±2 per clock, merged per clock, at most 2 clocks per turn,
 *  - filling the clock sets `isTriggered` and reports the crisis exactly once.
 */
export function resolveDeclaredClockChanges(
  input: ClockChangeResolutionInput
): { clocks: TensionClock[]; applied: AppliedClockChange[] } {
  const seeded = seedAmbientClock(input.activeClocks, input.locationId, input.worldBible);
  const declared = input.declared ?? [];
  if (declared.length === 0) return { clocks: seeded, applied: [] };

  const clocks = seeded.map((clock) => ({ ...clock }));
  const skipped = new Set(input.skipClockIds ?? []);
  const pending = new Map<
    string,
    { index: number; delta: number; reason: string }
  >();

  for (const entry of declared) {
    if (!entry || typeof entry.delta !== 'number' || !Number.isFinite(entry.delta)) {
      continue;
    }
    if (entry.delta === 0) continue;
    const reason = (entry.reason ?? '').trim();
    if (!reason) continue; // evidence gate

    const index = resolveClockIndex(entry, clocks);
    if (index < 0) continue;
    const clock = clocks[index];
    if (clock.isTriggered) continue; // crisis already paid out
    if (skipped.has(clock.id)) continue; // deterministic tick already moved it this turn

    const delta = clampClockDelta(entry.delta);
    if (delta === 0) continue;

    const prior = pending.get(clock.id);
    if (prior) {
      prior.delta = clampClockDelta(prior.delta + delta);
      if (prior.delta === 0) pending.delete(clock.id);
    } else {
      pending.set(clock.id, { index, delta, reason: reason.slice(0, 240) });
      if (pending.size >= MAX_CLOCK_CHANGES_PER_TURN) break;
    }
  }

  const applied: AppliedClockChange[] = [];
  for (const [clockId, change] of pending) {
    const clock = clocks[change.index];
    const maxSegments = Math.max(2, clock.maxSegments || 4);
    const previousSegments = Math.max(0, clock.currentSegments || 0);
    const newSegments = Math.min(maxSegments, Math.max(0, previousSegments + change.delta));
    const effectiveDelta = newSegments - previousSegments;
    if (effectiveDelta === 0) continue;

    const isCrisis = !clock.isTriggered && newSegments >= maxSegments;
    clock.currentSegments = newSegments;
    clock.maxSegments = maxSegments;
    if (isCrisis) clock.isTriggered = true;

    applied.push({
      clockId,
      clockName: clock.name,
      delta: effectiveDelta,
      reason: change.reason,
      previousSegments,
      newSegments,
      maxSegments,
      isCrisis,
      ...(clock.crisisDescription ? { crisisDescription: clock.crisisDescription } : {}),
    });
  }

  return { clocks, applied };
}

/**
 * Prunes location/regional threat clocks when the player leaves their region or reaches
 * a destination city/safe zone that does not belong to that threat region.
 */
export function pruneInactiveZoneClocks(
  activeClocks: TensionClock[] | undefined,
  currentLocationId: string | undefined,
  worldBible?: WorldBible,
  currentSubZoneId?: string
): TensionClock[] {
  if (!activeClocks || activeClocks.length === 0) return [];
  if (!currentLocationId || !worldBible?.locations) return activeClocks;

  const currentLoc = worldBible.locations.find((l) => l.id === currentLocationId);
  const activeZoneWithClock = resolveLocationWithThreatClock(currentLoc, worldBible, currentSubZoneId);
  const activeZoneClockId = activeZoneWithClock ? `clock_${activeZoneWithClock.id}` : null;

  return activeClocks.filter((clock) => {
    // Only prune location-scoped clocks (starting with clock_loc_); non-location clocks stay.
    if (!clock.id.startsWith('clock_loc_')) return true;
    return clock.id === activeZoneClockId;
  });
}

// ---------------------------------------------------------------------------
// Journey-aware clock zone (Plan 13 follow-up)
//
// Clock visibility was derived from `playerState.currentLocationId` alone. During
// an inter-city journey that pointer still names the node the caravan LEFT (or
// the last waypoint reached), so a sanctuary on the route silently hid the
// clock of the zone being travelled into — the meter vanished for the whole
// journey even though the destination declared one. The governing zone is now
// resolved from the journey itself.
// ---------------------------------------------------------------------------

/** Minimal shape needed to resolve the governing clock zone. */
export interface ClockZoneCarrier {
  currentLocationId?: string;
  currentSubZoneId?: string;
  travel?: { destinationLocationId?: string } | null;
}

/**
 * Resolves the location id whose zone governs the player's threat pressure now.
 *
 * - At rest: the player's current location.
 * - While travelling: the destination's zone — the caravan is on the road, and
 *   a sanctuary at the origin must not hide the pressure of the place being
 *   entered. If the destination resolves to no clock zone (it is itself a
 *   sanctuary), the pressure of the place being left keeps running until the
 *   caravan actually arrives.
 */
export function resolveClockZoneLocationId(
  playerState: ClockZoneCarrier | null | undefined,
  worldBible?: WorldBible
): string | undefined {
  const currentId = playerState?.currentLocationId;
  const destinationId = playerState?.travel?.destinationLocationId;
  if (!destinationId || destinationId === currentId) return currentId;
  if (!worldBible?.locations) return currentId;
  const destLoc = worldBible.locations.find((l) => l.id === destinationId);
  if (!destLoc) return currentId;
  const destZone = resolveLocationWithThreatClock(destLoc, worldBible, undefined);
  return destZone ? destinationId : currentId;
}

/**
 * Refreshes the active threat clocks for the zone the player is subject to
 * right now: prunes clocks that no longer apply, then seeds the ambient clock
 * of the governing zone. Journey-aware (see `resolveClockZoneLocationId`).
 *
 * Sub-zone scoping only applies while the player is standing in a location —
 * on the road there is no sub-zone to be inside.
 */
export function refreshZoneThreatClocks(
  activeClocks: TensionClock[] | undefined,
  playerState: ClockZoneCarrier | null | undefined,
  worldBible?: WorldBible
): TensionClock[] {
  if (!worldBible?.locations) return activeClocks ?? [];
  const travelling = !!playerState?.travel?.destinationLocationId;
  const zoneId = resolveClockZoneLocationId(playerState, worldBible);
  const subZoneId = travelling ? undefined : playerState?.currentSubZoneId;
  let clocks = pruneInactiveZoneClocks(activeClocks, zoneId, worldBible, subZoneId);
  clocks = seedAmbientClock(clocks, zoneId, worldBible, subZoneId);
  return clocks;
}
