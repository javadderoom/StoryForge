import React from 'react';
import { Sparkles, Volume2, Sword, X, Check, Edit2 } from 'lucide-react';
import {
  NPCDossier,
  NpcVoiceGuide,
  NpcStatCalibration,
  NpcSampleDialogue,
  NpcEquippedGear,
} from '@/lib/types';
import { getAffinityBadge, getCombatTierBadge } from '../npcBadges';

export interface RelationshipPreviewData {
  sourceNpc: NPCDossier;
  bonds: Array<{
    id?: string;
    targetNpcId: string;
    targetNpcName: string;
    relationTypeId: string;
    affinity: number;
    secretTension: string;
    isPublic: boolean;
  }>;
}

export interface VoiceGuidePreviewData {
  targetNpcId: string;
  guide: NpcVoiceGuide;
}

export interface StatCalibrationPreviewData {
  targetNpcId: string;
  calibration: NpcStatCalibration;
}

export interface NpcAiPreviewModalsProps {
  isPersian: boolean;
  cancelLabel: string;
  // Relationship preview
  relationshipPreview: RelationshipPreviewData | null;
  onCloseRelationshipPreview: () => void;
  onCommitRelationships: () => void;
  // Voice guide preview
  voiceGuidePreview: VoiceGuidePreviewData | null;
  onCloseVoiceGuidePreview: () => void;
  onCommitVoiceGuide: () => void;
  onEditFirstVoiceGuide: (data: VoiceGuidePreviewData) => void;
  // Stat calibration preview
  statCalibrationPreview: StatCalibrationPreviewData | null;
  onCloseStatCalibrationPreview: () => void;
  onCommitStatCalibration: () => void;
  onEditFirstStatCalibration: (data: StatCalibrationPreviewData) => void;
}

export function NpcAiPreviewModals({
  isPersian,
  cancelLabel,
  relationshipPreview,
  onCloseRelationshipPreview,
  onCommitRelationships,
  voiceGuidePreview,
  onCloseVoiceGuidePreview,
  onCommitVoiceGuide,
  onEditFirstVoiceGuide,
  statCalibrationPreview,
  onCloseStatCalibrationPreview,
  onCommitStatCalibration,
  onEditFirstStatCalibration,
}: NpcAiPreviewModalsProps) {
  return (
    <>
      {/* AI Relationship Preview Modal */}
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
                onClick={onCloseRelationshipPreview}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
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
                const affinity = getAffinityBadge(bond.affinity, isPersian);
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
                onClick={onCloseRelationshipPreview}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onCommitRelationships}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-rose-500/20 flex items-center gap-1.5 cursor-pointer"
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

      {/* AI Voice Guide Preview Modal */}
      {voiceGuidePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-purple-400" />
                {isPersian ? 'پیش‌نمایش راهنمای گفتار و دیالوگ' : 'Voice & Dialogue Guide Preview'}
              </h3>
              <button
                onClick={onCloseVoiceGuidePreview}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
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
                    {voiceGuidePreview.guide.speechQuirks.map((q: string, idx: number) => (
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
                {voiceGuidePreview.guide.sampleDialogue.map((d: NpcSampleDialogue, idx: number) => (
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
                onClick={onCloseVoiceGuidePreview}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => onEditFirstVoiceGuide(voiceGuidePreview)}
                className="px-3.5 py-2 rounded-xl bg-purple-500/20 text-purple-300 text-xs font-bold hover:bg-purple-500/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isPersian ? 'ویرایش قبل از ثبت' : 'Edit First'}</span>
              </button>
              <button
                type="button"
                onClick={onCommitVoiceGuide}
                className="px-5 py-2 rounded-xl bg-purple-500 text-zinc-950 text-xs font-bold shadow-lg shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer hover:bg-purple-400"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 ثبت برای این شخصیت' : '📥 Save to NPC'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Stat Calibration Preview Modal */}
      {statCalibrationPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Sword className="w-5 h-5 text-amber-400" />
                {isPersian ? 'پیش‌نمایش کالیبراسیون رزمی و ویژگی‌ها' : 'RPG Stat Calibration Preview'}
              </h3>
              <button
                onClick={onCloseStatCalibrationPreview}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
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
                        <span className="text-xs font-bold text-amber-300 font-mono">{String(val)}</span>
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
                    {statCalibrationPreview.calibration.signatureAbilities.map((ab: string, idx: number) => (
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
                    {statCalibrationPreview.calibration.equippedGear.map((gear: NpcEquippedGear, idx: number) => (
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
                onClick={onCloseStatCalibrationPreview}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => onEditFirstStatCalibration(statCalibrationPreview)}
                className="px-3.5 py-2 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold hover:bg-amber-500/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isPersian ? 'ویرایش قبل از ثبت' : 'Edit First'}</span>
              </button>
              <button
                type="button"
                onClick={onCommitStatCalibration}
                className="px-5 py-2 rounded-xl bg-amber-500 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer hover:bg-amber-400"
              >
                <Check className="w-4 h-4" />
                <span>{isPersian ? '📥 ثبت کالیبراسیون' : '📥 Save Calibration'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default NpcAiPreviewModals;
