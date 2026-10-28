'use client';

import React from 'react';
import { GitFork } from 'lucide-react';
import type { MapTerrainFeature } from '@/lib/types';

interface TerrainDeltaSectionProps {
  feature: MapTerrainFeature;
  isPersian: boolean;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
}

export const TerrainDeltaSection: React.FC<TerrainDeltaSectionProps> = ({
  feature,
  isPersian,
  onUpdateTerrain,
}) => {
  if (feature.type !== 'river') return null;

  return (
    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-medium text-zinc-200">
            {isPersian ? 'دلتا و شاخه‌های مصب' : 'Delta Distributary Fan'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const enabled = !feature.deltaConfig?.enabled;
            onUpdateTerrain(feature.id, {
              deltaConfig: {
                ...feature.deltaConfig,
                enabled,
                distributariesCount: feature.deltaConfig?.distributariesCount ?? 4,
                spreadAngleDegrees: feature.deltaConfig?.spreadAngleDegrees ?? 48,
                apexFraction: feature.deltaConfig?.apexFraction ?? 0.8,
              },
            });
          }}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
            feature.deltaConfig?.enabled
              ? 'bg-cyan-950/80 border-cyan-400/60 text-cyan-200'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {feature.deltaConfig?.enabled
            ? isPersian
              ? 'فعال'
              : 'Enabled'
            : isPersian
            ? 'غیرفعال'
            : 'Disabled'}
        </button>
      </div>

      {feature.deltaConfig?.enabled && (
        <div className="space-y-2.5 pt-1 text-[11px]">
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'تعداد شاخه‌های مصب' : 'Distributary Branches'}</span>
              <span className="font-mono text-cyan-300">
                {feature.deltaConfig.distributariesCount ?? 4}
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={6}
              step={1}
              value={feature.deltaConfig.distributariesCount ?? 4}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  deltaConfig: {
                    ...feature.deltaConfig,
                    distributariesCount: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'زاویه گستردگی فن' : 'Fan Spread Angle'}</span>
              <span className="font-mono text-cyan-300">
                {feature.deltaConfig.spreadAngleDegrees ?? 48}°
              </span>
            </div>
            <input
              type="range"
              min={25}
              max={75}
              step={5}
              value={feature.deltaConfig.spreadAngleDegrees ?? 48}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  deltaConfig: {
                    ...feature.deltaConfig,
                    spreadAngleDegrees: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-cyan-500 cursor-pointer"
            />
          </div>

          {/* Lush Delta Canopy Groves Toggle */}
          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400">
              {isPersian ? 'پوشش گیاهی و بیشه‌های دلتا' : 'Delta Canopy Groves'}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateTerrain(feature.id, {
                  deltaConfig: {
                    ...feature.deltaConfig,
                    showVegetation: !(feature.deltaConfig?.showVegetation ?? true),
                  },
                })
              }
              className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                (feature.deltaConfig?.showVegetation ?? true)
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50'
              }`}
            >
              {(feature.deltaConfig?.showVegetation ?? true)
                ? isPersian
                  ? 'روشن'
                  : 'ENABLED'
                : isPersian
                ? 'خاموش'
                : 'DISABLED'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
