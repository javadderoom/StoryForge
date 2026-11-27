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

import { WorldBible, WorldLocation, WorldTradeRoute, getLocationAncestry } from '@/lib/types/world';
import { getConnectionDirection } from '@/lib/engines/world/locationConnections';
import { ActiveTravel, TravelMode, TravelPacingMode } from '@/lib/types/gameplay';
import {
  calculateCaravanTravelDays,
  calculateMapDistance,
} from '@/lib/engines/world/cartographerEngine';

// ---------------------------------------------------------------------------
// Intent detection (shared with ActionValidator — single source of truth).
// ---------------------------------------------------------------------------

/** EN travel-intent regex — extracted verbatim from ActionValidator.checkMovementPlausibility. */
export const TRAVEL_INTENT_EN =
  /\b(go|travel|head|walk|run|sneak|sail|ride|journey|move|return|march|depart|set off|push on|ride on)\s+(to|toward|towards|into|back to)?\b/i;

/** FA travel-intent regex — extracted verbatim from ActionValidator.checkMovementPlausibility. */
export const TRAVEL_INTENT_FA =
  /برو(یم|ید)?\s+(به|سوی|سمت)|سفر\s+(به|کن)|حرکت\s+(به|سوی|سمت)|(به\s*(سوی|سمت)|عازم|راهی|پیش\s*راندن.*به\s*(سوی|سمت)|رسیدن\s*به|رهسپار)/;

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

/** Normalizes Latin + Persian text for robust name matching. Shared with the
 * Plan 19 map solver whose directional constraints resolve location names. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/\u200C/g, '')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[ىي]/g, 'ی')
    .replace(/ك/g, 'ک');
}

/** Single-token names must match an exact token; multi-token names use containment
 * (with a ZWNJ/space-squashed fallback so "دروازه نمک" matches "دروازه‌نمک").
 * Exported for the Plan 19 map solver, which reuses the validator's name rules. */
export function matchesZoneName(normalizedText: string, zoneName: string): boolean {
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
  if (
    (dest.connectedLocationIds ?? []).includes(originId) &&
    getConnectionDirection(dest, originId) === 'two_way'
  ) {
    return true;
  }
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
  /** Plan 19: canvas spatial units per km (WorldMapSettings.kmPerSpatialUnit).
   * Default 1 reproduces legacy pixel-as-km behavior exactly. */
  kmPerSpatialUnit?: number;
  /** World Bible reference used to resolve off-canvas urban inset coordinates. */
  wb?: WorldBible;
}

/**
 * Resolves macro-continent coordinates for overland travel math.
 * Urban sub-locations parked outside the main map canvas (`x > settings.width`)
 * as city-detail callouts inherit their enclosing settlement's continent pin so
 * walking from a city gate into its bazaar never registers as a multi-week trek.
 */
export function resolveMacroMapCoordinates(
  loc: WorldLocation,
  wb?: WorldBible
): { x: number; y: number } | undefined {
  const mapWidth = wb?.mapData?.settings?.width ?? 2400;
  if (loc.coordinates && loc.coordinates.x <= mapWidth) {
    return loc.coordinates;
  }
  if (wb?.locations) {
    for (const anc of getLocationAncestry(wb.locations, loc.id)) {
      if (anc.coordinates && anc.coordinates.x <= mapWidth) {
        return anc.coordinates;
      }
    }
  }
  return loc.coordinates;
}

/**
 * Raw ETA in turns (pre-clamp): coordinates on both ends → caravan days from
 * map distance scaled by `kmPerSpatialUnit` (Plan 19, default 1); otherwise 2 ×
 * graph hops. `raided` routes add one turn. A raw value of 1 is a one-day hop —
 * the caller resolves it as an immediate `locationChange` with no travel state
 * (existing behavior).
 */
export function estimateTravelTurns(
  origin: WorldLocation,
  dest: WorldLocation,
  opts: EtaOptions = {}
): number {
  const kmScale = opts.kmPerSpatialUnit ?? 1;
  const dangerLevel =
    opts.route?.dangerLevel ?? Math.max(origin.dangerLevel ?? 2, dest.dangerLevel ?? 2);
  const originCoords = resolveMacroMapCoordinates(origin, opts.wb);
  const destCoords = resolveMacroMapCoordinates(dest, opts.wb);
  let turns: number;
  if (originCoords && destCoords) {
    const km = calculateMapDistance(originCoords, destCoords) * kmScale;
    if (km < 30) {
      return 1;
    }
    turns = calculateCaravanTravelDays(km, dangerLevel);
  } else {
    turns = 2 * Math.max(1, opts.hops ?? 1);
  }
  if (opts.route?.status === 'raided') turns += 1;
  return turns;
}

export function formatTravelCalendarDuration(days: number, lang: 'fa' | 'en'): string {
  if (days >= 30) {
    const months = Math.max(1, Math.round(days / 30));
    return lang === 'fa' ? `${months} ماه` : `${months} month${months > 1 ? 's' : ''}`;
  }
  if (days >= 7) {
    const weeks = Math.max(1, Math.round(days / 7));
    return lang === 'fa' ? `${weeks} هفته` : `${weeks} week${weeks > 1 ? 's' : ''}`;
  }
  return lang === 'fa' ? `${days} روز` : `${days} day${days > 1 ? 's' : ''}`;
}

export interface JourneyPlan {
  destinationLocationId: string;
  routeId?: string;
  waypointIds: string[];
  mode: TravelMode;
  totalTurns: number;
  dangerLevel: number;
  /** In-universe cartographic travel distance in kilometers. */
  distanceKm: number;
  /** In-universe simulated travel duration in calendar days (e.g. 14 days, 30 days). */
  calendarDays: number;
  /** Pass-through villages/wells crossed along the route without forcing a playable stop. */
  transitHaltNames?: string[];
  /** Pacing mode: 'cinematic_ellipsis' (default) vs 'per_leg'. */
  pacingMode: TravelPacingMode;
  /** True when uneventful travel across distance is compressed into an elliptical montage. */
  isElliptical: boolean;
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
 * - ETA: in 'cinematic_ellipsis' mode, uneventful journeys take 1 turn with
 *   calendar duration and distance reported in the prompt.
 */
export function planJourney(
  originId: string,
  destId: string,
  wb: WorldBible,
  mode: TravelMode = 'foot',
  opts: {
    lang?: 'fa' | 'en';
    pacingMode?: TravelPacingMode;
    hasEncounter?: boolean;
  } = {}
): JourneyPlan | null {
  const origin = (wb.locations ?? []).find((l) => l.id === originId);
  const dest = (wb.locations ?? []).find((l) => l.id === destId);
  if (!origin || !dest || originId === destId) return null;

  const route = routeBetween(originId, destId, wb);
  let rawWaypointIds: string[] = [];

  if (route) {
    const stops = routeStops(route);
    const i = stops.indexOf(originId);
    const j = stops.indexOf(destId);
    rawWaypointIds =
      i <= j ? stops.slice(i + 1, j) : stops.slice(j + 1, i).reverse();
  } else {
    const path = shortestPath(originId, destId, wb);
    if (!path || path.length < 2) return null;
    rawWaypointIds = path.slice(1, -1);
  }

  // Partition intermediate nodes: `isTransitHalt` places are mentioned in passing
  // during time montage without forcing turn-by-turn playable stops.
  const waypointIds: string[] = [];
  const transitHaltNames: string[] = [];
  for (const wpId of rawWaypointIds) {
    const wpLoc = (wb.locations ?? []).find((l) => l.id === wpId);
    if (wpLoc?.isTransitHalt) {
      transitHaltNames.push(wpLoc.name);
    } else {
      waypointIds.push(wpId);
    }
  }
  const hops = waypointIds.length + 1;

  const dangerLevel =
    route?.dangerLevel ?? Math.max(origin.dangerLevel ?? 2, dest.dangerLevel ?? 2);
  // Plan 19: honor a per-world distance scale when map settings define one
  // (Cartographer-authored `kmPerSpatialUnit`, default 1 = legacy pixel-as-km).
  const kmPerSpatialUnit =
    wb.mapData?.settings?.kmPerSpatialUnit ??
    (wb.ontology as { mapData?: { settings?: { kmPerSpatialUnit?: number } } } | undefined)
      ?.mapData?.settings?.kmPerSpatialUnit ??
    1;
  const rawEta = estimateTravelTurns(origin, dest, { route, hops, kmPerSpatialUnit, wb });

  const originCoords = resolveMacroMapCoordinates(origin, wb);
  const destCoords = resolveMacroMapCoordinates(dest, wb);
  let distanceKm = 0;
  if (originCoords && destCoords) {
    distanceKm = Math.round(calculateMapDistance(originCoords, destCoords) * kmPerSpatialUnit);
  } else {
    distanceKm = Math.max(35, hops * 35);
  }
  const isLocalSubDay = Boolean(originCoords && destCoords && distanceKm < 30 && waypointIds.length === 0);
  const calendarDays = isLocalSubDay ? 0 : Math.max(1, calculateCaravanTravelDays(distanceKm, dangerLevel));

  const pacingMode: TravelPacingMode =
    opts.pacingMode ??
    (wb.mapData?.settings as any)?.travelPacingProfile ??
    'per_leg';

  const immediateHop = (isLocalSubDay || rawEta <= 1) && waypointIds.length === 0;

  let totalTurns: number;
  let isElliptical = false;

  if (immediateHop) {
    totalTurns = 1;
    isElliptical = false;
  } else if (pacingMode === 'cinematic_ellipsis') {
    if (opts.hasEncounter) {
      if (waypointIds.length > 0) {
        const hasWildernessParent = Boolean(
          origin.parentLocationId ||
            waypointIds.some((id) => (wb.locations ?? []).find((l) => l.id === id)?.parentLocationId)
        );
        const eventfulTurns = hasWildernessParent
          ? waypointIds.length * 2 + 2
          : Math.max(waypointIds.length + 2, Math.min(6, Math.round(rawEta)));
        totalTurns = eventfulTurns;
      } else {
        totalTurns = Math.min(3, Math.max(2, Math.round(rawEta)));
      }
      isElliptical = false;
    } else {
      totalTurns = 1;
      isElliptical = true;
    }
  } else {
    if (opts.hasEncounter && waypointIds.length > 0) {
      totalTurns = Math.max(waypointIds.length * 2 + 2, clampJourneyTurns(rawEta));
    } else {
      totalTurns = clampJourneyTurns(rawEta);
    }
    isElliptical = false;
  }

  const lang = opts.lang ?? 'fa';
  let note: string;
  if (isElliptical) {
    const duration = formatTravelCalendarDuration(calendarDays, lang);
    const transitClause = transitHaltNames.length
      ? lang === 'fa'
        ? ` • گذر از: ${transitHaltNames.join('، ')}`
        : ` • passing ${transitHaltNames.join(', ')}`
      : '';
    note =
      lang === 'fa'
        ? `سفر آغاز شد — مقصد: «${dest.name}» (~${duration})${transitClause}${route ? ` (راه: «${route.name}»)` : ''}`
        : `Journey begins — destination: "${dest.name}" (~${duration})${transitClause}${route ? ` (via "${route.name}")` : ''}`;
  } else {
    note =
      lang === 'fa'
        ? `سفر آغاز شد — مقصد: «${dest.name}»${route ? ` (راه: «${route.name}»)` : ''}`
        : `Journey begins — destination: "${dest.name}"${route ? ` (via "${route.name}")` : ''}`;
  }

  return {
    destinationLocationId: destId,
    routeId: route?.id,
    waypointIds,
    mode,
    totalTurns,
    dangerLevel,
    distanceKm,
    calendarDays,
    ...(transitHaltNames.length ? { transitHaltNames } : {}),
    pacingMode,
    isElliptical,
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
    distanceKm: plan.distanceKm,
    calendarDays: plan.calendarDays,
    ...(plan.transitHaltNames?.length ? { transitHaltNames: [...plan.transitHaltNames] } : {}),
    pacingMode: plan.pacingMode,
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

/** Pure progress derivation from the absolute turn number and paused encounter turns — no mutable countdown. */
export function travelProgress(travel: ActiveTravel, turnNumber: number): TravelProgress {
  const paused = Math.max(0, travel.pausedTurns ?? 0);
  const effectiveTurn = Math.max(travel.departedTurn, turnNumber - paused);
  const legsElapsed = Math.max(0, Math.min(travel.totalTurns, effectiveTurn - travel.departedTurn));
  const turnsRemaining = travel.totalTurns - legsElapsed;
  const spacedRoadLegs = travel.totalTurns >= (travel.waypointIds ?? []).length * 2 + 2 && (travel.waypointIds ?? []).length > 0;
  const nodeIndex = spacedRoadLegs
    ? Math.min(Math.floor(legsElapsed / 2), (travel.waypointIds ?? []).length)
    : Math.min(legsElapsed, (travel.waypointIds ?? []).length);
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
  const waypoints = travel.waypointIds ?? [];
  const spacedRoadLegs = travel.totalTurns >= waypoints.length * 2 + 2 && waypoints.length > 0;

  if (spacedRoadLegs && progress.legsElapsed > 0) {
    // Alternating open-road stretches (odd legs) and real settlement waypoints (even legs).
    if (progress.legsElapsed % 2 === 1) {
      const prevWpIdx = Math.floor(progress.legsElapsed / 2) - 1;
      const anchorId =
        prevWpIdx >= 0 && prevWpIdx < waypoints.length
          ? waypoints[prevWpIdx]
          : travel.originLocationId;
      const anchorLoc =
        (wb.locations ?? []).find((l) => l.id === anchorId) ??
        (wb.locations ?? []).find((l) => l.id === waypoints[Math.floor(progress.legsElapsed / 2)]);
      const roadRegionId = anchorLoc?.parentLocationId;
      const roadRegion = roadRegionId
        ? (wb.locations ?? []).find((l) => l.id === roadRegionId)
        : undefined;
      if (
        roadRegionId &&
        roadRegion &&
        roadRegion.category !== 'continent' &&
        roadRegionId !== travel.originLocationId &&
        roadRegionId !== travel.destinationLocationId &&
        roadRegionId !== playerState.currentLocationId
      ) {
        const roadName = locName(wb, roadRegionId);
        return {
          travel,
          movedTo: roadRegionId,
          movedToName: roadName,
          note:
            lang === 'fa'
              ? `کاروان در مسیر «${roadName}» پیش می‌رود.`
              : `The caravan presses along the open road through "${roadName}".`,
        };
      }
      return { travel };
    }
    const wpIndex = Math.floor(progress.legsElapsed / 2) - 1;
    const wpId = waypoints[wpIndex];
    const wpExists = Boolean(wpId && (wb.locations ?? []).some((l) => l.id === wpId));
    if (wpId && wpExists && wpId !== playerState.currentLocationId) {
      const name = locName(wb, wpId);
      return {
        travel,
        movedTo: wpId,
        movedToName: name,
        note: lang === 'fa' ? `کاروان به «${name}» رسید.` : `The caravan reached "${name}".`,
      };
    }
    return { travel };
  }

  const nodeId = timeline[progress.nodeIndex];
  const nodeExists = (wb.locations ?? []).some((l) => l.id === nodeId);
  if (progress.nodeIndex > 0 && nodeId && nodeExists && nodeId !== playerState.currentLocationId) {
    const name = locName(wb, nodeId);
    return {
      travel,
      movedTo: nodeId,
      movedToName: name,
      note: lang === 'fa' ? `کاروان به «${name}» رسید.` : `The caravan reached "${name}".`,
    };
  }

  // If we are on the road (not yet arrived) and player is still located at a sub-settlement origin,
  // transition their location pointer to the parent region/wilderness so they are technically in the open road.
  if (progress.legsElapsed > 0 && playerState.currentLocationId === travel.originLocationId) {
    const originLoc = (wb.locations ?? []).find((l) => l.id === travel.originLocationId);
    if (originLoc?.parentLocationId) {
      const parentLoc = (wb.locations ?? []).find((l) => l.id === originLoc.parentLocationId);
      if (parentLoc && parentLoc.id !== travel.destinationLocationId) {
        const parentName = locName(wb, parentLoc.id);
        return {
          travel,
          movedTo: parentLoc.id,
          movedToName: parentName,
          note:
            lang === 'fa'
              ? `کاروان از «${locName(wb, travel.originLocationId)}» خارج شد و وارد «${parentName}» گردید.`
              : `The caravan departed "${locName(wb, travel.originLocationId)}" into "${parentName}".`,
        };
      }
    }
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
    const next = nextName && !progress?.arrived ? ` • ایستگاه بعدی: «${nextName}»` : '';
    const via = route ? ` • راه «${route.name}»` : '';
    const arriving = progress?.arriving ? ' • پایان راه' : '';
    return `در راه «${from}» ← «${to}»${arriving}${next}${via}`;
  }
  const next = nextName && !progress?.arrived ? ` • next stop: "${nextName}"` : '';
  const via = route ? ` • route "${route.name}"` : '';
  const arriving = progress?.arriving ? ' • final leg' : '';
  return `En route "${from}" → "${to}"${arriving}${next}${via}`;
}

/**
 * Pauses journey progression while an active encounter (`activeHoldEncounterId`) holds
 * the caravan in place. Increments `pausedTurns` so the caravan does not teleport away
 * mid-combat or mid-dialogue, and releases the hold on non-failure resolution.
 */
export function resolveTravelEncounterHold(
  travel: ActiveTravel | null | undefined,
  outcome: 'critical_success' | 'success' | 'mixed_success' | 'failure' | 'critical_failure' | string
): { travel: ActiveTravel | null; wasHeld: boolean; heldEncounterId?: string } {
  if (!travel || !travel.activeHoldEncounterId) {
    return { travel: travel ?? null, wasHeld: false };
  }
  const heldEncounterId = travel.activeHoldEncounterId;
  const resolvedCleanly = outcome !== 'failure' && outcome !== 'critical_failure';
  const nextTravel: ActiveTravel = {
    ...travel,
    pausedTurns: (travel.pausedTurns ?? 0) + 1,
    activeHoldEncounterId: resolvedCleanly ? undefined : heldEncounterId,
  };
  return { travel: nextTravel, wasHeld: true, heldEncounterId };
}

/**
 * Plan 17 Phase 7 feature flag: gates active inter-city travel state lifecycle.
 * Defaults to true. Can be disabled via ENABLE_TRAVEL_STATE=false.
 */
export function isTravelStateEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.ENABLE_TRAVEL_STATE !== 'false';
}

