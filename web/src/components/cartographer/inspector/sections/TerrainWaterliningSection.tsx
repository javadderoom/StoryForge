'use client';

import React from 'react';
import { Waves } from 'lucide-react';
import type { MapTerrainFeature } from '@/lib/types';

interface TerrainWaterliningSectionProps {
  feature: MapTerrainFeature;
  isPersian: boolean;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
}

export const TerrainWaterliningSection: React.FC<TerrainWaterliningSectionProps> = ({
  feature,
  isPersian,
  onUpdateTerrain,
}) => {
  if (
    feature.type !== 'continent' &&
    feature.type !== 'island' &&
    feature.type !== 'lake'
  ) {
    return null;
  }

  return (
    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-medium text-zinc-200">
            {isPersian ? 'موج‌های متحدالمرکز ساحل' : 'Shoreline Waterlining'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const currentEnabled = feature.waterliningConfig?.enabled ?? true;
            onUpdateTerrain(feature.id, {
              waterliningConfig: {
                ...feature.waterliningConfig,
                enabled: !currentEnabled,
                ringCount: feature.waterliningConfig?.ringCount ?? 4,
                baseDistance: feature.waterliningConfig?.baseDistance ?? 4,
                distanceStep: feature.waterliningConfig?.distanceStep ?? 5,
                stippledOuter: feature.waterliningConfig?.stippledOuter ?? true,
              },
            });
          }}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
            (feature.waterliningConfig?.enabled ?? true)
              ? 'bg-sky-950/80 border-sky-400/60 text-sky-200'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {(feature.waterliningConfig?.enabled ?? true)
            ? isPersian
              ? 'فعال'
              : 'Enabled'
            : isPersian
            ? 'غیرفعال'
            : 'Disabled'}
        </button>
      </div>

      {(feature.waterliningConfig?.enabled ?? true) && (
        <div className="space-y-2.5 pt-1 text-[11px]">
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'تعداد حلقه‌های موج' : 'Wave Echo Rings'}</span>
              <span className="font-mono text-sky-300">
                {feature.waterliningConfig?.ringCount ?? 4}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={feature.waterliningConfig?.ringCount ?? 4}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  waterliningConfig: {
                    ...feature.waterliningConfig,
                    ringCount: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'فاصله نخستین موج' : 'First Ring Distance'}</span>
              <span className="font-mono text-sky-300">
                {feature.waterliningConfig?.baseDistance ?? 4}px
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              step={0.5}
              value={feature.waterliningConfig?.baseDistance ?? 4}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  waterliningConfig: {
                    ...feature.waterliningConfig,
                    baseDistance: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'فاصله میان موج‌ها' : 'Ring Distance Step'}</span>
              <span className="font-mono text-sky-300">
                {feature.waterliningConfig?.distanceStep ?? 5}px
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={feature.waterliningConfig?.distanceStep ?? 5}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  waterliningConfig: {
                    ...feature.waterliningConfig,
                    distanceStep: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-zinc-400">
              {isPersian ? 'تاج‌های مقطع موج بیرونی' : 'Broken Outer Crests'}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateTerrain(feature.id, {
                  waterliningConfig: {
                    ...feature.waterliningConfig,
                    stippledOuter: !(feature.waterliningConfig?.stippledOuter ?? true),
                  },
                })
              }
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                (feature.waterliningConfig?.stippledOuter ?? true)
                  ? 'bg-sky-950/80 border-sky-500/60 text-sky-200'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {(feature.waterliningConfig?.stippledOuter ?? true)
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
