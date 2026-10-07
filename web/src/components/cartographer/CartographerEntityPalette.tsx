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
  Plus,
  Check,
  Castle,
  Shield,
  Layers,
} from 'lucide-react';
import {
  WorldBible,
  WorldLocation,
  NPCDossier,
  WorldCreature,
  WorldArtifact,
  WorldDeity,
  TimelineEvent,
} from '@/lib/types';

interface CartographerEntityPaletteProps {
  worldBible: WorldBible;
  onSelectEntityForPlacement: (type: string, id: string) => void;
  onClose: () => void;
  isPersian: boolean;
}

type PaletteTab = 'locations' | 'npcs' | 'bestiary' | 'artifacts' | 'religions' | 'timeline';

export const CartographerEntityPalette: React.FC<CartographerEntityPaletteProps> = ({
  worldBible,
  onSelectEntityForPlacement,
  onClose,
  isPersian,
}) => {
  const [activeTab, setActiveTab] = useState<PaletteTab>('locations');
  const [search, setSearch] = useState('');

  const locations = worldBible.locations || [];
  const npcs = worldBible.npcs || [];
  const creatures = worldBible.bestiary || [];
  const artifacts = worldBible.artifacts || [];
  const deities = worldBible.religions || [];
  const timeline = worldBible.timeline || [];

  const tabs = [
    { id: 'locations' as const, label: { en: 'Locations', fa: 'مکان‌ها' }, icon: MapPin, count: locations.length },
    { id: 'npcs' as const, label: { en: 'NPCs', fa: 'شخصیت‌ها' }, icon: User, count: npcs.length },
    { id: 'bestiary' as const, label: { en: 'Bestiary', fa: 'جانوران' }, icon: Skull, count: creatures.length },
    { id: 'artifacts' as const, label: { en: 'Relics', fa: 'عتیقه‌ها' }, icon: Sparkles, count: artifacts.length },
    { id: 'religions' as const, label: { en: 'Deities', fa: 'ایزدان' }, icon: Sun, count: deities.length },
    { id: 'timeline' as const, label: { en: 'Timeline', fa: 'رویدادها' }, icon: History, count: timeline.length },
  ];

  const filterQuery = search.toLowerCase().trim();

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
        {/* Locations */}
        {activeTab === 'locations' && (
          locations.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'مکانی ثبت نشده است' : 'No locations found'}
            </div>
          ) : (
            locations
              .filter((loc) => !filterQuery || loc.name.toLowerCase().includes(filterQuery) || loc.region?.toLowerCase().includes(filterQuery))
              .map((loc) => {
                const isPlaced = loc.coordinates && loc.coordinates.x > 0;
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
                    <button
                      onClick={() => onSelectEntityForPlacement('location', loc.id)}
                      className="px-2 py-1 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-zinc-950 border border-amber-500/30 rounded-xl text-xs font-medium transition-all shrink-0"
                    >
                      {isPlaced ? (isPersian ? 'جابجایی' : 'Move') : (isPersian ? 'استقرار' : 'Place')}
                    </button>
                  </div>
                );
              })
          )
        )}

        {/* NPCs */}
        {activeTab === 'npcs' && (
          npcs.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'شخصیتی ثبت نشده است' : 'No NPCs found'}
            </div>
          ) : (
            npcs
              .filter((n) => !filterQuery || n.name.toLowerCase().includes(filterQuery) || n.title?.toLowerCase().includes(filterQuery))
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
              })
          )
        )}

        {/* Creatures */}
        {activeTab === 'bestiary' && (
          creatures.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'هیولایی در جانورنامه نیست' : 'No creatures registered'}
            </div>
          ) : (
            creatures
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
              ))
          )
        )}

        {/* Relics */}
        {activeTab === 'artifacts' && (
          artifacts.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'عتیقه‌ای ثبت نشده است' : 'No relics registered'}
            </div>
          ) : (
            artifacts
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
              ))
          )
        )}

        {/* Religions / Deities */}
        {activeTab === 'religions' && (
          deities.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'ایزدی ثبت نشده است' : 'No deities registered'}
            </div>
          ) : (
            deities
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
              ))
          )
        )}

        {/* Timeline Events */}
        {activeTab === 'timeline' && (
          timeline.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-500">
              {isPersian ? 'رویدادی ثبت نشده است' : 'No timeline events'}
            </div>
          ) : (
            timeline
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
              ))
          )
        )}
      </div>
    </div>
  );
};
