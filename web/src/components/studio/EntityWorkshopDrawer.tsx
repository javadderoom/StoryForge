'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Sparkles, Send, Loader2, Wand2 } from 'lucide-react';
import {
  parseActionBlocks,
  nameMatch,
  type EntityType,
} from '@/lib/engines/world/ActionProtocol';

export interface WorkshopEntity {
  type: EntityType;
  id: string;
  name: string;
  data: unknown;
}

interface EntityWorkshopDrawerProps {
  open: boolean;
  entity: WorkshopEntity | null;
  worldContext: string;
  isPersian: boolean;
  themeContext?: string;
  onClose: () => void;
  onApplyUpdate: (entity: WorkshopEntity, data: unknown) => void;
}

interface WMsg {
  role: 'user' | 'assistant';
  content: string;
  applied?: boolean;
}

export default function EntityWorkshopDrawer({
  open,
  entity,
  worldContext,
  isPersian,
  themeContext = '',
  onClose,
  onApplyUpdate,
}: EntityWorkshopDrawerProps) {
  const [messages, setMessages] = useState<WMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  if (!open || !entity) return null;

  const t = isPersian
    ? {
        title: 'کارگاه موجودیت',
        sub: 'گفت‌وگوی زنده برای پالایش این موجودیت',
        placeholder: 'بخواه ویژگی‌ها را بنویسد، لحن را عوض کند یا تضادی بیابد…',
        send: 'ارسال',
        thinking: 'در حال پالایش…',
        apply: 'اعمال روی موجودیت',
        applied: 'اعمال شد',
        empty: 'از دانا بخواه این موجودیت را پالایش کند.',
      }
    : {
        title: 'Entity Workshop',
        sub: 'Live conversational polish for this entity',
        placeholder: 'Ask it to rewrite traits, shift tone, or find a contradiction…',
        send: 'Send',
        thinking: 'Polishing…',
        apply: 'Apply to entity',
        applied: 'Applied',
        empty: 'Ask the Oracle to refine this entity.',
      };

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: WMsg[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          worldContext,
          isPersian,
          persona: 'oracle',
          activeEntityContext: JSON.stringify(entity!.data, null, 2),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setMessages([...next, { role: 'assistant', content: json.error || t.thinking }]);
        return;
      }
      const blocks = parseActionBlocks(json.reply);
      const targetBlock = blocks.find(
        (b) =>
          (b.op === 'update' || b.op === 'delete') &&
          b.match &&
          nameMatch(b.match.byName, entity!.name)
      );
      if (targetBlock && targetBlock.op === 'update' && targetBlock.prompt) {
        const editPrompt = `Current entity JSON:\n${JSON.stringify(
          entity!.data,
          null,
          2
        )}\n\nRequested changes to apply:\n${targetBlock.prompt}\n\nReturn the COMPLETE updated entity as a JSON object with ALL original fields preserved and only the requested changes applied. Output valid JSON only.`;
        const editSystem = isPersian
          ? 'تو در حال ویرایش یک موجودیت موجود هستی. خروجی را به صورت شیء JSON کامل شامل تمام فیلدهای پیشین (با اعمال تغییرات) برگردان. نام و شناسه را حفظ کن. فقط JSON معتبر خروجی بده.\n\n'
          : 'You are editing an EXISTING world entity. Return the COMPLETE updated entity as a JSON object with ALL original fields preserved and only the requested changes applied. Preserve name and id. Output valid JSON only.\n\n';
        const gen = await fetch('/api/studio/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: entity!.type,
            prompt: targetBlock.prompt,
            worldContext,
            isPersian,
            themeContext,
            customSystemPrompt: editSystem + editPrompt,
          }),
        });
        const genJson = await gen.json();
        if (genJson.success && genJson.data) {
          const base = (entity!.data ?? {}) as Record<string, unknown>;
          const genData = (genJson.data ?? {}) as Record<string, unknown>;
          const merged = { ...base, ...genData, id: entity!.id };
          onApplyUpdate(entity!, merged);
          setMessages([
            ...next,
            {
              role: 'assistant',
              content: json.reply.replace(/```[\s\S]*?```/g, '').trim() || t.applied,
              applied: true,
            },
          ]);
          return;
        }
      }
      const clean = json.reply.replace(/```[\s\S]*?```/g, '').trim();
      setMessages([...next, { role: 'assistant', content: clean }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: t.thinking }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-[#0c0d14] border-l border-zinc-800/80 flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center">
            <Wand2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-100 truncate">{t.title}</h3>
            <p className="text-[11px] text-zinc-400 truncate">
              {entity.type} · {entity.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-zinc-800/60">
          <pre className="text-[10px] text-zinc-400 max-h-32 overflow-auto whitespace-pre-wrap bg-zinc-950/60 rounded-lg p-2">
            {JSON.stringify(entity.data, null, 2)}
          </pre>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" dir={isPersian ? 'rtl' : 'ltr'}>
          {messages.length === 0 && (
            <div className="text-center text-zinc-500 text-xs mt-10">
              <Sparkles className="h-6 w-6 mx-auto mb-2 text-amber-300/70" />
              {t.empty}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? (isPersian ? 'justify-start' : 'justify-end') : isPersian ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-amber-500/20 text-amber-50 border border-amber-500/30'
                    : 'bg-zinc-800/70 text-zinc-100 border border-zinc-700/60'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.applied && (
                  <div className="mt-1 text-[10px] text-emerald-300 font-semibold">✓ {t.applied}</div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-3 py-2 bg-zinc-800/70 text-xs text-zinc-400 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t.thinking}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800/80 p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              rows={1}
              placeholder={t.placeholder}
              className="flex-1 resize-none rounded-xl bg-zinc-900/80 border border-zinc-700/60 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={busy || !input.trim()}
              className="h-9 px-3 rounded-xl bg-amber-500 text-zinc-950 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
