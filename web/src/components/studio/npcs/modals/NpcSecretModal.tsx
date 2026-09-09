'use client';

import React, { useState, useEffect } from 'react';
import { Lock, X, Plus, Trash2 } from 'lucide-react';
import { NPCDossier, SecretRevealMethod, SecretRevealMethodKind } from '@/lib/types';

type SecretForm = NPCDossier['secrets'][0];

const METHOD_KINDS: Array<{ kind: SecretRevealMethodKind; labelEn: string; labelFa: string }> = [
  { kind: 'trust', labelEn: 'Trust', labelFa: 'اعتماد' },
  { kind: 'pressure', labelEn: 'Pressure', labelFa: 'فشار' },
  { kind: 'item', labelEn: 'Item', labelFa: 'وسیله' },
  { kind: 'ritual', labelEn: 'Ritual / Surgery', labelFa: 'آیین / جراحی' },
  { kind: 'location', labelEn: 'Location', labelFa: 'مکان' },
  { kind: 'quest', labelEn: 'Quest', labelFa: 'مأموریت' },
  { kind: 'custom', labelEn: 'Custom', labelFa: 'سفارشی' },
];

function methodSummary(m: SecretRevealMethod, fallbackThreshold: number): string {
  switch (m.kind) {
    case 'trust':
      return `trust ${m.trustThreshold ?? fallbackThreshold}`;
    case 'pressure':
      return 'pressure';
    case 'item':
      return m.itemName || m.itemId || 'item';
    case 'ritual':
      return m.ritual || 'ritual';
    case 'location':
      return m.locationId || 'location';
    case 'quest':
      return m.questId || 'quest';
    case 'custom':
      return m.detail || 'custom';
    default:
      return m.kind;
  }
}

export interface NpcSecretModalProps {
  open: boolean;
  targetNpcId?: string | null;
  editingSecret: NPCDossier['secrets'][0] | null;
  isPersian: boolean;
  cancelLabel?: string;
  saveLabel?: string;
  onClose: () => void;
  onSave: (secret: NPCDossier['secrets'][0]) => void;
}

export function NpcSecretModal({
  open,
  targetNpcId,
  editingSecret,
  isPersian,
  cancelLabel,
  saveLabel,
  onClose,
  onSave,
}: NpcSecretModalProps) {
  const [secretForm, setSecretForm] = useState<SecretForm>({
    id: '',
    description: '',
    requiredTrustLevel: 20,
    revealed: false,
    revealMethods: [],
  });
  const [newMethodKind, setNewMethodKind] =
    useState<SecretRevealMethodKind>('pressure');

  useEffect(() => {
    if (editingSecret) {
      setSecretForm({
        ...editingSecret,
        revealMethods: [...(editingSecret.revealMethods || [])],
      });
    } else {
      setSecretForm({
        id: `secret_${Date.now().toString(36)}`,
        description: '',
        requiredTrustLevel: 20,
        revealed: false,
        revealMethods: [],
      });
    }
    setNewMethodKind('pressure');
  }, [editingSecret, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!(secretForm.description || '').trim()) return;
    onSave({
      ...secretForm,
      description: (secretForm.description || '').trim(),
    });
    onClose();
  };

  const finalCancelLabel = cancelLabel || (isPersian ? 'انصراف' : 'Cancel');
  const finalSaveLabel = saveLabel || (isPersian ? 'ذخیره' : 'Save');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-400" />
            {editingSecret
              ? isPersian
                ? 'ویرایش راز'
                : 'Edit Secret'
              : isPersian
              ? 'افزودن راز جدید'
              : 'Add Secret'}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder={isPersian ? 'این شخصیت چه رازی را پنهان می‌کند؟' : 'What is this NPC concealing?'}
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
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Reveal methods: OR-list, each entry sufficient on its own */}
          <div>
            <label className="block text-xs text-zinc-300 font-bold mb-1.5">
              {isPersian
                ? 'راه‌های افشا (خالی = فقط آستانه اعتماد؛ هر مورد به‌تنهایی کافی است)'
                : 'Ways to uncover (empty = trust threshold only; each entry suffices alone)'}
            </label>
            <div className="space-y-1.5">
              {(secretForm.revealMethods || []).map((m, mIdx) => (
                <div
                  key={mIdx}
                  className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <select
                      value={m.kind}
                      onChange={(e) => {
                        const kind = e.target.value as SecretRevealMethodKind;
                        setSecretForm((prev) => ({
                          ...prev,
                          revealMethods: (prev.revealMethods || []).map((x, idx) =>
                            idx === mIdx ? { kind } : x
                          ),
                        }));
                      }}
                      className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-200 focus:outline-none"
                    >
                      {METHOD_KINDS.map(({ kind, labelEn, labelFa }) => (
                        <option key={kind} value={kind}>
                          {isPersian ? labelFa : labelEn}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10.5px] text-zinc-500 font-mono flex-1 truncate">
                      {methodSummary(m, secretForm.requiredTrustLevel)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSecretForm((prev) => ({
                          ...prev,
                          revealMethods: (prev.revealMethods || []).filter((_, idx) => idx !== mIdx),
                        }))
                      }
                      className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {m.kind === 'trust' && (
                    <input
                      type="number"
                      min="-100"
                      max="100"
                      value={m.trustThreshold ?? secretForm.requiredTrustLevel}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setSecretForm((prev) => ({
                          ...prev,
                          revealMethods: (prev.revealMethods || []).map((x, idx) =>
                            idx === mIdx ? { ...x, trustThreshold: val } : x
                          ),
                        }));
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 font-mono focus:outline-none"
                    />
                  )}
                  {['item', 'ritual', 'location', 'quest', 'custom'].includes(m.kind) && (
                    <input
                      type="text"
                      value={
                        m.kind === 'item'
                          ? m.itemName || m.itemId || ''
                          : m.kind === 'ritual'
                            ? m.ritual || ''
                            : m.kind === 'location'
                              ? m.locationId || ''
                              : m.kind === 'quest'
                                ? m.questId || ''
                                : m.detail || ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setSecretForm((prev) => ({
                          ...prev,
                          revealMethods: (prev.revealMethods || []).map((x, idx) => {
                            if (idx !== mIdx) return x;
                            if (m.kind === 'item') return { ...x, itemName: val };
                            if (m.kind === 'ritual') return { ...x, ritual: val };
                            if (m.kind === 'location') return { ...x, locationId: val };
                            if (m.kind === 'quest') return { ...x, questId: val };
                            return { ...x, detail: val };
                          }),
                        }));
                      }}
                      placeholder={
                        m.kind === 'item'
                          ? isPersian
                            ? 'نام یا شناسه وسیله (مثلا کیف جراحی)...'
                            : 'Item name or id (e.g. surgical kit)...'
                          : m.kind === 'ritual'
                            ? isPersian
                              ? 'نام آیین (مثلا جراحی)...'
                              : 'Rite name (e.g. surgery)...'
                            : m.kind === 'location'
                              ? isPersian
                                ? 'شناسه مکان...'
                                : 'Location id...'
                              : m.kind === 'quest'
                                ? isPersian
                                  ? 'شناسه مأموریت...'
                                  : 'Quest id...'
                                : isPersian
                                  ? 'قاعده سفارشی (مثلا فقط در خواب)...'
                                  : 'Custom rule (e.g. only while sedated)...'
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-100 focus:outline-none"
                    />
                  )}
                  {['ritual', 'location', 'custom'].includes(m.kind) && (
                    <input
                      type="text"
                      value={m.detail || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSecretForm((prev) => ({
                          ...prev,
                          revealMethods: (prev.revealMethods || []).map((x, idx) =>
                            idx === mIdx ? { ...x, detail: val || undefined } : x
                          ),
                        }));
                      }}
                      placeholder={isPersian ? 'یادداشت برای راوی (مثلا در کلینیک، بیمار بیهوش)...' : 'Narrator note (e.g. at the clinic, patient sedated)...'}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-400 focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <select
                value={newMethodKind}
                onChange={(e) => setNewMethodKind(e.target.value as SecretRevealMethodKind)}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-2 py-1.5 text-xs text-zinc-300 focus:outline-none"
              >
                {METHOD_KINDS.map(({ kind, labelEn, labelFa }) => (
                  <option key={kind} value={kind}>
                    {isPersian ? labelFa : labelEn}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setSecretForm((prev) => ({
                    ...prev,
                    revealMethods: [...(prev.revealMethods || []), { kind: newMethodKind }],
                  }));
                }}
                className="px-3 py-1.5 bg-zinc-800 text-zinc-200 text-xs font-bold rounded-xl hover:bg-zinc-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{isPersian ? '+ راه افشا' : '+ Add way'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-bold hover:bg-zinc-700 cursor-pointer"
            >
              {finalCancelLabel}
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-500 text-zinc-950 text-xs font-bold hover:bg-rose-400 cursor-pointer"
            >
              {finalSaveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NpcSecretModal;
