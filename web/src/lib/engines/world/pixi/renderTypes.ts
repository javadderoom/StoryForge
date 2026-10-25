import type { Graphics } from 'pixi.js';
import type { MapPoint, WorldBible, WorldMapSettings } from '@/lib/types';
import type { CartographerTool } from '@/components/cartographer/CartographerHeader';
import type { MapObjectRef } from '../mapSelection';
import type { MapMaterialKey } from '../texturePalette';
import type { TransformHandleType, BoundingBox2D } from './transformMath';

export interface DraggedNodeData {
  type: 'location' | 'waypoint' | 'route_vertex' | 'terrain_vertex' | 'transform_handle';
  id: string;
  handleType?: TransformHandleType;
  originBox?: BoundingBox2D;
  routeId?: string;
  index?: number;
  subType?: 'points' | 'polygon';
  /** Present when a road endpoint is dragged (reserved for future editing). */
  endpoint?: 'origin' | 'destination';
  startPoint: MapPoint;
}

/** Everything one full render pass needs. */
export interface RenderAllOptions {
  worldBible: WorldBible;
  settings: WorldMapSettings;
  /** Plan 23: every selected object, not just the one open in the Inspector. */
  selection: MapObjectRef[];
  /**
   * Plan 23: a live translation applied to the selected objects while a group
   * drag is in flight. The world is only written on mouseup; until then this
   * offset is a render-only preview.
   */
  selectionDelta?: MapPoint | null;
  activeTool: CartographerTool;
  draggedNode: DraggedNodeData | null;
  transientPos: MapPoint | null;
  draftPoints: MapPoint[];
  rulerPoints: MapPoint[];
  isPersian: boolean;
  vertexEditMode?: boolean;
}

export type FillWithMaterial = (
  g: Graphics,
  points: number[],
  material: MapMaterialKey | null,
  flatColor: number,
  flatAlpha: number,
  /** Flat-point rings to cut out of every fill layer (islands inside lakes). */
  holes?: number[][]
) => void;
