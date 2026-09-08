'use client';

import React, { useState, useEffect } from 'react';
import { User, Users, X, MapPin, Briefcase } from 'lucide-react';
import { NPCDossier, StoryManifest, Faction, WorldLocation, NpcKind } from '@/lib/types';

export interface NpcDossierModalProps {
  open: boolean;
  editingNpc: NPCDossier | null;
  defaultKind?: NpcKind;
  story: StoryManifest;
  isPersian: boolean;
  t?: {
    npcName?: string;
    npcTitle?: string;
    traits?: string;
    goals?: string;
    cancel?: string;
    save?: string;
  };
  onClose: () => void;
  onSave: (npc: NPCDossier) => void;
}

export function NpcDossierModal({
  open,
  editingNpc,
  defaultKind,
  story,
  isPersian,
  t,
  onClose,
  onSave,
}: NpcDossierModalProps) {
  const ontologyRoles = story.worldBible.ontology?.npcRoles || [];

  const [npcForm, setNpcForm] = useState<NPCDossier>({
    id: '',
    name: '',
    title: '',
    role: '',
    kind: 'individual',
    factionId: '',
    currentLocationId: story.worldBible.locations[0]?.id || 'loc_dungeon_cell',
    applicableLocationIds: [],
    personalityTraits: ['Honorable', 'Vigilant'],
    speechStyle: 'Speaks with measured authority.',
    goals: ['Protect the garrison'],
    secrets: [],
    initialTrust: 0,
  });

  const [traitInput, setTraitInput] = useState('');
  const [goalInput, setGoalInput] = useState('');

  const splitCommaSeparated = (text?: string): string[] => {
    if (!text || typeof text !== 'string') return [];
    return text
      .split(/[,،\n]+/)
      .map((s) => s.trim().replace(/^[•\-\*]\s*/, ''))
      .filter((s) => s.length > 0);
  };

  useEffect(() => {
    if (editingNpc) {
      setNpcForm({
        ...editingNpc,
        name: editingNpc.name || '',
        title: editingNpc.title || '',
        role: editingNpc.role || '',
        speechStyle: editingNpc.speechStyle || '',
        kind: editingNpc.kind || 'individual',
        applicableLocationIds: editingNpc.applicableLocationIds || [],
        personalityTraits: (editingNpc.personalityTraits || []).flatMap((t) => splitCommaSeparated(t)),
        goals: (editingNpc.goals || []).flatMap((g) => splitCommaSeparated(g)),
        secrets: editingNpc.secrets || [],
        initialTrust: editingNpc.initialTrust ?? 0,
      });
    } else {
      setNpcForm({
        id: `npc_${Date.now().toString(36)}`,
        name: '',
        title: '',
        role: '',
        kind: defaultKind || 'individual',
        factionId: story.worldBible.factions[0]?.id || '',
        currentLocationId: story.worldBible.locations[0]?.id || 'loc_dungeon_cell',
        applicableLocationIds: [],
        personalityTraits: ['Honorable', 'Vigilant'],
        speechStyle: 'Speaks with measured authority.',
        goals: ['Protect the garrison'],
        secrets: [],
        initialTrust: 0,
      });
    }
    setTraitInput('');
    setGoalInput('');
  }, [editingNpc, defaultKind, story, open]);

  if (!open) return null;

  const handleAddTrait = () => {
    if (!traitInput.trim()) return;
    const split = splitCommaSeparated(traitInput);
    if (split.length > 0) {
      setNpcForm((prev) => ({
        ...prev,
        personalityTraits: [...prev.personalityTraits, ...split],
      }));
      setTraitInput('');
    }
  };

  const handleAddGoal = () => {
    if (!goalInput.trim()) return;
    const split = splitCommaSeparated(goalInput);
    if (split.length > 0) {
      setNpcForm((prev) => ({
        ...prev,
        goals: [...prev.goals, ...split],
      }));
      setGoalInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!npcForm.name.trim()) return;

    let finalTraits = [...npcForm.personalityTraits];
    if (traitInput.trim()) {
      finalTraits = [...finalTraits, ...splitCommaSeparated(traitInput)];
    }

    let finalGoals = [...npcForm.goals];
    if (goalInput.trim()) {
      finalGoals = [...finalGoals, ...splitCommaSeparated(goalInput)];
    }

    onSave({
      ...npcForm,
      role: npcForm.role?.trim() || undefined,
      personalityTraits: finalTraits,
      goals: finalGoals,
    });
    onClose();
  };

  const nameLabel = npcForm.kind === 'template'
    ? (isPersian ? 'عنوان الگو / نام گروه' : 'Template Title / Group Name')
    : (t?.npcName || (isPersian ? 'نام شخصیت' : 'Character Name'));

  const titleLabel = npcForm.kind === 'template'
    ? (isPersian ? 'کارکرد / نقش کهن‌الگو' : 'Archetype Function / Role')
    : (t?.npcTitle || (isPersian ? 'عنوان / پیشه' : 'Title / Role'));

  const traitsLabel = t?.traits || (isPersian ? 'ویژگی‌های شخصیتی' : 'Personality Traits');
  const goalsLabel = t?.goals || (isPersian ? 'اهداف و انگیزه‌ها' : 'Goals & Agendas');
  const cancelLabel = t?.cancel || (isPersian ? 'انصراف' : 'Cancel');
  const saveLabel = t?.save || (isPersian ? 'ذخیره' : 'Save');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            {npcForm.kind === 'template' ? (
              <Users className="w-5 h-5 text-cyan-400" />
            ) : (
              <User className="w-5 h-5 text-amber-400" />
            )}
            {editingNpc
              ? (npcForm.kind === 'template'
                ? (isPersian ? 'ویرایش الگوی شخصیت‌های فرعی' : 'Edit Archetype Template')
                : (isPersian ? 'ویرایش پرونده شخصیت' : 'Edit NPC Dossier'))
              : (npcForm.kind === 'template'
                ? (isPersian ? 'ثبت الگوی گروهی جدید' : 'New Group Archetype Template')
                : (isPersian ? 'ثبت شخصیت جدید' : 'New NPC Dossier'))}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NPC Kind Selector (Named Individual vs Group Archetype) */}
        <div className="flex items-center gap-2 p-1 bg-zinc-950/60 rounded-2xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setNpcForm((prev) => ({ ...prev, kind: 'individual' }))}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${npcForm.kind !== 'template'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{isPersian ? 'شخصیت نامدار / فردی' : 'Named Character (Individual)'}</span>
          </button>
          <button
            type="button"
            onClick={() => setNpcForm((prev) => ({ ...prev, kind: 'template' }))}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${npcForm.kind === 'template'
                ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isPersian ? 'الگوی گروهی / شخصیت‌های فرعی' : 'Group Archetype / Mob Template'}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{nameLabel}</label>
              <input
                type="text"
                value={npcForm.name}
                onChange={(e) => setNpcForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={
                  npcForm.kind === 'template'
                    ? (isPersian ? 'مثلاً: گشت نگهبانان دروازه' : 'e.g. City Gate Patrol')
                    : 'e.g. Captain Vane'
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{titleLabel}</label>
              <input
                type="text"
                value={npcForm.title}
                onChange={(e) => setNpcForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={
                  npcForm.kind === 'template'
                    ? (isPersian ? 'دیده‌بان و نگهبان مسلح' : 'Armed Sentry Archetype')
                    : 'e.g. Garrison Commander'
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Character Role (Ontology) */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
              <span>{isPersian ? 'نقش و رده شخصیتی (هستی‌شناسی):' : 'Character Role (Ontology):'}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                list="npc-roles-list"
                value={npcForm.role || ''}
                onChange={(e) => setNpcForm((prev) => ({ ...prev, role: e.target.value }))}
                placeholder={
                  isPersian
                    ? 'انتخاب یا تایپ نقش (مثلاً: حاکم، نگهبان، کیمیاگر، قاچاقچی، مورخ)'
                    : 'Select or type role (e.g. Ruler, Guard, Alchemist, Smuggler, Scholar)'
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <datalist id="npc-roles-list">
                {ontologyRoles.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.description ? `${r.name} — ${r.description}` : r.name}
                  </option>
                ))}
              </datalist>
            </div>

            {/* Quick-select chips from World Bible ontology */}
            {ontologyRoles.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-zinc-500 font-medium">
                  {isPersian ? 'نقش‌های تعریف‌شده در جهان:' : 'World Ontology Roles:'}
                </span>
                {ontologyRoles.map((r) => {
                  const isSelected = npcForm.role === r.name || npcForm.role === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setNpcForm((prev) => ({ ...prev, role: isSelected ? '' : r.name }))}
                      title={r.description || r.name}
                      className={`text-[10.5px] px-2.5 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-sm'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: r.color || '#F59E0B' }}
                      />
                      <span>{r.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {isPersian ? 'جناح و وابستگی' : 'Faction Allegiance'}
              </label>
              <select
                value={npcForm.factionId || ''}
                onChange={(e) => setNpcForm((prev) => ({ ...prev, factionId: e.target.value }))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                <option value="">{isPersian ? '-- بدون جناح / مستقل --' : '-- Independent --'}</option>
                {story.worldBible.factions.map((f: Faction) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">
                {npcForm.kind === 'template'
                  ? (isPersian ? 'مقر / پایگاه اصلی' : 'Primary Base / Headquarters')
                  : (isPersian ? 'مکان فعلی' : 'Current Location')}
              </label>
              <select
                value={npcForm.currentLocationId}
                onChange={(e) =>
                  setNpcForm((prev) => ({ ...prev, currentLocationId: e.target.value }))
                }
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              >
                {story.worldBible.locations.map((l: WorldLocation) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Operating Locations for Templates */}
          {npcForm.kind === 'template' && (
            <div className="p-3 bg-zinc-950/50 border border-zinc-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  {isPersian ? 'مناطق حضور و گشت‌زنی این الگو:' : 'Operating Districts / Spawn Locations:'}
                </label>
                <span className="text-[11px] text-zinc-500">
                  {(npcForm.applicableLocationIds || []).length} {isPersian ? 'مکان انتخاب شده' : 'selected'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                {story.worldBible.locations.map((loc: WorldLocation) => {
                  const isSelected = (npcForm.applicableLocationIds || []).includes(loc.id);
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => {
                        setNpcForm((prev) => {
                          const curr = prev.applicableLocationIds || [];
                          const next = isSelected ? curr.filter((id) => id !== loc.id) : [...curr, loc.id];
                          return { ...prev, applicableLocationIds: next };
                        });
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${isSelected
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200 font-medium'
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-zinc-300'
                        }`}
                    >
                      {loc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              {npcForm.kind === 'template'
                ? (isPersian ? 'گرایش و رویکرد اولیه گروه (-100 تا +100):' : 'Baseline Group Disposition (-100 to +100):')
                : (isPersian ? 'اعتماد اولیه:' : 'Initial Trust:')}
            </label>
            <input
              type="number"
              min="-100"
              max="100"
              value={npcForm.initialTrust}
              onChange={(e) =>
                setNpcForm((prev) => ({ ...prev, initialTrust: parseInt(e.target.value) || 0 }))
              }
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              {isPersian ? 'دستورالعمل لحن گفتار:' : 'Speech & Voice Style:'}
            </label>
            <input
              type="text"
              value={npcForm.speechStyle}
              onChange={(e) => setNpcForm((prev) => ({ ...prev, speechStyle: e.target.value }))}
              placeholder="e.g. Speaks slowly with cold calculation."
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Traits Input */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">{traitsLabel}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={traitInput}
                onChange={(e) => setTraitInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTrait();
                  }
                }}
                placeholder={isPersian ? 'مثلاً: کینهتوز، خوددار، بدبین...' : 'e.g. Paranoid, Patient, Ruthless...'}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddTrait}
                className="px-3 py-2 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700 cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {npcForm.personalityTraits.map((tItem, i) => (
                <span
                  key={i}
                  className="bg-zinc-800 text-zinc-300 text-[11px] px-2 py-0.5 rounded-lg flex items-center gap-1"
                >
                  {tItem}
                  <button
                    type="button"
                    onClick={() =>
                      setNpcForm((prev) => ({
                        ...prev,
                        personalityTraits: prev.personalityTraits.filter((_, idx) => idx !== i),
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

          {/* Goals Input */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">{goalsLabel}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddGoal();
                  }
                }}
                placeholder={isPersian ? 'مثلاً: احیای کوره باستانی، کشف خیانت...' : 'e.g. Find proof of corruption...'}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddGoal}
                className="px-3 py-2 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700 cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {npcForm.goals.map((gItem, i) => (
                <span
                  key={i}
                  className="bg-zinc-800 text-zinc-300 text-[11px] px-2 py-0.5 rounded-lg flex items-center gap-1"
                >
                  {gItem}
                  <button
                    type="button"
                    onClick={() =>
                      setNpcForm((prev) => ({
                        ...prev,
                        goals: prev.goals.filter((_, idx) => idx !== i),
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

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400 cursor-pointer"
            >
              {saveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NpcDossierModal;
