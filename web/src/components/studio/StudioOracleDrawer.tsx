'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  RotateCcw,
  BookOpen,
  Sword,
  Skull,
  Sun,
  Clock,
  GitBranch,
} from 'lucide-react';
import { notify } from '@/lib/notify';
import { PersonaId } from '@/lib/engines/world/ActionProtocol';

interface ChatMessage {
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
  const { story, isPersian, isRtl } = useStudioStory();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<PersonaId>('oracle');
  const [inputQuery, setInputQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  const activePersonaMeta =
    ADVISER_PERSONAS.find((p) => p.id === selectedPersona) || ADVISER_PERSONAS[0];

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
          isPersian,
        }),
      });

      if (!res.ok) {
        throw new Error(`Oracle response error (${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: json.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 end-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-zinc-950 font-bold text-xs shadow-2xl shadow-amber-500/30 cursor-pointer transition-all hover:scale-105 border border-amber-300/40 animate-fadeIn"
          title="Open Studio Oracle"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>{isPersian ? 'پیشگوی استودیو' : 'Studio Oracle'}</span>
          <span className="w-2 h-2 rounded-full bg-zinc-950 animate-ping" />
        </button>
      )}

      {/* Persistent Assistant Drawer */}
      {isOpen && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="fixed inset-y-0 end-0 z-50 w-full sm:w-96 md:w-[420px] bg-zinc-950/95 backdrop-blur-xl border-s border-zinc-800 shadow-2xl flex flex-col justify-between animate-fadeIn"
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
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-amber-300 hover:bg-zinc-800"
                  title="Clear Chat"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Persona Selector Tabs */}
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

            {/* Route Context Banner */}
            <div className="flex items-center justify-between text-[10px] font-mono px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400">
              <span className="flex items-center gap-1 text-amber-400/90">
                <Compass className="w-3 h-3" />
                {getRouteLabel()}
              </span>
              <span className="truncate max-w-[180px]">{story.title}</span>
            </div>
          </div>

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
                  key={idx}
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
                    className={`p-3 rounded-2xl max-w-[90%] text-xs leading-relaxed group relative ${
                      msg.role === 'user'
                        ? 'bg-amber-500 text-zinc-950 font-medium rounded-ee-none'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-es-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {msg.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => handleCopy(msg.content, idx)}
                        className="absolute top-2 end-2 p-1 rounded bg-zinc-950/60 text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy Response"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
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

          {/* Input Box */}
          <div className="p-3 border-t border-zinc-800 bg-zinc-900/60 space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={
                  isPersian
                    ? `از ${activePersonaMeta.nameFa} راهنمایی بخواهید...`
                    : `Consult with ${activePersonaMeta.nameEn}...`
                }
                className="flex-1 bg-zinc-950 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || isGenerating}
                className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-all shadow-md shadow-amber-500/20 disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
