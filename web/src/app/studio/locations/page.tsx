'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { Sparkles, Plus, Trash2, Edit2, MapPin, X, Flame, Layers, ShieldAlert } from 'lucide-react';
import { WorldLocation } from '@/lib/types';
import { notify } from '@/lib/notify';
import AiFillSection from '@/components/studio/AiFillSection';

const DANGER_MAP: Record<number, { labelEn: string; labelFa: string; badgeClass: string; borderClass: string }> = {
  1: {
    labelEn: 'Safe',
    labelFa: 'امن',
    badgeClass: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    borderClass: 'border-emerald-500/40 hover:border-emerald-400',
  },
  2: {
    labelEn: 'Guarded',
    labelFa: 'محافظت‌شده',
    badgeClass: 'text-teal-300 bg-teal-500/10 border-teal-500/30',
    borderClass: 'border-teal-500/40 hover:border-teal-400',
  },
  3: {
    labelEn: 'Dangerous',
    labelFa: 'خطرناک',
    badgeClass: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    borderClass: 'border-amber-500/40 hover:border-amber-400',
  },
  4: {
    labelEn: 'Perilous',
    labelFa: 'بسیار خطرناک',
    badgeClass: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
    borderClass: 'border-orange-500/40 hover:border-orange-400',
  },
  5: {
    labelEn: 'Lethal',
    labelFa: 'کشنده',
    badgeClass: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
    borderClass: 'border-rose-500/40 hover:border-rose-400',
  },
};

export default function LocationsStudioPage() {
  const { story, isPersian, addLocation, editLocation, deleteLocation } = useStudioStory();

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  const [locName, setLocName] = useState('');
  const [locRegion, setLocRegion] = useState('');
  const [locDesc, setLocDesc] = useState('');
  const [locAtmosphere, setLocAtmosphere] = useState('');
  const [locCategory, setLocCategory] = useState('dungeon');
  const [locDangerLevel, setLocDangerLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [locSpecialRules, setLocSpecialRules] = useState('');
  const [locConnectedIds, setLocConnectedIds] = useState<string[]>([]);

  const locations = story.worldBible.locations || [];
  const categories = story.worldBible.ontology?.placeCategories || [];

  const getCategoryMeta = (catId: string) => {
    const found = categories.find((c) => c.id === catId);
    return {
      name: found?.name || catId,
      color: found?.color || '#a1a1aa',
    };
  };

  const handleOpenAddModal = () => {
    setEditingLocationId(null);
    setLocName('');
    setLocRegion('');
    setLocDesc('');
    setLocAtmosphere('');
    setLocCategory('dungeon');
    setLocDangerLevel(3);
    setLocSpecialRules('');
    setLocConnectedIds([]);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (loc: WorldLocation) => {
    setEditingLocationId(loc.id);
    setLocName(loc.name);
    setLocRegion(loc.region);
    setLocDesc(loc.description);
    setLocAtmosphere(loc.atmosphere);
    setLocCategory(loc.category || 'dungeon');
    setLocDangerLevel(loc.dangerLevel);
    setLocSpecialRules((loc.specialRules || []).join('\n'));
    setLocConnectedIds(loc.connectedLocationIds || []);
    setShowAddModal(true);
  };

  const toggleConnected = (id: string) => {
    setLocConnectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCategoryChange = (catId: string) => {
    setLocCategory(catId);
    const found = categories.find((c) => c.id === catId);
    if (found?.defaultDangerLevel) {
      setLocDangerLevel(found.defaultDangerLevel);
    }
  };

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!locName.trim()) {
      notify.error(isPersian ? 'نام مکان الزامی است' : 'Location name is required');
      return;
    }

    const specialRulesArray = locSpecialRules
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const payload: WorldLocation = {
      id: editingLocationId || `loc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: locName.trim(),
      region: locRegion.trim() || (isPersian ? 'ناشناخته' : 'Unknown'),
      description: locDesc.trim(),
      atmosphere: locAtmosphere.trim(),
      category: locCategory,
      dangerLevel: locDangerLevel,
      connectedLocationIds: locConnectedIds,
      specialRules: specialRulesArray.length > 0 ? specialRulesArray : undefined,
    };

    if (editingLocationId) {
      editLocation(editingLocationId, payload);
    } else {
      addLocation(payload);
    }

    setShowAddModal(false);
  };

  const applyAiFill = (data: Record<string, unknown>) => {
    if (!locName && data.name) setLocName(data.name as string);
    if (!locRegion && data.region) setLocRegion(data.region as string);
    if (data.dangerLevel) setLocDangerLevel(data.dangerLevel as typeof locDangerLevel);
    if (!locDesc && data.description) setLocDesc(data.description as string);
    if (!locAtmosphere && data.atmosphere) setLocAtmosphere(data.atmosphere as string);
    if (!locSpecialRules && Array.isArray(data.specialRules) && (data.specialRules as string[]).length)
      setLocSpecialRules((data.specialRules as string[]).join('\n'));
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <MapPin className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">
              {isPersian ? 'جغرافیای جهان و مکان‌های داستان' : 'World Geography & Story Locations'}
            </h2>
          </div>
          <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">
            {isPersian
              ? 'ثبت و مدیریت قلعه‌ها، سیاه‌چال‌ها، خرابه‌ها، شهرک‌ها و بیابان‌های جهان همراه با سطح خطر، فضاسازی و پیوندهای مکانی.'
              : 'Manage strongholds, dungeons, ruins, settlements and wastes with danger tiers, atmosphere, and spatial connections.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl font-mono flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            {locations.length} {isPersian ? 'مکان ثبت‌شده' : 'Registered Locations'}
          </span>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isPersian ? '+ ثبت مکان جدید' : '+ Add Location'}</span>
          </button>
        </div>
      </div>

      {/* Locations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {locations.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8">
            <MapPin className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-zinc-300">
              {isPersian ? 'هنوز مکانی در این جهان ثبت نشده است' : 'No locations registered in this world yet'}
            </h4>
            <p className="text-xs text-zinc-500 mt-1">
              {isPersian ? 'برای ترسیم نقشه جهان روی دکمه ثبت مکان جدید کلیک کنید.' : 'Click "+ Add Location" to begin charting the world map.'}
            </p>
          </div>
        ) : (
          locations.map((loc) => {
            const danger = DANGER_MAP[loc.dangerLevel] || DANGER_MAP[3];
            const cat = getCategoryMeta(loc.category || '');

            return (
              <div
                key={loc.id}
                className={`bg-zinc-900/70 border-2 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between transition-all ${danger.borderClass}`}
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                    <span
                      className="px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5"
                      style={{ color: cat.color, borderColor: `${cat.color}55`, backgroundColor: `${cat.color}1a` }}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {isPersian ? cat.name : cat.name}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(loc)}
                        className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={async () => {
                          const conf = await notify.confirm({
                            title: isPersian ? 'حذف مکان' : 'Delete Location',
                            message: isPersian
                              ? `آیا از حذف مکان "${loc.name}" از جهان مطمئن هستید؟`
                              : `Are you sure you want to remove "${loc.name}" from the world?`,
                            confirmText: isPersian ? 'بله، حذف شود' : 'Delete',
                            cancelText: isPersian ? 'انصراف' : 'Cancel',
                            isDestructive: true,
                          });
                          if (conf) deleteLocation(loc.id);
                        }}
                        className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-zinc-100">{loc.name}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                      {loc.region}
                    </p>
                    {loc.description && <p className="text-xs text-zinc-400 leading-relaxed mt-2">{loc.description}</p>}
                  </div>

                  {/* Atmosphere */}
                  {loc.atmosphere && (
                    <div className="text-[11.5px] text-zinc-400 bg-zinc-950/40 border border-zinc-800/80 rounded-xl px-3 py-2">
                      <span className="text-zinc-300 font-bold flex items-center gap-1 mb-0.5">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        {isPersian ? 'فضاسازی:' : 'Atmosphere:'}
                      </span>
                      {loc.atmosphere}
                    </div>
                  )}

                  {/* Special Rules */}
                  {loc.specialRules && loc.specialRules.length > 0 && (
                    <div className="space-y-1.5 bg-rose-950/10 border border-rose-500/20 rounded-2xl p-3.5">
                      <span className="text-[11px] font-bold text-rose-300 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {isPersian ? 'قوانین ویژه مکان:' : 'Site Special Rules:'}
                      </span>
                      <ul className="space-y-1 text-xs text-rose-200/90">
                        {loc.specialRules.map((r, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Card Footer: Danger Tier + Connections */}
                <div className="pt-4 mt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                  <span className={`px-2.5 py-1 rounded-xl font-bold border ${danger.badgeClass}`}>
                    {isPersian ? danger.labelFa : danger.labelEn} · {loc.dangerLevel}/5
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-zinc-500" />
                    {(loc.connectedLocationIds || []).filter((id) => id !== loc.id).length}{' '}
                    {isPersian ? 'پیوند' : 'links'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Location Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {editingLocationId
                  ? isPersian
                    ? 'ویرایش مکان'
                    : 'Edit Location'
                  : isPersian
                    ? 'ثبت مکان جدید در جهان'
                    : 'Add New Location'}
              </span>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLocation} className="space-y-4">
              <AiFillSection type="location" onFilled={applyAiFill} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'نام مکان:' : 'Location Name:'}
                  </label>
                  <input
                    type="text"
                    value={locName}
                    onChange={(e) => setLocName(e.target.value)}
                    placeholder={isPersian ? 'مثال: برج گوگرد سیاه' : 'e.g. The Black Sulfur Spire'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'ناحیه / منطقه:' : 'Region:'}
                  </label>
                  <input
                    type="text"
                    value={locRegion}
                    onChange={(e) => setLocRegion(e.target.value)}
                    placeholder={isPersian ? 'مثال: اعماق دخمه‌های زیرین' : 'e.g. Subterranean Catacombs'}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'دسته‌بندی مکان (Category):' : 'Place Category:'}
                  </label>
                  <select
                    value={locCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    {categories.length === 0 ? (
                      <option value="dungeon">{isPersian ? 'دخمه / سیاه‌چال' : 'Dungeon'}</option>
                    ) : (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                    {isPersian ? 'سطح خطر (Danger 1–5):' : 'Danger Tier (1–5):'}
                  </label>
                  <select
                    value={locDangerLevel}
                    onChange={(e) => setLocDangerLevel(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  >
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl} · {isPersian ? DANGER_MAP[lvl].labelFa : DANGER_MAP[lvl].labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'شرح مکان و ظاهر:' : 'Description & Appearance:'}
                </label>
                <textarea
                  rows={2}
                  value={locDesc}
                  onChange={(e) => setLocDesc(e.target.value)}
                  placeholder={isPersian ? 'معماری، متریال و حس کلی مکان...' : 'Architecture, materials and overall feel...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'فضاسازی و لحن (Atmosphere):' : 'Atmosphere & Mood:'}
                </label>
                <input
                  type="text"
                  value={locAtmosphere}
                  onChange={(e) => setLocAtmosphere(e.target.value)}
                  placeholder={isPersian ? 'مثال: بوی تند گوگرد، چککه‌های مداوم آب اسیدی' : 'e.g. Pungent brimstone, dripping acid'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'قوانین ویژه مکان (هر خط یک مورد):' : 'Special Site Rules (One per line):'}
                </label>
                <textarea
                  rows={2}
                  value={locSpecialRules}
                  onChange={(e) => setLocSpecialRules(e.target.value)}
                  placeholder={isPersian ? 'کاهش مقاومت در برابر سموم\nنیاز به چکاپ مداوم' : 'Corrosive air requires fortitude checks\nFlickering light reveals hidden glyphs'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                  {isPersian ? 'مکان‌های پیوند خورده (Connected Locations):' : 'Connected Locations:'}
                </label>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-3 max-h-40 overflow-y-auto space-y-1.5">
                  {locations.filter((l) => l.id !== editingLocationId).length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      {isPersian ? 'هنوز مکان دیگری برای پیوند وجود ندارد.' : 'No other locations available to link yet.'}
                    </p>
                  ) : (
                    locations
                      .filter((l) => l.id !== editingLocationId)
                      .map((l) => {
                        const checked = locConnectedIds.includes(l.id);
                        return (
                          <label
                            key={l.id}
                            className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer hover:text-amber-200 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleConnected(l.id)}
                              className="accent-amber-500"
                            />
                            <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                            <span>{l.name}</span>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20"
                >
                  {editingLocationId
                    ? isPersian
                      ? 'ذخیره تغییرات'
                      : 'Update Location'
                    : isPersian
                      ? 'ثبت در جهان'
                      : 'Save to World'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
