import type { MapPoint, WorldLocation } from '@/lib/types/world';
import { SOLVER_DEFAULTS } from './types';
import {
  GOLDEN_ANGLE,
  finite,
  distance,
  pointInPolygon,
  isWaterPoint,
  type MapMasks,
} from './geometry';
import type { LayoutContext, LayoutNode } from './layoutTypes';

export function clampToBounds(node: LayoutNode, ctx: LayoutContext): void {
  node.x = Math.min(ctx.width - ctx.inset, Math.max(ctx.inset, finite(node.x)));
  node.y = Math.min(ctx.height - ctx.inset, Math.max(ctx.inset, finite(node.y)));
}

export function massBonus(loc: WorldLocation | undefined): number {
  return loc?.category === 'settlement' || loc?.category === 'stronghold'
    ? SOLVER_DEFAULTS.SETTLEMENT_MASS
    : SOLVER_DEFAULTS.DEFAULT_MASS;
}

/** Init — sunflower spiral, clipped to the canvas inset. */
export function initPositions(
  freeNodes: LayoutNode[],
  ctx: LayoutContext,
  restart: number,
  rng: () => number
): void {
  const cx = ctx.width / 2;
  const cy = ctx.height / 2;
  const maxR = Math.max(80, Math.min(ctx.width, ctx.height) / 2 - ctx.inset - 20);
  const n = Math.max(freeNodes.length, 1);
  const offset = restart * 0.9 + rng() * 0.4;
  freeNodes.forEach((node, i) => {
    const r = maxR * Math.sqrt((i + 0.5) / n);
    const theta = i * GOLDEN_ANGLE + offset;
    node.x = finite(cx + r * Math.cos(theta));
    node.y = finite(cy + r * Math.sin(theta));
    clampToBounds(node, ctx);
  });
}

/**
 * True when this pin is legally resting at `p` given its water preference.
 *
 * A parent pin must also keep its children's orbit halo on the legal side of
 * the mask: a coastal parent that is itself on land but too close to the shore
 * would place half of its children in the water.
 */
export function waterLegal(masks: MapMasks, node: LayoutNode, p: MapPoint): boolean {
  if (!masks.hasAnyMask) return true;
  const legal = (q: MapPoint): boolean => {
    if (node.wantsWater) {
      if (masks.waterPolygons.length > 0) return isWaterPoint(masks, q);
      // No explicit water painted, no land either → anything goes.
      if (masks.landPolygons.length === 0) return true;
      return !masks.landPolygons.some((poly) => pointInPolygon(q, poly));
    }
    return !isWaterPoint(masks, q);
  };
  if (!legal(p)) return false;
  if (node.clearanceRadius > 0) {
    for (let d = 0; d < 8; d += 1) {
      const angle = (d / 8) * Math.PI * 2;
      const q = {
        x: p.x + Math.cos(angle) * node.clearanceRadius,
        y: p.y + Math.sin(angle) * node.clearanceRadius,
      };
      if (!legal(q)) return false;
    }
  }
  return true;
}

/** Water/land steering: sample 16 compass directions toward a legal position. */
export function applyWaterAvoidance(node: LayoutNode, ctx: LayoutContext): void {
  if (!ctx.masks.hasAnyMask) return;
  const probe: MapPoint = { x: node.x, y: node.y };
  if (waterLegal(ctx.masks, node, probe)) return;
  node.waterHits += 1;
  for (const step of [60, 120, 240, 480]) {
    for (let d = 0; d < 16; d += 1) {
      const angle = (d / 16) * Math.PI * 2;
      const nx = finite(node.x + Math.cos(angle) * step);
      const ny = finite(node.y + Math.sin(angle) * step);
      if (nx < ctx.inset || nx > ctx.width - ctx.inset) continue;
      if (ny < ctx.inset || ny > ctx.height - ctx.inset) continue;
      if (waterLegal(ctx.masks, node, { x: nx, y: ny })) {
        node.x += Math.cos(angle) * 4;
        node.y += Math.sin(angle) * 4;
        return;
      }
    }
  }
  // Fully enclosed sample space → gravitate toward the map center.
  node.x += Math.sign(ctx.width / 2 - node.x || 1) * 4;
  node.y += Math.sign(ctx.height / 2 - node.y || 1) * 4;
}

export function stepLayout(ctx: LayoutContext, temperature: number): void {
  // Phase 1 — accumulate forces into a displacement buffer.
  const dx = new Map<string, number>();
  const dy = new Map<string, number>();
  for (const node of ctx.nodes) {
    dx.set(node.id, 0);
    dy.set(node.id, 0);
  }

  // Springs (edges).
  for (const edge of ctx.edges) {
    const a = ctx.idToNode.get(edge.a)!;
    const b = ctx.idToNode.get(edge.b)!;
    const d = Math.max(distance(a, b), 1);
    const f = ((d - edge.ideal) * edge.weight * SOLVER_DEFAULTS.SPRING_RATE) / d;
    const ex = (b.x - a.x) * f;
    const ey = (b.y - a.y) * f;
    if (a.free) {
      dx.set(a.id, finite(dx.get(a.id)!) + finite(ex));
      dy.set(a.id, finite(dy.get(a.id)!) + finite(ey));
      a.edgeHits += 1;
    }
    if (b.free) {
      dx.set(b.id, finite(dx.get(b.id)!) - finite(ex));
      dy.set(b.id, finite(dy.get(b.id)!) - finite(ey));
      b.edgeHits += 1;
    }
  }

  // Local repulsion.
  for (let i = 0; i < ctx.nodes.length; i += 1) {
    for (let j = i + 1; j < ctx.nodes.length; j += 1) {
      const a = ctx.nodes[i];
      const b = ctx.nodes[j];
      const d = Math.max(distance(a, b), 1);
      if (d > SOLVER_DEFAULTS.REPULSION_RANGE) continue;
      const rep = Math.min(
        (SOLVER_DEFAULTS.REPULSION_C * a.mass * b.mass) / (d * d),
        temperature * 2
      );
      const ux = (b.x - a.x) / d;
      const uy = (b.y - a.y) / d;
      if (a.free) {
        dx.set(a.id, finite(dx.get(a.id)!) - ux * rep);
        dy.set(a.id, finite(dy.get(a.id)!) - uy * rep);
      }
      if (b.free) {
        dx.set(b.id, finite(dx.get(b.id)!) + ux * rep);
        dy.set(b.id, finite(dy.get(b.id)!) + uy * rep);
      }
    }
  }

  // Directional clamps.
  for (const c of ctx.directional) {
    const a = ctx.idToNode.get(c.sourceId);
    const b = ctx.idToNode.get(c.targetId);
    if (!a || !b) continue;
    const proj = c.sign * (finite(a[c.axis]) - finite(b[c.axis]));
    const deficit = SOLVER_DEFAULTS.DIR_MIN_PROJ - proj;
    if (deficit <= 0) continue;
    const push = deficit * c.weight * SOLVER_DEFAULTS.DIR_RATE;
    if (a.free) {
      if (c.axis === 'x') dx.set(a.id, finite(dx.get(a.id)!) + c.sign * push);
      else dy.set(a.id, finite(dy.get(a.id)!) + c.sign * push);
      a.dirHits += 1;
    }
    if (b.free) {
      if (c.axis === 'x') dx.set(b.id, finite(dx.get(b.id)!) - c.sign * push);
      else dy.set(b.id, finite(dy.get(b.id)!) - c.sign * push);
      b.dirHits += 1;
    }
  }

  // Weak global cohesion toward the live centroid (anchors + free nodes).
  if (ctx.nodes.length > 0) {
    let sx = 0;
    let sy = 0;
    for (const node of ctx.nodes) {
      sx += node.x;
      sy += node.y;
    }
    const cx = sx / ctx.nodes.length;
    const cy = sy / ctx.nodes.length;
    for (const node of ctx.nodes) {
      if (node.free) {
        dx.set(node.id, finite(dx.get(node.id)!) + (cx - node.x) * SOLVER_DEFAULTS.COHESION_RATE);
        dy.set(node.id, finite(dy.get(node.id)!) + (cy - node.y) * SOLVER_DEFAULTS.COHESION_RATE);
      }
    }
  }

  // Phase 2 — apply with per-axis temperature clamp, then bounds.
  for (const node of ctx.nodes) {
    if (node.free) {
      const stepX = Math.max(-temperature, Math.min(temperature, finite(dx.get(node.id)!)));
      const stepY = Math.max(-temperature, Math.min(temperature, finite(dy.get(node.id)!)));
      node.x = finite(node.x + stepX);
      node.y = finite(node.y + stepY);
      applyWaterAvoidance(node, ctx);
    }
    clampToBounds(node, ctx);
  }
}

/** Deterministic pairwise separation projection (60% overlap per move). */
export function projectCollisions(ctx: LayoutContext, passes: number): void {
  for (let pass = 0; pass < passes; pass += 1) {
    let moved = false;
    for (let i = 0; i < ctx.nodes.length; i += 1) {
      for (let j = i + 1; j < ctx.nodes.length; j += 1) {
        const a = ctx.nodes[i];
        const b = ctx.nodes[j];
        const d = distance(a, b);
        if (d >= ctx.minSeparation) continue;
        if (d === 0) {
          if (a.free) {
            a.x += ctx.minSeparation / 2;
            clampToBounds(a, ctx);
            moved = true;
          }
          if (b.free) {
            b.x -= ctx.minSeparation / 2;
            clampToBounds(b, ctx);
            moved = true;
          }
          continue;
        }
        const overlap = ctx.minSeparation - d;
        const ux = (b.x - a.x) / d;
        const uy = (b.y - a.y) / d;
        const totalMass = a.mass + b.mass;
        if (a.free) {
          const share = (b.mass / totalMass) * overlap * 0.6;
          a.x -= ux * share;
          a.y -= uy * share;
          clampToBounds(a, ctx);
          moved = moved || share > 0.5;
        }
        if (b.free) {
          const share = (a.mass / totalMass) * overlap * 0.6;
          b.x += ux * share;
          b.y += uy * share;
          clampToBounds(b, ctx);
          moved = moved || share > 0.5;
        }
      }
    }
    if (!moved) break;
  }
}

/** Deterministic water projection: teleport offending pins to legal terrain. */
export function projectWater(ctx: LayoutContext, passes: number): void {
  if (!ctx.masks.hasAnyMask) return;
  for (let pass = 0; pass < passes; pass += 1) {
    let moved = false;
    for (const node of ctx.nodes) {
      if (!node.free) continue;
      if (waterLegal(ctx.masks, node, { x: node.x, y: node.y })) continue;
      let resolved = false;
      outer: for (const step of [40, 80, 160, 320, 640]) {
        for (let d = 0; d < 16; d += 1) {
          const angle = (d / 16) * Math.PI * 2;
          const nx = finite(node.x + Math.cos(angle) * step);
          const ny = finite(node.y + Math.sin(angle) * step);
          if (nx < ctx.inset || nx > ctx.width - ctx.inset) continue;
          if (ny < ctx.inset || ny > ctx.height - ctx.inset) continue;
          if (waterLegal(ctx.masks, node, { x: nx, y: ny })) {
            node.x = nx;
            node.y = ny;
            resolved = true;
            moved = true;
            break outer;
          }
        }
      }
      if (!resolved) {
        node.x = finite(ctx.width / 2);
        node.y = finite(ctx.height / 2);
        node.x = Math.min(ctx.width - ctx.inset, Math.max(ctx.inset, node.x));
        node.y = Math.min(ctx.height - ctx.inset, Math.max(ctx.inset, node.y));
        moved = true;
      }
    }
    if (!moved) break;
  }
}

export function configEnergy(ctx: LayoutContext): number {
  let energy = 0;
  for (const edge of ctx.edges) {
    const a = ctx.idToNode.get(edge.a)!;
    const b = ctx.idToNode.get(edge.b)!;
    const d = distance(a, b);
    energy += (edge.weight * (d - edge.ideal) * (d - edge.ideal)) / edge.ideal;
  }
  for (let i = 0; i < ctx.nodes.length; i += 1) {
    for (let j = i + 1; j < ctx.nodes.length; j += 1) {
      const deficit = ctx.minSeparation - distance(ctx.nodes[i], ctx.nodes[j]);
      if (deficit > 0) energy += deficit * deficit * 2;
    }
  }
  for (const c of ctx.directional) {
    const a = ctx.idToNode.get(c.sourceId);
    const b = ctx.idToNode.get(c.targetId);
    if (!a || !b) continue;
    const deficit = SOLVER_DEFAULTS.DIR_MIN_PROJ - c.sign * (finite(a[c.axis]) - finite(b[c.axis]));
    if (deficit > 0) energy += deficit * deficit * c.weight;
  }
  // Cohesion comparator: penalize free configs that hug canvas borders when the
  // constraint set is sparse (keeps restart selection meaningful).
  if (ctx.nodes.length > 0) {
    let sx = 0;
    let sy = 0;
    for (const node of ctx.nodes) {
      sx += node.x;
      sy += node.y;
    }
    const cx = sx / ctx.nodes.length;
    const cy = sy / ctx.nodes.length;
    for (const node of ctx.nodes) {
      if (!node.free) continue;
      const dx = node.x - cx;
      const dy = node.y - cy;
      energy += SOLVER_DEFAULTS.COHESION_ENERGY * (dx * dx + dy * dy);
    }
  }
  return energy;
}

export function zeroInfluenceCounters(ctx: LayoutContext): void {
  for (const node of ctx.nodes) {
    node.waterHits = 0;
    node.dirHits = 0;
    node.edgeHits = 0;
  }
}
