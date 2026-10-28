'use client';

import React from 'react';
import { Trees } from 'lucide-react';
import type { MapTerrainFeature } from '@/lib/types';

interface TerrainCanopySectionProps {
  feature: MapTerrainFeature;
  isPersian: boolean;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
}

export const TerrainCanopySection: React.FC<TerrainCanopySectionProps> = ({
  feature,
  isPersian,
  onUpdateTerrain,
}) => {
  if (feature.type !== 'forest' && feature.type !== 'jungle') return null;

  return (
    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trees className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-medium text-zinc-200">
            {isPersian ? 'توده‌های پیوسته تاج جنگل' : 'Forest Canopy Massing'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const currentEnabled = feature.canopyConfig?.enabled ?? true;
            onUpdateTerrain(feature.id, {
              canopyConfig: {
                ...feature.canopyConfig,
                enabled: !currentEnabled,
                density: feature.canopyConfig?.density ?? 'medium',
                scallopScale: feature.canopyConfig?.scallopScale ?? 1.0,
                hatchShading: feature.canopyConfig?.hatchShading ?? true,
                sentinelTrees: feature.canopyConfig?.sentinelTrees ?? true,
              },
            });
          }}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
            (feature.canopyConfig?.enabled ?? true)
              ? 'bg-emerald-950/80 border-emerald-400/60 text-emerald-200'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {(feature.canopyConfig?.enabled ?? true)
            ? isPersian
              ? 'فعال'
              : 'Enabled'
            : isPersian
            ? 'غیرفعال'
            : 'Disabled'}
        </button>
      </div>

      {(feature.canopyConfig?.enabled ?? true) && (
        <div className="space-y-2.5 pt-1 text-[11px]">
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'تراکم بیشه‌ها' : 'Grove Density'}</span>
              <span className="font-mono text-emerald-300 capitalize">
                {feature.canopyConfig?.density ?? 'medium'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['sparse', 'medium', 'dense'] as const).map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() =>
                    onUpdateTerrain(feature.id, {
                      canopyConfig: {
                        ...feature.canopyConfig,
                        density,
                      },
                    })
                  }
                  className={`py-1 rounded text-[10px] font-medium transition-all border ${
                    (feature.canopyConfig?.density ?? 'medium') === density
                      ? 'bg-emerald-900/60 border-emerald-500/80 text-emerald-200'
                      : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {density === 'sparse'
                    ? isPersian
                      ? 'تنک'
                      : 'Sparse'
                    : density === 'medium'
                    ? isPersian
                      ? 'متوسط'
                      : 'Medium'
                    : isPersian
                    ? 'متراکم'
                    : 'Dense'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'مقیاس چین‌خوردگی تاج' : 'Canopy Lobe Scale'}</span>
              <span className="font-mono text-emerald-300">
                {(feature.canopyConfig?.scallopScale ?? 1.0).toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.8}
              step={0.1}
              value={feature.canopyConfig?.scallopScale ?? 1.0}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  canopyConfig: {
                    ...feature.canopyConfig,
                    scallopScale: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-zinc-400">
              {isPersian ? 'هاشور سایه جنوب‌شرقی' : 'Southeast Shadow Hatching'}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateTerrain(feature.id, {
                  canopyConfig: {
                    ...feature.canopyConfig,
                    hatchShading: !(feature.canopyConfig?.hatchShading ?? true),
                  },
                })
              }
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                (feature.canopyConfig?.hatchShading ?? true)
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {(feature.canopyConfig?.hatchShading ?? true)
                ? isPersian
                  ? 'فعال'
                  : 'On'
                : isPersian
                ? 'غیرفعال'
                : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-zinc-400">
              {isPersian ? 'درختان نگهبان حاشیه' : 'Edge Sentinel Trees'}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateTerrain(feature.id, {
                  canopyConfig: {
                    ...feature.canopyConfig,
                    sentinelTrees: !(feature.canopyConfig?.sentinelTrees ?? true),
                  },
                })
              }
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                (feature.canopyConfig?.sentinelTrees ?? true)
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {(feature.canopyConfig?.sentinelTrees ?? true)
                ? isPersian
                  ? 'فعال'
                  : 'On'
                : isPersian
                ? 'غیرفعال'
                : 'Off'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
