'use client';

import React from 'react';
import {
  Layers,
  Folder,
  Copy,
  Trash2,
  X,
  Info,
  Mountain,
  Castle,
  Route,
  Flame,
  Shield,
  Sparkles,
  Swords,
  MapPin,
} from 'lucide-react';
import type { MapGroupMode } from '@/lib/types/world';
import type { SingleSelectedMapItem } from './types';

export interface MultiSelectionInspectorProps {
  members: SingleSelectedMapItem[];
  isPersian: boolean;
  onGroup: (mode: MapGroupMode) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export const MultiSelectionInspector: React.FC<MultiSelectionInspectorProps> = ({
  members,
  isPersian,
  onGroup,
  onDuplicate,
  onDelete,
  onClose,
}) => {
  const renderMemberIcon = (item: SingleSelectedMapItem) => {
    switch (item.type) {
      case 'terrain':
        return <Mountain className="w-3.5 h-3.5 text-emerald-400" />;
      case 'location':
        return <Castle className="w-3.5 h-3.5 text-amber-400" />;
      case 'route':
      case 'trade_route':
        return <Route className="w-3.5 h-3.5 text-cyan-400" />;
      case 'placement': {
        const pin = item.data;
        if (pin.entityType === 'bestiary') return <Flame className="w-3.5 h-3.5 text-rose-400" />;
        if (pin.entityType === 'npc') return <Shield className="w-3.5 h-3.5 text-sky-400" />;
        if (pin.entityType === 'artifact') return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
        if (pin.entityType === 'timeline') return <Swords className="w-3.5 h-3.5 text-purple-400" />;
        return <MapPin className="w-3.5 h-3.5 text-purple-400" />;
      }
      default:
        return <MapPin className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const getMemberTitle = (item: SingleSelectedMapItem) => {
    switch (item.type) {
      case 'terrain':
        return item.data.name || (isPersian ? 'عارضه طبیعی' : 'Terrain Feature');
      case 'location':
        return item.data.name || (isPersian ? 'مکان' : 'Location');
      case 'route':
      case 'trade_route':
        return item.data.name || (isPersian ? 'مسیر' : 'Route');
      case 'placement':
        return item.data.customLabel || item.data.entityId;
      default:
        return isPersian ? 'عنصر نقشه' : 'Map Item';
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Header Info Banner */}
      <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold block">
            {isPersian ? 'تعداد عناصر انتخاب‌شده' : 'Selected Elements'}
          </span>
          <span className="text-sm font-bold text-amber-300 font-mono">
            {members.length} {isPersian ? 'مورد' : 'items'}
          </span>
        </div>
        <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-[10px] font-mono text-zinc-400">
          Ctrl+G
        </span>
      </div>

      {/* Primary Grouping Actions */}
      <div className="space-y-2">
        <label className="text-[11px] text-zinc-300 block font-semibold">
          {isPersian ? 'گزینه‌های گروه‌بندی عناصر' : 'Grouping Options'}
        </label>

        {/* Option 1: Unified Story Entity */}
        <button
          type="button"
          onClick={() => onGroup('unified_entity')}
          className="w-full text-right p-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 transition-all flex flex-col gap-1.5 shadow-sm group"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-300">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs text-amber-100 group-hover:text-white">
                {isPersian ? 'گروه‌بندی به عنوان انتینتی واحد داستان' : 'Group as Unified Story Entity'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-amber-400/80 px-1.5 py-0.5 rounded bg-amber-500/20">
              Ctrl+G
            </span>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            {isPersian
              ? 'مخصوص عناصری که در دنیای داستان یک پدیده واحد هستند (مانند رودخانه و شاخه‌های دلتا). یک لوکیشن را به تمام اجزا لینک می‌کند و عناوین متنی اضافی را حذف می‌کند.'
              : 'Merges elements into ONE canonical Story Entity (e.g. river and delta branches). Links one location to all parts and suppresses redundant titles.'}
          </p>
        </button>

        {/* Option 2: Folder Group */}
        <button
          type="button"
          onClick={() => onGroup('folder')}
          className="w-full text-right p-3 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 transition-all flex flex-col gap-1.5 shadow-sm group"
        >
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-zinc-800 text-stone-300">
                <Folder className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs text-zinc-100 group-hover:text-white">
                {isPersian ? 'گروه‌بندی در پوشه سازمانی' : 'Group into Folder'}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">
            {isPersian
              ? 'صرفاً برای نظم بوم و جابجایی همزمان اجزا. عناصر هویت مستقل خود را در انجین بازی حفظ می‌کنند.'
              : 'For collective canvas movement and layout organization only. Member elements maintain independent identities in the game engine.'}
          </p>
        </button>
      </div>

      {/* Selected Items Breakdown */}
      <div className="pt-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
          <span>{isPersian ? 'عناصر انتخاب‌شده' : 'Selected Elements'}</span>
          <span className="font-mono text-zinc-300 font-medium">{members.length}</span>
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin p-1 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
          {members.map((item, idx) => (
            <div
              key={`${item.type}_${item.data.id}_${idx}`}
              className="flex items-center gap-2 p-1.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[11px] text-zinc-200"
            >
              {renderMemberIcon(item)}
              <span className="truncate flex-1 font-medium">{getMemberTitle(item)}</span>
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-mono">
                {item.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Common Operations */}
      <div className="pt-2 border-t border-zinc-800/80 flex items-center gap-2">
        <button
          type="button"
          onClick={onDuplicate}
          title={isPersian ? 'تکثیر همه (Ctrl+D)' : 'Duplicate all (Ctrl+D)'}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 text-xs font-medium transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-amber-400" />
          <span>{isPersian ? 'تکثیر (Ctrl+D)' : 'Duplicate'}</span>
        </button>

        <button
          type="button"
          onClick={onDelete}
          title={isPersian ? 'حذف عناصر انتخاب‌شده (Delete)' : 'Delete selected (Delete)'}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span>{isPersian ? 'حذف (Delete)' : 'Delete'}</span>
        </button>
      </div>
    </div>
  );
};
