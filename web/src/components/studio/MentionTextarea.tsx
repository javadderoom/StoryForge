'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  User,
  Shield,
  MapPin,
  Sparkles,
  Skull,
  Sun,
  BookOpen,
  Clock,
  ChevronRight,
} from 'lucide-react';

interface MentionItem {
  id: string;
  name: string;
  category: 'npc' | 'faction' | 'location' | 'artifact' | 'creature' | 'religion' | 'law' | 'timeline';
  categoryLabel: string;
  subtext?: string;
  icon: React.ElementType;
}

interface MentionTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
}

export default function MentionTextarea({
  value,
  onChange,
  className = '',
  placeholder,
  rows = 3,
  ...props
}: MentionTextareaProps) {
  const { story, isPersian, isRtl } = useStudioStory();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Compile all story entities into a searchable list
  const mentionPool = React.useMemo<MentionItem[]>(() => {
    const wb = story.worldBible;
    const items: MentionItem[] = [];

    (wb.npcs || []).forEach((n) => {
      items.push({
        id: n.id,
        name: n.name,
        category: 'npc',
        categoryLabel: isPersian ? 'شخصیت (NPC)' : 'Character (NPC)',
        subtext: n.role || n.title,
        icon: User,
      });
    });

    (wb.factions || []).forEach((f) => {
      items.push({
        id: f.id,
        name: f.name,
        category: 'faction',
        categoryLabel: isPersian ? 'جناح' : 'Faction',
        subtext: f.alignment,
        icon: Shield,
      });
    });

    (wb.locations || []).forEach((l) => {
      items.push({
        id: l.id,
        name: l.name,
        category: 'location',
        categoryLabel: isPersian ? 'مکان' : 'Location',
        subtext: l.region,
        icon: MapPin,
      });
    });

    (wb.artifacts || []).forEach((a) => {
      items.push({
        id: a.id,
        name: a.name,
        category: 'artifact',
        categoryLabel: isPersian ? 'عتیقه' : 'Relic',
        subtext: a.rarity,
        icon: Sparkles,
      });
    });

    (wb.bestiary || []).forEach((c) => {
      items.push({
        id: c.id,
        name: c.name,
        category: 'creature',
        categoryLabel: isPersian ? 'موجود' : 'Creature',
        subtext: c.speciesCategory,
        icon: Skull,
      });
    });

    (wb.religions || []).forEach((d) => {
      items.push({
        id: d.id,
        name: d.name,
        category: 'religion',
        categoryLabel: isPersian ? 'ایزد / آیین' : 'Faith / Deity',
        subtext: d.domain,
        icon: Sun,
      });
    });

    (wb.laws || []).forEach((law) => {
      items.push({
        id: law.id,
        name: law.rule,
        category: 'law',
        categoryLabel: isPersian ? 'قانون جهان' : 'World Law',
        subtext: law.category,
        icon: BookOpen,
      });
    });

    (wb.timeline || []).forEach((evt) => {
      items.push({
        id: evt.id,
        name: evt.title,
        category: 'timeline',
        categoryLabel: isPersian ? 'رویداد تاریخی' : 'Historical Event',
        subtext: evt.yearOrEra,
        icon: Clock,
      });
    });

    return items;
  }, [story.worldBible, isPersian]);

  const filteredItems = React.useMemo(() => {
    if (!query) return mentionPool.slice(0, 8);
    const q = query.toLowerCase().trim();
    return mentionPool
      .filter((item) => item.name.toLowerCase().includes(q) || item.category.includes(q))
      .slice(0, 8);
  }, [mentionPool, query]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e);
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;

    // Search backwards from cursor to find '@'
    const lastAtPos = text.lastIndexOf('@', cursorPos - 1);
    if (lastAtPos !== -1) {
      const charBeforeAt = lastAtPos > 0 ? text[lastAtPos - 1] : ' ';
      // Only trigger if @ is at start of string or preceded by whitespace
      if (/\s/.test(charBeforeAt) || lastAtPos === 0) {
        const queryText = text.slice(lastAtPos + 1, cursorPos);
        // Do not trigger if query contains newline or exceeds 30 chars
        if (!queryText.includes('\n') && queryText.length <= 30) {
          setMentionStartIndex(lastAtPos);
          setQuery(queryText);
          setSelectedIndex(0);
          setIsOpen(true);
          return;
        }
      }
    }

    setIsOpen(false);
    setMentionStartIndex(null);
  };

  const insertMention = useCallback(
    (item: MentionItem) => {
      if (mentionStartIndex === null || !textareaRef.current) return;
      const text = value;
      const cursorPos = textareaRef.current.selectionStart;

      const before = text.slice(0, mentionStartIndex);
      const after = text.slice(cursorPos);
      const inserted = `@[${item.name}] `;
      const newValue = before + inserted + after;

      // Synthetic change event
      const event = {
        target: { value: newValue },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      onChange(event);

      setIsOpen(false);
      setMentionStartIndex(null);

      // Restore focus and cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const newPos = before.length + inserted.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [mentionStartIndex, onChange, value]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen || filteredItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        insertMention(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        rows={rows}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        dir={isRtl ? 'rtl' : 'ltr'}
        className={`w-full bg-zinc-950 border border-zinc-700/80 rounded-2xl px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/80 transition-colors ${className}`}
        {...props}
      />

      {/* Autocomplete Mentions Popover */}
      {isOpen && filteredItems.length > 0 && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 bottom-full mb-1 left-0 right-0 max-h-56 overflow-y-auto bg-zinc-900/95 backdrop-blur-md border border-amber-500/30 rounded-2xl p-1.5 shadow-2xl space-y-0.5 animate-fadeIn"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <div className="px-2.5 py-1 text-[10px] text-zinc-500 font-mono flex items-center justify-between border-b border-zinc-800/80 mb-1">
            <span>
              {isPersian ? 'اشاره به موجودیت‌های جهان (@mentions)' : 'Cross-Reference Entities (@mentions)'}
            </span>
            <span className="text-[9.5px] text-amber-400/80">↑↓ Nav • ↵ Select</span>
          </div>

          {filteredItems.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === selectedIndex;

            return (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => insertMention(item)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-start transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-zinc-300 hover:bg-zinc-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="p-1 rounded-lg bg-zinc-800 text-amber-400 shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="truncate">
                    <span className="font-semibold block truncate">{item.name}</span>
                    {item.subtext && (
                      <span className="text-[10px] text-zinc-500 block truncate">{item.subtext}</span>
                    )}
                  </div>
                </div>

                <span className="text-[10px] text-zinc-500 font-mono px-2 py-0.5 rounded bg-zinc-800/50 shrink-0">
                  {item.categoryLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
