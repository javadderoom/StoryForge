'use client';

import React from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { Sword, Shield, Package, Dice5 } from 'lucide-react';

export default function RpgMechanicsPage() {
  const { story, isPersian } = useStudioStory();

  const t = {
    heading: isPersian ? 'مکانیک‌های نقش‌آفرینی و آمار' : 'RPG System & Ruleset Matrix',
    subheading: isPersian
      ? 'ویژگی‌های اصلی، منابع حیاتی و ظرفیت تجهیزات این جهان'
      : 'Core attributes, vital resource pools, and starting equipment definitions.',
    primaryAttributes: isPersian ? 'ویژگی‌های اصلی کاراکتر' : 'Primary Attributes',
    vitalsAndPools: isPersian ? 'حیات و منابع (Pools)' : 'Vitals & Resource Pools',
    initialEquipment: isPersian ? 'تجهیزات اولیه' : 'Starting Inventory Items',
    diceType: isPersian ? 'نوع تاس:' : 'Dice Engine:',
    capacity: isPersian ? 'ظرفیت کوله:' : 'Inventory Cap:',
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Info */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Sword className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{t.heading}</h2>
          </div>
          <p className="text-sm text-zinc-400">{t.subheading}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Dice5 className="w-3.5 h-3.5" />
            {t.diceType} {story.rpgSystem.diceType.toUpperCase()}
          </span>
          <span className="text-xs bg-zinc-800 border border-zinc-700/80 text-zinc-300 px-3 py-1.5 rounded-xl font-mono">
            {t.capacity} {story.rpgSystem.inventoryCapacity}
          </span>
        </div>
      </div>

      {/* 3-Column RPG Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Primary Stats */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Sword className="w-4 h-4 text-amber-400" /> {t.primaryAttributes}
          </h3>
          <div className="space-y-3.5">
            {story.rpgSystem.stats.map((stat) => (
              <div
                key={stat.id}
                className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 flex items-center justify-between hover:border-zinc-700 transition-all"
              >
                <div>
                  <h4 className="text-sm font-bold text-zinc-200">{stat.name}</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">{stat.description}</p>
                </div>
                <span className="text-base font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                  {stat.baseValue}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Vitals & Resources */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" /> {t.vitalsAndPools}
          </h3>
          <div className="space-y-4">
            {story.rpgSystem.resources.map((res) => (
              <div
                key={res.id}
                className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700 transition-all"
              >
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-zinc-200">{res.name}</span>
                  <span style={{ color: res.color }}>
                    {res.current} / {res.max}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(res.current / res.max) * 100}%`,
                      backgroundColor: res.color || '#10b981',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Starting Inventory */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-5 flex items-center gap-2">
            <Package className="w-4 h-4 text-violet-400" /> {t.initialEquipment}
          </h3>
          <div className="space-y-3.5">
            {story.rpgSystem.startingInventory.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700 transition-all"
              >
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-sm font-bold text-zinc-200">{item.name}</h4>
                  <span className="text-xs text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md font-mono">
                    x{item.quantity}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
