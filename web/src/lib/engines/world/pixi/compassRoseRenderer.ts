/**
 * compassRoseRenderer.ts
 *
 * Procedural 16-point nautical compass rose (windrose) generator & renderer
 * for the illuminated manuscript cartography engine (Plan 27 Phase E.3).
 *
 * Visual Features:
 * - 16-point chiseled star with alternating shaded ink and highlighted parchment facets.
 * - 4 Primary Cardinals (N, E, S, W) at full radius.
 * - 4 Primary Ordinals (NE, SE, SW, NW) at 0.72x radius.
 * - 8 Secondary Ordinals (NNE, ENE, etc.) at 0.50x radius.
 * - Concentric brass rhumb & degree tracks with 32 radial graduation ticks.
 * - Antique Fleur-de-lis / ornamental arrowhead finial crowning the North point.
 * - Classical serif cardinal callouts ('N', 'E', 'S', 'W') with antique halo.
 * - Concentric brass boss / central rivet pivot.
 */

import { Graphics, Container, Text } from 'pixi.js';
import type { MapPoint, CompassRoseConfig } from '@/lib/types';
import { VINTAGE_PARCHMENT } from './vintageTheme';

export interface CompassFacet {
  points: [MapPoint, MapPoint, MapPoint]; // Triangle: center, tip, valley
  isShaded: boolean; // true = dark primary, false = light secondary
  rank: 'cardinal' | 'ordinal' | 'secondary';
  pointIndex: number;
}

export interface CompassRing {
  radius: number;
  width: number;
  color: string | number;
  alpha?: number;
}

export interface CompassTick {
  from: MapPoint;
  to: MapPoint;
  isMajor: boolean;
}

export interface CompassLabelPlacement {
  text: string;
  position: MapPoint;
  fontSize: number;
}

export interface CompassRoseGeometry {
  center: MapPoint;
  radius: number;
  facets: CompassFacet[];
  rings: CompassRing[];
  ticks: CompassTick[];
  labels: CompassLabelPlacement[];
  fleurDeLis: {
    spear: MapPoint[];
    leftPetal: MapPoint[];
    rightPetal: MapPoint[];
    clasp: MapPoint[];
  };
}

/**
 * Computes pure mathematical geometry for the 16-point nautical compass rose.
 */
export function generateCompassRoseGeometry(config: CompassRoseConfig = {}): CompassRoseGeometry {
  const cx = config.x ?? 2000;
  const cy = config.y ?? 400;
  const R = config.radius ?? 110;
  const rot = config.rotation ?? 0;
  const totalPoints = config.pointsCount ?? 16;
  const center: MapPoint = { x: cx, y: cy };

  const facets: CompassFacet[] = [];
  const ticks: CompassTick[] = [];
  const rings: CompassRing[] = [];
  const labels: CompassLabelPlacement[] = [];

  // Valley base radii for facet triangles
  const rValley = R * 0.22;

  // 1. Generate Star Points & Facets
  for (let i = 0; i < totalPoints; i++) {
    // 0 = North (-PI/2), moving clockwise
    const theta = -Math.PI / 2 + rot + (i * 2 * Math.PI) / totalPoints;
    const isCardinal = i % 4 === 0;
    const isOrdinal = !isCardinal && i % 2 === 0;

    let tipLen = R * 0.5; // secondary ordinal
    let rank: CompassFacet['rank'] = 'secondary';
    if (isCardinal) {
      tipLen = R;
      rank = 'cardinal';
    } else if (isOrdinal) {
      tipLen = R * 0.72;
      rank = 'ordinal';
    }

    const tipX = cx + Math.cos(theta) * tipLen;
    const tipY = cy + Math.sin(theta) * tipLen;
    const tip: MapPoint = { x: tipX, y: tipY };

    // Valleys flanking this point
    const halfAngle = Math.PI / totalPoints;
    const leftAngle = theta - halfAngle;
    const rightAngle = theta + halfAngle;

    const leftValley: MapPoint = {
      x: cx + Math.cos(leftAngle) * rValley,
      y: cy + Math.sin(leftAngle) * rValley,
    };
    const rightValley: MapPoint = {
      x: cx + Math.cos(rightAngle) * rValley,
      y: cy + Math.sin(rightAngle) * rValley,
    };

    // Split into Left (shaded dark) and Right (highlighted light) facets
    facets.push({
      points: [center, tip, leftValley],
      isShaded: true,
      rank,
      pointIndex: i,
    });
    facets.push({
      points: [center, tip, rightValley],
      isShaded: false,
      rank,
      pointIndex: i,
    });
  }

  // 2. Concentric Rings
  // Outer degree border rings
  rings.push(
    { radius: R * 0.96, width: 0.8, color: config.primaryColor ?? '#2c1810', alpha: 0.7 },
    { radius: R * 1.05, width: 1.5, color: config.primaryColor ?? '#2c1810', alpha: 0.9 },
    { radius: R * 1.09, width: 0.6, color: config.primaryColor ?? '#2c1810', alpha: 0.5 },
    // Mid dial ring
    { radius: R * 0.44, width: 0.75, color: config.accentColor ?? '#8c6d3b', alpha: 0.6 },
    // Central boss brass ring
    { radius: R * 0.16, width: 1.2, color: config.primaryColor ?? '#2c1810', alpha: 1.0 }
  );

  // 3. Degree & Rhumb Graduation Ticks (32 divisions)
  if (config.showDegreeRing !== false) {
    const tickCount = 32;
    for (let k = 0; k < tickCount; k++) {
      const angle = -Math.PI / 2 + rot + (k * 2 * Math.PI) / tickCount;
      const isMajor = k % 8 === 0;
      const isMid = !isMajor && k % 4 === 0;

      const rInner = R * 0.96;
      let rOuter = R * 1.01;
      if (isMajor) rOuter = R * 1.05;
      else if (isMid) rOuter = R * 1.03;

      ticks.push({
        from: {
          x: cx + Math.cos(angle) * rInner,
          y: cy + Math.sin(angle) * rInner,
        },
        to: {
          x: cx + Math.cos(angle) * rOuter,
          y: cy + Math.sin(angle) * rOuter,
        },
        isMajor: isMajor || isMid,
      });
    }
  }

  // 4. Cardinal Callout Labels ('N', 'E', 'S', 'W')
  const cardinalDist = R * 1.22;
  const cardinalLetters = [
    { text: 'N', angle: -Math.PI / 2 + rot, size: 20 },
    { text: 'E', angle: rot, size: 17 },
    { text: 'S', angle: Math.PI / 2 + rot, size: 17 },
    { text: 'W', angle: Math.PI + rot, size: 17 },
  ];

  for (const c of cardinalLetters) {
    labels.push({
      text: c.text,
      position: {
        x: cx + Math.cos(c.angle) * cardinalDist,
        y: cy + Math.sin(c.angle) * cardinalDist,
      },
      fontSize: c.size,
    });
  }

  // 5. North Fleur-de-lis Finial Crown
  // Anchored at North tip (cx, cy - R)
  const nTipX = cx + Math.sin(rot) * R;
  const nTipY = cy - Math.cos(rot) * R;

  // Local vector pointing outwards North
  const ux = Math.sin(rot);
  const uy = -Math.cos(rot);
  // Perpendicular vector
  const vx = Math.cos(rot);
  const vy = Math.sin(rot);

  const spear: MapPoint[] = [
    { x: nTipX - vx * 4, y: nTipY - vy * 4 },
    { x: nTipX + ux * 22, y: nTipY + uy * 22 },
    { x: nTipX + vx * 4, y: nTipY + vy * 4 },
  ];

  const leftPetal: MapPoint[] = [
    { x: nTipX, y: nTipY },
    { x: nTipX + ux * 8 - vx * 12, y: nTipY + uy * 8 - vy * 12 },
    { x: nTipX + ux * 16 - vx * 14, y: nTipY + uy * 16 - vy * 14 },
    { x: nTipX + ux * 12 - vx * 4, y: nTipY + uy * 12 - vy * 4 },
  ];

  const rightPetal: MapPoint[] = [
    { x: nTipX, y: nTipY },
    { x: nTipX + ux * 8 + vx * 12, y: nTipY + uy * 8 + vy * 12 },
    { x: nTipX + ux * 16 + vx * 14, y: nTipY + uy * 16 + vy * 14 },
    { x: nTipX + ux * 12 + vx * 4, y: nTipY + uy * 12 + vy * 4 },
  ];

  const clasp: MapPoint[] = [
    { x: nTipX - vx * 7 + ux * 4, y: nTipY - vy * 7 + uy * 4 },
    { x: nTipX + vx * 7 + ux * 4, y: nTipY + vy * 7 + uy * 4 },
    { x: nTipX + vx * 6 + ux * 7, y: nTipY + vy * 6 + uy * 7 },
    { x: nTipX - vx * 6 + ux * 7, y: nTipY - vy * 6 + uy * 7 },
  ];

  return {
    center,
    radius: R,
    facets,
    rings,
    ticks,
    labels,
    fleurDeLis: {
      spear,
      leftPetal,
      rightPetal,
      clasp,
    },
  };
}

function parseHexColor(c: string | number | undefined, fallback: number): number {
  if (typeof c === 'number') return c;
  if (!c) return fallback;
  if (c.startsWith('#')) return parseInt(c.slice(1), 16) || fallback;
  return fallback;
}

/**
 * Renders the 16-point nautical compass rose onto PixiJS Graphics and Container.
 */
export function renderCompassRose(
  graphics: Graphics,
  textContainer: Container,
  config: CompassRoseConfig = {}
): void {
  const geom = generateCompassRoseGeometry(config);

  const darkInk = parseHexColor(config.primaryColor, 0x2c1810);
  const parchmentLight = parseHexColor(config.secondaryColor, 0xfbf7ee);
  const brassAccent = parseHexColor(config.accentColor, 0x8c6d3b);
  const parchmentBase = parseHexColor(VINTAGE_PARCHMENT.landFill, 0xf5eedc);

  // 1. Outer dial backdrop circle (subtle parchment mask so sea waves don't intersect star)
  graphics
    .circle(geom.center.x, geom.center.y, geom.radius * 1.1)
    .fill({ color: parchmentBase, alpha: 0.82 });

  // 2. Radiating Rhumb Lines (subtle navigational ray guides fading into ocean)
  if (config.showRhumbLines !== false) {
    const rhumbReach = geom.radius * 2.8;
    for (let i = 0; i < 16; i++) {
      const angle = (i * 2 * Math.PI) / 16;
      const x2 = geom.center.x + Math.cos(angle) * rhumbReach;
      const y2 = geom.center.y + Math.sin(angle) * rhumbReach;
      graphics
        .moveTo(geom.center.x, geom.center.y)
        .lineTo(x2, y2)
        .stroke({
          color: darkInk,
          width: i % 4 === 0 ? 0.75 : 0.4,
          alpha: i % 4 === 0 ? 0.18 : 0.09,
        });
    }
  }

  // 3. Draw Facets
  // Render secondary ordinals first, then ordinals, then cardinals on top
  const sortedFacets = [...geom.facets].sort((a, b) => {
    const order = { secondary: 0, ordinal: 1, cardinal: 2 };
    return order[a.rank] - order[b.rank];
  });

  for (const facet of sortedFacets) {
    const flatPoints = [
      facet.points[0].x,
      facet.points[0].y,
      facet.points[1].x,
      facet.points[1].y,
      facet.points[2].x,
      facet.points[2].y,
    ];

    const fillColor = facet.isShaded ? darkInk : parchmentLight;
    const strokeColor = darkInk;

    graphics
      .poly(flatPoints)
      .fill({ color: fillColor, alpha: facet.isShaded ? 0.95 : 0.92 })
      .stroke({ color: strokeColor, width: 0.7, alpha: 0.9 });
  }

  // 4. North Fleur-de-lis Finial
  const { spear, leftPetal, rightPetal, clasp } = geom.fleurDeLis;
  const toFlat = (pts: MapPoint[]) => pts.flatMap((p) => [p.x, p.y]);

  graphics
    .poly(toFlat(spear))
    .fill({ color: brassAccent, alpha: 0.95 })
    .stroke({ color: darkInk, width: 1.0, alpha: 0.95 });

  graphics
    .poly(toFlat(leftPetal))
    .fill({ color: parchmentLight, alpha: 0.9 })
    .stroke({ color: darkInk, width: 0.85, alpha: 0.95 });

  graphics
    .poly(toFlat(rightPetal))
    .fill({ color: brassAccent, alpha: 0.9 })
    .stroke({ color: darkInk, width: 0.85, alpha: 0.95 });

  graphics
    .poly(toFlat(clasp))
    .fill({ color: darkInk, alpha: 0.95 })
    .stroke({ color: brassAccent, width: 0.6, alpha: 0.9 });

  // 5. Rings & Border Tracks
  for (const ring of geom.rings) {
    graphics.circle(geom.center.x, geom.center.y, ring.radius).stroke({
      color: parseHexColor(ring.color, darkInk),
      width: ring.width,
      alpha: ring.alpha ?? 1.0,
    });
  }

  // 6. Degree Graduation Ticks
  for (const tick of geom.ticks) {
    graphics
      .moveTo(tick.from.x, tick.from.y)
      .lineTo(tick.to.x, tick.to.y)
      .stroke({
        color: darkInk,
        width: tick.isMajor ? 1.2 : 0.65,
        alpha: tick.isMajor ? 0.85 : 0.55,
      });
  }

  // 7. Center Jewel Pivot
  graphics
    .circle(geom.center.x, geom.center.y, geom.radius * 0.15)
    .fill({ color: brassAccent, alpha: 0.95 })
    .stroke({ color: darkInk, width: 1.2, alpha: 0.95 });

  graphics
    .circle(geom.center.x, geom.center.y, geom.radius * 0.08)
    .fill({ color: parchmentLight, alpha: 0.9 })
    .stroke({ color: darkInk, width: 0.8, alpha: 0.9 });

  graphics
    .circle(geom.center.x, geom.center.y, geom.radius * 0.035)
    .fill({ color: darkInk, alpha: 1.0 });

  // 8. Cardinal Text Labels ('N', 'E', 'S', 'W')
  for (const label of geom.labels) {
    const isNorth = label.text === 'N';
    const textStyle = {
      fontFamily: '"Cinzel Decorative", "Cinzel", "Times New Roman", "Georgia", serif',
      fontSize: label.fontSize,
      fontWeight: 'bold' as const,
      fill: isNorth ? '#8c2d19' : '#2c1810', // Deep imperial crimson for North, dark ink for others
      stroke: {
        color: '#faf6ee',
        width: 3.5,
      },
    };

    const pixiText = new Text({
      text: label.text,
      style: textStyle,
    });
    pixiText.anchor.set(0.5, 0.5);
    pixiText.x = label.position.x;
    pixiText.y = label.position.y;
    textContainer.addChild(pixiText);
  }
}
