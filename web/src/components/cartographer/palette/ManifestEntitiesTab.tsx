import React from 'react';
import { Link2 } from 'lucide-react';
import {
  WorldLocation,
  WorldNpc,
  WorldCreature,
  WorldArtifact,
  WorldDeity,
  TimelineEvent,
  CustomPlaceCategory,
} from '@/lib/types';
import { SelectedMapItem } from '../CartographerInspector';
import { resolvePlaceCategoryMeta } from '@/lib/engines/world/placeCategories';

export type ManifestTabKey =
  | 'locations'
  | 'npcs'
  | 'bestiary'
  | 'artifacts'
  | 'religions'
  | 'timeline';

interface ManifestEntitiesTabProps {
  activeTab: ManifestTabKey;
  locations: WorldLocation[];
  npcs: WorldNpc[];
  creatures: WorldCreature[];
  artifacts: WorldArtifact[];
  deities: WorldDeity[];
  timeline: TimelineEvent[];
  placeCategories: CustomPlaceCategory[];
  isPersian: boolean;
  filterQuery: string;
  onSelectEntityForPlacement: (type: string, id: string) => void;
  onSelectMapObject?: (item: SelectedMapItem) => void;
}

export const ManifestEntitiesTab: React.FC<ManifestEntitiesTabProps> = ({
  activeTab,
  locations,
  npcs,
  creatures,
  artifacts,
  deities,
  timeline,
  placeCategories,
  isPersian,
  filterQuery,
  onSelectEntityForPlacement,
  onSelectMapObject,
}) => {
  if (activeTab === 'locations') {
    if (locations.length === 0) {
      return (
        <div className="text-center py-8 text-xs text-zinc-500">
          {isPersian ? 'مکانی ثبت نشده است' : 'No locations found'}
        </div>
      );
    }
    return (
      <>
        {locations
          .filter(
            (loc) =>
              !filterQuery ||
              loc.name.toLowerCase().includes(filterQuery) ||
              loc.region?.toLowerCase().includes(filterQuery)
          )
          .map((loc) => {
            const isPlaced = loc.coordinates && loc.coordinates.x > 0;
            const isGeometryPlace =
              resolvePlaceCategoryMeta(loc.category, placeCategories).renderAs !== 'settlement';
            return (
              <div
                key={loc.id}
                className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
              >
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-zinc-200 truncate">{loc.name}</span>
                    {isPlaced ? (
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1 rounded font-mono">
                        {isPersian ? 'مستقر' : 'Placed'}
                      </span>
                    ) : (
                      <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1 rounded font-mono">
                        {isPersian ? 'نامستقر' : 'Unplaced'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {loc.region || (isPersian ? 'منطقه نامشخص' : 'Unknown region')} • {isPersian ? `سطح خطر ${loc.dangerLevel}` : `Danger ${loc.dangerLevel}`}
                  </div>
                </div>
                {isGeometryPlace && (
                  <button
                    onClick={() => onSelectMapObject?.({ type: 'location', data: loc })}
                    title={isPersian ? 'اتصال عارضه موجود' : 'Link existing terrain'}
                    className="p-1.5 bg-zinc-900 hover:bg-emerald-500/15 text-zinc-500 hover:text-emerald-300 border border-zinc-800 hover:border-emerald-500/30 rounded-xl transition-all shrink-0"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onSelectEntityForPlacement('location', loc.id)}
                  className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-zinc-950 border border-amber-500/30 rounded-xl text-xs font-medium transition-all shrink-0"
                >
                  {isPlaced ? (isPersian ? 'جابجایی' : 'Move') : (isPersian ? 'استقرار' : 'Place')}
                </button>
              </div>
            );
          })}
      </>
    );
  }

  if (activeTab === 'npcs') {
    if (npcs.length === 0) {
      return (
        <div className="text-center py-8 text-xs text-zinc-500">
          {isPersian ? 'شخصیتی ثبت نشده است' : 'No NPCs found'}
        </div>
      );
    }
    return (
      <>
        {npcs
          .filter(
            (n) =>
              !filterQuery ||
              n.name.toLowerCase().includes(filterQuery) ||
              n.title?.toLowerCase().includes(filterQuery)
          )
          .map((npc) => {
            const assignedLoc = locations.find((l) => l.id === npc.currentLocationId);
            return (
              <div
                key={npc.id}
                className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
              >
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-zinc-200 truncate">{npc.name}</span>
                    {npc.role && (
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded">
                        {npc.role}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {assignedLoc ? assignedLoc.name : (isPersian ? 'بدون مقر ثابت' : 'No station')}
                  </div>
                </div>
                <button
                  onClick={() => onSelectEntityForPlacement('npc', npc.id)}
                  className="px-2 py-1 bg-indigo-500/20 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-xl text-xs font-medium transition-all shrink-0"
                >
                  {isPersian ? 'نشاندن' : 'Station'}
                </button>
              </div>
            );
          })}
      </>
    );
  }

  if (activeTab === 'bestiary') {
    if (creatures.length === 0) {
      return (
        <div className="text-center py-8 text-xs text-zinc-500">
          {isPersian ? 'هیولایی در جانورنامه نیست' : 'No creatures registered'}
        </div>
      );
    }
    return (
      <>
        {creatures
          .filter((c) => !filterQuery || c.name.toLowerCase().includes(filterQuery))
          .map((c) => (
            <div
              key={c.id}
              className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
            >
              <div className="truncate">
                <span className="text-xs font-semibold text-zinc-200 truncate">{c.name}</span>
                <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {c.speciesCategory} • {isPersian ? `خطر ${c.dangerLevel}` : `Danger ${c.dangerLevel}`}
                </div>
              </div>
              <button
                onClick={() => onSelectEntityForPlacement('bestiary', c.id)}
                className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-medium transition-all shrink-0"
              >
                {isPersian ? 'ثبت قلمرو' : 'Place Den'}
              </button>
            </div>
          ))}
      </>
    );
  }

  if (activeTab === 'artifacts') {
    if (artifacts.length === 0) {
      return (
        <div className="text-center py-8 text-xs text-zinc-500">
          {isPersian ? 'عتیقه‌ای ثبت نشده است' : 'No relics registered'}
        </div>
      );
    }
    return (
      <>
        {artifacts
          .filter((a) => !filterQuery || a.name.toLowerCase().includes(filterQuery))
          .map((a) => (
            <div
              key={a.id}
              className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
            >
              <div className="truncate">
                <span className="text-xs font-semibold text-zinc-200 truncate">{a.name}</span>
                <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {a.rarity} • {a.originEra || (isPersian ? 'باستانی' : 'Ancient')}
                </div>
              </div>
              <button
                onClick={() => onSelectEntityForPlacement('artifact', a.id)}
                className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-white border border-purple-500/40 rounded-xl text-xs font-medium transition-all shrink-0"
              >
                {isPersian ? 'دفن عتیقه' : 'Place Vault'}
              </button>
            </div>
          ))}
      </>
    );
  }

  if (activeTab === 'religions') {
    if (deities.length === 0) {
      return (
        <div className="text-center py-8 text-xs text-zinc-500">
          {isPersian ? 'ایزدی ثبت نشده است' : 'No deities registered'}
        </div>
      );
    }
    return (
      <>
        {deities
          .filter((d) => !filterQuery || d.name.toLowerCase().includes(filterQuery))
          .map((d) => (
            <div
              key={d.id}
              className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
            >
              <div className="truncate">
                <span className="text-xs font-semibold text-zinc-200 truncate">{d.name}</span>
                <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {d.domain} • {d.sacredSymbol || (isPersian ? 'نماد مقدس' : 'Sacred')}
                </div>
              </div>
              <button
                onClick={() => onSelectEntityForPlacement('deity', d.id)}
                className="px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500 text-yellow-300 hover:text-zinc-950 border border-yellow-500/40 rounded-xl text-xs font-medium transition-all shrink-0"
              >
                {isPersian ? 'بنای معبد' : 'Place Shrine'}
              </button>
            </div>
          ))}
      </>
    );
  }

  if (activeTab === 'timeline') {
    if (timeline.length === 0) {
      return (
        <div className="text-center py-8 text-xs text-zinc-500">
          {isPersian ? 'رویدادی ثبت نشده است' : 'No timeline events'}
        </div>
      );
    }
    return (
      <>
        {timeline
          .filter((t) => !filterQuery || t.title.toLowerCase().includes(filterQuery))
          .map((t) => (
            <div
              key={t.id}
              className="p-2.5 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 hover:border-zinc-700 transition-colors"
            >
              <div className="truncate">
                <span className="text-xs font-semibold text-zinc-200 truncate">{t.title}</span>
                <div className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                  {t.yearOrEra} • {t.eraCategory}
                </div>
              </div>
              <button
                onClick={() => onSelectEntityForPlacement('timeline', t.id)}
                className="px-2 py-1 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/40 rounded-xl text-xs font-medium transition-all shrink-0"
              >
                {isPersian ? 'ثبت نبرد' : 'Pin Event'}
              </button>
            </div>
          ))}
      </>
    );
  }

  return null;
};
