import React from 'react';
import {
  Globe,
  MapPin,
  Waves,
  Split,
  Trees,
  Mountain,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Pencil,
  ArrowUp,
  ArrowDown,
  Trash2,
  AlertTriangle,
  Link2,
} from 'lucide-react';
import {
  MapTerrainFeature,
  MapEntityPlacement,
  WorldLocation,
} from '@/lib/types';
import { SelectedMapItem } from '../CartographerInspector';
import { notify } from '@/lib/notify';
import {
  MAP_OBJECT_GROUP_ORDER,
  sortTerrainForList,
  terrainGroup,
  type MapObjectGroupKey,
} from '@/lib/engines/world/mapObjectOrder';
import { getMapSemanticReconciliation } from '@/lib/engines/world/mapSemantics';

const GROUP_LABELS: Record<MapObjectGroupKey, { en: string; fa: string }> = {
  landmass: { en: 'Landmasses', fa: 'خشکی‌ها' },
  water: { en: 'Waters & Rivers', fa: 'آب‌ها و رودها' },
  range: { en: 'Ranges & Peaks', fa: 'رشته‌کوه‌ها و قله‌ها' },
  valley: { en: 'Valleys & Chasms', fa: 'دره‌ها و شکاف‌ها' },
  biome: { en: 'Biomes & Soil', fa: 'اقلیم‌ها و خاک' },
};

function hasNoGeometry(feature: MapTerrainFeature): boolean {
  if (feature.polygon && feature.polygon.length >= 3) return false;
  if (feature.points && feature.points.length >= 1) return false;
  if (typeof feature.x === 'number' && typeof feature.y === 'number') return false;
  return true;
}

interface MapObjectsTabProps {
  terrainFeatures: MapTerrainFeature[];
  placements: MapEntityPlacement[];
  locations: WorldLocation[];
  reconciliation: ReturnType<typeof getMapSemanticReconciliation>;
  isPersian: boolean;
  filterQuery: string;
  editing: { kind: 'terrain' | 'placement'; id: string } | null;
  draftName: string;
  onDraftNameChange: (val: string) => void;
  onStartRename: (kind: 'terrain' | 'placement', id: string, current: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onSelectMapObject?: (item: SelectedMapItem) => void;
  onToggleTerrainVisibility?: (id: string) => void;
  onToggleTerrainLock?: (id: string) => void;
  onReorderTerrain?: (id: string, direction: 'forward' | 'backward') => void;
  onDeleteTerrain?: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onReorderPlacement?: (id: string, direction: 'forward' | 'backward') => void;
  onDeletePlacement?: (id: string) => void;
  resolvePinName: (pin: MapEntityPlacement) => string;
}

export const MapObjectsTab: React.FC<MapObjectsTabProps> = ({
  terrainFeatures,
  placements,
  locations,
  reconciliation,
  isPersian,
  filterQuery,
  editing,
  draftName,
  onDraftNameChange,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onSelectMapObject,
  onToggleTerrainVisibility,
  onToggleTerrainLock,
  onReorderTerrain,
  onDeleteTerrain,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onReorderPlacement,
  onDeletePlacement,
  resolvePinName,
}) => {
  const matchesFilter = (name: string) => !filterQuery || name.toLowerCase().includes(filterQuery);

  const groups = MAP_OBJECT_GROUP_ORDER.map((key) => ({
    key,
    label: GROUP_LABELS[key],
    items: sortTerrainForList(terrainFeatures).filter((f) => terrainGroup(f.type) === key),
  })).filter((group) => group.items.length > 0);

  const visiblePlacements = placements.filter((p) => matchesFilter(resolvePinName(p)));

  return (
    <div className="space-y-3">
      {(reconciliation.unlinkedPlaces.length > 0 ||
        reconciliation.missingPlaceLinks.length > 0) && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[10px] text-amber-200 leading-relaxed">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {isPersian ? 'ناسازگاری نقشه و روایت' : 'Map / story reconciliation'}
          </div>
          {reconciliation.unlinkedPlaces.length > 0 && (
            <div className="mt-1 text-amber-200/80">
              {isPersian
                ? `${reconciliation.unlinkedPlaces.length} مکان غیرنقطه‌ای هندسه‌ای متصل ندارد.`
                : `${reconciliation.unlinkedPlaces.length} non-point place(s) have no linked terrain.`}
            </div>
          )}
          {reconciliation.missingPlaceLinks.length > 0 && (
            <div className="mt-0.5 text-rose-300/90">
              {isPersian
                ? `${reconciliation.missingPlaceLinks.length} عارضه به مکان حذف‌شده اشاره می‌کند.`
                : `${reconciliation.missingPlaceLinks.length} terrain feature(s) link to a missing place.`}
            </div>
          )}

          {reconciliation.unlinkedPlaces.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {reconciliation.unlinkedPlaces.slice(0, 4).map((place) => (
                <button
                  key={place.id}
                  onClick={() => onSelectMapObject?.({ type: 'location', data: place })}
                  className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-lg bg-amber-500/5 border border-amber-500/20 text-left text-[10px] text-amber-100/90 hover:bg-amber-500/15 hover:border-amber-500/40 transition-colors"
                >
                  <Link2 className="w-3 h-3 shrink-0" />
                  <span className="truncate flex-1">{place.name}</span>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-amber-300/80">
                    {isPersian ? 'اتصال' : 'Pair'}
                  </span>
                </button>
              ))}
              {reconciliation.unlinkedPlaces.length > 4 && (
                <div className="px-1 text-[9px] text-amber-200/60">
                  {isPersian
                    ? `و ${reconciliation.unlinkedPlaces.length - 4} مکان دیگر`
                    : `+${reconciliation.unlinkedPlaces.length - 4} more`}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {groups.map((group) => {
        const GroupIcon =
          group.key === 'landmass'
            ? Globe
            : group.key === 'water'
            ? Waves
            : group.key === 'range'
            ? Mountain
            : group.key === 'valley'
            ? Split
            : Trees;
        const items = group.items.filter((f) => matchesFilter(f.name));
        if (items.length === 0) return null;
        return (
          <div key={group.key} className="space-y-1">
            <div className="flex items-center gap-1.5 px-1 pt-1">
              <GroupIcon className="w-3 h-3 text-amber-400/70" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                {isPersian ? group.label.fa : group.label.en}
              </span>
              <span className="text-[10px] text-zinc-600 font-mono">{items.length}</span>
            </div>

            {items.map((feature) => (
              <div
                key={feature.id}
                className="p-2 bg-zinc-900/70 border border-zinc-800/80 rounded-xl flex items-center gap-1.5 hover:border-zinc-700 transition-colors"
              >
                <button
                  onClick={() => onToggleTerrainVisibility?.(feature.id)}
                  title={isPersian ? 'نمایش یا پنهان‌سازی' : 'Show or hide'}
                  className="shrink-0 text-zinc-500 hover:text-amber-300 transition-colors"
                >
                  {feature.visible === false ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5 text-amber-400/80" />
                  )}
                </button>
                <button
                  onClick={() => onToggleTerrainLock?.(feature.id)}
                  title={isPersian ? 'قفل کردن' : 'Lock or unlock'}
                  className="shrink-0 text-zinc-500 hover:text-amber-300 transition-colors"
                >
                  {feature.locked ? (
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                </button>

                {editing?.kind === 'terrain' && editing.id === feature.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => onDraftNameChange(e.target.value)}
                    onBlur={onCommitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onCommitRename();
                      if (e.key === 'Escape') onCancelRename();
                    }}
                    className="flex-1 min-w-0 bg-zinc-900 border border-amber-500/50 text-zinc-100 rounded-lg px-1.5 py-0.5 text-xs focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => onSelectMapObject?.({ type: 'terrain', data: feature })}
                    className="flex-1 min-w-0 text-left"
                    title={isPersian ? 'انتخاب روی نقشه' : 'Select on the map'}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-200 truncate">
                        {feature.name}
                      </span>
                      {hasNoGeometry(feature) && (
                        <AlertTriangle
                          className="w-3 h-3 text-amber-500 shrink-0"
                          aria-label={isPersian ? 'بدون هندسه' : 'No geometry'}
                        />
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono truncate">
                      {feature.type}
                      {feature.locationId
                        ? ` · ${locations.find((loc) => loc.id === feature.locationId)?.name || feature.locationId}`
                        : ''}
                    </div>
                  </button>
                )}

                <button
                  onClick={() => onStartRename('terrain', feature.id, feature.name)}
                  title={isPersian ? 'تغییر نام' : 'Rename'}
                  className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onReorderTerrain?.(feature.id, 'forward')}
                  title={isPersian ? 'یک پله جلوتر' : 'Bring forward'}
                  className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onReorderTerrain?.(feature.id, 'backward')}
                  title={isPersian ? 'یک پله عقب‌تر' : 'Send backward'}
                  className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                <button
                  onClick={async () => {
                    const confirmed = await notify.confirm({
                      title: isPersian ? 'حذف عارضه طبیعی' : 'Delete terrain feature',
                      message: isPersian
                        ? `آیا از حذف "${feature.name}" اطمینان دارید؟`
                        : `Delete "${feature.name}" from the map?`,
                    });
                    if (confirmed) onDeleteTerrain?.(feature.id);
                  }}
                  title={isPersian ? 'حذف' : 'Delete'}
                  className="shrink-0 text-zinc-600 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        );
      })}

      {/* Lore pins */}
      {visiblePlacements.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 px-1 pt-1">
            <MapPin className="w-3 h-3 text-amber-400/70" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              {isPersian ? 'سنجاق‌های داستانی' : 'Lore Pins'}
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">
              {visiblePlacements.length}
            </span>
          </div>

          {visiblePlacements.map((pin) => (
            <div
              key={pin.id}
              className="p-2 bg-zinc-900/70 border border-zinc-800/80 rounded-xl flex items-center gap-1.5 hover:border-zinc-700 transition-colors"
            >
              <button
                onClick={() => onTogglePlacementVisibility?.(pin.id)}
                title={isPersian ? 'نمایش یا پنهان‌سازی' : 'Show or hide'}
                className="shrink-0 text-zinc-500 hover:text-amber-300 transition-colors"
              >
                {pin.visible === false ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-amber-400/80" />
                )}
              </button>
              <button
                onClick={() => onTogglePlacementLock?.(pin.id)}
                title={isPersian ? 'قفل کردن' : 'Lock or unlock'}
                className="shrink-0 text-zinc-500 hover:text-amber-300 transition-colors"
              >
                {pin.locked ? (
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
              </button>

              {editing?.kind === 'placement' && editing.id === pin.id ? (
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => onDraftNameChange(e.target.value)}
                  onBlur={onCommitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onCommitRename();
                    if (e.key === 'Escape') onCancelRename();
                  }}
                  className="flex-1 min-w-0 bg-zinc-900 border border-amber-500/50 text-zinc-100 rounded-lg px-1.5 py-0.5 text-xs focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => onSelectMapObject?.({ type: 'placement', data: pin })}
                  className="flex-1 min-w-0 text-left"
                  title={isPersian ? 'انتخاب روی نقشه' : 'Select on the map'}
                >
                  <div className="text-xs font-semibold text-zinc-200 truncate">
                    {resolvePinName(pin)}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono truncate">{pin.entityType}</div>
                </button>
              )}

              <button
                onClick={() => onStartRename('placement', pin.id, resolvePinName(pin))}
                title={isPersian ? 'تغییر نام' : 'Rename'}
                className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => onReorderPlacement?.(pin.id, 'forward')}
                title={isPersian ? 'یک پله جلوتر' : 'Bring forward'}
                className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
              >
                <ArrowUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onReorderPlacement?.(pin.id, 'backward')}
                title={isPersian ? 'یک پله عقب‌تر' : 'Send backward'}
                className="shrink-0 text-zinc-600 hover:text-amber-300 transition-colors"
              >
                <ArrowDown className="w-3 h-3" />
              </button>
              <button
                onClick={async () => {
                  const confirmed = await notify.confirm({
                    title: isPersian ? 'برداشتن سنجاق' : 'Remove pin',
                    message: isPersian
                      ? 'آیا این سنجاق از نقشه برداشته شود؟'
                      : 'Remove this pin from the map?',
                  });
                  if (confirmed) onDeletePlacement?.(pin.id);
                }}
                title={isPersian ? 'حذف' : 'Delete'}
                className="shrink-0 text-zinc-600 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {terrainFeatures.length === 0 && placements.length === 0 && (
        <div className="text-center py-8 text-xs text-zinc-500">
          {isPersian
            ? 'هنوز هیچ عارضه‌ای روی نقشه ترسیم نشده است'
            : 'No map objects yet — draw some on the canvas'}
        </div>
      )}
    </div>
  );
};
