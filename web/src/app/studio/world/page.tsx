'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { WorldLaw, Faction } from '@/lib/types';
import { notify } from '@/lib/notify';
import {
  BookOpen,
  Shield,
  Users,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Sparkles,
  Info,
} from 'lucide-react';

export default function WorldBiblePage() {
  const {
    story,
    isPersian,
    updateWorldMeta,
    addWorldLaw,
    editWorldLaw,
    deleteWorldLaw,
    addFaction,
    editFaction,
    deleteFaction,
  } = useStudioStory();

  // World Meta edit state
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({
    worldName: story.worldBible.worldName,
    summary: story.worldBible.summary,
    themeNotes: story.worldBible.themeNotes,
  });

  // Law Modal state
  const [lawModalOpen, setLawModalOpen] = useState(false);
  const [editingLawId, setEditingLawId] = useState<string | null>(null);
  const [lawForm, setLawForm] = useState<{
    id: string;
    rule: string;
    description: string;
    category: WorldLaw['category'];
  }>({
    id: '',
    rule: '',
    description: '',
    category: 'magic',
  });

  // Faction Modal state
  const [factionModalOpen, setFactionModalOpen] = useState(false);
  const [editingFactionId, setEditingFactionId] = useState<string | null>(null);
  const [factionForm, setFactionForm] = useState<{
    id: string;
    name: string;
    description: string;
    alignment: string;
    publicGoals: string;
  }>({
    id: '',
    name: '',
    description: '',
    alignment: 'Neutral',
    publicGoals: '',
  });

  const t = {
    heading: isPersian ? 'انجیل جهان و قوانین ثابت' : 'World Bible & Lore Graph',
    subheading: isPersian
      ? 'حقایق ثابت، قوانین فیزیکی/جادویی و جناح‌های تغییرناپذیر جهان'
      : 'Immutable world rules, physics/magic laws, factions, and geographical codices.',
    worldIdLabel: isPersian ? 'شناسه جهان:' : 'World ID:',
    artisticTone: isPersian ? 'لحن هنری و فضاسازی:' : 'Artistic Tone & Atmosphere:',
    immutableLaws: isPersian ? 'قوانین ثابت و محدودیت‌ها' : 'Immutable World Laws',
    factions: isPersian ? 'جناح‌ها و هم‌پیمانی‌ها' : 'Factions & Allegiances',
    goals: isPersian ? 'اهداف عمومی:' : 'Public Goals:',
    addLaw: isPersian ? '+ ثبت قانون جدید' : '+ Add World Law',
    addFaction: isPersian ? '+ ثبت جناح جدید' : '+ Add Faction',
    editMeta: isPersian ? 'ویرایش مشخصات جهان' : 'Edit World Details',
    save: isPersian ? 'ذخیره تغییرات' : 'Save Changes',
    cancel: isPersian ? 'انصراف' : 'Cancel',
    category: isPersian ? 'دسته‌بندی' : 'Category',
    ruleTitle: isPersian ? 'عنوان قانون (خلاصه)' : 'Rule Title (Concise)',
    description: isPersian ? 'توضیحات و مصادیق قانون' : 'Description & Constraints',
    alignment: isPersian ? 'گرایش و موضع' : 'Alignment',
    factionName: isPersian ? 'نام جناح / گروه' : 'Faction Name',
  };

  // Handle Meta Save
  const handleSaveMeta = (e: React.FormEvent) => {
    e.preventDefault();
    updateWorldMeta(metaForm);
    setIsEditingMeta(false);
  };

  // Open Law Modal for Create/Edit
  const openLawModal = (law?: WorldLaw) => {
    if (law) {
      setEditingLawId(law.id);
      setLawForm({
        id: law.id,
        rule: law.rule,
        description: law.description,
        category: law.category,
      });
    } else {
      setEditingLawId(null);
      setLawForm({
        id: `law_${Date.now().toString(36)}`,
        rule: '',
        description: '',
        category: 'magic',
      });
    }
    setLawModalOpen(true);
  };

  const handleSaveLaw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lawForm.rule.trim()) return;

    if (editingLawId) {
      editWorldLaw(editingLawId, {
        rule: lawForm.rule,
        description: lawForm.description,
        category: lawForm.category,
      });
    } else {
      addWorldLaw({
        id: lawForm.id,
        rule: lawForm.rule,
        description: lawForm.description,
        category: lawForm.category,
        isImmutable: true,
      });
    }
    setLawModalOpen(false);
  };

  const handleDeleteLaw = async (law: WorldLaw) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف قانون جهان' : 'Delete World Law',
      message: isPersian
        ? `آیا از حذف قانون "${law.rule}" اطمینان دارید؟`
        : `Are you sure you want to delete the law "${law.rule}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (confirmed) {
      deleteWorldLaw(law.id);
    }
  };

  // Open Faction Modal for Create/Edit
  const openFactionModal = (faction?: Faction) => {
    if (faction) {
      setEditingFactionId(faction.id);
      setFactionForm({
        id: faction.id,
        name: faction.name,
        description: faction.description,
        alignment: faction.alignment,
        publicGoals: faction.publicGoals,
      });
    } else {
      setEditingFactionId(null);
      setFactionForm({
        id: `faction_${Date.now().toString(36)}`,
        name: '',
        description: '',
        alignment: 'Neutral Rebel',
        publicGoals: '',
      });
    }
    setFactionModalOpen(true);
  };

  const handleSaveFaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!factionForm.name.trim()) return;

    if (editingFactionId) {
      editFaction(editingFactionId, {
        name: factionForm.name,
        description: factionForm.description,
        alignment: factionForm.alignment,
        publicGoals: factionForm.publicGoals,
      });
    } else {
      addFaction({
        id: factionForm.id,
        name: factionForm.name,
        description: factionForm.description,
        alignment: factionForm.alignment,
        publicGoals: factionForm.publicGoals,
        territoryIds: [],
        rivalFactionIds: [],
        alliedFactionIds: [],
      });
    }
    setFactionModalOpen(false);
  };

  const handleDeleteFaction = async (fac: Faction) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف جناح' : 'Delete Faction',
      message: isPersian
        ? `آیا از حذف جناح "${fac.name}" اطمینان دارید؟`
        : `Are you sure you want to delete the faction "${fac.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (confirmed) {
      deleteFaction(fac.id);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner & Metadata Editor */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl relative group">
        {!isEditingMeta ? (
          <div>
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <BookOpen className="w-5 h-5 text-amber-400" />
                  <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{story.worldBible.worldName}</h2>
                </div>
                <p className="text-sm text-zinc-400 max-w-3xl leading-relaxed">{story.worldBible.summary}</p>
              </div>
              <div className="flex items-center gap-2 self-start">
                <button
                  onClick={() => {
                    setMetaForm({
                      worldName: story.worldBible.worldName,
                      summary: story.worldBible.summary,
                      themeNotes: story.worldBible.themeNotes,
                    });
                    setIsEditingMeta(true);
                  }}
                  className="flex items-center gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 px-3.5 py-1.5 rounded-xl border border-amber-500/20 transition-all font-semibold cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {t.editMeta}
                </button>
                <span className="text-xs bg-zinc-800/90 border border-zinc-700/60 text-zinc-300 px-3.5 py-1.5 rounded-xl font-mono">
                  {t.worldIdLabel} {story.worldBible.worldId}
                </span>
              </div>
            </div>

            <div className="mt-5 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/90 flex items-start gap-2.5">
              <span className="font-bold text-amber-400 shrink-0">{t.artisticTone}</span>
              <span>{story.worldBible.themeNotes}</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveMeta} className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Edit2 className="w-4 h-4" /> {t.editMeta}
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingMeta(false)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="text-xs px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" /> {t.save}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">World Name</label>
                <input
                  type="text"
                  value={metaForm.worldName}
                  onChange={(e) => setMetaForm((prev) => ({ ...prev, worldName: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">World Summary</label>
                <textarea
                  rows={2}
                  value={metaForm.summary}
                  onChange={(e) => setMetaForm((prev) => ({ ...prev, summary: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1 font-medium">Theme Notes & Tone Directives</label>
                <textarea
                  rows={2}
                  value={metaForm.themeNotes}
                  onChange={(e) => setMetaForm((prev) => ({ ...prev, themeNotes: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-amber-200/90 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Laws & Factions 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Immutable Laws Column */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-rose-400" /> {t.immutableLaws}
                <span className="text-xs font-mono bg-rose-500/10 text-rose-300 px-2 py-0.5 rounded-lg border border-rose-500/20">
                  {story.worldBible.laws.length}
                </span>
              </h3>
              <button
                onClick={() => openLawModal()}
                className="text-xs flex items-center gap-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 px-3 py-1.5 rounded-xl border border-rose-500/30 transition-all font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addLaw}
              </button>
            </div>

            <div className="space-y-3.5">
              {story.worldBible.laws.map((law) => (
                <div
                  key={law.id}
                  className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700/80 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20">
                      {law.category}
                    </span>
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openLawModal(law)}
                        className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit Law"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLaw(law)}
                        className="p-1 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Delete Law"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-200">{law.rule}</h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{law.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Factions Column */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> {t.factions}
                <span className="text-xs font-mono bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-lg border border-blue-500/20">
                  {story.worldBible.factions.length}
                </span>
              </h3>
              <button
                onClick={() => openFactionModal()}
                className="text-xs flex items-center gap-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 px-3 py-1.5 rounded-xl border border-blue-500/30 transition-all font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addFaction}
              </button>
            </div>

            <div className="space-y-3.5">
              {story.worldBible.factions.map((fac) => (
                <div
                  key={fac.id}
                  className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 hover:border-zinc-700/80 transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-zinc-200">{fac.name}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-400 font-medium px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                        {fac.alignment}
                      </span>
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openFactionModal(fac)}
                          className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Edit Faction"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteFaction(fac)}
                          className="p-1 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Delete Faction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{fac.description}</p>
                  <div className="mt-3 pt-2.5 border-t border-zinc-800/50 text-xs text-zinc-500">
                    <strong className="text-zinc-400">{t.goals}</strong> {fac.publicGoals}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Law Modal */}
      {lawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-400" />
                {editingLawId
                  ? isPersian
                    ? 'ویرایش قانون جهان'
                    : 'Edit World Law'
                  : isPersian
                  ? 'ثبت قانون جدید'
                    : 'Add New World Law'}
              </h3>
              <button
                onClick={() => setLawModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLaw} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.category}</label>
                <select
                  value={lawForm.category}
                  onChange={(e) =>
                    setLawForm((prev) => ({
                      ...prev,
                      category: e.target.value as WorldLaw['category'],
                    }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                >
                  <option value="magic">Magic / Bloodcraft</option>
                  <option value="physics">Physics / Natural Laws</option>
                  <option value="society">Society / Hierarchy</option>
                  <option value="creatures">Creatures / Monsters</option>
                  <option value="technology">Technology / Relics</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.ruleTitle}</label>
                <input
                  type="text"
                  value={lawForm.rule}
                  onChange={(e) => setLawForm((prev) => ({ ...prev, rule: e.target.value }))}
                  placeholder="e.g. Dragons have been extinct for 300 years"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.description}</label>
                <textarea
                  rows={3}
                  value={lawForm.description}
                  onChange={(e) => setLawForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Explain why this law exists and what violations the Action Validator will intercept..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLawModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Faction Modal */}
      {factionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                {editingFactionId
                  ? isPersian
                    ? 'ویرایش مشخصات جناح'
                    : 'Edit Faction'
                  : isPersian
                  ? 'ثبت جناح جدید'
                  : 'Add New Faction'}
              </h3>
              <button
                onClick={() => setFactionModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFaction} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.factionName}</label>
                <input
                  type="text"
                  value={factionForm.name}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. The Silver Guard"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.alignment}</label>
                <input
                  type="text"
                  value={factionForm.alignment}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, alignment: e.target.value }))}
                  placeholder="e.g. Lawful Authoritarian / Shadow Underground"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.description}</label>
                <textarea
                  rows={2}
                  value={factionForm.description}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Ideology, background history, and presence in the city..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.goals}</label>
                <textarea
                  rows={2}
                  value={factionForm.publicGoals}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, publicGoals: e.target.value }))}
                  placeholder="What is this faction publicly fighting to achieve?"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFactionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
