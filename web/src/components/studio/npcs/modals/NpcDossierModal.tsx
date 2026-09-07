'use client';

import React, { useState, useEffect } from 'react';
import { User, X } from 'lucide-react';
import { NPCDossier, StoryManifest, Faction, WorldLocation } from '@/lib/types';
import AiFillSection from '@/components/studio/AiFillSection';

export interface NpcDossierModalProps {
  open: boolean;
  editingNpc: NPCDossier | null;
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
  story,
  isPersian,
  t,
  onClose,
  onSave,
}: NpcDossierModalProps) {
  const [npcForm, setNpcForm] = useState<NPCDossier>({
    id: '',
    name: '',
    title: '',
    factionId: '',
    currentLocationId: story.worldBible.locations[0]?.id || 'loc_dungeon_cell',
    personalityTraits: ['Honorable', 'Vigilant'],
    speechStyle: 'Speaks with measured authority.',
    goals: ['Protect the garrison'],
    secrets: [],
    initialTrust: 0,
  });

  const [traitInput, setTraitInput] = useState('');
  const [goalInput, setGoalInput] = useState('');

  useEffect(() => {
    if (editingNpc) {
      setNpcForm({ ...editingNpc });
    } else {
      setNpcForm({
        id: `npc_${Date.now().toString(36)}`,
        name: '',
        title: '',
        factionId: story.worldBible.factions[0]?.id || '',
        currentLocationId: story.worldBible.locations[0]?.id || 'loc_dungeon_cell',
        personalityTraits: ['Honorable', 'Vigilant'],
        speechStyle: 'Speaks with measured authority.',
        goals: ['Protect the garrison'],
        secrets: [],
        initialTrust: 0,
      });
    }
    setTraitInput('');
    setGoalInput('');
  }, [editingNpc, story, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!npcForm.name.trim()) return;
    onSave(npcForm);
    onClose();
  };

  const applyAiFill = (data: Record<string, unknown>) => {
    setNpcForm((prev) => ({
      ...prev,
      name: prev.name.trim() ? prev.name : (data.name as string) || prev.name,
      title: prev.title.trim() ? prev.title : (data.title as string) || prev.title,
      role: (data.role as string) || prev.role,
      speechStyle: prev.speechStyle.trim() ? prev.speechStyle : (data.speechStyle as string) || prev.speechStyle,
      personalityTraits: prev.personalityTraits.length
        ? prev.personalityTraits
        : ((data.personalityTraits as string[]) || []),
      goals: prev.goals.length ? prev.goals : ((data.goals as string[]) || []),
      secrets: prev.secrets.length ? prev.secrets : ((data.secrets as NPCDossier['secrets']) || []),
    }));
  };

  const nameLabel = t?.npcName || (isPersian ? 'نام شخصیت' : 'Character Name');
  const titleLabel = t?.npcTitle || (isPersian ? 'عنوان / پیشه' : 'Title / Role');
  const traitsLabel = t?.traits || (isPersian ? 'ویژگی‌های شخصیتی' : 'Personality Traits');
  const goalsLabel = t?.goals || (isPersian ? 'اهداف و انگیزه‌ها' : 'Goals & Agendas');
  const cancelLabel = t?.cancel || (isPersian ? 'انصراف' : 'Cancel');
  const saveLabel = t?.save || (isPersian ? 'ذخیره' : 'Save');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <User className="w-5 h-5 text-amber-400" />
            {editingNpc ? (isPersian ? 'ویرایش پرونده شخصیت' : 'Edit NPC Dossier') : (isPersian ? 'ثبت شخصیت جدید' : 'New NPC Dossier')}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Fill helper */}
        <AiFillSection
          type="npc"
          onFilled={applyAiFill}
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">{nameLabel}</label>
              <input
                type="text"
                value={npcForm.name}
                onChange={(e) => setNpcForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Captain Vane"
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
                placeholder="e.g. Garrison Commander"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
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
                {isPersian ? 'مکان فعلی' : 'Current Location'}
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

          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              {isPersian ? 'اعتماد اولیه:' : 'Initial Trust:'}
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
                placeholder="e.g. Paranoid"
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (traitInput.trim()) {
                    setNpcForm((prev) => ({
                      ...prev,
                      personalityTraits: [...prev.personalityTraits, traitInput.trim()],
                    }));
                    setTraitInput('');
                  }
                }}
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
                placeholder="e.g. Find proof of corruption"
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (goalInput.trim()) {
                    setNpcForm((prev) => ({
                      ...prev,
                      goals: [...prev.goals, goalInput.trim()],
                    }));
                    setGoalInput('');
                  }
                }}
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
