'use client';

import React, { useState } from 'react';
import { Sparkles, RefreshCw, SlidersHorizontal, Trees } from 'lucide-react';
import type { MapTerrainFeature } from '@/lib/types';
import {
  getFamilyById,
  resolveDefaultFamilyForTerrain,
  type GeoSymbolCategory,
} from '@/lib/engines/world/pixi/symbolPalette';
import { generateScatterInstances } from '@/lib/engines/world/pixi/symbolScatterRenderer';
import { GeoSpeciesPickerModal } from '../../canvas/GeoSpeciesPickerModal';

export interface TerrainSpeciesSectionProps {
  feature: MapTerrainFeature;
  isPersian: boolean;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
  onOpenSpeciesModal?: (categoryFilter?: GeoSymbolCategory) => void;
}

export const TerrainSpeciesSection: React.FC<TerrainSpeciesSectionProps> = ({
  feature,
  isPersian,
  onUpdateTerrain,
  onOpenSpeciesModal,
}) => {
  const [isLocalModalOpen, setIsLocalModalOpen] = useState(false);
  const isFloraOrRelief =
    feature.type === 'forest' ||
    feature.type === 'jungle' ||
    feature.type === 'desert' ||
    feature.type === 'swamp' ||
    feature.type === 'tundra' ||
    feature.type === 'plains' ||
    feature.type === 'mountain_range' ||
    feature.type === 'peak' ||
    feature.type === 'volcano' ||
    feature.type === 'highland' ||
    feature.type === 'plateau' ||
    Boolean(feature.symbolFamily);

  if (!isFloraOrRelief) return null;

  const currentFamilyId =
    feature.symbolFamily ||
    resolveDefaultFamilyForTerrain(feature.type, feature.hasSnowcaps);

  const family = getFamilyById(currentFamilyId);

  const targetCategory: GeoSymbolCategory =
    feature.type === 'mountain_range' || feature.type === 'peak' || feature.type === 'volcano'
      ? 'mountain'
      : feature.type === 'highland' || feature.type === 'plateau'
      ? 'hill'
      : 'tree';

  const handleFamilyChange = (newFamilyId: string) => {
    const updatedFeature: MapTerrainFeature = {
      ...feature,
      symbolFamily: newFamilyId,
    };
    const newInstances = generateScatterInstances(updatedFeature);
    onUpdateTerrain(feature.id, {
      symbolFamily: newFamilyId,
      scatterInstances: newInstances,
    });
  };

  const handleScaleChange = (val: number) => {
    const updatedFeature: MapTerrainFeature = {
      ...feature,
      symbolScale: val,
    };
    const newInstances = generateScatterInstances(updatedFeature);
    onUpdateTerrain(feature.id, {
      symbolScale: val,
      scatterInstances: newInstances,
    });
  };

  const handleSpacingChange = (val: number) => {
    const updatedFeature: MapTerrainFeature = {
      ...feature,
      symbolSpacing: val,
    };
    const newInstances = generateScatterInstances(updatedFeature);
    onUpdateTerrain(feature.id, {
      symbolSpacing: val,
      scatterInstances: newInstances,
    });
  };

  const handleRegenerate = () => {
    // Generate fresh scatter instances with a new randomized seed
    const newInstances = generateScatterInstances(feature, {
      seed: Math.floor(Math.random() * 1000000),
    });
    onUpdateTerrain(feature.id, {
      scatterInstances: newInstances,
    });
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-zinc-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{isPersian ? 'گونه و سبک نماد نقشه' : 'Species & Cartography Style'}</span>
        </div>
        <button
          type="button"
          onClick={handleRegenerate}
          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-amber-300 transition-colors"
          title={isPersian ? 'تولید مجدد چینش نمادها' : 'Regenerate distribution'}
        >
          <RefreshCw className="w-3 h-3" />
          <span>{isPersian ? 'توزیع مجدد' : 'Reseed'}</span>
        </button>
      </div>

      {/* Active Species Card */}
      {family && (
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
          <div className="w-12 h-12 rounded-lg bg-[#f3e9d2]/15 border border-amber-900/30 flex items-center justify-center p-1 overflow-hidden shrink-0">
            <img
              src={family.thumbnail}
              alt={family.name.en}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-zinc-100 truncate">
              {isPersian ? family.name.fa : family.name.en}
            </h4>
            <p className="text-[10px] text-zinc-400 truncate">
              {family.variants.length} {isPersian ? 'نگاره مختلف' : 'variants'} · {family.category}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onOpenSpeciesModal) {
                onOpenSpeciesModal(targetCategory);
              } else {
                setIsLocalModalOpen(true);
              }
            }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white shrink-0 transition-all shadow-md shadow-amber-950"
          >
            {isPersian ? 'تغییر گونه...' : 'Change...'}
          </button>
        </div>
      )}

      {/* Scale & Spacing Controls */}
      <div className="space-y-2 pt-1">
        {/* Scale Slider */}
        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-zinc-400 font-medium">
              {isPersian ? 'اندازه نمادها:' : 'Symbol Scale:'}
            </span>
            <span className="font-mono text-amber-300">
              {feature.symbolScale ?? family?.defaultScale ?? 40}px
            </span>
          </div>
          <input
            type="range"
            min={15}
            max={90}
            step={1}
            value={feature.symbolScale ?? family?.defaultScale ?? 40}
            onChange={(e) => handleScaleChange(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer h-1 bg-zinc-700 rounded-lg"
          />
        </div>

        {/* Spacing / Density Slider (for polygon or polyline features) */}
        {((feature.polygon && feature.polygon.length >= 3) ||
          (feature.points && feature.points.length >= 2)) && (
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-zinc-400 font-medium">
                {isPersian ? 'فاصله بین نمادها (تراکم):' : 'Symbol Spacing (Density):'}
              </span>
              <span className="font-mono text-lime-300">
                {feature.symbolSpacing ?? family?.defaultSpacing ?? 32}px
              </span>
            </div>
            <input
              type="range"
              min={18}
              max={70}
              step={1}
              value={feature.symbolSpacing ?? family?.defaultSpacing ?? 32}
              onChange={(e) => handleSpacingChange(Number(e.target.value))}
              className="w-full accent-lime-500 cursor-pointer h-1 bg-zinc-700 rounded-lg"
            />
          </div>
        )}
      </div>

      <GeoSpeciesPickerModal
        isOpen={isLocalModalOpen}
        onClose={() => setIsLocalModalOpen(false)}
        currentlySelectedFamily={currentFamilyId}
        onSelectFamily={handleFamilyChange}
        categoryFilter={targetCategory}
        isPersian={isPersian}
      />
    </div>
  );
};
