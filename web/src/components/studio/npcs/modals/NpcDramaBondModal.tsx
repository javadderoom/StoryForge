'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { NPCDossier, NPCDramaBond, CustomRelationType } from '@/lib/types';

export interface NpcDramaBondModalProps {
  open: boolean;
  editingBond: NPCDramaBond | null;
  npcs: NPCDossier[];
  relationTypes?: CustomRelationType[];
  isPersian: boolean;
  onClose: () => void;
  onSave: (bond: NPCDramaBond) => void;
}

export function NpcDramaBondModal({
  open,
  editingBond,
  npcs,
  relationTypes,
  isPersian,
  onClose,
  onSave,
}: NpcDramaBondModalProps) {
  const [bondSourceId, setBondSourceId] = useState('');
  const [bondTargetId, setBondTargetId] = useState('');
  const [bondRelationType, setBondRelationType] = useState('blood_debt');
  const [bondAffinity, setBondAffinity] = useState<number>(0);
  const [bondSecretTension, setBondSecretTension] = useState('');
  const [bondIsPublic, setBondIsPublic] = useState(true);

  useEffect(() => {
    if (editingBond) {
      setBondSourceId(editingBond.sourceNpcId);
      setBondTargetId(editingBond.targetNpcId);
      setBondRelationType(editingBond.relationTypeId);
      setBondAffinity(editingBond.affinity);
      setBondSecretTension(editingBond.secretTension || '');
      setBondIsPublic(editingBond.isPublic);
    } else {
      setBondSourceId(npcs[0]?.id || '');
      setBondTargetId(npcs[1]?.id || '');
      setBondRelationType('blood_debt');
      setBondAffinity(-20);
      setBondSecretTension('');
      setBondIsPublic(false);
    }
  }, [editingBond, npcs, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bondSourceId || !bondTargetId || bondSourceId === bondTargetId) return;

    const bondPayload: NPCDramaBond = {
      id: editingBond ? editingBond.id : `bond_${Date.now().toString(36)}`,
      sourceNpcId: bondSourceId,
      targetNpcId: bondTargetId,
      relationTypeId: bondRelationType.trim() || 'ally',
      affinity: bondAffinity,
      secretTension: bondSecretTension.trim(),
      isPublic: bondIsPublic,
    };

    onSave(bondPayload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-rose-400" />
            {editingBond
              ? isPersian
                ? 'ویرایش پیوند درام شخصیتی'
                : 'Edit Interpersonal Drama Bond'
              : isPersian
              ? 'ثبت پیوند درام و تنش جدید'
              : 'Register New Drama Bond'}
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              {relationTypes && relationTypes.length > 0 ? (
                <input
                  list="relationTypesList"
                  type="text"
                  value={bondRelationType}
                  onChange={(e) => setBondRelationType(e.target.value)}
                  placeholder="e.g. blood_debt, mentor_apprentice"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                />
              ) : (
                <input
                  type="text"
                  value={bondRelationType}
                  onChange={(e) => setBondRelationType(e.target.value)}
                  placeholder="e.g. blood_debt, mentor_apprentice"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-400"
                />
              )}
              {relationTypes && relationTypes.length > 0 && (
                <datalist id="relationTypesList">
                  {relationTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name}
                    </option>
                  ))}
                </datalist>
              )}
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
                className="rounded accent-rose-500 w-4 h-4 cursor-pointer"
              />
              <span>{isPersian ? 'پیوند آشکار (سایرین از آن باخبرند)' : 'Publicly Known Relationship'}</span>
            </label>
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
              className="px-4 py-2 rounded-xl bg-rose-500 text-zinc-950 text-xs font-bold hover:bg-rose-400 cursor-pointer"
            >
              {editingBond
                ? isPersian
                  ? 'ذخیره پیوند'
                  : 'Update Bond'
                : isPersian
                ? 'ثبت پیوند'
                : 'Save Bond'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NpcDramaBondModal;
