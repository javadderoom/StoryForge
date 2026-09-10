import React, { useState } from 'react';
import { Sword, Sliders, Check, X, Sparkles, Coins } from 'lucide-react';
import { PageActions } from '@/components/studio/PageActions';
import { CurrencySystem } from '@/lib/types';
import { DEFAULT_CURRENCY_PRESETS, CURRENCY_PRESETS_LIST, CurrencyDenomination } from '@/lib/types/rpg';
import { notify } from '@/lib/notify';

interface RpgRulesSettingsCardProps {
  story: any;
  isPersian: boolean;
  updateRpgSystem: (updater: (prev: any) => any) => void;
  onSynthesize: () => void;
  isSynthesizing: boolean;
}

export function RpgRulesSettingsCard({
  story,
  isPersian,
  updateRpgSystem,
  onSynthesize,
  isSynthesizing,
}: RpgRulesSettingsCardProps) {
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const currentCurrency: CurrencySystem =
    story.rpgSystem.currencySystem || story.rpgSystem.currency || DEFAULT_CURRENCY_PRESETS.fantasy;
  const initialPreset =
    CURRENCY_PRESETS_LIST.find((p) => p.system.baseUnitNameEn === currentCurrency.baseUnitNameEn)?.id ||
    CURRENCY_PRESETS_LIST[0].id;

  const [settingsForm, setSettingsForm] = useState({
    diceType: story.rpgSystem.diceType || 'd20',
    inventoryCapacity: story.rpgSystem.inventoryCapacity || 10,
    hasCombat: story.rpgSystem.hasCombat ?? true,
    currencyPresetId: initialPreset,
    currencySystem: currentCurrency,
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateRpgSystem((prev: any) => ({
      ...prev,
      diceType: settingsForm.diceType,
      inventoryCapacity: Number(settingsForm.inventoryCapacity),
      hasCombat: settingsForm.hasCombat,
      currencySystem: settingsForm.currencySystem,
    }));
    setIsEditingSettings(false);
    notify.success(isPersian ? 'تنظیمات قوانین ذخیره شد' : 'RPG ruleset saved');
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl">
      {!isEditingSettings ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Sword className="w-5 h-5 text-amber-400" />
              <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
                {isPersian ? 'مکانیک‌های نقش‌آفرینی و آمار' : 'RPG System & Ruleset Matrix'}
              </h2>
            </div>
            <p className="text-sm text-zinc-400">
              {isPersian
                ? 'ویژگی‌های اصلی، منابع حیاتی، کلاس‌ها و ظرفیت تجهیزات این جهان'
                : 'Core attributes, vital resource pools, archetypes, and starting equipment definitions.'}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs font-mono text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded-xl border border-zinc-700/60 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-zinc-400">{isPersian ? 'واحد پول:' : 'Currency:'}</span>
                <span className="text-amber-300 font-semibold">
                  {isPersian ? currentCurrency.baseUnitNameFa : currentCurrency.baseUnitNameEn}
                </span>
                <span className="text-zinc-500 text-[11px]">
                  (
                  {currentCurrency.denominations
                    .map((d: CurrencyDenomination) => (isPersian ? d.nameFa : d.nameEn))
                    .join(' · ')}
                  )
                </span>
              </span>
              <span className="text-xs font-mono text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded-xl border border-zinc-700/60">
                🎲 {story.rpgSystem.diceType || 'd20'}
              </span>
              <span className="text-xs font-mono text-zinc-300 bg-zinc-800/80 px-2.5 py-1 rounded-xl border border-zinc-700/60">
                🎒 {story.rpgSystem.inventoryCapacity || 10} {isPersian ? 'اسلات' : 'slots'}
              </span>
            </div>
          </div>
          <PageActions
            actions={[
              {
                key: 'synthesize',
                label: isSynthesizing
                  ? isPersian
                    ? 'سنتز سیستم RPG...'
                    : 'Synthesizing RPG...'
                  : isPersian
                  ? '⚡ سنتز سیستم از تم'
                  : '⚡ Synthesize System',
                icon: Sparkles,
                onClick: onSynthesize,
                disabled: isSynthesizing,
                primary: true,
                className:
                  'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-zinc-950 shadow-lg shadow-amber-500/20',
              },
              {
                key: 'edit-rules',
                label: isPersian ? 'تنظیمات قوانین' : 'Edit Rules',
                icon: Sliders,
                onClick: () => {
                  setSettingsForm({
                    diceType: story.rpgSystem.diceType || 'd20',
                    inventoryCapacity: story.rpgSystem.inventoryCapacity || 10,
                    hasCombat: story.rpgSystem.hasCombat ?? true,
                    currencyPresetId: initialPreset,
                    currencySystem: currentCurrency as CurrencySystem,
                  });
                  setIsEditingSettings(true);
                },
              },
            ]}
          />
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              {isPersian ? 'پیکربندی قوانین بازی' : 'Configure Global Ruleset'}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingSettings(false)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                {isPersian ? 'ذخیره قوانین' : 'Save Rules'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {isPersian ? 'موتور محاسبات تاس' : 'Dice Resolution Engine'}
              </label>
              <select
                value={settingsForm.diceType}
                onChange={(e) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    diceType: e.target.value as any,
                  }))
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="d20">d20 System (D&D 5e / Pathfinder Standard)</option>
                <option value="2d6">2d6 Bell-Curve (PbtA / City of Mist)</option>
                <option value="d100">d100 Percentile (Call of Cthulhu / BRP)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {isPersian ? 'حداکثر ظرفیت کوله (اسلات)' : 'Max Inventory Capacity (Slots)'}
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={settingsForm.inventoryCapacity}
                onChange={(e) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    inventoryCapacity: Number(e.target.value),
                  }))
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {isPersian ? 'سیستم مبارزات فعال' : 'Combat Mechanics Enabled'}
              </label>
              <select
                value={settingsForm.hasCombat ? 'true' : 'false'}
                onChange={(e) =>
                  setSettingsForm((prev) => ({
                    ...prev,
                    hasCombat: e.target.value === 'true',
                  }))
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="true">{isPersian ? 'بله (مبارزه و آسیب مرگبار)' : 'Yes (Lethal Combat Supported)'}</option>
                <option value="false">{isPersian ? 'خیر (روایت خالص و معمایی)' : 'No (Pure Narrative / Investigation)'}</option>
              </select>
            </div>

            {/* Currency System Configuration */}
            <div className="sm:col-span-3 p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Coins className="w-4 h-4" />
                  <span>{isPersian ? 'سیستم مسکوکات و اقتصاد (واحد‌های پول)' : 'Coinage & Economy System'}</span>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {isPersian ? 'الگوی مسکوکات' : 'Currency Preset'}
                  </label>
                  <select
                    value={settingsForm.currencyPresetId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const preset = CURRENCY_PRESETS_LIST.find((p) => p.id === selectedId);
                      if (preset) {
                        setSettingsForm((prev) => ({
                          ...prev,
                          currencyPresetId: selectedId,
                          currencySystem: preset.system,
                        }));
                      }
                    }}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    {CURRENCY_PRESETS_LIST.map((p) => (
                      <option key={p.id} value={p.id}>
                        {isPersian ? p.nameFa : p.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {isPersian ? 'واحدهای پولی فعال' : 'Active Denominations Breakdown'}
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {settingsForm.currencySystem.denominations.map((d: CurrencyDenomination) => {
                      const dName = isPersian ? d.nameFa : d.nameEn;
                      const baseName = isPersian
                        ? settingsForm.currencySystem.baseUnitNameFa
                        : settingsForm.currencySystem.baseUnitNameEn;
                      return (
                        <span
                          key={d.id}
                          className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1"
                        >
                          {d.symbol ? <span>{d.symbol}</span> : null}
                          <span className="font-semibold">{dName}</span>
                          <span className="text-zinc-500 text-[10px]">
                            (= {d.valueInBase} {baseName})
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
