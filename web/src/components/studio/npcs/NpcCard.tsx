import React, { useState } from 'react';
import {
  Heart,
  Edit2,
  Trash2,
  Sparkles,
  Tag,
  MessageSquare,
  Lock,
  Volume2,
  Plus,
  ChevronDown,
  ChevronUp,
  Copy,
  Sword,
  Zap,
  ArrowLeftRight,
  Users,
  User,
  MapPin,
} from 'lucide-react';
import {
  NPCDossier,
  NPCDramaBond,
  StoryManifest,
  NpcSampleDialogue,
  NpcEquippedGear,
} from '@/lib/types';
import { getAffinityBadge, getCombatTierBadge } from './npcBadges';

export interface NpcCardProps {
  npc: NPCDossier;
  story: StoryManifest;
  isPersian: boolean;
  t: {
    trust: string;
    speechDirectives: string;
    goals: string;
    hiddenSecrets: string;
    addSecret: string;
    requiresTrust: string;
    voiceGuide: string;
    editVoiceGuide: string;
    deleteVoiceGuide: string;
    createVoiceGuide: string;
    rpgStats: string;
    editStats: string;
    deleteStats: string;
    createStats: string;
    socialBonds: string;
  };
  npcs: NPCDossier[];
  dramaBonds: NPCDramaBond[];
  isVoiceExpanded: boolean;
  isStatExpanded: boolean;
  isBondsExpanded: boolean;
  generatingVoiceNpcId: string | null;
  generatingStatsNpcId: string | null;
  generatingRelationshipsNpcId: string | null;
  onToggleVoiceAccordion: (id: string) => void;
  onToggleStatAccordion: (id: string) => void;
  onToggleBondsAccordion: (id: string) => void;
  onEditNpc: (npc: NPCDossier) => void;
  onDeleteNpc: (npc: NPCDossier) => void;
  onOpenOverrideModal: (npc: NPCDossier) => void;
  onRemoveStoryNpcOverride: (npcId: string) => void;
  onOpenSecretModal: (npcId: string, secret?: NPCDossier['secrets'][0]) => void;
  onDeleteSecret: (npcId: string, secretId: string) => void;
  onOpenVoiceGuideModal: (npc: NPCDossier) => void;
  onDeleteVoiceGuide: (npc: NPCDossier) => void;
  onGenerateVoiceGuide: (npc: NPCDossier) => void;
  onOpenStatModal: (npc: NPCDossier) => void;
  onDeleteStatCalibration: (npc: NPCDossier) => void;
  onGenerateStatCalibration: (npc: NPCDossier, tierHint?: string) => void;
  onGenerateRelationships: (npc: NPCDossier) => void;
  onAutoFillNpc: (npc: NPCDossier) => void;
  generatingAutoFillNpcId?: string | null;
  onCopyToClipboard: (text: string) => void;
}

export function NpcCard({
  npc,
  story,
  isPersian,
  t,
  npcs,
  dramaBonds,
  isVoiceExpanded,
  isStatExpanded,
  isBondsExpanded,
  generatingVoiceNpcId,
  generatingStatsNpcId,
  generatingRelationshipsNpcId,
  generatingAutoFillNpcId,
  onToggleVoiceAccordion,
  onToggleStatAccordion,
  onToggleBondsAccordion,
  onEditNpc,
  onDeleteNpc,
  onOpenOverrideModal,
  onRemoveStoryNpcOverride,
  onOpenSecretModal,
  onDeleteSecret,
  onOpenVoiceGuideModal,
  onDeleteVoiceGuide,
  onGenerateVoiceGuide,
  onOpenStatModal,
  onDeleteStatCalibration,
  onGenerateStatCalibration,
  onGenerateRelationships,
  onAutoFillNpc,
  onCopyToClipboard,
}: NpcCardProps) {


  const npcBonds = dramaBonds.filter(
    (b: NPCDramaBond) => b.sourceNpcId === npc.id || b.targetNpcId === npc.id
  );

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-zinc-700 transition-all group space-y-4">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-lg ${
                npc.kind === 'template'
                  ? 'bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/40 text-cyan-300'
                  : 'bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/30 text-amber-300'
              }`}
            >
              {npc.kind === 'template' ? <Users className="w-5 h-5" /> : (npc.name[0] || 'N')}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-zinc-100">{npc.name}</h3>
                {npc.kind === 'template' ? (
                  <span className="px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] font-medium flex items-center gap-1">
                    <Users className="w-2.5 h-2.5" />
                    {isPersian ? 'الگوی گروهی' : 'Group Archetype'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-medium flex items-center gap-1">
                    <User className="w-2.5 h-2.5" />
                    {isPersian ? 'شخصیت نامدار' : 'Named'}
                  </span>
                )}
                {npc.role && (
                  <span className="px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 text-[10px]">
                    {npc.role}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 font-medium">{npc.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAutoFillNpc(npc)}
              disabled={generatingAutoFillNpcId === npc.id}
              className="px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              title={isPersian ? 'تکمیل بخش‌های خالی این شخصیت با هوش مصنوعی بر اساس لور جهان' : 'Auto-fill empty sections with AI based on world lore'}
            >
              <Sparkles className={`w-3.5 h-3.5 text-purple-400 ${generatingAutoFillNpcId === npc.id ? 'animate-spin' : ''}`} />
              <span>
                {generatingAutoFillNpcId === npc.id
                  ? (isPersian ? 'در حال تکمیل...' : 'Filling...')
                  : (isPersian ? 'تکمیل با هوش مصنوعی' : 'Fill with AI')}
              </span>
            </button>
            <span className="text-xs bg-zinc-800/90 text-zinc-300 px-3 py-1 rounded-xl border border-zinc-700/60 flex items-center gap-1.5 font-mono" dir="ltr">
              <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
              {t.trust} {npc.initialTrust}
            </span>
            <div className="flex items-center opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEditNpc(npc)}
                className="p-1 text-zinc-400 hover:text-amber-400 rounded-lg hover:bg-zinc-800 cursor-pointer"
                title="Edit NPC"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDeleteNpc(npc)}
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
          if (override && (override.storyRole || override.relationshipToProtagonist || override.storyGoal || override.storySecret || override.firstAppearanceChapter !== undefined)) {
            return (
              <div className="rounded-2xl bg-indigo-950/40 border border-indigo-500/30 p-3 mb-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-300">
                      {isPersian ? 'نقش اختصاصی در این داستان' : 'Story Lens (Active Override)'}
                    </span>
                    {override.narrativeImportance === 'central' && (
                      <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/30 font-medium">
                        {isPersian ? 'شخصیت محوری (پین‌شده)' : 'Central Pinned'}
                      </span>
                    )}
                    {override.firstAppearanceChapter !== undefined && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 font-medium" dir="ltr">
                        📖 {isPersian ? `ورود: فصل ${override.firstAppearanceChapter}` : `First Appears: Ch. ${override.firstAppearanceChapter}`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenOverrideModal(npc)}
                      className="text-[11px] text-indigo-300 hover:text-indigo-200 underline cursor-pointer"
                    >
                      {isPersian ? 'ویرایش' : 'Edit'}
                    </button>
                    <span className="text-zinc-600 text-xs">•</span>
                    <button
                      type="button"
                      onClick={() => onRemoveStoryNpcOverride(npc.id)}
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
                  {override.firstAppearanceChapter !== undefined && (
                    <div>
                      <span className="text-zinc-500 block text-[10px]">{isPersian ? 'ورود به داستان:' : 'First Appears:'}</span>
                      <span className="text-amber-300 font-medium" dir="ltr">{isPersian ? `فصل ${override.firstAppearanceChapter}` : `Chapter ${override.firstAppearanceChapter}`}</span>
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
                onClick={() => onOpenOverrideModal(npc)}
                className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 font-medium cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                {isPersian ? 'تنظیم نقش اختصاصی' : 'Customize for this Story'}
              </button>
            </div>
          );
        })()}

        {/* Operating Locations for Group Templates */}
        {npc.kind === 'template' && npc.applicableLocationIds && npc.applicableLocationIds.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3 text-xs">
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-cyan-400" />
              {isPersian ? 'مناطق استقرار:' : 'Spawn Locations:'}
            </span>
            {npc.applicableLocationIds.map((locId) => {
              const loc = story.worldBible.locations.find((l) => l.id === locId);
              return (
                <span
                  key={locId}
                  className="text-[10px] bg-cyan-950/40 text-cyan-300 border border-cyan-800/40 px-2 py-0.5 rounded-md"
                >
                  {loc?.name || locId}
                </span>
              );
            })}
          </div>
        )}

        {/* Personality Traits Chips */}
        {npc.personalityTraits && npc.personalityTraits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {npc.personalityTraits
              .flatMap((trait: string) =>
                trait.split(/[,،]+/).map((s) => s.trim().replace(/^[•\-\*]\s*/, '')).filter(Boolean)
              )
              .map((trait: string, i: number) => (
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
              {npc.goals.map((g: string, i: number) => (
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
              onClick={() => onOpenSecretModal(npc.id)}
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
              {npc.secrets.map((sec: NPCDossier['secrets'][0]) => (
                <div
                  key={sec.id}
                  className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3 text-xs flex items-start justify-between gap-2 group/secret"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-rose-500/10 border border-rose-500/20 text-rose-300" dir="ltr">
                        {t.requiresTrust} {sec.requiredTrustLevel}
                      </span>
                      {(sec.revealMethods || []).map((m, mIdx) => (
                        <span
                          key={mIdx}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-sky-500/10 border border-sky-500/25 text-sky-300"
                          title={m.detail || m.kind}
                        >
                          {m.kind}
                          {m.kind === 'trust' && m.trustThreshold !== undefined ? ` ${m.trustThreshold}` : ''}
                          {m.kind === 'item' ? `: ${m.itemName || m.itemId}` : ''}
                          {m.kind === 'ritual' ? `: ${m.ritual}` : ''}
                          {m.kind === 'location' ? `: ${m.locationId}` : ''}
                          {m.kind === 'quest' ? `: ${m.questId}` : ''}
                        </span>
                      ))}
                    </div>
                    <p className="text-zinc-300 leading-relaxed">{sec.description}</p>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover/secret:opacity-100 transition-opacity">
                    <button
                      onClick={() => onOpenSecretModal(npc.id, sec)}
                      className="p-1 text-zinc-400 hover:text-amber-400 rounded cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDeleteSecret(npc.id, sec.id)}
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
              onClick={() => onToggleVoiceAccordion(npc.id)}
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
              <div className="flex items-center gap-1.5">
                {npc.voiceGuide ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenVoiceGuideModal(npc);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      title={t.editVoiceGuide}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteVoiceGuide(npc);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-900/50 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title={t.deleteVoiceGuide}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenVoiceGuideModal(npc);
                    }}
                    className="px-2 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    title={t.createVoiceGuide}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isPersian ? 'دستی' : 'Manual'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateVoiceGuide(npc);
                  }}
                  disabled={generatingVoiceNpcId === npc.id}
                  className="px-2.5 py-1 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>
                    {generatingVoiceNpcId === npc.id
                      ? isPersian
                        ? 'تولید...'
                        : 'Generating...'
                      : isPersian
                      ? '✨ هوش مصنوعی'
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
                          {npc.voiceGuide.speechQuirks.map((q: string, qIdx: number) => (
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
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] text-purple-400/90 font-bold block">
                          {isPersian ? 'نمونه دیالوگ‌های موقعیتی:' : 'Situational Sample Dialogue:'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenVoiceGuideModal(npc)}
                          className="text-[10.5px] text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{isPersian ? 'ویرایش دیالوگ‌ها' : 'Edit Quotes'}</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {npc.voiceGuide.sampleDialogue.map((diag: NpcSampleDialogue, dIdx: number) => (
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
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onCopyToClipboard(diag.quote)}
                                className="text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
                                title="Copy"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
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
                  <div className="text-center py-3 text-zinc-500 text-xs space-y-2">
                    <p>{isPersian ? 'راهنمای صوتی برای این شخصیت تعریف نشده است.' : 'No voice guide configured.'}</p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenVoiceGuideModal(npc)}
                        className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isPersian ? 'ایجاد دستی راهنما' : 'Create Manually'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onGenerateVoiceGuide(npc)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>{isPersian ? 'تولید با هوش مصنوعی' : 'Generate with AI'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drawer 2: RPG Stat Calibration */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
            <div
              onClick={() => onToggleStatAccordion(npc.id)}
              className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-900/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sword className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-zinc-200">{t.rpgStats}</span>
                {npc.statCalibration ? (
                  <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-mono ${getCombatTierBadge(npc.statCalibration.combatTier)}`}>
                    {npc.statCalibration.combatTier.toUpperCase()} · CR {npc.statCalibration.challengeRating}
                    {npc.statCalibration.vitals?.health
                      ? ` · HP ${npc.statCalibration.vitals.health.current}/${npc.statCalibration.vitals.health.max}`
                      : ''}
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-500 italic">
                    {isPersian ? '(کالیبره‌نشده)' : '(Uncalibrated)'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {npc.statCalibration ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenStatModal(npc);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                      title={t.editStats}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteStatCalibration(npc);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-rose-900/50 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title={t.deleteStats}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenStatModal(npc);
                    }}
                    className="px-2 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                    title={t.createStats}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isPersian ? 'دستی' : 'Manual'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerateStatCalibration(npc, 'auto');
                  }}
                  disabled={generatingStatsNpcId === npc.id}
                  className="px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
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
                    {/* Vitals & Resource Pools */}
                    {npc.statCalibration.vitals && (
                      <div>
                        <span className="text-[10.5px] text-zinc-500 font-bold flex items-center gap-1 mb-1">
                          <Heart className="w-3 h-3 text-rose-400" />
                          {isPersian ? 'علائم حیاتی:' : 'Vitals:'}
                        </span>
                        <div className="space-y-1.5">
                          {(
                            [
                              { key: 'health', label: isPersian ? 'جان' : 'HP' },
                              { key: 'stamina', label: isPersian ? 'استقامت' : 'ST' },
                              { key: 'mana', label: isPersian ? 'مانا' : 'MP' },
                            ] as const
                          ).map(({ key, label }) => {
                            const bar = npc.statCalibration!.vitals?.[key];
                            if (!bar) return null;
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-400 font-mono w-8">{label}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-rose-600 to-rose-400"
                                    style={{ width: `${bar.max > 0 ? Math.round((bar.current / bar.max) * 100) : 0}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-zinc-300 font-mono">
                                  {bar.current}/{bar.max}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        {(npc.statCalibration.resourcePools || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(npc.statCalibration.resourcePools || []).map((pool) => (
                              <span
                                key={pool.id}
                                className="bg-zinc-950 text-sky-200 border border-sky-500/25 text-[10.5px] px-2 py-0.5 rounded-lg font-mono"
                              >
                                {pool.name} {pool.current}/{pool.max}
                              </span>
                            ))}
                          </div>
                        )}
                        {npc.statCalibration.crBasis?.trim() && (
                          <div className="text-[10.5px] text-zinc-400 mt-1.5">
                            <span className="font-bold text-zinc-300">
                              {isPersian ? 'منشأ تهدید: ' : 'Threat source: '}
                            </span>
                            {npc.statCalibration.crBasis.trim()}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Stat Ratings Grid */}
                    {Object.keys(npc.statCalibration.statRatings).length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10.5px] text-zinc-500 font-bold block">
                            {isPersian ? 'امتیاز ویژگی‌های نقش‌آفرینی:' : 'Attributes:'}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenStatModal(npc)}
                            className="text-[10.5px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>{isPersian ? 'ویرایش مشخصات رزمی' : 'Edit Stats & Gear'}</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5" dir="ltr">
                          {Object.entries(npc.statCalibration.statRatings).map(([stName, val]) => {
                            const statDef = story.rpgSystem?.stats?.find(
                              (s) => s.id.toLowerCase() === stName.toLowerCase() || s.name.toLowerCase() === stName.toLowerCase()
                            );
                            const displayName = statDef?.name || stName;
                            return (
                              <div
                                key={stName}
                                className="p-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-center"
                              >
                                <span className="text-[10px] text-zinc-400 block truncate" title={stName}>
                                  {displayName}
                                </span>
                                <span className="text-xs font-bold text-amber-300 font-mono">{String(val)}</span>
                              </div>
                            );
                          })}
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
                          {npc.statCalibration.signatureAbilities.map((ab: string, abIdx: number) => (
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
                          {npc.statCalibration.equippedGear.map((gear: NpcEquippedGear, gIdx: number) => (
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
                  <div className="text-center py-3 text-zinc-500 text-xs space-y-2">
                    <p>{isPersian ? 'ویژگی‌های رزمی کالیبره نشده است.' : 'Stats not calibrated.'}</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenStatModal(npc)}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isPersian ? 'ثبت دستی ویژگی‌ها' : 'Create Manually'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onGenerateStatCalibration(npc, 'auto')}
                        disabled={generatingStatsNpcId === npc.id}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>
                          {generatingStatsNpcId === npc.id
                            ? isPersian
                              ? 'محاسبه...'
                              : 'Calibrating...'
                            : isPersian
                            ? 'کالیبراسیون با هوش مصنوعی'
                            : 'Calibrate with AI'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drawer 3: Social Drama Bonds */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
            <div
              onClick={() => onToggleBondsAccordion(npc.id)}
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
                    onGenerateRelationships(npc);
                  }}
                  disabled={generatingRelationshipsNpcId === npc.id}
                  className="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
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
                      onClick={() => onGenerateRelationships(npc)}
                      className="text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      {isPersian ? 'سنتز پیوندهای درام با هوش مصنوعی' : 'Synthesize bonds with AI'}
                    </button>
                  </div>
                ) : (
                  npcBonds.map((bond: NPCDramaBond) => {
                    const otherNpcId = bond.sourceNpcId === npc.id ? bond.targetNpcId : bond.sourceNpcId;
                    const otherNpc = npcs.find((n) => n.id === otherNpcId);
                    const affinity = getAffinityBadge(bond.affinity, isPersian);

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
}
