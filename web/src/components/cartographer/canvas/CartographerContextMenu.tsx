'use client';

import React, { useState } from 'react';
import {
  EnvironmentalContext,
} from '@/lib/engines/world/environmentalContext';
import { WorldBible, MapEntityPlacement, Faction } from '@/lib/types/world';
import { notify } from '@/lib/notify';
import { FloatingPanel } from './FloatingPanel';
import {
  Trash2,
  Eye,
  Loader2,
  X,
} from 'lucide-react';
import type { MenuSection } from './contextMenu/types';
import { ContextMenuMain } from './contextMenu/ContextMenuMain';
import { ContextMenuBeastSection } from './contextMenu/ContextMenuBeastSection';
import { ContextMenuNpcSection } from './contextMenu/ContextMenuNpcSection';
import { ContextMenuEventSection } from './contextMenu/ContextMenuEventSection';
import { ContextMenuArtifactSection } from './contextMenu/ContextMenuArtifactSection';
import { ContextMenuSettlementSection } from './contextMenu/ContextMenuSettlementSection';
import { ContextMenuCustomSection } from './contextMenu/ContextMenuCustomSection';

export interface CartographerContextMenuProps {
  x: number;
  y: number;
  worldPoint: { x: number; y: number };
  environmentalContext: EnvironmentalContext;
  worldBible: WorldBible;
  targetHitObject?: {
    kind: string;
    id: string;
    name?: string;
  } | null;
  /**
   * Open straight into one generator instead of the main menu. The lore tools
   * use this so "generate with AI" lands on the right submenu.
   */
  initialSection?: MenuSection;
  isPersian: boolean;
  onClose: () => void;
  onSelectObject?: (ref: { kind: string; id: string }) => void;
  onDeleteObject?: (ref: { kind: string; id: string }) => void;
  onAskOracle?: (coord: { x: number; y: number }, envContext: EnvironmentalContext) => void;
  onAddGeneratedElement: (payload: {
    entityType: 'bestiary' | 'npc' | 'timeline' | 'artifact' | 'location';
    entity: unknown;
    placement: MapEntityPlacement;
  }) => void;
}

export function CartographerContextMenu({
  x,
  y,
  worldPoint,
  environmentalContext,
  worldBible,
  targetHitObject,
  initialSection,
  isPersian,
  onClose,
  onSelectObject,
  onDeleteObject,
  onAskOracle,
  onAddGeneratedElement,
}: CartographerContextMenuProps) {
  const [activeSection, setActiveSection] = useState<MenuSection>(initialSection ?? 'main');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');

  const handleGenerate = async (
    entityType: 'beast' | 'npc' | 'story_event' | 'timeline' | 'artifact' | 'settlement',
    params: Record<string, unknown>
  ) => {
    setIsGenerating(true);
    setGenerationStatus(
      isPersian
        ? `در حال مشورت با هوش مصنوعی در ${environmentalContext.featureName || environmentalContext.biomeLabelFa || environmentalContext.biomeLabel}...`
        : `Consulting DeepSeek in ${environmentalContext.biomeLabel}...`
    );

    try {
      const res = await fetch('/api/studio/cartographer/generate-element', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldName: worldBible.worldName,
          worldTheme: worldBible.themeNotes,
          coordinates: worldPoint,
          environmentalContext,
          entityType,
          parameters: params,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorData.error || `Generation failed with status ${res.status}`);
      }

      const data = (await res.json()) as {
        success?: boolean;
        entity?: { name?: string; title?: string };
        placement?: MapEntityPlacement;
        entityType?: 'bestiary' | 'npc' | 'timeline' | 'artifact' | 'location';
      };
      if (!data.success || !data.entity || !data.placement || !data.entityType) {
        throw new Error('Invalid response structure received from generation endpoint.');
      }

      onAddGeneratedElement({
        entityType: data.entityType,
        entity: data.entity,
        placement: data.placement,
      });

      notify.success(
        isPersian
          ? `عنصر «${data.entity.name || data.entity.title}» با توجه به زیست‌بوم ترسیم شد`
          : `Spawned ${data.entity.name || data.entity.title} at (${Math.round(worldPoint.x)}, ${Math.round(worldPoint.y)})`
      );
      onClose();
    } catch (err: unknown) {
      console.error('[Cartographer Context Menu Generation Error]:', err);
      const message = err instanceof Error ? err.message : undefined;
      notify.error(message || (isPersian ? 'خطا در ایجاد عنصر' : 'Failed to generate element.'));
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const factions: Faction[] = worldBible.factions ?? [];

  return (
    <FloatingPanel
      anchor={{ x, y }}
      width={320}
      onClose={onClose}
      dir={isPersian ? 'rtl' : 'ltr'}
      ariaLabel={isPersian ? 'منوی نقشه' : 'Map menu'}
      className={`animate-in fade-in zoom-in-95 duration-100 ${isPersian ? 'font-[Vazirmatn]' : ''}`}
      header={
        <>
          {/* Header: Environment Badge */}
          <div className="shrink-0 bg-[#241c16] border-b border-[#3d2f23] p-2.5 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-[#f1d6b0] text-[13px] truncate">
                <span>{environmentalContext.biomeEmoji}</span>
                <span className="truncate">
                  {environmentalContext.featureName ||
                    (isPersian ? environmentalContext.biomeLabelFa : environmentalContext.biomeLabel)}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-[#96806e] hover:text-[#eedec8] p-0.5 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-[#baa48d]">
              {environmentalContext.nearestSettlement ? (
                <span className="bg-[#15100c] px-1.5 py-0.5 rounded border border-[#3d2f23]/60">
                  {isPersian ? (
                    <>
                      🧭 \u200E{environmentalContext.nearestSettlement.distanceKm} کیلومتری{' '}
                      {environmentalContext.nearestSettlement.cardinalDirectionFa} از{' '}
                      {environmentalContext.nearestSettlement.name}
                    </>
                  ) : (
                    <>
                      🧭 {environmentalContext.nearestSettlement.distanceKm}km{' '}
                      {environmentalContext.nearestSettlement.cardinalDirection} of{' '}
                      {environmentalContext.nearestSettlement.name}
                    </>
                  )}
                </span>
              ) : (
                <span className="bg-[#15100c] px-1.5 py-0.5 rounded border border-[#3d2f23]/60">
                  {isPersian ? '🏕️ برهوت بکر و دورافتاده' : '🏕️ Deep Wilderness'}
                </span>
              )}
              <span className="bg-[#15100c] px-1.5 py-0.5 rounded border border-[#3d2f23]/60">
                ⛰️ \u200E{environmentalContext.elevation} {isPersian ? 'متر' : 'm'}
              </span>
              <span dir="ltr" className="text-[#847160] font-mono text-[9.5px]">
                ({Math.round(worldPoint.x)}, {Math.round(worldPoint.y)})
              </span>
            </div>
          </div>

          {/* Target Hit Object Actions (if right-clicked on existing pin/feature) */}
          {targetHitObject && (
            <div className="bg-[#2c2118]/80 border-b border-[#3d2f23] px-2 py-1.5 flex items-center justify-between gap-1">
              <div className="flex items-center gap-1 text-[11px] text-[#f1d6b0] truncate">
                <span className="text-[#96806e]">{isPersian ? 'هدف:' : 'Target:'}</span>
                <span className="font-medium truncate">{targetHitObject.name || targetHitObject.id}</span>
              </div>
              <div className="flex items-center gap-1">
                {onSelectObject && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectObject({ kind: targetHitObject.kind, id: targetHitObject.id });
                      onClose();
                    }}
                    className="px-1.5 py-0.5 rounded bg-[#3b2d20] hover:bg-[#4a3928] text-[#eedec8] flex items-center gap-1"
                    title={isPersian ? 'بررسی و ویرایش در نوار بازرس' : 'Select and inspect'}
                  >
                    <Eye className="w-3 h-3 text-[#d1b084]" />
                    <span>{isPersian ? 'بررسی' : 'Inspect'}</span>
                  </button>
                )}
                {onDeleteObject && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteObject({ kind: targetHitObject.kind, id: targetHitObject.id });
                      onClose();
                    }}
                    className="px-1.5 py-0.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 flex items-center gap-1"
                    title={isPersian ? 'حذف عنصر' : 'Delete object'}
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                    <span>{isPersian ? 'حذف' : 'Delete'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      }
    >
      {/* Generation Loading Overlay */}
      {isGenerating ? (
        <div className="p-6 flex flex-col items-center justify-center gap-3 text-center bg-[#18130f]">
          <Loader2 className="w-6 h-6 animate-spin text-[#d8ab6c]" />
          <div className="font-medium text-[#f1d6b0] text-[12px]">{generationStatus}</div>
          <p className="text-[10px] text-[#9c8774] leading-relaxed max-w-[220px]">
            {isPersian
              ? 'تطبیق زیست‌شناختی، اقلیم و قوانین جهان با دیپ‌سیک...'
              : 'Adapting morphology, ecological niche, and canon lore with DeepSeek...'}
          </p>
        </div>
      ) : (
        <div className="p-1.5 flex flex-col gap-1">
          {activeSection === 'main' && (
            <ContextMenuMain
              isPersian={isPersian}
              worldPoint={worldPoint}
              environmentalContext={environmentalContext}
              setActiveSection={setActiveSection}
              onAskOracle={onAskOracle}
              onClose={onClose}
            />
          )}

          {activeSection === 'beast' && (
            <ContextMenuBeastSection
              isPersian={isPersian}
              onBack={() => setActiveSection('main')}
              onGenerate={handleGenerate}
            />
          )}

          {activeSection === 'npc' && (
            <ContextMenuNpcSection
              isPersian={isPersian}
              factions={factions}
              onBack={() => setActiveSection('main')}
              onGenerate={handleGenerate}
            />
          )}

          {activeSection === 'event' && (
            <ContextMenuEventSection
              isPersian={isPersian}
              onBack={() => setActiveSection('main')}
              onGenerate={handleGenerate}
            />
          )}

          {activeSection === 'artifact' && (
            <ContextMenuArtifactSection
              isPersian={isPersian}
              onBack={() => setActiveSection('main')}
              onGenerate={handleGenerate}
            />
          )}

          {activeSection === 'settlement' && (
            <ContextMenuSettlementSection
              isPersian={isPersian}
              onBack={() => setActiveSection('main')}
              onGenerate={handleGenerate}
            />
          )}

          {activeSection === 'custom' && (
            <ContextMenuCustomSection
              isPersian={isPersian}
              onBack={() => setActiveSection('main')}
              onGenerate={handleGenerate}
            />
          )}
        </div>
      )}
    </FloatingPanel>
  );
}
