'use client';

import React, { useState } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  NPCDossier,
  NPCDramaBond,
  NpcRelationshipBond,
  NpcVoiceGuide,
  NpcStatCalibration,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import AiFillSection from '@/components/studio/AiFillSection';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import {
  User,
  MessageSquare,
  Lock,
  Heart,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Tag,
  Sparkles,
  Zap,
  Users,
  Flame,
  ArrowLeftRight,
  Eye,
  EyeOff,
  Shield,
  Sword,
  Volume2,
  Quote,
  Brain,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  Activity,
  Award,
  Skull,
  Layers,
} from 'lucide-react';

export default function NpcDossiersPage() {
  const {
    story,
    isPersian,
    addNpc,
    editNpc,
    deleteNpc,
    addDramaBond,
    editDramaBond,
    deleteDramaBond,
    setStoryNpcOverride,
    removeStoryNpcOverride,
  } = useStudioStory();

  const [activeTab, setActiveTab] = useState<'dossiers' | 'drama'>('dossiers');

  // NPC Modal
  const [npcModalOpen, setNpcModalOpen] = useState(false);
  const [editingNpcId, setEditingNpcId] = useState<string | null>(null);
  const [npcForm, setNpcForm] = useState<NPCDossier>({
    id: '',
    name: '',
    title: '',
    factionId: '',
    currentLocationId: 'loc_dungeon_cell',
    personalityTraits: [],
    speechStyle: '',
    goals: [],
    secrets: [],
    initialTrust: 0,
  });

  const [traitInput, setTraitInput] = useState('');
  const [goalInput, setGoalInput] = useState('');

  // Story Override Modal
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [targetNpcForOverride, setTargetNpcForOverride] = useState<NPCDossier | null>(null);
  const [overrideForm, setOverrideForm] = useState<{
    storyRole: string;
    relationshipToProtagonist: string;
    storyGoal: string;
    storySecret: string;
    customInitialTrust?: number;
    narrativeImportance: 'central' | 'supporting' | 'incidental';
  }>({
    storyRole: '',
    relationshipToProtagonist: '',
    storyGoal: '',
    storySecret: '',
    customInitialTrust: undefined,
    narrativeImportance: 'supporting',
  });

  const openOverrideModal = (npc: NPCDossier) => {
    setTargetNpcForOverride(npc);
    const existing = story.storyNpcOverrides?.[npc.id];
    setOverrideForm({
      storyRole: existing?.storyRole || '',
      relationshipToProtagonist: existing?.relationshipToProtagonist || '',
      storyGoal: existing?.storyGoal || '',
      storySecret: existing?.storySecret || '',
      customInitialTrust: existing?.customInitialTrust,
      narrativeImportance: existing?.narrativeImportance || 'supporting',
    });
    setOverrideModalOpen(true);
  };

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNpcForOverride) return;
    setStoryNpcOverride(targetNpcForOverride.id, {
      storyRole: overrideForm.storyRole.trim() || undefined,
      relationshipToProtagonist: overrideForm.relationshipToProtagonist.trim() || undefined,
      storyGoal: overrideForm.storyGoal.trim() || undefined,
      storySecret: overrideForm.storySecret.trim() || undefined,
      customInitialTrust:
        typeof overrideForm.customInitialTrust === 'number' && !isNaN(overrideForm.customInitialTrust)
          ? overrideForm.customInitialTrust
          : undefined,
      narrativeImportance: overrideForm.narrativeImportance,
    });
    setOverrideModalOpen(false);
  };

  // Secret Modal attached to an NPC
  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [targetNpcForSecret, setTargetNpcForSecret] = useState<string | null>(null);
  const [editingSecretId, setEditingSecretId] = useState<string | null>(null);
  const [secretForm, setSecretForm] = useState<{
    id: string;
    description: string;
    requiredTrustLevel: number;
    revealed: boolean;
  }>({
    id: '',
    description: '',
    requiredTrustLevel: 20,
    revealed: false,
  });

  // Drama Bond Modal State
  const [dramaModalOpen, setDramaModalOpen] = useState(false);
  const [editingBondId, setEditingBondId] = useState<string | null>(null);
  const [bondSourceId, setBondSourceId] = useState('');
  const [bondTargetId, setBondTargetId] = useState('');
  const [bondRelationType, setBondRelationType] = useState('blood_debt');
  const [bondAffinity, setBondAffinity] = useState<number>(0);
  const [bondSecretTension, setBondSecretTension] = useState('');
  const [bondIsPublic, setBondIsPublic] = useState(true);

  // Plan 04: Expandable Accordions per NPC
  const [expandedVoiceGuideIds, setExpandedVoiceGuideIds] = useState<Set<string>>(new Set());
  const [expandedStatIds, setExpandedStatIds] = useState<Set<string>>(new Set());
  const [expandedBondsIds, setExpandedBondsIds] = useState<Set<string>>(new Set());

  // Plan 04: AI Generators State
  const [generatingRelationshipsNpcId, setGeneratingRelationshipsNpcId] = useState<string | null>(null);
  const [generatingVoiceNpcId, setGeneratingVoiceNpcId] = useState<string | null>(null);
  const [generatingStatsNpcId, setGeneratingStatsNpcId] = useState<string | null>(null);

  // Plan 04: AI Preview Modals
  const [relationshipPreview, setRelationshipPreview] = useState<{
    sourceNpc: NPCDossier;
    bonds: NpcRelationshipBond[];
  } | null>(null);

  const [voiceGuidePreview, setVoiceGuidePreview] = useState<{
    targetNpcId: string;
    guide: NpcVoiceGuide;
  } | null>(null);

  const [statCalibrationPreview, setStatCalibrationPreview] = useState<{
    targetNpcId: string;
    calibration: NpcStatCalibration;
  } | null>(null);

  const npcs = story.worldBible.npcs || [];
  const dramaBonds = story.worldBible.dramaBonds || [];
  const relationTypes = story.worldBible.ontology?.relationTypes || [];

  const t = {
    heading: isPersian ? 'پرونده‌ها و شبکه درام اجتماعی شخصیت‌ها' : 'NPC Dossiers & Social Drama Web',
    subheading: isPersian
      ? 'دستورالعمل‌های لحن و دیالوگ، کالیبراسیون ویژگی‌های رزمی و شبکه پیوندهای تنش بین‌شخصیتی'
      : 'Voice & dialogue guides, RPG combat calibration, and high-stakes interpersonal tension webs.',
    tabDossiers: isPersian ? 'پرونده‌های شخصیتی' : 'NPC Dossiers',
    tabDrama: isPersian ? 'پیوندهای درام و تنش‌ها' : 'Drama & Relationship Bonds',
    trust: isPersian ? 'اعتماد اولیه:' : 'Initial Trust:',
    speechDirectives: isPersian ? 'دستورالعمل لحن گفتار:' : 'Speech & Voice Directives:',
    hiddenSecrets: isPersian ? 'اسرار پنهان و شرایط افشا' : 'Hidden Secrets & Unlock Triggers',
    requiresTrust: isPersian ? 'نیاز به اعتماد' : 'Requires Trust ≥',
    addNpc: isPersian ? '+ ثبت شخصیت جدید' : '+ Add NPC Dossier',
    addSecret: isPersian ? '+ راز جدید' : '+ Add Secret',
    addBond: isPersian ? '+ ثبت پیوند درام جدید' : '+ Add Drama Bond',
    save: isPersian ? 'ذخیره' : 'Save',
    cancel: isPersian ? 'انصراف' : 'Cancel',
    npcName: isPersian ? 'نام شخصیت' : 'Character Name',
    npcTitle: isPersian ? 'عنوان / پیشه' : 'Title / Role',
    traits: isPersian ? 'ویژگی‌های شخصیتی' : 'Personality Traits',
    goals: isPersian ? 'اهداف و انگیزه‌ها' : 'Goals & Agendas',
    voiceGuide: isPersian ? 'راهنمای گفتار و دیالوگ' : 'Voice & Dialogue Guide',
    rpgStats: isPersian ? 'کالیبراسیون رزمی و ویژگی‌ها' : 'RPG Combat & Stats',
    socialBonds: isPersian ? 'پیوندهای درام اجتماعی' : 'Social Drama Bonds',
  };

  const toggleAccordion = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Open NPC Modal
  const openNpcModal = (npc?: NPCDossier) => {
    if (npc) {
      setEditingNpcId(npc.id);
      setNpcForm({ ...npc });
    } else {
      setEditingNpcId(null);
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
    setNpcModalOpen(true);
  };

  const handleSaveNpc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!npcForm.name.trim()) return;

    if (editingNpcId) {
      editNpc(editingNpcId, { ...npcForm });
    } else {
      addNpc({ ...npcForm });
    }
    setNpcModalOpen(false);
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

  const handleDeleteNpc = async (npc: NPCDossier) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف پرونده شخصیت' : 'Delete NPC Dossier',
      message: isPersian
        ? `آیا از حذف پرونده شخصیت "${npc.name}" اطمینان دارید؟`
        : `Are you sure you want to delete the NPC "${npc.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      deleteNpc(npc.id);
    }
  };

  // Secret Modal Handlers
  const openSecretModal = (npcId: string, secret?: NPCDossier['secrets'][0]) => {
    setTargetNpcForSecret(npcId);
    if (secret) {
      setEditingSecretId(secret.id);
      setSecretForm({ ...secret });
    } else {
      setEditingSecretId(null);
      setSecretForm({
        id: `secret_${Date.now().toString(36)}`,
        description: '',
        requiredTrustLevel: 20,
        revealed: false,
      });
    }
    setSecretModalOpen(true);
  };

  const handleSaveSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetNpcForSecret || !secretForm.description.trim()) return;

    const npc = story.worldBible.npcs.find((n) => n.id === targetNpcForSecret);
    if (!npc) return;

    let updatedSecrets = npc.secrets;
    if (editingSecretId) {
      updatedSecrets = npc.secrets.map((s) => (s.id === editingSecretId ? secretForm : s));
    } else {
      updatedSecrets = [...npc.secrets, secretForm];
    }

    editNpc(targetNpcForSecret, { secrets: updatedSecrets });
    setSecretModalOpen(false);
    notify.success(isPersian ? 'راز شخصیت ذخیره شد' : 'NPC secret matrix updated');
  };

  const handleDeleteSecret = async (npcId: string, secretId: string) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف راز' : 'Delete Secret',
      message: isPersian
        ? 'آیا از حذف این راز پنهان اطمینان دارید؟'
        : 'Are you sure you want to delete this secret flag?',
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      const npc = story.worldBible.npcs.find((n) => n.id === npcId);
      if (npc) {
        editNpc(npcId, { secrets: npc.secrets.filter((s) => s.id !== secretId) });
      }
    }
  };

  // Drama Bond Handlers
  const openDramaModal = (bond?: NPCDramaBond) => {
    if (bond) {
      setEditingBondId(bond.id);
      setBondSourceId(bond.sourceNpcId);
      setBondTargetId(bond.targetNpcId);
      setBondRelationType(bond.relationTypeId);
      setBondAffinity(bond.affinity);
      setBondSecretTension(bond.secretTension || '');
      setBondIsPublic(bond.isPublic);
    } else {
      setEditingBondId(null);
      setBondSourceId(npcs[0]?.id || '');
      setBondTargetId(npcs[1]?.id || '');
      setBondRelationType('blood_debt');
      setBondAffinity(-20);
      setBondSecretTension('');
      setBondIsPublic(false);
    }
    setDramaModalOpen(true);
  };

  const handleSaveDramaBond = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bondSourceId || !bondTargetId || bondSourceId === bondTargetId) {
      notify.error(isPersian ? 'دو شخصیت متفاوت باید انتخاب شوند' : 'Please select two different NPCs');
      return;
    }

    const payload: NPCDramaBond = {
      id: editingBondId || `bond_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      sourceNpcId: bondSourceId,
      targetNpcId: bondTargetId,
      relationTypeId: bondRelationType,
      affinity: Number(bondAffinity),
      secretTension: bondSecretTension.trim(),
      isPublic: bondIsPublic,
    };

    if (editingBondId) {
      editDramaBond(editingBondId, payload);
    } else {
      addDramaBond(payload);
    }

    setDramaModalOpen(false);
  };

  const handleDeleteDramaBond = async (bond: NPCDramaBond) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف پیوند درام' : 'Delete Drama Bond',
      message: isPersian
        ? 'آیا از حذف این پیوند شخصیتی مطمئن هستید؟'
        : 'Are you sure you want to delete this interpersonal tension bond?',
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      deleteDramaBond(bond.id);
    }
  };

  // ----------------------------------------------------
  // Plan 04: AI Generation Functions
  // ----------------------------------------------------

  // 1. Generate Interpersonal Relationships Web
  const handleGenerateRelationships = async (npc: NPCDossier) => {
    try {
      setGeneratingRelationshipsNpcId(npc.id);
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'npc_relationships',
          prompt: `Generate 2 to 4 dramatic interpersonal tension bonds for "${npc.name}" (${npc.title || 'NPC'}). Target other real NPCs in the world when possible.`,
          themeContext: story.worldBible.themeNotes,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate relationships (${res.status})`);
      }

      const json = await res.json();
      if (json.data && Array.isArray(json.data.bonds)) {
        setRelationshipPreview({
          sourceNpc: npc,
          bonds: json.data.bonds,
        });
      } else {
        notify.error(isPersian ? 'قالب پیوندها معتبر نبود' : 'Invalid relationship format received');
      }
    } catch (err: any) {
      notify.error(err.message || 'Error generating relationship bonds');
    } finally {
      setGeneratingRelationshipsNpcId(null);
    }
  };

  const handleCommitRelationships = () => {
    if (!relationshipPreview) return;
    const { sourceNpc, bonds } = relationshipPreview;
    let count = 0;
    for (const b of bonds) {
      const bondPayload: NPCDramaBond = {
        id: b.id || `bond_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        sourceNpcId: sourceNpc.id,
        targetNpcId: b.targetNpcId || (npcs.find((n) => n.name.toLowerCase() === b.targetNpcName.toLowerCase())?.id || `npc_${Date.now().toString(36)}`),
        relationTypeId: b.relationTypeId || 'ally',
        affinity: b.affinity ?? 0,
        secretTension: b.secretTension || '',
        isPublic: b.isPublic ?? true,
      };
      addDramaBond(bondPayload);
      count++;
    }
    setRelationshipPreview(null);
    notify.success(
      isPersian
        ? `${count} پیوند درام جدید به جهان افزوده شد`
        : `Added ${count} interpersonal drama bonds to world`
    );
  };

  // 2. Generate Voice & Dialogue Style Guide
  const handleGenerateVoiceGuide = async (npc: NPCDossier) => {
    try {
      setGeneratingVoiceNpcId(npc.id);
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'npc_voice_guide',
          prompt: `Generate a rich, distinct Voice & Dialogue Guide with 4 situational quotes for "${npc.name}" (${npc.title || 'NPC'}). Speech tone: ${npc.speechStyle || 'distinct'}. Personality: ${npc.personalityTraits?.join(', ')}.`,
          themeContext: story.worldBible.themeNotes,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to generate voice guide (${res.status})`);
      }

      const json = await res.json();
      if (json.data) {
        setVoiceGuidePreview({
          targetNpcId: npc.id,
          guide: json.data,
        });
      }
    } catch (err: any) {
      notify.error(err.message || 'Error generating voice guide');
    } finally {
      setGeneratingVoiceNpcId(null);
    }
  };

  const handleCommitVoiceGuide = () => {
    if (!voiceGuidePreview) return;
    editNpc(voiceGuidePreview.targetNpcId, {
      voiceGuide: voiceGuidePreview.guide,
    });
    setExpandedVoiceGuideIds((prev) => new Set(prev).add(voiceGuidePreview.targetNpcId));
    setVoiceGuidePreview(null);
    notify.success(isPersian ? 'راهنمای گفتار برای این شخصیت ثبت شد' : 'Voice & Dialogue guide updated');
  };

  // 3. Generate RPG Stat Calibration
  const handleGenerateStatCalibration = async (npc: NPCDossier) => {
    try {
      setGeneratingStatsNpcId(npc.id);
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'npc_stat_calibration',
          prompt: `Calibrate RPG combat rating, attributes, signature abilities, and martial/spell gear for "${npc.name}" (${npc.title || 'NPC'}). Role: ${npc.role || npc.title}.`,
          themeContext: story.worldBible.themeNotes,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to calibrate stats (${res.status})`);
      }

      const json = await res.json();
      if (json.data) {
        setStatCalibrationPreview({
          targetNpcId: npc.id,
          calibration: json.data,
        });
      }
    } catch (err: any) {
      notify.error(err.message || 'Error calibrating RPG stats');
    } finally {
      setGeneratingStatsNpcId(null);
    }
  };

  const handleCommitStatCalibration = () => {
    if (!statCalibrationPreview) return;
    editNpc(statCalibrationPreview.targetNpcId, {
      statCalibration: statCalibrationPreview.calibration,
    });
    setExpandedStatIds((prev) => new Set(prev).add(statCalibrationPreview.targetNpcId));
    setStatCalibrationPreview(null);
    notify.success(isPersian ? 'کالیبراسیون رزمی ثبت شد' : 'RPG stat calibration updated');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify.success(isPersian ? 'در حافظه کپی شد' : 'Copied to clipboard');
  };

  const getAffinityBadge = (affinity: number) => {
    if (affinity >= 50) return { label: isPersian ? 'وفاداری مطلق' : 'Sworn Devotion', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (affinity > 0) return { label: isPersian ? 'دوستانه' : 'Friendly', color: 'text-teal-300 bg-teal-500/10 border-teal-500/30' };
    if (affinity === 0) return { label: isPersian ? 'بی‌طرف' : 'Neutral', color: 'text-zinc-400 bg-zinc-700/20 border-zinc-600/30' };
    if (affinity > -50) return { label: isPersian ? 'تنش و بدگمانی' : 'Tense / Distrust', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' };
    return { label: isPersian ? 'دشمنی خونی' : 'Bitter Blood Nemesis', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
  };

  const getCombatTierBadge = (tier: string) => {
    switch (tier) {
      case 'mythic':
        return 'text-amber-300 bg-gradient-to-r from-amber-500/20 to-red-500/20 border-amber-500/40';
      case 'boss':
        return 'text-rose-400 bg-rose-500/15 border-rose-500/30';
      case 'elite':
        return 'text-purple-300 bg-purple-500/15 border-purple-500/30';
      case 'veteran':
        return 'text-sky-300 bg-sky-500/15 border-sky-500/30';
      case 'apprentice':
        return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Info */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <User className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{t.heading}</h2>
          </div>
          <p className="text-sm text-zinc-400">{t.subheading}</p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'dossiers' ? (
            <button
              onClick={() => openNpcModal()}
              className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t.addNpc}
            </button>
          ) : (
            <button
              onClick={() => openDramaModal()}
              className="flex items-center gap-1.5 text-xs bg-rose-500 hover:bg-rose-400 text-zinc-950 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-rose-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t.addBond}
            </button>
          )}
          <span className="text-xs bg-zinc-800 border border-zinc-700/80 text-zinc-300 px-3.5 py-2 rounded-xl font-mono">
            {activeTab === 'dossiers'
              ? `${npcs.length} ${isPersian ? 'شخصیت' : 'NPCs'}`
              : `${dramaBonds.length} ${isPersian ? 'پیوند تنش' : 'Drama Bonds'}`}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('dossiers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'dossiers'
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{t.tabDossiers}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono">
            {npcs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('drama')}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
            activeTab === 'drama'
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-md'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>{t.tabDrama}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono">
            {dramaBonds.length}
          </span>
        </button>
      </div>

      {/* Tab 1: NPC Dossiers Grid */}
      {activeTab === 'dossiers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {npcs.map((npc) => {
            const isVoiceExpanded = expandedVoiceGuideIds.has(npc.id);
            const isStatExpanded = expandedStatIds.has(npc.id);
            const isBondsExpanded = expandedBondsIds.has(npc.id);
            const npcBonds = dramaBonds.filter(
              (b) => b.sourceNpcId === npc.id || b.targetNpcId === npc.id
            );

            return (
              <div
                key={npc.id}
                className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-zinc-700 transition-all group space-y-4"
              >
                <div>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300 text-lg">
                        {npc.name[0] || 'N'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-zinc-100">{npc.name}</h3>
                          {npc.role && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px]">
                              {npc.role}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-amber-400/90 font-medium">{npc.title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-zinc-800/90 text-zinc-300 px-3 py-1 rounded-xl border border-zinc-700/60 flex items-center gap-1.5 font-mono" dir="ltr">
                        <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
                        {t.trust} {npc.initialTrust}
                      </span>
                      <div className="flex items-center opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openNpcModal(npc)}
                          className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                          title="Edit NPC"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteNpc(npc)}
                          className="p-1 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                          title="Delete NPC"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Story Lens / Override Banner */}
                  {(() => {
                    const override = story.storyNpcOverrides?.[npc.id];
                    if (override && (override.storyRole || override.relationshipToProtagonist || override.storyGoal || override.storySecret)) {
                      return (
                        <div className="rounded-2xl bg-indigo-950/40 border border-indigo-500/30 p-3 mb-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                              <span className="text-xs font-bold text-indigo-300">
                                {isPersian ? 'نقش اختصاصی در این داستان' : 'Story Lens (Active Override)'}
                              </span>
                              {override.narrativeImportance === 'central' && (
                                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30 font-medium">
                                  {isPersian ? 'شخصیت محوری (پین‌شده)' : 'Central Pinned'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openOverrideModal(npc)}
                                className="text-[11px] text-indigo-300 hover:text-indigo-200 underline cursor-pointer"
                              >
                                {isPersian ? 'ویرایش' : 'Edit'}
                              </button>
                              <span className="text-zinc-600 text-xs">•</span>
                              <button
                                type="button"
                                onClick={() => removeStoryNpcOverride(npc.id)}
                                className="text-[11px] text-zinc-400 hover:text-rose-400 underline cursor-pointer"
                              >
                                {isPersian ? 'حذف' : 'Reset'}
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {override.storyRole && (
                              <div>
                                <span className="text-zinc-500 block text-[10px]">{isPersian ? 'نقش در داستان:' : 'Story Role:'}</span>
                                <span className="text-zinc-200 font-medium">{override.storyRole}</span>
                              </div>
                            )}
                            {override.relationshipToProtagonist && (
                              <div>
                                <span className="text-zinc-500 block text-[10px]">{isPersian ? 'ارتباط با قهرمان:' : 'Relation to Protagonist:'}</span>
                                <span className="text-zinc-200">{override.relationshipToProtagonist}</span>
                              </div>
                            )}
                            {override.storyGoal && (
                              <div className="sm:col-span-2">
                                <span className="text-zinc-500 block text-[10px]">{isPersian ? 'هدف در این داستان:' : 'Story Plot Goal:'}</span>
                                <span className="text-zinc-200">{override.storyGoal}</span>
                              </div>
                            )}
                            {override.storySecret && (
                              <div className="sm:col-span-2">
                                <span className="text-zinc-500 block text-[10px]">{isPersian ? 'راز این داستان:' : 'Story Secret:'}</span>
                                <span className="text-indigo-200 italic">{override.storySecret}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-950/40 border border-dashed border-zinc-800 text-xs mb-3">
                        <span className="text-zinc-500 text-[11px]">
                          {isPersian ? 'نقش پیش‌فرض جهان فعال است' : 'Using World Bible default role'}
                        </span>
                        <button
                          type="button"
                          onClick={() => openOverrideModal(npc)}
                          className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          {isPersian ? 'تنظیم نقش اختصاصی' : 'Customize for this Story'}
                        </button>
                      </div>
                    );
                  })()}

                  {/* Personality Traits Chips */}
                  {npc.personalityTraits && npc.personalityTraits.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {npc.personalityTraits.map((trait, i) => (
                        <span
                          key={i}
                          className="text-[11px] bg-zinc-800/80 text-zinc-300 px-2.5 py-0.5 rounded-lg border border-zinc-700/60 flex items-center gap-1"
                        >
                          <Tag className="w-2.5 h-2.5 text-amber-400" />
                          {trait}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Speech Directives */}
                  <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-3 mb-4 text-xs text-zinc-300 flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-zinc-400 block mb-0.5">{t.speechDirectives}</span>
                      <p className="italic text-zinc-300">&ldquo;{npc.speechStyle}&rdquo;</p>
                    </div>
                  </div>

                  {/* Goals */}
                  {npc.goals && npc.goals.length > 0 && (
                    <div className="mb-4 text-xs">
                      <span className="font-bold text-zinc-400 block mb-1.5">{t.goals}:</span>
                      <ul className="space-y-1 text-zinc-300">
                        {npc.goals.map((g, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Secrets Matrix */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/60 mb-4">
                    <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-rose-400" />
                        {t.hiddenSecrets}
                      </span>
                      <button
                        onClick={() => openSecretModal(npc.id)}
                        className="text-[11px] text-amber-400 hover:text-amber-300 cursor-pointer font-bold"
                      >
                        {t.addSecret}
                      </button>
                    </div>

                    {npc.secrets.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 italic">
                        {isPersian ? 'رازی برای این شخصیت ثبت نشده است.' : 'No secrets registered.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {npc.secrets.map((sec) => (
                          <div
                            key={sec.id}
                            className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3 text-xs flex items-start justify-between gap-2 group/secret"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-rose-500/10 border border-rose-500/20 text-rose-300" dir="ltr">
                                  {t.requiresTrust} {sec.requiredTrustLevel}
                                </span>
                              </div>
                              <p className="text-zinc-300 leading-relaxed">{sec.description}</p>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover/secret:opacity-100 transition-opacity">
                              <button
                                onClick={() => openSecretModal(npc.id, sec)}
                                className="p-1 text-zinc-400 hover:text-amber-400 rounded cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteSecret(npc.id, sec.id)}
                                className="p-1 text-zinc-400 hover:text-rose-400 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Plan 04 Toolbars & Expandable Drawers */}
                  <div className="space-y-3 pt-3 border-t border-zinc-800/60">
                    {/* Drawer 1: Voice & Dialogue Guide */}
                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
                      <div
                        onClick={() => toggleAccordion(setExpandedVoiceGuideIds, npc.id)}
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Volume2 className="w-4 h-4 text-purple-400" />
                          <span className="text-xs font-bold text-zinc-200">{t.voiceGuide}</span>
                          {npc.voiceGuide ? (
                            <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-lg font-mono">
                              {npc.voiceGuide.sampleDialogue.length} {isPersian ? 'دیالوگ' : 'dialogues'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500 italic">
                              {isPersian ? '(خالی)' : '(Unset)'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateVoiceGuide(npc);
                            }}
                            disabled={generatingVoiceNpcId === npc.id}
                            className="px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>
                              {generatingVoiceNpcId === npc.id
                                ? isPersian
                                  ? 'تولید...'
                                  : 'Generating...'
                                : isPersian
                                ? '✨ تولید با هوش مصنوعی'
                                : '✨ AI Generate'}
                            </span>
                          </button>
                          {isVoiceExpanded ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>
                      </div>

                      {isVoiceExpanded && (
                        <div className="p-3.5 pt-0 space-y-3 text-xs border-t border-zinc-900 animate-fadeIn">
                          {npc.voiceGuide ? (
                            <>
                              {npc.voiceGuide.speechQuirks.length > 0 && (
                                <div>
                                  <span className="text-[10.5px] text-zinc-500 font-bold block mb-1">
                                    {isPersian ? 'تکیه‌کلام‌ها و ویژگی‌های گفتاری:' : 'Speech Quirks:'}
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {npc.voiceGuide.speechQuirks.map((q, qIdx) => (
                                      <span
                                        key={qIdx}
                                        className="px-2 py-0.5 rounded-lg bg-zinc-900 text-zinc-300 border border-zinc-800 text-[10.5px]"
                                      >
                                        {q}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Sample Quotes */}
                              <div className="space-y-1.5">
                                <span className="text-[10.5px] text-purple-400/90 font-bold block">
                                  {isPersian ? 'نمونه دیالوگ‌های موقعیتی:' : 'Situational Sample Dialogue:'}
                                </span>
                                <div className="grid grid-cols-1 gap-1.5">
                                  {npc.voiceGuide.sampleDialogue.map((diag, dIdx) => (
                                    <div
                                      key={dIdx}
                                      className="p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-[11px] flex items-start justify-between gap-2"
                                    >
                                      <div>
                                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-purple-300 font-mono text-[9.5px] uppercase">
                                          {diag.context}
                                        </span>
                                        <p className="mt-1 text-zinc-300 italic">"{diag.quote}"</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(diag.quote)}
                                        className="text-zinc-500 hover:text-zinc-300 p-1"
                                        title="Copy"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {npc.voiceGuide.negotiationVulnerabilities.length > 0 && (
                                <div className="text-[10.5px] bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-2 text-emerald-300/90">
                                  🎯 <strong className="text-emerald-300">{isPersian ? 'نقاط اثرپذیری در مذاکره: ' : 'Vulnerabilities: '}</strong>
                                  {npc.voiceGuide.negotiationVulnerabilities.join(' · ')}
                                </div>
                              )}

                              {npc.voiceGuide.psychologicalBreakingPoint && (
                                <div className="text-[10.5px] bg-rose-950/20 border border-rose-500/20 rounded-xl p-2 text-rose-300/90">
                                  💥 <strong className="text-rose-300">{isPersian ? 'نقطه شکست روانی: ' : 'Breaking Point: '}</strong>
                                  {npc.voiceGuide.psychologicalBreakingPoint}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-center py-3 text-zinc-500 text-xs space-y-1">
                              <p>{isPersian ? 'راهنمای صوتی برای این شخصیت تعریف نشده است.' : 'No voice guide generated.'}</p>
                              <button
                                type="button"
                                onClick={() => handleGenerateVoiceGuide(npc)}
                                className="text-purple-400 font-bold hover:underline"
                              >
                                {isPersian ? 'اکنون با هوش مصنوعی تولید کنید' : 'Generate with AI now'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Drawer 2: RPG Stat Calibration */}
                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
                      <div
                        onClick={() => toggleAccordion(setExpandedStatIds, npc.id)}
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Sword className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-bold text-zinc-200">{t.rpgStats}</span>
                          {npc.statCalibration ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono ${getCombatTierBadge(npc.statCalibration.combatTier)}`}>
                              {npc.statCalibration.combatTier.toUpperCase()} · CR {npc.statCalibration.challengeRating}
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500 italic">
                              {isPersian ? '(کالیبره‌نشده)' : '(Uncalibrated)'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateStatCalibration(npc);
                            }}
                            disabled={generatingStatsNpcId === npc.id}
                            className="px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all"
                          >
                            <Zap className="w-3 h-3" />
                            <span>
                              {generatingStatsNpcId === npc.id
                                ? isPersian
                                  ? 'محاسبه...'
                                  : 'Calibrating...'
                                : isPersian
                                ? '⚡ کالیبراسیون'
                                : '⚡ Calibrate'}
                            </span>
                          </button>
                          {isStatExpanded ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>
                      </div>

                      {isStatExpanded && (
                        <div className="p-3.5 pt-0 space-y-3 text-xs border-t border-zinc-900 animate-fadeIn">
                          {npc.statCalibration ? (
                            <>
                              {/* Stat Ratings Grid */}
                              {Object.keys(npc.statCalibration.statRatings).length > 0 && (
                                <div>
                                  <span className="text-[10.5px] text-zinc-500 font-bold block mb-1">
                                    {isPersian ? 'امتیاز ویژگی‌های نقش‌آفرینی:' : 'Attributes:'}
                                  </span>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5" dir="ltr">
                                    {Object.entries(npc.statCalibration.statRatings).map(([stName, val]) => (
                                      <div
                                        key={stName}
                                        className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-center"
                                      >
                                        <span className="text-[10px] text-zinc-400 block truncate">{stName}</span>
                                        <span className="text-xs font-bold text-amber-300 font-mono">{val}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Signature Abilities */}
                              {npc.statCalibration.signatureAbilities.length > 0 && (
                                <div>
                                  <span className="text-[10.5px] text-zinc-500 font-bold block mb-1">
                                    {isPersian ? 'توانایی‌های ویژه رزمی:' : 'Signature Abilities:'}
                                  </span>
                                  <div className="flex flex-wrap gap-1">
                                    {npc.statCalibration.signatureAbilities.map((ab, abIdx) => (
                                      <span
                                        key={abIdx}
                                        className="px-2 py-0.5 rounded-lg bg-zinc-900 text-amber-200 border border-amber-500/20 text-[10.5px]"
                                      >
                                        ⚡ {ab}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Equipped Gear */}
                              {npc.statCalibration.equippedGear.length > 0 && (
                                <div>
                                  <span className="text-[10.5px] text-zinc-500 font-bold block mb-1">
                                    {isPersian ? 'تجهیزات و سلاح‌های مجهز:' : 'Equipped Gear:'}
                                  </span>
                                  <div className="grid grid-cols-1 gap-1">
                                    {npc.statCalibration.equippedGear.map((gear, gIdx) => (
                                      <div
                                        key={gIdx}
                                        className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10.5px] flex items-center justify-between"
                                      >
                                        <span className="font-bold text-zinc-200">⚔️ {gear.name}</span>
                                        <span className="text-[9.5px] text-zinc-400 uppercase font-mono">{gear.type}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-center py-3 text-zinc-500 text-xs space-y-1">
                              <p>{isPersian ? 'ویژگی‌های رزمی کالیبره نشده است.' : 'Stats not calibrated.'}</p>
                              <button
                                type="button"
                                onClick={() => handleGenerateStatCalibration(npc)}
                                className="text-amber-400 font-bold hover:underline"
                              >
                                {isPersian ? 'اکنون کالیبره کنید' : 'Calibrate with AI now'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Drawer 3: Social Drama Bonds */}
                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
                      <div
                        onClick={() => toggleAccordion(setExpandedBondsIds, npc.id)}
                        className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ArrowLeftRight className="w-4 h-4 text-rose-400" />
                          <span className="text-xs font-bold text-zinc-200">{t.socialBonds}</span>
                          <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-lg font-mono">
                            {npcBonds.length} {isPersian ? 'پیوند' : 'bonds'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGenerateRelationships(npc);
                            }}
                            disabled={generatingRelationshipsNpcId === npc.id}
                            className="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>
                              {generatingRelationshipsNpcId === npc.id
                                ? isPersian
                                  ? 'سنتز...'
                                  : 'Synthesizing...'
                                : isPersian
                                ? '✨ سنتز پیوندها'
                                : '✨ Synthesize Bonds'}
                            </span>
                          </button>
                          {isBondsExpanded ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>
                      </div>

                      {isBondsExpanded && (
                        <div className="p-3.5 pt-0 space-y-2 text-xs border-t border-zinc-900 animate-fadeIn">
                          {npcBonds.length === 0 ? (
                            <div className="text-center py-3 text-zinc-500 text-xs space-y-1">
                              <p>{isPersian ? 'پیوندی برای این شخصیت ثبت نشده است.' : 'No drama bonds linked to this NPC.'}</p>
                              <button
                                type="button"
                                onClick={() => handleGenerateRelationships(npc)}
                                className="text-rose-400 font-bold hover:underline"
                              >
                                {isPersian ? 'سنتز پیوندهای درام با هوش مصنوعی' : 'Synthesize bonds with AI'}
                              </button>
                            </div>
                          ) : (
                            npcBonds.map((bond) => {
                              const otherNpcId = bond.sourceNpcId === npc.id ? bond.targetNpcId : bond.sourceNpcId;
                              const otherNpc = npcs.find((n) => n.id === otherNpcId);
                              const affinity = getAffinityBadge(bond.affinity);

                              return (
                                <div
                                  key={bond.id}
                                  className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1.5"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-zinc-200">{otherNpc?.name || otherNpcId}</span>
                                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                                        {bond.relationTypeId}
                                      </span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${affinity.color}`} dir="ltr">
                                      {affinity.label} ({bond.affinity > 0 ? `+${bond.affinity}` : bond.affinity})
                                    </span>
                                  </div>
                                  {bond.secretTension && (
                                    <p className="text-[11px] text-zinc-400 italic">
                                      "{bond.secretTension}"
                                    </p>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-zinc-800/60 text-[11px] text-zinc-500 font-mono flex justify-between">
                  <span>ID: {npc.id}</span>
                  <span>Faction: {npc.factionId || 'None'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Interpersonal Drama Bonds Grid */}
      {activeTab === 'drama' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dramaBonds.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-8">
              <ArrowLeftRight className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-zinc-300">
                {isPersian ? 'پیوند درام یا تنشی ثبت نشده است' : 'No interpersonal drama bonds registered'}
              </h4>
              <p className="text-xs text-zinc-500 mt-1">
                {isPersian
                  ? 'برای ثبت کشمکش، کینه خونی یا وفاداری میان دو شخصیت، روی دکمه ثبت پیوند درام کلیک کنید.'
                  : 'Click "+ Add Drama Bond" to define tensions, blood debts, and alliances between characters.'}
              </p>
            </div>
          ) : (
            dramaBonds.map((bond) => {
              const srcNpc = npcs.find((n) => n.id === bond.sourceNpcId);
              const tgtNpc = npcs.find((n) => n.id === bond.targetNpcId);
              const affinity = getAffinityBadge(bond.affinity);

              return (
                <div
                  key={bond.id}
                  className="bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-all space-y-4"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-xl text-xs font-bold border ${affinity.color}`} dir="ltr">
                          {affinity.label} ({bond.affinity > 0 ? `+${bond.affinity}` : bond.affinity})
                        </span>
                        {bond.isPublic ? (
                          <span className="text-[10.5px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <Eye className="w-3 h-3 text-emerald-400" /> {isPersian ? 'رابطه آشکار' : 'Public'}
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <Lock className="w-3 h-3" /> {isPersian ? 'تنش پنهان' : 'Covert Tension'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openDramaModal(bond)}
                          className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-zinc-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDramaBond(bond)}
                          className="text-zinc-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-zinc-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* NPC Connection Visual */}
                    <div className="flex items-center justify-between bg-zinc-950/70 border border-zinc-800/80 rounded-2xl p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs">
                          {srcNpc?.name?.[0] || '?'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-100">{srcNpc?.name || bond.sourceNpcId}</p>
                          <p className="text-[10px] text-zinc-500">{srcNpc?.title || 'NPC'}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center px-3">
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-700/80 px-2 py-0.5 rounded-md">
                          {bond.relationTypeId}
                        </span>
                        <ArrowLeftRight className="w-4 h-4 text-zinc-600 my-1" />
                      </div>

                      <div className="flex items-center gap-2.5 text-left rtl:text-right">
                        <div>
                          <p className="text-xs font-bold text-zinc-100">{tgtNpc?.name || bond.targetNpcId}</p>
                          <p className="text-[10px] text-zinc-500">{tgtNpc?.title || 'NPC'}</p>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-300 font-bold flex items-center justify-center text-xs">
                          {tgtNpc?.name?.[0] || '?'}
                        </div>
                      </div>
                    </div>

                    {/* Secret Tension Context */}
                    {bond.secretTension && (
                      <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-3.5 text-xs text-zinc-300 space-y-1">
                        <span className="text-amber-400/90 font-bold block text-[11px]">
                          {isPersian ? 'ریشه تنش و تاریخچه درام:' : 'Tension Context & Secret History:'}
                        </span>
                        <p className="leading-relaxed italic text-zinc-300">&ldquo;{bond.secretTension}&rdquo;</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500 font-mono flex justify-between">
                    <span>ID: {bond.id}</span>
                    <span dir="ltr">Affinity: {bond.affinity}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Plan 04: AI Relationship Preview Modal */}
      {relationshipPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-rose-400" />
                {isPersian
                  ? `سنتز پیوندهای درام: ${relationshipPreview.sourceNpc.name}`
                  : `Synthesized Drama Bonds: ${relationshipPreview.sourceNpc.name}`}
              </h3>
              <button
                onClick={() => setRelationshipPreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              {isPersian
                ? 'پیوندهای زیر توسط هوش مصنوعی بر اساس شخصیت‌ها و لور موجود در جهان پیشنهاد شده‌اند:'
                : 'The following high-stakes interpersonal bonds were synthesized by AI:'}
            </p>

            <div className="space-y-3">
              {relationshipPreview.bonds.map((bond, idx) => {
                const affinity = getAffinityBadge(bond.affinity);
                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-200">
                          {relationshipPreview.sourceNpc.name} ↔ {bond.targetNpcName}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300 font-mono text-[10px]">
                          {bond.relationTypeId}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg font-bold border text-[10.5px] ${affinity.color}`} dir="ltr">
                        {affinity.label} ({bond.affinity > 0 ? `+${bond.affinity}` : bond.affinity})
                      </span>
                    </div>

                    {bond.secretTension && (
                      <p className="text-zinc-400 italic text-[11px]">
                        "{bond.secretTension}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setRelationshipPreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleCommitRelationships}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-rose-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isPersian ? '📥 افزودن پیوندها به جهان' : '📥 Commit Bonds to World'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan 04: AI Voice Guide Preview Modal */}
      {voiceGuidePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-purple-400" />
                {isPersian ? 'پیش‌نمایش راهنمای گفتار و دیالوگ' : 'Voice & Dialogue Guide Preview'}
              </h3>
              <button
                onClick={() => setVoiceGuidePreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {voiceGuidePreview.guide.speechQuirks.length > 0 && (
                <div>
                  <span className="text-[10.5px] text-zinc-400 font-bold block mb-1">
                    {isPersian ? 'تکیه‌کلام‌ها و ویژگی‌های گفتاری:' : 'Speech Quirks:'}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {voiceGuidePreview.guide.speechQuirks.map((q, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg bg-zinc-950 text-zinc-300 border border-zinc-800"
                      >
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-[10.5px] text-purple-400 font-bold block">
                  {isPersian ? 'نمونه دیالوگ‌ها:' : 'Sample Quotes:'}
                </span>
                {voiceGuidePreview.guide.sampleDialogue.map((d, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px]"
                  >
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-purple-300 font-mono text-[9.5px] uppercase">
                      {d.context}
                    </span>
                    <p className="mt-1 text-zinc-300 italic">"{d.quote}"</p>
                  </div>
                ))}
              </div>

              {voiceGuidePreview.guide.negotiationVulnerabilities.length > 0 && (
                <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-2.5 text-emerald-300/90 text-[11px]">
                  🎯 <strong>{isPersian ? 'نقاط اثرپذیری در مذاکره: ' : 'Vulnerabilities: '}</strong>
                  {voiceGuidePreview.guide.negotiationVulnerabilities.join(' · ')}
                </div>
              )}

              {voiceGuidePreview.guide.psychologicalBreakingPoint && (
                <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-2.5 text-rose-300/90 text-[11px]">
                  💥 <strong>{isPersian ? 'نقطه شکست روانی: ' : 'Breaking Point: '}</strong>
                  {voiceGuidePreview.guide.psychologicalBreakingPoint}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setVoiceGuidePreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleCommitVoiceGuide}
                className="px-5 py-2 rounded-xl bg-purple-500 text-zinc-950 text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 ثبت برای این شخصیت' : '📥 Save to NPC'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan 04: AI Stat Calibration Preview Modal */}
      {statCalibrationPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sword className="w-5 h-5 text-amber-400" />
                {isPersian ? 'پیش‌نمایش کالیبراسیون رزمی و ویژگی‌ها' : 'RPG Stat Calibration Preview'}
              </h3>
              <button
                onClick={() => setStatCalibrationPreview(null)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-2xl p-3">
                <span className="font-bold text-zinc-200">
                  {statCalibrationPreview.calibration.npcName}
                </span>
                <span className={`px-2.5 py-0.5 rounded-lg border font-mono ${getCombatTierBadge(statCalibrationPreview.calibration.combatTier)}`}>
                  {statCalibrationPreview.calibration.combatTier.toUpperCase()} · CR {statCalibrationPreview.calibration.challengeRating}
                </span>
              </div>

              {Object.keys(statCalibrationPreview.calibration.statRatings).length > 0 && (
                <div>
                  <span className="text-[10.5px] text-zinc-400 font-bold block mb-1">
                    {isPersian ? 'امتیاز ویژگی‌ها:' : 'Attributes:'}
                  </span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5" dir="ltr">
                    {Object.entries(statCalibrationPreview.calibration.statRatings).map(([st, val]) => (
                      <div
                        key={st}
                        className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-center"
                      >
                        <span className="text-[10px] text-zinc-400 block">{st}</span>
                        <span className="text-xs font-bold text-amber-300 font-mono">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {statCalibrationPreview.calibration.signatureAbilities.length > 0 && (
                <div>
                  <span className="text-[10.5px] text-zinc-400 font-bold block mb-1">
                    {isPersian ? 'توانایی‌های ویژه:' : 'Signature Abilities:'}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {statCalibrationPreview.calibration.signatureAbilities.map((ab, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg bg-zinc-950 text-amber-200 border border-amber-500/20"
                      >
                        ⚡ {ab}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {statCalibrationPreview.calibration.equippedGear.length > 0 && (
                <div>
                  <span className="text-[10.5px] text-zinc-400 font-bold block mb-1">
                    {isPersian ? 'سلاح‌ها و تجهیزات مجهز:' : 'Equipped Gear:'}
                  </span>
                  <div className="space-y-1">
                    {statCalibrationPreview.calibration.equippedGear.map((gear, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between text-[11px]"
                      >
                        <span className="font-bold text-zinc-200">⚔️ {gear.name}</span>
                        <span className="text-[10px] text-zinc-400 uppercase font-mono">{gear.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setStatCalibrationPreview(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleCommitStatCalibration}
                className="px-5 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 ثبت کالیبراسیون' : '📥 Save Calibration'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NPC Modal */}
      {npcModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-400" />
                {editingNpcId ? (isPersian ? 'ویرایش پرونده شخصیت' : 'Edit NPC Dossier') : (isPersian ? 'ثبت پرونده شخصیت جدید' : 'Register New NPC Dossier')}
              </h3>
              <button
                onClick={() => setNpcModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNpc} className="space-y-4">
              <AiFillSection type="npc" onFilled={applyAiFill} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t.npcName}</label>
                  <input
                    type="text"
                    value={npcForm.name}
                    onChange={(e) => setNpcForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Captain Rolan"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t.npcTitle}</label>
                  <input
                    type="text"
                    value={npcForm.title}
                    onChange={(e) => setNpcForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Guard Captain"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'جناح وابسته' : 'Affiliated Faction'}
                  </label>
                  <select
                    value={npcForm.factionId || ''}
                    onChange={(e) => setNpcForm((prev) => ({ ...prev, factionId: e.target.value }))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">{isPersian ? '-- بدون جناح / مستقل --' : '-- Independent --'}</option>
                    {story.worldBible.factions.map((f) => (
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
                    {story.worldBible.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.trust}</label>
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
                <label className="block text-xs text-zinc-400 mb-1">{t.speechDirectives}</label>
                <textarea
                  rows={2}
                  value={npcForm.speechStyle}
                  onChange={(e) => setNpcForm((prev) => ({ ...prev, speechStyle: e.target.value }))}
                  placeholder="Directives for AI tone..."
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Personality Traits Input */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.traits}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={traitInput}
                    onChange={(e) => setTraitInput(e.target.value)}
                    placeholder="e.g. Pragmatic"
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
                    className="px-3 py-2 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700"
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
                        className="text-zinc-500 hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Goals Input */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t.goals}</label>
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
                    className="px-3 py-2 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700"
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
                        className="text-zinc-500 hover:text-rose-400"
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
                  onClick={() => setNpcModalOpen(false)}
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

      {/* Secret Modal */}
      {secretModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-400" />
                {editingSecretId ? (isPersian ? 'ویرایش راز' : 'Edit Secret') : (isPersian ? 'افزودن راز جدید' : 'Add Secret')}
              </h3>
              <button
                onClick={() => setSecretModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSecret} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'متن راز پنهان' : 'Secret Description'}
                </label>
                <textarea
                  rows={3}
                  value={secretForm.description}
                  onChange={(e) =>
                    setSecretForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="What is this NPC concealing?"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'حداقل سطح اعتماد برای افشا' : 'Required Trust Threshold'}
                </label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={secretForm.requiredTrustLevel}
                  onChange={(e) =>
                    setSecretForm((prev) => ({
                      ...prev,
                      requiredTrustLevel: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setSecretModalOpen(false)}
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

      {/* Drama Bond Modal */}
      {dramaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-rose-400" />
                {editingBondId
                  ? isPersian
                    ? 'ویرایش پیوند درام شخصیتی'
                    : 'Edit Interpersonal Drama Bond'
                  : isPersian
                  ? 'ثبت پیوند درام و تنش جدید'
                  : 'Register New Drama Bond'}
              </h3>
              <button
                onClick={() => setDramaModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDramaBond} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'شخصیت اول:' : 'Source Character:'}
                  </label>
                  <select
                    value={bondSourceId}
                    onChange={(e) => setBondSourceId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                  >
                    {npcs.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'شخصیت دوم:' : 'Target Character:'}
                  </label>
                  <select
                    value={bondTargetId}
                    onChange={(e) => setBondTargetId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                  >
                    {npcs.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'نوع پیوند / پیوند هستی‌شناسی:' : 'Relation Type:'}
                  </label>
                  <input
                    type="text"
                    value={bondRelationType}
                    onChange={(e) => setBondRelationType(e.target.value)}
                    placeholder="e.g. blood_debt, mentor_apprentice"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {isPersian ? 'سطح صمیمیت / کینه (-۱۰۰ تا +۱۰۰):' : 'Affinity (-100 to +100):'}
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={bondAffinity}
                      onChange={(e) => setBondAffinity(Number(e.target.value))}
                      className="flex-1 accent-rose-500"
                    />
                    <span className="font-mono text-xs text-amber-400 w-10 text-center" dir="ltr">
                      {bondAffinity > 0 ? `+${bondAffinity}` : bondAffinity}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  {isPersian ? 'ریشه تنش و تاریخچه پنهان درام:' : 'Secret Tension & Drama History:'}
                </label>
                <textarea
                  rows={2}
                  value={bondSecretTension}
                  onChange={(e) => setBondSecretTension(e.target.value)}
                  placeholder={isPersian ? 'علت کینه، سوءظن یا سوگند وفاداری...' : 'Explain the tension or sworn bond...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={bondIsPublic}
                    onChange={(e) => setBondIsPublic(e.target.checked)}
                    className="rounded accent-rose-500 w-4 h-4"
                  />
                  <span>{isPersian ? 'پیوند آشکار (سایرین از آن باخبرند)' : 'Publicly Known Relationship'}</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setDramaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-500 text-zinc-950 text-xs font-bold hover:bg-rose-400"
                >
                  {editingBondId
                    ? isPersian
                      ? 'ذخیره پیوند'
                      : 'Update Bond'
                    : isPersian
                    ? 'ثبت پیوند'
                    : 'Save Bond'}
                </button>
      {/* Story Role Override Modal */}
      {overrideModalOpen && targetNpcForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  {isPersian ? 'نقش اختصاصی در این داستان' : 'Story-Specific Role Override'}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {targetNpcForOverride.name} ({targetNpcForOverride.title || targetNpcForOverride.role || 'NPC'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOverrideModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-indigo-300/80 bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 leading-relaxed">
              {isPersian
                ? 'این تنظیمات بدون دستکاری پرونده اصلی شخصیت در جهان، لنز روایت و نقش شخصیت را منحصراً در این داستان بازتعریف می‌کنند.'
                : 'These settings redefine the narrative lens and function of this NPC specifically for this story without modifying the shared World Bible.'}
            </p>

            <form onSubmit={handleSaveOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  {isPersian ? 'نقش در این داستان (Story Role)' : 'Role in this Story'}
                </label>
                <input
                  type="text"
                  value={overrideForm.storyRole}
                  onChange={(e) => setOverrideForm((prev) => ({ ...prev, storyRole: e.target.value }))}
                  placeholder={isPersian ? 'مثال: مظنون اصلی پرونده، هدف سرقت، مربی خیانت‌دیده...' : 'e.g. Prime Suspect, Heist Target, Reluctant Mentor...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  {isPersian ? 'ارتباط با شخصیت اصلی / قهرمان' : 'Relationship to Protagonist'}
                </label>
                <input
                  type="text"
                  value={overrideForm.relationshipToProtagonist}
                  onChange={(e) => setOverrideForm((prev) => ({ ...prev, relationshipToProtagonist: e.target.value }))}
                  placeholder={isPersian ? 'مثال: شریک قدیمی که از گذشته شما باخبر است...' : 'e.g. Former partner who knows your dark secret...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  {isPersian ? 'انگیزه و هدف در این داستان' : 'Goal / Agenda in this Story'}
                </label>
                <input
                  type="text"
                  value={overrideForm.storyGoal}
                  onChange={(e) => setOverrideForm((prev) => ({ ...prev, storyGoal: e.target.value }))}
                  placeholder={isPersian ? 'مثال: تلاش برای امحای مدارک قبل از بازجویی...' : 'e.g. Trying to destroy the evidence before interrogation...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  {isPersian ? 'راز داستانی منحصربه‌فرد' : 'Story-Specific Secret'}
                </label>
                <textarea
                  rows={2}
                  value={overrideForm.storySecret}
                  onChange={(e) => setOverrideForm((prev) => ({ ...prev, storySecret: e.target.value }))}
                  placeholder={isPersian ? 'رازی که فقط در این پی‌رنگ و سناریو اهمیت پیدا می‌کند...' : 'A secret relevant specifically to this plot arc...'}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    {isPersian ? 'میزان اعتماد اولیه (-100 تا 100)' : 'Custom Initial Trust (-100 to 100)'}
                  </label>
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    value={overrideForm.customInitialTrust !== undefined ? overrideForm.customInitialTrust : ''}
                    onChange={(e) =>
                      setOverrideForm((prev) => ({
                        ...prev,
                        customInitialTrust: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                      }))
                    }
                    placeholder={`Default: ${targetNpcForOverride.initialTrust ?? 0}`}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    {isPersian ? 'اهمیت روایی در این داستان' : 'Narrative Importance'}
                  </label>
                  <select
                    value={overrideForm.narrativeImportance}
                    onChange={(e) =>
                      setOverrideForm((prev) => ({
                        ...prev,
                        narrativeImportance: e.target.value as 'central' | 'supporting' | 'incidental',
                      }))
                    }
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="central">{isPersian ? 'محوری (پین‌شده در پرامپت)' : 'Central (Always Pinned in AI Prompt)'}</option>
                    <option value="supporting">{isPersian ? 'مکمل (Supporting)' : 'Supporting'}</option>
                    <option value="incidental">{isPersian ? 'فرعی (Incidental)' : 'Incidental'}</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
                >
                  {isPersian ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 cursor-pointer shadow-lg shadow-indigo-600/30"
                >
                  {isPersian ? 'ذخیره نقش اختصاصی' : 'Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
