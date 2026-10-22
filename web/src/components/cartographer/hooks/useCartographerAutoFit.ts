'use client';

import { useState } from 'react';
import type { WorldBible, WorldLocation, WorldMapData } from '@/lib/types';
import { notify } from '@/lib/notify';
import { auditWorldMapLayout } from '@/lib/engines/world/mapLayoutAuditor';
import { solveMapLayout, stableSeedFromString } from '@/lib/engines/world/mapLayoutSolver';

type UpdateWorldBible = (updater: (previous: WorldBible) => WorldBible) => void;

interface AutoFitSnapshotEntry {
  locationId: string;
  coordinates: { x: number; y: number } | undefined;
  coordinatesSource: WorldLocation['coordinatesSource'];
}

interface UseCartographerAutoFitOptions {
  worldBible: WorldBible;
  seedKey: string;
  isPersian: boolean;
  commit: (label: string, apply: () => void) => void;
  updateWorldBible: UpdateWorldBible;
}

/**
 * Plan 19: derive legacy/missing pins from lore & topology. Manual pins are
 * hard anchors; the apply path is undoable until the user saves (a save makes
 * the refit canon).
 */
export function useCartographerAutoFit({
  worldBible,
  seedKey,
  isPersian,
  commit,
  updateWorldBible,
}: UseCartographerAutoFitOptions) {
  const [autoFitSnapshot, setAutoFitSnapshot] = useState<AutoFitSnapshotEntry[] | null>(null);

  const handleAutoFit = async () => {
    const mapData: WorldMapData | null =
      worldBible.mapData ??
      (worldBible.ontology as { mapData?: WorldMapData } | undefined)?.mapData ??
      null;
    const audit = auditWorldMapLayout(worldBible, mapData);
    if (audit.counts.legacy_auto === 0 && audit.counts.unplaced === 0) {
      notify.info(
        isPersian
          ? 'همهٔ مکان‌ها مختصات معتبر دارند؛ بازماندهٔ قدیمی برای بازچینی نیست.'
          : 'All locations already carry coordinates; no legacy remnants to refit.'
      );
      return;
    }

    const issueLines = audit.issues
      .slice(0, 4)
      .map((issue) => (isPersian ? `• ${issue.fa}` : `• ${issue.en}`))
      .join('\n');
    const issueBlock = issueLines ? `\n${issueLines}` : '';
    const ok = await notify.confirm({
      title: isPersian ? 'چیدمان خودکار مختصات' : 'Auto-fit coordinates',
      message:
        (isPersian
          ? `${audit.counts.legacy_auto} بازماندهٔ قدیمی و ${audit.counts.unplaced} مکان فاقد مختصات شناسایی شد؛ ${audit.counts.manual} نشان دستی دست‌نخورده می‌ماند.\nموقعیت‌ها از گراف جهان، مسیرهای تجاری، متن روایت و زمینِ نقشه استخراج می‌شود و پس از اعمال قابل بازگردانی است.`
          : `${audit.counts.legacy_auto} legacy remnant(s) and ${audit.counts.unplaced} unplaced location(s) detected; ${audit.counts.manual} manual pin(s) will stay untouched.\nPositions derive from the world graph, trade routes, lore text and terrain, and can be undone after apply.`) +
        issueBlock,
      confirmText: isPersian ? 'بازچینی' : 'Refit',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
    });
    if (!ok) return;

    const result = solveMapLayout({
      locations: worldBible.locations,
      tradeRoutes: worldBible.tradeRoutes,
      mapData,
      mode: 'legacy',
      seed: stableSeedFromString(seedKey),
    });
    if (!result.placements.length) {
      notify.info(isPersian ? 'چیزی برای جابجایی نبود.' : 'Nothing to move.');
      return;
    }

    const touchedIds = new Set(result.diffs.map((diff) => diff.locationId));
    setAutoFitSnapshot(
      worldBible.locations
        .filter((location) => touchedIds.has(location.id))
        .map((location) => ({
          locationId: location.id,
          coordinates: location.coordinates,
          coordinatesSource: location.coordinatesSource,
        }))
    );

    commit('Auto-fit coordinates', () => {
      updateWorldBible((previous) => ({
        ...previous,
        locations: (previous.locations || []).map((location) => {
          const placement = result.placements.find((entry) => entry.locationId === location.id);
          if (!placement) return location;
          return { ...location, coordinates: placement.position, coordinatesSource: 'solver' as const };
        }),
      }));
    });
    notify.success(
      isPersian
        ? `${result.summaryText} — برای ذخیرهٔ نهایی روی ذخیره بزنید.`
        : `${result.summaryText} — hit Save to persist.`
    );
  };

  const handleUndoAutoFit = () => {
    const snapshot = autoFitSnapshot;
    if (!snapshot || snapshot.length === 0) return;
    updateWorldBible((previous) => ({
      ...previous,
      locations: (previous.locations || []).map((location) => {
        const entry = snapshot.find((candidate) => candidate.locationId === location.id);
        if (!entry) return location;
        const restored: WorldLocation = {
          ...location,
          coordinates: entry.coordinates,
          coordinatesSource: entry.coordinatesSource,
        };
        if (!entry.coordinates) delete restored.coordinates;
        if (!entry.coordinatesSource) delete restored.coordinatesSource;
        return restored;
      }),
    }));
    setAutoFitSnapshot(null);
    notify.info(isPersian ? 'مختصات قبلی بازگردانی شد.' : 'Previous coordinates restored.');
  };

  return { autoFitSnapshot, handleAutoFit, handleUndoAutoFit };
}