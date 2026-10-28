'use client';

import React, { useMemo } from 'react';
import {
  Layers,
  Folder,
  Unlink,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  MapPin,
  Mountain,
  Route,
  Castle,
  Shield,
  Sparkles,
  Flame,
  Swords,
  Info,
} from 'lucide-react';
import type { MapGroup, MapGroupMode, WorldLocation } from '@/lib/types/world';
import type { SelectedMapItem } from './types';
import { SearchableCombobox, type ComboboxOption } from '@/components/studio/SearchableCombobox';
import { notify } from '@/lib/notify';

export interface GroupInspectorProps {
  group: MapGroup;
  members: NonNullable<SelectedMapItem>[];
  locations: WorldLocation[];
  isPersian: boolean;
  onUpdateGroup: (groupId: string, patch: Partial<MapGroup>) => void;
  onSetGroupLocation: (groupId: string, locationId: string | undefined) => void;
  onSetGroupMode: (groupId: string, mode: MapGroupMode) => void;
  onUngroup: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onClose: () => void;
}

export const GroupInspector: React.FC<GroupInspectorProps> = ({
  group,
  members,
  locations,
  isPersian,
  onUpdateGroup,
  onSetGroupLocation,
  onSetGroupMode,
  onUngroup,
  onDeleteGroup,
  onClose,
}) => {
  const isUnified = group.mode === 'unified_entity';

  const locationOptions: ComboboxOption[] = useMemo(() => {
    return locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      subtext: loc.region ? `${isPersian ? 'منطقه: ' : 'Region: '}${loc.region}` : undefined,
      badge: loc.category || 'settlement',
      badgeColor: 'amber',
      icon: Castle,
    }));
  }, [locations, isPersian]);

  const handleModeChange = (newMode: MapGroupMode) => {
    if (newMode === group.mode) return;
    onSetGroupMode(group.id, newMode);
  };

  const renderMemberIcon = (item: NonNullable<SelectedMapItem>) => {
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

  const getMemberTitle = (item: NonNullable<SelectedMapItem>) => {
    switch (item.type) {
      case 'terrain':
        return item.data.name || (isPersian ? 'عنصر فیزیکی' : 'Terrain Feature');
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
      {/* Group Name Header */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1 block font-medium">
          {isPersian ? 'نام گروه / انتینتی' : 'Group Name'}
        </label>
        <input
          type="text"
          value={group.name}
          onChange={(e) => onUpdateGroup(group.id, { name: e.target.value })}
          placeholder={isPersian ? 'نام گروه...' : 'Group name...'}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Mode Selector: Unified Entity vs. Folder */}
      <div>
        <label className="text-[11px] text-zinc-400 mb-1.5 block font-medium">
          {isPersian ? 'ماهیت گروه در انجین بازی' : 'Engine Grouping Semantics'}
        </label>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => handleModeChange('unified_entity')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${
              isUnified
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isPersian ? 'انتینتی واحد داستان' : 'Unified Entity'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('folder')}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${
              !isUnified
                ? 'bg-stone-500/20 text-stone-200 border border-stone-500/40 font-semibold'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>{isPersian ? 'پوشه سازمانی' : 'Folder Group'}</span>
          </button>
        </div>

        {/* Informational Callout */}
        <div className="mt-2 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-start gap-2 text-[11px] text-zinc-400 leading-relaxed">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            {isUnified
              ? isPersian
                ? 'انجین بازی و هوش مصنوعی این بخش‌ها را یک قلمرو واحد می‌شناسند. انتساب یک لوکیشن، تمام بخش‌ها را به آن متصل می‌کند.'
                : 'The game engine and AI treat all parts as ONE canonical World Entity. Linking a location links all parts together.'
              : isPersian
              ? 'اجزای این گروه هویت مستقل دارند و صرفاً برای جابجایی دسته‌جمعی و لایه‌بندی بوم در یک پوشه قرار گرفته‌اند.'
              : 'Members keep distinct independent identities in the engine. Grouped for collective layout and canvas movement only.'}
          </span>
        </div>
      </div>

      {/* Linked World Location (Only in Unified Entity Mode) */}
      {isUnified && (
        <div className="pt-1">
          <label className="text-[11px] text-zinc-400 mb-1.5 block font-medium">
            {isPersian ? 'لوکیشن پیوندخورده از کتاب مرجع' : 'Linked Canonical Location'}
          </label>
          <SearchableCombobox
            value={group.locationId || ''}
            onChange={(locId) => onSetGroupLocation(group.id, locId || undefined)}
            options={locationOptions}
            placeholder={isPersian ? 'انتخاب مکان از دنیای داستان...' : 'Select location from World Bible...'}
            searchPlaceholder={isPersian ? 'جستجوی مکان...' : 'Search location...'}
            emptyMessage={isPersian ? 'مکانی یافت نشد' : 'No locations found'}
            isPersian={isPersian}
            clearable
          />
        </div>
      )}

      {/* Member Items Summary */}
      <div className="pt-2 border-t border-zinc-800/80">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
          <span>{isPersian ? 'اجزای عضو این گروه' : 'Group Members'}</span>
          <span className="font-mono text-zinc-300 font-medium">
            {members.length} {isPersian ? 'عضو' : 'items'}
          </span>
        </div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin p-1 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
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

      {/* Group Layer Controls: Show / Hide & Lock / Unlock */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onUpdateGroup(group.id, { visible: group.visible === false ? true : false })}
          title={isPersian ? 'نمایش یا پنهان‌سازی کل گروه' : 'Show or hide entire group'}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            group.visible === false
              ? 'bg-zinc-900/60 border-zinc-800 text-zinc-500'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}
        >
          {group.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          <span>{isPersian ? 'نمایش گروه' : 'Visible'}</span>
        </button>
        <button
          type="button"
          onClick={() => onUpdateGroup(group.id, { locked: !group.locked })}
          title={isPersian ? 'قفل یا بازگشایی کل گروه' : 'Lock or unlock entire group'}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all ${
            group.locked
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {group.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span>{isPersian ? 'قفل گروه' : 'Lock'}</span>
        </button>
      </div>

      {/* Ungroup & Actions */}
      <div className="pt-2 border-t border-zinc-800/80 space-y-2">
        <button
          type="button"
          onClick={async () => {
            const confirmed = await notify.confirm({
              title: isPersian ? 'جداسازی از گروه (Ungroup)' : 'Ungroup Elements',
              message: isPersian
                ? 'آیا این گروه منحل شود و عناصر به حالت مستقل بازگردند؟ (هندسه و ویژگی‌های عناصر حفظ می‌شود)'
                : 'Dissolve this group and revert elements to independent objects? (Geometry and properties are preserved)',
            });
            if (confirmed) {
              onUngroup(group.id);
              onClose();
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all"
        >
          <Unlink className="w-3.5 h-3.5 text-amber-400" />
          <span>{isPersian ? 'جداسازی و انحلال گروه (Ungroup)' : 'Ungroup Elements'}</span>
        </button>

        {onDeleteGroup && (
          <button
            type="button"
            onClick={async () => {
              const confirmed = await notify.confirm({
                title: isPersian ? 'حذف کامل گروه و عناصر' : 'Delete Group & Elements',
                message: isPersian
                  ? 'آیا تمام عناصر عضو این گروه حذف شوند؟'
                  : 'Delete all elements belonging to this group from the map?',
              });
              if (confirmed) {
                onDeleteGroup(group.id);
                onClose();
              }
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isPersian ? 'حذف تمام عناصر گروه' : 'Delete All Group Elements'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
