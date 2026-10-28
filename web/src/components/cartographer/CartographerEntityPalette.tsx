'use client';

import React, { useState } from 'react';
import {
  Globe,
  MapPin,
  User,
  Skull,
  Sparkles,
  Sun,
  History,
  X,
  Search,
  Layers,
} from 'lucide-react';
import {
  WorldBible,
  WorldMapData,
  MapEntityPlacement,
} from '@/lib/types';
import { SelectedMapItem } from './CartographerInspector';
import { getMapSemanticReconciliation } from '@/lib/engines/world/mapSemantics';
import { MapObjectsTab } from './palette/MapObjectsTab';
import { ManifestEntitiesTab, ManifestTabKey } from './palette/ManifestEntitiesTab';

interface CartographerEntityPaletteProps {
  worldBible: WorldBible;
  onSelectEntityForPlacement: (type: string, id: string) => void;
  onClose: () => void;
  isPersian: boolean;
  /**
   * Plan 21 — the map's own objects (terrain features and lore pins). These
   * are drawing primitives, not manifest place categories; a terrain feature
   * may link to a WorldLocation through its optional `locationId`.
   */
  mapData?: WorldMapData;
  onSelectMapObject?: (item: SelectedMapItem) => void;
  onToggleTerrainVisibility?: (id: string) => void;
  onToggleTerrainLock?: (id: string) => void;
  onRenameTerrain?: (id: string, name: string) => void;
  onReorderTerrain?: (id: string, direction: 'forward' | 'backward') => void;
  onDeleteTerrain?: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onRenamePlacement?: (id: string, label: string) => void;
  onReorderPlacement?: (id: string, direction: 'forward' | 'backward') => void;
  onDeletePlacement?: (id: string) => void;
}

type PaletteTab = 'objects' | ManifestTabKey;

export const CartographerEntityPalette: React.FC<CartographerEntityPaletteProps> = ({
  worldBible,
  onSelectEntityForPlacement,
  onClose,
  isPersian,
  mapData,
  onSelectMapObject,
  onToggleTerrainVisibility,
  onToggleTerrainLock,
  onRenameTerrain,
  onReorderTerrain,
  onDeleteTerrain,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onRenamePlacement,
  onReorderPlacement,
  onDeletePlacement,
}) => {
  const [activeTab, setActiveTab] = useState<PaletteTab>('objects');
  const [search, setSearch] = useState('');
  /** Which row is being renamed inline. */
  const [editing, setEditing] = useState<{ kind: 'terrain' | 'placement'; id: string } | null>(null);
  const [draftName, setDraftName] = useState('');

  const locations = worldBible.locations || [];
  const placeCategories = worldBible.ontology?.placeCategories ?? [];
  const npcs = worldBible.npcs || [];
  const creatures = worldBible.bestiary || [];
  const artifacts = worldBible.artifacts || [];
  const deities = worldBible.religions || [];
  const timeline = worldBible.timeline || [];
  const terrainFeatures = mapData?.terrainFeatures || [];
  const placements = mapData?.placements || [];
  const reconciliation = getMapSemanticReconciliation(worldBible, mapData);

  const tabs = [
    {
      id: 'objects' as const,
      label: { en: 'Map Objects', fa: 'عوارض نقشه' },
      icon: Layers,
      count: terrainFeatures.length + placements.length,
    },
    { id: 'locations' as const, label: { en: 'Locations', fa: 'مکان‌ها' }, icon: MapPin, count: locations.length },
    { id: 'npcs' as const, label: { en: 'NPCs', fa: 'شخصیت‌ها' }, icon: User, count: npcs.length },
    { id: 'bestiary' as const, label: { en: 'Bestiary', fa: 'جانوران' }, icon: Skull, count: creatures.length },
    { id: 'artifacts' as const, label: { en: 'Relics', fa: 'عتیقه‌ها' }, icon: Sparkles, count: artifacts.length },
    { id: 'religions' as const, label: { en: 'Deities', fa: 'ایزدان' }, icon: Sun, count: deities.length },
    { id: 'timeline' as const, label: { en: 'Timeline', fa: 'رویدادها' }, icon: History, count: timeline.length },
  ];

  const filterQuery = search.toLowerCase().trim();

  /** Resolves a lore pin's display name from the manifest it points at. */
  const resolvePinName = (pin: MapEntityPlacement): string => {
    if (pin.customLabel) return pin.customLabel;
    switch (pin.entityType) {
      case 'npc':
        return npcs.find((n) => n.id === pin.entityId)?.name || pin.entityId;
      case 'bestiary':
        return creatures.find((c) => c.id === pin.entityId)?.name || pin.entityId;
      case 'artifact':
        return artifacts.find((a) => a.id === pin.entityId)?.name || pin.entityId;
      case 'deity':
        return deities.find((d) => d.id === pin.entityId)?.name || pin.entityId;
      case 'timeline':
        return timeline.find((t) => t.id === pin.entityId)?.title || pin.entityId;
      case 'location':
        return locations.find((l) => l.id === pin.entityId)?.name || pin.entityId;
      default:
        return pin.entityId;
    }
  };

  const commitRename = () => {
    if (!editing) return;
    const value = draftName.trim();
    if (value) {
      if (editing.kind === 'terrain') onRenameTerrain?.(editing.id, value);
      else onRenamePlacement?.(editing.id, value);
    }
    setEditing(null);
  };

  const startRename = (kind: 'terrain' | 'placement', id: string, current: string) => {
    setEditing({ kind, id });
    setDraftName(current);
  };

  return (
    <div className="absolute right-4 top-20 z-20 w-88 bg-zinc-950/92 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-4 shadow-2xl flex flex-col gap-3.5 select-none animate-fadeIn max-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
        <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
          <Globe className="w-4 h-4 text-amber-400" />
          <span>{isPersian ? 'موجودی پرونده‌های جهان' : 'World Bible Palette'}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 border-b border-zinc-800/60">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-amber-500 text-zinc-950 font-semibold shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{isPersian ? tab.label.fa : tab.label.en}</span>
              <span className={`text-[10px] px-1 rounded-full ${isActive ? 'bg-zinc-950/30 text-zinc-900' : 'bg-zinc-800 text-zinc-400'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isPersian ? 'جستجو در موجودیت‌ها...' : 'Filter entities...'}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl pl-9 pr-3 py-1.5 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Entity List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 space-y-1.5 min-h-[220px]">
        {activeTab === 'objects' ? (
          <MapObjectsTab
            terrainFeatures={terrainFeatures}
            placements={placements}
            locations={locations}
            reconciliation={reconciliation}
            isPersian={isPersian}
            filterQuery={filterQuery}
            editing={editing}
            draftName={draftName}
            onDraftNameChange={setDraftName}
            onStartRename={startRename}
            onCommitRename={commitRename}
            onCancelRename={() => setEditing(null)}
            onSelectMapObject={onSelectMapObject}
            onToggleTerrainVisibility={onToggleTerrainVisibility}
            onToggleTerrainLock={onToggleTerrainLock}
            onReorderTerrain={onReorderTerrain}
            onDeleteTerrain={onDeleteTerrain}
            onTogglePlacementVisibility={onTogglePlacementVisibility}
            onTogglePlacementLock={onTogglePlacementLock}
            onReorderPlacement={onReorderPlacement}
            onDeletePlacement={onDeletePlacement}
            resolvePinName={resolvePinName}
          />
        ) : (
          <ManifestEntitiesTab
            activeTab={activeTab}
            locations={locations}
            npcs={npcs}
            creatures={creatures}
            artifacts={artifacts}
            deities={deities}
            timeline={timeline}
            placeCategories={placeCategories}
            isPersian={isPersian}
            filterQuery={filterQuery}
            onSelectEntityForPlacement={onSelectEntityForPlacement}
            onSelectMapObject={onSelectMapObject}
          />
        )}
      </div>
    </div>
  );
};
