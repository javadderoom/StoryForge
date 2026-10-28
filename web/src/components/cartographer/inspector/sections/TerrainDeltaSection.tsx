'use client';

import React from 'react';
import { GitFork } from 'lucide-react';
import type { MapTerrainFeature } from '@/lib/types';
import { createDistributaryBranch } from '@/lib/engines/world/pixi/hydrologyNetwork';
import { notify } from '@/lib/notify';

interface TerrainDeltaSectionProps {
  feature: MapTerrainFeature;
  isPersian: boolean;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
  onAddTerrain?: (feature: MapTerrainFeature) => void;
  allFeatures?: MapTerrainFeature[];
  onSelectFeature?: (id: string) => void;
}

export const TerrainDeltaSection: React.FC<TerrainDeltaSectionProps> = ({
  feature,
  isPersian,
  onUpdateTerrain,
  onAddTerrain,
  allFeatures,
  onSelectFeature,
}) => {
  if (feature.type !== 'river') return null;

  const connectedParent = feature.connectedRiverId
    ? allFeatures?.find((f) => f.id === feature.connectedRiverId && f.type === 'river')
    : undefined;

  const childBranches = (allFeatures || []).filter(
    (f) => f.type === 'river' && f.connectedRiverId === feature.id
  );

  return (
    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
      {/* Header */}
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
              ? 'فن خودکار: روشن'
              : 'Auto Fan: On'
            : isPersian
            ? 'فن خودکار: خاموش'
            : 'Auto Fan: Off'}
        </button>
      </div>

      {/* Procedural Auto-fan sliders (optional legacy/quick mode) */}
      {feature.deltaConfig?.enabled && (
        <div className="space-y-2.5 pt-1 text-[11px] bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/60">
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'تعداد شاخه‌های فن خودکار' : 'Procedural Branches'}</span>
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
              min={10}
              max={75}
              step={1}
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
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
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

      {/* Authorable Topological Delta Branches */}
      <div className="pt-2 border-t border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-zinc-300">
            {isPersian ? 'انشعابات دستی دلتا (پیوسته)' : 'Authorable Delta Branches'}
          </span>
          <span className="text-[10px] text-cyan-400/80 font-mono">
            {isPersian ? 'بدون خطوط متقاطع' : 'Seamless outer ink'}
          </span>
        </div>

        {connectedParent && (
          <div className="p-2 rounded-lg bg-zinc-950/60 border border-zinc-800 text-[11px] flex items-center justify-between">
            <span className="text-zinc-400">
              {isPersian ? 'متصل به رود اصلی:' : 'Branch of:'}
            </span>
            <button
              type="button"
              onClick={() => onSelectFeature?.(connectedParent.id)}
              className="text-cyan-400 font-medium hover:underline truncate max-w-[150px]"
            >
              {connectedParent.name}
            </button>
          </div>
        )}

        {childBranches.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] text-zinc-400">
              {isPersian ? `شاخه‌های انشعابی (${childBranches.length}):` : `Active Branches (${childBranches.length}):`}
            </span>
            <div className="flex flex-wrap gap-1">
              {childBranches.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => onSelectFeature?.(branch.id)}
                  className="px-2 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 text-[10px] text-cyan-300 transition-colors truncate max-w-[140px]"
                  title={branch.name}
                >
                  {branch.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {onAddTerrain && (
          <div className="flex items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => {
                const branch = createDistributaryBranch(feature, {
                  angleOffsetDegrees: 28,
                  isPersian,
                });
                if (branch) {
                  onAddTerrain(branch);
                  onSelectFeature?.(branch.id);
                  notify.success(
                    isPersian
                      ? 'شاخه دلتا اضافه شد. با ابزار رأس (V) می‌توانید مصب آن را حرکت دهید.'
                      : 'Delta branch created. Use vertex edit (V) to position its mouth.'
                  );
                }
              }}
              className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-xs font-medium transition-colors flex items-center justify-center gap-1"
              title={isPersian ? 'ایجاد شاخه انشعابی به سمت راست' : 'Create diverging branch to the right'}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>{isPersian ? '+ شاخه راست (+۲۸°)' : '+ Fork Right (+28°)'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const branch = createDistributaryBranch(feature, {
                  angleOffsetDegrees: -28,
                  isPersian,
                });
                if (branch) {
                  onAddTerrain(branch);
                  onSelectFeature?.(branch.id);
                  notify.success(
                    isPersian
                      ? 'شاخه دلتا اضافه شد. با ابزار رأس (V) می‌توانید مصب آن را حرکت دهید.'
                      : 'Delta branch created. Use vertex edit (V) to position its mouth.'
                  );
                }
              }}
              className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-xs font-medium transition-colors flex items-center justify-center gap-1"
              title={isPersian ? 'ایجاد شاخه انشعابی به سمت چپ' : 'Create diverging branch to the left'}
            >
              <GitFork className="w-3.5 h-3.5 scale-x-[-1]" />
              <span>{isPersian ? '+ شاخه چپ (-۲۸°)' : '+ Fork Left (-28°)'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
