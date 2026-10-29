'use client';

import React, { useState, useMemo } from 'react';
import { User } from 'lucide-react';
import type { Faction } from '@/lib/types/world';
import { SearchableCombobox, type ComboboxOption } from '@/components/studio/SearchableCombobox';
import type { ContextMenuGenerateHandler } from './types';

interface ContextMenuNpcSectionProps {
  isPersian: boolean;
  factions: Faction[];
  onBack: () => void;
  onGenerate: ContextMenuGenerateHandler;
}

export const ContextMenuNpcSection: React.FC<ContextMenuNpcSectionProps> = ({
  isPersian,
  factions,
  onBack,
  onGenerate,
}) => {
  const [npcRole, setNpcRole] = useState<string>('Hermit / Dweller');
  const [npcDc, setNpcDc] = useState<number>(14);
  const [npcFactionId, setNpcFactionId] = useState<string>('');

  const factionOptions = useMemo<ComboboxOption[]>(() => {
    return factions.map((f) => ({
      id: f.id,
      name: f.name,
      subtext: f.alignment || undefined,
    }));
  }, [factions]);

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="flex items-center justify-between border-b border-[#3d2f23] pb-1.5">
        <button
          type="button"
          onClick={onBack}
          className="text-[#baa48d] hover:text-[#eedec8] text-[11px] flex items-center gap-1"
        >
          {isPersian ? 'بازگشت →' : '← Back'}
        </button>
        <div className="font-semibold text-[#f1d6b0]">
          {isPersian ? '👤 تنظیمات شخصیت مستقر' : '👤 Stationed NPC'}
        </div>
      </div>

      {/* Role */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
          {isPersian ? 'کهن‌الگو / نقش' : 'Archetype / Role'}
        </label>
        <select
          value={npcRole}
          onChange={(e) => setNpcRole(e.target.value)}
          className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
        >
          <option value="Hermit / Dweller">
            {isPersian ? 'زاهد / گوشه‌نشین تنها' : 'Hermit / Dweller'}
          </option>
          <option value="Nomad Outrider">
            {isPersian ? 'کوچ‌نشین بیابان‌گرد' : 'Nomad Outrider'}
          </option>
          <option value="Caravan Merchant">
            {isPersian ? 'بازرگان کاروان' : 'Caravan Merchant'}
          </option>
          <option value="Desert Mystic">
            {isPersian ? 'عارف / پیشگوی زیست‌بوم' : 'Biome Mystic / Shaman'}
          </option>
          <option value="Outlaw / Bandit Scout">
            {isPersian ? 'دیده‌بان راهزنان / یاغی' : 'Outlaw / Bandit Scout'}
          </option>
          <option value="Frontier Guard">
            {isPersian ? 'نگهبان و دیده‌بان مرزی' : 'Frontier Guard'}
          </option>
          <option value="Expedition Scholar">
            {isPersian ? 'پژوهشگر و نگارنده کهن' : 'Expedition Scholar'}
          </option>
        </select>
      </div>

      {/* Interaction DC */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium flex items-center justify-between">
          <span>{isPersian ? 'درجه سختی تعامل (DC):' : 'Interaction DC:'}</span>
          <span dir="ltr" className="font-mono text-[#d8ab6c] font-bold">
            DC {npcDc}
          </span>
        </label>
        <div className="grid grid-cols-5 gap-1" dir="ltr">
          {[10, 12, 14, 16, 18].map((dc) => (
            <button
              key={dc}
              type="button"
              onClick={() => setNpcDc(dc)}
              className={`py-1 rounded text-center font-semibold text-[10.5px] border transition-colors ${
                npcDc === dc
                  ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                  : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
              }`}
            >
              {dc}
            </button>
          ))}
        </div>
      </div>

      {/* Faction Allegiance */}
      {factions.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
            {isPersian ? 'وابستگی گروهی / فرقه' : 'Faction Allegiance'}
          </label>
          <SearchableCombobox
            value={npcFactionId}
            onChange={(fid) => setNpcFactionId(fid)}
            options={factionOptions}
            placeholder={isPersian ? 'مستقل / بی‌پناه...' : 'Independent / Solitary...'}
            searchPlaceholder={isPersian ? 'جستجوی فرقه...' : 'Search faction...'}
            emptyMessage={isPersian ? 'فرقه‌ای یافت نشد' : 'No factions found'}
            isPersian={isPersian}
            clearable
          />
        </div>
      )}

      {/* Button */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            const matchedFaction = factions.find((f) => f.id === npcFactionId);
            void onGenerate('npc', {
              role: npcRole,
              dc: npcDc,
              factionId: npcFactionId || undefined,
              factionName: matchedFaction?.name,
            });
          }}
          className="w-full py-1.5 bg-[#d8ab6c] hover:bg-[#e4bb7e] text-[#1a1410] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
        >
          <User className="w-3.5 h-3.5" />
          <span>{isPersian ? 'تولید شخصیت مستقر' : 'Generate Stationed NPC'}</span>
        </button>
      </div>
    </div>
  );
};
