'use client';

import React from 'react';
import { Wind } from 'lucide-react';
import type { MapTerrainFeature } from '@/lib/types';

interface TerrainDuneSectionProps {
  feature: MapTerrainFeature;
  isPersian: boolean;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
}

export const TerrainDuneSection: React.FC<TerrainDuneSectionProps> = ({
  feature,
  isPersian,
  onUpdateTerrain,
}) => {
  if (feature.type !== 'desert' && feature.type !== 'wasteland') return null;

  return (
    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-medium text-zinc-200">
            {isPersian ? 'تپه‌های ماسه‌ای برخان' : 'Barchan Dune Field'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const currentEnabled = feature.duneConfig?.enabled ?? true;
            onUpdateTerrain(feature.id, {
              duneConfig: {
                ...feature.duneConfig,
                enabled: !currentEnabled,
                density: feature.duneConfig?.density ?? 'medium',
                windAngleDegrees: feature.duneConfig?.windAngleDegrees ?? 35,
                duneScale: feature.duneConfig?.duneScale ?? 1.0,
                rippleHatching: feature.duneConfig?.rippleHatching ?? true,
              },
            });
          }}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
            (feature.duneConfig?.enabled ?? true)
              ? 'bg-amber-950/80 border-amber-400/60 text-amber-200'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {(feature.duneConfig?.enabled ?? true)
            ? isPersian
              ? 'فعال'
              : 'Enabled'
            : isPersian
            ? 'غیرفعال'
            : 'Disabled'}
        </button>
      </div>

      {(feature.duneConfig?.enabled ?? true) && (
        <div className="space-y-2.5 pt-1 text-[11px]">
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'تراکم تپه‌ها' : 'Dune Density'}</span>
              <span className="font-mono text-amber-300 capitalize">
                {feature.duneConfig?.density ?? 'medium'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['sparse', 'medium', 'dense'] as const).map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() =>
                    onUpdateTerrain(feature.id, {
                      duneConfig: {
                        ...feature.duneConfig,
                        density,
                      },
                    })
                  }
                  className={`py-1 rounded text-[10px] font-medium transition-all border ${
                    (feature.duneConfig?.density ?? 'medium') === density
                      ? 'bg-amber-900/60 border-amber-500/80 text-amber-200'
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
              <span>{isPersian ? 'جهت وزش باد غالب' : 'Prevailing Wind Heading'}</span>
              <span className="font-mono text-amber-300">
                {feature.duneConfig?.windAngleDegrees ?? 35}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={feature.duneConfig?.windAngleDegrees ?? 35}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  duneConfig: {
                    ...feature.duneConfig,
                    windAngleDegrees: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'مقیاس برخان‌ها' : 'Dune Scale'}</span>
              <span className="font-mono text-amber-300">
                {(feature.duneConfig?.duneScale ?? 1.0).toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.8}
              step={0.1}
              value={feature.duneConfig?.duneScale ?? 1.0}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  duneConfig: {
                    ...feature.duneConfig,
                    duneScale: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-zinc-400">
              {isPersian ? 'موج‌های موازی شیب بادگیر' : 'Windward Ripple Striae'}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateTerrain(feature.id, {
                  duneConfig: {
                    ...feature.duneConfig,
                    rippleHatching: !(feature.duneConfig?.rippleHatching ?? true),
                  },
                })
              }
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                (feature.duneConfig?.rippleHatching ?? true)
                  ? 'bg-amber-950/80 border-amber-500/60 text-amber-200'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {(feature.duneConfig?.rippleHatching ?? true)
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
