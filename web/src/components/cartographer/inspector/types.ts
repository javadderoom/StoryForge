import type {
  WorldLocation,
  WorldTradeRoute,
  MapTerrainFeature,
  MapEntityPlacement,
  MapRoute,
  MapGroup,
  MapGroupMode,
  NPCDossier,
  WorldCreature,
  WorldArtifact,
  WorldDeity,
  TimelineEvent,
  TradeRouteStatus,
  Faction,
  CustomPlaceCategory,
} from '@/lib/types';

export type SingleSelectedMapItem =
  | { type: 'location'; data: WorldLocation }
  | { type: 'trade_route'; data: WorldTradeRoute }
  | { type: 'route'; data: MapRoute }
  | { type: 'terrain'; data: MapTerrainFeature }
  | { type: 'placement'; data: MapEntityPlacement };

export type SelectedMapItem =
  | SingleSelectedMapItem
  | { type: 'group'; data: MapGroup; members: SingleSelectedMapItem[] }
  | { type: 'multiple'; members: SingleSelectedMapItem[] }
  | null;

export interface CartographerInspectorProps {
  selectedItem: SelectedMapItem;
  onClose: () => void;
  onGroup?: (mode: MapGroupMode) => void;
  onDuplicateSelection?: () => void;
  onDeleteSelection?: () => void;
  onUpdateLocation: (id: string, updated: Partial<WorldLocation>) => void;
  onDeleteLocation: (id: string) => void;
  onToggleLocationVisibility?: (id: string) => void;
  onToggleLocationLock?: (id: string) => void;
  onUpdateTradeRoute: (id: string, updated: Partial<WorldTradeRoute>) => void;
  onDeleteTradeRoute: (id: string) => void;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
  onDeleteTerrain: (id: string) => void;
  onDeletePlacement: (id: string) => void;
  /** Plan 25 — drawn roads and paths. */
  onUpdateRoute: (id: string, updated: Partial<MapRoute>) => void;
  onDeleteRoute: (id: string) => void;
  onToggleRouteVisibility?: (id: string) => void;
  onToggleRouteLock?: (id: string) => void;
  /** Plan 21 — per-object layer controls. */
  onToggleTerrainVisibility?: (id: string) => void;
  onToggleTerrainLock?: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  npcs: NPCDossier[];
  factions: Faction[];
  locations: WorldLocation[];
  /** Plan 24: the ontology categories, including author-created ones. */
  placeCategories: CustomPlaceCategory[];
  /** Plan 24: used to show which terrain realizes a non-point place. */
  terrainFeatures: MapTerrainFeature[];
  /** Plan 25: used to label and re-snap route endpoints. */
  placements: MapEntityPlacement[];
  bestiary?: WorldCreature[];
  artifacts?: WorldArtifact[];
  timeline?: TimelineEvent[];
  /** Deity pins (Shrine tool) resolve their dossier from here. */
  religions?: WorldDeity[];
  groups?: MapGroup[];
  onUpdateGroup?: (id: string, updated: Partial<MapGroup>) => void;
  onSetGroupLocation?: (groupId: string, locationId: string | undefined) => void;
  onSetGroupMode?: (groupId: string, mode: MapGroupMode) => void;
  onUngroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onSelectGroup?: (groupId: string) => void;
  onUpdateCreature?: (id: string, updated: Partial<WorldCreature>) => void;
  onDeleteCreature?: (id: string) => void;
  onUpdateArtifact?: (id: string, updated: Partial<WorldArtifact>) => void;
  onDeleteArtifact?: (id: string) => void;
  onUpdateTimelineEvent?: (id: string, updated: Partial<TimelineEvent>) => void;
  onDeleteTimelineEvent?: (id: string) => void;
  onUpdateNpc?: (id: string, updated: Partial<NPCDossier>) => void;
  onDeleteNpc?: (id: string) => void;
  onStationNpc: (npcId: string, locationId: string) => void;
  onAddTerrain?: (feature: MapTerrainFeature) => void;
  onSelectFeature?: (id: string) => void;
  isPersian: boolean;
}

export const TRADE_STATUSES: TradeRouteStatus[] = ['active', 'raided', 'blockaded', 'seasonal', 'secret'];

export const STATUS_LABELS: Record<TradeRouteStatus, { en: string; fa: string; color: string }> = {
  active: { en: 'Active Flow', fa: 'فعال و روان', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  raided: { en: 'Raided / In Peril', fa: 'غارت‌شده و ناامن', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  blockaded: { en: 'Blockaded / Severed', fa: 'مسدود و محاصره', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  seasonal: { en: 'Seasonal Pass', fa: 'گذرگاه فصلی', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  secret: { en: 'Secret Smuggling Corridor', fa: 'مسیر مخفی قاچاق', color: 'text-violet-400 bg-violet-500/10 border-violet-500/30' },
};
