'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import { buildWorldContextString } from '@/lib/engines/narrative/worldContext';
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  User,
  Bot,
  Compass,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Pin,
  Plus,
  Trash2,
  Bookmark,
  ToggleLeft,
  ToggleRight,
  Shield,
  Lightbulb,
  Cpu,
} from 'lucide-react';
import { notify } from '@/lib/notify';
import { PersonaId, parseActionBlocks } from '@/lib/engines/world/ActionProtocol';
import {
  applyWorldChange,
  prepareWorldChanges,
  summarizeChangeFields,
  WorldActionChange,
} from '@/lib/engines/world/oracleActions';
import { OracleMemoryDirective } from '@/lib/types/world';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const ADVISER_PERSONAS: {
  id: PersonaId;
  nameEn: string;
  nameFa: string;
  taglineEn: string;
  taglineFa: string;
  color: string;
}[] = [
  {
    id: 'oracle',
    nameEn: 'The Studio Oracle',
    nameFa: 'پیشگوی استودیو',
    taglineEn: 'Master Story Architect & World Director',
    taglineFa: 'معمار ارشد داستان و هدایت‌گر کلان جهان',
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: 'cosmologist',
    nameEn: 'The Cosmologist',
    nameFa: 'کیهان‌شناس',
    taglineEn: 'Metaphysics, Physics & Magic Laws',
    taglineFa: 'متافیزیک، قوانین بنیادین و هستی‌شناسی',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    id: 'inquisitor',
    nameEn: 'The Lore Inquisitor',
    nameFa: 'تفتیش‌گر پیوستگی',
    taglineEn: 'Contradiction Hunter & Lore Auditor',
    taglineFa: 'کشف تناقضات، خلأهای منطقی و حسابرسی لور',
    color: 'from-rose-500 to-red-600',
  },
  {
    id: 'weaver',
    nameEn: 'The Quest Weaver',
    nameFa: 'بافنده مأموریت',
    taglineEn: 'Branching Beats, NPCs & Social Drama',
    taglineFa: 'گره‌های روایی، درام کاراکترها و انشعابات داستانی',
    color: 'from-purple-500 to-indigo-600',
  },
  {
    id: 'stylist',
    nameEn: 'The Stylist',
    nameFa: 'استاد نثر و لحن',
    taglineEn: 'Prose Polish, Persian Dialects & Atmosphere',
    taglineFa: 'پیرایش نثر، لحن ادبی، فضا و گویش‌های داستانی',
    color: 'from-emerald-500 to-teal-600',
  },
];

export default function StudioOracleDrawer() {
  const pathname = usePathname();
  const {
    story,
    isPersian,
    isRtl,
    updateWorldBible,
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

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'memory'>('chat');
  const [selectedPersona, setSelectedPersona] = useState<PersonaId>('oracle');
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  // World-alteration review queue (storyforge-action pipeline)
  const [pendingChanges, setPendingChanges] = useState<WorldActionChange[]>([]);
  const [preparingActions, setPreparingActions] = useState(false);

  // Memory Vault Form State
  const [newDirectiveText, setNewDirectiveText] = useState('');
  const [newDirectiveCategory, setNewDirectiveCategory] = useState<OracleMemoryDirective['category']>('canon_fact');

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const storageKey = `storyforge_oracle_history_${story.id}`;

  const activePersonaMeta =
    ADVISER_PERSONAS.find((p) => p.id === selectedPersona) || ADVISER_PERSONAS[0];

  const oracleDirectives: OracleMemoryDirective[] = story.worldBible.oracleDirectives || [];
  const activeDirectivesCount = oracleDirectives.filter((d) => d.isActive !== false).length;

  // Load chat history from localStorage on story mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {
      // Ignore local storage error
    }
  }, [storageKey]);

  // Persist chat history to localStorage
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    } catch {
      // Ignore local storage error
    }
  }, [messages, storageKey]);

  const getRouteLabel = () => {
    if (pathname.includes('/timeline')) return isPersian ? 'گاه‌شمار' : 'Timeline';
    if (pathname.includes('/artifacts')) return isPersian ? 'عتیقه‌ها' : 'Artifacts';
    if (pathname.includes('/bestiary')) return isPersian ? 'زیست‌بوم' : 'Bestiary';
    if (pathname.includes('/religions')) return isPersian ? 'پانتئون' : 'Religions';
    if (pathname.includes('/rpg')) return isPersian ? 'مکانیک RPG' : 'RPG System';
    if (pathname.includes('/beats')) return isPersian ? 'درخت روایی' : 'Story Beats';
    if (pathname.includes('/npcs')) return isPersian ? 'شخصیت‌ها' : 'NPCs';
    if (pathname.includes('/locations')) return isPersian ? 'جغرافیا' : 'Locations';
    return isPersian ? 'جهان' : 'World';
  };

  const getQuickSuggestions = () => {
    if (pathname.includes('/timeline')) {
      return isPersian
        ? ['پیامدهای تاریخی نبرد باستان را تحلیل کن', 'ایده‌ای برای عصر دوم تاریخ ارائه بده']
        : ['Analyze timeline ripples for ancient war', 'Suggest major cataclysm for Era 2'];
    }
    if (pathname.includes('/artifacts')) {
      return isPersian
        ? ['یک سلاح اسطوره‌ای با آیین آزادسازی بساز', 'برای عتیقه انتخابی مدعیان رقیب پیشنهاد بده']
        : ['Design a mythic weapon with unsealing ritual', 'Suggest rival seekers for sealed relics'];
    }
    if (pathname.includes('/bestiary')) {
      return isPersian
        ? ['برای یک شکارچی رأس هرم روش رام‌سازی پیشنهاد کن', 'مواد کیمیاگری قابل استخراج از این موجود چیست؟']
        : ['Suggest non-combat pacification for apex predator', 'Invent alchemical harvest reagents'];
    }
    if (pathname.includes('/religions')) {
      return isPersian
        ? ['شوم‌نامه‌ای هولناک برای کفرورزی تعریف کن', 'یک فرقه بدعت‌گذار مخفی طراحی کن']
        : ['Invent chilling divine wrath omen for blasphemy', 'Design an underground heresy cult'];
    }
    if (pathname.includes('/rpg')) {
      return isPersian
        ? ['درجه سختی DC آزمون‌های این جهان را بالانس کن', 'یک استخر منبع با قانون فرسایش پیشنهاد بده']
        : ['Balance attribute check DCs for theme', 'Design a resource pool with decay mechanics'];
    }
    if (pathname.includes('/beats')) {
      return isPersian
        ? ['یک پیچش دراماتیک برای پرده دوم پیشنهاد کن', 'انتخاب‌های ۳ گانه صحنه را ارزیابی کن']
        : ['Suggest a dramatic Act 2 midpoint twist', 'Evaluate the three-tier choice balance'];
    }
    return isPersian
      ? ['تناقضات احتمالی در قوانین جهان را بررسی کن', 'ایده‌ای برای تقویت گره اصلی داستان بده']
      : ['Audit world consistency across entities', 'Suggest high-stakes plot twist'];
  };

  const handleSendMessage = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || isGenerating) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now().toString(36)}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputQuery('');
    setIsGenerating(true);

    try {
      const worldContext = buildWorldContextString(story);
      const res = await fetch('/api/studio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({ role: m.role, content: m.content })),
          persona: selectedPersona,
          worldContext,
          activeEntityContext: `Active Studio Route: ${pathname} (${getRouteLabel()}). Story Title: ${story.title}`,
          directives: story.worldBible.oracleDirectives || [],
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Oracle response error (${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.reply) {
        // Never render raw action fences; route them into the review pipeline.
        const cleanReply = json.reply.replace(/```[\s\S]*?```/g, '').trim();
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now().toString(36)}_rep`,
            role: 'assistant',
            content: cleanReply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);

        const actions = parseActionBlocks(json.reply);
        if (actions.length > 0) {
          setPreparingActions(true);
          try {
            const { ready, failed } = await prepareWorldChanges({
              actions,
              worldBible: story.worldBible,
              worldContext,
              userText: text,
              isPersian,
            });
            if (failed.length > 0) {
              const list = failed.map((f) => `• ${f.label}: ${f.error}`).join('\n');
              notify.error(
                (isPersian ? 'برخی تغییرات آماده نشد:\n' : 'Some changes could not be prepared:\n') + list
              );
            }
            if (ready.length > 0) {
              setPendingChanges((prev) => [...prev, ...ready]);
              notify.info(
                isPersian
                  ? `${ready.length} تغییر جهانی برای بررسی و تأیید شما آماده شد`
                  : `${ready.length} world change(s) ready for your review`
              );
            }
          } catch (e: any) {
            notify.error(e?.message || (isPersian ? 'خطا در اجرای عملیات' : 'Failed to execute actions'));
          } finally {
            setPreparingActions(false);
          }
        }
      } else {
        notify.error(json.error || (isPersian ? 'خطا در پاسخ پیشگو' : 'Failed to fetch Oracle advice'));
      }
    } catch (err: any) {
      notify.error(err.message || 'Error communicating with Oracle');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    notify.success(isPersian ? 'در حافظه کپی شد' : 'Copied to clipboard');
  };

  // Pin a message directly to Oracle Permanent Memory Vault
  const handlePinToMemory = (content: string, index: number) => {
    const cleanDirective = content.length > 300 ? content.slice(0, 300) + '...' : content;
    const newEntry: OracleMemoryDirective = {
      id: `dir_${Date.now().toString(36)}`,
      directive: cleanDirective,
      category: 'canon_fact',
      isActive: true,
      createdAt: new Date().toLocaleDateString(),
      sourceMessage: content.slice(0, 100),
    };

    updateWorldBible((prev) => ({
      ...prev,
      oracleDirectives: [...(prev.oracleDirectives || []), newEntry],
    }));

    setPinnedIndex(index);
    setTimeout(() => setPinnedIndex(null), 2000);
    notify.success(
      isPersian
        ? 'این نکته در مخزن حافظه دائمی پیشگو ذخیره شد 🧠'
        : 'Saved as permanent canon memory in Oracle Vault 🧠'
    );
  };

  // Add Manual Memory Directive
  const handleAddDirective = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDirectiveText.trim()) return;

    const newEntry: OracleMemoryDirective = {
      id: `dir_${Date.now().toString(36)}`,
      directive: newDirectiveText.trim(),
      category: newDirectiveCategory,
      isActive: true,
      createdAt: new Date().toLocaleDateString(),
    };

    updateWorldBible((prev) => ({
      ...prev,
      oracleDirectives: [...(prev.oracleDirectives || []), newEntry],
    }));

    setNewDirectiveText('');
    notify.success(isPersian ? 'دستورالعمل جدید در حافظه پیشگو ثبت شد' : 'New canon directive stored in Oracle memory');
  };

  const handleToggleDirective = (id: string) => {
    updateWorldBible((prev) => ({
      ...prev,
      oracleDirectives: (prev.oracleDirectives || []).map((d) =>
        d.id === id ? { ...d, isActive: !d.isActive } : d
      ),
    }));
  };

  const handleDeleteDirective = async (id: string) => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'حذف دستورالعمل حافظه' : 'Delete Memory Directive',
      message: isPersian
        ? 'آیا از حذف این نکته از حافظه دائمی پیشگو اطمینان دارید؟'
        : 'Are you sure you want to permanently delete this memory directive?',
      confirmText: isPersian ? 'حذف' : 'Delete',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      updateWorldBible((prev) => ({
        ...prev,
        oracleDirectives: (prev.oracleDirectives || []).filter((d) => d.id !== id),
      }));
      notify.info(isPersian ? 'دستورالعمل از حافظه حذف شد' : 'Directive removed from Oracle memory');
    }
  };

  const handleClearChatHistory = async () => {
    const confirmed = await notify.confirm({
      title: isPersian ? 'پاک‌سازی تاریخچه گفتگو' : 'Clear Chat History',
      message: isPersian
        ? 'آیا از پاک کردن کل تاریخچه گفت‌وگوی پیشگو برای این داستان اطمینان دارید؟'
        : 'Are you sure you want to clear all conversation history for this story?',
      confirmText: isPersian ? 'پاک‌سازی کامل' : 'Clear History',
      cancelText: isPersian ? 'انصراف' : 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      setMessages([]);
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      notify.info(isPersian ? 'تاریخچه گفتگو پاک شد' : 'Chat history cleared');
    }
  };

  // ---- storyforge-action review pipeline ----
  const buildMutators = () => ({
    faction: { add: addFaction, edit: editFaction, del: deleteFaction },
    location: { add: addLocation, edit: editLocation, del: deleteLocation },
    npc: { add: addNpc, edit: editNpc, del: deleteNpc },
    artifact: { add: addArtifact, edit: editArtifact, del: deleteArtifact },
    creature: { add: addCreature, edit: editCreature, del: deleteCreature },
    deity: { add: addDeity, edit: editDeity, del: deleteDeity },
    timeline_event: { add: addTimelineEvent, edit: editTimelineEvent, del: deleteTimelineEvent },
    world_law: { add: addWorldLaw, edit: editWorldLaw, del: deleteWorldLaw },
  });

  const applyOneChange = (change: WorldActionChange) => {
    try {
      applyWorldChange(change, buildMutators());
      setPendingChanges((prev) => prev.filter((c) => c !== change));
      notify.success(
        isPersian ? `روی جهان اعمال شد: ${change.label}` : `Applied to world: ${change.label}`
      );
    } catch (err) {
      notify.error((err as Error)?.message || (isPersian ? 'اعمال ناموفق بود' : 'Failed to apply change'));
    }
  };

  const dismissOneChange = (change: WorldActionChange) => {
    setPendingChanges((prev) => prev.filter((c) => c !== change));
  };

  const applyAllChanges = () => {
    const mutators = buildMutators();
    let ok = 0;
    for (const c of pendingChanges) {
      try {
        applyWorldChange(c, mutators);
        ok += 1;
      } catch {
        /* leave unapplied ones visible */
      }
    }
    setPendingChanges((prev) => prev.slice(ok));
    if (ok > 0) notify.success(isPersian ? `${ok} تغییر اعمال شد` : `Applied ${ok} change(s)`);
  };

  const dismissAllChanges = () => setPendingChanges([]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating, activeTab]);

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 end-6 z-[60] max-md:bottom-24 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-zinc-950 font-bold text-xs shadow-2xl shadow-amber-500/30 cursor-pointer transition-all hover:scale-105 border border-amber-300/40 animate-fadeIn"
          title="Open Studio Oracle"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>{isPersian ? 'پیشگوی استودیو' : 'Studio Oracle'}</span>
          {activeDirectivesCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-950 text-amber-300 text-[10px] font-mono border border-amber-400/40">
              🧠 {activeDirectivesCount}
            </span>
          )}
          <span className="w-2 h-2 rounded-full bg-zinc-950 animate-ping" />
        </button>
      )}

      {/* Persistent Assistant Drawer */}
      {isOpen && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="fixed inset-y-0 end-0 z-50 w-full sm:w-96 md:w-[440px] bg-zinc-950/95 backdrop-blur-xl border-s border-zinc-800 shadow-2xl flex flex-col justify-between animate-fadeIn"
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${activePersonaMeta.color} flex items-center justify-center text-white shadow-lg`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    {isPersian ? activePersonaMeta.nameFa : activePersonaMeta.nameEn}
                  </h3>
                  <span className="text-[10px] text-zinc-400 block">
                    {isPersian ? activePersonaMeta.taglineFa : activePersonaMeta.taglineEn}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {activeTab === 'chat' && (
                  <button
                    type="button"
                    onClick={handleClearChatHistory}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition-colors"
                    title={isPersian ? 'پاک‌سازی گفتگو' : 'Clear Chat History'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs (Chat vs Memory Vault) */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'chat'
                    ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{isPersian ? 'گفت‌وگو با پیشگو' : 'Oracle Chat'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('memory')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'memory'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
                <span>{isPersian ? 'مخزن حافظه' : 'Memory Vault'}</span>
                {activeDirectivesCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-zinc-900 text-[10px] font-mono border border-purple-400/40">
                    {activeDirectivesCount}
                  </span>
                )}
              </button>
            </div>

            {/* Persona Selector Tabs (Only active in Chat mode) */}
            {activeTab === 'chat' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {ADVISER_PERSONAS.map((persona) => {
                  const isSelected = persona.id === selectedPersona;
                  return (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => setSelectedPersona(persona.id)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                          : 'text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800'
                      }`}
                    >
                      {isPersian ? persona.nameFa : persona.nameEn}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Route Context Banner */}
            <div className="flex items-center justify-between text-[10px] font-mono px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400">
              <span className="flex items-center gap-1 text-amber-400/90">
                <Compass className="w-3 h-3" />
                {getRouteLabel()}
              </span>
              <span className="truncate max-w-[180px]">{story.title}</span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* TAB 1: INTERACTIVE CHAT */}
          {/* ========================================================= */}
          {activeTab === 'chat' ? (
            <>
              {/* Chat Messages Log */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
                {messages.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-amber-400 shadow-inner">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-zinc-200 text-xs">
                        {isPersian ? 'مشاور هوشمند لور و داستان' : 'Studio Lore Advisor Ready'}
                      </h4>
                      <p className="text-[11px] text-zinc-500 max-w-xs mx-auto leading-relaxed">
                        {isPersian
                          ? 'هر سؤالی درباره پیوستگی قوانین، خلق موجودات، طراحی دیالوگ‌ها، یا بالانس تاس‌های RPG دارید بپرسید.'
                          : 'Ask anything about world consistency, creature design, dialogue voice, or RPG balance.'}
                      </p>
                    </div>

                    {/* Quick Suggestion Chips */}
                    <div className="pt-3 space-y-1.5 text-start">
                      <span className="text-[10px] text-zinc-500 font-mono block">
                        {isPersian ? 'پیشنهادات سریع برای این بخش:' : 'Quick Prompts for this page:'}
                      </span>
                      <div className="space-y-1">
                        {getQuickSuggestions().map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(sug)}
                            className="w-full text-start p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-amber-500/30 text-[11px] text-zinc-300 transition-all cursor-pointer"
                          >
                            💡 {sug}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col space-y-1 ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                        {msg.role === 'user' ? (
                          <>
                            <span>{msg.timestamp}</span>
                            <User className="w-3 h-3 text-zinc-400" />
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3 text-amber-400" />
                            <span>{isPersian ? activePersonaMeta.nameFa : activePersonaMeta.nameEn}</span>
                            <span>•</span>
                            <span>{msg.timestamp}</span>
                          </>
                        )}
                      </div>

                      <div
                        className={`p-3.5 rounded-2xl max-w-[92%] text-xs leading-relaxed group relative ${
                          msg.role === 'user'
                            ? 'bg-amber-500 text-zinc-950 font-medium rounded-ee-none'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-es-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>

                        <div className="absolute top-2 end-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Pin to Memory Button */}
                          <button
                            type="button"
                            onClick={() => handlePinToMemory(msg.content, idx)}
                            className="p-1 rounded bg-zinc-950/80 text-zinc-400 hover:text-purple-300 transition-colors"
                            title={isPersian ? 'ثبت در حافظه دائمی پیشگو' : 'Save to Oracle Memory Vault'}
                          >
                            {pinnedIndex === idx ? (
                              <Check className="w-3 h-3 text-purple-400" />
                            ) : (
                              <Pin className="w-3 h-3" />
                            )}
                          </button>

                          {/* Copy Button */}
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content, idx)}
                            className="p-1 rounded bg-zinc-950/80 text-zinc-400 hover:text-white transition-colors"
                            title={isPersian ? 'کپی متن' : 'Copy Response'}
                          >
                            {copiedIndex === idx ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isGenerating && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 animate-pulse p-2">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>{isPersian ? 'پیشگو در حال اندیشیدن است...' : 'Oracle is contemplating...'}</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Pending world changes awaiting review */}
              {(pendingChanges.length > 0 || preparingActions) && (
                <div className="border-t border-amber-500/20 bg-zinc-900/90 p-3 space-y-2 max-h-[38vh] overflow-y-auto">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold font-mono text-amber-300">
                      <Sparkles className="w-3 h-3" />
                      {isPersian ? 'تغییرات جهانی در انتظار تأیید' : 'WORLD CHANGES AWAITING REVIEW'}
                    </span>
                    {pendingChanges.length > 1 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={applyAllChanges}
                          className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/25"
                        >
                          {isPersian ? 'اعمال همه' : 'Apply all'}
                        </button>
                        <button
                          type="button"
                          onClick={dismissAllChanges}
                          className="px-2 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-bold hover:text-white"
                        >
                          {isPersian ? 'رد همه' : 'Dismiss all'}
                        </button>
                      </div>
                    )}
                  </div>

                  {preparingActions && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-300 animate-pulse p-1.5">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>
                        {isPersian ? 'در حال آماده‌سازی تغییرات جهان…' : 'Preparing world changes…'}
                      </span>
                    </div>
                  )}

                  {pendingChanges.map((c, i) => {
                    const badge =
                      c.op === 'create'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : c.op === 'delete'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                    const fields = summarizeChangeFields(c);
                    return (
                      <div
                        key={`${c.op}-${c.targetId ?? c.label}-${i}`}
                        className="rounded-xl border border-zinc-700/70 bg-zinc-950 p-2.5 flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${badge}`}>
                              {c.op}
                            </span>
                            <span className="text-[11px] font-bold text-zinc-100 truncate">{c.label}</span>
                          </div>
                          {fields && (
                            <p className="text-[10px] text-zinc-400 font-mono break-words leading-relaxed">{fields}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => applyOneChange(c)}
                            title={isPersian ? 'اعمال روی جهان' : 'Apply to world'}
                            className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => dismissOneChange(c)}
                            title={isPersian ? 'نادیده گرفتن' : 'Dismiss'}
                            className="p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Input Box */}
              <div className="p-3 border-t border-zinc-800 bg-zinc-900/60 space-y-1.5">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-end gap-2"
                >
                  <textarea
                    rows={2}
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (inputQuery.trim() && !isGenerating) {
                          handleSendMessage();
                        }
                      }
                    }}
                    placeholder={
                      isPersian
                        ? `پیام خود را بنویسید (Enter برای ارسال، Shift+Enter برای خط جدید)...`
                        : `Type your message (Enter to send, Shift+Enter for newline)...`
                    }
                    className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-2xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400 resize-none max-h-32 leading-relaxed"
                  />
                  <button
                    type="submit"
                    disabled={!inputQuery.trim() || isGenerating}
                    className="p-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-all shadow-md shadow-amber-500/20 disabled:opacity-40 cursor-pointer shrink-0 mb-0.5"
                    title={isPersian ? 'ارسال پیام' : 'Send message'}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
                <div className="flex items-center justify-between text-[9.5px] text-zinc-500 px-1">
                  <span>{isPersian ? '↵ ارسال • Shift+↵ خط جدید' : '↵ Send • Shift+↵ New Line'}</span>
                  <span>{story.worldBible.worldName || 'StoryForge'}</span>
                </div>
              </div>
            </>
          ) : (
            /* ========================================================= */
            /* TAB 2: ORACLE MEMORY VAULT */
            /* ========================================================= */
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-1">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <Pin className="w-3.5 h-3.5" />
                  <span>{isPersian ? 'مخزن حافظه و دستورالعمل‌های دائم' : 'Permanent Oracle Memory Vault'}</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {isPersian
                    ? 'تمام نکات، تصمیمات بنیادین و حقایق ذخیره‌شده در این بخش، مستقیماً به حافظه تمام ۵ مشاور پیشگو تزریق می‌شوند و در تمام گفتگوها محترم شمرده خواهند شد.'
                    : 'All canon facts and creative directives stored here are permanently injected into all 5 Oracle personas to guide future consultations.'}
                </p>
              </div>

              {/* Add Directive Form */}
              <form onSubmit={handleAddDirective} className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1">
                    <Plus className="w-3 h-3 text-purple-400" />
                    {isPersian ? 'افزودن دستورالعمل جدید به حافظه:' : 'Add New Memory Directive:'}
                  </label>
                  <select
                    value={newDirectiveCategory}
                    onChange={(e) => setNewDirectiveCategory(e.target.value as any)}
                    className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-[10.5px] text-purple-300 font-mono"
                  >
                    <option value="canon_fact">{isPersian ? 'حقیقت لور (Canon)' : 'Canon Fact'}</option>
                    <option value="tone_rule">{isPersian ? 'قانون لحن و تم (Tone)' : 'Tone Rule'}</option>
                    <option value="character_arc">{isPersian ? 'خط شخصیتی (Character)' : 'Character Arc'}</option>
                    <option value="forbidden_trope">{isPersian ? 'ممنوعیت داستانی (Forbidden)' : 'Forbidden Trope'}</option>
                    <option value="custom">{isPersian ? 'سفارشی (Custom)' : 'Custom'}</option>
                  </select>
                </div>

                <textarea
                  rows={2}
                  value={newDirectiveText}
                  onChange={(e) => setNewDirectiveText(e.target.value)}
                  placeholder={
                    isPersian
                      ? 'مثال: امپراتور نقره‌ای مخفیانه مرده و یک ربات جای او را گرفته است...'
                      : 'e.g. The Silver Emperor is secretly dead and replaced by an automaton...'
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-purple-400"
                />

                <button
                  type="submit"
                  disabled={!newDirectiveText.trim()}
                  className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer shadow-md shadow-purple-600/20"
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>{isPersian ? 'ثبت دائم در حافظه پیشگو' : 'Save Directive to Memory'}</span>
                </button>
              </form>

              {/* Directives List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono px-1">
                  <span>{isPersian ? 'حافظه‌های فعال:' : 'Active Memory Directives:'}</span>
                  <span>{oracleDirectives.length} {isPersian ? 'مورد' : 'total'}</span>
                </div>

                {oracleDirectives.length === 0 ? (
                  <div className="text-center py-6 text-zinc-500 space-y-1">
                    <Bookmark className="w-6 h-6 mx-auto text-zinc-700" />
                    <p className="text-[11px]">
                      {isPersian
                        ? 'هنوز نکته‌ای در حافظه ثبت نشده است. می‌توانید با زدن دکمه 📌 روی پیام‌ها آن‌ها را اضافه کنید.'
                        : 'No memory directives stored yet. You can pin key messages in the chat tab using 📌.'}
                    </p>
                  </div>
                ) : (
                  oracleDirectives.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        item.isActive !== false
                          ? 'bg-zinc-900/90 border-purple-500/30'
                          : 'bg-zinc-950/60 border-zinc-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80 mb-2">
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-mono text-[9.5px] border border-purple-500/30">
                          {item.category || 'canon_fact'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleDirective(item.id)}
                            className="text-zinc-400 hover:text-white p-1"
                            title={item.isActive !== false ? 'Mute' : 'Activate'}
                          >
                            {item.isActive !== false ? (
                              <ToggleRight className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-zinc-600" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDirective(item.id)}
                            className="text-zinc-500 hover:text-red-400 p-1"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-zinc-200 text-xs leading-relaxed">{item.directive}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
