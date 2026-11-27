'use client';

import React, { useMemo } from 'react';
import {
  Flag,
  MapPin,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Swords,
  ShieldCheck,
} from 'lucide-react';
import type {
  MapEntityPlacement,
  Faction,
  WorldLocation,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import { MultiSearchableCombobox, type ComboboxOption } from '@/components/studio/SearchableCombobox';

interface FactionDossierProps {
  pin: MapEntityPlacement;
  faction: Faction;
  allFactions: Faction[];
  locations: WorldLocation[];
  isPersian: boolean;
  onUpdateFaction?: (id: string, updated: Partial<Faction>) => void;
  onDeletePlacement: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onClose: () => void;
}

export const FactionDossier: React.FC<FactionDossierProps> = ({
  pin,
  faction,
  allFactions,
  locations,
  isPersian,
  onUpdateFaction,
  onDeletePlacement,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onClose,
}) => {
  const locationOptions: ComboboxOption[] = useMemo(
    () => locations.map((l) => ({ id: l.id, name: l.name, subtext: l.region || l.category })),
    [locations]
  );

  const allies = useMemo(
    () =>
      (faction.alliedFactionIds ?? [])
        .map((id) => allFactions.find((f) => f.id === id)?.name)
        .filter((n): n is string => Boolean(n)),
    [faction.alliedFactionIds, allFactions]
  );

  const rivals = useMemo(
    () =>
      (faction.rivalFactionIds ?? [])
        .map((id) => allFactions.find((f) => f.id === id)?.name)
        .filter((n): n is string => Boolean(n)),
    [faction.rivalFactionIds, allFactions]
  );

  return (
    <div className="space-y-4 text-xs">
      {/* Header Card */}
      <div className="p-3.5 bg-zinc-900 border border-red-500/35 rounded-2xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/35 flex items-center justify-center text-red-400 shrink-0">
          <Flag className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={faction.name}
            onChange={(e) => onUpdateFaction?.(faction.id, { name: e.target.value })}
            className="w-full bg-transparent font-bold text-zinc-100 text-sm focus:outline-none focus:border-b focus:border-red-500/50 pb-0.5 truncate"
            placeholder={isPersian ? 'نام جناح' : 'Faction Name'}
          />
          <div className="text-[11px] text-red-300/80 mt-0.5 truncate">
            {faction.alignment || (isPersian ? 'گروه و جناح' : 'Faction')}
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'معرفی جناح' : 'Description'}
        </label>
        <textarea
          rows={3}
          value={faction.description}
          onChange={(e) => onUpdateFaction?.(faction.id, { description: e.target.value })}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs leading-relaxed focus:outline-none focus:border-red-500/50 resize-y"
        />
      </div>

      {/* Public Goals */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'اهداف آشکار' : 'Public Goals'}
        </label>
        <textarea
          rows={2}
          value={faction.publicGoals}
          onChange={(e) => onUpdateFaction?.(faction.id, { publicGoals: e.target.value })}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2 text-xs leading-relaxed focus:outline-none focus:border-red-500/50 resize-none"
        />
      </div>

      {/* Secret Agendas */}
      {faction.secretAgendas && (
        <div className="p-2.5 bg-zinc-900/80 border border-amber-500/25 rounded-xl">
          <div className="text-[10px] font-semibold text-amber-300 mb-1">
            {isPersian ? 'دستورکار پنهان (فقط استودیو)' : 'Secret Agenda (Studio Only)'}
          </div>
          <div className="text-zinc-300 leading-relaxed">{faction.secretAgendas}</div>
        </div>
      )}

      {/* Territories */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'قلمرو و پایگاه‌ها' : 'Territories'}
        </label>
        <MultiSearchableCombobox
          values={faction.territoryIds ?? []}
          onChange={(ids) => onUpdateFaction?.(faction.id, { territoryIds: ids })}
          options={locationOptions}
          isPersian={isPersian}
          placeholder={isPersian ? 'افزودن مکان قلمرو…' : 'Add territory location…'}
        />
      </div>

      {/* Allies & Rivals */}
      {(allies.length > 0 || rivals.length > 0) && (
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          {allies.length > 0 && (
            <div>
              <div className="text-[10px] text-emerald-400 font-medium mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {isPersian ? 'متحدان' : 'Allies'}
              </div>
              <div className="flex flex-wrap gap-1">
                {allies.map((name, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[10px]"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {rivals.length > 0 && (
            <div>
              <div className="text-[10px] text-rose-400 font-medium mb-1 flex items-center gap-1">
                <Swords className="w-3 h-3" />
                {isPersian ? 'رقبا و دشمنان' : 'Rivals'}
              </div>
              <div className="flex flex-wrap gap-1">
                {rivals.map((name, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-[10px]"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Placement Coordinates & Layer Controls */}
      <div className="p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl flex items-center justify-between text-zinc-400 font-mono text-xs">
        <span dir="ltr">X: {pin.x}</span>
        <span dir="ltr">Y: {pin.y}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onTogglePlacementVisibility?.(pin.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            pin.visible === false
              ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {pin.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{isPersian ? 'نمایش' : 'Visible'}</span>
        </button>
        <button
          type="button"
          onClick={() => onTogglePlacementLock?.(pin.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            pin.locked
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
          }`}
        >
          {pin.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span>{isPersian ? 'قفل' : 'Lock'}</span>
        </button>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={async () => {
            const confirmed = await notify.confirm({
              title: isPersian ? 'برداشتن سنجاق جناح' : 'Remove Faction Pin',
              message: isPersian
                ? `آیا سنجاق جناح «${faction.name}» از نقشه برداشته شود؟`
                : `Remove pin for faction "${faction.name}"?`,
            });
            if (confirmed) {
              onDeletePlacement(pin.id);
              onClose();
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>{isPersian ? 'برداشتن سنجاق از نقشه' : 'Remove Pin'}</span>
        </button>
      </div>
    </div>
  );
};
