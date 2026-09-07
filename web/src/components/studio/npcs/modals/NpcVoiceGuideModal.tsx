import React, { useState, useEffect } from 'react';
import { Volume2, Quote, Plus, Trash2, X, Check } from 'lucide-react';
import { NPCDossier, NpcVoiceGuide, NpcSampleDialogue } from '@/lib/types';

export interface NpcVoiceGuideModalProps {
  open: boolean;
  targetNpc: NPCDossier | null;
  isPersian: boolean;
  onClose: () => void;
  onSave: (guide: NpcVoiceGuide) => void;
}

export function NpcVoiceGuideModal({
  open,
  targetNpc,
  isPersian,
  onClose,
  onSave,
}: NpcVoiceGuideModalProps) {
  const [voiceGuideForm, setVoiceGuideForm] = useState<NpcVoiceGuide>({
    npcName: '',
    speechQuirks: [],
    sampleDialogue: [],
    negotiationVulnerabilities: [],
    psychologicalBreakingPoint: '',
  });
  const [voiceQuirkInput, setVoiceQuirkInput] = useState('');
  const [voiceVulnInput, setVoiceVulnInput] = useState('');

  useEffect(() => {
    if (open && targetNpc) {
      if (targetNpc.voiceGuide) {
        setVoiceGuideForm({
          npcName: targetNpc.voiceGuide.npcName || targetNpc.name,
          speechQuirks: [...(targetNpc.voiceGuide.speechQuirks || [])],
          sampleDialogue: (targetNpc.voiceGuide.sampleDialogue || []).map((d: NpcSampleDialogue) => ({ ...d })),
          negotiationVulnerabilities: [...(targetNpc.voiceGuide.negotiationVulnerabilities || [])],
          psychologicalBreakingPoint: targetNpc.voiceGuide.psychologicalBreakingPoint || '',
        });
      } else {
        setVoiceGuideForm({
          npcName: targetNpc.name,
          speechQuirks: [],
          sampleDialogue: [],
          negotiationVulnerabilities: [],
          psychologicalBreakingPoint: '',
        });
      }
      setVoiceQuirkInput('');
      setVoiceVulnInput('');
    }
  }, [open, targetNpc]);

  if (!open || !targetNpc) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(voiceGuideForm);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-purple-400" />
            <span>
              {targetNpc.voiceGuide
                ? isPersian
                  ? `ویرایش راهنمای گفتار: ${targetNpc.name}`
                  : `Edit Voice Guide: ${targetNpc.name}`
                : isPersian
                ? `ایجاد راهنمای گفتار: ${targetNpc.name}`
                : `Create Voice Guide: ${targetNpc.name}`}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Speech Quirks */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              {isPersian ? 'تکیه‌کلام‌ها و ویژگی‌های لحن گفتار:' : 'Speech Quirks & Habits:'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={voiceQuirkInput}
                onChange={(e) => setVoiceQuirkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (voiceQuirkInput.trim()) {
                      setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                        ...prev,
                        speechQuirks: [...prev.speechQuirks, voiceQuirkInput.trim()],
                      }));
                      setVoiceQuirkInput('');
                    }
                  }
                }}
                placeholder={isPersian ? 'مثال: با لحن شمرده و آمرانه سخن می‌گوید' : 'e.g. Speaks curtly, avoids eye contact'}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (voiceQuirkInput.trim()) {
                    setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                      ...prev,
                      speechQuirks: [...prev.speechQuirks, voiceQuirkInput.trim()],
                    }));
                    setVoiceQuirkInput('');
                  }
                }}
                className="px-3 py-2 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700 cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {voiceGuideForm.speechQuirks.map((q: string, qIdx: number) => (
                <span
                  key={qIdx}
                  className="bg-zinc-800 text-purple-200 text-[11px] px-2 py-0.5 rounded-lg flex items-center gap-1 border border-purple-500/20"
                >
                  {q}
                  <button
                    type="button"
                    onClick={() =>
                      setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                        ...prev,
                        speechQuirks: prev.speechQuirks.filter((_: string, idx: number) => idx !== qIdx),
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

          {/* Situational Sample Quotes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-300 font-bold flex items-center gap-1.5">
                <Quote className="w-3.5 h-3.5 text-purple-400" />
                <span>{isPersian ? 'نمونه دیالوگ‌های موقعیتی:' : 'Situational Sample Dialogues:'}</span>
              </label>
              <button
                type="button"
                onClick={() =>
                  setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                    ...prev,
                    sampleDialogue: [
                      ...prev.sampleDialogue,
                      { context: 'greeting', quote: '' },
                    ],
                  }))
                }
                className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1 font-bold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{isPersian ? '+ دیالوگ جدید' : '+ Add Dialogue'}</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {voiceGuideForm.sampleDialogue.map((diag: NpcSampleDialogue, dIdx: number) => (
                <div
                  key={dIdx}
                  className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <select
                      value={diag.context}
                      onChange={(e) => {
                        const val = e.target.value as NpcSampleDialogue['context'];
                        setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                          ...prev,
                          sampleDialogue: prev.sampleDialogue.map((d: NpcSampleDialogue, idx: number) =>
                            idx === dIdx ? { ...d, context: val } : d
                          ),
                        }));
                      }}
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-purple-300 font-mono focus:outline-none"
                    >
                      <option value="greeting">{isPersian ? 'درود و آغاز سخن (greeting)' : 'Greeting'}</option>
                      <option value="bargaining">{isPersian ? 'مذاکره و چانه‌زنی (bargaining)' : 'Bargaining'}</option>
                      <option value="threatened">{isPersian ? 'هنگام تهدید و فشار (threatened)' : 'Threatened'}</option>
                      <option value="dying">{isPersian ? 'لحظه مرگ یا شکست (dying)' : 'Dying'}</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                          ...prev,
                          sampleDialogue: prev.sampleDialogue.filter((_: NpcSampleDialogue, idx: number) => idx !== dIdx),
                        }))
                      }
                      className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                      title={isPersian ? 'حذف این دیالوگ' : 'Remove dialogue'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={diag.quote}
                    onChange={(e) => {
                      const text = e.target.value;
                      setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                        ...prev,
                        sampleDialogue: prev.sampleDialogue.map((d: NpcSampleDialogue, idx: number) =>
                          idx === dIdx ? { ...d, quote: text } : d
                        ),
                      }));
                    }}
                    placeholder={isPersian ? 'متن دیالوگ نمونه...' : 'Enter sample quote...'}
                    className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-lg p-2 text-xs text-zinc-100 italic focus:outline-none focus:border-purple-500"
                  />
                </div>
              ))}
              {voiceGuideForm.sampleDialogue.length === 0 && (
                <div className="text-center py-4 text-xs text-zinc-500 italic">
                  {isPersian ? 'هیچ دیالوگی افزوده نشده است. روی + دیالوگ جدید کلیک کنید.' : 'No dialogues added. Click + Add Dialogue.'}
                </div>
              )}
            </div>
          </div>

          {/* Negotiation Vulnerabilities */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              {isPersian ? 'نقاط اثرپذیری و آسیب‌پذیری در مذاکره:' : 'Negotiation Vulnerabilities:'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={voiceVulnInput}
                onChange={(e) => setVoiceVulnInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (voiceVulnInput.trim()) {
                      setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                        ...prev,
                        negotiationVulnerabilities: [...prev.negotiationVulnerabilities, voiceVulnInput.trim()],
                      }));
                      setVoiceVulnInput('');
                    }
                  }
                }}
                placeholder={isPersian ? 'مثال: وسوسه‌پذیر در برابر شمشیرهای باستانی' : 'e.g. Easily tempted by rare ancient artifacts'}
                className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => {
                  if (voiceVulnInput.trim()) {
                    setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                      ...prev,
                      negotiationVulnerabilities: [...prev.negotiationVulnerabilities, voiceVulnInput.trim()],
                    }));
                    setVoiceVulnInput('');
                  }
                }}
                className="px-3 py-2 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700 cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {voiceGuideForm.negotiationVulnerabilities.map((vuln: string, vIdx: number) => (
                <span
                  key={vIdx}
                  className="bg-emerald-950/40 text-emerald-300 text-[11px] px-2 py-0.5 rounded-lg flex items-center gap-1 border border-emerald-500/20"
                >
                  {vuln}
                  <button
                    type="button"
                    onClick={() =>
                      setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                        ...prev,
                        negotiationVulnerabilities: prev.negotiationVulnerabilities.filter((_: string, idx: number) => idx !== vIdx),
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

          {/* Psychological Breaking Point */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              {isPersian ? 'نقطه شکست روانی:' : 'Psychological Breaking Point:'}
            </label>
            <textarea
              rows={2}
              value={voiceGuideForm.psychologicalBreakingPoint}
              onChange={(e) =>
                setVoiceGuideForm((prev: NpcVoiceGuide) => ({
                  ...prev,
                  psychologicalBreakingPoint: e.target.value,
                }))
              }
              placeholder={isPersian ? 'هنگامی که جان همراهانش در خطر باشد یا رازش برملا گردد...' : 'When his comrades are threatened or his past dishonor is exposed...'}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
            >
              {isPersian ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 cursor-pointer shadow-lg shadow-purple-600/30 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isPersian ? 'ذخیره راهنمای گفتار' : 'Save Voice Guide'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
