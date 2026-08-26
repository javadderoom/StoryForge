'use client';

import React, { useState, useMemo } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { WorldLaw, Faction } from '@/lib/types';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import { GenesisWorldData } from '@/lib/engines/world/GenesisSchemas';
import { notify } from '@/lib/notify';
import EntityWorkshopDrawer, {
  type WorkshopEntity,
} from '@/components/studio/EntityWorkshopDrawer';
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
  Terminal,
  Zap,
  RotateCcw,
  Wand2,
} from 'lucide-react';

export default function WorldBiblePage() {
  const {
    story,
    isPersian,
    updateWorldMeta,
    updateWorldBible,
    addWorldLaw,
    editWorldLaw,
    deleteWorldLaw,
    addFaction,
    editFaction,
    deleteFaction,
    addLocation,
    addDeity,
  } = useStudioStory();

  const worldContext = useMemo(() => buildWorldContextString(story), [story]);

  // Plan 02 — Inline Entity Workshop Drawer
  const [workshopEntity, setWorkshopEntity] = useState<WorkshopEntity | null>(null);

  const openWorkshop = (type: 'world_law' | 'faction', item: any) =>
    setWorkshopEntity({
      type,
      id: item.id,
      name: type === 'world_law' ? item.rule : item.name,
      data: item,
    });

  const handleWorkshopApply = (entity: WorkshopEntity, data: any) => {
    if (entity.type === 'world_law') editWorldLaw(entity.id, data);
    else if (entity.type === 'faction') editFaction(entity.id, data);
    setWorkshopEntity(null);
    notify.success(isPersian ? 'موجودیت به‌روزرسانی شد' : 'Entity updated');
  };

  // World Meta edit state
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({
    worldName: story.worldBible.worldName,
    summary: story.worldBible.summary,
    themeNotes: story.worldBible.themeNotes,
    aiSystemPrompt: story.worldBible.aiSystemPrompt || '',
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
    secretAgendas: string;
    scope: string;
  }>({
    id: '',
    name: '',
    description: '',
    alignment: 'Neutral',
    publicGoals: '',
    secretAgendas: '',
    scope: '',
  });

  // AI World Synthesis Modal (Gemini 3.7 Flash)
  const [aiWorldModalOpen, setAiWorldModalOpen] = useState(false);
  const [aiWorldPrompt, setAiWorldPrompt] = useState('');
  const [aiCustomSystemPrompt, setAiCustomSystemPrompt] = useState(
    story.worldBible.aiSystemPrompt ||
      (isPersian
        ? 'تو دانای کل و راوی ارشد بازی نقش‌آفرینی تعاملی هستی. دنیا را با تعلیق، غنای ادبی، رازهای تاریک و پیامدهای منطقی توصیف کن.'
        : 'You are the Master Storyteller for an interactive grimdark RPG. Write with atmospheric depth and literary gravitas.')
  );
  const [isGeneratingWorld, setIsGeneratingWorld] = useState(false);

  // Plan 01 — Genesis Generator (One-Click Seed-to-Cosmos)
  const [genesisModalOpen, setGenesisModalOpen] = useState(false);
  const [genesisPrompt, setGenesisPrompt] = useState('');
  const [isGeneratingGenesis, setIsGeneratingGenesis] = useState(false);

  // Plan 01 — Contradiction Radar (Lore Consistency Auditor)
  const [radarOpen, setRadarOpen] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditReport, setAuditReport] = useState<{
    score: number;
    summary: string;
    findings: Array<{
      id: string;
      severity: 'error' | 'warning' | 'suggestion';
      category: string;
      title: string;
      description: string;
      involvedEntities: Array<{ entityType: string; name: string }>;
      suggestedFix: string;
    }>;
  } | null>(null);

  const t = {
    heading: isPersian ? 'انجیل جهان و قوانین ثابت' : 'World Bible & Lore Graph',
    subheading: isPersian
      ? 'حقایق ثابت، قوانین فیزیکی/جادویی، جناح‌های تغییرناپذیر و دستورالعمل سیستم هوش مصنوعی'
      : 'Immutable world rules, physics/magic laws, factions, and Master AI System Directives.',
    worldIdLabel: isPersian ? 'شناسه جهان:' : 'World ID:',
    artisticTone: isPersian ? 'لحن هنری و فضاسازی:' : 'Artistic Tone & Atmosphere:',
    masterPromptTitle: isPersian ? 'دستورالعمل هوش مصنوعی و لحن سیستم (System Prompt)' : 'Master AI System Prompt & Engine Directives',
    masterPromptDesc: isPersian
      ? 'این متن به عنوان دستورالعمل سیستم (System Instruction) به مدل هوش مصنوعی ارسال می‌شود تا لحن روایت، واژگان و شخصیت راوی را شکل دهد.'
      : 'This system directive governs the AI narrator\'s literary voice, vocabulary, and tone constraints.',
    immutableLaws: isPersian ? 'قوانین ثابت و محدودیت‌ها' : 'Immutable World Laws',
    factions: isPersian ? 'جناح‌ها و هم‌پیمانی‌ها' : 'Factions & Allegiances',
    goals: isPersian ? 'اهداف عمومی:' : 'Public Goals:',
    addLaw: isPersian ? '+ ثبت قانون جدید' : '+ Add World Law',
    addFaction: isPersian ? '+ ثبت جناح جدید' : '+ Add Faction',
    editMeta: isPersian ? 'ویرایش مشخصات جهان' : 'Edit World Details',
    aiWorldGenBtn: isPersian ? '⚡ خلق جهان با هوش مصنوعی (Gemini 3.7 Flash)' : '⚡ Synthesize World (Gemini 3.7 Flash)',
    genesisBtn: isPersian ? '🌌 تولد جهان (یک‌کلیک)' : '🌌 One-Click Genesis',
    genesisPresets: isPersian
      ? ['آرخیپل تاریک و بی‌خورشید', 'امپراتوری کیمیاگری گریم‌دارک', 'فانتزی اسطوره‌ای جاده ابریشم']
      : ['Sunless Archipelago', 'Grimdark Alchemical Empire', 'Silk Road Mythic Fantasy'],
    radarBadge: isPersian ? 'سازگاری لور' : 'Lore Consistency',
    radarRun: isPersian ? '⚡ اجرای رادار تضاد' : '⚡ Run Contradiction Radar',
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
        secretAgendas: faction.secretAgendas ?? '',
        scope: faction.scope ?? '',
      });
    } else {
      setEditingFactionId(null);
      setFactionForm({
        id: `faction_${Date.now().toString(36)}`,
        name: '',
        description: '',
        alignment: 'Neutral Rebel',
        publicGoals: '',
        secretAgendas: '',
        scope: '',
      });
    }
    setFactionModalOpen(true);
  };

  const handleSaveFaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!factionForm.name.trim()) return;

    const scope = factionForm.scope as Faction['scope'];
    const secretAgendas = factionForm.secretAgendas.trim();

    if (editingFactionId) {
      editFaction(editingFactionId, {
        name: factionForm.name,
        description: factionForm.description,
        alignment: factionForm.alignment,
        publicGoals: factionForm.publicGoals,
        secretAgendas: secretAgendas || undefined,
        scope: scope || undefined,
      });
    } else {
      addFaction({
        id: factionForm.id,
        name: factionForm.name,
        description: factionForm.description,
        alignment: factionForm.alignment,
        publicGoals: factionForm.publicGoals,
        secretAgendas: secretAgendas || undefined,
        scope: scope || undefined,
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

  // Trigger Full AI World Synthesis (Using Gemini 3.7 Flash)
  const handleGenerateWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeneratingWorld(true);

    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'world',
          taskType: 'world', // Prioritizes Gemini 3.7 Flash
          prompt: aiWorldPrompt,
          customSystemPrompt: aiCustomSystemPrompt,
          worldContext: buildWorldContextString(story),
          isPersian,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const generated = json.data;
        updateWorldBible((prev) => ({
          ...prev,
          worldName: generated.worldName || prev.worldName,
          summary: generated.summary || prev.summary,
          themeNotes: generated.themeNotes || prev.themeNotes,
          aiSystemPrompt: generated.aiSystemPrompt || aiCustomSystemPrompt,
          laws: generated.laws && generated.laws.length > 0 ? generated.laws : prev.laws,
          factions: generated.factions && generated.factions.length > 0 ? generated.factions : prev.factions,
        }));

        setAiWorldModalOpen(false);
        notify.success(
          isPersian
            ? `جهان "${generated.worldName}" توسط مدل ${json.modelUsed || 'Gemini 3.7 Flash'} با موفقیت خلق شد`
            : `World synthesized by ${json.modelUsed || 'Gemini 3.7 Flash'}`
        );
      } else {
        notify.error(json.error || (isPersian ? 'خطا در سنتز جهان توسط هوش مصنوعی' : 'Failed to synthesize world'));
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : (isPersian ? 'خطا در اتصال به سرور هوش مصنوعی' : 'AI connection error'));
    } finally {
      setIsGeneratingWorld(false);
    }
  };

  // Plan 01 — One-Click Genesis Generator (Seed-to-Cosmos)
  const handleGenerateGenesis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genesisPrompt.trim()) return;
    setIsGeneratingGenesis(true);

    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'genesis',
          prompt: genesisPrompt,
          themeContext: story.worldBible.themeNotes,
          isPersian,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const g = json.data as GenesisWorldData;
        // Commit meta
        updateWorldMeta({
          worldName: g.worldName,
          summary: g.summary,
          themeNotes: g.themeNotes || story.worldBible.themeNotes,
          aiSystemPrompt: g.aiSystemPrompt || story.worldBible.aiSystemPrompt,
        });
        // Commit laws / factions / locations / religions
        (g.laws || []).forEach((law) => addWorldLaw({ ...law, isImmutable: true }));
        (g.factions || []).forEach((fac) => addFaction(fac));
        (g.locations || []).forEach((loc) => addLocation(loc));
        (g.religions || []).forEach((rel) =>
          addDeity({
            ...rel,
            affiliatedFactionIds: [],
            holyLocationIds: [],
          })
        );

        setGenesisModalOpen(false);
        notify.success(
          isPersian
            ? `جهان "${g.worldName}" با ${g.laws?.length} قانون، ${g.factions?.length} جناح، ${g.locations?.length} مکان و ${g.religions?.length} ایزد خلق شد`
            : `Genesis "${g.worldName}" committed: ${g.laws?.length} laws, ${g.factions?.length} factions, ${g.locations?.length} locations, ${g.religions?.length} deities`
        );
      } else {
        notify.error(json.error || (isPersian ? 'خطا در تولد جهان' : 'Failed to generate genesis world'));
      }
    } catch (err) {
      notify.error(err instanceof Error ? err.message : (isPersian ? 'خطا در اتصال به سرور هوش مصنوعی' : 'AI connection error'));
    } finally {
      setIsGeneratingGenesis(false);
    }
  };

  // Plan 01 — Contradiction Radar (Lore Consistency Auditor)
  const handleRunAudit = async () => {
    setIsAuditing(true);
    setRadarOpen(true);
    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'audit_world',
          worldBible: story.worldBible,
          isPersian,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAuditReport(json.data);
      } else {
        notify.error(isPersian ? 'خطا در تحلیل تضادهای جهان' : 'Failed to run lore audit');
      }
    } catch {
      notify.error(isPersian ? 'خطا در اتصال به سرور' : 'Connection error');
    } finally {
      setIsAuditing(false);
    }
  };

  const radarScore = auditReport?.score ?? null;
  const radarSeverityColor =
    radarScore === null
      ? 'text-zinc-400 border-zinc-700'
      : radarScore >= 85
      ? 'text-emerald-300 border-emerald-500/40'
      : radarScore >= 60
      ? 'text-amber-300 border-amber-500/40'
      : 'text-rose-300 border-rose-500/40';

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
              <div className="flex flex-wrap items-center gap-2.5 self-start">
                <button
                  onClick={() => setGenesisModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 text-zinc-50 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-fuchsia-500/20 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {t.genesisBtn}
                </button>
                <button
                  onClick={() => setAiWorldModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {t.aiWorldGenBtn}
                </button>
                <button
                  onClick={() => {
                    setMetaForm({
                      worldName: story.worldBible.worldName,
                      summary: story.worldBible.summary,
                      themeNotes: story.worldBible.themeNotes,
                      aiSystemPrompt: story.worldBible.aiSystemPrompt || '',
                    });
                    setIsEditingMeta(true);
                  }}
                  className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3.5 py-2 rounded-xl border border-zinc-700 transition-all font-semibold cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  {t.editMeta}
                </button>
                <button
                  onClick={handleRunAudit}
                  className={`flex items-center gap-1.5 text-xs bg-zinc-900/80 border px-3.5 py-2 rounded-xl font-mono transition-all cursor-pointer ${radarSeverityColor}`}
                  title={t.radarRun}
                >
                  <Shield className="w-3.5 h-3.5" />
                  🛡️ {t.radarBadge}: {radarScore === null ? '—' : `${radarScore}/100`}
                </button>
                <span className="text-xs bg-zinc-800/90 border border-zinc-700/60 text-zinc-400 px-3.5 py-2 rounded-xl font-mono">
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
              <div>
                <label className="block text-xs text-purple-300 mb-1 font-medium flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  Master AI System Prompt (دستورالعمل سیستم هوش مصنوعی)
                </label>
                <textarea
                  rows={3}
                  value={metaForm.aiSystemPrompt}
                  onChange={(e) => setMetaForm((prev) => ({ ...prev, aiSystemPrompt: e.target.value }))}
                  placeholder="Custom AI narrator instructions..."
                  className="w-full bg-zinc-950 border border-purple-500/30 rounded-xl px-3.5 py-2 text-xs text-purple-200 focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>
            </div>
          </form>
        )}
      </div>

      {/* Master AI System Prompt Card (Live UI View) */}
      <div className="bg-gradient-to-br from-purple-950/20 via-zinc-900/60 to-zinc-950 border border-purple-500/20 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-purple-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-300">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                {t.masterPromptTitle}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">{t.masterPromptDesc}</p>
            </div>
          </div>
          <span className="text-[11px] font-mono bg-purple-500/10 border border-purple-500/30 text-purple-300 px-3 py-1 rounded-xl">
            Live AI Prompt
          </span>
        </div>

        <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 font-mono text-xs text-purple-200/90 leading-relaxed whitespace-pre-wrap">
          {story.worldBible.aiSystemPrompt?.trim() ||
            (isPersian
              ? 'تو دانای کل و راوی ارشد بازی نقش‌آفرینی StoryForge هستی. تمام صحنه‌ها و واکنش‌ها را با عمق روایی، فضاسازی سنگین و منطبق بر قوانین تغییرناپذیر جهان روایت کن.'
              : 'You are the Master Storyteller for the StoryForge RPG engine. Narrate all story beats with rich atmospheric prose and strict adherence to immutable world laws.')}
        </div>
      </div>

      {/* Section 1: Immutable World Laws */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-rose-400" />
            <h3 className="text-lg font-bold text-zinc-100">{t.immutableLaws}</h3>
          </div>
          <button
            onClick={() => openLawModal()}
            className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3.5 py-1.5 rounded-xl border border-zinc-700 transition-all font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            {t.addLaw}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {story.worldBible.laws.map((law) => (
            <div
              key={law.id}
              className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase bg-rose-500/10 border border-rose-500/20 text-rose-300 px-2 py-0.5 rounded-md">
                      {law.category}
                    </span>
                    <h4 className="text-sm font-bold text-zinc-100">{law.rule}</h4>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openWorkshop('world_law', law)}
                      title={isPersian ? 'کارگاه موجودیت' : 'Entity Workshop'}
                      className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openLawModal(law)}
                      className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLaw(law)}
                      className="p-1 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{law.description}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
                <span className="font-mono">{law.id}</span>
                <span className="text-rose-400/80 flex items-center gap-1 font-semibold">
                  <Shield className="w-3 h-3" /> Immutable Guardrail
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Factions & Allegiances */}
      <div className="space-y-4 pt-4 border-t border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-zinc-100">{t.factions}</h3>
          </div>
          <button
            onClick={() => openFactionModal()}
            className="flex items-center gap-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3.5 py-1.5 rounded-xl border border-zinc-700 transition-all font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            {t.addFaction}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {story.worldBible.factions.map((faction) => (
            <div
              key={faction.id}
              className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md">
                      {faction.alignment}
                    </span>
                    {faction.scope && (
                      <span className="text-[10px] font-mono bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md uppercase">
                        {faction.scope}+
                      </span>
                    )}
                    {faction.secretAgendas && (
                      <span
                        title={isPersian ? 'دستور پنهان ثبت شده' : 'Has a secret agenda'}
                        className="text-[10px] font-mono bg-rose-500/10 border border-rose-500/20 text-rose-300 px-2 py-0.5 rounded-md"
                      >
                        🔒 {isPersian ? 'پنهان' : 'Secret'}
                      </span>
                    )}
                    <h4 className="text-sm font-bold text-zinc-100">{faction.name}</h4>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openWorkshop('faction', faction)}
                      title={isPersian ? 'کارگاه موجودیت' : 'Entity Workshop'}
                      className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openFactionModal(faction)}
                      className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFaction(faction)}
                      className="p-1 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">{faction.description}</p>
                <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 text-xs text-zinc-300">
                  <span className="text-amber-400 font-semibold block mb-1">{t.goals}</span>
                  <p>{faction.publicGoals}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>{faction.id}</span>
                <span>{faction.territoryIds?.length || 0} Territories</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Law Modal */}
      {lawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-rose-400" />
                {editingLawId ? 'Edit World Law' : 'Add Immutable World Law'}
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
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="magic">Magic / Thaumaturgy</option>
                  <option value="physics">Physics / Nature</option>
                  <option value="society">Society / Law</option>
                  <option value="creatures">Creatures / Bestiary</option>
                  <option value="divine">Divine / Cosmic</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.ruleTitle}</label>
                <input
                  type="text"
                  value={lawForm.rule}
                  onChange={(e) => setLawForm((prev) => ({ ...prev, rule: e.target.value }))}
                  placeholder="e.g. Dragons are extinct for 300 years"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.description}</label>
                <textarea
                  rows={3}
                  value={lawForm.description}
                  onChange={(e) => setLawForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Explain why this rule cannot be violated..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setLawModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-500 text-zinc-950 text-xs font-bold hover:bg-rose-400"
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
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                {editingFactionId ? 'Edit Faction' : 'Register New Faction'}
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
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.alignment}</label>
                <input
                  type="text"
                  value={factionForm.alignment}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, alignment: e.target.value }))}
                  placeholder="e.g. Lawful Authoritarian / Rebel Anarchist"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.description}</label>
                <textarea
                  rows={2}
                  value={factionForm.description}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Faction background and philosophy..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.goals}</label>
                <textarea
                  rows={2}
                  value={factionForm.publicGoals}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, publicGoals: e.target.value }))}
                  placeholder="What is this faction trying to achieve?"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'دستور پنهان' : 'Secret Agenda'}
                  <span className="text-zinc-600 ml-1">({isPersian ? 'اختیاری — فقط هوش مصنوعی می‌بیند' : 'optional — only the AI sees this'})</span>
                </label>
                <textarea
                  rows={2}
                  value={factionForm.secretAgendas}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, secretAgendas: e.target.value }))}
                  placeholder={isPersian ? 'مثلاً: تسلط بر جهان و تباه‌سازی آفرینش...' : 'e.g. Dominate and twist all creation...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'گستره روایی' : 'Narrative Scope'}
                  <span className="text-zinc-600 ml-1">({isPersian ? 'در فصل‌های کوچک‌تر پنهان می‌ماند' : 'hidden until chapters escalate to it'})</span>
                </label>
                <select
                  value={factionForm.scope}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, scope: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">{isPersian ? 'همیشه فعال (پیش‌فرض)' : 'Always visible (default)'}</option>
                  <option value="street">{isPersian ? 'خیابانی' : 'Street'}</option>
                  <option value="regional">{isPersian ? 'منطقه‌ای' : 'Regional'}</option>
                  <option value="continental">{isPersian ? 'قاره‌ای' : 'Continental'}</option>
                  <option value="mythic">{isPersian ? 'اسطوره‌ای' : 'Mythic'}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setFactionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400"
                >
                  {t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI World Synthesis Modal (Gemini 3.7 Flash) */}
      {aiWorldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-bold text-zinc-100">
                    {isPersian ? 'خلق کامل جهان با هوش مصنوعی' : 'AI World Synthesis Studio'}
                  </h3>
                  <span className="text-[11px] text-amber-400 font-mono flex items-center gap-1 mt-0.5">
                    <Zap className="w-3 h-3" /> Powered by Gemini 3.7 Flash (Frontier Heavy Model)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiWorldModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateWorld} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  {isPersian ? 'ایده و تم کلی جهان (World Concept Prompt):' : 'World Premise & Guidance Prompt:'}
                </label>
                <textarea
                  rows={3}
                  value={aiWorldPrompt}
                  onChange={(e) => setAiWorldPrompt(e.target.value)}
                  placeholder={
                    isPersian
                      ? 'مثال: دنیای قرون‌وسطایی تاریک با کوه‌های آتشفشانی، قلعه‌های سیاه‌سنگ و فرقه‌ای مخفی از کیمیاگران شورشی که برای بقا در کانال‌های زیرزمینی مبارزه می‌کنند...'
                      : 'e.g. A volcanic dark fantasy kingdom ruled by iron inquisitors where blood magic is outlawed and outcasts dwell in subterranean canals...'
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    {isPersian ? 'دستورالعمل سیستم هوش مصنوعی (System Prompt):' : 'Custom AI System Prompt Override:'}
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setAiCustomSystemPrompt(
                        isPersian
                          ? 'تو دانای کل و راوی ارشد بازی نقش‌آفرینی تعاملی هستی. دنیا را با تعلیق، غنای ادبی، رازهای تاریک و پیامدهای منطقی توصیف کن.'
                          : 'You are the Master Storyteller for an interactive grimdark RPG. Write with atmospheric depth and literary gravitas.'
                      )
                    }
                    className="text-[10.5px] text-zinc-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" /> {isPersian ? 'پیش‌فرض' : 'Reset'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={aiCustomSystemPrompt}
                  onChange={(e) => setAiCustomSystemPrompt(e.target.value)}
                  className="w-full bg-zinc-950 border border-purple-500/30 rounded-xl px-3.5 py-2 text-xs text-purple-200 focus:outline-none focus:border-purple-400 font-mono"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {isPersian
                    ? 'این عملیات با تحلیل ایده و دستورالعمل سیستم شما، نام جهان، خلاصه، قوانین ثابت و جناح‌های اصلی را به‌صورت یکپارچه خلق می‌کند.'
                    : 'Gemini 3.7 Flash will synthesize world lore, summary, immutable laws, factions, and persistent tone directives in one unified call.'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setAiWorldModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingWorld}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingWorld ? 'animate-spin' : ''}`} />
                  <span>
                    {isGeneratingWorld
                      ? isPersian
                        ? 'در حال خلق با Gemini 3.7 Flash...'
                        : 'Synthesizing with Gemini 3.7 Flash...'
                      : isPersian
                      ? 'شروع خلق جهان'
                      : 'Synthesize World'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan 01 — Genesis Generator Modal (One-Click Seed-to-Cosmos) */}
      {genesisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-fuchsia-500/30 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-fuchsia-400" />
                <div>
                  <h3 className="text-base font-bold text-zinc-100">
                    {isPersian ? 'تولد جهان — بذر تا کیهان' : 'Genesis Generator — Seed to Cosmos'}
                  </h3>
                  <span className="text-[11px] text-fuchsia-400 font-mono flex items-center gap-1 mt-0.5">
                    <Zap className="w-3 h-3" /> 4 Laws · 3 Factions · 4 Locations · 2 Deities
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => setGenesisModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateGenesis} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  {isPersian ? 'ایده و تم کلی جهان:' : 'World Premise & Guidance:'}
                </label>
                <textarea
                  rows={3}
                  value={genesisPrompt}
                  onChange={(e) => setGenesisPrompt(e.target.value)}
                  placeholder={
                    isPersian
                      ? 'مثال: دنیای قرون‌وسطایی تاریک با کوه‌های آتشفشانی، قلعه‌های سیاه‌سنگ و فرقه‌ای مخفی از کیمیاگران شورشی...'
                      : 'e.g. A volcanic dark fantasy kingdom ruled by iron inquisitors where blood magic is outlawed...'
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-fuchsia-400"
                  required
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {t.genesisPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGenesisPrompt(preset)}
                    className="text-[11px] bg-zinc-800 hover:bg-fuchsia-500/20 border border-zinc-700 hover:border-fuchsia-500/40 text-zinc-300 px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="p-3.5 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-xs text-fuchsia-200/90 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-fuchsia-400 shrink-0 mt-0.5" />
                <span>
                  {isPersian
                    ? 'با یک کلیک، یک بسته جهانِ یکپارچه شامل قوانین ثابت، جناح‌ها، مکان‌ها و ایزدان خلق و مستقیماً به انجیل جهان متصل می‌شود.'
                    : 'One click synthesizes a fully interconnected world package (laws, factions, locations, deities) and commits it directly to the World Bible.'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setGenesisModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isGeneratingGenesis}
                  className="px-5 py-2 rounded-xl bg-fuchsia-500 hover:bg-fuchsia-400 text-zinc-50 text-xs font-bold shadow-lg shadow-fuchsia-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isGeneratingGenesis ? 'animate-spin' : ''}`} />
                  <span>
                    {isGeneratingGenesis
                      ? isPersian
                        ? 'در حال تولد جهان...'
                        : 'Generating Genesis...'
                      : isPersian
                      ? '🌌 تولد جهان'
                      : '🌌 Generate Genesis'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Plan 01 — Contradiction Radar Drawer */}
      {radarOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn" onClick={() => setRadarOpen(false)}>
          <div
            className="h-full w-full max-w-md bg-zinc-900 border-l border-zinc-800 shadow-2xl overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-bold text-zinc-100">
                  {isPersian ? 'رادار تضاد لور' : 'Contradiction Radar'}
                </h3>
              </div>
              <button type="button" onClick={() => setRadarOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className={`text-3xl font-bold font-mono ${radarSeverityColor.split(' ')[0]}`}>
                {radarScore === null ? '—' : `${radarScore}/100`}
              </div>
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isAuditing}
                className="flex items-center gap-1.5 text-xs bg-rose-500/90 hover:bg-rose-500 text-zinc-50 px-3.5 py-2 rounded-xl font-bold disabled:opacity-50 cursor-pointer"
              >
                <Zap className={`w-3.5 h-3.5 ${isAuditing ? 'animate-spin' : ''}`} />
                {isPersian ? 'تحلیل مجدد' : 'Re-Scan'}
              </button>
            </div>

            {isAuditing && (
              <p className="text-xs text-zinc-400">{isPersian ? 'در حال بررسی تضادهای جهان...' : 'Scanning world for contradictions...'}</p>
            )}

            {!isAuditing && auditReport && (
              <>
                <p className="text-xs text-zinc-400 leading-relaxed">{auditReport.summary}</p>
                <div className="space-y-3">
                  {auditReport.findings.length === 0 && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
                      {isPersian ? 'هیچ تضادی یافت نشد. جهان با ثبات است.' : 'No contradictions found. The world is internally coherent.'}
                    </div>
                  )}
                  {auditReport.findings.map((f) => {
                    const color =
                      f.severity === 'error'
                        ? 'border-rose-500/40 bg-rose-500/5'
                        : f.severity === 'warning'
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-zinc-700 bg-zinc-800/40';
                    const sevLabel = f.severity === 'error' ? (isPersian ? 'خطا' : 'ERROR') : f.severity === 'warning' ? (isPersian ? 'هشدار' : 'WARNING') : isPersian ? 'پیشنهاد' : 'ADVICE';
                    return (
                      <div key={f.id} className={`rounded-2xl border p-4 space-y-2 ${color}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-zinc-100">{f.title}</span>
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-zinc-950/60 text-zinc-300">{sevLabel}</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{f.description}</p>
                        {f.involvedEntities.length > 0 && (
                          <p className="text-[11px] text-zinc-500">
                            {f.involvedEntities.map((e) => e.name).join(' · ')}
                          </p>
                        )}
                        {f.suggestedFix && (
                          <div className="text-[11px] text-fuchsia-200/90 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl p-2.5 leading-relaxed">
                            <span className="font-bold text-fuchsia-300">⚡ {isPersian ? 'پیشنهاد اصلاح: ' : 'Suggested fix: '}</span>
                            {f.suggestedFix}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <EntityWorkshopDrawer
        key={workshopEntity?.id ?? 'none'}
        open={!!workshopEntity}
        entity={workshopEntity}
        worldContext={worldContext}
        isPersian={isPersian}
        onClose={() => setWorkshopEntity(null)}
        onApplyUpdate={handleWorkshopApply}
      />
    </div>
  );
}
