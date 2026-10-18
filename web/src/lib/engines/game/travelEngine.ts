// ---------------------------------------------------------------------------
// Plan 17 (§4): deterministic inter-city travel engine.
//
// The player asked for a real "traveling → destination: X" state: a journey
// between cities that shows up in the status bar, shapes the prose corridor,
// and resolves on its own timeline. This module owns that lifecycle with zero
// model calls — same deterministic philosophy as the sub-zone writer
// (`movementEngine.ts`) and the party roster writer (`socialEngine.ts`).
//
// Progress is DERIVED, never stored as a mutable countdown:
//   legsElapsed    = clamp(turnNumber - departedTurn, 0, totalTurns)
//   turnsRemaining = totalTurns - legsElapsed
//   nodeIndex      = min(legsElapsed, waypointIds.length)
// so a remake/rewind regenerates identical prose from the same arithmetic.
//
// Reachability shares the exact graph rules of
// `ActionValidator.checkMovementPlausibility` (connected both ways,
// parent/child, non-blockaded shared route stops) so the validator never
// rejects a path the engine can plan, and the engine never starts a journey
// the validator would reject.
// ---------------------------------------------------------------------------

import { WorldBible, WorldLocation, WorldTradeRoute } from '@/lib/types/world';
import { ActiveTravel, TravelMode } from '@/lib/types/gameplay';
import {
  calculateCaravanTravelDays,
  calculateMapDistance,
} from '@/lib/engines/world/cartographerEngine';

// ---------------------------------------------------------------------------
// Intent detection (shared with ActionValidator — single source of truth).
// ---------------------------------------------------------------------------

/** EN travel-intent regex — extracted verbatim from ActionValidator.checkMovementPlausibility. */
export const TRAVEL_INTENT_EN =
  /\b(go|travel|head|walk|run|sneak|sail|ride|journey|move|return)\s+(to|toward|towards|into|back to)?\b/;

/** FA travel-intent regex — extracted verbatim from ActionValidator.checkMovementPlausibility. */
export const TRAVEL_INTENT_FA = /برو(یم|ید)?\s+به|سفر\s+(به|کن)|حرکت\s+به/;

/**
 * Shared travel-intent detector. Language-agnostic on purpose: both regexes
 * run on every action so authored FA text inside EN stories (and vice versa)
 * still resolves. `isPersian` is accepted for call-site parity and telemetry.
 */
export function detectTravelIntent(actionText: string, _isPersian?: boolean): boolean {
  const lower = (actionText ?? '').toLowerCase();
  if (!lower) return false;
  return TRAVEL_INTENT_EN.test(lower) || TRAVEL_INTENT_FA.test(lower);
}

/** EN abort phrases: "turn back", "abandon the journey", "give up the road". */
const TRAVEL_ABORT_EN =
  /\b(turn|head|go|come)\s+(?:back|home)\b|\babandon\s+(?:the\s+|this\s+)?(?:journey|travel|road|trip|expedition)\b|\bgive\s+up\s+(?:on\s+)?(?:the\s+|this\s+)?(?:journey|travel|road|trip)\b|\bstop\s+(?:travel|l?ing travel)(?:ing)?\b/i;

/** FA abort phrases: برگشتن، رها کردن سفر، دست کشیدن از راه. */
const TRAVEL_ABORT_FA =
  /(?:برگرد|بازگرد|برمی\s*گرد|بازمی\s*گرد)/;

const TRAVEL_ABORT_FA_PHRASES =
  /(?:رها\s*کن(?:م|یم|د)?\s*(?:این\s*)?(?:سفر|راه)|(?:سفر|راه)\s*(?:را)?\s*رها|دست\s*(?:بکش|می\s*کشم)\s*از\s*(?:این\s*)?(?:سفر|راه)|بازگشت\s*به|برگشتن\s*به)/;

/**
 * True when the action abandons the current journey ("turn back", "سفر را رها
 * کن"). Only evaluated while `travel` is active — grounded players use these
 * phrases as ordinary local movement.
 */
export function detectTravelAbortIntent(actionText: string, isPersian: boolean): boolean {
  const text = actionText ?? '';
  if (!text) return false;
  if (isPersian) {
    return TRAVEL_ABORT_FA.test(text) || TRAVEL_ABORT_FA_PHRASES.test(text);
  }
  return TRAVEL_ABORT_EN.test(text);
}

/** Travel mode inferred from the action verbs; flavor + UI only (no mechanical multipliers). */
export function detectTravelMode(actionText: string): TravelMode {
  const text = actionText ?? '';
  if (/\b(sail|sails|sailing|ship|ships|boat|ferry|voyage)\b|کشتی|قایق|لنج|بادبان/i.test(text)) {
    return 'ship';
  }
  if (/\b(ride|rides|riding|horse|horseback|mount|mounted|steed|gallop)\b|اسب|سوار|مرکب|تاخت/i.test(text)) {
    return 'mount';
  }
  if (/\b(caravan|caravans|convoy|escort|wagon|wagons)\b|کاروان/i.test(text)) {
    return 'caravan';
  }
  return 'foot';
}

// ---------------------------------------------------------------------------
// Name + graph matching (same rules as the sub-zone writer).
// ---------------------------------------------------------------------------

/** Normalizes Latin + Persian text for robust name matching. */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\u200C/g, '')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[ىي]/g, 'ی')
    .replace(/ك/g, 'ک');
}

/** Single-token names must match an exact token; multi-token names use containment
 * (with a ZWNJ/space-squashed fallback so "دروازه نمک" matches "دروازه‌نمک"). */
function matchesZoneName(normalizedText: string, zoneName: string): boolean {
  const name = normalizeForMatch(zoneName).trim();
  if (name.length < 2) return false;
  if (/\s/.test(name)) {
    if (normalizedText.includes(name)) return true;
    const squashedName = name.replace(/\s+/g, '');
    if (squashedName.length >= 6) {
      return normalizedText.replace(/\s+/g, '').includes(squashedName);
    }
    return false;
  }
  const tokenPattern = /[^a-z\u0600-\u06FF]+/;
  return normalizedText.split(tokenPattern).includes(name);
}

function locName(wb: WorldBible | undefined, id: string | undefined): string {
  if (!id) return '';
  return (wb?.locations ?? []).find((l) => l.id === id)?.name ?? id;
}

/** Route stop list in travel order: origin → intermediates → destination. */
export function routeStops(route: WorldTradeRoute): string[] {
  return [route.originLocationId, ...(route.intermediateLocationIds ?? []), route.destinationLocationId];
}

// ---------------------------------------------------------------------------
// Destination resolution + reachability.
// ---------------------------------------------------------------------------

/**
 * Resolve a named destination from the action text (normalized FA/EN matching,
 * ZWNJ- and case-insensitive). Follows validator semantics: the first named
 * location that is not the current one wins; no name → null.
 */
export function resolveDestinationName(
  actionText: string,
  wb: WorldBible,
  currentLocationId: string
): WorldLocation | null {
  const normalized = normalizeForMatch(actionText ?? '');
  if (!normalized) return null;
  for (const loc of wb.locations ?? []) {
    if (!loc?.name || loc.id === currentLocationId) continue;
    if (matchesZoneName(normalized, loc.name)) return loc;
  }
  return null;
}

/**
 * True when the destination is directly reachable — exact parity with
 * `ActionValidator.checkMovementPlausibility`: connected either direction,
 * parent/child, or both stops of a non-blockaded trade route.
 */
export function isDirectlyReachable(originId: string, destId: string, wb: WorldBible): boolean {
  if (!originId || !destId || originId === destId) return false;
  const origin = (wb.locations ?? []).find((l) => l.id === originId);
  const dest = (wb.locations ?? []).find((l) => l.id === destId);
  if (!origin || !dest) return false;
  if ((origin.connectedLocationIds ?? []).includes(destId)) return true;
  if ((dest.connectedLocationIds ?? []).includes(originId)) return true;
  if (origin.parentLocationId === destId || dest.parentLocationId === originId) return true;
  return (wb.tradeRoutes ?? []).some((r) => {
    if (r.status === 'blockaded') return false;
    const stops = routeStops(r);
    return stops.includes(originId) && stops.includes(destId);
  });
}

/** Best non-blockaded route connecting both locations; fewest stops-between wins. */
export function routeBetween(
  originId: string,
  destId: string,
  wb: WorldBible
): WorldTradeRoute | undefined {
  const candidates = (wb.tradeRoutes ?? []).filter((r) => {
    if (r.status === 'blockaded') return false;
    const stops = routeStops(r);
    return stops.includes(originId) && stops.includes(destId);
  });
  if (candidates.length <= 1) return candidates[0];
  return [...candidates].sort((a, b) => {
    const sa = routeStops(a);
    const sb = routeStops(b);
    const betweenA = Math.abs(sa.indexOf(destId) - sa.indexOf(originId)) - 1;
    const betweenB = Math.abs(sb.indexOf(destId) - sb.indexOf(originId)) - 1;
    return betweenA - betweenB;
  })[0];
}

// ---------------------------------------------------------------------------
// ETA + journey planning.
// ---------------------------------------------------------------------------

/** Journey pacing clamp: 2..6 turns per the plan. */
export function clampJourneyTurns(turns: number): number {
  return Math.max(2, Math.min(6, Math.round(turns)));
}

export interface EtaOptions {
  route?: WorldTradeRoute;
  /** Graph hops between the endpoints when coordinates are unavailable. */
  hops?: number;
}

/**
 * Raw ETA in turns (pre-clamp): coordinates on both ends → caravan days from
 * map distance; otherwise 2 × graph hops. `raided` routes add one turn.
 * A raw value of 1 is a one-day hop — the caller resolves it as an immediate
 * `locationChange` with no travel state (existing behavior).
 */
export function estimateTravelTurns(
  origin: WorldLocation,
  dest: WorldLocation,
  opts: EtaOptions = {}
): number {
  const dangerLevel =
    opts.route?.dangerLevel ?? Math.max(origin.dangerLevel ?? 2, dest.dangerLevel ?? 2);
  let turns: number;
  if (origin.coordinates && dest.coordinates) {
    const km = calculateMapDistance(origin.coordinates, dest.coordinates);
    turns = calculateCaravanTravelDays(km, dangerLevel);
  } else {
    turns = 2 * Math.max(1, opts.hops ?? 1);
  }
  if (opts.route?.status === 'raided') turns += 1;
  return turns;
}

export interface JourneyPlan {
  destinationLocationId: string;
  routeId?: string;
  waypointIds: string[];
  mode: TravelMode;
  totalTurns: number;
  dangerLevel: number;
  /** True when the raw ETA is a one-day hop with no intermediate stops: the
   * caller applies an immediate `locationChange` instead of travel state. */
  immediateHop: boolean;
  /** Prose-ready summary line (localized). */
  note: string;
}

/** BFS shortest path over connected + parent/child + non-blockaded route edges. */
function shortestPath(originId: string, destId: string, wb: WorldBible): string[] | null {
  const adj = new Map<string, Set<string>>();
  const addEdge = (a?: string, b?: string) => {
    if (!a || !b || a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const loc of wb.locations ?? []) {
    for (const c of loc.connectedLocationIds ?? []) addEdge(loc.id, c);
    if (loc.parentLocationId) addEdge(loc.id, loc.parentLocationId);
  }
  for (const route of wb.tradeRoutes ?? []) {
    if (route.status === 'blockaded') continue;
    const stops = routeStops(route);
    for (let i = 0; i + 1 < stops.length; i += 1) addEdge(stops[i], stops[i + 1]);
  }

  if (originId === destId) return [originId];
  if (!adj.has(originId)) return null;

  const prev = new Map<string, string>();
  const visited = new Set<string>([originId]);
  const queue: string[] = [originId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === destId) {
      const path = [destId];
      let p = destId;
      while (prev.has(p)) {
        p = prev.get(p)!;
        path.unshift(p);
      }
      return path;
    }
    for (const next of adj.get(cur) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      prev.set(next, cur);
      queue.push(next);
    }
  }
  return null;
}

/**
 * Cheapest journey plan from origin to destination. Returns null when no path
 * exists (the action then falls through to ordinary turn processing).
 *
 * - Shared route → that route's stops between the endpoints become waypoints.
 * - Otherwise BFS over connected/parent/route edges; intermediates are waypoints.
 * - ETA: raw `estimateTravelTurns` clamped to 2..6; `immediateHop` marks the
 *   one-day no-waypoint case.
 */
export function planJourney(
  originId: string,
  destId: string,
  wb: WorldBible,
  mode: TravelMode = 'foot',
  opts: { lang?: 'fa' | 'en' } = {}
): JourneyPlan | null {
  const origin = (wb.locations ?? []).find((l) => l.id === originId);
  const dest = (wb.locations ?? []).find((l) => l.id === destId);
  if (!origin || !dest || originId === destId) return null;

  const route = routeBetween(originId, destId, wb);
  let waypointIds: string[] = [];
  let hops: number;

  if (route) {
    const stops = routeStops(route);
    const i = stops.indexOf(originId);
    const j = stops.indexOf(destId);
    waypointIds = stops.slice(Math.min(i, j) + 1, Math.max(i, j));
    hops = Math.abs(i - j);
  } else {
    const path = shortestPath(originId, destId, wb);
    if (!path || path.length < 2) return null;
    waypointIds = path.slice(1, -1);
    hops = path.length - 1;
  }

  const dangerLevel =
    route?.dangerLevel ?? Math.max(origin.dangerLevel ?? 2, dest.dangerLevel ?? 2);
  const rawEta = estimateTravelTurns(origin, dest, { route, hops });
  const totalTurns = clampJourneyTurns(rawEta);
  const immediateHop = rawEta <= 1 && waypointIds.length === 0;

  const lang = opts.lang ?? 'fa';
  const note =
    lang === 'fa'
      ? `سفر آغاز شد — مقصد: «${dest.name}» • ${totalTurns} نوبت${route ? ` (راه: «${route.name}»)` : ''}`
      : `Journey begins — destination: "${dest.name}" • ${totalTurns} turns${route ? ` (via "${route.name}")` : ''}`;

  return {
    destinationLocationId: destId,
    routeId: route?.id,
    waypointIds,
    mode,
    totalTurns,
    dangerLevel,
    immediateHop,
    note,
  };
}

/** Materialize an `ActiveTravel` state from a plan at departure. */
export function startTravel(
  plan: JourneyPlan,
  originLocationId: string,
  turnNumber: number
): ActiveTravel {
  return {
    originLocationId,
    destinationLocationId: plan.destinationLocationId,
    routeId: plan.routeId,
    waypointIds: [...plan.waypointIds],
    mode: plan.mode,
    departedTurn: turnNumber,
    totalTurns: plan.totalTurns,
  };
}

// ---------------------------------------------------------------------------
// Timeline math (rewind-safe, derived only).
// ---------------------------------------------------------------------------

/** Ordered journey timeline: [origin, ...waypoints, destination]. */
export function travelTimeline(travel: ActiveTravel): string[] {
  return [travel.originLocationId, ...(travel.waypointIds ?? []), travel.destinationLocationId];
}

export interface TravelProgress {
  legsElapsed: number;
  turnsRemaining: number;
  /** Index into the timeline of the node the traveller is at on this turn. */
  nodeIndex: number;
  arrived: boolean;
  /** True on the final leg (the destination appears on the horizon). */
  arriving: boolean;
  /** 1-based day on the road (legsElapsed + 1). */
  dayOnRoad: number;
}

/** Pure progress derivation from the absolute turn number — no stored countdown. */
export function travelProgress(travel: ActiveTravel, turnNumber: number): TravelProgress {
  const legsElapsed = Math.max(0, Math.min(travel.totalTurns, turnNumber - travel.departedTurn));
  const turnsRemaining = travel.totalTurns - legsElapsed;
  const nodeIndex = Math.min(legsElapsed, (travel.waypointIds ?? []).length);
  return {
    legsElapsed,
    turnsRemaining,
    nodeIndex,
    arrived: turnsRemaining <= 0,
    arriving: turnsRemaining === 1,
    dayOnRoad: legsElapsed + 1,
  };
}

// ---------------------------------------------------------------------------
// Per-turn lifecycle.
// ---------------------------------------------------------------------------

export interface TravelAdvance {
  /** Journey state after the advance (null on arrival). */
  travel: ActiveTravel | null;
  /** Set when the journey reached the destination this turn. */
  arrivedAt?: string;
  arrivedAtName?: string;
  /** Set when the traveller advanced to a new timeline node (waypoint). */
  movedTo?: string;
  movedToName?: string;
  /** Localized consequence note for the resolution summary. */
  note?: string;
}

/**
 * Apply one turn of an active journey. Arrival clears the travel state and
 * reports the destination; an intermediate stop advance reports the new node
 * (the caller moves `currentLocationId` + discovery). A non-advancing road
 * turn returns the travel state unchanged.
 */
export function advanceTravel(
  playerState: { travel?: ActiveTravel | null; currentLocationId: string },
  turnNumber: number,
  wb: WorldBible,
  opts: { lang?: 'fa' | 'en' } = {}
): TravelAdvance {
  const travel = playerState.travel;
  if (!travel) return { travel: null };
  const lang = opts.lang ?? 'fa';
  const progress = travelProgress(travel, turnNumber);

  if (progress.arrived) {
    const destName = locName(wb, travel.destinationLocationId);
    return {
      travel: null,
      arrivedAt: travel.destinationLocationId,
      arrivedAtName: destName,
      note: lang === 'fa' ? `به «${destName}» رسیدی.` : `You arrive at "${destName}".`,
    };
  }

  const timeline = travelTimeline(travel);
  const nodeId = timeline[progress.nodeIndex];
  const nodeExists = (wb.locations ?? []).some((l) => l.id === nodeId);
  if (nodeId && nodeExists && nodeId !== playerState.currentLocationId) {
    const name = locName(wb, nodeId);
    return {
      travel,
      movedTo: nodeId,
      movedToName: name,
      note: lang === 'fa' ? `کاروان به «${name}» رسید.` : `The caravan reached "${name}".`,
    };
  }

  // A road turn at the current stop: the journey continues untouched.
  return { travel };
}

/** Abandon the journey: stay at the current node, clear the state. */
export function cancelTravel(
  playerState: { travel?: ActiveTravel | null; currentLocationId: string },
  wb: WorldBible,
  opts: { lang?: 'fa' | 'en' } = {}
): { travel: null; note: string } {
  const lang = opts.lang ?? 'fa';
  const stopName = locName(wb, playerState.currentLocationId) || playerState.currentLocationId;
  const destName = playerState.travel ? locName(wb, playerState.travel.destinationLocationId) : '';
  return {
    travel: null,
    note:
      lang === 'fa'
        ? destName
          ? `سفر به «${destName}» رها شد؛ در «${stopName}» ماندی.`
          : `سفر رها شد؛ در «${stopName}» ماندی.`
        : destName
          ? `The journey to "${destName}" is abandoned; you remain at "${stopName}".`
          : `The journey is abandoned; you remain at "${stopName}".`,
  };
}

// ---------------------------------------------------------------------------
// Display helpers.
// ---------------------------------------------------------------------------

/**
 * One-line journey status for prompts and UI:
 * `در راه «O» → «D» • روز n از m • ایستگاه بعدی: «S»`.
 */
export function formatTravelLine(
  travel: ActiveTravel,
  wb: WorldBible,
  lang: 'fa' | 'en',
  turnNumber?: number
): string {
  const from = locName(wb, travel.originLocationId);
  const to = locName(wb, travel.destinationLocationId);
  const timeline = travelTimeline(travel);
  const progress =
    typeof turnNumber === 'number' ? travelProgress(travel, turnNumber) : undefined;
  const nextIndex = progress ? Math.min(progress.nodeIndex + 1, timeline.length - 1) : 1;
  const nextName = locName(wb, timeline[nextIndex]);
  const route = travel.routeId ? (wb.tradeRoutes ?? []).find((r) => r.id === travel.routeId) : undefined;

  if (lang === 'fa') {
    const timing = progress
      ? ` • روز ${progress.dayOnRoad} از ${travel.totalTurns}${progress.arriving ? ' (پایان راه)' : ''}`
      : '';
    const next = nextName && !progress?.arrived ? ` • ایستگاه بعدی: «${nextName}»` : '';
    const via = route ? ` • راه «${route.name}»` : '';
    return `در راه «${from}» ← «${to}»${timing}${next}${via}`;
  }
  const timing = progress
    ? ` • day ${progress.dayOnRoad} of ${travel.totalTurns}${progress.arriving ? ' (final leg)' : ''}`
    : '';
  const next = nextName && !progress?.arrived ? ` • next stop: "${nextName}"` : '';
  const via = route ? ` • route "${route.name}"` : '';
  return `En route "${from}" → "${to}"${timing}${next}${via}`;
}
