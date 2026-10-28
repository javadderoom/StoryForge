import React from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Crosshair } from 'lucide-react';
import { MapEntityPlacement } from '@/lib/types';
import { ItemWrapper } from './types';

interface ElementItemRowProps {
  item: ItemWrapper;
  isPersian: boolean;
  isSelected?: boolean;
  onSelect: (item: ItemWrapper, additive?: boolean) => void;
  onToggleVisibility: (e: React.MouseEvent, item: ItemWrapper) => void;
  onToggleLock: (e: React.MouseEvent, item: ItemWrapper) => void;
  onDelete: (e: React.MouseEvent, item: ItemWrapper) => void;
}

export const ElementItemRow: React.FC<ElementItemRowProps> = ({
  item,
  isPersian,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onDelete,
}) => {
  return (
    <div
      onClick={(e) => onSelect(item, e.shiftKey || e.ctrlKey || e.metaKey)}
      className={`group px-2 py-1.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
        isSelected
          ? 'bg-amber-500/15 border-amber-500/50 shadow-sm ring-1 ring-amber-500/30'
          : item.visible
          ? 'bg-zinc-950/60 border-zinc-800/60 hover:bg-zinc-900/90 hover:border-zinc-700'
          : 'bg-zinc-950/30 border-zinc-800/30 opacity-60 hover:opacity-80'
      }`}
      title={
        isPersian
          ? 'کلیک برای انتخاب (Shift+Click برای انتخاب چندگانه)'
          : 'Click to select (Shift+Click to multi-select)'
      }
    >
      {/* Left: Eye Visibility Toggle + Name & Subtitle */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={(e) => onToggleVisibility(e, item)}
          className={`p-1 rounded-md transition-colors shrink-0 ${
            item.visible
              ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
              : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'
          }`}
          title={
            isPersian
              ? item.visible
                ? 'پنهان‌سازی این المنت'
                : 'نمایش این المنت'
              : item.visible
              ? 'Hide this element'
              : 'Show this element'
          }
        >
          {item.visible ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5" />
          )}
        </button>

        <div className="min-w-0 flex flex-col">
          <span
            className={`text-xs font-medium truncate flex items-center gap-1.5 ${
              item.visible ? 'text-zinc-200' : 'text-zinc-500 line-through'
            }`}
          >
            {item.kind === 'placement' && (item.raw as MapEntityPlacement).entityType === 'bestiary' && (
              <span className="text-rose-400 text-xs shrink-0">🐉</span>
            )}
            {item.kind === 'placement' && (item.raw as MapEntityPlacement).entityType === 'npc' && (
              <span className="text-sky-400 text-xs shrink-0">👤</span>
            )}
            {item.kind === 'placement' && (item.raw as MapEntityPlacement).entityType === 'artifact' && (
              <span className="text-amber-400 text-xs shrink-0">✨</span>
            )}
            {item.kind === 'placement' && (item.raw as MapEntityPlacement).entityType === 'timeline' && (
              <span className="text-purple-400 text-xs shrink-0">⚔️</span>
            )}
            <span className="truncate">{item.name}</span>
          </span>
          <span className="text-[10px] text-zinc-500 truncate font-mono">
            {item.subtitle}
          </span>
        </div>
      </div>

      {/* Right: Quick Lock, Focus & Delete Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Center / Focus Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(item);
          }}
          className="p-1 text-zinc-500 hover:text-amber-300 hover:bg-zinc-800 rounded-md transition-colors"
          title={isPersian ? 'نمایش در مرکز نقشه' : 'Focus on map'}
        >
          <Crosshair className="w-3 h-3" />
        </button>

        {/* Lock / Unlock Button */}
        <button
          onClick={(e) => onToggleLock(e, item)}
          className={`p-1 rounded-md transition-colors ${
            item.locked
              ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10'
              : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
          title={
            isPersian
              ? item.locked
                ? 'بازکردن قفل'
                : 'قفل کردن جهت جلوگیری از جابجایی'
              : item.locked
              ? 'Unlock element'
              : 'Lock element position'
          }
        >
          {item.locked ? (
            <Lock className="w-3 h-3" />
          ) : (
            <Unlock className="w-3 h-3" />
          )}
        </button>

        {/* Delete Button */}
        <button
          onClick={(e) => onDelete(e, item)}
          className="p-1 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
          title={isPersian ? 'حذف المنت' : 'Delete element'}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
