import type { MapPoint, WorldLocation } from '@/lib/types/world';
import { SOLVER_DEFAULTS } from './types';
import { GOLDEN_ANGLE, finite, pointInPolygon, isWaterPoint, type MapMasks } from './geometry';
import { prefersWaterRegion } from './constraints';
import type { LayoutContext } from './layoutTypes';

// ---------------------------------------------------------------------------
// Child orbits.
// ---------------------------------------------------------------------------

export interface ChildOrbit {
  locationId: string;
  parentLocationId: string;
  position: MapPoint;
  /** The orbit radius this child was placed on (its reach around the parent). */
  radius: number;
  /** The parent's resolved position (the centre of the orbit). */
  parentPosition: MapPoint;
}

/**
 * Keeps the orbiting pins from stacking on top of each other.
 *
 * The global pins are authoritative (they carry the springs), so only the
 * orbiting children move — and a child may never drift further from its
 * parent than the ring it was placed on, otherwise the hierarchy would break.
 */
export function separateChildOrbits(
  orbits: ChildOrbit[],
  globalPins: Map<string, MapPoint>,
  minSeparation: number,
  bounds: { width: number; height: number; inset: number },
  masks: MapMasks,
  wantsWaterOf: (locationId: string) => boolean
): void {
  if (orbits.length === 0) return;
  const positions = new Map<string, MapPoint>();
  for (const [id, p] of globalPins) positions.set(id, { x: p.x, y: p.y });
  for (const o of orbits) positions.set(o.locationId, { x: o.position.x, y: o.position.y });

  const orbitById = new Map(orbits.map((o) => [o.locationId, o]));
  const ids = [...positions.keys()];

  /** A position is usable when it is clear of every pin AND on the legal
   *  side of the terrain mask for that child. */
  const isUsable = (
    candidate: MapPoint,
    selfId: string,
    otherId: string,
    wantsWater: boolean
  ): boolean => {
    for (const [oid, op] of positions) {
      if (oid === selfId || oid === otherId) continue;
      if (Math.hypot(op.x - candidate.x, op.y - candidate.y) < minSeparation) return false;
    }
    if (!masks.hasAnyMask) return true;
    if (wantsWater) {
      if (masks.waterPolygons.length > 0) return isWaterPoint(masks, candidate);
      if (masks.landPolygons.length === 0) return true;
      return !masks.landPolygons.some((poly) => pointInPolygon(candidate, poly));
    }
    return !isWaterPoint(masks, candidate);
  };

  const clampToRing = (orbit: ChildOrbit, point: MapPoint): MapPoint => {
    const dx = point.x - orbit.parentPosition.x;
    const dy = point.y - orbit.parentPosition.y;
    const d = Math.hypot(dx, dy);
    if (d === 0) return point;
    const maxR = Math.max(orbit.radius, SOLVER_DEFAULTS.CHILD_MIN_GAP);
    const minR = SOLVER_DEFAULTS.CHILD_MIN_GAP;
    let r = d;
    if (r > maxR) r = maxR;
    if (r < minR) r = minR;
    return {
      x: orbit.parentPosition.x + (dx / d) * r,
      y: orbit.parentPosition.y + (dy / d) * r,
    };
  };

  /**
   * Slides a child along its ring (rotating around the parent) until it finds
   * a spot that is clear of every other pin and on the legal side of the mask.
   * Used when the straight push is blocked by a neighbour.
   */
  const slideAroundParent = (
    orbit: ChildOrbit,
    blocked: MapPoint,
    isFree: (p: MapPoint) => boolean
  ): MapPoint | null => {
    const dx = blocked.x - orbit.parentPosition.x;
    const dy = blocked.y - orbit.parentPosition.y;
    const base = Math.atan2(dy, dx);
    const radius = Math.max(orbit.radius, SOLVER_DEFAULTS.CHILD_MIN_GAP);
    for (const step of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 8, -8, 10, -10]) {
      const a = base + (step * Math.PI) / 12;
      const candidate = {
        x: orbit.parentPosition.x + Math.cos(a) * radius,
        y: orbit.parentPosition.y + Math.sin(a) * radius,
      };
      if (isFree(candidate)) return candidate;
    }
    return null;
  };

  for (let pass = 0; pass < 48; pass += 1) {
    let moved = false;
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const idA = ids[i];
        const idB = ids[j];
        const a = positions.get(idA)!;
        const b = positions.get(idB)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= minSeparation) continue;
        const orbitA = orbitById.get(idA);
        const orbitB = orbitById.get(idB);
        if (!orbitA && !orbitB) continue; // two global pins: handled by the global projection
        const ux = d > 0.001 ? dx / d : 1;
        const uy = d > 0.001 ? dy / d : 0;
        const deficit = minSeparation - d;

        const isFree = (p: MapPoint): boolean =>
          isUsable(p, idA, idB, wantsWaterOf(idA));

        if (orbitA && orbitB) {
          const half = deficit / 2;
          const nextA = clampToRing(orbitA, { x: a.x - ux * half, y: a.y - uy * half });
          const nextB = clampToRing(orbitB, { x: b.x + ux * half, y: b.y + uy * half });
          positions.set(idA, nextA);
          positions.set(idB, nextB);
          // If the straight push did not clear the pair, slide one of them
          // around its parent instead.
          const stillClose =
            Math.hypot(nextB.x - nextA.x, nextB.y - nextA.y) < minSeparation;
          if (stillClose) {
            const slid = slideAroundParent(orbitA, nextA, (p) => isUsable(p, idA, idB, wantsWaterOf(idA)));
            if (slid) positions.set(idA, slid);
          }
        } else if (orbitA) {
          const next = clampToRing(orbitA, { x: a.x - ux * deficit, y: a.y - uy * deficit });
          positions.set(idA, next);
          if (Math.hypot(next.x - b.x, next.y - b.y) < minSeparation) {
            const slid = slideAroundParent(orbitA, next, isFree);
            if (slid) positions.set(idA, slid);
          }
        } else if (orbitB) {
          const next = clampToRing(orbitB, { x: b.x + ux * deficit, y: b.y + uy * deficit });
          positions.set(idB, next);
          if (Math.hypot(next.x - a.x, next.y - a.y) < minSeparation) {
            const slid = slideAroundParent(orbitB, next, (p) =>
              isUsable(p, idB, idA, wantsWaterOf(idB))
            );
            if (slid) positions.set(idB, slid);
          }
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  for (const o of orbits) {
    const p = positions.get(o.locationId)!;
    o.position = {
      x: Math.round(Math.min(bounds.width - bounds.inset, Math.max(bounds.inset, p.x))),
      y: Math.round(Math.min(bounds.height - bounds.inset, Math.max(bounds.inset, p.y))),
    };
  }
}

export function computeChildOrbits(
  locations: WorldLocation[],
  resolvedTopPositions: Map<string, MapPoint>,
  ctx: Pick<LayoutContext, 'width' | 'height' | 'inset'>,
  masks: MapMasks,
  globallyPlacedIds: Set<string>
): ChildOrbit[] {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const groups = new Map<string, WorldLocation[]>();
  for (const loc of locations) {
    const parentId = loc.parentLocationId;
    if (!parentId || !byId.has(parentId)) continue;
    const list = groups.get(parentId) ?? [];
    list.push(loc);
    groups.set(parentId, list);
  }
  const orbits: ChildOrbit[] = [];

  // Working position map for orbit bases: seeded with solved top-level pins,
  // then extended pass-by-pass so nested children orbit their parent's NEW
  // position rather than a stale pre-refit pin.
  const basePositions = new Map<string, MapPoint>(resolvedTopPositions);
  const parentIds = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  const pending = new Set(parentIds);

  // Up to `parentIds.size` passes; each pass resolves parents whose base is
  // known, so deep chains settle in ≤ depth iterations. Deterministic order.
  for (let pass = 0; pass < parentIds.length && pending.size > 0; pass += 1) {
    let progressed = false;
    for (const parentId of parentIds) {
      if (!pending.has(parentId)) continue;
      const parent = byId.get(parentId)!;
      const parentPos = basePositions.get(parentId) ?? (parent.coordinates ? { x: finite(parent.coordinates.x), y: finite(parent.coordinates.y) } : null);
      if (!parentPos && !pendingDeep(parentId, groups, byId, pending)) {
        // Parent has no pin and never will (orphan chain) — skip for good.
        pending.delete(parentId);
        progressed = true;
        continue;
      }
      if (!parentPos) continue; // resolve after its own parent lands next pass
      const children = [...groups.get(parentId)!].sort((a, b) => a.id.localeCompare(b.id));
      children.forEach((child, i) => {
        if (child.coordinates && child.coordinatesSource === 'manual') {
          // Manual child pins are preserved; their position is still a legal
          // orbit base for grandchildren.
          basePositions.set(child.id, { x: finite(child.coordinates.x), y: finite(child.coordinates.y) });
          return;
        }
        if (globallyPlacedIds.has(child.id)) {
          // This child is laid out globally (it is a region of a continent, not
          // a sub-place) — it keeps its solved position and only acts as an
          // orbit base for its own children.
          const solved = basePositions.get(child.id);
          if (solved) basePositions.set(child.id, solved);
          return;
        }
        const ring = Math.floor(i / SOLVER_DEFAULTS.CHILDREN_PER_RING);
        const radius = SOLVER_DEFAULTS.CHILD_RING_BASE + ring * SOLVER_DEFAULTS.CHILD_RING_STEP;
        const angle = i * GOLDEN_ANGLE;
        let px = finite(parentPos.x + Math.cos(angle) * radius);
        let py = finite(parentPos.y + Math.sin(angle) * radius);
        const ddx = px - parentPos.x;
        const ddy = py - parentPos.y;
        const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
        if (d < SOLVER_DEFAULTS.CHILD_MIN_GAP) {
          // Radial push-out of the parent's collision envelope.
          const scale = SOLVER_DEFAULTS.CHILD_MIN_GAP / d;
          px = finite(parentPos.x + ddx * scale);
          py = finite(parentPos.y + ddy * scale);
        }

        // Terrain-aware orbit: if the ring position lands on the wrong side of
        // the mask, rotate the child's slot around the parent (keeping its
        // radius, so the family stays spread out) before shrinking it.
        if (masks.hasAnyMask) {
          const wantsWater = prefersWaterRegion(child);
          const legalHere = (qx: number, qy: number): boolean =>
            wantsWater
              ? masks.waterPolygons.length > 0
                ? isWaterPoint(masks, { x: qx, y: qy })
                : masks.landPolygons.length === 0 ||
                  !masks.landPolygons.some((poly) => pointInPolygon({ x: qx, y: qy }, poly))
              : !isWaterPoint(masks, { x: qx, y: qy });
          if (!legalHere(px, py)) {
            const dirX = ddx / d;
            const dirY = ddy / d;
            let settled = false;
            // 1) Rotate the slot around the parent (15° steps, both ways).
            for (const turn of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) {
              const a = angle + (turn * Math.PI) / 12;
              const tx = parentPos.x + Math.cos(a) * radius;
              const ty = parentPos.y + Math.sin(a) * radius;
              if (legalHere(tx, ty)) {
                px = tx;
                py = ty;
                settled = true;
                break;
              }
            }
            // 2) Still illegal — pull the child in toward its parent.
            if (!settled) {
              for (const scale of [0.8, 0.62, 0.48, 0.36, 0.26]) {
                const r = Math.max(SOLVER_DEFAULTS.CHILD_MIN_GAP, radius * scale);
                const tx = parentPos.x + dirX * r;
                const ty = parentPos.y + dirY * r;
                if (legalHere(tx, ty)) {
                  px = tx;
                  py = ty;
                  settled = true;
                  break;
                }
              }
              if (!settled) {
                // Nothing along the spoke is legal — hug the parent instead of
                // floating in the sea.
                px = parentPos.x + dirX * SOLVER_DEFAULTS.CHILD_MIN_GAP;
                py = parentPos.y + dirY * SOLVER_DEFAULTS.CHILD_MIN_GAP;
              }
            }
          }
        }

        px = Math.min(ctx.width - ctx.inset, Math.max(ctx.inset, px));
        py = Math.min(ctx.height - ctx.inset, Math.max(ctx.inset, py));
        const position = { x: Math.round(px), y: Math.round(py) };
        orbits.push({
          locationId: child.id,
          parentLocationId: parentId,
          position,
          // The INTENDED ring radius, not the distance the child ended up at:
          // the separation pass may push it back out to this reach.
          radius,
          parentPosition: { x: parentPos.x, y: parentPos.y },
        });
        basePositions.set(child.id, position);
      });
      pending.delete(parentId);
      progressed = true;
    }
    if (!progressed) break;
  }

  return orbits;
}

/** True when this parent still depends on a pending ancestor for its base. */
export function pendingDeep(
  parentId: string,
  groups: Map<string, WorldLocation[]>,
  byId: Map<string, WorldLocation>,
  pending: Set<string>
): boolean {
  const parent = byId.get(parentId);
  const chainId = parent?.parentLocationId;
  return !!chainId && pending.has(chainId) && groups.has(chainId);
}
