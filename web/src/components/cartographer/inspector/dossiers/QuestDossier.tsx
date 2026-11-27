'use client';

import React, { useMemo } from 'react';
import {
  ScrollText,
  MapPin,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  CheckCircle2,
  User,
} from 'lucide-react';
import type {
  MapEntityPlacement,
  WorldQuest,
  WorldLocation,
  NPCDossier,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import { SearchableCombobox, type ComboboxOption } from '@/components/studio/SearchableCombobox';

interface QuestDossierProps {
  pin: MapEntityPlacement;
  quest: WorldQuest;
  locations: WorldLocation[];
  npcs: NPCDossier[];
  isPersian: boolean;
  onUpdateQuest?: (id: string, updated: Partial<WorldQuest>) => void;
  onDeletePlacement: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onClose: () => void;
}

export const QuestDossier: React.FC<QuestDossierProps> = ({
  pin,
  quest,
  locations,
  npcs,
  isPersian,
  onUpdateQuest,
  onDeletePlacement,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onClose,
}) => {
  const locationOptions: ComboboxOption[] = useMemo(
    () => locations.map((l) => ({ id: l.id, name: l.name, subtext: l.region || l.category })),
    [locations]
  );
  const npcOptions: ComboboxOption[] = useMemo(
    () => npcs.map((n) => ({ id: n.id, name: n.name, subtext: n.title || n.role })),
    [npcs]
  );

  return (
    <div className="space-y-4 text-xs">
      {/* Header Card */}
      <div className="p-3.5 bg-zinc-900 border border-emerald-500/35 rounded-2xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 shrink-0">
          <ScrollText className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={quest.title}
            onChange={(e) => onUpdateQuest?.(quest.id, { title: e.target.value })}
            className="w-full bg-transparent font-bold text-zinc-100 text-sm focus:outline-none focus:border-b focus:border-emerald-500/50 pb-0.5 truncate"
            placeholder={isPersian ? 'عنوان مأموریت' : 'Quest Title'}
          />
          <div className="text-[11px] text-emerald-300/80 mt-0.5 truncate">
            {quest.category || (isPersian ? 'مأموریت داستانی' : 'Story Quest')}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'خلاصه مأموریت' : 'Quest Summary'}
        </label>
        <textarea
          rows={3}
          value={quest.summary}
          onChange={(e) => onUpdateQuest?.(quest.id, { summary: e.target.value })}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl p-2.5 text-xs leading-relaxed focus:outline-none focus:border-emerald-500/50 resize-y"
        />
      </div>

      {/* Giver NPC & Origin Location */}
      <div className="space-y-2.5">
        <div>
          <label className="text-[11px] text-zinc-400 mb-1 flex items-center gap-1 font-medium">
            <User className="w-3 h-3 text-sky-400" />
            {isPersian ? 'کارفرما / شخصیت آغازگر' : 'Quest Giver NPC'}
          </label>
          <SearchableCombobox
            value={quest.giverNpcId || ''}
            onChange={(id) => onUpdateQuest?.(quest.id, { giverNpcId: id || undefined })}
            options={npcOptions}
            isPersian={isPersian}
            placeholder={isPersian ? 'انتخاب شخصیت…' : 'Select NPC…'}
          />
        </div>

        <div>
          <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
            {isPersian ? 'مکان شروع مأموریت' : 'Origin Location'}
          </label>
          <SearchableCombobox
            value={quest.originLocationId || ''}
            onChange={(id) => onUpdateQuest?.(quest.id, { originLocationId: id || undefined })}
            options={locationOptions}
            isPersian={isPersian}
            placeholder={isPersian ? 'انتخاب مکان…' : 'Select location…'}
          />
        </div>
      </div>

      {/* Objectives */}
      {quest.objectives && quest.objectives.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
          <div className="text-[11px] text-zinc-400 font-medium flex items-center justify-between">
            <span>{isPersian ? 'اهداف و مراحل' : 'Objectives'}</span>
            <span dir="ltr" className="text-[10px] font-mono text-zinc-500">
              {quest.objectives.length}
            </span>
          </div>
          <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-thin">
            {quest.objectives.map((obj, idx) => (
              <div
                key={obj.id || idx}
                className="p-2 bg-zinc-900 border border-zinc-800/80 rounded-xl flex items-start gap-2 text-zinc-300"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs leading-relaxed">{obj.description}</div>
                  {obj.isOptional && (
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {isPersian ? 'اختیاری' : 'Optional'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rewards summary */}
      {quest.rewards && (quest.rewards.goldReward || quest.rewards.narrativeResolution) && (
        <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/20 rounded-xl space-y-1">
          <div className="text-[10px] font-semibold text-emerald-300">
            {isPersian ? 'پاداش و فرجام' : 'Rewards & Resolution'}
          </div>
          {typeof quest.rewards.goldReward === 'number' && quest.rewards.goldReward > 0 && (
            <div className="text-[11px] text-amber-300" dir="ltr">
              +{quest.rewards.goldReward} Gold
            </div>
          )}
          {quest.rewards.narrativeResolution && (
            <div className="text-[11px] text-zinc-300 leading-relaxed">
              {quest.rewards.narrativeResolution}
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
              title: isPersian ? 'برداشتن سنجاق مأموریت' : 'Remove Quest Pin',
              message: isPersian
                ? `آیا سنجاق مأموریت «${quest.title}» از نقشه برداشته شود؟`
                : `Remove pin for quest "${quest.title}"?`,
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
