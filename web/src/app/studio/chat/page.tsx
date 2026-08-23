'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import {
  MessageSquare,
  Send,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';

type EntityType =
  | 'faction'
  | 'location'
  | 'npc'
  | 'artifact'
  | 'creature'
  | 'deity'
  | 'timeline_event'
  | 'world_law';

const ALLOWED_ENTITIES: EntityType[] = [
  'faction',
  'location',
  'npc',
  'artifact',
  'creature',
  'deity',
  'timeline_event',
  'world_law',
];

// Map natural-language names the model may use to canonical entity types.
const ENTITY_ALIASES: Record<string, EntityType> = {
  faction: 'faction',
  organization: 'faction',
  organisation: 'faction',
  order: 'faction',
  guild: 'faction',
  location: 'location',
  place: 'location',
  region: 'location',
  area: 'location',
  npc: 'npc',
  character: 'npc',
  person: 'npc',
  artifact: 'artifact',
  relic: 'artifact',
  item: 'artifact',
  creature: 'creature',
  monster: 'creature',
  beast: 'creature',
  deity: 'deity',
  religion: 'deity',
  religions: 'deity',
  god: 'deity',
  gods: 'deity',
  goddess: 'deity',
  pantheon: 'deity',
  divinity: 'deity',
  faith: 'deity',
  cult: 'deity',
  timeline_event: 'timeline_event',
  event: 'timeline_event',
  timeline: 'timeline_event',
  era: 'timeline_event',
  world_law: 'world_law',
  law: 'world_law',
  rule: 'world_law',
};

function normalizeEntityName(raw: any): EntityType | null {
  if (typeof raw !== 'string') return null;
  return ENTITY_ALIASES[raw.trim().toLowerCase()] || null;
}

interface ActionBlock {
  op: 'create' | 'update' | 'delete';
  entity: EntityType;
  prompt?: string;
  anchor?: string;
  match?: { byName: string };
}

interface AppliedAction {
  ok: boolean;
  op: 'create' | 'update' | 'delete';
  entity: EntityType;
  label: string;
  error?: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  actions?: AppliedAction[];
  skipped?: boolean;
}

interface AiChatConversation {
  id: string;
  title: string;
  messages: ChatMsg[];
  createdAt: number;
  updatedAt: number;
}

function nameOf(entity: EntityType, item: any): string {
  if (!item) return '';
  return item.name ?? item.title ?? item.rule ?? item.yearOrEra ?? '';
}

function nameMatch(a: string, b: string): boolean {
  const x = (a || '').toString().trim().toLowerCase();
  const y = (b || '').toString().trim().toLowerCase();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function normalizeEntity(entity: EntityType, data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (!data.id) {
    const prefix: Record<EntityType, string> = {
      faction: 'fac',
      location: 'loc',
      npc: 'npc',
      artifact: 'art',
      creature: 'creature',
      deity: 'deity',
      timeline_event: 'evt',
      world_law: 'law',
    };
    data.id = `${prefix[entity]}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
  return data;
}

function chatStorageKey(storyId: string): string {
  return `storyforge_chats_${storyId}`;
}

function ChatList({
  chats,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  isPersian,
}: {
  chats: AiChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
  isPersian: boolean;
}) {
  return (
    <div className="w-64 shrink-0 h-full flex flex-col bg-[#0c0d14] border-r border-zinc-800/80">
      <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between">
        <span className="text-xs font-bold text-zinc-300">
          {isPersian ? 'گفت‌وگوها' : 'Conversations'}
        </span>
        <div className="flex items-center gap-1">
          {onClose && (
            <button onClick={onClose} className="md:hidden p-1 text-zinc-400 hover:text-zinc-200" title="Close">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onNew}
            className="p-1.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
            title={isPersian ? 'گفت‌وگوی تازه' : 'New chat'}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {chats.length === 0 && (
          <div className="text-[11px] text-zinc-500 p-3 text-center">
            {isPersian ? 'هنوز گفت‌وگویی نیست' : 'No conversations yet'}
          </div>
        )}
        {chats.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`group flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-colors ${
              c.id === activeId
                ? 'bg-amber-500/15 text-amber-200'
                : 'hover:bg-zinc-800/60 text-zinc-300'
            }`}
          >
            <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">
                {c.title || (isPersian ? 'گفت‌وگوی تازه' : 'New chat')}
              </div>
              {c.messages.length > 0 && (
                <div className="text-[10px] text-zinc-500 truncate">
                  {c.messages[c.messages.length - 1].content}
                </div>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(c.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-opacity"
              title={isPersian ? 'حذف گفت‌وگو' : 'Delete conversation'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AiOraclePage() {
  const {
    story,
    isPersian,
    addFaction,
    editFaction,
    deleteFaction,
    addLocation,
    editLocation,
    deleteLocation,
    addNpc,
    editNpc,
    deleteNpc,
    addArtifact,
    editArtifact,
    deleteArtifact,
    addCreature,
    editCreature,
    deleteCreature,
    addDeity,
    editDeity,
    deleteDeity,
    addTimelineEvent,
    editTimelineEvent,
    deleteTimelineEvent,
    addWorldLaw,
    editWorldLaw,
    deleteWorldLaw,
  } = useStudioStory();

  const worldContext = useMemo(() => buildWorldContextString(story), [story]);

  const [chats, setChats] = useState<AiChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [allowEdit, setAllowEdit] = useState(true);
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [persistKey, setPersistKey] = useState<string>(() => chatStorageKey(story.id));
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversations for the active story
  useEffect(() => {
    const key = chatStorageKey(story.id);
    let arr: AiChatConversation[] = [];
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      arr = Array.isArray(parsed) ? (parsed as AiChatConversation[]) : [];
    } catch {
      arr = [];
    }
    setChats(arr);
    setActiveId(arr.length ? arr[0].id : null);
    setPersistKey(key);
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  // Persist conversations for the active story (only after initial load)
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(persistKey, JSON.stringify(chats));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [chats, persistKey, loaded]);

  const activeChat = chats.find((c) => c.id === activeId) || null;
  const messages = activeChat?.messages || [];

  const t = isPersian
    ? {
        heading: 'مشاور هوش مصنوعی',
        subheading: 'گفت‌وگو با دانای جهان‌سازی بر پایه کتاب مقدس جهان شما.',
        placeholder: 'درباره جهانت بپرس، یا بخواه چیزی بسازد، ویرایش یا حذف کند…',
        send: 'ارسال',
        thinking: 'مشاور در حال اندیشیدن…',
        editToggle: 'هوش مصنوعی اجازه دارد جهان را ویرایش کند',
        emptyTitle: 'مشاور جهان‌سازی آماده است',
        emptyBody: 'بپرس «فactionهای مرا خلاصه کن» یا بگو «یک جناح قاچاقچی بساز».',
        errorConn: 'خطا در ارتباط با مدل.',
        created: 'افزوده شد',
        updated: 'ویرایش شد',
        deleted: 'حذف شد',
        skipped: 'ویرایش غیرفعال بود — رد شد',
        notFound: 'موجودیت یافت نشد',
        failed: 'عملیات ناموفق',
      }
    : {
        heading: 'AI Oracle',
        subheading: 'Converse with your World-Building Oracle, grounded in your world bible.',
        placeholder: 'Ask about your world, or ask it to create, edit, or delete something…',
        send: 'Send',
        thinking: 'The Oracle is thinking…',
        editToggle: 'AI may edit my world',
        emptyTitle: 'The World-Building Oracle is ready',
        emptyBody: 'Ask "Summarize my factions" or say "Create a smuggler faction".',
        errorConn: 'Connection error.',
        created: 'Created',
        updated: 'Updated',
        deleted: 'Deleted',
        skipped: 'Editing disabled — skipped',
        notFound: 'Entity not found',
        failed: 'Action failed',
      };

  const ENTITY_LABELS: Record<EntityType, string> = isPersian
    ? {
        faction: 'جناح',
        location: 'مکان',
        npc: 'شخصیت',
        artifact: 'عتیقه',
        creature: 'موجود',
        deity: 'ایزد',
        timeline_event: 'رویداد',
        world_law: 'قانون',
      }
    : {
        faction: 'Faction',
        location: 'Location',
        npc: 'NPC',
        artifact: 'Artifact',
        creature: 'Creature',
        deity: 'Deity',
        timeline_event: 'Event',
        world_law: 'Law',
      };

  const MUTATORS: Record<
    EntityType,
    { add: (e: any) => void; edit: (id: string, u: any) => void; del: (id: string) => void }
  > = {
    faction: { add: addFaction, edit: editFaction, del: deleteFaction },
    location: { add: addLocation, edit: editLocation, del: deleteLocation },
    npc: { add: addNpc, edit: editNpc, del: deleteNpc },
    artifact: { add: addArtifact, edit: editArtifact, del: deleteArtifact },
    creature: { add: addCreature, edit: editCreature, del: deleteCreature },
    deity: { add: addDeity, edit: editDeity, del: deleteDeity },
    timeline_event: { add: addTimelineEvent, edit: editTimelineEvent, del: deleteTimelineEvent },
    world_law: { add: addWorldLaw, edit: editWorldLaw, del: deleteWorldLaw },
  };

  function getEntityArray(entity: EntityType): any[] {
    const wb = story.worldBible;
    switch (entity) {
      case 'faction':
        return wb.factions || [];
      case 'location':
        return wb.locations || [];
      case 'npc':
        return wb.npcs || [];
      case 'artifact':
        return wb.artifacts || [];
      case 'creature':
        return wb.bestiary || [];
      case 'deity':
        return wb.religions || [];
      case 'timeline_event':
        return wb.timeline || [];
      case 'world_law':
        return wb.laws || [];
      default:
        return [];
    }
  }

  // Resolve an existing entity from a (possibly loose) reference like
  // "first god", "the second deity", "Sovereign of Fire", or a number.
  function resolveTarget(entity: EntityType, byName: string): any | undefined {
    const arr = getEntityArray(entity);
    const searchable = (it: any) =>
      `${nameOf(entity, it)} ${it?.title || ''} ${it?.domain || ''} ${it?.name || ''}`.trim();
    let found = arr.find((it) => nameMatch(searchable(it), byName));
    if (found) return found;
    const stripped = byName
      .replace(
        /\b(first|second|third|fourth|fifth|sixth|seventh|last|\d{1,2}(?:st|nd|rd|th))\b/gi,
        ''
      )
      .replace(/\b(god|gods|deity|deities|religion|religions|pantheon|the)\b/gi, '')
      .trim();
    if (stripped && stripped.toLowerCase() !== byName.toLowerCase()) {
      found = arr.find((it) => nameMatch(searchable(it), stripped));
      if (found) return found;
    }
    const ord = parseOrdinal(byName);
    if (ord !== null) {
      const i = ord < 0 ? arr.length + ord : ord;
      if (i >= 0 && i < arr.length) return arr[i];
    }
    return undefined;
  }

  function parseOrdinal(text: string): number | null {
    const t = text.toLowerCase();
    const map: Record<string, number> = {
      first: 0,
      second: 1,
      third: 2,
      fourth: 3,
      fifth: 4,
      sixth: 5,
      seventh: 6,
      last: -1,
      '1st': 0,
      '2nd': 1,
      '3rd': 2,
      '4th': 3,
      '5th': 4,
      '6th': 5,
      '7th': 6,
    };
    for (const k of Object.keys(map)) if (t.includes(k)) return map[k];
    const m = t.match(/\b(\d{1,2})\b/);
    if (m) return parseInt(m[1], 10) - 1;
    return null;
  }

  const quickPrompts: string[] = isPersian
    ? [
        'فactionهای مرا خلاصه کن',
        'چه خلأهایی در جهانم وجود دارد؟',
        'یک جناح قاچاقچی بندری بساز',
        'یک تعارض میان دو جناح پیشنهاد بده',
        'یک قانون جادویی تازه وضع کن',
      ]
    : [
        'Summarize my factions',
        'What gaps exist in my world?',
        'Create a harbor smuggler faction',
        'Propose a conflict between two factions',
        'Institute a new magical law',
      ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function parseActions(reply: string): { actions: ActionBlock[]; clean: string } {
    const actions: ActionBlock[] = [];
    const matches = [
      ...reply.matchAll(/```(?:storyforge-action|json|jsonc)?\s*\n([\s\S]*?)```/g),
    ];
    for (const mt of matches) {
      try {
        const obj = JSON.parse(mt[1]);
        const validOp = obj.op === 'create' || obj.op === 'update' || obj.op === 'delete';
        let entity = normalizeEntityName(obj.entity);
        // If the model omitted the entity (common for update/delete), infer it
        // from the referenced name across all saved entity types.
        if (
          !entity &&
          (obj.op === 'update' || obj.op === 'delete') &&
          obj.match &&
          typeof obj.match.byName === 'string'
        ) {
          for (const t of ALLOWED_ENTITIES) {
            if (
              getEntityArray(t).some((it) => nameMatch(nameOf(t, it), obj.match.byName))
            ) {
              entity = t;
              break;
            }
          }
        }
        const validEntity = !!entity;
        const hasTarget =
          obj.op === 'create'
            ? typeof obj.prompt === 'string'
            : !!(obj.match && typeof obj.match.byName === 'string');
        if (validOp && validEntity && hasTarget) {
          actions.push({ ...obj, entity } as ActionBlock);
        }
      } catch {
        /* ignore malformed block */
      }
    }
    const clean = reply.replace(/```(?:storyforge-action|json|jsonc)?\s*\n[\s\S]*?```/g, '').trim();
    return { actions, clean };
  }

  async function executeActions(
    actions: ActionBlock[],
    userMessageFallback?: string
  ): Promise<{ results: AppliedAction[]; skipped: boolean }> {
    if (!allowEdit) {
      return {
        results: actions.map((a) => ({
          ok: false,
          op: a.op,
          entity: a.entity,
          label: a.match?.byName || a.prompt || ENTITY_LABELS[a.entity],
          error: t.skipped,
        })),
        skipped: true,
      };
    }

    const results: AppliedAction[] = [];
    for (const a of actions) {
      const cfg = MUTATORS[a.entity];
      const labelOf = (item: any) => `${ENTITY_LABELS[a.entity]}: ${nameOf(a.entity, item)}`;
      try {
        if (a.op === 'create') {
          const res = await fetch('/api/studio/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: a.entity,
              prompt: a.prompt || userMessageFallback,
              worldContext,
              isPersian,
              anchor: a.anchor,
            }),
          });
          const json = await res.json();
          if (!json.success || !json.data) throw new Error(json.error || t.failed);
          const data = normalizeEntity(a.entity, json.data);
          cfg.add(data);
          results.push({ ok: true, op: 'create', entity: a.entity, label: labelOf(data) });
        } else if (a.op === 'update' || a.op === 'delete') {
          const target = resolveTarget(a.entity, a.match!.byName);
          if (!target) throw new Error(t.notFound);
          if (a.op === 'delete') {
            cfg.del(target.id);
            results.push({
              ok: true,
              op: 'delete',
              entity: a.entity,
              label: `${ENTITY_LABELS[a.entity]}: ${nameOf(a.entity, target)}`,
            });
          } else {
            const changeBrief = a.prompt?.trim()
              ? `${a.prompt.trim()}${
                  userMessageFallback && userMessageFallback !== a.prompt
                    ? `\n\nOriginal user request:\n${userMessageFallback}`
                    : ''
                }`
              : userMessageFallback || 'Update entity based on user prompt';

            const editPrompt = `Current entity JSON:\n${JSON.stringify(
              target,
              null,
              2
            )}\n\nRequested changes to apply:\n${changeBrief}\n\nReturn the COMPLETE updated entity as a JSON object with ALL original fields preserved and only the requested changes applied. Output valid JSON only matching the entity schema.`;
            const editSystem = isPersian
              ? 'تو در حال ویرایش یک موجودیت موجود هستی. خروجی را به صورت شیء JSON کامل شامل تمام فیلدهای پیشین (با اعمال تغییرات) برگردان. نام و شناسه را حفظ کن. فقط JSON معتبر خروجی بده.\n\n'
              : 'You are editing an EXISTING world entity. Return the COMPLETE updated entity as a JSON object with ALL original fields preserved and only the requested changes applied. Preserve name and id. Output valid JSON only.\n\n';
            const res = await fetch('/api/studio/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: a.entity,
                prompt: changeBrief,
                worldContext,
                isPersian,
                // NOTE: the generate route overrides its system prompt with
                // customSystemPrompt, so the edit brief MUST live here or the
                // model never sees what to change.
                customSystemPrompt: editSystem + editPrompt,
              }),
            });
            const json = await res.json();
            if (!json.success || !json.data) throw new Error(json.error || t.failed);
            const merged = { ...target, ...json.data, id: target.id };
            const data = normalizeEntity(a.entity, merged);
            cfg.edit(target.id, data);
            results.push({ ok: true, op: 'update', entity: a.entity, label: labelOf(data) });
          }
        }
      } catch (e: any) {
        results.push({
          ok: false,
          op: a.op,
          entity: a.entity,
          label: a.match?.byName || a.prompt || ENTITY_LABELS[a.entity],
          error: e?.message || t.failed,
        });
      }
    }
    return { results, skipped: false };
  }

  function updateChatMessages(id: string, msgs: ChatMsg[], titleOverride?: string) {
    setChats((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, messages: msgs, title: titleOverride ?? c.title, updatedAt: Date.now() }
          : c
      )
    );
  }

  function newChat() {
    const id = `chat_${Date.now().toString(36)}`;
    const fresh: AiChatConversation = {
      id,
      title: isPersian ? 'گفت‌وگوی تازه' : 'New chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChats((prev) => [fresh, ...prev]);
    setActiveId(id);
    setMobileListOpen(false);
  }

  function deleteChat(id: string) {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) setActiveId(next.length ? next[0].id : null);
      return next;
    });
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const isNew = !activeId;
    const chatId = activeId || `chat_${Date.now().toString(36)}`;
    const userMsg: ChatMsg = { role: 'user', content: trimmed };
    const next: ChatMsg[] = [...(activeChat?.messages || []), userMsg];
    setChats((prev) => {
      const base = isNew
        ? [
            {
              id: chatId,
              title: trimmed.slice(0, 48),
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as AiChatConversation,
            ...prev,
          ]
        : prev;
      return base.map((c) =>
        c.id === chatId
          ? {
              ...c,
              messages: [...(c.messages || []), userMsg],
              title: (c.messages?.length || 0) === 0 ? trimmed.slice(0, 48) : c.title,
              updatedAt: Date.now(),
            }
          : c
      );
    });
    if (isNew) setActiveId(chatId);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, worldContext, isPersian }),
      });
      const json = await res.json();
      if (!json.success) {
        updateChatMessages(chatId, [
          ...next,
          { role: 'assistant', content: json.error || t.errorConn },
        ]);
        return;
      }
      const { actions, clean } = parseActions(json.reply);
      let applied: AppliedAction[] = [];
      let skipped = false;
      if (actions.length) {
        const ex = await executeActions(actions, trimmed);
        applied = ex.results;
        skipped = ex.skipped;
      }
      const failed = applied.filter((a) => !a.ok);
      let content = clean || (actions.length ? '(applied)' : json.reply);
      if (failed.length) {
        const list = failed.map((f) => `• ${f.label}: ${f.error}`).join('\n');
        content +=
          (isPersian
            ? '\n\n⚠️ برخی تغییرات اعمال نشد:\n'
            : '\n\n⚠️ Some changes could NOT be applied:\n') + list;
      }
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content,
        actions: applied,
        skipped,
      };
      updateChatMessages(chatId, [...next, assistantMsg]);
    } catch {
      updateChatMessages(chatId, [...next, { role: 'assistant', content: t.errorConn }]);
    } finally {
      setLoading(false);
    }
  }

  const opWord = (op: 'create' | 'update' | 'delete') =>
    op === 'create' ? t.created : op === 'update' ? t.updated : t.deleted;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">
      {/* Conversation list (desktop) */}
      <ChatList
        chats={chats}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          setMobileListOpen(false);
        }}
        onNew={newChat}
        onDelete={deleteChat}
        isPersian={isPersian}
      />

      {/* Conversation list (mobile drawer) */}
      {mobileListOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileListOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0">
            <ChatList
              chats={chats}
              activeId={activeId}
              onSelect={(id) => {
                setActiveId(id);
                setMobileListOpen(false);
              }}
              onNew={newChat}
              onDelete={deleteChat}
              onClose={() => setMobileListOpen(false)}
              isPersian={isPersian}
            />
          </div>
        </div>
      )}

      {/* Conversation panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-zinc-800/70 px-4 md:px-6 py-3 flex items-center gap-3">
          <button
            className="md:hidden p-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800"
            onClick={() => setMobileListOpen(true)}
            title={isPersian ? 'گفت‌وگوها' : 'Conversations'}
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="h-9 w-9 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">{t.heading}</h1>
            <p className="text-[11px] text-zinc-400">{t.subheading}</p>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-4"
          dir={isPersian ? 'rtl' : 'ltr'}
        >
          {messages.length === 0 && (
            <div className="max-w-2xl mx-auto text-center mt-10">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-300 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-semibold text-zinc-100">{t.emptyTitle}</h2>
              <p className="text-zinc-400 mt-2">{t.emptyBody}</p>
              <div className="flex flex-wrap gap-2 justify-center mt-5">
                {quickPrompts.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="px-3 py-1.5 rounded-full text-xs bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === 'user'
                  ? isPersian
                    ? 'justify-start'
                    : 'justify-end'
                  : isPersian
                    ? 'justify-end'
                    : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] md:max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-amber-500/20 text-amber-50 border border-amber-500/30'
                    : 'bg-zinc-800/70 text-zinc-100 border border-zinc-700/60'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-zinc-700/50">
                    {m.actions.map((act, j) => (
                      <span
                        key={j}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] ${
                          act.ok
                            ? act.op === 'delete'
                              ? 'bg-red-500/15 text-red-300'
                              : act.op === 'update'
                                ? 'bg-sky-500/15 text-sky-300'
                                : 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-zinc-700/40 text-zinc-400'
                        }`}
                      >
                        {act.op === 'delete' ? (
                          <Trash2 className="h-3 w-3" />
                        ) : act.op === 'update' ? (
                          <Pencil className="h-3 w-3" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        {act.ok
                          ? `${opWord(act.op)} · ${act.label}`
                          : `${act.label}${act.error ? ` (${act.error})` : ''}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="max-w-2xl rounded-2xl px-4 py-3 bg-zinc-800/70 border border-zinc-700/60 text-sm text-zinc-400 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.thinking}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-zinc-800/70 px-4 md:px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allowEdit}
                  onChange={(e) => setAllowEdit(e.target.checked)}
                  className="accent-amber-500 h-3.5 w-3.5"
                />
                {t.editToggle}
              </label>
            </div>
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
                className="flex-1 resize-none rounded-xl bg-zinc-900/80 border border-zinc-700/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50"
              />
              <button
                onClick={() => handleSend(input)}
                disabled={loading || !input.trim()}
                className="h-11 px-4 rounded-xl bg-amber-500 text-zinc-950 font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

