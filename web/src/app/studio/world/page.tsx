'use client';

import React, { useState, useMemo } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { WorldLaw, Faction, FactionRelationValue, getFactionRelation } from '@/lib/types';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import { GenesisWorldData } from '@/lib/engines/world/GenesisSchemas';
import { notify } from '@/lib/notify';
import EntityWorkshopDrawer, {
  type WorkshopEntity,
} from '@/components/studio/EntityWorkshopDrawer';
import AiFillSection from '@/components/studio/AiFillSection';
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
  MapPin,
  Swords,
  Handshake,
  Flame,
  Globe,
  AlertTriangle,
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
    setFactionRelation,
    deleteFactionRelation,
    addLocation,
    addDeity,
  } = useStudioStory();

  const worldContext = useMemo(() => buildWorldContextString(story), [story]);

  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    (story.worldBible.locations || []).forEach((l) => map.set(l.id, l.name));
    return map;
  }, [story.worldBible.locations]);

  const factionNameById = useMemo(() => {
    const map = new Map<string, string>();
    (story.worldBible.factions || []).forEach((f) => map.set(f.id, f.name));
    return map;
  }, [story.worldBible.factions]);

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
    territoryIds: string[];
    rivalFactionIds: string[];
    alliedFactionIds: string[];
    relations: Record<string, { value: FactionRelationValue; note: string; isPublic: boolean }>;
  }>({
    id: '',
    name: '',
    description: '',
    alignment: 'Neutral',
    publicGoals: '',
    secretAgendas: '',
    scope: '',
    territoryIds: [],
    rivalFactionIds: [],
    alliedFactionIds: [],
    relations: {},
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

  const factionsWithGhosts = useMemo(() => {
    const locSet = new Set(story.worldBible.locations.map((l) => l.id));
    const facSet = new Set(story.worldBible.factions.map((f) => f.id));
    return story.worldBible.factions.filter((f) => {
      const hasBadTerritories = (f.territoryIds || []).some((id) => !locSet.has(id));
      const hasBadAllies = (f.alliedFactionIds || []).some((id) => !facSet.has(id) || id === f.id);
      const hasBadRivals = (f.rivalFactionIds || []).some((id) => !facSet.has(id) || id === f.id);
      return hasBadTerritories || hasBadAllies || hasBadRivals;
    });
  }, [story.worldBible.factions, story.worldBible.locations]);

  const handleCleanAllGhosts = () => {
    const locSet = new Set(story.worldBible.locations.map((l) => l.id));
    const facSet = new Set(story.worldBible.factions.map((f) => f.id));
    updateWorldBible((prev) => ({
      ...prev,
      factions: prev.factions.map((f) => ({
        ...f,
        territoryIds: (f.territoryIds || []).filter((id) => locSet.has(id)),
        alliedFactionIds: (f.alliedFactionIds || []).filter((id) => facSet.has(id) && id !== f.id),
        rivalFactionIds: (f.rivalFactionIds || []).filter((id) => facSet.has(id) && id !== f.id),
      })),
    }));
    notify.success(
      isPersian
        ? 'تمام پیوندها و قلمروهای ساختگی و نامعتبر از جناح‌ها پاکسازی شدند'
        : 'All phantom territories, allies, and enemy links purged from factions'
    );
  };

  // Open Faction Modal for Create/Edit
  const openFactionModal = (faction?: Faction) => {
    const locSet = new Set(story.worldBible.locations.map((l) => l.id));
    const facSet = new Set(story.worldBible.factions.map((f) => f.id));

    const initialRelations: Record<string, { value: FactionRelationValue; note: string; isPublic: boolean }> = {};
    const existingRelations = story.worldBible.factionRelations || [];
    const currentFacId = faction ? faction.id : '';

    story.worldBible.factions.forEach((otherFac) => {
      if (faction && otherFac.id === faction.id) return;
      const match = existingRelations.find(
        (r) =>
          (r.sourceFactionId === currentFacId && r.targetFactionId === otherFac.id) ||
          (r.sourceFactionId === otherFac.id && r.targetFactionId === currentFacId)
      );
      if (match) {
        initialRelations[otherFac.id] = {
          value: match.value,
          note: match.note || '',
          isPublic: match.isPublic ?? true,
        };
      } else if (faction) {
        const isAlly = (faction.alliedFactionIds || []).includes(otherFac.id);
        const isRival = (faction.rivalFactionIds || []).includes(otherFac.id);
        initialRelations[otherFac.id] = {
          value: isAlly ? 'allied' : isRival ? 'rival' : 'neutral',
          note: '',
          isPublic: true,
        };
      } else {
        initialRelations[otherFac.id] = {
          value: 'neutral',
          note: '',
          isPublic: true,
        };
      }
    });

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
        territoryIds: Array.isArray(faction.territoryIds)
          ? faction.territoryIds.filter((id) => locSet.has(id))
          : [],
        rivalFactionIds: Array.isArray(faction.rivalFactionIds)
          ? faction.rivalFactionIds.filter((id) => facSet.has(id) && id !== faction.id)
          : [],
        alliedFactionIds: Array.isArray(faction.alliedFactionIds)
          ? faction.alliedFactionIds.filter((id) => facSet.has(id) && id !== faction.id)
          : [],
        relations: initialRelations,
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
        territoryIds: [],
        rivalFactionIds: [],
        alliedFactionIds: [],
        relations: initialRelations,
      });
    }
    setFactionModalOpen(true);
  };

  const handleFactionAiFill = (data: Record<string, unknown>) => {
    const locSet = new Set(story.worldBible.locations.map((l) => l.id));
    const facSet = new Set(story.worldBible.factions.map((f) => f.id));

    setFactionForm((prev) => {
      const updatedRelations = { ...prev.relations };
      if (Array.isArray(data.relations)) {
        for (const item of data.relations as Array<Record<string, unknown>>) {
          const targetId = (item?.targetFactionId || item?.factionId || item?.id) as string;
          if (targetId && facSet.has(targetId) && targetId !== prev.id) {
            const val = ['allied', 'favorable', 'neutral', 'rival', 'hostile'].includes(item.value as string)
              ? (item.value as FactionRelationValue)
              : 'neutral';
            updatedRelations[targetId] = {
              value: val,
              note: typeof item.note === 'string' ? item.note : '',
              isPublic: typeof item.isPublic === 'boolean' ? item.isPublic : true,
            };
          }
        }
      }

      return {
        ...prev,
        name: typeof data.name === 'string' && data.name ? data.name : prev.name,
        description:
          typeof data.description === 'string' && data.description ? data.description : prev.description,
        alignment: typeof data.alignment === 'string' && data.alignment ? data.alignment : prev.alignment,
        publicGoals:
          typeof data.publicGoals === 'string' && data.publicGoals ? data.publicGoals : prev.publicGoals,
        secretAgendas:
          typeof data.secretAgendas === 'string' ? data.secretAgendas : prev.secretAgendas,
        scope: typeof data.scope === 'string' ? data.scope : prev.scope,
        territoryIds: Array.isArray(data.territoryIds)
          ? data.territoryIds.filter((x): x is string => typeof x === 'string' && locSet.has(x))
          : prev.territoryIds,
        rivalFactionIds: Array.isArray(data.rivalFactionIds)
          ? data.rivalFactionIds.filter(
              (x): x is string => typeof x === 'string' && facSet.has(x) && x !== prev.id
            )
          : prev.rivalFactionIds,
        alliedFactionIds: Array.isArray(data.alliedFactionIds)
          ? data.alliedFactionIds.filter(
              (x): x is string => typeof x === 'string' && facSet.has(x) && x !== prev.id
            )
          : prev.alliedFactionIds,
        relations: updatedRelations,
      };
    });
  };

  const toggleTerritory = (locId: string) => {
    setFactionForm((prev) => {
      const exists = prev.territoryIds.includes(locId);
      return {
        ...prev,
        territoryIds: exists
          ? prev.territoryIds.filter((id) => id !== locId)
          : [...prev.territoryIds, locId],
      };
    });
  };

  const handleSaveFaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!factionForm.name.trim()) return;

    const currentFacId = editingFactionId || factionForm.id;
    const scope = (factionForm.scope || undefined) as Faction['scope'];
    const secretAgendas = factionForm.secretAgendas.trim();

    // Derive legacy allies and rivals
    const derivedAllies: string[] = [];
    const derivedRivals: string[] = [];
    Object.entries(factionForm.relations).forEach(([otherId, rel]) => {
      if (rel.value === 'allied') derivedAllies.push(otherId);
      if (rel.value === 'rival' || rel.value === 'hostile') derivedRivals.push(otherId);
    });

    if (editingFactionId) {
      editFaction(editingFactionId, {
        name: factionForm.name.trim(),
        description: factionForm.description.trim(),
        alignment: factionForm.alignment.trim(),
        publicGoals: factionForm.publicGoals.trim(),
        secretAgendas: secretAgendas || undefined,
        scope,
        territoryIds: factionForm.territoryIds,
        rivalFactionIds: derivedRivals,
        alliedFactionIds: derivedAllies,
      });
      notify.success(isPersian ? 'جناح به‌روزرسانی شد' : 'Faction updated');
    } else {
      addFaction({
        id: factionForm.id,
        name: factionForm.name.trim(),
        description: factionForm.description.trim(),
        alignment: factionForm.alignment.trim(),
        publicGoals: factionForm.publicGoals.trim(),
        secretAgendas: secretAgendas || undefined,
        scope,
        territoryIds: factionForm.territoryIds,
        rivalFactionIds: derivedRivals,
        alliedFactionIds: derivedAllies,
      });
      notify.success(isPersian ? 'جناح جدید ثبت شد' : 'New faction registered');
    }

    // Persist all 5-state relations
    Object.entries(factionForm.relations).forEach(([otherId, rel]) => {
      setFactionRelation(currentFacId, otherId, rel.value, rel.note, rel.isPublic);
    });

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
              ? 'تو دانای کل و راوی ارشد بازی نقش‌آفرینی افسانه‌ساز هستی. تمام صحنه‌ها و واکنش‌ها را با عمق روایی، فضاسازی سنگین و منطبق بر قوانین تغییرناپذیر جهان روایت کن.'
              : 'You are the Master Storyteller for the AfsanehSaz RPG engine. Narrate all story beats with rich atmospheric prose and strict adherence to immutable world laws.')}
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

        {factionsWithGhosts.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {isPersian
                  ? `هوش مصنوعی در ${factionsWithGhosts.length} جناح، قلمروها یا متحدان/دشمنانی با شناسه‌های ساختگی ثبت کرده که در جهان وجود ندارند.`
                  : `The AI registered phantom territories, allies, or rival faction IDs in ${factionsWithGhosts.length} faction(s).`}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCleanAllGhosts}
              className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer"
            >
              {isPersian ? 'پاکسازی خودکار تمام پیوندهای نامعتبر' : 'Purge All Phantom Relations'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {story.worldBible.factions.map((faction) => {
            const territories = (faction.territoryIds || [])
              .map((id) => locationNameById.get(id) || id)
              .filter(Boolean);

            const otherFactions = story.worldBible.factions.filter((f) => f.id !== faction.id);
            const relationsList = otherFactions
              .map((other) => {
                const rel = (story.worldBible.factionRelations || []).find(
                  (r) =>
                    (r.sourceFactionId === faction.id && r.targetFactionId === other.id) ||
                    (r.sourceFactionId === other.id && r.targetFactionId === faction.id)
                );
                const stance = rel ? rel.value : getFactionRelation(story.worldBible, faction.id, other.id);
                return {
                  otherName: other.name,
                  stance,
                  note: rel?.note || '',
                  isPublic: rel?.isPublic ?? true,
                  hasExplicitRelation: Boolean(rel),
                };
              })
              .filter((r) => r.hasExplicitRelation || r.stance !== 'neutral');

            return (
              <div
                key={faction.id}
                className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700 transition-all flex flex-col justify-between group cursor-pointer"
                onClick={() => openFactionModal(faction)}
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
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openWorkshop('faction', faction)}
                        title={isPersian ? 'کارگاه موجودیت' : 'Entity Workshop'}
                        className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openFactionModal(faction)}
                        title={isPersian ? 'ویرایش جناح' : 'Edit Faction'}
                        className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFaction(faction)}
                        title={isPersian ? 'حذف جناح' : 'Delete Faction'}
                        className="p-1 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-3">{faction.description}</p>
                  <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-xl p-3 text-xs text-zinc-300 mb-3">
                    <span className="text-amber-400 font-semibold block mb-1">{t.goals}</span>
                    <p>{faction.publicGoals}</p>
                  </div>

                  {faction.secretAgendas && (
                    <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-2.5 text-xs text-rose-300/90 mb-3">
                      <span className="text-rose-400 font-semibold block mb-0.5 text-[11px]">
                        🔒 {isPersian ? 'دستور پنهان (فقط راوی هوش مصنوعی):' : 'Secret Agenda (AI Narrator only):'}
                      </span>
                      <p className="text-zinc-300 text-[11px]">{faction.secretAgendas}</p>
                    </div>
                  )}

                  {/* Territories & Relations Badges */}
                  <div className="space-y-1.5 pt-1">
                    {territories.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-amber-400" />
                          {isPersian ? 'قلمروها:' : 'Territories:'}
                        </span>
                        {territories.map((tName, i) => (
                          <span
                            key={i}
                            className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-md"
                          >
                            {tName}
                          </span>
                        ))}
                      </div>
                    )}

                    {relationsList.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                          <Globe className="w-3 h-3 text-zinc-400" />
                          {isPersian ? 'مناسبات قدرت:' : 'Power Web:'}
                        </span>
                        {relationsList.map((rel, i) => {
                          let badgeCls = 'bg-zinc-800 text-zinc-300 border-zinc-700';
                          let label = rel.otherName;
                          let icon = <Globe className="w-2.5 h-2.5" />;

                          if (rel.stance === 'allied') {
                            badgeCls = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                            label = `${isPersian ? 'متحد' : 'Ally'}: ${rel.otherName}`;
                            icon = <Handshake className="w-2.5 h-2.5 text-emerald-400" />;
                          } else if (rel.stance === 'favorable') {
                            badgeCls = 'bg-sky-500/10 text-sky-300 border-sky-500/20';
                            label = `${isPersian ? 'هم‌پیمان' : 'Favorable'}: ${rel.otherName}`;
                            icon = <Shield className="w-2.5 h-2.5 text-sky-400" />;
                          } else if (rel.stance === 'rival') {
                            badgeCls = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
                            label = `${isPersian ? 'رقیب' : 'Rival'}: ${rel.otherName}`;
                            icon = <Swords className="w-2.5 h-2.5 text-amber-400" />;
                          } else if (rel.stance === 'hostile') {
                            badgeCls = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                            label = `${isPersian ? 'دشمن خونی' : 'Hostile'}: ${rel.otherName}`;
                            icon = <Flame className="w-2.5 h-2.5 text-rose-400" />;
                          } else if (rel.stance === 'neutral') {
                            badgeCls = 'bg-zinc-800 text-zinc-400 border-zinc-700';
                            label = `${isPersian ? 'بی‌طرف' : 'Neutral'}: ${rel.otherName}`;
                            icon = <Globe className="w-2.5 h-2.5 text-zinc-400" />;
                          }

                          return (
                            <span
                              key={i}
                              title={rel.note ? `${label} (${rel.note})` : label}
                              className={`text-[10px] border px-2 py-0.5 rounded-md flex items-center gap-1 ${badgeCls}`}
                            >
                              {icon}
                              {label}
                              {rel.note && <span className="opacity-60 text-[9px]">💬</span>}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <span>{faction.id}</span>
                  <span>{faction.territoryIds?.length || 0} Territories</span>
                </div>
              </div>
            );
          })}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                {editingFactionId
                  ? isPersian
                    ? 'ویرایش جناح و مناسبات قدرت'
                    : 'Edit Faction & Power Web'
                  : isPersian
                  ? 'ثبت جناح جدید'
                  : 'Register New Faction'}
              </h3>
              <button
                onClick={() => setFactionModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Assistant Section */}
            <AiFillSection type="faction" onFilled={handleFactionAiFill} />

            <form onSubmit={handleSaveFaction} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'گستره روایی (مقیاس فعالیت در فصل‌ها)' : 'Narrative Scope (Active Chapter Tier)'}
                </label>
                <select
                  value={factionForm.scope}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, scope: e.target.value }))}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">{isPersian ? 'همیشه فعال (پیش‌فرض)' : 'Always visible (default)'}</option>
                  <option value="street">{isPersian ? 'خیابانی / محلی (Street)' : 'Street (Local gangs, town guards)'}</option>
                  <option value="regional">{isPersian ? 'منطقه‌ای / پادشاهی (Regional)' : 'Regional (Kingdoms, trade syndicates)'}</option>
                  <option value="continental">{isPersian ? 'قاره‌ای / امپراتوری (Continental)' : 'Continental (Empire orders, inquisitions)'}</option>
                  <option value="mythic">{isPersian ? 'اسطوره‌ای / فرابعدی (Mythic)' : 'Mythic (Gods, arch-devils, world-shapers)'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.description}</label>
                <textarea
                  rows={2}
                  value={factionForm.description}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Faction background, cultural origins, and core philosophy..."
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
                  placeholder="What is this faction publicly claiming to fight for?"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'دستور پنهان و انگیزه واقعی' : 'Secret Agenda & True Objective'}
                  <span className="text-zinc-500 ml-1">
                    ({isPersian ? 'فقط راوی هوش مصنوعی می‌بیند' : 'AI narrator only — hidden from player'})
                  </span>
                </label>
                <textarea
                  rows={2}
                  value={factionForm.secretAgendas}
                  onChange={(e) => setFactionForm((prev) => ({ ...prev, secretAgendas: e.target.value }))}
                  placeholder={
                    isPersian
                      ? 'مثلاً: تسخیر چشمه ابدی و قربانی کردن خاندان سلطنتی در نیمه‌شب خونین...'
                      : 'e.g. Infiltrate the royal guard and unleash the sealed primeval titan...'
                  }
                  className="w-full bg-zinc-950 border border-rose-900/50 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Territory Selection */}
              {(() => {
                const validTerritories = factionForm.territoryIds.filter((id) =>
                  story.worldBible.locations.some((loc) => loc.id === id)
                );
                const orphanTerritories = factionForm.territoryIds.filter(
                  (id) => !story.worldBible.locations.some((loc) => loc.id === id)
                );

                return (
                  <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                    <label className="block text-xs font-semibold text-zinc-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        {isPersian ? 'قلمروها و پایگاه‌های تحت کنترل' : 'Controlled Territories & Strongholds'}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {validTerritories.length} {isPersian ? 'انتخاب شده' : 'selected'}
                      </span>
                    </label>

                    {orphanTerritories.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-xs text-amber-300">
                        <span className="text-[11px] leading-tight">
                          {isPersian
                            ? `⚠️ ${orphanTerritories.length} شناسه مکانی نامعتبر توسط هوش مصنوعی ثبت شده است (${orphanTerritories.join(', ')}).`
                            : `⚠️ ${orphanTerritories.length} phantom territory ID(s) found (${orphanTerritories.join(', ')}).`}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFactionForm((prev) => ({
                              ...prev,
                              territoryIds: validTerritories,
                            }))
                          }
                          className="shrink-0 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg font-bold text-[10px] transition-all cursor-pointer"
                        >
                          {isPersian ? 'پاکسازی' : 'Clear Phantom IDs'}
                        </button>
                      </div>
                    )}

                    {story.worldBible.locations.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">
                        {isPersian ? 'هنوز مکانی در جهان ثبت نشده است.' : 'No locations registered in the World Bible yet.'}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 bg-zinc-950/60 rounded-xl border border-zinc-800">
                        {story.worldBible.locations.map((loc) => {
                          const isSelected = factionForm.territoryIds.includes(loc.id);
                          return (
                            <button
                              key={loc.id}
                              type="button"
                              onClick={() => toggleTerritory(loc.id)}
                              className={`text-xs px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-semibold'
                                  : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-zinc-500'
                              }`}
                            >
                              <MapPin className="w-3 h-3" />
                              <span>{loc.name}</span>
                              {isSelected && <Check className="w-3 h-3 text-amber-400" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 5-State Inter-Faction Relation Spectrum */}
              {(() => {
                const otherFactions = story.worldBible.factions.filter((f) => f.id !== factionForm.id);

                return (
                  <div className="space-y-3 pt-3 border-t border-zinc-800/80">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-amber-400" />
                        {isPersian ? 'طیف مناسبات قدرت با سایر جناح‌ها (Relation Spectrum)' : '5-Tier Inter-Faction Relation Spectrum'}
                      </label>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {Object.values(factionForm.relations).filter((r) => r.value !== 'neutral').length}{' '}
                        {isPersian ? 'رابطه فعال' : 'active relations'}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {isPersian
                        ? 'موضع جناح را در طیف ۵ حالته مشخص کنید: متحد رسمی (+2)، هم‌پیمان پنهان (+1)، بی‌طرف (0)، رقیب (-1)، یا دشمن خونی (-2).'
                        : 'Define inter-faction stances: Sworn Ally (+2), Favorable (+1), Neutral (0), Ideological Rival (-1), or Blood Enemy (-2).'}
                    </p>

                    {otherFactions.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">
                        {isPersian ? 'هنوز جناح دیگری برای برقراری مناسبات وجود ندارد.' : 'No other factions exist yet.'}
                      </p>
                    ) : (
                      <div className="space-y-2.5 max-h-80 overflow-y-auto p-1 pr-2">
                        {otherFactions.map((otherFac) => {
                          const rel = factionForm.relations[otherFac.id] || {
                            value: 'neutral',
                            note: '',
                            isPublic: true,
                          };

                          const STANCE_BUTTONS: Array<{
                            value: FactionRelationValue;
                            labelFa: string;
                            labelEn: string;
                            descFa: string;
                            descEn: string;
                            icon: React.ReactNode;
                            activeCls: string;
                            hoverCls: string;
                          }> = [
                            {
                              value: 'allied',
                              labelFa: 'متحد رسمی',
                              labelEn: 'Sworn Ally',
                              descFa: 'پیمان مشترک، تبادل منابع و نبرد در یک جبهه',
                              descEn: 'Shared pact, resource exchange, and fighting on one front',
                              icon: <Handshake className="w-3 h-3" />,
                              activeCls: 'bg-emerald-500 text-zinc-950 font-bold border-emerald-400 shadow-md shadow-emerald-950/50',
                              hoverCls: 'hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                            },
                            {
                              value: 'favorable',
                              labelFa: 'هم‌پیمان',
                              labelEn: 'Favorable',
                              descFa: 'توافقات غیررسمی، اشتراکات فکری یا هم‌پوشانی اهداف، بدون اعلام برادری آشکار',
                              descEn: 'Informal accords, shared ideals or overlapping goals without open brotherhood',
                              icon: <Shield className="w-3 h-3" />,
                              activeCls: 'bg-sky-500 text-zinc-950 font-bold border-sky-400 shadow-md shadow-sky-950/50',
                              hoverCls: 'hover:bg-sky-500/20 text-sky-300 border-sky-500/30',
                            },
                            {
                              value: 'neutral',
                              labelFa: 'بی‌طرف',
                              labelEn: 'Neutral',
                              descFa: 'عدم مداخله؛ رابطه صرفاً تجاری، نظاره‌گر یا سرد بر اساس منافع لحظه‌ای',
                              descEn: 'Non-intervention; transactional, observant, or cold based on momentary interests',
                              icon: <Globe className="w-3 h-3" />,
                              activeCls: 'bg-zinc-200 text-zinc-950 font-bold border-zinc-100',
                              hoverCls: 'hover:bg-zinc-800 text-zinc-400 border-zinc-700',
                            },
                            {
                              value: 'rival',
                              labelFa: 'رقیب',
                              labelEn: 'Rival',
                              descFa: 'رقابت بر سر نفوذ و پیروان، تنش کلامی و سیاسی بدون ورود به جنگ باز',
                              descEn: 'Contest over influence and followers, verbal and political friction without open war',
                              icon: <Swords className="w-3 h-3" />,
                              activeCls: 'bg-amber-500 text-zinc-950 font-bold border-amber-400 shadow-md shadow-amber-950/50',
                              hoverCls: 'hover:bg-amber-500/20 text-amber-300 border-amber-500/30',
                            },
                            {
                              value: 'hostile',
                              labelFa: 'دشمن خونی',
                              labelEn: 'Hostile',
                              descFa: 'ارتداد قطعی، فتوای نابودی، نبرد مسلحانه در میدان',
                              descEn: 'Definitive rupture, writ of destruction, armed battle in the field',
                              icon: <Flame className="w-3 h-3" />,
                              activeCls: 'bg-rose-500 text-zinc-950 font-bold border-rose-400 shadow-md shadow-rose-950/50',
                              hoverCls: 'hover:bg-rose-500/20 text-rose-300 border-rose-500/30',
                            },
                          ];

                          const activeStance = STANCE_BUTTONS.find((b) => b.value === rel.value);

                          return (
                            <div
                              key={otherFac.id}
                              className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-3 space-y-2.5 transition-all hover:border-zinc-700"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-zinc-100">{otherFac.name}</span>
                                  <span className="text-[10px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                                    {otherFac.alignment}
                                  </span>
                                </div>
                                <span className="text-[10px] text-zinc-500 font-mono">{otherFac.id}</span>
                              </div>

                              {/* Stance Selector Pill Bar */}
                              <div className="grid grid-cols-5 gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
                                {STANCE_BUTTONS.map((btn) => {
                                  const isSelected = rel.value === btn.value;
                                  return (
                                    <button
                                      key={btn.value}
                                      type="button"
                                      onClick={() =>
                                        setFactionForm((prev) => ({
                                          ...prev,
                                          relations: {
                                            ...prev.relations,
                                            [otherFac.id]: {
                                              ...rel,
                                              value: btn.value,
                                            },
                                          },
                                        }))
                                      }
                                      className={`text-[10px] py-1.5 px-1 rounded-lg border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer truncate ${
                                        isSelected
                                          ? btn.activeCls
                                          : `bg-transparent border-transparent ${btn.hoverCls}`
                                      }`}
                                      title={`${isPersian ? btn.labelFa : btn.labelEn} — ${isPersian ? btn.descFa : btn.descEn}`}
                                    >
                                      {btn.icon}
                                      <span className="truncate">{isPersian ? btn.labelFa : btn.labelEn}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Stance Definition Text */}
                              {activeStance && (
                                <p className="text-[10px] text-zinc-400 px-1 leading-tight">
                                  <span className="text-zinc-300 font-medium">{isPersian ? activeStance.labelFa : activeStance.labelEn}: </span>
                                  {isPersian ? activeStance.descFa : activeStance.descEn}
                                </p>
                              )}

                              {/* Context Note & Secret Toggle (always available for all stances including neutral) */}
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    type="text"
                                    value={rel.note || ''}
                                    onChange={(e) =>
                                      setFactionForm((prev) => ({
                                        ...prev,
                                        relations: {
                                          ...prev.relations,
                                          [otherFac.id]: {
                                            ...rel,
                                            note: e.target.value,
                                          },
                                        },
                                      }))
                                    }
                                    placeholder={
                                      isPersian
                                        ? 'علت، پیمان‌نامه، بدهی خونی یا پیش‌زمینه این موضع...'
                                        : 'Treaty, grievance, ancient debt, or stance rationale...'
                                    }
                                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-[11px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setFactionForm((prev) => ({
                                        ...prev,
                                        relations: {
                                          ...prev.relations,
                                          [otherFac.id]: {
                                            ...rel,
                                            isPublic: !rel.isPublic,
                                          },
                                        },
                                      }))
                                    }
                                    title={
                                      rel.isPublic
                                        ? isPersian
                                          ? 'نمایش در دانشنامه خواننده'
                                          : 'Visible in Reader Compendium'
                                        : isPersian
                                        ? 'مخفی از خواننده (فقط راوی هوش مصنوعی)'
                                        : 'Hidden from Reader (Narrator Only)'
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10px] font-mono border transition-all cursor-pointer flex items-center gap-1 ${
                                      rel.isPublic
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                        : 'bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/20'
                                    }`}
                                  >
                                    {rel.isPublic ? (
                                      <>👁️ {isPersian ? 'عمومی' : 'Public'}</>
                                    ) : (
                                      <>🔒 {isPersian ? 'محرمانه' : 'Secret'}</>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setFactionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/20"
                >
                  {editingFactionId
                    ? isPersian
                      ? 'ذخیره تغییرات جناح'
                      : 'Update Faction'
                    : isPersian
                    ? 'ثبت جناح'
                    : 'Register Faction'}
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
        themeContext={story.worldBible.themeNotes}
        onClose={() => setWorkshopEntity(null)}
        onApplyUpdate={handleWorkshopApply}
      />
    </div>
  );
}
