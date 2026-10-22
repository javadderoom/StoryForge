/**
 * PixiCartographerEngine: Hardware-accelerated WebGL 2D Cartography Viewport
 * Implements Phase 1 of the Inkarnate-class fantasy map maker.
 * Renders high-performance interactive maps with the Classic Parchment / Vintage Fantasy aesthetic.
 */

import { Application, Container, Graphics, Matrix, Text, TextStyle } from 'pixi.js';
import {
  WorldBible,
  WorldMapSettings,
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  MapPoint,
} from '@/lib/types';
import { CartographerTool } from '@/components/cartographer/CartographerHeader';
import { mapObjectKey, type MapObjectRef } from '../mapSelection';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { PixiSpatialIndex, SpatialItem } from './PixiSpatialIndex';
import {
  buildMapHitCandidates,
  hitCandidateBounds,
  hitTestMapObjects,
  type MapHit,
  type MapHitCandidate,
} from '../mapHitTest';
import {
  isObjectVisible,
  isPlacementVisibleInLayers,
  isTerrainVisibleInLayers,
  orderPlacementsForRender,
  orderTerrainForRender,
} from '../mapObjectOrder';
import {
  MAP_MATERIALS,
  resolveTextureStrength,
  textureScaleFor,
  type MapMaterialKey,
} from '../texturePalette';
import { MapTextureLibrary } from './mapTextureLibrary';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  calculateHexVertices,
  generateOrganicParchmentContours,
} from './pixiMath';

export interface DraggedNodeData {
  type: 'location' | 'waypoint';
  id: string;
  routeId?: string;
  index?: number;
  startPoint: MapPoint;
}

/** Everything one full render pass needs. */
export interface RenderAllOptions {
  worldBible: WorldBible;
  settings: WorldMapSettings;
  /** Plan 23: every selected object, not just the one open in the Inspector. */
  selection: MapObjectRef[];
  activeTool: CartographerTool;
  draggedNode: DraggedNodeData | null;
  transientPos: MapPoint | null;
  draftPoints: MapPoint[];
  rulerPoints: MapPoint[];
  isPersian: boolean;
}

export class PixiCartographerEngine {
  private app: Application | null = null;
  private canvas: HTMLCanvasElement | null = null;

  // Viewport Container (moves with Pan & Zoom)
  private worldContainer = new Container();

  // Layer Hierarchy
  private backgroundLayer = new Container();
  private gridLayer = new Container();
  private terrainLayer = new Container();
  private routeLayer = new Container();
  private settlementLayer = new Container();
  private placementLayer = new Container();
  private interactionLayer = new Container();

  // Reusable Graphics objects for batch drawing
  private bgGraphics = new Graphics();
  private gridGraphics = new Graphics();
  private terrainGraphics = new Graphics();
  private routeGraphics = new Graphics();
  private settlementGraphics = new Graphics();
  private placementGraphics = new Graphics();
  private interactionGraphics = new Graphics();
  private selectionGraphics = new Graphics();
  private brushGraphics = new Graphics();
  private brushCursorGraphics = new Graphics();

  // Text label containers to recycle
  private settlementLabelsContainer = new Container();

  // Spatial Index for sub-millisecond point hit-testing
  public spatialIndex = new PixiSpatialIndex();

  /**
   * The material tiles. They are loaded in the background; until they arrive
   * (or if they fail to arrive) the map is painted with the flat theme
   * colours, which is exactly how it looked before textures existed.
   */
  private textureLibrary = new MapTextureLibrary();
  private textureStrength = 0;
  private materialMatrices = new Map<MapMaterialKey, Matrix>();
  /** The options of the last render, so a late texture load can re-render. */
  private lastRenderOptions: RenderAllOptions | null = null;

  private isInitialized = false;

  constructor() {
    this.worldContainer.addChild(
      this.backgroundLayer,
      this.gridLayer,
      this.terrainLayer,
      this.routeLayer,
      this.settlementLayer,
      this.placementLayer,
      this.interactionLayer
    );

    this.backgroundLayer.addChild(this.bgGraphics);
    this.gridLayer.addChild(this.gridGraphics);
    this.terrainLayer.addChild(this.terrainGraphics);
    this.routeLayer.addChild(this.routeGraphics);
    this.settlementLayer.addChild(this.settlementGraphics, this.settlementLabelsContainer);
    this.placementLayer.addChild(this.placementGraphics);
    this.interactionLayer.addChild(
      this.interactionGraphics,
      this.selectionGraphics,
      this.brushGraphics,
      this.brushCursorGraphics
    );
  }

  /**
   * Initializes PixiJS Application on the provided HTML Canvas
   */
  public async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
    if (this.isInitialized && this.app) return;

    this.canvas = canvas;
    this.app = new Application();

    await this.app.init({
      canvas,
      width,
      height,
      backgroundColor: VINTAGE_PARCHMENT.bgParchment,
      antialias: true,
      autoDensity: true,
      resolution: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
    });

    this.app.stage.addChild(this.worldContainer);
    this.isInitialized = true;

    // Material tiles load in the background: the map is on screen immediately
    // with its flat colours and upgrades to the textured look a moment later.
    void this.textureLibrary.load().then(() => {
      if (!this.lastRenderOptions) return;
      this.renderAll(this.lastRenderOptions);
    });
  }

  /**
   * Paints a region with its material.
   *
   * The flat theme colour is always laid down first, then the material
   * texture is cross-faded over it. At strength 0 the map is exactly the flat
   * look it always had; at strength 1 it is entirely textured.
   */
  private fillWithMaterial(
    g: Graphics,
    points: number[],
    material: MapMaterialKey | null,
    flatColor: number,
    flatAlpha: number
  ): void {
    const strength = this.textureStrength;
    const texture = material && strength > 0 ? this.textureLibrary.get(material) : null;

    // The flat colour carries the region on its own until the texture exists:
    // fading it to `1 - strength` up front would leave the map a washed-out
    // ghost while the tiles load (and permanently, if one 404s) instead of the
    // pre-texture look the fallback promises.
    g.poly(points).fill({
      color: flatColor,
      alpha: flatAlpha * (texture ? 1 - strength : 1),
    });

    if (!texture || !material) return;

    let matrix = this.materialMatrices.get(material);
    if (!matrix) {
      const scale = textureScaleFor(MAP_MATERIALS[material]);
      matrix = new Matrix().scale(scale, scale);
      this.materialMatrices.set(material, matrix);
    }

    g.poly(points).fill({
      texture,
      matrix,
      textureSpace: 'global',
      alpha: MAP_MATERIALS[material].alpha * strength,
    });
  }

  /**
   * Updates camera pan and zoom transform
   */
  public setTransform(pan: { x: number; y: number }, zoom: number): void {
    this.worldContainer.x = pan.x;
    this.worldContainer.y = pan.y;
    this.worldContainer.scale.set(zoom);
  }

  /**
   * Resizes renderer viewport
   */
  public resize(width: number, height: number): void {
    if (!this.app || !this.app.renderer) return;
    this.app.renderer.resize(width, height);
  }

  /**
   * Full Render Pass: Re-draws all map visual layers according to WorldBible state
   */
  public renderAll(options: RenderAllOptions): void {
    this.lastRenderOptions = options;
    if (!this.isInitialized) return;

    const {
      worldBible,
      settings,
      selection,
      activeTool,
      draggedNode,
      transientPos,
      draftPoints,
      rulerPoints,
      isPersian,
    } = options;

    const locations = worldBible.locations || [];
    const tradeRoutes = worldBible.tradeRoutes || [];
    const terrainFeatures = worldBible.mapData?.terrainFeatures || [];
    const placements = worldBible.mapData?.placements || [];

    // How strongly the material textures are laid over the flat theme
    // colours. 0 = the classic flat look, 1 = fully textured.
    //
    // The material tiles are duotoned against the parchment palette, so they
    // belong to that theme only: the other themes keep their flat colours
    // until they get their own material set.
    const theme = settings.theme ?? 'parchment';
    this.textureStrength =
      theme === 'parchment' ? resolveTextureStrength(settings.textureStrength) : 0;

    // 1. Re-index interactive spatial elements
    this.rebuildSpatialIndex(locations, tradeRoutes, terrainFeatures, placements);

    // 2. Render Background & Vintage Frame
    this.renderBackground(settings);

    // 3. Render Grid (Square / Hex / None)
    this.renderGrid(settings);

    // 4. Render Continents, Biomes, Rivers, Mountains
    this.renderTerrain(terrainFeatures, settings);

    // 5. Render Trade Routes & Waypoints
    const selectionKeys = new Set(selection.map((ref) => mapObjectKey(ref.kind, ref.id)));
    this.renderRoutes({
      tradeRoutes,
      locations,
      selectionKeys,
      draggedNode,
      transientPos,
      settings,
    });

    // 6. Render Settlements & Heraldic Labels
    this.renderSettlements({
      locations,
      draggedNode,
      transientPos,
      settings,
      isPersian,
    });

    // 7. Render Placed Lore Pins
    this.renderPlacements(placements, settings);

    // 7b. One selection language for every object kind (Plan 23)
    this.renderSelectionOverlay({
      selectionKeys,
      terrainFeatures,
      placements,
      locations,
      tradeRoutes,
      draggedNode,
      transientPos,
      settings,
    });

    // 8. Render Active Interaction Tools (Drafting & Ruler)
    this.renderInteraction({
      draftPoints,
      rulerPoints,
      activeTool,
      isPersian,
    });
  }

  /**
   * Rebuilds the RBush spatial index for hit testing.
   *
   * Plan 21: every authored shape is indexed, not only the point-shaped ones.
   * A landmass is indexed by its bounding box, a river by the box around its
   * polyline, a lore pin by its own position. The index is the COARSE filter;
   * `pickAt` runs the exact geometry test on the candidates it returns.
   */
  private rebuildSpatialIndex(
    locations: WorldLocation[],
    tradeRoutes: WorldTradeRoute[],
    terrainFeatures: MapTerrainFeature[],
    placements: MapEntityPlacement[]
  ): void {
    this.spatialIndex.clear();
    const spatialItems: SpatialItem[] = [];

    const candidates = buildMapHitCandidates({
      locations,
      tradeRoutes,
      terrainFeatures,
      placements,
    });

    for (const candidate of candidates) {
      const box = hitCandidateBounds(candidate);
      if (!box) continue;
      spatialItems.push({
        id: candidate.id,
        type: candidate.kind,
        minX: box.minX,
        minY: box.minY,
        maxX: box.maxX,
        maxY: box.maxY,
        data: candidate,
      });
    }

    this.spatialIndex.load(spatialItems);
  }

  /**
   * Picks the map object under a world point.
   *
   * The spatial index narrows the world down to the few objects whose bounds
   * are near the click; the exact geometry test (point-in-polygon, distance to
   * a segment) then decides which of them was really hit.
   */
  public pickAt(point: MapPoint): MapHit | null {
    const PAD = 40;
    const rough = this.spatialIndex.searchBBox(
      point.x - PAD,
      point.y - PAD,
      point.x + PAD,
      point.y + PAD
    );
    const candidates = rough.map((item) => item.data as MapHitCandidate);
    return hitTestMapObjects(point, candidates);
  }

  /**
   * 1. Background & Aged Papyrus Wash
   */
  private renderBackground(settings: WorldMapSettings): void {
    const g = this.bgGraphics;
    g.clear();

    // Ocean wash — the flat theme colour, with the sea material laid over it.
    this.fillWithMaterial(
      g,
      [0, 0, CANVAS_WIDTH, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0, CANVAS_HEIGHT],
      'ocean',
      VINTAGE_PARCHMENT.oceanWash,
      1
    );

    // Antique sea wavelets across open waters (woodcut cartographic ripples)
    const waveSpacing = 160;
    for (let y = 80; y < CANVAS_HEIGHT - 80; y += waveSpacing) {
      const rowOffset = (Math.floor(y / waveSpacing) % 2) * (waveSpacing / 2);
      for (let x = 80 + rowOffset; x < CANVAS_WIDTH - 80; x += waveSpacing) {
        g.moveTo(x - 12, y)
          .bezierCurveTo(x - 8, y - 3, x - 4, y - 3, x, y)
          .bezierCurveTo(x + 4, y + 3, x + 8, y + 3, x + 12, y)
          .stroke({ width: 0.8, color: VINTAGE_PARCHMENT.coastlineHatch, alpha: 0.22 });
        g.moveTo(x - 6, y + 5)
          .bezierCurveTo(x - 3, y + 2, x, y + 2, x + 3, y + 5)
          .stroke({ width: 0.6, color: VINTAGE_PARCHMENT.coastlineHatch, alpha: 0.16 });
      }
    }

    // Outer vintage cartographic double border
    const borderPadding = 18;
    g.rect(
      borderPadding,
      borderPadding,
      CANVAS_WIDTH - borderPadding * 2,
      CANVAS_HEIGHT - borderPadding * 2
    ).stroke({
      width: 4,
      color: VINTAGE_PARCHMENT.borderFrame,
    });

    const innerPadding = 28;
    g.rect(
      innerPadding,
      innerPadding,
      CANVAS_WIDTH - innerPadding * 2,
      CANVAS_HEIGHT - innerPadding * 2
    ).stroke({
      width: 1.5,
      color: VINTAGE_PARCHMENT.coastlineHatch,
    });

    // Corner rosettes
    const corners = [
      { x: innerPadding, y: innerPadding },
      { x: CANVAS_WIDTH - innerPadding, y: innerPadding },
      { x: innerPadding, y: CANVAS_HEIGHT - innerPadding },
      { x: CANVAS_WIDTH - innerPadding, y: CANVAS_HEIGHT - innerPadding },
    ];
    for (const c of corners) {
      g.circle(c.x, c.y, 8).fill({ color: VINTAGE_PARCHMENT.borderFrame });
      g.circle(c.x, c.y, 4).fill({ color: VINTAGE_PARCHMENT.capitalGold });
    }
  }

  /**
   * 2. Vintage Grid Rulings
   */
  private renderGrid(settings: WorldMapSettings): void {
    const g = this.gridGraphics;
    g.clear();

    if (!settings.visibleLayers.grid || settings.gridType === 'none') {
      return;
    }

    const gridSize = settings.gridSize || 100;
    const strokeColor = VINTAGE_PARCHMENT.gridRuling;

    if (settings.gridType === 'square') {
      for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
        g.moveTo(x, 0).lineTo(x, CANVAS_HEIGHT).stroke({
          width: 0.8,
          color: strokeColor,
          alpha: 0.5,
        });
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += gridSize) {
        g.moveTo(0, y).lineTo(CANVAS_WIDTH, y).stroke({
          width: 0.8,
          color: strokeColor,
          alpha: 0.5,
        });
      }
    } else if (settings.gridType === 'hex') {
      const hexR = gridSize * 0.55;
      const stepX = gridSize * 1.5;
      const stepY = gridSize;

      for (let col = 0; col * stepX <= CANVAS_WIDTH; col++) {
        for (let row = 0; row * stepY <= CANVAS_HEIGHT; row++) {
          const hx = col * stepX;
          const hy = row * stepY + (col % 2 === 1 ? gridSize / 2 : 0);
          const vertices = calculateHexVertices(hx, hy, hexR);

          const polyPoints: number[] = [];
          for (const v of vertices) {
            polyPoints.push(v.x, v.y);
          }

          g.poly(polyPoints).stroke({
            width: 0.6,
            color: strokeColor,
            alpha: 0.45,
          });
        }
      }
    }
  }

  /**
   * 3. Continents, Biomes, Rivers, and Mountains in Antique Ink Style
   *
   * Plan 21: ONE z-ordered pass. Every object carries a draw order — an
   * explicit `zIndex`, or its band plus its position in the array — so the
   * default stacking is exactly the one this method used to hard-code
   * (ocean, land, biomes, standing water, ink lines, relief), while any
   * object can still be raised above any other. Per-object `visible` hides a
   * single object; the category switches hide whole classes.
   */
  private renderTerrain(terrainFeatures: MapTerrainFeature[], settings: WorldMapSettings): void {
    const g = this.terrainGraphics;
    g.clear();

    for (const feat of orderTerrainForRender(terrainFeatures)) {
      if (!isObjectVisible(feat)) continue;
      if (!isTerrainVisibleInLayers(feat.type, settings.visibleLayers)) continue;

      switch (feat.type) {
        case 'continent':
        case 'island':
          this.drawLandmass(g, feat);
          break;
        case 'ocean':
        case 'sea':
          this.drawWaterBody(g, feat, 'ocean');
          break;
        case 'lake':
          this.drawWaterBody(g, feat, 'water');
          break;
        case 'forest':
        case 'desert':
        case 'swamp':
        case 'tundra':
        case 'wasteland':
        case 'plains':
        case 'oasis':
          this.drawBiome(g, feat);
          break;
        case 'river':
          this.drawRiver(g, feat);
          break;
        case 'valley':
        case 'canyon':
        case 'chasm':
          this.drawValley(g, feat);
          break;
        case 'mountain_range':
          this.drawRange(g, feat);
          break;
        case 'peak':
        case 'volcano':
          this.drawPeak(g, feat);
          break;
        case 'arcane_anomaly':
          this.drawAnomaly(g, feat);
          break;
      }
    }
  }

  /** Continents and islands: parchment fill, inked coastline, echo rings. */
  private drawLandmass(g: Graphics, feat: MapTerrainFeature): void {
    if (!feat.polygon || feat.polygon.length <= 2) return;
    const points = generateOrganicParchmentContours(feat.polygon, 3);
    const flatPoints: number[] = [];
    for (const pt of points) flatPoints.push(pt.x, pt.y);

    // Land fill — the paper material
    this.fillWithMaterial(g, flatPoints, 'land', VINTAGE_PARCHMENT.landFill, 1);

    // Hand-inked primary coastline
    g.poly(flatPoints).stroke({ width: 2.2, color: VINTAGE_PARCHMENT.coastlineInk });

    // Automated vintage coastline echo rings
    g.poly(flatPoints).stroke({ width: 5.5, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.45 });
    g.poly(flatPoints).stroke({ width: 11, color: VINTAGE_PARCHMENT.coastlineHatch, alpha: 0.15 });

    // Interior carved water holes (lakes, inland seas, straits)
    for (const hole of feat.holes ?? []) {
      if (hole.length <= 2) continue;
      const holePoints = generateOrganicParchmentContours(hole, 2);
      const holeFlat: number[] = [];
      for (const pt of holePoints) holeFlat.push(pt.x, pt.y);

      this.fillWithMaterial(g, holeFlat, 'water', VINTAGE_PARCHMENT.oceanWash, 1);
      g.poly(holeFlat).stroke({ width: 2.0, color: VINTAGE_PARCHMENT.coastlineInk });
      g.poly(holeFlat).stroke({ width: 4.5, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.35 });
    }
  }

  /** Standing water: lakes, inland seas and open-ocean sheets. */
  private drawWaterBody(g: Graphics, feat: MapTerrainFeature, material: 'ocean' | 'water'): void {
    if (!feat.polygon || feat.polygon.length <= 2) return;
    const points = generateOrganicParchmentContours(feat.polygon, 2);
    const flatPoints: number[] = [];
    for (const pt of points) flatPoints.push(pt.x, pt.y);

    this.fillWithMaterial(g, flatPoints, material, VINTAGE_PARCHMENT.oceanWash, 1);
    g.poly(flatPoints).stroke({ width: 2.0, color: VINTAGE_PARCHMENT.coastlineInk });
    g.poly(flatPoints).stroke({ width: 4.5, color: VINTAGE_PARCHMENT.coastlineGlow, alpha: 0.35 });
  }

  /** Biomes: translucent washes laid over the land. */
  private drawBiome(g: Graphics, feat: MapTerrainFeature): void {
    if (!feat.polygon || feat.polygon.length <= 2) return;
    const flatPoints: number[] = [];
    for (const pt of feat.polygon) flatPoints.push(pt.x, pt.y);

    let color: number = VINTAGE_PARCHMENT.biomeForest;
    let material: MapMaterialKey = 'forest';
    if (feat.type === 'desert') {
      color = VINTAGE_PARCHMENT.biomeDesert;
      material = 'desert';
    } else if (feat.type === 'swamp') {
      color = VINTAGE_PARCHMENT.biomeSwamp;
      material = 'swamp';
    } else if (feat.type === 'tundra') {
      color = VINTAGE_PARCHMENT.biomeTundra;
      material = 'tundra';
    } else if (feat.type === 'oasis') {
      color = 0x6f8f5a;
      material = 'plains';
    } else if (feat.type === 'wasteland') {
      color = 0x8a7a63;
      material = 'desert';
    } else if (feat.type === 'plains') {
      color = 0xc9b87a;
      material = 'plains';
    }

    this.fillWithMaterial(g, flatPoints, material, color, 0.35);
    g.poly(flatPoints).stroke({ width: 1, color, alpha: 0.6 });
  }

  /** Rivers: winding blue-grey ink lines. */
  private drawRiver(g: Graphics, feat: MapTerrainFeature): void {
    if (!feat.points || feat.points.length < 2) return;
    const pts = feat.points;
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i].x, pts[i].y);
    }
    g.stroke({
      width: feat.width || 3.5,
      color: VINTAGE_PARCHMENT.riverInk,
      cap: 'round',
      join: 'round',
    });
  }

  /**
   * Valleys, canyons and chasms: a dark cleft with a hand-inked lip.
   *
   * The Valley tool and the AI Oracle both produce these, but the renderer
   * had no branch for them — they lived in the data and never appeared on
   * the map (Cartographer truth audit, item #2).
   */
  private drawValley(g: Graphics, feat: MapTerrainFeature): void {
    if (!feat.points || feat.points.length < 2) return;
    const pts = feat.points;
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i].x, pts[i].y);
    }
    g.stroke({
      width: feat.width || 28,
      color: VINTAGE_PARCHMENT.valleyInk,
      alpha: 0.28,
      cap: 'round',
      join: 'round',
    });
    g.stroke({
      width: 2,
      color: VINTAGE_PARCHMENT.valleyInk,
      alpha: 0.85,
      cap: 'round',
      join: 'round',
    });
  }

  /** Mountain ranges: a shaded spine with a hand-inked crest. */
  private drawRange(g: Graphics, feat: MapTerrainFeature): void {
    if (!feat.points || feat.points.length < 2) return;
    const pts = feat.points;
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      g.lineTo(pts[i].x, pts[i].y);
    }
    g.stroke({
      width: feat.width || 25,
      color: VINTAGE_PARCHMENT.mountainShade,
      alpha: 0.6,
      cap: 'round',
    });
    g.stroke({ width: 3, color: VINTAGE_PARCHMENT.mountainInk, cap: 'round' });
  }

  /** Peaks and volcanoes: woodcut triangles with a snowcap. */
  private drawPeak(g: Graphics, feat: MapTerrainFeature): void {
    if (typeof feat.x !== 'number' || typeof feat.y !== 'number') return;
    const x = feat.x;
    const y = feat.y;
    const r = feat.radius || 30;

    g.poly([x, y - r, x - r * 0.8, y + r * 0.7, x + r * 0.8, y + r * 0.7])
      .fill({ color: feat.type === 'volcano' ? 0x7f1d1d : VINTAGE_PARCHMENT.landFill })
      .stroke({ width: 2, color: VINTAGE_PARCHMENT.mountainInk });

    g.poly([x, y - r, x, y + r * 0.7, x + r * 0.8, y + r * 0.7]).fill({
      color: VINTAGE_PARCHMENT.mountainShade,
      alpha: 0.5,
    });

    g.poly([x, y - r, x - r * 0.3, y - r * 0.3, x + r * 0.3, y - r * 0.3]).fill({
      color: VINTAGE_PARCHMENT.mountainSnowcap,
    });
  }

  /** Arcane anomalies: a faint violet ring. */
  private drawAnomaly(g: Graphics, feat: MapTerrainFeature): void {
    if (typeof feat.x !== 'number' || typeof feat.y !== 'number') return;
    const r = feat.radius || 26;
    g.circle(feat.x, feat.y, r).fill({ color: 0x693d7a, alpha: 0.18 });
    g.circle(feat.x, feat.y, r).stroke({ width: 1.6, color: 0x693d7a, alpha: 0.8 });
  }
  /**
   * 4. Caravan Trails & Trade Routes
   */
  private renderRoutes(options: {
    tradeRoutes: WorldTradeRoute[];
    locations: WorldLocation[];
    selectionKeys: Set<string>;
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    settings: WorldMapSettings;
  }): void {
    const { tradeRoutes, locations, selectionKeys, draggedNode, transientPos, settings } = options;
    const g = this.routeGraphics;
    g.clear();

    if (!settings.visibleLayers.caravanRoutes) return;

    for (const route of tradeRoutes) {
      const orig = locations.find((l) => l.id === route.originLocationId);
      const dest = locations.find((l) => l.id === route.destinationLocationId);
      if (!orig?.coordinates || !dest?.coordinates) continue;

      const originCoords =
        draggedNode?.type === 'location' && draggedNode.id === orig.id && transientPos
          ? transientPos
          : orig.coordinates;

      const destCoords =
        draggedNode?.type === 'location' && draggedNode.id === dest.id && transientPos
          ? transientPos
          : dest.coordinates;

      const waypoints = (route.waypoints || []).map((wp, idx) => {
        if (
          draggedNode?.type === 'waypoint' &&
          draggedNode.routeId === route.id &&
          draggedNode.index === idx &&
          transientPos
        ) {
          return transientPos;
        }
        return wp;
      });

      const fullPoints: MapPoint[] = [originCoords, ...waypoints, destCoords];

      let strokeColor: number = VINTAGE_PARCHMENT.caravanActive;
      if (route.status === 'raided') strokeColor = VINTAGE_PARCHMENT.caravanRaided;
      else if (route.status === 'blockaded') strokeColor = VINTAGE_PARCHMENT.caravanBlockaded;
      else if (route.status === 'secret') strokeColor = VINTAGE_PARCHMENT.caravanSecret;
      else if (route.status === 'seasonal') strokeColor = VINTAGE_PARCHMENT.caravanSeasonal;

      // The amber selection overlay is drawn later, on top of every layer;
      // this flag only decides whether the draggable waypoint dots appear.
      const isSelected = selectionKeys.has(mapObjectKey('trade_route', route.id));

      // Draw Main Route Line
      g.moveTo(fullPoints[0].x, fullPoints[0].y);
      for (let i = 1; i < fullPoints.length; i++) {
        g.lineTo(fullPoints[i].x, fullPoints[i].y);
      }
      g.stroke({
        width: isSelected ? 4 : 2.5,
        color: strokeColor,
        cap: 'round',
        join: 'round',
      });

      // Draggable Intermediate Waypoints
      if (isSelected) {
        for (const wp of waypoints) {
          g.circle(wp.x, wp.y, 7)
            .fill({ color: VINTAGE_PARCHMENT.caravanWaypoint })
            .stroke({ width: 2, color: 0xffffff });
        }
      }
    }
  }

  /**
   * 5. Settlements & Heraldic Shields in Antique Ink
   */
  private renderSettlements(options: {
    locations: WorldLocation[];
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    settings: WorldMapSettings;
    isPersian: boolean;
  }): void {
    const { locations, draggedNode, transientPos, settings } = options;
    const g = this.settlementGraphics;
    g.clear();
    this.settlementLabelsContainer.removeChildren();

    if (!settings.visibleLayers.settlements) return;

    for (const loc of locations) {
      if (!loc.coordinates || loc.coordinates.x <= 0) continue;

      const isDragged = draggedNode?.type === 'location' && draggedNode.id === loc.id;
      const coords = isDragged && transientPos ? transientPos : loc.coordinates;
      const { x, y } = coords;

      const isCapital = loc.category === 'capital';
      const isFortress = loc.category === 'stronghold';
      const isDungeon = loc.category === 'dungeon';

      const radius = isCapital ? 16 : isFortress ? 13 : 11;
      let fillColor: number = VINTAGE_PARCHMENT.fortressIron;
      if (isCapital) fillColor = VINTAGE_PARCHMENT.capitalGold;
      else if (isDungeon) fillColor = VINTAGE_PARCHMENT.dungeonCrimson;

      // Outer Shield / Roundel (the selection ring is drawn by the shared
      // overlay, so every kind of map object is highlighted the same way)
      g.circle(x, y, radius)
        .fill({ color: fillColor })
        .stroke({
          width: 2,
          color: VINTAGE_PARCHMENT.settlementBorder,
        });

      // Inner heraldic core
      g.circle(x, y, radius * 0.45).fill({
        color: 0xffffff,
      });

      // Settlement Name Plaque / Banner
      if (settings.visibleLayers.labels && loc.name) {
        const textStyle = new TextStyle({
          fontSize: isCapital ? 13 : 11,
          fontWeight: isCapital ? 'bold' : 'normal',
          fill: VINTAGE_PARCHMENT.labelText,
          fontFamily: 'serif',
        });

        const labelText = new Text({
          text: loc.name,
          style: textStyle,
        });
        labelText.anchor.set(0.5, 0);
        labelText.x = x;
        labelText.y = y + radius + 4;

        // Background banner rect
        const textW = labelText.width + 12;
        const textH = labelText.height + 4;
        g.roundRect(x - textW / 2, y + radius + 3, textW, textH, 4)
          .fill({ color: VINTAGE_PARCHMENT.labelBannerBg, alpha: 0.92 })
          .stroke({ width: 1, color: VINTAGE_PARCHMENT.labelBannerBorder });

        this.settlementLabelsContainer.addChild(labelText);
      }
    }
  }

  /**
   * 6. Placed Lore Pins (NPCs, Beasts, Relics)
   */
  private renderPlacements(placements: MapEntityPlacement[], settings: WorldMapSettings): void {
    const g = this.placementGraphics;
    g.clear();

    // Plan 21: pins are drawn in their own draw order, and a hidden pin is
    // simply not drawn (the category switch still applies on top of it).
    for (const p of orderPlacementsForRender(placements)) {
      if (!isObjectVisible(p)) continue;

      if (!isPlacementVisibleInLayers(p.entityType, settings.visibleLayers)) continue;

      let pinColor = 0x4f46e5;
      if (p.entityType === 'npc') pinColor = 0x3b82f6;
      else if (p.entityType === 'bestiary') pinColor = 0xdc2626;
      else if (p.entityType === 'artifact') pinColor = 0x9333ea;
      else if (p.entityType === 'deity') pinColor = 0xeab308;

      g.circle(p.x, p.y, 9)
        .fill({ color: pinColor })
        .stroke({ width: 1.5, color: 0xffffff });
    }
  }

  /**
   * Plan 23 — one visual language for every selected object.
   *
   * Each selected object gets a two-pass stroke: a wide cream halo that keeps
   * the marker readable on both the blue sea and the light paper, then a thin
   * amber line on top. Drawn in the interaction layer above all content, so a
   * selection is never buried by an object drawn later.
   */
  private renderSelectionOverlay(options: {
    selectionKeys: Set<string>;
    terrainFeatures: MapTerrainFeature[];
    placements: MapEntityPlacement[];
    locations: WorldLocation[];
    tradeRoutes: WorldTradeRoute[];
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    settings: WorldMapSettings;
  }): void {
    const g = this.selectionGraphics;
    g.clear();

    const {
      selectionKeys,
      terrainFeatures,
      placements,
      locations,
      tradeRoutes,
      draggedNode,
      transientPos,
      settings,
    } = options;
    if (selectionKeys.size === 0) return;

    const haloColor = VINTAGE_PARCHMENT.selectionHalo;
    const inkColor = VINTAGE_PARCHMENT.selectionInk;
    const HALO_WIDTH = 6;
    const INK_WIDTH = 2.2;

    const strokePolyline = (points: MapPoint[], closed: boolean) => {
      if (points.length < 2) return;
      const flat = points.flatMap((point) => [point.x, point.y]);
      if (closed) {
        g.poly(flat).stroke({ width: HALO_WIDTH, color: haloColor, alpha: 0.9 });
        g.poly(flat).stroke({ width: INK_WIDTH, color: inkColor });
        return;
      }
      for (const pass of [
        { width: HALO_WIDTH, color: haloColor, alpha: 0.9 },
        { width: INK_WIDTH, color: inkColor, alpha: 1 },
      ]) {
        g.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
        g.stroke({ width: pass.width, color: pass.color, alpha: pass.alpha, cap: 'round', join: 'round' });
      }
    };

    const strokeCircle = (x: number, y: number, radius: number) => {
      g.circle(x, y, radius).stroke({ width: HALO_WIDTH, color: haloColor, alpha: 0.9 });
      g.circle(x, y, radius).stroke({ width: INK_WIDTH, color: inkColor });
    };

    // Terrain: polygons, ink lines and point features.
    for (const feature of terrainFeatures) {
      if (!selectionKeys.has(mapObjectKey('terrain', feature.id))) continue;
      if (!isObjectVisible(feature)) continue;
      if (!isTerrainVisibleInLayers(feature.type, settings.visibleLayers)) continue;

      if (feature.polygon && feature.polygon.length >= 3) {
        strokePolyline(feature.polygon, true);
      } else if (feature.points && feature.points.length > 0) {
        strokePolyline(feature.points, false);
      } else if (typeof feature.x === 'number' && typeof feature.y === 'number') {
        strokeCircle(feature.x, feature.y, (feature.radius ?? 24) + 4);
      }
    }

    // Lore pins.
    for (const placement of placements) {
      if (!selectionKeys.has(mapObjectKey('placement', placement.id))) continue;
      if (!isObjectVisible(placement)) continue;
      if (!isPlacementVisibleInLayers(placement.entityType, settings.visibleLayers)) continue;
      strokeCircle(placement.x, placement.y, 15);
    }

    // Settlements (follow the transient position while a pin is being dragged).
    if (settings.visibleLayers.settlements) {
      for (const location of locations) {
        if (!selectionKeys.has(mapObjectKey('location', location.id))) continue;
        const coords =
          draggedNode?.type === 'location' && draggedNode.id === location.id && transientPos
            ? transientPos
            : location.coordinates;
        if (!coords) continue;
        strokeCircle(coords.x, coords.y, 19);
      }
    }

    // Trade routes (endpoints and waypoints follow a live drag).
    if (settings.visibleLayers.caravanRoutes) {
      for (const route of tradeRoutes) {
        if (!selectionKeys.has(mapObjectKey('trade_route', route.id))) continue;

        const origin = locations.find((l) => l.id === route.originLocationId)?.coordinates;
        const destination = locations.find((l) => l.id === route.destinationLocationId)?.coordinates;
        const originCoords =
          draggedNode?.type === 'location' &&
          draggedNode.id === route.originLocationId &&
          transientPos
            ? transientPos
            : origin;
        const destinationCoords =
          draggedNode?.type === 'location' &&
          draggedNode.id === route.destinationLocationId &&
          transientPos
            ? transientPos
            : destination;
        if (!originCoords || !destinationCoords) continue;

        const points: MapPoint[] = [originCoords];
        for (const [index, waypoint] of (route.waypoints ?? []).entries()) {
          const isDraggedWaypoint =
            draggedNode?.type === 'waypoint' &&
            draggedNode.routeId === route.id &&
            draggedNode.index === index &&
            transientPos;
          points.push(isDraggedWaypoint ? transientPos! : waypoint);
        }
        points.push(destinationCoords);
        strokePolyline(points, false);
      }
    }
  }

  /**
   * 7. Interactive In-Progress Drafting & Ruler Measurements
   */
  private renderInteraction(options: {
    draftPoints: MapPoint[];
    rulerPoints: MapPoint[];
    activeTool: CartographerTool;
    isPersian: boolean;
  }): void {
    const { draftPoints, rulerPoints, activeTool } = options;
    const g = this.interactionGraphics;
    g.clear();

    // In-Progress Drafting Line / Polygon Preview
    if (draftPoints.length > 0) {
      g.moveTo(draftPoints[0].x, draftPoints[0].y);
      for (let i = 1; i < draftPoints.length; i++) {
        g.lineTo(draftPoints[i].x, draftPoints[i].y);
      }
      g.stroke({
        width: 2.5,
        color: 0x3b82f6,
      });

      for (const pt of draftPoints) {
        g.circle(pt.x, pt.y, 4).fill({ color: 0x3b82f6 });
      }
    }

    // Distance Ruler Measurement
    if (rulerPoints.length === 2) {
      const p1 = rulerPoints[0];
      const p2 = rulerPoints[1];

      g.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({
        width: 2,
        color: 0xd97706,
      });
      g.circle(p1.x, p1.y, 5).fill({ color: 0xd97706 });
      g.circle(p2.x, p2.y, 5).fill({ color: 0xd97706 });
    }
  }

  /**
   * Real-time 60fps brush stroke preview overlay during continuous dragging
   */
  public renderBrushPreview(stamps: MapPoint[][], mode: 'paint' | 'carve'): void {
    const g = this.brushGraphics;
    g.clear();

    if (stamps.length === 0) return;

    for (const stamp of stamps) {
      if (stamp.length < 3) continue;
      const flat: number[] = [];
      for (const pt of stamp) {
        flat.push(pt.x, pt.y);
      }

      if (mode === 'paint') {
        g.poly(flat)
          .fill({ color: VINTAGE_PARCHMENT.landFill, alpha: 0.85 })
          .stroke({ width: 2.0, color: VINTAGE_PARCHMENT.coastlineInk, alpha: 0.9 });
      } else {
        // Carve mode: ocean wash with warning stroke
        g.poly(flat)
          .fill({ color: VINTAGE_PARCHMENT.oceanWash, alpha: 0.9 })
          .stroke({ width: 2.0, color: 0xdc2626, alpha: 0.8 });
      }
    }
  }

  /**
   * Real-time brush cursor reticle matching brush size
   */
  public renderBrushCursor(
    point: MapPoint | null,
    radius: number,
    mode: 'paint' | 'carve'
  ): void {
    const g = this.brushCursorGraphics;
    g.clear();

    if (!point) return;

    const strokeColor = mode === 'paint' ? VINTAGE_PARCHMENT.coastlineInk : 0xdc2626;

    // Outer guide circle
    g.circle(point.x, point.y, radius).stroke({
      width: 1.5,
      color: strokeColor,
      alpha: 0.65,
    });

    // Center reticle dot
    g.circle(point.x, point.y, 2.5).fill({
      color: strokeColor,
      alpha: 0.8,
    });
  }

  /**
   * Clears transient real-time brush stroke preview
   */
  public clearBrushPreview(): void {
    this.brushGraphics.clear();
  }

  /**
   * Clears brush cursor reticle
   */
  public clearBrushCursor(): void {
    this.brushCursorGraphics.clear();
  }

  /**
   * Cleans up PixiJS application and graphics on component unmount
   */
  public destroy(): void {
    this.textureLibrary.destroy();
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.isInitialized = false;
  }
}
