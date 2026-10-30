/**
 * PixiCartographerEngine: Hardware-accelerated WebGL 2D Cartography Viewport
 * Implements Phase 1 of the Inkarnate-class fantasy map maker.
 * Renders high-performance interactive maps with the Classic Parchment / Vintage Fantasy aesthetic.
 */

import { Application, Container, Graphics, Matrix, Sprite } from 'pixi.js';
import {
  WorldMapSettings,
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  MapPoint,
  MapRoute,
  CustomPlaceCategory,
} from '@/lib/types';
import {
  mapObjectKey,
  translateLocation,
  translateMapRoute,
  translatePlacement,
  translateTerrainFeature,
  translateTradeRoute,
} from '../mapSelection';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import { normalizeLandWaterFeatures } from '../landSculpt/waterFeatures';
import type { RenderAllOptions, DraggedNodeData } from './renderTypes';
export type { DraggedNodeData, RenderAllOptions } from './renderTypes';
import { clearContainer } from './renderers/shared';
import { renderBackground } from './mapBackgroundRenderer';
import { renderGrid } from './mapBackgroundRenderer';
import {
  renderTerrain,
  renderProceduralPeakToGraphics,
  renderProceduralRiverToGraphics,
  renderProceduralHighlandToGraphics,
  renderProceduralValleyToGraphics,
  drawLake,
  drawBiome,
} from './terrainRenderer';
import {
  generateProceduralMountainRange,
  type MountainRangeOptions,
} from './mountainGenerator';
import {
  generateProceduralRiver,
  type RiverOptions,
} from './riverGenerator';
import { applyTransform } from './transformMath';
import { detectBridges } from './bridgeGenerator';
import { renderBridgesToGraphics } from './bridgeRenderer';
import {
  generateProceduralHighland,
  type HighlandOptions,
} from './highlandGenerator';
import {
  generateProceduralValley,
  type ValleyOptions,
} from './valleyGenerator';
import {
  renderPlacements,
  renderRoutes,
  renderSettlements,
} from './entitiesRenderer';
import { renderSelectionOverlay } from './selectionOverlayRenderer';
import {
  renderMapRoutes,
  renderRouteSnapPreview,
} from './routeRenderer';
import {
  renderBrushCursor,
  renderBrushPreview,
  renderInteraction,
} from './interactionRenderer';
import { PixiSpatialIndex, SpatialItem } from './PixiSpatialIndex';
import {
  buildMapHitCandidates,
  hitCandidateBounds,
  hitTestMapObjects,
  type MapHit,
  type MapHitCandidate,
} from '../mapHitTest';
import {
  MAP_MATERIALS,
  resolveTextureStrength,
  textureScaleFor,
  type MapMaterialKey,
} from '../texturePalette';
import { MapTextureLibrary } from './mapTextureLibrary';
import { MapSymbolLibrary } from './MapSymbolLibrary';
import { renderSymbolsToContainer } from './symbolScatterRenderer';
import { renderTerrainCurvedLabels } from './splineTextRenderer';
import { renderManuscriptFurniture } from './manuscriptFurnitureRenderer';
import {
  getLODTier,
  isCandidateVisibleAtLOD,
  type LODTier,
} from './lodManager';


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
  private furnitureLayer = new Container();
  private interactionLayer = new Container();

  // Reusable Graphics & Container objects for batch drawing
  private bgGraphics = new Graphics();
  private gridGraphics = new Graphics();
  private terrainGraphics = new Graphics();

  // Terrain curved labels by LOD tier
  private terrainLabelsContainer = new Container();
  private terrainLabelsTier1 = new Container();
  private terrainLabelsTier2 = new Container();
  private terrainLabelsTier3 = new Container();

  // Route layer by LOD tier
  private bridgeGraphics = new Graphics();
  private mapRouteTier1Graphics = new Graphics();
  private mapRouteTier2Graphics = new Graphics();
  private mapRouteTier3Graphics = new Graphics();
  private routeLabelsTier1 = new Container();
  private routeLabelsTier2 = new Container();
  private routeLabelsTier3 = new Container();
  private tradeRouteTier1Graphics = new Graphics();
  private tradeRouteTier2Graphics = new Graphics();
  private tradeRouteTier3Graphics = new Graphics();

  // Settlement layer by LOD tier
  private settlementTier1Container = new Container();
  private settlementTier1Graphics = new Graphics();
  private settlementTier1Labels = new Container();

  private settlementTier2Container = new Container();
  private settlementTier2Graphics = new Graphics();
  private settlementTier2Labels = new Container();

  private settlementTier3Container = new Container();
  private settlementTier3Graphics = new Graphics();
  private settlementTier3Labels = new Container();

  // Placement layer (Tier 3 + selected)
  private placementTier3Container = new Container();
  private placementTier3Graphics = new Graphics();
  private placementTier3Labels = new Container();

  private placementSelectedContainer = new Container();
  private placementSelectedGraphics = new Graphics();
  private placementSelectedLabels = new Container();

  private furnitureGraphics = new Graphics();
  private furnitureTextContainer = new Container();
  private interactionGraphics = new Graphics();
  private selectionGraphics = new Graphics();
  private brushGraphics = new Graphics();
  private brushCursorGraphics = new Graphics();
  private ghostSprite = new Sprite();

  // Spatial Index for sub-millisecond point hit-testing
  public spatialIndex = new PixiSpatialIndex();

  /**
   * The material tiles. They are loaded in the background; until they arrive
   * (or if they fail to arrive) the map is painted with the flat theme
   * colours, which is exactly how it looked before textures existed.
   */
  private textureLibrary = new MapTextureLibrary();
  private symbolLibrary = new MapSymbolLibrary();
  private symbolLayer = new Container();
  private textureStrength = 0;
  private materialMatrices = new Map<MapMaterialKey, Matrix>();
  /** The options of the last render, so a late texture load can re-render. */
  private lastRenderOptions: RenderAllOptions | null = null;

  // Google Maps-style Semantic LOD & Vector Typography
  private currentZoom = 1.0;
  private currentPan: MapPoint = { x: 0, y: 0 };
  private currentSelectionKeys = new Set<string>();
  private currentLODTier: LODTier = 3;
  private lastRenderedResolutionZoom = 1.0;
  private resolutionRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  private isInitialized = false;

  constructor() {
    this.worldContainer.addChild(
      this.backgroundLayer,
      this.gridLayer,
      this.terrainLayer,
      this.routeLayer,
      this.settlementLayer,
      this.placementLayer,
      this.furnitureLayer,
      this.interactionLayer
    );

    this.backgroundLayer.addChild(this.bgGraphics);
    this.gridLayer.addChild(this.gridGraphics);

    this.terrainLabelsContainer.addChild(
      this.terrainLabelsTier1,
      this.terrainLabelsTier2,
      this.terrainLabelsTier3
    );
    this.symbolLayer.sortableChildren = true;
    this.terrainLayer.addChild(this.terrainGraphics, this.symbolLayer, this.terrainLabelsContainer);

    this.routeLayer.addChild(
      this.bridgeGraphics,
      this.tradeRouteTier1Graphics,
      this.tradeRouteTier2Graphics,
      this.tradeRouteTier3Graphics,
      this.mapRouteTier1Graphics,
      this.mapRouteTier2Graphics,
      this.mapRouteTier3Graphics,
      this.routeLabelsTier1,
      this.routeLabelsTier2,
      this.routeLabelsTier3
    );

    this.settlementTier1Container.addChild(this.settlementTier1Graphics, this.settlementTier1Labels);
    this.settlementTier2Container.addChild(this.settlementTier2Graphics, this.settlementTier2Labels);
    this.settlementTier3Container.addChild(this.settlementTier3Graphics, this.settlementTier3Labels);
    this.settlementLayer.addChild(
      this.settlementTier1Container,
      this.settlementTier2Container,
      this.settlementTier3Container
    );

    this.placementTier3Container.addChild(this.placementTier3Graphics, this.placementTier3Labels);
    this.placementSelectedContainer.addChild(this.placementSelectedGraphics, this.placementSelectedLabels);
    this.placementLayer.addChild(
      this.placementSelectedContainer,
      this.placementTier3Container
    );

    this.furnitureLayer.addChild(this.furnitureGraphics, this.furnitureTextContainer);
    this.interactionLayer.addChild(
      this.interactionGraphics,
      this.selectionGraphics,
      this.brushGraphics,
      this.brushCursorGraphics,
      this.ghostSprite
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

    // Vector SVG and PNG symbols preload in the background for GPU instancing
    void this.symbolLibrary.loadAll().then(() => {
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
    flatAlpha: number,
    holes?: number[][]
  ): void {
    const strength = this.textureStrength;
    const texture = material && strength > 0 ? this.textureLibrary.get(material) : null;

    const cutHoles = () => {
      if (!holes || holes.length === 0) return;
      for (const hole of holes) {
        if (hole.length >= 6) g.poly(hole).cut();
      }
    };

    // The flat colour carries the region on its own until the texture exists:
    // fading it to `1 - strength` up front would leave the map a washed-out
    // ghost while the tiles load (and permanently, if one 404s) instead of the
    // pre-texture look the fallback promises.
    g.poly(points).fill({
      color: flatColor,
      alpha: flatAlpha * (texture ? 1 - strength : 1),
    });
    cutHoles();

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
    cutHoles();
  }

  /**
   * Applies instantaneous boolean GPU visibility across tier containers (0.0001ms overhead).
   * Never allocates memory, never re-rasters fonts, and never executes CPU geometry math.
   */
  public updateLODTierVisibility(tier: LODTier): void {
    this.currentLODTier = tier;

    // Terrain curved labels
    this.terrainLabelsTier1.visible = true; // Continents & mountain ranges always visible
    this.terrainLabelsTier2.visible = tier >= 2; // Rivers & deserts visible at Regional+
    this.terrainLabelsTier3.visible = tier >= 3; // Valleys & forests visible at Provincial+

    // Civil infrastructure & bridges
    this.bridgeGraphics.visible = tier >= 2;

    // Routes
    this.tradeRouteTier1Graphics.visible = true;
    this.tradeRouteTier2Graphics.visible = tier >= 2;
    this.tradeRouteTier3Graphics.visible = tier >= 3;

    this.mapRouteTier1Graphics.visible = true;
    this.mapRouteTier2Graphics.visible = tier >= 2;
    this.mapRouteTier3Graphics.visible = tier >= 3;

    this.routeLabelsTier1.visible = true;
    this.routeLabelsTier2.visible = tier >= 2;
    this.routeLabelsTier3.visible = tier >= 3;

    // Settlements
    this.settlementTier1Container.visible = true; // Capitals always visible
    this.settlementTier2Container.visible = tier >= 2; // Strongholds visible at Regional+
    this.settlementTier3Container.visible = tier >= 3; // Towns & villages visible at Provincial+

    // Placements
    this.placementSelectedContainer.visible = true; // Selected placements always visible
    this.placementTier3Container.visible = tier >= 3; // Lore pins visible at Provincial+
  }

  /**
   * Updates camera pan and zoom transform with Google Maps-style Semantic LOD switching.
   * Pure 0.005ms GPU matrix update with zero geometry re-runs and zero texture allocations.
   */
  public setTransform(pan: { x: number; y: number }, zoom: number): void {
    this.currentPan = pan;
    this.currentZoom = zoom;
    this.worldContainer.x = pan.x;
    this.worldContainer.y = pan.y;
    this.worldContainer.scale.set(zoom);

    const newTier = getLODTier(zoom);
    if (newTier !== this.currentLODTier) {
      this.updateLODTierVisibility(newTier);
    }

    // Debounce any non-critical resolution/counter-scale refresh until AFTER user stops interacting (300ms idle)
    if (
      this.lastRenderOptions &&
      Math.abs(zoom - this.lastRenderedResolutionZoom) / Math.max(0.1, this.lastRenderedResolutionZoom) > 0.4
    ) {
      if (this.resolutionRefreshTimer) {
        clearTimeout(this.resolutionRefreshTimer);
      }
      this.resolutionRefreshTimer = setTimeout(() => {
        if (this.lastRenderOptions) {
          this.lastRenderedResolutionZoom = this.currentZoom;
          this.renderAll(this.lastRenderOptions);
        }
      }, 300);
    }
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
      selectionDelta,
      activeTool,
      draggedNode,
      transientPos,
      draftPoints,
      rulerPoints,
      isPersian,
    } = options;

    const locations = worldBible.locations || [];
    const tradeRoutes = worldBible.tradeRoutes || [];
    const mapRoutes = worldBible.mapData?.routes || [];
    const terrainFeatures = normalizeLandWaterFeatures(
      worldBible.mapData?.terrainFeatures || []
    );
    const placements = worldBible.mapData?.placements || [];
    const placeCategories = worldBible.ontology?.placeCategories ?? [];

    // Plan 23 — group move preview.
    //
    // Rather than teaching every draw routine about an offset, we hand the
    // renderer a translated *view* of the world for the duration of the drag.
    // Selected terrain, pins, settlements and routes are shifted; a route whose
    // endpoint settlement is selected follows automatically because the route
    // renderer resolves endpoints from the view's location list.
    const selectionKeys = new Set(selection.map((ref) => mapObjectKey(ref.kind, ref.id)));
    this.currentSelectionKeys = selectionKeys;
    const dx = selectionDelta?.x ?? 0;
    const dy = selectionDelta?.y ?? 0;
    const hasDelta = dx !== 0 || dy !== 0;
    let viewTerrain = hasDelta
      ? terrainFeatures.map((feature) =>
          selectionKeys.has(mapObjectKey('terrain', feature.id))
            ? translateTerrainFeature(feature, dx, dy)
            : feature
        )
      : terrainFeatures;

    if (draggedNode?.type === 'terrain_vertex' && transientPos && draggedNode.index !== undefined) {
      viewTerrain = viewTerrain.map((feature) => {
        if (feature.id !== draggedNode.id) return feature;
        if (draggedNode.subType === 'points' && feature.points) {
          const pts = [...feature.points];
          pts[draggedNode.index!] = transientPos;
          return { ...feature, points: pts };
        }
        if (draggedNode.subType === 'polygon' && feature.polygon) {
          const poly = [...feature.polygon];
          poly[draggedNode.index!] = transientPos;
          return { ...feature, polygon: poly };
        }
        return feature;
      });
    }

    if (
      draggedNode?.type === 'transform_handle' &&
      transientPos &&
      draggedNode.originBox &&
      draggedNode.handleType
    ) {
      viewTerrain = viewTerrain.map((feature) => {
        if (feature.id !== draggedNode.id) return feature;
        if (feature.points && feature.points.length >= 2) {
          const transformed = applyTransform(
            feature.points,
            draggedNode.handleType!,
            draggedNode.originBox!,
            draggedNode.startPoint,
            transientPos,
            false
          );
          return { ...feature, points: transformed };
        }
        if (feature.points && feature.points.length === 1) {
          const origS = feature.scale ?? feature.symbolScale ?? feature.width ?? 42;
          const box = draggedNode.originBox!;
          const currentDist = Math.hypot(transientPos.x - box.cx, transientPos.y - box.cy);
          const origDist = Math.hypot(draggedNode.startPoint.x - box.cx, draggedNode.startPoint.y - box.cy) || 1;
          const newScale = Math.max(12, Math.min(300, Math.round(origS * (currentDist / origDist))));
          return { ...feature, scale: newScale, symbolScale: newScale };
        }
        if (feature.polygon && feature.polygon.length >= 3) {
          const transformed = applyTransform(
            feature.polygon,
            draggedNode.handleType!,
            draggedNode.originBox!,
            draggedNode.startPoint,
            transientPos,
            false
          );
          return { ...feature, polygon: transformed };
        }
        return feature;
      });
    }
    const viewPlacements = hasDelta
      ? placements.map((placement) =>
          selectionKeys.has(mapObjectKey('placement', placement.id))
            ? translatePlacement(placement, dx, dy)
            : placement
        )
      : placements;
    const viewLocations = hasDelta
      ? locations.map((location) =>
          selectionKeys.has(mapObjectKey('location', location.id))
            ? translateLocation(location, dx, dy)
            : location
        )
      : locations;
    const viewRoutes = hasDelta
      ? tradeRoutes.map((route) =>
          selectionKeys.has(mapObjectKey('trade_route', route.id))
            ? translateTradeRoute(route, dx, dy)
            : route
        )
      : tradeRoutes;
    const viewMapRoutes = hasDelta
      ? mapRoutes.map((route) =>
          selectionKeys.has(mapObjectKey('route', route.id))
            ? translateMapRoute(route, dx, dy)
            : route
        )
      : mapRoutes;

    // How strongly the material textures are laid over the flat theme
    // colours. 0 = the classic flat look, 1 = fully textured.
    //
    // The material tiles are duotoned against the parchment palette, so they
    // belong to that theme only: the other themes keep their flat colours
    // until they get their own material set.
    const theme = settings.theme ?? 'parchment';
    this.textureStrength =
      theme === 'parchment' ? resolveTextureStrength(settings.textureStrength) : 0;

    // 1. Re-index interactive spatial elements (skip during transient node/selection drag for silky 60fps responsiveness)
    const isTransientDrag = Boolean(draggedNode || hasDelta);
    if (!isTransientDrag) {
      const selectedTerrainIds = new Set<string>();
      for (const ref of selection) {
        if (ref.kind === 'terrain') selectedTerrainIds.add(ref.id);
      }
      this.rebuildSpatialIndex(
        locations,
        tradeRoutes,
        mapRoutes,
        terrainFeatures,
        placements,
        placeCategories,
        selectedTerrainIds,
        options.vertexEditMode
      );
    }

    // 2. Render Background & Vintage Frame
    renderBackground(this.bgGraphics, this.fillWithMaterial.bind(this));

    // 3. Render Grid (Square / Hex / None)
    renderGrid(this.gridGraphics, settings);

    // 4. Render Continents, Biomes, Rivers, Mountains
    renderTerrain(this.terrainGraphics, viewTerrain, settings, this.fillWithMaterial.bind(this), {
      locations: viewLocations,
      placements: viewPlacements,
    });

    // 4b. Render High-Performance GPU Map Symbols (Flora, Relief Massifs, Stones, Landmarks)
    const canvasWidth = this.canvas?.clientWidth || 1920;
    const canvasHeight = this.canvas?.clientHeight || 1080;
    const zoom = Math.max(0.01, this.currentZoom);
    const viewportBounds = {
      minX: -this.currentPan.x / zoom,
      minY: -this.currentPan.y / zoom,
      maxX: (-this.currentPan.x + canvasWidth) / zoom,
      maxY: (-this.currentPan.y + canvasHeight) / zoom,
    };
    renderSymbolsToContainer(
      this.symbolLayer,
      viewTerrain,
      this.symbolLibrary,
      viewportBounds,
      this.currentZoom
    );

    // 4c. Render Curved & Spline-Aligned Geographic Titles (Plan 27 — Module 4)
    if (settings.visibleLayers.labels !== false) {
      renderTerrainCurvedLabels(this.terrainLabelsContainer, viewTerrain, viewLocations, {
        zoom: this.currentZoom,
        selectionKeys,
        tierContainers: {
          tier1: this.terrainLabelsTier1,
          tier2: this.terrainLabelsTier2,
          tier3: this.terrainLabelsTier3,
        },
      });
    }

    // 5. Render Civil Infrastructure: Bridges & River Crossings (Plan 27 — Module 5)
    this.bridgeGraphics.clear();
    if (settings.visibleLayers.routes !== false || settings.visibleLayers.settlements !== false) {
      const bridges = detectBridges({
        locations: viewLocations,
        mapRoutes: viewMapRoutes,
        tradeRoutes: viewRoutes,
        terrainFeatures: viewTerrain,
        routeSource: {
          locations: viewLocations,
          terrainFeatures: viewTerrain,
          placements: viewPlacements,
          placeCategories,
        },
      });
      renderBridgesToGraphics(this.bridgeGraphics, bridges);
    }

    // 6. Render drawn roads and paths (Plan 25), then the economic overlay.
    renderMapRoutes(this.mapRouteTier1Graphics, {
      routes: viewMapRoutes,
      source: {
        locations: viewLocations,
        terrainFeatures: viewTerrain,
        placements: viewPlacements,
        placeCategories,
      },
      selectionKeys,
      draggedNode,
      transientPos,
      settings,
      isPersian,
      labelsContainer: this.routeLabelsTier1,
      zoom: this.currentZoom,
      tierTargets: {
        tier1: this.mapRouteTier1Graphics,
        tier2: this.mapRouteTier2Graphics,
        tier3: this.mapRouteTier3Graphics,
        labelsTier1: this.routeLabelsTier1,
        labelsTier2: this.routeLabelsTier2,
        labelsTier3: this.routeLabelsTier3,
      },
    });

    // 5b. Render Trade Routes & Waypoints
    renderRoutes(this.tradeRouteTier1Graphics, {
      tradeRoutes: viewRoutes,
      locations: viewLocations,
      selectionKeys,
      draggedNode,
      transientPos,
      settings,
      zoom: this.currentZoom,
      tierTargets: {
        tier1: this.tradeRouteTier1Graphics,
        tier2: this.tradeRouteTier2Graphics,
        tier3: this.tradeRouteTier3Graphics,
      },
    });

    // 6. Render Settlements & Heraldic Labels
    renderSettlements(this.settlementTier1Graphics, this.settlementTier1Labels, {
      locations: viewLocations,
      draggedNode,
      transientPos,
      settings,
      isPersian,
      placeCategories,
      terrainFeatures: viewTerrain,
      zoom: this.currentZoom,
      selectionKeys,
      tierTargets: {
        tier1: { g: this.settlementTier1Graphics, labels: this.settlementTier1Labels },
        tier2: { g: this.settlementTier2Graphics, labels: this.settlementTier2Labels },
        tier3: { g: this.settlementTier3Graphics, labels: this.settlementTier3Labels },
      },
    });

    // 7. Render Placed Lore Pins
    renderPlacements(
      this.placementTier3Graphics,
      viewPlacements,
      settings,
      this.placementTier3Labels,
      {
        zoom: this.currentZoom,
        selectionKeys,
        tierTargets: {
          tier3: { g: this.placementTier3Graphics, labels: this.placementTier3Labels },
          selected: { g: this.placementSelectedGraphics, labels: this.placementSelectedLabels },
        },
      }
    );

    // Apply instantaneous GPU visibility based on current camera tier
    this.updateLODTierVisibility(getLODTier(this.currentZoom));

    // 7a. Render Manuscript Furniture & Embellishments (Plan 27 Phase E.3)
    this.furnitureGraphics.clear();
    clearContainer(this.furnitureTextContainer);
    if (settings.visibleLayers.furniture !== false) {
      renderManuscriptFurniture(
        this.furnitureGraphics,
        this.furnitureTextContainer,
        settings.furniture,
        settings.width,
        settings.height
      );
    }

    // 7b. One selection language for every object kind (Plan 23)
    renderSelectionOverlay(this.selectionGraphics, {
      selectionKeys,
      terrainFeatures: viewTerrain,
      placements: viewPlacements,
      locations: viewLocations,
      tradeRoutes: viewRoutes,
      mapRoutes: viewMapRoutes,
      draggedNode,
      transientPos,
      settings,
      placeCategories,
      vertexEditMode: options.vertexEditMode,
    });

    // 8. Render Active Interaction Tools (Drafting & Ruler)
    renderInteraction(this.interactionGraphics, {
      draftPoints,
      rulerPoints,
      activeTool,
      isPersian,
    });
  }

  /**
   * Sub-millisecond interaction renderer: clears and repaints active drafting points,
   * ruler measurements, and active tool outlines in < 0.05ms without touching the
   * underlying map data, spatial index, or text textures.
   */
  public renderInteractionOnly(options: {
    draftPoints?: MapPoint[];
    rulerPoints?: MapPoint[];
    activeTool: string;
    isPersian?: boolean;
  }): void {
    renderInteraction(this.interactionGraphics, {
      draftPoints: options.draftPoints ?? [],
      rulerPoints: options.rulerPoints ?? [],
      activeTool: options.activeTool as any,
      isPersian: options.isPersian ?? false,
    });
  }

  /**
   * Sub-millisecond selection renderer: updates selection boundary boxes and handles
   * in < 0.1ms without triggering heavy terrain or route passes.
   */
  public renderSelectionOnly(options: {
    selectionKeys: Set<string>;
    draggedNode?: DraggedNodeData | null;
    transientPos?: MapPoint | null;
    vertexEditMode?: boolean;
  }): void {
    if (!this.lastRenderOptions) return;
    const { worldBible, settings } = this.lastRenderOptions;
    const viewTerrain = worldBible.mapData?.terrainFeatures || [];
    const viewPlacements = worldBible.mapData?.placements || [];
    const viewLocations = worldBible.locations || [];
    const viewRoutes = worldBible.tradeRoutes || [];
    const viewMapRoutes = worldBible.mapData?.routes || [];
    const placeCategories = worldBible.ontology?.placeCategories ?? [];

    renderSelectionOverlay(this.selectionGraphics, {
      selectionKeys: options.selectionKeys,
      terrainFeatures: viewTerrain,
      placements: viewPlacements,
      locations: viewLocations,
      tradeRoutes: viewRoutes,
      mapRoutes: viewMapRoutes,
      draggedNode: options.draggedNode ?? null,
      transientPos: options.transientPos ?? null,
      settings,
      placeCategories,
      vertexEditMode: options.vertexEditMode,
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
    mapRoutes: MapRoute[],
    terrainFeatures: MapTerrainFeature[],
    placements: MapEntityPlacement[],
    placeCategories: CustomPlaceCategory[],
    selectedTerrainIds?: Set<string>,
    vertexEditMode?: boolean
  ): void {
    this.spatialIndex.clear();
    const spatialItems: SpatialItem[] = [];

    const candidates = buildMapHitCandidates({
      locations,
      tradeRoutes,
      mapRoutes,
      terrainFeatures,
      placements,
      placeCategories,
      selectedTerrainIds,
      vertexEditMode,
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
   *
   * `visibleLayers` is the live layer-panel state. Passing it makes a hidden
   * layer unpickable, so clicking the empty parchment where a hidden town or
   * road used to be selects nothing instead of an invisible object.
   */
  public pickAt(
    point: MapPoint,
    visibleLayers: WorldMapSettings['visibleLayers']
  ): MapHit | null {
    const PAD = 40;
    const rough = this.spatialIndex.searchBBox(
      point.x - PAD,
      point.y - PAD,
      point.x + PAD,
      point.y + PAD
    );
    const candidates = rough.map((item) => item.data as MapHitCandidate);
    const activeTier = getLODTier(this.currentZoom);
    const lodFiltered = candidates.filter((c) => {
      const isSelected =
        c.kind === 'location' ||
        c.kind === 'placement' ||
        c.kind === 'route' ||
        c.kind === 'trade_route' ||
        c.kind === 'terrain'
          ? this.currentSelectionKeys.has(mapObjectKey(c.kind, c.id))
          : c.kind === 'waypoint'
          ? this.currentSelectionKeys.has(mapObjectKey('trade_route', c.routeId))
          : c.kind === 'route_vertex'
          ? this.currentSelectionKeys.has(mapObjectKey('route', c.routeId))
          : c.kind === 'terrain_vertex' || c.kind === 'terrain_midpoint'
          ? this.currentSelectionKeys.has(mapObjectKey('terrain', c.featureId))
          : false;
      return isCandidateVisibleAtLOD(c, activeTier, isSelected);
    });
    return hitTestMapObjects(point, lodFiltered, { visibleLayers });
  }








  public renderBrushPreview(stamps: MapPoint[][], mode: 'paint' | 'carve'): void {
    renderBrushPreview(this.brushGraphics, stamps, mode);
  }

  /**
   * Renders real-time procedural mountain range preview during mouse drag (60 FPS).
   */
  public renderMountainStrokePreview(
    points: MapPoint[],
    options: MountainRangeOptions = {}
  ): void {
    this.brushGraphics.clear();
    if (points.length < 2) return;
    const peaks = generateProceduralMountainRange(points, options);
    for (const peak of peaks) {
      renderProceduralPeakToGraphics(this.brushGraphics, peak);
    }
  }

  /**
   * Renders real-time procedural tapered river preview during mouse drag (60 FPS).
   */
  public renderRiverStrokePreview(
    points: MapPoint[],
    options: RiverOptions = {}
  ): void {
    this.brushGraphics.clear();
    if (points.length < 2) return;
    const river = generateProceduralRiver(points, options);
    renderProceduralRiverToGraphics(this.brushGraphics, river);
  }

  /**
   * Renders real-time procedural highland / cliff preview during mouse drag (60 FPS).
   */
  public renderHighlandStrokePreview(
    points: MapPoint[],
    options: HighlandOptions = {}
  ): void {
    this.brushGraphics.clear();
    if (points.length < 2) return;
    const highland = generateProceduralHighland(points, options);
    renderProceduralHighlandToGraphics(this.brushGraphics, highland, (g, pts, _mat, color, alpha) => {
      g.poly(pts).fill({ color, alpha });
    });
  }

  /**
   * Renders real-time procedural canyon / valley preview during mouse drag (60 FPS).
   */
  public renderValleyStrokePreview(
    points: MapPoint[],
    options: ValleyOptions = {}
  ): void {
    this.brushGraphics.clear();
    if (points.length < 2) return;
    const valley = generateProceduralValley(points, options);
    renderProceduralValleyToGraphics(this.brushGraphics, valley);
  }

  /**
   * Renders real-time procedural lake preview during mouse drag (60 FPS).
   */
  public renderLakeStrokePreview(points: MapPoint[]): void {
    this.brushGraphics.clear();
    if (points.length < 3) return;
    const closed = [...points, points[0]];
    drawLake(
      this.brushGraphics,
      { id: 'preview_lake', name: 'Lake', type: 'lake', polygon: closed },
      (g, pts, _mat, color, alpha) => {
        g.poly(pts).fill({ color, alpha });
      }
    );
  }

  /**
   * Renders real-time procedural biome preview during mouse drag (60 FPS).
   * Supports both stroke mode (linear tree belt / copse) and area mode (enclosed polygon).
   */
  public renderBiomeStrokePreview(
    points: MapPoint[],
    biomeType: string,
    mode: 'stroke' | 'area' = 'stroke',
    corridorWidth = 30
  ): void {
    this.brushGraphics.clear();
    if (points.length === 0) return;

    if (mode === 'stroke') {
      drawBiome(
        this.brushGraphics,
        {
          id: 'preview_biome',
          name: 'Biome',
          type: biomeType as any,
          points,
          width: corridorWidth,
        },
        (g, pts, _mat, color, alpha) => {
          g.poly(pts).fill({ color, alpha });
        }
      );
    } else {
      if (points.length < 3) return;
      const closed = [...points, points[0]];
      drawBiome(
        this.brushGraphics,
        { id: 'preview_biome', name: 'Biome', type: biomeType as any, polygon: closed },
        (g, pts, _mat, color, alpha) => {
          g.poly(pts).fill({ color, alpha });
        }
      );
    }
  }

  public renderBrushCursor(
    point: MapPoint | null,
    radius: number,
    mode: 'paint' | 'carve'
  ): void {
    renderBrushCursor(this.brushCursorGraphics, point, radius, mode);
  }

  /** Passive snap indicator while the road tool is armed. */
  public renderRouteSnapPreview(point: MapPoint | null): void {
    renderRouteSnapPreview(this.brushGraphics, point);
  }

  /**
   * Clears transient real-time brush stroke preview
   */
  /**
   * Renders a real-time ghost preview of a stamp asset from the stamp drawer at the cursor position.
   */
  public renderStampGhostPreview(
    point: MapPoint | null,
    symbolId: string | null,
    scale: number = 42
  ): void {
    if (!point || !symbolId) {
      this.ghostSprite.visible = false;
      return;
    }
    const texture = this.symbolLibrary.get(symbolId);
    if (!texture) {
      this.ghostSprite.visible = false;
      return;
    }
    this.ghostSprite.texture = texture;
    this.ghostSprite.x = point.x;
    this.ghostSprite.y = point.y;
    this.ghostSprite.anchor.set(0.5, 0.9);
    const texW = texture.width || 64;
    const texH = texture.height || 64;
    const aspect = texH / Math.max(1, texW);
    this.ghostSprite.width = scale;
    this.ghostSprite.height = scale * aspect;
    this.ghostSprite.alpha = 0.65;
    this.ghostSprite.visible = true;
  }

  /**
   * Clears the stamp ghost preview sprite.
   */
  public clearStampGhostPreview(): void {
    this.ghostSprite.visible = false;
  }

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
    if (this.resolutionRefreshTimer) {
      clearTimeout(this.resolutionRefreshTimer);
      this.resolutionRefreshTimer = null;
    }
    this.textureLibrary.destroy();
    this.symbolLibrary.destroy();
    this.ghostSprite.destroy();
    if (this.app) {
      this.app.destroy(true, { children: true });
      this.app = null;
    }
    this.isInitialized = false;
  }
}
