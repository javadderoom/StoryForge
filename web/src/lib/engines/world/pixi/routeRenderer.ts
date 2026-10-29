import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { clearContainer } from './renderers/shared';
import type {
  MapPoint,
  MapRoute,
  WorldMapSettings,
} from '@/lib/types';
import { mapObjectKey } from '../mapSelection';
import { isObjectVisible } from '../mapObjectOrder';
import {
  MAP_ROUTE_KIND_META,
  resolveMapRoutePoints,
  routeKindLabel,
  type MapRouteSource,
} from '../mapRoutes';
import type { DraggedNodeData } from './renderTypes';
import {
  calculateCounterScale,
  getDynamicTextResolution,
  getRouteLODTier,
  isElementVisibleAtZoom,
} from './lodManager';

function parseColor(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return Number.parseInt(normalized, 16);
}

function offsetPolyline(points: MapPoint[], offset: number): MapPoint[] {
  if (offset === 0 || points.length < 2) return points;
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) return point;
    return {
      x: point.x + (-dy / length) * offset,
      y: point.y + (dx / length) * offset,
    };
  });
}

/** Draws a polyline as dashes without relying on a graphics dash API. */
function drawDashedPolyline(
  g: Graphics,
  points: MapPoint[],
  dash: number,
  gap: number
): void {
  if (points.length < 2) return;
  let remaining = dash;
  let drawing = true;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segmentLength = Math.hypot(b.x - a.x, b.y - a.y);
    if (segmentLength === 0) continue;
    const ux = (b.x - a.x) / segmentLength;
    const uy = (b.y - a.y) / segmentLength;
    let travelled = 0;

    while (travelled < segmentLength) {
      const step = Math.min(remaining, segmentLength - travelled);
      const x1 = a.x + ux * travelled;
      const y1 = a.y + uy * travelled;
      const x2 = a.x + ux * (travelled + step);
      const y2 = a.y + uy * (travelled + step);
      if (drawing) {
        g.moveTo(x1, y1).lineTo(x2, y2);
      }
      travelled += step;
      remaining -= step;
      if (remaining <= 0.0001) {
        drawing = !drawing;
        remaining = drawing ? dash : gap;
      }
    }
  }
}

function drawDottedPolyline(g: Graphics, points: MapPoint[], spacing: number, radius: number): void {
  if (points.length < 2) return;
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0) continue;
    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;
    let distance = carry;
    while (distance <= length) {
      g.circle(a.x + ux * distance, a.y + uy * distance, radius);
      distance += spacing;
    }
    carry = distance - length;
  }
}

function drawEndpointCap(
  g: Graphics,
  point: MapPoint,
  color: number,
  dangling: boolean,
  snapped: boolean
): void {
  const radius = snapped ? 4.5 : 3.5;
  g.moveTo(point.x, point.y - radius)
    .lineTo(point.x + radius, point.y)
    .lineTo(point.x, point.y + radius)
    .lineTo(point.x - radius, point.y)
    .lineTo(point.x, point.y - radius);
  g.fill({ color: dangling ? 0xffffff : color, alpha: 0.95 });
  g.stroke({ width: 1.2, color: dangling ? 0xb91c1c : 0x2b1e16 });
}

export interface MapRouteTierTargets {
  tier1: Graphics;
  tier2: Graphics;
  tier3: Graphics;
  labelsTier1: Container;
  labelsTier2: Container;
  labelsTier3: Container;
}

export interface MapRouteRenderOptions {
  routes: MapRoute[];
  source: MapRouteSource;
  selectionKeys: Set<string>;
  draggedNode: DraggedNodeData | null;
  transientPos: MapPoint | null;
  settings: WorldMapSettings;
  isPersian: boolean;
  labelsContainer: Container;
  zoom?: number;
  tierTargets?: MapRouteTierTargets;
}

/**
 * Draws every road, trail and sea lane. The visual grammar is deliberately
 * separate from caravan routes: roads are ink on the parchment, while the
 * economic overlay stays amber and dashed.
 */
export function renderMapRoutes(g: Graphics, options: MapRouteRenderOptions): void {
  const {
    routes,
    source,
    selectionKeys,
    draggedNode,
    transientPos,
    settings,
    isPersian,
    labelsContainer,
    zoom = 1.0,
    tierTargets,
  } = options;

  g.clear();
  clearContainer(labelsContainer);

  if (tierTargets) {
    tierTargets.tier1.clear();
    tierTargets.tier2.clear();
    tierTargets.tier3.clear();
    clearContainer(tierTargets.labelsTier1);
    clearContainer(tierTargets.labelsTier2);
    clearContainer(tierTargets.labelsTier3);
  }

  if (settings.visibleLayers.routes === false) return;

  const counterScale = calculateCounterScale(zoom);
  const textResolution = getDynamicTextResolution(zoom);
  const isTactical = isElementVisibleAtZoom(4, zoom, false);

  const ordered = [...routes].sort(
    (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)
  );

  for (const route of ordered) {
    if (!isObjectVisible(route)) continue;

    const selected = selectionKeys.has(mapObjectKey('route', route.id));
    const routeTier = getRouteLODTier(route.kind);

    let targetG = g;
    let targetLabels = labelsContainer;

    if (tierTargets) {
      if (selected || routeTier === 1) {
        targetG = tierTargets.tier1;
        targetLabels = tierTargets.labelsTier1;
      } else if (routeTier === 2) {
        targetG = tierTargets.tier2;
        targetLabels = tierTargets.labelsTier2;
      } else {
        targetG = tierTargets.tier3;
        targetLabels = tierTargets.labelsTier3;
      }
    } else {
      // At Continental zoom (< 0.55), only highways/caravans or selected routes appear
      if (!isElementVisibleAtZoom(routeTier, zoom, selected)) continue;
    }

    const transient =
      draggedNode?.type === 'route_vertex' &&
      draggedNode.routeId === route.id &&
      draggedNode.index !== undefined &&
      transientPos
        ? { index: draggedNode.index, point: transientPos }
        : null;
    const resolved = resolveMapRoutePoints(route, source, transient);
    const points = resolved.points;
    if (points.length < 2) continue;

    const meta = MAP_ROUTE_KIND_META[route.kind] ?? MAP_ROUTE_KIND_META.road;
    const color = parseColor(route.color) ?? meta.color;
    const width = route.width ?? meta.width;
    const lineStyle = route.lineStyle ?? meta.lineStyle;

    // Selection halo sits under the ink, the same language as every other
    // selected object.
    if (selected) {
      targetG.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) targetG.lineTo(points[i].x, points[i].y);
      targetG.stroke({
        width: width + 7 * counterScale,
        color: 0xfbbf24,
        alpha: 0.45,
        cap: 'round',
        join: 'round',
      });
    }

    // Casing: a dark under-stroke keeps the road readable on textured paper.
    targetG.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) targetG.lineTo(points[i].x, points[i].y);
    targetG.stroke({
      width: width + 2.4 * counterScale,
      color: meta.casing,
      alpha: 0.32,
      cap: 'round',
      join: 'round',
    });

    // Approval tint for severe roads. It darkens the ink rather than recoloring
    // the whole line, so difficulty never competes with the road type.
    const difficultyColor =
      route.difficulty >= 5 ? 0x7f1d1d : route.difficulty >= 4 ? 0x78350f : color;

    if (lineStyle === 'double') {
      const half = width * 0.32;
      for (const side of [-half, half]) {
        const shifted = offsetPolyline(points, side);
        targetG.moveTo(shifted[0].x, shifted[0].y);
        for (let i = 1; i < shifted.length; i++) targetG.lineTo(shifted[i].x, shifted[i].y);
        targetG.stroke({ width: 1.35, color: difficultyColor, cap: 'round', join: 'round' });
      }
    } else if (lineStyle === 'dashed') {
      drawDashedPolyline(targetG, points, Math.max(6, width * 2.4), Math.max(4, width * 1.4));
      targetG.stroke({ width, color: difficultyColor, cap: 'round', join: 'round' });
    } else if (lineStyle === 'dotted') {
      drawDottedPolyline(targetG, points, Math.max(6, width * 3), Math.max(1, width * 0.32));
      targetG.fill({ color: difficultyColor, alpha: 0.92 });
    } else {
      targetG.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) targetG.lineTo(points[i].x, points[i].y);
      targetG.stroke({ width, color: difficultyColor, cap: 'round', join: 'round' });
    }

    drawEndpointCap(
      targetG,
      resolved.origin,
      difficultyColor,
      resolved.danglingOrigin,
      Boolean(route.origin.ref)
    );
    drawEndpointCap(
      targetG,
      resolved.destination,
      difficultyColor,
      resolved.danglingDestination,
      Boolean(route.destination.ref)
    );

    // Free vertices are editable handles, only shown while selected AND in tactical view
    if (selected && (isTactical || draggedNode?.type === 'route_vertex')) {
      (route.path ?? []).forEach((point, index) => {
        const shown = transient && transient.index === index ? transient.point : point;
        targetG.circle(shown.x, shown.y, Math.max(3, 4.5 * counterScale))
          .fill({ color: 0xfffbeb })
          .stroke({ width: Math.max(1, 1.5 * counterScale), color: 0xb45309 });
      });
    }

    // A small label keeps the road readable without turning the map into a
    // list. Road labels are hidden at Continental zoom (< 0.55) unless selected
    const showLabel =
      settings.visibleLayers.labels &&
      Boolean(route.name) &&
      (selected || route.kind === 'highway' || route.kind === 'caravan' || route.kind === 'sea_lane') &&
      isElementVisibleAtZoom(3, zoom, selected);
    if (showLabel) {
      const middle = Math.floor(points.length / 2);
      const anchor = points[middle];
      const label = new Text({
        text: route.name,
        style: new TextStyle({
          fontSize: selected ? 10 : 9,
          fontStyle: isPersian ? 'normal' : 'italic',
          fill: selected ? 0x92400e : 0x5c4938,
          fontFamily: 'serif',
          stroke: { color: 0xf5ecd5, width: 3 },
        }),
        resolution: textResolution,
      });
      label.anchor.set(0.5, 1);
      label.scale.set(counterScale);
      label.x = anchor.x;
      label.y = anchor.y - 5 * counterScale;
      targetLabels.addChild(label);
    }
  }
}

/**
 * Live snap indicator for the road tool. Drawn into the interaction layer so
 * it floats above the map while the pointer moves.
 */
export function renderRouteSnapPreview(
  g: Graphics,
  point: MapPoint | null
): void {
  g.clear();
  if (!point) return;

  g.circle(point.x, point.y, 10)
    .stroke({ width: 2, color: 0xf59e0b, alpha: 0.95 });
  g.circle(point.x, point.y, 3)
    .fill({ color: 0xf59e0b });
}

/** A dashed amber preview of the route currently being drawn. */
export function renderRouteDraft(
  g: Graphics,
  points: MapPoint[],
  snapped: boolean
): void {
  g.clear();
  if (points.length === 0) return;

  if (points.length >= 2) {
    drawDashedPolyline(g, points, 9, 6);
    g.stroke({
      width: 2.2,
      color: snapped ? 0xb45309 : 0x9a7b4f,
      alpha: 0.95,
      cap: 'round',
      join: 'round',
    });
  }

  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (i === 0 || i === points.length - 1) {
      g.circle(point.x, point.y, 4).fill({ color: 0xf59e0b });
    } else {
      g.circle(point.x, point.y, 2.6).fill({ color: 0xfffbeb }).stroke({
        width: 1,
        color: 0xb45309,
      });
    }
  }

  const last = points[points.length - 1];
  if (snapped) {
    g.circle(last.x, last.y, 10).stroke({ width: 2, color: 0xf59e0b, alpha: 0.8 });
  }
}
