import type { WorldBible, WorldTradeRoute, WorldNpc } from '@/lib/types/world';

export type MarketProvenance = 'native' | 'imported' | 'scarce' | 'shortage';

export interface MarketGood {
  entityId: string;
  name: string;
  provenance: MarketProvenance;
  /** Route carrying the good into this market (undefined for native goods). */
  routeId?: string;
  routeName?: string;
}

function locName(wb: WorldBible, id?: string): string {
  if (!id) return '—';
  return (wb.locations ?? []).find((l) => l.id === id)?.name || id;
}

function factionName(wb: WorldBible, id?: string): string {
  if (!id) return '—';
  return (wb.factions ?? []).find((f) => f.id === id)?.name || id;
}

function npcName(wb: WorldBible, id?: string): string {
  if (!id) return '—';
  return (wb.npcs ?? []).find((n) => n.id === id)?.name || id;
}

/**
 * Plan 10 — Automatic Market Availability Resolution.
 * A commodity is native at its extraction habitat; otherwise it flows in via
 * active trade routes. Raided routes make it scarce, blockaded ones cut it off.
 */
export function getMarketGoodsForLocation(locationId: string, wb: WorldBible): MarketGood[] {
  const goods = new Map<string, MarketGood>();
  const routes = wb.tradeRoutes ?? [];

  // Native extraction: minerals/flora harvested at this location.
  for (const c of wb.bestiary ?? []) {
    if ((c.habitatLocationIds ?? []).includes(locationId)) {
      goods.set(c.id, { entityId: c.id, name: c.name, provenance: 'native' });
    }
  }

  for (const route of routes) {
    const touchesDestination =
      route.destinationLocationId === locationId ||
      ((route.commodities ?? []).some((cm) => cm.flowDirection === 'bilateral') &&
        route.originLocationId === locationId);
    if (!touchesDestination) continue;

    for (const cm of route.commodities ?? []) {
      if (goods.get(cm.entityId)?.provenance === 'native') continue;
      if (route.status === 'blockaded') {
        goods.set(cm.entityId, {
          entityId: cm.entityId,
          name: cm.name,
          provenance: 'shortage',
          routeId: route.id,
          routeName: route.name,
        });
      } else if (route.status === 'raided') {
        const prev = goods.get(cm.entityId);
        if (prev?.provenance !== 'imported') {
          goods.set(cm.entityId, {
            entityId: cm.entityId,
            name: cm.name,
            provenance: 'scarce',
            routeId: route.id,
            routeName: route.name,
          });
        }
      } else {
        goods.set(cm.entityId, {
          entityId: cm.entityId,
          name: cm.name,
          provenance: 'imported',
          routeId: route.id,
          routeName: route.name,
        });
      }
    }
  }

  return [...goods.values()];
}

/**
 * Single-commodity lookup: is this entity obtainable at this location, and how?
 * Returns null when the good never flows there at all.
 */
export function getRouteAvailability(
  entityId: string,
  locationId: string,
  wb: WorldBible
): MarketGood | null {
  return getMarketGoodsForLocation(locationId, wb).find((g) => g.entityId === entityId) ?? null;
}

/** One-liner for AI context envelopes: route, status, flow, and economic impact. */
export function formatTradeRouteLine(route: WorldTradeRoute, wb: WorldBible): string {
  const origin = locName(wb, route.originLocationId);
  const dest = locName(wb, route.destinationLocationId);
  const ways = (route.intermediateLocationIds ?? [])
    .map((id) => locName(wb, id))
    .filter(Boolean);
  const path = ways.length ? `${origin} -> ${ways.join(' -> ')} -> ${dest}` : `${origin} -> ${dest}`;
  const goods = (route.commodities ?? [])
    .map((c) => `${c.name}${c.flowDirection && c.flowDirection !== 'forward' ? ` (${c.flowDirection})` : ''}`)
    .join(', ');
  const controller = route.controllingFactionId ? `, controlled by ${factionName(wb, route.controllingFactionId)}` : '';
  const raider = route.rivalRaidingFactionId ? `, raided by ${factionName(wb, route.rivalRaidingFactionId)}` : '';
  const master = route.caravanMasterNpcId ? `, led by Caravan Master ${npcName(wb, route.caravanMasterNpcId)}` : '';
  const travelers = (route.travelingNpcIds ?? []).length
    ? `, traveling retinue: ${(route.travelingNpcIds ?? []).map((id) => npcName(wb, id)).join(', ')}`
    : '';
  const disruption = route.disruptionReason ? ` — ${route.disruptionReason}` : '';
  const impact =
    route.status === 'blockaded'
      ? ` Shortage at ${dest}.`
      : route.status === 'raided'
        ? ` Scarce at ${dest}; escorts in demand.`
        : '';
  return `"${route.name}" (Danger ${route.dangerLevel ?? 2}, ${String(route.status ?? 'active').toUpperCase()}${controller}${raider}${master}${travelers}): ${path} | Transports: ${goods || 'no listed commodities'}${disruption}.${impact}`;
}

/** Routes touching a location (origin, destination, or waypoint). */
export function getRoutesForLocation(locationId: string, wb: WorldBible): WorldTradeRoute[] {
  return (wb.tradeRoutes ?? []).filter(
    (r) =>
      r.originLocationId === locationId ||
      r.destinationLocationId === locationId ||
      (r.intermediateLocationIds ?? []).includes(locationId)
  );
}

/**
 * Resolves all NPCs who are physically present at a location.
 * This includes:
 * 1. Resident NPCs whose static currentLocationId matches locationId.
 * 2. Caravan Masters and traveling retinue members whose active trade routes touch locationId.
 * Returns both the merged list of WorldNpc entities, their IDs, and a Map of caravan affiliations.
 */
export function getActiveNpcsForLocation(
  locationId: string,
  wb: WorldBible,
  language: 'en' | 'fa' = 'en'
): {
  activeNpcs: WorldNpc[];
  activeNpcIds: string[];
  caravanAffiliationByNpcId: Map<string, string>;
} {
  const residentNPCs = (wb.npcs ?? []).filter((n) => n.currentLocationId === locationId);
  const touchingRoutes = getRoutesForLocation(locationId, wb);
  const caravanAffiliationByNpcId = new Map<string, string>();
  const activeNpcMap = new Map<string, WorldNpc>();

  residentNPCs.forEach((n) => activeNpcMap.set(n.id, n));

  for (const route of touchingRoutes) {
    if (route.caravanMasterNpcId) {
      const masterNpc = (wb.npcs ?? []).find((n) => n.id === route.caravanMasterNpcId);
      if (masterNpc) {
        activeNpcMap.set(masterNpc.id, masterNpc);
        if (!caravanAffiliationByNpcId.has(masterNpc.id)) {
          caravanAffiliationByNpcId.set(
            masterNpc.id,
            language === 'fa'
              ? `کاروان‌سالار کاروان «${route.name}»`
              : `Caravan Master of "${route.name}"`
          );
        }
      }
    }
    for (const travelerId of route.travelingNpcIds ?? []) {
      const travelerNpc = (wb.npcs ?? []).find((n) => n.id === travelerId);
      if (travelerNpc) {
        activeNpcMap.set(travelerNpc.id, travelerNpc);
        if (!caravanAffiliationByNpcId.has(travelerNpc.id)) {
          caravanAffiliationByNpcId.set(
            travelerNpc.id,
            language === 'fa'
              ? `همراه کاروان «${route.name}»`
              : `Traveling with Caravan "${route.name}"`
          );
        }
      }
    }
  }

  const activeNpcs = Array.from(activeNpcMap.values());
  const activeNpcIds = activeNpcs.map((n) => n.id);

  return { activeNpcs, activeNpcIds, caravanAffiliationByNpcId };
}
