import React, { useState, useEffect } from 'react';
import { Sword, X, Plus, Trash2, Check, Heart } from 'lucide-react';
import { NPCDossier, NpcStatCalibration, NpcEquippedGear, NpcVitals, StoryManifest } from '@/lib/types';

const DEFAULT_VITALS: NpcVitals = { health: { current: 10, max: 10 } };

const VITAL_KEYS = [
  { key: 'health', labelEn: 'Health', labelFa: 'جان' },
  { key: 'stamina', labelEn: 'Stamina', labelFa: 'استقامت' },
  { key: 'mana', labelEn: 'Mana', labelFa: 'مانا' },
] as const;

export interface NpcStatCalibrationModalProps {
  open: boolean;
  targetNpc: NPCDossier | null;
  story?: StoryManifest;
  isPersian: boolean;
  onClose: () => void;
  onSave: (calibration: NpcStatCalibration) => void;
}

function getDefaultStatRatings(story?: StoryManifest): Record<string, number> {
  if (story?.rpgSystem?.stats?.length) {
    const map: Record<string, number> = {};
    for (const s of story.rpgSystem.stats) {
      map[s.id] = s.baseValue ?? 3;
    }
    return map;
  }
  return { might: 3, cunning: 3, agility: 3, arcana: 2 };
}

export function NpcStatCalibrationModal({
  open,
  targetNpc,
  story,
  isPersian,
  onClose,
  onSave,
}: NpcStatCalibrationModalProps) {
  const [statForm, setStatForm] = useState<NpcStatCalibration>({
    npcName: '',
    combatTier: 'civilian',
    challengeRating: 1,
    crBasis: '',
    statRatings: getDefaultStatRatings(story),
    signatureAbilities: [],
    equippedGear: [],
    vitals: { ...DEFAULT_VITALS },
    resourcePools: [],
  });
  const [statAbilityInput, setStatAbilityInput] = useState('');
  const [newStatKey, setNewStatKey] = useState('');
  const [newStatVal, setNewStatVal] = useState<number>(3);
  const [newGearName, setNewGearName] = useState('');
  const [newGearType, setNewGearType] = useState<string>('weapon');
  const [newGearDesc, setNewGearDesc] = useState('');
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolMax, setNewPoolMax] = useState<number>(3);

  useEffect(() => {
    if (open && targetNpc) {
      if (targetNpc.statCalibration) {
        setStatForm({
          npcId: targetNpc.id,
          npcName: targetNpc.statCalibration.npcName || targetNpc.name,
          combatTier: targetNpc.statCalibration.combatTier || 'civilian',
          challengeRating: targetNpc.statCalibration.challengeRating ?? 1,
          crBasis: targetNpc.statCalibration.crBasis || '',
          statRatings: targetNpc.statCalibration.statRatings
            ? { ...targetNpc.statCalibration.statRatings }
            : getDefaultStatRatings(story),
          signatureAbilities: [...(targetNpc.statCalibration.signatureAbilities || [])],
          equippedGear: (targetNpc.statCalibration.equippedGear || []).map((g: NpcEquippedGear) => ({ ...g })),
          vitals: targetNpc.statCalibration.vitals
            ? {
                health: { ...targetNpc.statCalibration.vitals.health },
                ...(targetNpc.statCalibration.vitals.stamina
                  ? { stamina: { ...targetNpc.statCalibration.vitals.stamina } }
                  : {}),
                ...(targetNpc.statCalibration.vitals.mana
                  ? { mana: { ...targetNpc.statCalibration.vitals.mana } }
                  : {}),
              }
            : { ...DEFAULT_VITALS },
          resourcePools: (targetNpc.statCalibration.resourcePools || []).map((p) => ({ ...p })),
        });
      } else {
        setStatForm({
          npcId: targetNpc.id,
          npcName: targetNpc.name,
          combatTier: 'civilian',
          challengeRating: 1,
          crBasis: '',
          statRatings: getDefaultStatRatings(story),
          signatureAbilities: [],
          equippedGear: [],
          vitals: { ...DEFAULT_VITALS },
          resourcePools: [],
        });
      }
      setStatAbilityInput('');
      setNewStatKey('');
      setNewStatVal(3);
      setNewGearName('');
      setNewGearType('weapon');
      setNewGearDesc('');
      setNewPoolName('');
      setNewPoolMax(3);
    }
  }, [open, targetNpc, story]);

  if (!open || !targetNpc) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...statForm,
      npcId: targetNpc.id,
      npcName: targetNpc.name,
    });
  };

  const setVitalBar = (
    key: 'health' | 'stamina' | 'mana',
    field: 'current' | 'max',
    value: number
  ) => {
    setStatForm((prev: NpcStatCalibration) => {
      const base = prev.vitals || { ...DEFAULT_VITALS };
      const bar = base[key] || { current: 0, max: 10 };
      const nextMax = field === 'max' ? Math.max(1, value) : bar.max;
      const nextCurrent = Math.max(0, Math.min(nextMax, field === 'current' ? value : bar.current));
      return { ...prev, vitals: { ...base, [key]: { current: nextCurrent, max: nextMax } } };
    });
  };

  const addVitalBar = (key: 'stamina' | 'mana') => {
    setStatForm((prev: NpcStatCalibration) => ({
      ...prev,
      vitals: { ...(prev.vitals || { ...DEFAULT_VITALS }), [key]: { current: 10, max: 10 } },
    }));
  };

  const removeVitalBar = (key: 'stamina' | 'mana') => {
    setStatForm((prev: NpcStatCalibration) => {
      const next = { ...(prev.vitals || { ...DEFAULT_VITALS }) };
      delete next[key];
      return { ...prev, vitals: next };
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Sword className="w-5 h-5 text-amber-400" />
            <span>
              {targetNpc.statCalibration
                ? isPersian
                  ? `ویرایش ویژگی‌های رزمی: ${targetNpc.name}`
                  : `Edit Combat Stats: ${targetNpc.name}`
                : isPersian
                ? `ثبت ویژگی‌های رزمی: ${targetNpc.name}`
                : `Create Combat Stats: ${targetNpc.name}`}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Combat Tier & Challenge Rating */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {isPersian ? 'رده رزمی (Combat Tier):' : 'Combat Tier:'}
              </label>
              <select
                value={statForm.combatTier}
                onChange={(e) =>
                  setStatForm((prev: NpcStatCalibration) => ({
                    ...prev,
                    combatTier: e.target.value as NpcStatCalibration['combatTier'],
                  }))
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="civilian">{isPersian ? 'غیرنظامی (Civilian)' : 'Civilian'}</option>
                <option value="apprentice">{isPersian ? 'تازه‌کار / شاگرد (Apprentice)' : 'Apprentice'}</option>
                <option value="veteran">{isPersian ? 'کهنه‌کار (Veteran)' : 'Veteran'}</option>
                <option value="elite">{isPersian ? 'نخبه / سردار (Elite)' : 'Elite'}</option>
                <option value="boss">{isPersian ? 'غول / هماورد (Boss)' : 'Boss'}</option>
                <option value="mythic">{isPersian ? 'افسانه‌ای (Mythic)' : 'Mythic'}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {isPersian ? 'درجه تهدید کلی (CR 1-30) — مستقل از رده رزمی:' : 'Overall Threat (CR 1-30) — independent of combat tier:'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={statForm.challengeRating}
                  onChange={(e) =>
                    setStatForm((prev: NpcStatCalibration) => ({
                      ...prev,
                      challengeRating: Math.max(1, Math.min(30, parseInt(e.target.value) || 1)),
                    }))
                  }
                  className="w-20 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-500 text-center"
                />
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={statForm.challengeRating}
                  onChange={(e) =>
                    setStatForm((prev: NpcStatCalibration) => ({
                      ...prev,
                      challengeRating: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="flex-1 accent-amber-500"
                />
              </div>
            </div>
          </div>

          {/* CR basis — what drives threat beyond raw fighting ability */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              {isPersian ? 'منشأ تهدید (اگر CR از رزم فراتر است):' : 'Threat source (when CR outruns fighting ability):'}
            </label>
            <input
              type="text"
              value={statForm.crBasis || ''}
              onChange={(e) =>
                setStatForm((prev: NpcStatCalibration) => ({ ...prev, crBasis: e.target.value }))
              }
              placeholder={isPersian ? 'مثال: نفوذ در دربار، شبکه جاسوسان…' : 'e.g. court influence, spy network, archmage patron…'}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Attributes Grid */}
          <div>
            <label className="block text-xs text-zinc-300 font-bold mb-1.5">
              {isPersian ? 'امتیاز ویژگی‌ها و صفات:' : 'Attributes / Stat Ratings:'}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" dir="ltr">
              {Object.entries(statForm.statRatings).map(([stKey, stVal]) => {
                const statDef = story?.rpgSystem?.stats?.find(
                  (s) => s.id.toLowerCase() === stKey.toLowerCase() || s.name.toLowerCase() === stKey.toLowerCase()
                );
                const displayName = isPersian ? (statDef?.name || stKey) : (statDef?.id || stKey);
                return (
                  <div
                    key={stKey}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-center relative group"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...statForm.statRatings };
                        delete updated[stKey];
                        setStatForm((prev: NpcStatCalibration) => ({ ...prev, statRatings: updated }));
                      }}
                      className="absolute top-1 right-1 text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 cursor-pointer"
                      title="Remove"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                    <span className="text-[10px] text-zinc-400 font-mono block uppercase" title={stKey}>{displayName}</span>
                  <input
                    type="number"
                    value={stVal}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 0;
                      setStatForm((prev: NpcStatCalibration) => ({
                        ...prev,
                        statRatings: { ...prev.statRatings, [stKey]: v },
                      }));
                    }}
                    className="w-full bg-transparent text-center font-bold text-amber-300 text-xs focus:outline-none font-mono"
                  />
                </div>
              );
            })}
            </div>

            {/* Add Custom Attribute */}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newStatKey}
                onChange={(e) => setNewStatKey(e.target.value)}
                placeholder={isPersian ? 'نام ویژگی جدید (مثلا PER)' : 'Stat code (e.g. AGI)'}
                className="w-32 bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 font-mono uppercase focus:outline-none focus:border-amber-500"
              />
              <input
                type="number"
                value={newStatVal}
                onChange={(e) => setNewStatVal(parseInt(e.target.value) || 10)}
                className="w-16 bg-zinc-950 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 font-mono text-center focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (newStatKey.trim()) {
                    setStatForm((prev: NpcStatCalibration) => ({
                      ...prev,
                      statRatings: { ...prev.statRatings, [newStatKey.trim().toUpperCase()]: newStatVal },
                    }));
                    setNewStatKey('');
                    setNewStatVal(10);
                  }
                }}
                className="px-3 py-1.5 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700 cursor-pointer"
              >
                + {isPersian ? 'ویژگی' : 'Add Stat'}
              </button>
            </div>
          </div>

          {/* Vitals & Resource Pools */}
          <div>
            <label className="block text-xs text-zinc-300 font-bold mb-1.5 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              {isPersian ? 'علائم حیاتی و مخازن منابع:' : 'Vitals & Resource Pools:'}
            </label>
            <div className="space-y-2">
              {VITAL_KEYS.map(({ key, labelEn, labelFa }) => {
                const bar = (statForm.vitals || DEFAULT_VITALS)[key];
                if (!bar) {
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => addVitalBar(key as 'stamina' | 'mana')}
                      className="text-[11px] text-zinc-500 hover:text-amber-300 border border-dashed border-zinc-700 hover:border-amber-500/50 rounded-xl px-3 py-1.5 cursor-pointer"
                    >
                      + {isPersian ? labelFa : labelEn}
                    </button>
                  );
                }
                return (
                  <div
                    key={key}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 flex items-center gap-3"
                  >
                    <span className="text-[11px] text-zinc-300 font-bold w-16">
                      {isPersian ? labelFa : labelEn}
                    </span>
                    <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                      {isPersian ? 'فعلی' : 'Cur'}
                      <input
                        type="number"
                        min={0}
                        max={bar.max}
                        value={bar.current}
                        onChange={(e) => setVitalBar(key, 'current', parseInt(e.target.value) || 0)}
                        className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-rose-200 font-mono text-center focus:outline-none focus:border-rose-500"
                      />
                    </label>
                    <span className="text-zinc-600 font-mono">/</span>
                    <label className="flex items-center gap-1 text-[10px] text-zinc-500">
                      {isPersian ? 'حداکثر' : 'Max'}
                      <input
                        type="number"
                        min={1}
                        value={bar.max}
                        onChange={(e) => setVitalBar(key, 'max', parseInt(e.target.value) || 1)}
                        className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 font-mono text-center focus:outline-none focus:border-rose-500"
                      />
                    </label>
                    <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all"
                        style={{ width: `${bar.max > 0 ? Math.round((bar.current / bar.max) * 100) : 0}%` }}
                      />
                    </div>
                    {key !== 'health' && (
                      <button
                        type="button"
                        onClick={() => removeVitalBar(key as 'stamina' | 'mana')}
                        className="text-zinc-600 hover:text-rose-400 cursor-pointer"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Resource pools list */}
            <div className="space-y-1.5 mt-2">
              {(statForm.resourcePools || []).map((pool, pIdx) => (
                <div
                  key={pool.id || pIdx}
                  className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={pool.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStatForm((prev: NpcStatCalibration) => ({
                        ...prev,
                        resourcePools: (prev.resourcePools || []).map((p, idx) =>
                          idx === pIdx ? { ...p, name: val } : p
                        ),
                      }));
                    }}
                    placeholder={isPersian ? 'نام منبع (مثلا خشم، مانا)...' : 'Pool name (e.g. Rage, Focus)...'}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 font-bold focus:outline-none"
                  />
                  <input
                    type="number"
                    min={0}
                    max={pool.max}
                    value={pool.current}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setStatForm((prev: NpcStatCalibration) => ({
                        ...prev,
                        resourcePools: (prev.resourcePools || []).map((p, idx) =>
                          idx === pIdx
                            ? { ...p, current: Math.max(0, Math.min(p.max, val)) }
                            : p
                        ),
                      }));
                    }}
                    className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1 text-xs text-amber-200 font-mono text-center focus:outline-none"
                  />
                  <span className="text-zinc-600 font-mono text-xs">/</span>
                  <input
                    type="number"
                    min={1}
                    value={pool.max}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      setStatForm((prev: NpcStatCalibration) => ({
                        ...prev,
                        resourcePools: (prev.resourcePools || []).map((p, idx) =>
                          idx === pIdx
                            ? { ...p, max: val, current: Math.min(p.current, val) }
                            : p
                        ),
                      }));
                    }}
                    className="w-14 bg-zinc-900 border border-zinc-700 rounded-lg px-1.5 py-1 text-xs text-zinc-100 font-mono text-center focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setStatForm((prev: NpcStatCalibration) => ({
                        ...prev,
                        resourcePools: (prev.resourcePools || []).filter((_, idx) => idx !== pIdx),
                      }))
                    }
                    className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newPoolName}
                onChange={(e) => setNewPoolName(e.target.value)}
                placeholder={isPersian ? 'منبع جدید (مثلا شکاف طلسم)...' : 'New pool (e.g. Spell Slots)...'}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <input
                type="number"
                min={1}
                value={newPoolMax}
                onChange={(e) => setNewPoolMax(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 bg-zinc-950 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-zinc-100 font-mono text-center focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (newPoolName.trim()) {
                    const name = newPoolName.trim();
                    setStatForm((prev: NpcStatCalibration) => ({
                      ...prev,
                      resourcePools: [
                        ...(prev.resourcePools || []),
                        {
                          id: `pool_${Date.now().toString(36)}`,
                          name,
                          current: newPoolMax,
                          max: newPoolMax,
                        },
                      ],
                    }));
                    setNewPoolName('');
                    setNewPoolMax(3);
                  }
                }}
                className="px-3 py-1.5 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{isPersian ? '+ منبع' : '+ Add'}</span>
              </button>
            </div>
          </div>

          {/* Signature Abilities */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              {isPersian ? 'توانایی‌های ویژه رزمی:' : 'Signature Combat Abilities:'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={statAbilityInput}
                onChange={(e) => setStatAbilityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (statAbilityInput.trim()) {
                      setStatForm((prev: NpcStatCalibration) => ({
                        ...prev,
                        signatureAbilities: [...prev.signatureAbilities, statAbilityInput.trim()],
                      }));
                      setStatAbilityInput('');
                    }
                  }
                }}
                placeholder={isPersian ? 'مثال: ضربه گیج‌کننده، رقص شمشیر باد' : 'e.g. Blinding Smoke, Cleave, Arcane Ward'}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (statAbilityInput.trim()) {
                    setStatForm((prev: NpcStatCalibration) => ({
                      ...prev,
                      signatureAbilities: [...prev.signatureAbilities, statAbilityInput.trim()],
                    }));
                    setStatAbilityInput('');
                  }
                }}
                className="px-3 py-2 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700 cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {statForm.signatureAbilities.map((ab: string, abIdx: number) => (
                <span
                  key={abIdx}
                  className="bg-zinc-950 text-amber-200 border border-amber-500/20 text-[11px] px-2 py-0.5 rounded-lg flex items-center gap-1"
                >
                  ⚡ {ab}
                  <button
                    type="button"
                    onClick={() =>
                      setStatForm((prev: NpcStatCalibration) => ({
                        ...prev,
                        signatureAbilities: prev.signatureAbilities.filter((_: string, idx: number) => idx !== abIdx),
                      }))
                    }
                    className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Equipped Gear */}
          <div className="space-y-2">
            <label className="block text-xs text-zinc-300 font-bold">
              {isPersian ? 'تجهیزات و سلاح‌های مجهز:' : 'Equipped Gear & Weapons:'}
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {statForm.equippedGear.map((gear: NpcEquippedGear, gIdx: number) => (
                <div
                  key={gIdx}
                  className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={gear.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStatForm((prev: NpcStatCalibration) => ({
                          ...prev,
                          equippedGear: prev.equippedGear.map((g: NpcEquippedGear, idx: number) =>
                            idx === gIdx ? { ...g, name: val } : g
                          ),
                        }));
                      }}
                      placeholder={isPersian ? 'نام سلاح / پوشش' : 'Item name'}
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 font-bold focus:outline-none"
                    />
                    <select
                      value={gear.type}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStatForm((prev: NpcStatCalibration) => ({
                          ...prev,
                          equippedGear: prev.equippedGear.map((g: NpcEquippedGear, idx: number) =>
                            idx === gIdx ? { ...g, type: val } : g
                          ),
                        }));
                      }}
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 focus:outline-none"
                    >
                      <option value="weapon">{isPersian ? 'سلاح (Weapon)' : 'Weapon'}</option>
                      <option value="armor">{isPersian ? 'زره (Armor)' : 'Armor'}</option>
                      <option value="shield">{isPersian ? 'سپر (Shield)' : 'Shield'}</option>
                      <option value="focus">{isPersian ? 'کانون جادو (Focus)' : 'Focus'}</option>
                      <option value="trinket">{isPersian ? 'طلسم / زیور (Trinket)' : 'Trinket'}</option>
                      <option value="potion">{isPersian ? 'معجون (Potion)' : 'Potion'}</option>
                    </select>
                    <input
                      type="text"
                      value={gear.description || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStatForm((prev: NpcStatCalibration) => ({
                          ...prev,
                          equippedGear: prev.equippedGear.map((g: NpcEquippedGear, idx: number) =>
                            idx === gIdx ? { ...g, description: val } : g
                          ),
                        }));
                      }}
                      placeholder={isPersian ? 'توضیح کوتاه...' : 'Description...'}
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setStatForm((prev: NpcStatCalibration) => ({
                        ...prev,
                        equippedGear: prev.equippedGear.filter((_: NpcEquippedGear, idx: number) => idx !== gIdx),
                      }))
                    }
                    className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {statForm.equippedGear.length === 0 && (
                <div className="text-center py-2 text-xs text-zinc-500 italic">
                  {isPersian ? 'هیچ سلاح یا ابزاری ثبت نشده است.' : 'No gear equipped.'}
                </div>
              )}
            </div>

            {/* Add New Gear row */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newGearName}
                onChange={(e) => setNewGearName(e.target.value)}
                placeholder={isPersian ? 'نام وسیله یا سلاح...' : 'New gear name...'}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <select
                value={newGearType}
                onChange={(e) => setNewGearType(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-zinc-300 focus:outline-none"
              >
                <option value="weapon">{isPersian ? 'سلاح' : 'Weapon'}</option>
                <option value="armor">{isPersian ? 'زره' : 'Armor'}</option>
                <option value="shield">{isPersian ? 'سپر' : 'Shield'}</option>
                <option value="focus">{isPersian ? 'کانون' : 'Focus'}</option>
                <option value="trinket">{isPersian ? 'طلسم' : 'Trinket'}</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (newGearName.trim()) {
                    setStatForm((prev: NpcStatCalibration) => ({
                      ...prev,
                      equippedGear: [
                        ...prev.equippedGear,
                        { name: newGearName.trim(), type: newGearType, description: newGearDesc.trim() || undefined },
                      ],
                    }));
                    setNewGearName('');
                    setNewGearDesc('');
                  }
                }}
                className="px-3 py-1.5 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{isPersian ? '+ سلاح/تجهیزات' : '+ Add'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
            >
              {isPersian ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 text-zinc-950 text-xs font-bold hover:bg-amber-500 cursor-pointer shadow-lg shadow-amber-600/30 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isPersian ? 'ذخیره ویژگی‌های رزمی' : 'Save RPG Stats'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
