'use client';

import React from 'react';
import { Type } from 'lucide-react';
import type { MapTerrainFeature } from '@/lib/types';

interface TerrainCurvedTextSectionProps {
  feature: MapTerrainFeature;
  isPersian: boolean;
  onUpdateTerrain: (id: string, updated: Partial<MapTerrainFeature>) => void;
}

export const TerrainCurvedTextSection: React.FC<TerrainCurvedTextSectionProps> = ({
  feature,
  isPersian,
  onUpdateTerrain,
}) => {
  return (
    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-medium text-zinc-200">
            {isPersian ? 'عنوان منحنی خطی / جغرافیایی' : 'Curved Geographic Title'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            const currentEnabled = feature.labelConfig?.enabled ?? false;
            onUpdateTerrain(feature.id, {
              labelConfig: {
                ...feature.labelConfig,
                enabled: !currentEnabled,
                fontSize: feature.labelConfig?.fontSize ?? 15,
                letterSpacing: feature.labelConfig?.letterSpacing ?? 5,
                baselineOffset: feature.labelConfig?.baselineOffset ?? 0,
                alignment: feature.labelConfig?.alignment ?? 'center',
                uppercase: feature.labelConfig?.uppercase ?? true,
              },
            });
          }}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
            (feature.labelConfig?.enabled ?? false)
              ? 'bg-purple-950/80 border-purple-400/60 text-purple-200'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {(feature.labelConfig?.enabled ?? false)
            ? isPersian
              ? 'فعال'
              : 'Enabled'
            : isPersian
            ? 'غیرفعال'
            : 'Disabled'}
        </button>
      </div>

      {(feature.labelConfig?.enabled ?? false) && (
        <div className="space-y-2.5 pt-1 text-[11px]">
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'اندازه قلم' : 'Font Size'}</span>
              <span className="font-mono text-purple-300">
                {feature.labelConfig?.fontSize ?? 15}px
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={26}
              step={1}
              value={feature.labelConfig?.fontSize ?? 15}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  labelConfig: {
                    ...feature.labelConfig,
                    fontSize: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'فاصله حروف (Tracking)' : 'Letter Spacing'}</span>
              <span className="font-mono text-purple-300">
                {feature.labelConfig?.letterSpacing ?? 5}px
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={14}
              step={1}
              value={feature.labelConfig?.letterSpacing ?? 5}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  labelConfig: {
                    ...feature.labelConfig,
                    letterSpacing: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span>{isPersian ? 'جابجایی از خط مبنا' : 'Baseline Offset'}</span>
              <span className="font-mono text-purple-300">
                {feature.labelConfig?.baselineOffset ?? 0}px
              </span>
            </div>
            <input
              type="range"
              min={-24}
              max={24}
              step={2}
              value={feature.labelConfig?.baselineOffset ?? 0}
              onChange={(e) =>
                onUpdateTerrain(feature.id, {
                  labelConfig: {
                    ...feature.labelConfig,
                    baselineOffset: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-zinc-400">
              {isPersian ? 'حروف بزرگ تاریخی' : 'Uppercase Manuscript'}
            </span>
            <button
              type="button"
              onClick={() =>
                onUpdateTerrain(feature.id, {
                  labelConfig: {
                    ...feature.labelConfig,
                    uppercase: !(feature.labelConfig?.uppercase ?? true),
                  },
                })
              }
              className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-all ${
                (feature.labelConfig?.uppercase ?? true)
                  ? 'bg-purple-950/80 border-purple-500/60 text-purple-200'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              {(feature.labelConfig?.uppercase ?? true)
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
