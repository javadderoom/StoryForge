'use client';

import React from 'react';
import {
  Castle,
  Route,
  Mountain,
  X,
  MapPin,
  Flame,
  Shield,
  Sparkles,
  Swords,
} from 'lucide-react';
import {
  type SelectedMapItem,
  type CartographerInspectorProps,
} from './inspector/types';
import { LocationInspector } from './inspector/LocationInspector';
import { CaravanRouteInspector } from './inspector/CaravanRouteInspector';
import { RoadRouteInspector } from './inspector/RoadRouteInspector';
import { TerrainInspector } from './inspector/TerrainInspector';
import { PlacementInspector } from './inspector/PlacementInspector';

export type { SelectedMapItem, CartographerInspectorProps };

export const CartographerInspector: React.FC<CartographerInspectorProps> = ({
  selectedItem,
  onClose,
  onUpdateLocation,
  onDeleteLocation,
  onToggleLocationVisibility,
  onToggleLocationLock,
  onUpdateTradeRoute,
  onDeleteTradeRoute,
  onUpdateTerrain,
  onDeleteTerrain,
  onDeletePlacement,
  onUpdateRoute,
  onDeleteRoute,
  onToggleRouteVisibility,
  onToggleRouteLock,
  onToggleTerrainVisibility,
  onToggleTerrainLock,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  npcs,
  factions,
  locations,
  placeCategories,
  terrainFeatures,
  placements,
  bestiary,
  artifacts,
  timeline,
  religions,
  onUpdateCreature,
  onDeleteCreature,
  onUpdateArtifact,
  onDeleteArtifact,
  onUpdateTimelineEvent,
  onDeleteTimelineEvent,
  onUpdateNpc,
  onDeleteNpc,
  isPersian,
  onAddTerrain,
  onSelectFeature,
}) => {
  if (!selectedItem) return null;

  return (
    <aside className="absolute right-4 top-20 z-20 w-92 bg-zinc-950/92 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-5 shadow-2xl flex flex-col gap-4 select-none animate-fadeIn max-h-[calc(100vh-110px)] overflow-y-auto scrollbar-thin">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-zinc-100 font-bold text-sm">
          {selectedItem.type === 'location' && <Castle className="w-4 h-4 text-amber-400" />}
          {selectedItem.type === 'trade_route' && <Route className="w-4 h-4 text-orange-400" />}
          {selectedItem.type === 'route' && <Route className="w-4 h-4 text-amber-300" />}
          {selectedItem.type === 'terrain' && <Mountain className="w-4 h-4 text-emerald-400" />}
          {selectedItem.type === 'placement' && (() => {
            const pin = selectedItem.data;
            if (pin.entityType === 'bestiary') return <Flame className="w-4 h-4 text-rose-500" />;
            if (pin.entityType === 'npc') return <Shield className="w-4 h-4 text-sky-400" />;
            if (pin.entityType === 'artifact') return <Sparkles className="w-4 h-4 text-amber-400" />;
            if (pin.entityType === 'timeline') return <Swords className="w-4 h-4 text-purple-400" />;
            return <MapPin className="w-4 h-4 text-purple-400" />;
          })()}
          <span className="truncate">
            {selectedItem.type === 'location' && (isPersian ? 'مشخصات شهر / مکان' : 'Location Inspector')}
            {selectedItem.type === 'trade_route' && (isPersian ? 'شاهراه کاروان تجاری' : 'Caravan Route Inspector')}
            {selectedItem.type === 'route' && (isPersian ? 'جاده و گذرگاه نقشه' : 'Road & Path Inspector')}
            {selectedItem.type === 'terrain' && (isPersian ? 'عنصر فیزیکی جغرافیایی' : 'Terrain Feature Inspector')}
            {selectedItem.type === 'placement' && (() => {
              const pin = selectedItem.data;
              if (pin.entityType === 'bestiary') return isPersian ? 'شناسنامه جانور و هیولا' : 'Beast & Monster Dossier';
              if (pin.entityType === 'npc') return isPersian ? 'پرونده شخصیت (NPC)' : 'NPC Dossier';
              if (pin.entityType === 'artifact') return isPersian ? 'شناسنامه عتیقه و اثر باستانی' : 'Relic & Artifact Dossier';
              if (pin.entityType === 'timeline') return isPersian ? 'وقایع‌نگاری رویداد تاریخی' : 'Historical Chronicle';
              return isPersian ? 'نقطه سنجاق‌شده' : 'Pinned Entity';
            })()}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {selectedItem.type === 'location' && (
        <LocationInspector
          loc={selectedItem.data}
          npcs={npcs}
          placeCategories={placeCategories}
          terrainFeatures={terrainFeatures}
          isPersian={isPersian}
          onUpdateLocation={onUpdateLocation}
          onDeleteLocation={onDeleteLocation}
          onToggleLocationVisibility={onToggleLocationVisibility}
          onToggleLocationLock={onToggleLocationLock}
          onUpdateTerrain={onUpdateTerrain}
          onClose={onClose}
        />
      )}

      {selectedItem.type === 'trade_route' && (
        <CaravanRouteInspector
          route={selectedItem.data}
          locations={locations}
          factions={factions}
          isPersian={isPersian}
          onUpdateTradeRoute={onUpdateTradeRoute}
          onDeleteTradeRoute={onDeleteTradeRoute}
          onClose={onClose}
        />
      )}

      {selectedItem.type === 'route' && (
        <RoadRouteInspector
          route={selectedItem.data}
          locations={locations}
          terrainFeatures={terrainFeatures}
          placements={placements}
          placeCategories={placeCategories}
          isPersian={isPersian}
          onUpdateRoute={onUpdateRoute}
          onDeleteRoute={onDeleteRoute}
          onToggleRouteVisibility={onToggleRouteVisibility}
          onToggleRouteLock={onToggleRouteLock}
          onClose={onClose}
        />
      )}

      {selectedItem.type === 'terrain' && (
        <TerrainInspector
          feature={selectedItem.data}
          locations={locations}
          placeCategories={placeCategories}
          isPersian={isPersian}
          onUpdateTerrain={onUpdateTerrain}
          onDeleteTerrain={onDeleteTerrain}
          onToggleTerrainVisibility={onToggleTerrainVisibility}
          onToggleTerrainLock={onToggleTerrainLock}
          onClose={onClose}
          onAddTerrain={onAddTerrain}
          allFeatures={terrainFeatures}
          onSelectFeature={onSelectFeature}
        />
      )}

      {selectedItem.type === 'placement' && (
        <PlacementInspector
          pin={selectedItem.data}
          npcs={npcs}
          bestiary={bestiary}
          artifacts={artifacts}
          timeline={timeline}
          religions={religions}
          isPersian={isPersian}
          onUpdateCreature={onUpdateCreature}
          onDeleteCreature={onDeleteCreature}
          onUpdateArtifact={onUpdateArtifact}
          onUpdateTimelineEvent={onUpdateTimelineEvent}
          onUpdateNpc={onUpdateNpc}
          onDeletePlacement={onDeletePlacement}
          onTogglePlacementVisibility={onTogglePlacementVisibility}
          onTogglePlacementLock={onTogglePlacementLock}
          onClose={onClose}
        />
      )}
    </aside>
  );
};
