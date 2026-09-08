'use client';

import React, { useState, useMemo } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  NPCDossier,
  NPCDramaBond,
  NpcVoiceGuide,
  NpcStatCalibration,
} from '@/lib/types';
import { notify } from '@/lib/notify';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import { normalizeEntity } from '@/lib/engines/world/ActionNormalizer';
import { User, Users, ArrowLeftRight, Plus } from 'lucide-react';

// Extracted Subcomponents
import { NpcCard } from '@/components/studio/npcs/NpcCard';
import { NpcDramaTab } from '@/components/studio/npcs/NpcDramaTab';
import { NpcDossierModal } from '@/components/studio/npcs/modals/NpcDossierModal';
import { NpcStoryOverrideModal } from '@/components/studio/npcs/modals/NpcStoryOverrideModal';
import { NpcSecretModal } from '@/components/studio/npcs/modals/NpcSecretModal';
import { NpcDramaBondModal } from '@/components/studio/npcs/modals/NpcDramaBondModal';
import { NpcVoiceGuideModal } from '@/components/studio/npcs/modals/NpcVoiceGuideModal';
import { NpcStatCalibrationModal } from '@/components/studio/npcs/modals/NpcStatCalibrationModal';
import {
  NpcAiPreviewModals,
  RelationshipPreviewData,
  VoiceGuidePreviewData,
  StatCalibrationPreviewData,
} from '@/components/studio/npcs/modals/NpcAiPreviewModals';

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
  const [kindFilter, setKindFilter] = useState<'all' | 'individual' | 'template'>('all');
  const [chapterFilter, setChapterFilter] = useState<'all' | 'unassigned' | number>('all');

  // Modals visibility and active item targets
  const [npcModalOpen, setNpcModalOpen] = useState(false);
  const [editingNpc, setEditingNpc] = useState<NPCDossier | null>(null);

  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [targetNpcForOverride, setTargetNpcForOverride] = useState<NPCDossier | null>(null);

  const [secretModalOpen, setSecretModalOpen] = useState(false);
  const [targetNpcForSecret, setTargetNpcForSecret] = useState<string | null>(null);
  const [editingSecret, setEditingSecret] = useState<NPCDossier['secrets'][0] | null>(null);

  const [dramaModalOpen, setDramaModalOpen] = useState(false);
  const [editingBond, setEditingBond] = useState<NPCDramaBond | null>(null);

  const [voiceGuideModalOpen, setVoiceGuideModalOpen] = useState(false);
  const [targetNpcForVoiceGuide, setTargetNpcForVoiceGuide] = useState<NPCDossier | null>(null);

  const [statModalOpen, setStatModalOpen] = useState(false);
  const [targetNpcForStat, setTargetNpcForStat] = useState<NPCDossier | null>(null);

  // Accordions per NPC
  const [expandedVoiceGuideIds, setExpandedVoiceGuideIds] = useState<Set<string>>(new Set());
  const [expandedStatIds, setExpandedStatIds] = useState<Set<string>>(new Set());
  const [expandedBondsIds, setExpandedBondsIds] = useState<Set<string>>(new Set());

  // AI Generators Loading State
  const [generatingRelationshipsNpcId, setGeneratingRelationshipsNpcId] = useState<string | null>(null);
  const [generatingVoiceNpcId, setGeneratingVoiceNpcId] = useState<string | null>(null);
  const [generatingStatsNpcId, setGeneratingStatsNpcId] = useState<string | null>(null);
  const [generatingAutoFillNpcId, setGeneratingAutoFillNpcId] = useState<string | null>(null);

  // AI Preview Modals State
  const [relationshipPreview, setRelationshipPreview] = useState<RelationshipPreviewData | null>(null);
  const [voiceGuidePreview, setVoiceGuidePreview] = useState<VoiceGuidePreviewData | null>(null);
  const [statCalibrationPreview, setStatCalibrationPreview] = useState<StatCalibrationPreviewData | null>(null);

  const npcs = story.worldBible.npcs || [];
  const dramaBonds = story.worldBible.dramaBonds || [];
  const relationTypes = story.worldBible.ontology?.relationTypes || [];

  const namedCount = useMemo(() => npcs.filter((n) => n.kind !== 'template').length, [npcs]);
  const templateCount = useMemo(() => npcs.filter((n) => n.kind === 'template').length, [npcs]);

  const availableChapters = useMemo(() => {
    const set = new Set<number>();
    story.saga?.chapters?.forEach((c) => set.add(c.chapterNumber));
    Object.values(story.storyNpcOverrides || {}).forEach((o) => {
      if (o.firstAppearanceChapter !== undefined) set.add(o.firstAppearanceChapter);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [story.saga?.chapters, story.storyNpcOverrides]);

  const filteredNpcs = useMemo(() => {
    let list = npcs;
    if (kindFilter !== 'all') {
      list = list.filter((npc) => (kindFilter === 'template' ? npc.kind === 'template' : npc.kind !== 'template'));
    }
    if (chapterFilter === 'all') return list;
    if (chapterFilter === 'unassigned') {
      return list.filter((npc) => {
        const override = story.storyNpcOverrides?.[npc.id];
        return override?.firstAppearanceChapter === undefined;
      });
    }
    return list.filter((npc) => {
      const override = story.storyNpcOverrides?.[npc.id];
      return override?.firstAppearanceChapter === chapterFilter;
    });
  }, [npcs, kindFilter, chapterFilter, story.storyNpcOverrides]);

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
    editVoiceGuide: isPersian ? 'ویرایش راهنمای گفتار' : 'Edit Voice Guide',
    createVoiceGuide: isPersian ? '+ ایجاد دستی راهنما' : '+ Create Voice Guide',
    deleteVoiceGuide: isPersian ? 'حذف راهنمای گفتار' : 'Delete Voice Guide',
    editStats: isPersian ? 'ویرایش ویژگی‌های رزمی' : 'Edit RPG Stats',
    createStats: isPersian ? '+ ثبت دستی ویژگی‌ها' : '+ Create RPG Stats',
    deleteStats: isPersian ? 'حذف ویژگی‌های رزمی' : 'Delete RPG Stats',
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify.success(isPersian ? 'در حافظه کپی شد' : 'Copied to clipboard');
  };

  // --- NPC Handlers ---
  const handleOpenNpcModal = (npc?: NPCDossier) => {
    setEditingNpc(npc || null);
    setNpcModalOpen(true);
  };

  const handleSaveNpc = (npcData: NPCDossier) => {
    if (editingNpc) {
      editNpc(editingNpc.id, npcData);
    } else {
      addNpc(npcData);
    }
    setNpcModalOpen(false);
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

  // --- Story Override Handlers ---
  const handleOpenOverrideModal = (npc: NPCDossier) => {
    setTargetNpcForOverride(npc);
    setOverrideModalOpen(true);
  };

  const handleSaveOverride = (overrideData: any) => {
    if (!targetNpcForOverride) return;
    setStoryNpcOverride(targetNpcForOverride.id, overrideData);
    setOverrideModalOpen(false);
  };

  // --- Secret Handlers ---
  const handleOpenSecretModal = (npcId: string, secret?: NPCDossier['secrets'][0]) => {
    setTargetNpcForSecret(npcId);
    setEditingSecret(secret || null);
    setSecretModalOpen(true);
  };

  const handleSaveSecret = (secretData: NPCDossier['secrets'][0]) => {
    if (!targetNpcForSecret) return;
    const npc = npcs.find((n) => n.id === targetNpcForSecret);
    if (!npc) return;

    let updatedSecrets = npc.secrets;
    if (editingSecret) {
      updatedSecrets = npc.secrets.map((s) => (s.id === editingSecret.id ? secretData : s));
    } else {
      updatedSecrets = [...npc.secrets, secretData];
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
      const npc = npcs.find((n) => n.id === npcId);
      if (npc) {
        editNpc(npcId, { secrets: npc.secrets.filter((s) => s.id !== secretId) });
      }
    }
  };

  // --- Voice Guide Handlers ---
  const handleOpenVoiceGuideModal = (npc: NPCDossier) => {
    setTargetNpcForVoiceGuide(npc);
    setVoiceGuideModalOpen(true);
  };

  const handleSaveVoiceGuide = (guide: NpcVoiceGuide) => {
    if (!targetNpcForVoiceGuide) return;
    const cleanDialogue = guide.sampleDialogue.filter((d) => d.quote.trim().length > 0);
    const updatedGuide: NpcVoiceGuide = {
      ...guide,
      npcName: targetNpcForVoiceGuide.name,
      sampleDialogue: cleanDialogue.length > 0 ? cleanDialogue : [
        { context: 'greeting', quote: isPersian ? 'درود بر شما.' : 'Greetings.' },
      ],
    };
    editNpc(targetNpcForVoiceGuide.id, {
      voiceGuide: updatedGuide,
    });
    setExpandedVoiceGuideIds((prev) => new Set(prev).add(targetNpcForVoiceGuide.id));
    setVoiceGuideModalOpen(false);
    notify.success(isPersian ? 'راهنمای گفتار و دیالوگ با موفقیت ثبت شد' : 'Voice & Dialogue guide saved');
  };

  const handleDeleteVoiceGuide = async (npc: NPCDossier) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف راهنمای گفتار' : 'Delete Voice & Dialogue Guide',
      message: isPersian
        ? `آیا از حذف راهنمای گفتار و نمونه دیالوگ‌های "${npc.name}" اطمینان دارید؟`
        : `Are you sure you want to delete the Voice & Dialogue guide for "${npc.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (confirmed) {
      editNpc(npc.id, { voiceGuide: undefined });
      notify.info(isPersian ? 'راهنمای گفتار حذف شد' : 'Voice guide removed');
    }
  };

  // --- RPG Combat & Stats Handlers ---
  const handleOpenStatModal = (npc: NPCDossier) => {
    setTargetNpcForStat(npc);
    setStatModalOpen(true);
  };

  const handleSaveStatCalibration = (calibration: NpcStatCalibration) => {
    if (!targetNpcForStat) return;
    const updatedCalibration: NpcStatCalibration = {
      ...calibration,
      npcId: targetNpcForStat.id,
      npcName: targetNpcForStat.name,
    };
    editNpc(targetNpcForStat.id, {
      statCalibration: updatedCalibration,
    });
    setExpandedStatIds((prev) => new Set(prev).add(targetNpcForStat.id));
    setStatModalOpen(false);
    notify.success(isPersian ? 'کالیبراسیون رزمی و ویژگی‌ها ذخیره شد' : 'RPG stats saved');
  };

  const handleDeleteStatCalibration = async (npc: NPCDossier) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف ویژگی‌های رزمی' : 'Delete RPG Stats',
      message: isPersian
        ? `آیا از حذف کالیبراسیون رزمی "${npc.name}" اطمینان دارید؟`
        : `Are you sure you want to delete RPG stats for "${npc.name}"?`,
      confirmText: isPersian ? 'حذف شود' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });
    if (confirmed) {
      editNpc(npc.id, { statCalibration: undefined });
      notify.info(isPersian ? 'ویژگی‌های رزمی حذف شد' : 'RPG stats removed');
    }
  };

  // --- Drama Bond Handlers ---
  const handleOpenDramaModal = (bond?: NPCDramaBond) => {
    setEditingBond(bond || null);
    setDramaModalOpen(true);
  };

  const handleSaveDramaBond = (bondData: NPCDramaBond) => {
    if (editingBond) {
      editDramaBond(editingBond.id, bondData);
    } else {
      addDramaBond(bondData);
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

  // --- AI Generation Handlers ---
  const handleGenerateRelationships = async (npc: NPCDossier) => {
    try {
      setGeneratingRelationshipsNpcId(npc.id);
      const worldContext = buildWorldContextString(story);

      // Find existing drama bonds involving this character to provide grounding
      const existingBonds = dramaBonds.filter(
        (b) => b.sourceNpcId === npc.id || b.targetNpcId === npc.id
      );
      const existingBondsSummary = existingBonds.map((b) => {
        const otherId = b.sourceNpcId === npc.id ? b.targetNpcId : b.sourceNpcId;
        const other = npcs.find((n) => n.id === otherId);
        return `${other?.name || otherId} (${b.relationTypeId}, affinity ${b.affinity > 0 ? '+' : ''}${b.affinity}: "${b.secretTension || 'no secret tension'}")`;
      });

      const promptText = `Generate 2 to 4 dramatic interpersonal tension bonds for "${npc.name}" (${npc.title || 'NPC'}). Target other real NPCs in the world when possible.
${
  existingBondsSummary.length > 0
    ? `CURRENT KNOWN BONDS FOR THIS NPC:\n- ${existingBondsSummary.join('\n- ')}\nGUIDELINES: Prioritize creating bonds with other existing NPCs who do NOT yet have an established connection with "${npc.name}". If you choose to reference an NPC from the list above, you MUST evolve and deepen the existing relationship without creating an inconsistent contradictory bond.`
    : 'Prioritize forging meaningful connections with other existing NPCs currently in the world.'
}`;

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'npc_relationships',
          prompt: promptText,
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
    let addedCount = 0;
    let updatedCount = 0;

    for (const b of bonds) {
      const targetNpc = npcs.find(
        (n) => n.id === b.targetNpcId || n.name.toLowerCase() === b.targetNpcName.toLowerCase()
      );
      const targetId = b.targetNpcId || targetNpc?.id || `npc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      // Check if a bond already exists between this pair (in either direction)
      const existingBond = dramaBonds.find(
        (existing) =>
          (existing.sourceNpcId === sourceNpc.id && existing.targetNpcId === targetId) ||
          (existing.targetNpcId === sourceNpc.id && existing.sourceNpcId === targetId)
      );

      if (existingBond) {
        // Smart update existing bond to prevent duplicate or conflicting links
        editDramaBond(existingBond.id, {
          ...existingBond,
          relationTypeId: b.relationTypeId || existingBond.relationTypeId,
          affinity: b.affinity ?? existingBond.affinity,
          secretTension: b.secretTension || existingBond.secretTension,
          isPublic: b.isPublic ?? existingBond.isPublic,
        });
        updatedCount++;
      } else {
        // Add new unique bond
        const bondPayload: NPCDramaBond = {
          id: (b as any).id || `bond_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          sourceNpcId: sourceNpc.id,
          targetNpcId: targetId,
          relationTypeId: b.relationTypeId || 'ally',
          affinity: b.affinity ?? 0,
          secretTension: b.secretTension || '',
          isPublic: b.isPublic ?? true,
        };
        addDramaBond(bondPayload);
        addedCount++;
      }
    }

    setRelationshipPreview(null);
    if (addedCount > 0 && updatedCount > 0) {
      notify.success(
        isPersian
          ? `${addedCount} پیوند جدید افزوده و ${updatedCount} پیوند موجود بروزرسانی شد`
          : `Added ${addedCount} new bonds and updated ${updatedCount} existing bonds`
      );
    } else if (updatedCount > 0) {
      notify.success(
        isPersian
          ? `${updatedCount} پیوند موجود با موفقیت بروزرسانی شد`
          : `Updated ${updatedCount} existing drama bonds`
      );
    } else {
      notify.success(
        isPersian
          ? `${addedCount} پیوند درام جدید به جهان افزوده شد`
          : `Added ${addedCount} interpersonal drama bonds to world`
      );
    }
  };

  const handleGenerateVoiceGuide = async (npc: NPCDossier) => {
    try {
      setGeneratingVoiceNpcId(npc.id);
      const worldContext = buildWorldContextString(story);

      const secretsList = [
        ...(npc.secrets?.map((s) => s.description) || []),
        ...(story.storyNpcOverrides?.[npc.id]?.storySecret ? [story.storyNpcOverrides[npc.id].storySecret!] : []),
      ].filter(Boolean);
      const secretsSection = secretsList.length
        ? ` [AUTHOR-ONLY PSYCHOLOGY NOTES — DO NOT reveal in dialogue]: ${secretsList.join('; ')}.`
        : '';
      const goalsSection = npc.goals?.length ? ` Core Goals: ${npc.goals.join(', ')}.` : '';
      const storyOverride = story.storyNpcOverrides?.[npc.id];
      const storySection = storyOverride
        ? ` Story Role: ${storyOverride.storyRole || 'N/A'}.${storyOverride.storyGoal ? ` Story Goal: ${storyOverride.storyGoal}.` : ''}`
        : '';
      const trustVal = story.storyNpcOverrides?.[npc.id]?.customInitialTrust ?? npc.initialTrust ?? 0;
      const dispositionLabel = trustVal <= -60 ? 'HOSTILE' : trustVal <= -20 ? 'UNFRIENDLY' : trustVal <= 20 ? 'NEUTRAL' : trustVal <= 60 ? 'FRIENDLY' : 'DEVOTED';
      const dispositionSection = ` Initial Disposition toward player: ${dispositionLabel} (trust: ${trustVal}).`;

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'npc_voice_guide',
          prompt: `Generate a rich, distinct Voice & Dialogue Guide with 4 situational quotes for "${npc.name}" (${npc.title || npc.role || 'NPC'}). Speech tone: ${npc.speechStyle || 'distinct'}. Personality: ${npc.personalityTraits?.join(', ')}.${dispositionSection}${goalsSection}${secretsSection}${storySection}`,
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

  const handleGenerateStatCalibration = async (npc: NPCDossier, tierHint: string = 'auto') => {
    try {
      setGeneratingStatsNpcId(npc.id);
      const worldContext = buildWorldContextString(story);

      // Extract story's active RPG system attributes with scale/base grounding
      const storyStats = story.rpgSystem?.stats?.length
        ? story.rpgSystem.stats
            .map((s) => `${s.id} (${s.name || s.id}: base ${s.baseValue ?? 3}, range ${s.minValue ?? 1}-${s.maxValue ?? 20})`)
            .join(', ')
        : 'might (base 3, range 1-20), cunning (base 3, range 1-20), agility (base 3, range 1-20), arcana (base 2, range 1-20)';

      const roleDesc = npc.role ? `Role: ${npc.role}.` : '';
      const titleDesc = npc.title ? `Title: ${npc.title}.` : '';
      const traitsDesc = npc.personalityTraits?.length ? `Traits: ${npc.personalityTraits.join(', ')}.` : '';
      const goalsDesc = npc.goals?.length ? `Goals: ${npc.goals.join(', ')}.` : '';
      const override = story.storyNpcOverrides?.[npc.id];
      const importanceDesc = override?.narrativeImportance
        ? `Story Narrative Importance: ${override.narrativeImportance}.`
        : '';
      const storyRoleDesc = override?.storyRole ? `Story Role: ${override.storyRole}.` : '';
      const statTrustVal = override?.customInitialTrust ?? npc.initialTrust ?? 0;
      const statDispositionLabel = statTrustVal <= -60 ? 'HOSTILE' : statTrustVal <= -20 ? 'UNFRIENDLY' : statTrustVal <= 20 ? 'NEUTRAL' : statTrustVal <= 60 ? 'FRIENDLY' : 'DEVOTED';
      const dispositionDesc = `Disposition toward player: ${statDispositionLabel} (trust: ${statTrustVal}).`;

      const tierDirective = tierHint && tierHint !== 'auto'
        ? `FORCED COMBAT TIER DIRECTIVE: You MUST calibrate this character's PERSONAL fighting ability strictly as tier "${tierHint}". (This constrains combatTier only — rate challengeRating independently per the axes below.)`
        : `COMBAT TIER DIRECTIVE: Rate "${npc.name}"'s PERSONAL fighting ability only — an ordinary civilian (merchant, scholar, servant, citizen), a regular guard/militia, a veteran knight, etc. Do NOT default civilians or non-combatants to elite or boss tiers.`;

      const threatAxesDirective = `TWO INDEPENDENT AXES — combatTier is NOT challengeRating:
- "combatTier": how dangerous this character is in a personal fight (training, strength, combat magic, gear).
- "challengeRating" (1-20): how dangerous this character is OVERALL to confront, defy, or remove — including political influence, wealth, spy networks, secrets, faction backing, and non-combat leverage.
- These axes are INDEPENDENT. Consider splits: a scheming grand vizier with no sword skill is combatTier "civilian" but CR 12+ (court control, assassins on call); a retired warlord turned barkeep is combatTier "veteran" but CR 3 (no power base left); a charming spymaster is "apprentice" tier with CR 10 via blackmail archives.
- Set "crBasis" to a short phrase naming the non-combat threat source whenever CR exceeds what the combat tier alone implies (e.g. "controls the court and the watch payroll"); leave it "" when CR comes purely from fighting ability.
CHALLENGE RATING RUBRIC (overall threat — anchor here, and when in doubt choose the LOWER end):
- CR 1-2: harmless nobody; defying or removing them has no consequences.
- CR 3-5: local nuisance; a few allies, minor resources, neighborhood pull.
- CR 6-8: local power; commands a crew, holds an office, or has real wealth.
- CR 9-12: regional player; faction backing, spy or trade networks, court access.
- CR 13-16: moves kingdoms; armies, courts, or archmages answer to them.
- CR 17-20: continental or epochal consequences; sovereigns, primordials, demigods.
- CR above 8 REQUIRES concrete assets named in "crBasis". Title, story importance, or a HOSTILE attitude alone NEVER justify high CR — a beloved but powerless elder is CR 1-2 no matter how central they are.`;

      const asymmetryDirective = `VOCATIONAL ASYMMETRY & PHYSICAL REALISM:
Evaluate "${npc.name}"'s age, physical stature, and daily occupation.
- Civilians, youth, children, brokers, clerks, and scholars MUST have low physical Might (1 to 4) and concentrate any higher numbers into vocational strengths (such as Cunning: 5-7).
- Never assign flat or uniform numbers across all attributes.`;

      const vitalsDirective = `VITALS & RESOURCE POOLS:
- Set "vitals.health" (current/max HP) scaled to tier and CR: civilians ~4-8, apprentice guards ~10-20, veterans ~25-45, elites ~50-90, bosses ~100-200, mythic 200+.
- Add "vitals.stamina" for physically active characters; add "vitals.mana" ONLY for casters or supernatural beings (mundane fighters get no mana pool).
- Add "resourcePools" for signature expendables fitting the archetype (e.g. Rage, Spell Slots, Focus, Grit, Faith). Each pool needs id, name, and max; civilians usually have none.
- "current" values represent a fully-rested state (current = max) unless the concept implies starting wounded or drained.`;

      const prompt = `Calibrate RPG combat rating, attributes, signature abilities, equipped gear, vitals, and resource pools for "${npc.name}".
${titleDesc} ${roleDesc} ${storyRoleDesc} ${importanceDesc} ${traitsDesc} ${goalsDesc} ${dispositionDesc}
Active RPG Attributes to rate: [${storyStats}].
${tierDirective}
${threatAxesDirective}
${asymmetryDirective}
${vitalsDirective}`;

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'npc_stat_calibration',
          prompt,
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
    // Guarantee vitals/pools invariants even if the model omitted them.
    const normalized =
      normalizeEntity('npc', {
        name: statCalibrationPreview.calibration.npcName,
        statCalibration: statCalibrationPreview.calibration,
      }).statCalibration ?? statCalibrationPreview.calibration;
    editNpc(statCalibrationPreview.targetNpcId, {
      statCalibration: normalized,
    });
    setExpandedStatIds((prev) => new Set(prev).add(statCalibrationPreview.targetNpcId));
    setStatCalibrationPreview(null);
    notify.success(isPersian ? 'کالیبراسیون رزمی ثبت شد' : 'RPG stat calibration updated');
  };

  const handleAutoFillNpc = async (npc: NPCDossier) => {
    try {
      setGeneratingAutoFillNpcId(npc.id);
      const worldContext = buildWorldContextString(story);

      // Summarize existing knowledge of this character to preserve
      const currentFaction = story.worldBible.factions.find((f) => f.id === npc.factionId);
      const currentLocation = story.worldBible.locations.find((l) => l.id === npc.currentLocationId);
      const override = story.storyNpcOverrides?.[npc.id];

      const availableFactions = (story.worldBible.factions || [])
        .map((f) => `id: "${f.id}", name: "${f.name}", alignment: "${f.alignment}"`)
        .join('; ');
      const availableLocations = (story.worldBible.locations || [])
        .map((l) => `id: "${l.id}", name: "${l.name}", region: "${l.region || ''}"`)
        .join('; ');

      const existingDataSummary = [
        `Name: "${npc.name}"`,
        `Kind: ${npc.kind || 'individual'}`,
        npc.title ? `Current Title: "${npc.title}"` : 'Title: [EMPTY - generate evocative title]',
        npc.role ? `Current Role: "${npc.role}"` : 'Role: [EMPTY - determine vocational role]',
        currentFaction ? `Current Faction: "${currentFaction.name}" (id: ${currentFaction.id})` : 'Faction: [EMPTY - choose fitting faction from available list or leave unaffiliated]',
        currentLocation ? `Current Location: "${currentLocation.name}" (id: ${currentLocation.id})` : 'Location: [EMPTY - assign from available locations]',
        npc.speechStyle && npc.speechStyle !== 'Speaks with measured authority.' ? `Current Speech Directive: "${npc.speechStyle}"` : 'Speech Directive: [EMPTY/DEFAULT - generate distinctive voice, dialect, or cadence]',
        npc.personalityTraits?.length && !(npc.personalityTraits.length === 2 && npc.personalityTraits.includes('Honorable') && npc.personalityTraits.includes('Vigilant'))
          ? `Current Personality Traits: ${npc.personalityTraits.join(', ')}`
          : 'Personality Traits: [EMPTY/DEFAULT - provide 3-5 rich traits]',
        npc.goals?.length && !(npc.goals.length === 1 && npc.goals[0] === 'Protect the garrison')
          ? `Current Goals: ${npc.goals.join(', ')}`
          : 'Goals: [EMPTY/DEFAULT - generate 2-3 compelling personal or factional goals]',
        npc.secrets?.length ? `Current Secrets Count: ${npc.secrets.length}` : 'Secrets: [EMPTY - generate 1-2 intriguing secrets with requiredTrustLevel and revealMethods]',
        override?.storyRole ? `Story Override Role: "${override.storyRole}"` : '',
        override?.storyGoal ? `Story Override Goal: "${override.storyGoal}"` : '',
      ].filter(Boolean).join('\n');

      const prompt = `Complete the missing or empty sections of this character so they are fully fleshed out and anchored in the world:
${existingDataSummary}

Available Factions to link to: [${availableFactions || 'none'}]
Available Locations to link to: [${availableLocations || 'none'}]

DIRECTIVES:
1. Keep the character's existing name and any non-empty fields intact.
2. If Title or Role is empty, craft a distinctive, lore-fitting title and role.
3. If Faction is empty, select the best matching faction id from the available list (or leave "" if purely independent).
4. If Location is empty, select the most atmospheric location id from the available list.
5. If Speech Directive is empty or default, craft a vivid directive detailing speech rhythm, vocabulary, and mannerisms.
6. If Personality Traits are empty or default, provide 3 to 5 multi-dimensional traits.
7. If Goals are empty or default, provide 2 to 3 personal ambitions, ideological duties, or survival needs.
8. If Secrets are empty, author 1 to 2 high-stakes secrets with a requiredTrustLevel (between 10 and 90) and specific revealMethods (such as trust threshold, specific item, clue, or location).
9. Set initialTrust between -100 and +100 reflecting this character's initial predisposition.`;

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'npc_autofill',
          prompt,
          themeContext: story.worldBible.themeNotes,
          worldContext,
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to auto-fill character (${res.status})`);
      }

      const json = await res.json();
      if (!json.data) {
        throw new Error('No data received from auto-fill');
      }

      const filled = json.data;
      const updatedNpc: Partial<NPCDossier> = {};

      if (!npc.title?.trim() && filled.title?.trim()) {
        updatedNpc.title = filled.title.trim();
      }

      if (!npc.role?.trim() && filled.role?.trim()) {
        updatedNpc.role = filled.role.trim();
      }

      if (!npc.factionId && filled.factionId) {
        const factionExists = story.worldBible.factions.some((f) => f.id === filled.factionId);
        if (factionExists) {
          updatedNpc.factionId = filled.factionId;
        }
      }

      if ((!npc.currentLocationId || npc.currentLocationId === 'loc_dungeon_cell') && filled.currentLocationId) {
        const locExists = story.worldBible.locations.some((l) => l.id === filled.currentLocationId);
        if (locExists) {
          updatedNpc.currentLocationId = filled.currentLocationId;
        }
      }

      if (npc.kind === 'template' && (!npc.applicableLocationIds || npc.applicableLocationIds.length === 0) && Array.isArray(filled.applicableLocationIds)) {
        const validLocs = filled.applicableLocationIds.filter((id: string) =>
          story.worldBible.locations.some((l) => l.id === id)
        );
        if (validLocs.length > 0) {
          updatedNpc.applicableLocationIds = validLocs;
        }
      }

      const isDefaultSpeech = !npc.speechStyle?.trim() || npc.speechStyle.trim() === 'Speaks with measured authority.';
      if (isDefaultSpeech && filled.speechStyle?.trim()) {
        updatedNpc.speechStyle = filled.speechStyle.trim();
      }

      const existingTraits = (npc.personalityTraits || []).filter((t) => t?.trim());
      const isDefaultTraits = existingTraits.length === 2 && existingTraits.includes('Honorable') && existingTraits.includes('Vigilant');
      if (isDefaultTraits && Array.isArray(filled.personalityTraits) && filled.personalityTraits.length > 0) {
        updatedNpc.personalityTraits = filled.personalityTraits;
      } else if (Array.isArray(filled.personalityTraits)) {
        const mergedTraits = Array.from(new Set([...existingTraits, ...filled.personalityTraits]));
        if (mergedTraits.length > existingTraits.length) {
          updatedNpc.personalityTraits = mergedTraits;
        }
      }

      const existingGoals = (npc.goals || []).filter((g) => g?.trim());
      const isDefaultGoals = existingGoals.length === 1 && existingGoals[0] === 'Protect the garrison';
      if (isDefaultGoals && Array.isArray(filled.goals) && filled.goals.length > 0) {
        updatedNpc.goals = filled.goals;
      } else if (Array.isArray(filled.goals)) {
        const mergedGoals = Array.from(new Set([...existingGoals, ...filled.goals]));
        if (mergedGoals.length > existingGoals.length) {
          updatedNpc.goals = mergedGoals;
        }
      }

      if ((!npc.secrets || npc.secrets.length === 0) && Array.isArray(filled.secrets) && filled.secrets.length > 0) {
        updatedNpc.secrets = filled.secrets.map((sec: any, idx: number) => ({
          id: sec.id || `sec_${Date.now().toString(36)}_${idx}`,
          description: sec.description || '',
          requiredTrustLevel: typeof sec.requiredTrustLevel === 'number' ? sec.requiredTrustLevel : 30,
          revealed: false,
          revealMethods: Array.isArray(sec.revealMethods) ? sec.revealMethods : undefined,
        }));
      }

      if ((npc.initialTrust === undefined || npc.initialTrust === 0) && typeof filled.initialTrust === 'number') {
        updatedNpc.initialTrust = filled.initialTrust;
      }

      editNpc(npc.id, updatedNpc);
      notify.success(
        isPersian
          ? `بخش‌های خالی شخصیت «${npc.name}» بر اساس لور جهان تکمیل شد`
          : `Auto-filled empty sections for "${npc.name}" based on world lore`
      );
    } catch (err: any) {
      notify.error(err.message || 'Error auto-filling character details');
    } finally {
      setGeneratingAutoFillNpcId(null);
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
              onClick={() => handleOpenNpcModal()}
              className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t.addNpc}
            </button>
          ) : (
            <button
              onClick={() => handleOpenDramaModal()}
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

      {/* Tabs & Chapter Entrance Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('dossiers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
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

        {activeTab === 'dossiers' && (
          <div className="flex items-center gap-3 flex-wrap">
            {/* Kind Filter Pills: All / Named / Archetypes */}
            <div className="flex items-center p-0.5 bg-zinc-900 rounded-xl border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setKindFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  kindFilter === 'all'
                    ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                {isPersian ? 'همه' : 'All'} ({npcs.length})
              </button>
              <button
                type="button"
                onClick={() => setKindFilter('individual')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  kindFilter === 'individual'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <User className="w-3 h-3" />
                <span>{isPersian ? 'شخصیت‌ها' : 'Named'}</span>
                <span className="text-[10px] opacity-75 font-mono">({namedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setKindFilter('template')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  kindFilter === 'template'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                <Users className="w-3 h-3" />
                <span>{isPersian ? 'الگوهای گروهی' : 'Archetypes'}</span>
                <span className="text-[10px] opacity-75 font-mono">({templateCount})</span>
              </button>
            </div>

            {/* Chapter Entrance Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400">
                {isPersian ? 'ورود:' : 'Entrance:'}
              </span>
              <select
                value={chapterFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all' || val === 'unassigned') {
                    setChapterFilter(val);
                  } else {
                    setChapterFilter(Number(val));
                  }
                }}
                className="bg-zinc-900/90 border border-zinc-700/70 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              >
                <option value="all">{isPersian ? 'همه فصل‌ها' : 'All Chapters'}</option>
                {availableChapters.map((num) => {
                  const chTitle = story.saga?.chapters?.find((c) => c.chapterNumber === num)?.title;
                  return (
                    <option key={num} value={num}>
                      {isPersian ? `فصل ${num}` : `Chapter ${num}`}
                      {chTitle ? ` - ${chTitle}` : ''}
                    </option>
                  );
                })}
                <option value="unassigned">{isPersian ? 'عمومی / نامشخص' : 'Unassigned / Any'}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Tab 1: NPC Dossiers Grid */}
      {activeTab === 'dossiers' && (
        filteredNpcs.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-2xl">
            {isPersian ? 'هیچ شخصیتی با این فیلترها یافت نشد.' : 'No NPCs match these filters.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredNpcs.map((npc) => (
            <NpcCard
              key={npc.id}
              npc={npc}
              story={story}
              isPersian={isPersian}
              t={t}
              npcs={npcs}
              dramaBonds={dramaBonds}
              isVoiceExpanded={expandedVoiceGuideIds.has(npc.id)}
              isStatExpanded={expandedStatIds.has(npc.id)}
              isBondsExpanded={expandedBondsIds.has(npc.id)}
              generatingVoiceNpcId={generatingVoiceNpcId}
              generatingStatsNpcId={generatingStatsNpcId}
              generatingRelationshipsNpcId={generatingRelationshipsNpcId}
              generatingAutoFillNpcId={generatingAutoFillNpcId}
              onToggleVoiceAccordion={(id) => toggleAccordion(setExpandedVoiceGuideIds, id)}
              onToggleStatAccordion={(id) => toggleAccordion(setExpandedStatIds, id)}
              onToggleBondsAccordion={(id) => toggleAccordion(setExpandedBondsIds, id)}
              onEditNpc={handleOpenNpcModal}
              onDeleteNpc={handleDeleteNpc}
              onOpenOverrideModal={handleOpenOverrideModal}
              onRemoveStoryNpcOverride={removeStoryNpcOverride}
              onOpenSecretModal={handleOpenSecretModal}
              onDeleteSecret={handleDeleteSecret}
              onOpenVoiceGuideModal={handleOpenVoiceGuideModal}
              onDeleteVoiceGuide={handleDeleteVoiceGuide}
              onGenerateVoiceGuide={handleGenerateVoiceGuide}
              onOpenStatModal={handleOpenStatModal}
              onDeleteStatCalibration={handleDeleteStatCalibration}
              onGenerateStatCalibration={handleGenerateStatCalibration}
              onGenerateRelationships={handleGenerateRelationships}
              onAutoFillNpc={handleAutoFillNpc}
              onCopyToClipboard={copyToClipboard}
            />
          ))}
        </div>
        )
      )}

      {/* Tab 2: Interpersonal Drama Bonds Grid */}
      {activeTab === 'drama' && (
        <NpcDramaTab
          dramaBonds={dramaBonds}
          npcs={npcs}
          isPersian={isPersian}
          onEditBond={handleOpenDramaModal}
          onDeleteBond={handleDeleteDramaBond}
        />
      )}

      {/* All Modal Dialogs */}
      <NpcDossierModal
        open={npcModalOpen}
        editingNpc={editingNpc}
        defaultKind={kindFilter === 'template' ? 'template' : 'individual'}
        story={story}
        isPersian={isPersian}
        t={t}
        onClose={() => setNpcModalOpen(false)}
        onSave={handleSaveNpc}
      />

      <NpcStoryOverrideModal
        open={overrideModalOpen}
        targetNpc={targetNpcForOverride}
        story={story}
        isPersian={isPersian}
        onClose={() => setOverrideModalOpen(false)}
        onSave={handleSaveOverride}
      />

      <NpcSecretModal
        open={secretModalOpen}
        editingSecret={editingSecret}
        isPersian={isPersian}
        cancelLabel={t.cancel}
        saveLabel={t.save}
        onClose={() => setSecretModalOpen(false)}
        onSave={handleSaveSecret}
      />

      <NpcDramaBondModal
        open={dramaModalOpen}
        editingBond={editingBond}
        npcs={npcs}
        relationTypes={relationTypes}
        isPersian={isPersian}
        onClose={() => setDramaModalOpen(false)}
        onSave={handleSaveDramaBond}
      />

      <NpcVoiceGuideModal
        open={voiceGuideModalOpen}
        targetNpc={targetNpcForVoiceGuide}
        isPersian={isPersian}
        onClose={() => setVoiceGuideModalOpen(false)}
        onSave={handleSaveVoiceGuide}
      />

      <NpcStatCalibrationModal
        open={statModalOpen}
        targetNpc={targetNpcForStat}
        story={story}
        isPersian={isPersian}
        onClose={() => setStatModalOpen(false)}
        onSave={handleSaveStatCalibration}
      />

      <NpcAiPreviewModals
        isPersian={isPersian}
        cancelLabel={t.cancel}
        dramaBonds={dramaBonds}
        npcs={npcs}
        relationshipPreview={relationshipPreview}
        onCloseRelationshipPreview={() => setRelationshipPreview(null)}
        onCommitRelationships={handleCommitRelationships}
        voiceGuidePreview={voiceGuidePreview}
        onCloseVoiceGuidePreview={() => setVoiceGuidePreview(null)}
        onCommitVoiceGuide={handleCommitVoiceGuide}
        onEditFirstVoiceGuide={(previewData) => {
          const target = npcs.find((n) => n.id === previewData.targetNpcId);
          if (target) {
            setTargetNpcForVoiceGuide({
              ...target,
              voiceGuide: previewData.guide,
            });
            setVoiceGuidePreview(null);
            setVoiceGuideModalOpen(true);
          }
        }}
        statCalibrationPreview={statCalibrationPreview}
        onCloseStatCalibrationPreview={() => setStatCalibrationPreview(null)}
        onCommitStatCalibration={handleCommitStatCalibration}
        onEditFirstStatCalibration={(previewData) => {
          const target = npcs.find((n) => n.id === previewData.targetNpcId);
          if (target) {
            setTargetNpcForStat({
              ...target,
              statCalibration: previewData.calibration,
            });
            setStatCalibrationPreview(null);
            setStatModalOpen(true);
          }
        }}
      />
    </div>
  );
}
