/**
 * PixiCartographerEngine: Hardware-accelerated WebGL 2D Cartography Viewport
 * Implements Phase 1 of the Inkarnate-class fantasy map maker.
 * Renders high-performance interactive maps with the Classic Parchment / Vintage Fantasy aesthetic.
 */

import { Application, Container, Graphics, Matrix } from 'pixi.js';
import {
  WorldMapSettings,
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  MapPoint,
} from '@/lib/types';
import {
  mapObjectKey,
  translateLocation,
  translatePlacement,
  translateTerrainFeature,
  translateTradeRoute,
} from '../mapSelection';
import { VINTAGE_PARCHMENT } from './vintageTheme';
import type { RenderAllOptions } from './renderTypes';
export type { DraggedNodeData, RenderAllOptions } from './renderTypes';
import { renderBackground } from './mapBackgroundRenderer';
import { renderGrid } from './mapBackgroundRenderer';
import { renderTerrain } from './terrainRenderer';
import {
  renderPlacements,
  renderRoutes,
  renderSettlements,
} from './entitiesRenderer';
import { renderSelectionOverlay } from './selectionOverlayRenderer';
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
    const terrainFeatures = worldBible.mapData?.terrainFeatures || [];
    const placements = worldBible.mapData?.placements || [];

    // Plan 23 — group move preview.
    //
    // Rather than teaching every draw routine about an offset, we hand the
    // renderer a translated *view* of the world for the duration of the drag.
    // Selected terrain, pins, settlements and routes are shifted; a route whose
    // endpoint settlement is selected follows automatically because the route
    // renderer resolves endpoints from the view's location list.
    const selectionKeys = new Set(selection.map((ref) => mapObjectKey(ref.kind, ref.id)));
    const dx = selectionDelta?.x ?? 0;
    const dy = selectionDelta?.y ?? 0;
    const hasDelta = dx !== 0 || dy !== 0;
    const viewTerrain = hasDelta
      ? terrainFeatures.map((feature) =>
          selectionKeys.has(mapObjectKey('terrain', feature.id))
            ? translateTerrainFeature(feature, dx, dy)
            : feature
        )
      : terrainFeatures;
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
    renderBackground(this.bgGraphics, this.fillWithMaterial.bind(this));

    // 3. Render Grid (Square / Hex / None)
    renderGrid(this.gridGraphics, settings);

    // 4. Render Continents, Biomes, Rivers, Mountains
    renderTerrain(this.terrainGraphics, viewTerrain, settings, this.fillWithMaterial.bind(this));

    // 5. Render Trade Routes & Waypoints
    renderRoutes(this.routeGraphics, {
      tradeRoutes: viewRoutes,
      locations: viewLocations,
      selectionKeys,
      draggedNode,
      transientPos,
      settings,
    });

    // 6. Render Settlements & Heraldic Labels
    renderSettlements(this.settlementGraphics, this.settlementLabelsContainer, {
      locations: viewLocations,
      draggedNode,
      transientPos,
      settings,
      isPersian,
    });

    // 7. Render Placed Lore Pins
    renderPlacements(this.placementGraphics, viewPlacements, settings);

    // 7b. One selection language for every object kind (Plan 23)
    renderSelectionOverlay(this.selectionGraphics, {
      selectionKeys,
      terrainFeatures: viewTerrain,
      placements: viewPlacements,
      locations: viewLocations,
      tradeRoutes: viewRoutes,
      draggedNode,
      transientPos,
      settings,
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
    return hitTestMapObjects(point, candidates, { visibleLayers });
  }








  public renderBrushPreview(stamps: MapPoint[][], mode: 'paint' | 'carve'): void {
    renderBrushPreview(this.brushGraphics, stamps, mode);
  }

  public renderBrushCursor(
    point: MapPoint | null,
    radius: number,
    mode: 'paint' | 'carve'
  ): void {
    renderBrushCursor(this.brushCursorGraphics, point, radius, mode);
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
