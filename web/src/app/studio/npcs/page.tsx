'use client';

import React from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { User, MessageSquare, Lock, Heart } from 'lucide-react';

export default function NpcDossiersPage() {
  const { story, isPersian } = useStudioStory();

  const t = {
    heading: isPersian ? 'پرونده‌ها و اسرار شخصیت‌ها (NPC)' : 'NPC Dossiers & Secret Matrices',
    subheading: isPersian
      ? 'دستورالعمل‌های گفتاری، سطوح اعتماد اولیه و اسرار پنهان شخصیت‌ها'
      : 'Character speech directives, baseline trust thresholds, and unlockable secrets.',
    trust: isPersian ? 'اعتماد اولیه:' : 'Initial Trust:',
    speechDirectives: isPersian ? 'دستورالعمل لحن گفتار:' : 'Speech & Voice Directives:',
    hiddenSecrets: isPersian ? 'اسرار پنهان و شرایط افشا' : 'Hidden Secrets & Unlock Triggers',
    requiresTrust: isPersian ? 'نیاز به اعتماد' : 'Requires Trust ≥',
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
        <span className="text-xs bg-zinc-800 border border-zinc-700/80 text-zinc-300 px-3.5 py-1.5 rounded-xl font-mono">
          {story.worldBible.npcs.length} {isPersian ? 'شخصیت ثبت‌شده' : 'Registered NPCs'}
        </span>
      </div>

      {/* NPC Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {story.worldBible.npcs.map((npc) => (
          <div
            key={npc.id}
            className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-zinc-700 transition-all"
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300 text-lg">
                    {npc.name[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-100">{npc.name}</h3>
                    <p className="text-xs text-amber-400 font-medium">{npc.title}</p>
                  </div>
                </div>
                <span className="text-xs bg-zinc-800/90 text-zinc-300 px-3 py-1 rounded-xl border border-zinc-700/60 flex items-center gap-1.5 font-mono">
                  <Heart className="w-3 h-3 text-rose-400 fill-rose-400/20" />
                  {t.trust} {npc.initialTrust}
                </span>
              </div>

              {/* Speech Directives */}
              <div className="p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 text-xs text-zinc-300 space-y-1">
                <div className="font-bold text-zinc-400 flex items-center gap-1.5 mb-1">
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                  {t.speechDirectives}
                </div>
                <p className="text-zinc-400 italic leading-relaxed">&ldquo;{npc.speechStyle}&rdquo;</p>
              </div>

              {/* Secrets */}
              <div className="mt-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-400" /> {t.hiddenSecrets}
                </h4>
                <div className="space-y-2">
                  {npc.secrets.map((s) => (
                    <div
                      key={s.id}
                      className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/15 text-xs text-rose-200/90 flex items-start gap-2.5"
                    >
                      <span className="text-sm">🔒</span>
                      <div className="flex-1">
                        <div>{s.description}</div>
                        <span className="inline-block mt-1 text-[10px] text-rose-400 font-mono font-semibold">
                          ({t.requiresTrust} {s.requiredTrustLevel})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-zinc-800/60 text-[11px] text-zinc-500 font-mono flex justify-between">
              <span>ID: {npc.id}</span>
              <span>Loc: {npc.currentLocationId}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
