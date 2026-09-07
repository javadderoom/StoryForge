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
import { User, ArrowLeftRight, Plus } from 'lucide-react';

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

  // AI Preview Modals State
  const [relationshipPreview, setRelationshipPreview] = useState<RelationshipPreviewData | null>(null);
  const [voiceGuidePreview, setVoiceGuidePreview] = useState<VoiceGuidePreviewData | null>(null);
  const [statCalibrationPreview, setStatCalibrationPreview] = useState<StatCalibrationPreviewData | null>(null);

  const npcs = story.worldBible.npcs || [];
  const dramaBonds = story.worldBible.dramaBonds || [];
  const relationTypes = story.worldBible.ontology?.relationTypes || [];

  const availableChapters = useMemo(() => {
    const set = new Set<number>();
    story.saga?.chapters?.forEach((c) => set.add(c.chapterNumber));
    Object.values(story.storyNpcOverrides || {}).forEach((o) => {
      if (o.firstAppearanceChapter !== undefined) set.add(o.firstAppearanceChapter);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [story.saga?.chapters, story.storyNpcOverrides]);

  const filteredNpcs = useMemo(() => {
    if (chapterFilter === 'all') return npcs;
    if (chapterFilter === 'unassigned') {
      return npcs.filter((npc) => {
        const override = story.storyNpcOverrides?.[npc.id];
        return override?.firstAppearanceChapter === undefined;
      });
    }
    return npcs.filter((npc) => {
      const override = story.storyNpcOverrides?.[npc.id];
      return override?.firstAppearanceChapter === chapterFilter;
    });
  }, [npcs, chapterFilter, story.storyNpcOverrides]);

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
        ? ` Hidden Secrets: ${secretsList.join('; ')}.`
        : '';
      const goalsSection = npc.goals?.length ? ` Core Goals: ${npc.goals.join(', ')}.` : '';
      const storyOverride = story.storyNpcOverrides?.[npc.id];
      const storySection = storyOverride
        ? ` Story Role: ${storyOverride.storyRole || 'N/A'}.${storyOverride.storyGoal ? ` Story Goal: ${storyOverride.storyGoal}.` : ''}`
        : '';

      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'npc_voice_guide',
          prompt: `Generate a rich, distinct Voice & Dialogue Guide with 4 situational quotes for "${npc.name}" (${npc.title || npc.role || 'NPC'}). Speech tone: ${npc.speechStyle || 'distinct'}. Personality: ${npc.personalityTraits?.join(', ')}.${goalsSection}${secretsSection}${storySection}`,
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

      const tierDirective = tierHint && tierHint !== 'auto'
        ? `FORCED COMBAT TIER DIRECTIVE: You MUST calibrate this character strictly as tier "${tierHint}".`
        : `COMBAT TIER DIRECTIVE: Carefully evaluate if "${npc.name}" is an ordinary civilian (merchant, scholar, servant, citizen), a regular guard/militia, a veteran knight, or a high-threat antagonist. Ground the tier and CR in their vocation. Do NOT default civilians or non-combatants to elite or boss tiers.`;

      const asymmetryDirective = `VOCATIONAL ASYMMETRY & PHYSICAL REALISM:
Evaluate "${npc.name}"'s age, physical stature, and daily occupation.
- Civilians, youth, children, brokers, clerks, and scholars MUST have low physical Might (1 to 4) and concentrate any higher numbers into vocational strengths (such as Cunning: 5-7).
- Never assign flat or uniform numbers across all attributes.`;

      const prompt = `Calibrate RPG combat rating, attributes, signature abilities, and equipped gear for "${npc.name}".
${titleDesc} ${roleDesc} ${storyRoleDesc} ${importanceDesc} ${traitsDesc} ${goalsDesc}
Active RPG Attributes to rate: [${storyStats}].
${tierDirective}
${asymmetryDirective}`;

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
    editNpc(statCalibrationPreview.targetNpcId, {
      statCalibration: statCalibrationPreview.calibration,
    });
    setExpandedStatIds((prev) => new Set(prev).add(statCalibrationPreview.targetNpcId));
    setStatCalibrationPreview(null);
    notify.success(isPersian ? 'کالیبراسیون رزمی ثبت شد' : 'RPG stat calibration updated');
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">
              {isPersian ? 'ورود به داستان:' : 'Entrance Filter:'}
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
        )}
      </div>

      {/* Tab 1: NPC Dossiers Grid */}
      {activeTab === 'dossiers' && (
        filteredNpcs.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-2xl">
            {isPersian ? 'هیچ شخصیتی با این فیلتر فصل یافت نشد.' : 'No NPCs match this chapter filter.'}
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
