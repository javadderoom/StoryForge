'use client';

import React, { useState, useEffect } from 'react';
import { Lock, X } from 'lucide-react';
import { NPCDossier } from '@/lib/types';

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
  const [secretForm, setSecretForm] = useState<NPCDossier['secrets'][0]>({
    id: '',
    description: '',
    requiredTrustLevel: 20,
    revealed: false,
  });

  useEffect(() => {
    if (editingSecret) {
      setSecretForm({ ...editingSecret });
    } else {
      setSecretForm({
        id: `secret_${Date.now().toString(36)}`,
        description: '',
        requiredTrustLevel: 20,
        revealed: false,
      });
    }
  }, [editingSecret, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretForm.description.trim()) return;
    onSave(secretForm);
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
