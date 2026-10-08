/**
 * PixiCartographerEngine: Hardware-accelerated WebGL 2D Cartography Viewport
 * Implements Phase 1 of the Inkarnate-class fantasy map maker.
 * Renders high-performance interactive maps with the Classic Parchment / Vintage Fantasy aesthetic.
 */

import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import {
  WorldBible,
  WorldMapSettings,
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  NPCDossier,
  MapPoint,
} from '@/lib/types';
import { SelectedMapItem } from '@/components/cartographer/CartographerInspector';
import { CartographerTool } from '@/components/cartographer/CartographerHeader';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { PixiSpatialIndex, SpatialItem } from './PixiSpatialIndex';
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

  // Text label containers to recycle
  private settlementLabelsContainer = new Container();

  // Spatial Index for sub-millisecond point hit-testing
  public spatialIndex = new PixiSpatialIndex();

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
    this.interactionLayer.addChild(this.interactionGraphics);
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
  public renderAll(options: {
    worldBible: WorldBible;
    settings: WorldMapSettings;
    selectedItem: SelectedMapItem;
    activeTool: CartographerTool;
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    draftPoints: MapPoint[];
    rulerPoints: MapPoint[];
    isPersian: boolean;
  }): void {
    if (!this.isInitialized) return;

    const {
      worldBible,
      settings,
      selectedItem,
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
    const npcs = worldBible.npcs || [];

    // 1. Re-index interactive spatial elements
    this.rebuildSpatialIndex(locations, tradeRoutes, terrainFeatures);

    // 2. Render Background & Vintage Frame
    this.renderBackground(settings);

    // 3. Render Grid (Square / Hex / None)
    this.renderGrid(settings);

    // 4. Render Continents, Biomes, Rivers, Mountains
    this.renderTerrain(terrainFeatures, settings);

    // 5. Render Trade Routes & Waypoints
    this.renderRoutes({
      tradeRoutes,
      locations,
      selectedItem,
      draggedNode,
      transientPos,
      settings,
    });

    // 6. Render Settlements & Heraldic Labels
    this.renderSettlements({
      locations,
      npcs,
      selectedItem,
      draggedNode,
      transientPos,
      settings,
      isPersian,
    });

    // 7. Render Placed Lore Pins
    this.renderPlacements(placements, settings);

    // 8. Render Active Interaction Tools (Drafting & Ruler)
    this.renderInteraction({
      draftPoints,
      rulerPoints,
      activeTool,
      isPersian,
    });
  }

  /**
   * Rebuilds the RBush spatial index for hit testing
   */
  private rebuildSpatialIndex(
    locations: WorldLocation[],
    tradeRoutes: WorldTradeRoute[],
    terrainFeatures: MapTerrainFeature[]
  ): void {
    this.spatialIndex.clear();
    const spatialItems: SpatialItem[] = [];

    // Index Locations
    for (const loc of locations) {
      if (loc.coordinates && loc.coordinates.x > 0) {
        spatialItems.push({
          id: loc.id,
          type: 'location',
          minX: loc.coordinates.x - 24,
          minY: loc.coordinates.y - 24,
          maxX: loc.coordinates.x + 24,
          maxY: loc.coordinates.y + 24,
          data: loc,
        });
      }
    }

    // Index Trade Route Waypoints
    for (const route of tradeRoutes) {
      if (route.waypoints) {
        route.waypoints.forEach((wp, idx) => {
          spatialItems.push({
            id: `wp_${route.id}_${idx}`,
            type: 'waypoint',
            minX: wp.x - 12,
            minY: wp.y - 12,
            maxX: wp.x + 12,
            maxY: wp.y + 12,
            data: { routeId: route.id, index: idx, point: wp },
          });
        });
      }
    }

    // Index Terrain Features
    for (const terr of terrainFeatures) {
      if (terr.x && terr.y) {
        const r = terr.radius || 30;
        spatialItems.push({
          id: terr.id,
          type: 'terrain',
          minX: terr.x - r,
          minY: terr.y - r,
          maxX: terr.x + r,
          maxY: terr.y + r,
          data: terr,
        });
      }
    }

    this.spatialIndex.load(spatialItems);
  }

  /**
   * 1. Background & Aged Papyrus Wash
   */
  private renderBackground(settings: WorldMapSettings): void {
    const g = this.bgGraphics;
    g.clear();

    // Ocean wash
    g.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).fill({
      color: VINTAGE_PARCHMENT.oceanWash,
    });

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
   */
  private renderTerrain(terrainFeatures: MapTerrainFeature[], settings: WorldMapSettings): void {
    const g = this.terrainGraphics;
    g.clear();

    // A. Continents & Islands (Landmasses)
    if (settings.visibleLayers.terrain) {
      for (const feat of terrainFeatures) {
        if ((feat.type === 'continent' || feat.type === 'island') && feat.polygon && feat.polygon.length > 2) {
          const points = generateOrganicParchmentContours(feat.polygon, 3);
          const flatPoints: number[] = [];
          for (const pt of points) {
            flatPoints.push(pt.x, pt.y);
          }

          // Land fill
          g.poly(flatPoints).fill({
            color: VINTAGE_PARCHMENT.landFill,
          });

          // Hand-inked primary coastline
          g.poly(flatPoints).stroke({
            width: 2.2,
            color: VINTAGE_PARCHMENT.coastlineInk,
          });

          // Outer coastline echo ring (vintage contour stippling effect)
          g.poly(flatPoints).stroke({
            width: 5,
            color: VINTAGE_PARCHMENT.coastlineGlow,
            alpha: 0.4,
          });
        }
      }
    }

    // B. Biomes (Forests, Swamps, Deserts)
    if (settings.visibleLayers.biomes) {
      for (const feat of terrainFeatures) {
        if (
          (feat.type === 'forest' || feat.type === 'desert' || feat.type === 'swamp' || feat.type === 'tundra') &&
          feat.polygon &&
          feat.polygon.length > 2
        ) {
          const flatPoints: number[] = [];
          for (const pt of feat.polygon) {
            flatPoints.push(pt.x, pt.y);
          }

          let color: number = VINTAGE_PARCHMENT.biomeForest;
          if (feat.type === 'desert') color = VINTAGE_PARCHMENT.biomeDesert;
          else if (feat.type === 'swamp') color = VINTAGE_PARCHMENT.biomeSwamp;
          else if (feat.type === 'tundra') color = VINTAGE_PARCHMENT.biomeTundra;

          g.poly(flatPoints)
            .fill({ color, alpha: 0.35 })
            .stroke({ width: 1, color, alpha: 0.6 });
        }
      }
    }

    // C. Lakes & Inland Waters
    if (settings.visibleLayers.water) {
      for (const feat of terrainFeatures) {
        if (feat.type === 'lake' && feat.polygon && feat.polygon.length > 2) {
          const flatPoints: number[] = [];
          for (const pt of feat.polygon) {
            flatPoints.push(pt.x, pt.y);
          }

          g.poly(flatPoints)
            .fill({ color: VINTAGE_PARCHMENT.oceanWash })
            .stroke({ width: 1.5, color: VINTAGE_PARCHMENT.coastlineInk });
        }
      }
    }

    // D. Winding Rivers (Antique Blue-Gray Ink)
    if (settings.visibleLayers.water) {
      for (const feat of terrainFeatures) {
        if (feat.type === 'river' && feat.points && feat.points.length > 1) {
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
      }
    }

    // E. Mountain Ranges & Hand-Inked Peaks
    if (settings.visibleLayers.mountains) {
      for (const feat of terrainFeatures) {
        // Ridge line
        if (feat.type === 'mountain_range' && feat.points && feat.points.length > 1) {
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
          g.stroke({
            width: 3,
            color: VINTAGE_PARCHMENT.mountainInk,
            cap: 'round',
          });
        }

        // Distinct Peaks & Summits (Woodcut Engraving Style)
        if (feat.type === 'peak' || feat.type === 'volcano') {
          const x = feat.x || 0;
          const y = feat.y || 0;
          const r = feat.radius || 30;

          // Main Mountain Triangle
          g.poly([x, y - r, x - r * 0.8, y + r * 0.7, x + r * 0.8, y + r * 0.7])
            .fill({ color: feat.type === 'volcano' ? 0x7f1d1d : VINTAGE_PARCHMENT.landFill })
            .stroke({ width: 2, color: VINTAGE_PARCHMENT.mountainInk });

          // Shaded Eastern Slope
          g.poly([x, y - r, x, y + r * 0.7, x + r * 0.8, y + r * 0.7]).fill({
            color: VINTAGE_PARCHMENT.mountainShade,
            alpha: 0.5,
          });

          // Snowcap
          g.poly([x, y - r, x - r * 0.3, y - r * 0.3, x + r * 0.3, y - r * 0.3]).fill({
            color: VINTAGE_PARCHMENT.mountainSnowcap,
          });
        }
      }
    }
  }

  /**
   * 4. Caravan Trails & Trade Routes
   */
  private renderRoutes(options: {
    tradeRoutes: WorldTradeRoute[];
    locations: WorldLocation[];
    selectedItem: SelectedMapItem;
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    settings: WorldMapSettings;
  }): void {
    const { tradeRoutes, locations, selectedItem, draggedNode, transientPos, settings } = options;
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

      const isSelected = selectedItem?.type === 'trade_route' && selectedItem.data.id === route.id;

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
    npcs: NPCDossier[];
    selectedItem: SelectedMapItem;
    draggedNode: DraggedNodeData | null;
    transientPos: MapPoint | null;
    settings: WorldMapSettings;
    isPersian: boolean;
  }): void {
    const { locations, npcs, selectedItem, draggedNode, transientPos, settings } = options;
    const g = this.settlementGraphics;
    g.clear();
    this.settlementLabelsContainer.removeChildren();

    if (!settings.visibleLayers.settlements) return;

    for (const loc of locations) {
      if (!loc.coordinates || loc.coordinates.x <= 0) continue;

      const isDragged = draggedNode?.type === 'location' && draggedNode.id === loc.id;
      const coords = isDragged && transientPos ? transientPos : loc.coordinates;
      const { x, y } = coords;

      const isSelected = selectedItem?.type === 'location' && selectedItem.data.id === loc.id;
      const isCapital = loc.category === 'capital';
      const isFortress = loc.category === 'stronghold';
      const isDungeon = loc.category === 'dungeon';

      const radius = isCapital ? 16 : isFortress ? 13 : 11;
      let fillColor: number = VINTAGE_PARCHMENT.fortressIron;
      if (isCapital) fillColor = VINTAGE_PARCHMENT.capitalGold;
      else if (isDungeon) fillColor = VINTAGE_PARCHMENT.dungeonCrimson;

      // Selection Aura
      if (isSelected) {
        g.circle(x, y, radius + 8).stroke({
          width: 2.5,
          color: VINTAGE_PARCHMENT.caravanWaypoint,
        });
      }

      // Outer Shield / Roundel
      g.circle(x, y, radius)
        .fill({ color: fillColor })
        .stroke({
          width: 2,
          color: isSelected ? 0xffffff : VINTAGE_PARCHMENT.settlementBorder,
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

    for (const p of placements) {
      let isVisible = true;
      let pinColor = 0x4f46e5;

      if (p.entityType === 'npc') {
        isVisible = settings.visibleLayers.npcs;
        pinColor = 0x3b82f6;
      } else if (p.entityType === 'bestiary') {
        isVisible = settings.visibleLayers.bestiary;
        pinColor = 0xdc2626;
      } else if (p.entityType === 'artifact') {
        isVisible = settings.visibleLayers.relics;
        pinColor = 0x9333ea;
      } else if (p.entityType === 'deity') {
        isVisible = settings.visibleLayers.deities;
        pinColor = 0xeab308;
      }

      if (!isVisible) continue;

      g.circle(p.x, p.y, 9)
        .fill({ color: pinColor })
        .stroke({ width: 1.5, color: 0xffffff });
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
   * Cleans up PixiJS application and graphics on component unmount
   */
  public destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.isInitialized = false;
  }
}
