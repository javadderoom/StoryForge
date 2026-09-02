'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { StatDefinition, ResourceDefinition } from '@/lib/types';
import { ThemeRpgSystemPayload } from '@/lib/types/world';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import { notify } from '@/lib/notify';
import {
  RpgRulesSettingsCard,
  StatsSection,
  ResourcesSection,
  InventorySection,
  ArchetypesSection,
  BackgroundsSection,
  RpgSynthesisModal,
} from '@/components/studio/rpg';

export default function RpgMechanicsPage() {
  const { story, isPersian, updateRpgSystem } = useStudioStory();

  // Plan 06: Theme-to-RPG System Synthesizer State
  const [isSynthesizingRpg, setIsSynthesizingRpg] = useState(false);
  const [rpgSynthesisPreview, setRpgSynthesisPreview] = useState<ThemeRpgSystemPayload | null>(null);

  const handleSynthesizeRpgSystem = async () => {
    try {
      setIsSynthesizingRpg(true);
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'rpg_system_synthesis',
          prompt:
            'Synthesize 4-6 bespoke core attributes, 2-4 vital pools, and 4 starting archetypes directly derived from the story theme notes and world laws.',
          themeContext: story.worldBible.themeNotes,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to synthesize RPG system (${res.status})`);
      }

      const json = await res.json();
      if (json.data && Array.isArray(json.data.stats) && Array.isArray(json.data.resources)) {
        setRpgSynthesisPreview(json.data);
      } else {
        notify.error(
          isPersian ? 'قالب پاسخ سیستم RPG نامعتبر بود' : 'Invalid RPG system synthesis response'
        );
      }
    } catch (err: any) {
      notify.error(err.message || 'Error synthesizing RPG mechanics');
    } finally {
      setIsSynthesizingRpg(false);
    }
  };

  const handleCommitRpgSynthesis = () => {
    if (!rpgSynthesisPreview) return;

    const mappedStats: StatDefinition[] = rpgSynthesisPreview.stats.map((s) => ({
      id: s.id,
      name: isPersian ? s.nameFa : s.nameEn,
      description: s.description,
      baseValue: s.defaultValue || 10,
    }));

    const mappedResources: ResourceDefinition[] = rpgSynthesisPreview.resources.map((r, idx) => ({
      id: r.id,
      name: isPersian ? r.nameFa : r.nameEn,
      current: r.maxValue || 100,
      max: r.maxValue || 100,
      min: 0,
      color: idx === 0 ? '#ef4444' : idx === 1 ? '#3b82f6' : idx === 2 ? '#10b981' : '#a855f7',
    }));

    const mappedArchetypes = rpgSynthesisPreview.archetypes.map((a) => ({
      id: a.name.toLowerCase().replace(/\s+/g, '_'),
      name: a.name,
      tagline: a.signaturePerk,
      description: a.description,
      statBonuses: a.startingStats,
      startingEquipment: {
        mainHand: a.startingInventory[0] || undefined,
        armor: a.startingInventory[1] || undefined,
        offHand: a.startingInventory[2] || undefined,
        relic: a.startingInventory[3] || undefined,
      },
    }));

    updateRpgSystem((prev: any) => ({
      ...prev,
      stats: mappedStats,
      resources: mappedResources,
      archetypes: mappedArchetypes,
    }));

    setRpgSynthesisPreview(null);
    notify.success(
      isPersian
        ? 'سیستم نقش‌آفرینی، ویژگی‌ها و کلاس‌های اختصاصی تم اعمال شد'
        : 'Theme-tailored RPG attributes, resources, and archetypes applied successfully'
    );
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Info & Global Rules Settings */}
      <RpgRulesSettingsCard
        story={story}
        isPersian={isPersian}
        updateRpgSystem={updateRpgSystem}
        onSynthesize={handleSynthesizeRpgSystem}
        isSynthesizing={isSynthesizingRpg}
      />

      {/* 3-Column Core Mechanics Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attributes Section */}
        <StatsSection
          stats={story.rpgSystem.stats || []}
          isPersian={isPersian}
          updateRpgSystem={updateRpgSystem}
        />

        {/* Resources Section */}
        <ResourcesSection
          resources={story.rpgSystem.resources || []}
          isPersian={isPersian}
          updateRpgSystem={updateRpgSystem}
        />

        {/* Starting Inventory Section */}
        <InventorySection
          items={story.rpgSystem.startingInventory || []}
          stats={story.rpgSystem.stats || []}
          isPersian={isPersian}
          updateRpgSystem={updateRpgSystem}
        />
      </div>

      {/* 2-Column Character Genesis Matrix (Archetypes & Backgrounds) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Archetypes / Classes Section */}
        <ArchetypesSection
          archetypes={story.rpgSystem.archetypes || []}
          stats={story.rpgSystem.stats || []}
          isPersian={isPersian}
          updateRpgSystem={updateRpgSystem}
        />

        {/* Backgrounds / Origins Section */}
        <BackgroundsSection
          backgrounds={story.rpgSystem.backgrounds || []}
          stats={story.rpgSystem.stats || []}
          isPersian={isPersian}
          updateRpgSystem={updateRpgSystem}
        />
      </div>

      {/* Theme-to-RPG System Synthesis Preview Modal */}
      <RpgSynthesisModal
        preview={rpgSynthesisPreview}
        isPersian={isPersian}
        onClose={() => setRpgSynthesisPreview(null)}
        onCommit={handleCommitRpgSynthesis}
      />
    </div>
  );
}
