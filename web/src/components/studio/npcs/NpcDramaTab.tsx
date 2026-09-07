import React from 'react';
import { ArrowLeftRight, Eye, Lock, Edit2, Trash2 } from 'lucide-react';
import { NPCDossier, NPCDramaBond } from '@/lib/types';
import { getAffinityBadge } from './npcBadges';

export interface NpcDramaTabProps {
  dramaBonds: NPCDramaBond[];
  npcs: NPCDossier[];
  isPersian: boolean;
  onEditBond: (bond: NPCDramaBond) => void;
  onDeleteBond: (bond: NPCDramaBond) => void;
}

export function NpcDramaTab({
  dramaBonds,
  npcs,
  isPersian,
  onEditBond,
  onDeleteBond,
}: NpcDramaTabProps) {
  if (dramaBonds.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {dramaBonds.map((bond: NPCDramaBond) => {
        const srcNpc = npcs.find((n) => n.id === bond.sourceNpcId);
        const tgtNpc = npcs.find((n) => n.id === bond.targetNpcId);
        const affinity = getAffinityBadge(bond.affinity, isPersian);

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
                    onClick={() => onEditBond(bond)}
                    className="text-zinc-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteBond(bond)}
                    className="text-zinc-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer"
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
      })}
    </div>
  );
}
