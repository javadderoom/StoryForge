'use client';

import React from 'react';
import {
  MousePointer,
  Globe,
  Mountain,
  Waves,
  Split,
  Trees,
  Castle,
  Route,
  User,
  Skull,
  Sparkles,
  Sun,
  History,
  Ruler,
  Plus,
} from 'lucide-react';
import { CartographerTool } from './CartographerHeader';

interface CartographerToolbarProps {
  activeTool: CartographerTool;
  onSelectTool: (tool: CartographerTool) => void;
  isPersian: boolean;
}

interface ToolGroup {
  categoryTitle: { en: string; fa: string };
  tools: Array<{
    id: CartographerTool;
    name: { en: string; fa: string };
    tooltip: { en: string; fa: string };
    icon: React.ComponentType<{ className?: string }>;
    accentClass: string;
  }>;
}

export const CartographerToolbar: React.FC<CartographerToolbarProps> = ({
  activeTool,
  onSelectTool,
  isPersian,
}) => {
  const toolGroups: ToolGroup[] = [
    {
      categoryTitle: { en: 'Basic', fa: 'اصلی' },
      tools: [
        {
          id: 'select',
          name: { en: 'Select & Pan', fa: 'انتخاب و جابجایی' },
          tooltip: { en: 'Select entities, drag map, move pins', fa: 'انتخاب المان‌ها، حرکت در نقشه' },
          icon: MousePointer,
          accentClass: 'hover:text-blue-400',
        },
        {
          id: 'ruler',
          name: { en: 'Travel Ruler', fa: 'خط‌کش مسافت کاروان' },
          tooltip: { en: 'Measure leagues & caravan travel days', fa: 'اندازه‌گیری مسافت و روزهای سفر کاروان' },
          icon: Ruler,
          accentClass: 'hover:text-amber-400',
        },
      ],
    },
    {
      categoryTitle: { en: 'Planetary Elements', fa: 'عناصر فیزیکی سیاره' },
      tools: [
        {
          id: 'terrain_continent',
          name: { en: 'Continent / Island', fa: 'قاره و جزیره' },
          tooltip: { en: 'Carve continents, islands & landmasses', fa: 'ترسیم قاره‌ها، جزیره‌ها و خشکی‌ها' },
          icon: Globe,
          accentClass: 'hover:text-emerald-400',
        },
        {
          id: 'terrain_mountain',
          name: { en: 'Mountains & Peaks', fa: 'رشته‌کوه و قله' },
          tooltip: { en: 'Place mountain spines, peaks & volcanoes', fa: 'افزودن رشته‌کوه‌ها، قله‌ها و آتشفشان' },
          icon: Mountain,
          accentClass: 'hover:text-orange-400',
        },
        {
          id: 'terrain_river',
          name: { en: 'River & Waters', fa: 'رودخانه و آبراهه' },
          tooltip: { en: 'Draw winding rivers flowing to lakes/seas', fa: 'ترسیم رودخانه‌ها و آبراهه‌ها به دریا' },
          icon: Waves,
          accentClass: 'hover:text-cyan-400',
        },
        {
          id: 'terrain_valley',
          name: { en: 'Valley & Chasm', fa: 'دره و شکاف زمین' },
          tooltip: { en: 'Carve canyons, gorges & rift valleys', fa: 'ایجاد تنگه‌ها، دره‌ها و شکاف‌های عمیق' },
          icon: Split,
          accentClass: 'hover:text-stone-400',
        },
        {
          id: 'terrain_biome',
          name: { en: 'Biomes & Soil', fa: 'اقلیم و خاک' },
          tooltip: { en: 'Paint forests, deserts, tundras & swamps', fa: 'ترسیم جنگل، کویر، مرداب و دشت' },
          icon: Trees,
          accentClass: 'hover:text-lime-400',
        },
      ],
    },
    {
      categoryTitle: { en: 'Civilization & Lore', fa: 'تمدن و داستان' },
      tools: [
        {
          id: 'place_settlement',
          name: { en: 'Settlement / City', fa: 'شهر و دژ' },
          tooltip: { en: 'Place capital, citadel, port, sanctuary', fa: 'استقرار پایتخت، دژ، بندر یا شهر' },
          icon: Castle,
          accentClass: 'hover:text-amber-400',
        },
        {
          id: 'draw_caravan',
          name: { en: 'Caravan Route', fa: 'مسیر کاروان' },
          tooltip: { en: 'Draw trade corridor, roads & waypoints', fa: 'ترسیم مسیر کاروان، شاهراه‌ها و ایستگاه‌ها' },
          icon: Route,
          accentClass: 'hover:text-orange-400',
        },
        {
          id: 'place_npc',
          name: { en: 'Station NPC', fa: 'استقرار شخصیت (NPC)' },
          tooltip: { en: 'Position characters at locations or camps', fa: 'جای‌گذاری شخصیت در شهر یا قرارگاه' },
          icon: User,
          accentClass: 'hover:text-indigo-400',
        },
        {
          id: 'place_creature',
          name: { en: 'Beast Den', fa: 'زیستگاه هیولا' },
          tooltip: { en: 'Place creature territory / apex beast den', fa: 'ثبت قلمرو یا آشیانه هیولای جانورنامه' },
          icon: Skull,
          accentClass: 'hover:text-rose-400',
        },
        {
          id: 'place_relic',
          name: { en: 'Mythic Relic', fa: 'عتیقه و اثر باستانی' },
          tooltip: { en: 'Mark hidden vault, tomb or legendary relic', fa: 'محل گنج، مقبره یا عتیقه باستانی' },
          icon: Sparkles,
          accentClass: 'hover:text-purple-400',
        },
        {
          id: 'place_deity',
          name: { en: 'Shrine / Deity', fa: 'معبد و ایزد' },
          tooltip: { en: 'Place divine monolith, shrine or holy site', fa: 'استقرار معبد، زیارتگاه یا یادمان الهی' },
          icon: Sun,
          accentClass: 'hover:text-yellow-400',
        },
        {
          id: 'place_timeline',
          name: { en: 'Timeline Event', fa: 'رویداد تاریخی' },
          tooltip: { en: 'Pin historic battlefield or cataclysm site', fa: 'ثبت میدان نبرد تاریخی یا نقطه فاجعه' },
          icon: History,
          accentClass: 'hover:text-red-400',
        },
      ],
    },
  ];

  return (
    <aside className="absolute left-4 top-20 z-20 flex flex-col gap-2.5 bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 rounded-2xl p-2 shadow-2xl max-h-[calc(100vh-100px)] overflow-y-auto scrollbar-none select-none">
      {toolGroups.map((group, gIdx) => (
        <div key={gIdx} className="space-y-1">
          <div className="px-2 pt-1 text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
            {isPersian ? group.categoryTitle.fa : group.categoryTitle.en}
          </div>
          <div className="space-y-0.5">
            {group.tools.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;

              return (
                <button
                  key={tool.id}
                  onClick={() => onSelectTool(tool.id)}
                  title={`${isPersian ? tool.name.fa : tool.name.en} — ${
                    isPersian ? tool.tooltip.fa : tool.tooltip.en
                  }`}
                  className={`relative group flex items-center gap-2.5 w-full px-2.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-amber-500 text-zinc-950 font-semibold shadow-lg shadow-amber-500/25 ring-1 ring-amber-400'
                      : `text-zinc-300 hover:bg-zinc-900/90 ${tool.accentClass}`
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-950' : ''}`} />
                  <span className="hidden xl:inline truncate">
                    {isPersian ? tool.name.fa : tool.name.en}
                  </span>

                  {/* Tooltip for compact / mobile displays */}
                  <div className="xl:hidden absolute left-full ml-2.5 px-2.5 py-1.5 bg-zinc-900 border border-zinc-700/80 text-zinc-200 text-xs rounded-xl shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    <div className="font-semibold">{isPersian ? tool.name.fa : tool.name.en}</div>
                    <div className="text-[10px] text-zinc-400">
                      {isPersian ? tool.tooltip.fa : tool.tooltip.en}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {gIdx < toolGroups.length - 1 && <div className="h-px bg-zinc-800/80 my-1" />}
        </div>
      ))}
    </aside>
  );
};
