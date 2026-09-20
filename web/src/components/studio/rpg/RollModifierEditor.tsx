'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, Shield, Sparkles } from 'lucide-react';
import { RollModifierSpec, StatDefinition } from '@/lib/types/rpg';
import { ActionStyle, RiskLevel } from '@/lib/types/gameplay';
import { describeRollModifier } from '@/lib/engines/game/abilityEffects';

interface RollModifierEditorProps {
  specs: RollModifierSpec[];
  onChange: (specs: RollModifierSpec[]) => void;
  stats?: StatDefinition[];
  isPersian?: boolean;
  title?: string;
  subtitle?: string;
}

const ACTION_STYLES: { id: ActionStyle; labelEn: string; labelFa: string }[] = [
  { id: 'defensive', labelEn: 'Defensive', labelFa: 'تدافعی' },
  { id: 'agile', labelEn: 'Agile', labelFa: 'چابک' },
  { id: 'aggressive', labelEn: 'Aggressive', labelFa: 'تهاجمی' },
  { id: 'diplomatic', labelEn: 'Diplomatic', labelFa: 'دیپلماتیک' },
  { id: 'inquisitive', labelEn: 'Inquisitive', labelFa: 'کنجکاو' },
  { id: 'tactical', labelEn: 'Tactical', labelFa: 'تاکتیکی' },
  { id: 'stealthy', labelEn: 'Stealthy', labelFa: 'پنهان‌کارانه' },
];

const RISK_LEVELS: { id: RiskLevel; labelEn: string; labelFa: string }[] = [
  { id: 'low', labelEn: 'Low Risk', labelFa: 'کم‌خطر' },
  { id: 'medium', labelEn: 'Medium Risk', labelFa: 'متوسط' },
  { id: 'high', labelEn: 'High Risk', labelFa: 'پرخطر' },
];

const EQUIPMENT_SLOTS = [
  { id: 'mainHand', labelEn: 'Main Hand Weapon', labelFa: 'سلاح دست اصلی' },
  { id: 'offHand', labelEn: 'Off-Hand / Shield', labelFa: 'دست دوم / سپر' },
  { id: 'armor', labelEn: 'Armor', labelFa: 'زره' },
  { id: 'relic', labelEn: 'Relic / Accessory', labelFa: 'عتیقه / نشان' },
];

export function RollModifierEditor({
  specs = [],
  onChange,
  stats = [],
  isPersian = false,
  title,
  subtitle,
}: RollModifierEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentSpec, setCurrentSpec] = useState<RollModifierSpec>({
    modifier: 2,
    statIds: [],
    actionStyles: [],
    riskLevels: [],
    triggerKeywords: [],
    matchMode: 'any',
    labelEn: '',
    labelFa: '',
  });
  const [keywordInput, setKeywordInput] = useState('');

  const startNewSpec = () => {
    setCurrentSpec({
      modifier: 2,
      statIds: [],
      actionStyles: [],
      riskLevels: [],
      triggerKeywords: [],
      matchMode: 'any',
      labelEn: '',
      labelFa: '',
    });
    setKeywordInput('');
    setEditingIndex(-1); // -1 indicates adding new
  };

  const startEditSpec = (index: number) => {
    setCurrentSpec({ ...specs[index] });
    setKeywordInput('');
    setEditingIndex(index);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setKeywordInput('');
  };

  const saveSpec = () => {
    const cleaned: RollModifierSpec = {
      modifier: Number(currentSpec.modifier) || 0,
      statIds: currentSpec.statIds?.length ? currentSpec.statIds : undefined,
      actionStyles: currentSpec.actionStyles?.length ? currentSpec.actionStyles : undefined,
      riskLevels: currentSpec.riskLevels?.length ? currentSpec.riskLevels : undefined,
      triggerKeywords: currentSpec.triggerKeywords?.length ? currentSpec.triggerKeywords : undefined,
      matchMode: currentSpec.triggerKeywords?.length ? currentSpec.matchMode || 'any' : undefined,
      requiresEquippedSlot: currentSpec.requiresEquippedSlot || undefined,
      requiresItemType: currentSpec.requiresItemType?.trim() || undefined,
      labelEn: currentSpec.labelEn?.trim() || undefined,
      labelFa: currentSpec.labelFa?.trim() || undefined,
    };

    if (editingIndex === -1) {
      onChange([...specs, cleaned]);
    } else if (editingIndex !== null && editingIndex >= 0) {
      const updated = [...specs];
      updated[editingIndex] = cleaned;
      onChange(updated);
    }
    setEditingIndex(null);
    setKeywordInput('');
  };

  const removeSpec = (index: number) => {
    onChange(specs.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const toggleStat = (statId: string) => {
    const list = currentSpec.statIds || [];
    if (list.includes(statId)) {
      setCurrentSpec({ ...currentSpec, statIds: list.filter((id) => id !== statId) });
    } else {
      setCurrentSpec({ ...currentSpec, statIds: [...list, statId] });
    }
  };

  const toggleActionStyle = (styleId: string) => {
    const list = currentSpec.actionStyles || [];
    if (list.includes(styleId)) {
      setCurrentSpec({ ...currentSpec, actionStyles: list.filter((s) => s !== styleId) });
    } else {
      setCurrentSpec({ ...currentSpec, actionStyles: [...list, styleId] });
    }
  };

  const toggleRiskLevel = (riskId: string) => {
    const list = currentSpec.riskLevels || [];
    if (list.includes(riskId)) {
      setCurrentSpec({ ...currentSpec, riskLevels: list.filter((r) => r !== riskId) });
    } else {
      setCurrentSpec({ ...currentSpec, riskLevels: [...list, riskId] });
    }
  };

  const addKeyword = () => {
    const term = keywordInput.trim().toLowerCase();
    if (!term) return;
    const existing = currentSpec.triggerKeywords || [];
    if (!existing.includes(term)) {
      setCurrentSpec({ ...currentSpec, triggerKeywords: [...existing, term] });
    }
    setKeywordInput('');
  };

  const removeKeyword = (term: string) => {
    setCurrentSpec({
      ...currentSpec,
      triggerKeywords: (currentSpec.triggerKeywords || []).filter((k) => k !== term),
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3.5">
      <div className="flex items-center justify-between">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            {title || (isPersian ? 'اثرات مکانیکی بر تاس (Roll Modifiers)' : 'Deterministic Roll Modifiers')}
          </label>
          <p className="text-[10px] text-zinc-400">
            {subtitle ||
              (isPersian
                ? 'پاداش یا جریمه‌های قطعی که مستقیماً به نتیجه آزمون تاس افزوده می‌شوند.'
                : 'Deterministic bonuses/penalties folded directly into d20 resolution.')}
          </p>
        </div>
        {editingIndex === null && (
          <button
            type="button"
            onClick={startNewSpec}
            className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>{isPersian ? 'افزودن اثر' : 'Add Modifier'}</span>
          </button>
        )}
      </div>

      {/* Existing specs list */}
      {specs.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {specs.map((spec, idx) => {
            const isEditing = editingIndex === idx;
            const desc = describeRollModifier(spec, isPersian);
            return (
              <div
                key={idx}
                className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                  isEditing
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                    : 'border-zinc-800 bg-zinc-950/60 text-zinc-300 hover:border-zinc-700'
                }`}
                dir={isPersian ? 'rtl' : 'ltr'}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${
                      spec.modifier >= 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {spec.modifier >= 0 ? `+${spec.modifier}` : spec.modifier}
                  </span>
                  <span className="truncate text-[11px] font-medium text-zinc-300">{desc}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEditSpec(idx)}
                    className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"
                    title={isPersian ? 'ویرایش' : 'Edit'}
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSpec(idx)}
                    className="p-1 text-zinc-400 hover:text-rose-400 transition-colors"
                    title={isPersian ? 'حذف' : 'Delete'}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        editingIndex === null && (
          <div className="rounded-lg border border-dashed border-zinc-800 p-2.5 text-center text-[11px] text-zinc-500">
            {isPersian
              ? 'هیچ اثر ساختاریافته‌ای تعریف نشده است (آزمون بدون پاداش خودکار اجرا می‌شود).'
              : 'No structured roll modifiers authored (ability uses default / legacy resolution).'}
          </div>
        )
      )}

      {/* Edit / Add Subform */}
      {editingIndex !== null && (
        <div className="mt-2 space-y-3 rounded-xl border border-amber-500/40 bg-zinc-950 p-3 text-xs animate-fadeIn">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
            <span className="font-semibold text-amber-300">
              {editingIndex === -1
                ? isPersian
                  ? 'اثر جدید'
                  : 'New Roll Modifier'
                : isPersian
                ? 'ویرایش اثر'
                : 'Edit Roll Modifier'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={cancelEdit}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-3 w-3" />
                <span>{isPersian ? 'انصراف' : 'Cancel'}</span>
              </button>
              <button
                type="button"
                onClick={saveSpec}
                className="flex items-center gap-1 rounded-md bg-amber-500 px-2.5 py-1 font-medium text-zinc-950 hover:bg-amber-400 transition-colors"
              >
                <Check className="h-3 w-3" />
                <span>{isPersian ? 'ثبت اثر' : 'Apply'}</span>
              </button>
            </div>
          </div>

          {/* Modifier Value & Labels */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10.5px] font-medium text-zinc-400 mb-1">
                {isPersian ? 'مقدار پاداش / جریمه (+/-)' : 'Modifier (+/-)'}
              </label>
              <input
                type="number"
                value={currentSpec.modifier}
                onChange={(e) =>
                  setCurrentSpec({ ...currentSpec, modifier: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-medium text-zinc-400 mb-1">
                {isPersian ? 'برچسب انگلیسی (Dice UI)' : 'Label (English)'}
              </label>
              <input
                type="text"
                value={currentSpec.labelEn || ''}
                onChange={(e) => setCurrentSpec({ ...currentSpec, labelEn: e.target.value })}
                placeholder="e.g. Shield Block"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-medium text-zinc-400 mb-1">
                {isPersian ? 'برچسب فارسی (Dice UI)' : 'Label (Persian)'}
              </label>
              <input
                type="text"
                value={currentSpec.labelFa || ''}
                onChange={(e) => setCurrentSpec({ ...currentSpec, labelFa: e.target.value })}
                placeholder="مثال: دفاع با سپر"
                dir="rtl"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Stat Gate */}
          {stats.length > 0 && (
            <div>
              <label className="block text-[10.5px] font-medium text-zinc-400 mb-1">
                {isPersian
                  ? 'محدود به ویژگی‌های خاص (خالی = همه ویژگی‌ها):'
                  : 'Restricted to Stats (Empty = any stat):'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {stats.map((st) => {
                  const active = (currentSpec.statIds || []).includes(st.id);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleStat(st.id)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-medium border transition-colors ${
                        active
                          ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {st.name || st.id}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Style Gate */}
          <div>
            <label className="block text-[10.5px] font-medium text-zinc-400 mb-1">
              {isPersian
                ? 'محدود به سبک اقدام (خالی = همه سبک‌ها):'
                : 'Restricted to Action Styles (Empty = any style):'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ACTION_STYLES.map((st) => {
                const active = (currentSpec.actionStyles || []).includes(st.id);
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => toggleActionStyle(st.id)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-medium border transition-colors ${
                      active
                        ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {isPersian ? st.labelFa : st.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Risk Level Gate */}
          <div>
            <label className="block text-[10.5px] font-medium text-zinc-400 mb-1">
              {isPersian
                ? 'محدود به سطح خطر (خالی = همه سطوح):'
                : 'Restricted to Risk Levels (Empty = any risk):'}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {RISK_LEVELS.map((rk) => {
                const active = (currentSpec.riskLevels || []).includes(rk.id);
                return (
                  <button
                    key={rk.id}
                    type="button"
                    onClick={() => toggleRiskLevel(rk.id)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-medium border transition-colors ${
                      active
                        ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {isPersian ? rk.labelFa : rk.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Equipment Gate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10.5px] font-medium text-zinc-400 mb-1">
                {isPersian ? 'نیاز به تجهیز در جایگاه:' : 'Requires Equipped Slot:'}
              </label>
              <select
                value={currentSpec.requiresEquippedSlot || ''}
                onChange={(e) =>
                  setCurrentSpec({
                    ...currentSpec,
                    requiresEquippedSlot: (e.target.value as any) || undefined,
                  })
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="">{isPersian ? 'بدون شرط تجهیز' : 'None (No slot requirement)'}</option>
                {EQUIPMENT_SLOTS.map((sl) => (
                  <option key={sl.id} value={sl.id}>
                    {isPersian ? sl.labelFa : sl.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10.5px] font-medium text-zinc-400 mb-1">
                {isPersian ? 'نیاز به داشتن نوع آیتم:' : 'Requires Item Type:'}
              </label>
              <input
                type="text"
                value={currentSpec.requiresItemType || ''}
                onChange={(e) => setCurrentSpec({ ...currentSpec, requiresItemType: e.target.value })}
                placeholder="e.g. shield, sword, potion"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Trigger Keywords */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-medium text-zinc-400">
                {isPersian ? 'کلمات کلیدی در متن اقدام (Trigger Keywords):' : 'Trigger Keywords in Action Text:'}
              </label>
              {(currentSpec.triggerKeywords || []).length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500">{isPersian ? 'شرط تطابق:' : 'Match:'}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentSpec({
                        ...currentSpec,
                        matchMode: currentSpec.matchMode === 'all' ? 'any' : 'all',
                      })
                    }
                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-amber-300"
                  >
                    {currentSpec.matchMode === 'all' ? 'ALL (AND)' : 'ANY (OR)'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                placeholder={isPersian ? 'کلمه کلیدی را بنویسید و اینتر بزنید...' : 'Type keyword & press Enter...'}
                className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addKeyword}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
              >
                {isPersian ? 'افزودن' : 'Add'}
              </button>
            </div>
            {(currentSpec.triggerKeywords || []).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(currentSpec.triggerKeywords || []).map((term) => (
                  <span
                    key={term}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300"
                  >
                    <span>{term}</span>
                    <button
                      type="button"
                      onClick={() => removeKeyword(term)}
                      className="text-zinc-500 hover:text-rose-400"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Live Preview Pill */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-2 text-[11px] text-zinc-400">
            <span className="text-zinc-500">{isPersian ? 'پیش‌نمایش اثر: ' : 'Preview: '}</span>
            <span className="font-mono text-amber-300">
              {describeRollModifier(currentSpec, isPersian) || (isPersian ? 'بدون اثر' : 'No modifier')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
