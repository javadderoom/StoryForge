'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { StatDefinition, ResourceDefinition } from '@/lib/types';
import { ThemeRpgSystemPayload } from '@/lib/types/world';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import { notify } from '@/lib/notify';
import {
  Sparkles,
  Shield,
  Zap,
  Users,
  Dices,
  BookOpen,
} from 'lucide-react';
import {
  RpgRulesSettingsCard,
  StatsSection,
  ResourcesSection,
  InventorySection,
  ArchetypesSection,
  BackgroundsSection,
  AbilitiesSection,
  RpgSynthesisModal,
} from '@/components/studio/rpg';

type RpgSubTab = 'core' | 'abilities' | 'genesis';

export default function RpgMechanicsPage() {
  const { story, isPersian, updateRpgSystem } = useStudioStory();
  const [activeTab, setActiveTab] = useState<RpgSubTab>('core');

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

  const statsCount = story.rpgSystem.stats?.length || 0;
  const resourcesCount = story.rpgSystem.resources?.length || 0;
  const abilitiesCount = story.rpgSystem.abilities?.length || 0;
  const archetypesCount = story.rpgSystem.archetypes?.length || 0;
  const backgroundsCount = story.rpgSystem.backgrounds?.length || 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & Sub-Tabs Navigation */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-zinc-100 flex items-center gap-2.5">
              <Dices className="w-6 h-6 text-amber-400" />
              <span>{isPersian ? 'مکانیک‌ها و موتور قوانین RPG' : 'RPG Mechanics & Rules Engine'}</span>
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {isPersian
                ? 'سامانه جامع ویژگی‌ها، منابع حیاتی، طلسم‌ها و توانایی‌ها، و کهن‌الگوهای کاراکتر'
                : 'Configure core attributes, resource pools, grimoire abilities, and character genesis templates'}
            </p>
          </div>

          {/* Quick Stat Counter Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 font-mono flex items-center gap-1.5">
              <Dices className="w-3.5 h-3.5" />
              <span>{statsCount} {isPersian ? 'ویژگی' : 'Stats'}</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-mono flex items-center gap-1.5">
              <span>❤️</span>
              <span>{resourcesCount} {isPersian ? 'منبع حیاتی' : 'Vitals'}</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 font-mono flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>{abilitiesCount} {isPersian ? 'توانایی و طلسم' : 'Abilities'}</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-300 font-mono flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{archetypesCount} {isPersian ? 'کلاس' : 'Classes'}</span>
            </span>
          </div>
        </div>

        {/* Interactive Sub-Tabs Bar */}
        <div className="flex border-b border-zinc-800 gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('core')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'core'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-lg shadow-amber-500/5'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>{isPersian ? '۱. مکانیک‌های پایه و قوانین' : '1. Core Mechanics & Rules'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-zinc-800/80 text-zinc-300">
              {statsCount + resourcesCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('abilities')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'abilities'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/5'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>{isPersian ? '۲. توانایی‌ها، طلسم‌ها و فنون' : '2. Abilities, Spells & Techniques'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-zinc-800/80 text-zinc-300">
              {abilitiesCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('genesis')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'genesis'
                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30 shadow-lg shadow-purple-500/5'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isPersian ? '۳. کهن‌الگوها و پیشینه‌ها' : '3. Archetypes & Backgrounds'}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-zinc-800/80 text-zinc-300">
              {archetypesCount + backgroundsCount}
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Core Mechanics & Rules */}
      {activeTab === 'core' && (
        <div className="space-y-6 animate-fadeIn">
          <RpgRulesSettingsCard
            story={story}
            isPersian={isPersian}
            updateRpgSystem={updateRpgSystem}
            onSynthesize={handleSynthesizeRpgSystem}
            isSynthesizing={isSynthesizingRpg}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <StatsSection
              stats={story.rpgSystem.stats || []}
              resources={story.rpgSystem.resources || []}
              isPersian={isPersian}
              updateRpgSystem={updateRpgSystem}
            />

            <ResourcesSection
              resources={story.rpgSystem.resources || []}
              isPersian={isPersian}
              updateRpgSystem={updateRpgSystem}
            />

            <InventorySection
              items={story.rpgSystem.startingInventory || []}
              stats={story.rpgSystem.stats || []}
              resources={story.rpgSystem.resources || []}
              currencySystem={story.rpgSystem.currencySystem}
              isPersian={isPersian}
              updateRpgSystem={updateRpgSystem}
              quests={story.worldBible.quests || []}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Abilities, Spells & Techniques */}
      {activeTab === 'abilities' && (
        <div className="space-y-6 animate-fadeIn">
          <AbilitiesSection
            abilities={story.rpgSystem.abilities || []}
            stats={story.rpgSystem.stats || []}
            resources={story.rpgSystem.resources || []}
            archetypes={story.rpgSystem.archetypes || []}
            isPersian={isPersian}
            updateRpgSystem={updateRpgSystem}
          />
        </div>
      )}

      {/* Tab 3: Archetypes & Character Genesis */}
      {activeTab === 'genesis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
          <ArchetypesSection
            archetypes={story.rpgSystem.archetypes || []}
            stats={story.rpgSystem.stats || []}
            resources={story.rpgSystem.resources || []}
            abilities={story.rpgSystem.abilities || []}
            currencySystem={story.rpgSystem.currencySystem}
            vaultItems={story.worldBible.artifacts || []}
            isPersian={isPersian}
            updateRpgSystem={updateRpgSystem}
          />

          <BackgroundsSection
            backgrounds={story.rpgSystem.backgrounds || []}
            stats={story.rpgSystem.stats || []}
            resources={story.rpgSystem.resources || []}
            currencySystem={story.rpgSystem.currencySystem}
            isPersian={isPersian}
            updateRpgSystem={updateRpgSystem}
          />
        </div>
      )}

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
