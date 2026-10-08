'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, Check, ChevronDown } from 'lucide-react';

export interface ComboboxOption {
  id: string;
  name: string;
  subtext?: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ElementType;
}

interface SearchableComboboxProps {
  value: string;
  onChange: (id: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  isPersian?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  icon?: React.ElementType;
  className?: string;
}

/**
 * Searchable Combobox with live suggestion filtering, keyboard navigation,
 * and entity badges for StoryForge Studio.
 */
export function SearchableCombobox({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  isPersian = false,
  disabled = false,
  clearable = true,
  icon: DefaultIcon,
  className = '',
}: SearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selected item object
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.id === value);
  }, [options, value]);

  // Filter options based on query
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((opt) => {
      const matchName = opt.name.toLowerCase().includes(q);
      const matchSub = opt.subtext?.toLowerCase().includes(q);
      const matchBadge = opt.badge?.toLowerCase().includes(q);
      return matchName || matchSub || matchBadge;
    });
  }, [options, query]);

  // Reset highlighted index when filtered results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const activeEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleSelect(filteredOptions[highlightedIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setQuery('');
    }
  };

  const SelectedIcon = selectedOption?.icon || DefaultIcon;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-900 border text-xs text-left transition-all cursor-pointer ${
          isOpen
            ? 'border-amber-500/70 ring-1 ring-amber-500/30'
            : 'border-zinc-700/80 hover:border-zinc-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {SelectedIcon && (
            <SelectedIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          )}
          {selectedOption ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-medium text-zinc-100 truncate">
                {selectedOption.name}
              </span>
              {selectedOption.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                    selectedOption.badgeColor || 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                  }`}
                >
                  {selectedOption.badge}
                </span>
              )}
            </div>
          ) : (
            <span className="text-zinc-500 truncate">
              {placeholder || (isPersian ? 'انتخاب کنید…' : 'Select option…')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-zinc-400">
          {clearable && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              title={isPersian ? 'پاک کردن انتخاب' : 'Clear selection'}
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-amber-400' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Suggestions Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-zinc-900/98 backdrop-blur-md border border-zinc-700/90 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-fadeIn">
          {/* Search Input Box */}
          <div className="p-2 border-b border-zinc-800/80 bg-zinc-950/50">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchPlaceholder ||
                  (isPersian ? 'جستجو در نام و توضیحات…' : 'Search name & description…')
                }
                className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl pl-8 pr-7 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Suggestions List */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin"
            style={{ scrollbarWidth: 'thin' }}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">
                {emptyMessage ||
                  (query
                    ? isPersian
                      ? 'موردی با این عبارت یافت نشد'
                      : 'No matching items found'
                    : isPersian
                    ? 'گزینه‌ای موجود نیست'
                    : 'No options available')}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.id === value;
                const isHighlighted = idx === highlightedIndex;
                const OptIcon = opt.icon || DefaultIcon;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      isHighlighted
                        ? 'bg-amber-500/15 text-zinc-100'
                        : isSelected
                        ? 'bg-zinc-800/60 text-zinc-200'
                        : 'text-zinc-300 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {OptIcon && (
                        <span className="p-1 rounded-lg bg-zinc-800 text-zinc-400 shrink-0 mt-0.5">
                          <OptIcon className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`font-semibold truncate ${
                              isSelected ? 'text-amber-400 font-bold' : ''
                            }`}
                          >
                            {opt.name}
                          </span>
                          {opt.badge && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                opt.badgeColor ||
                                'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.subtext && (
                          <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5 leading-relaxed">
                            {opt.subtext}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-1" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface MultiSearchableComboboxProps {
  values: string[];
  onChange: (ids: string[]) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  isPersian?: boolean;
  disabled?: boolean;
  icon?: React.ElementType;
  className?: string;
}

/**
 * Multi-Select Searchable Combobox for Intermediate Waypoints / Multi-Entities.
 * Displays selected entities as removable chips, with a live suggestion searchbox.
 */
export function MultiSearchableCombobox({
  values,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  isPersian = false,
  disabled = false,
  icon: DefaultIcon,
  className = '',
}: MultiSearchableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Selected options list
  const selectedOptions = useMemo(() => {
    return values
      .map((id) => options.find((opt) => opt.id === id))
      .filter((opt): opt is ComboboxOption => opt !== undefined);
  }, [options, values]);

  // Unselected options available for addition
  const availableOptions = useMemo(() => {
    const selectedSet = new Set(values);
    return options.filter((opt) => !selectedSet.has(opt.id));
  }, [options, values]);

  // Filter available options by query
  const filteredOptions = useMemo(() => {
    if (!query.trim()) return availableOptions;
    const q = query.trim().toLowerCase();
    return availableOptions.filter((opt) => {
      const matchName = opt.name.toLowerCase().includes(q);
      const matchSub = opt.subtext?.toLowerCase().includes(q);
      const matchBadge = opt.badge?.toLowerCase().includes(q);
      return matchName || matchSub || matchBadge;
    });
  }, [availableOptions, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleAdd = (id: string) => {
    if (!values.includes(id)) {
      onChange([...values, id]);
    }
    setQuery('');
    // Keep popover open if there are more options to add
  };

  const handleRemove = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange(values.filter((v) => v !== id));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex]) {
        handleAdd(filteredOptions[highlightedIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full space-y-2 ${className}`}>
      {/* Selected Items Chips */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
          {selectedOptions.map((opt) => {
            const ChipIcon = opt.icon || DefaultIcon;
            return (
              <span
                key={opt.id}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium group"
              >
                {ChipIcon && <ChipIcon className="w-3 h-3 text-amber-400 shrink-0" />}
                <span className="truncate max-w-[140px]">{opt.name}</span>
                {opt.badge && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-200">
                    {opt.badge}
                  </span>
                )}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemove(opt.id, e)}
                    className="p-0.5 rounded hover:bg-amber-500/30 text-amber-400 hover:text-amber-200 transition-colors cursor-pointer"
                    title={isPersian ? 'حذف' : 'Remove'}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </span>
            );
          })}

          {!disabled && selectedOptions.length > 1 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-zinc-500 hover:text-rose-400 px-2 py-0.5 rounded transition-colors cursor-pointer"
            >
              {isPersian ? 'پاک کردن همه' : 'Clear all'}
            </button>
          )}
        </div>
      )}

      {/* Add Waypoint Button / Search Input Trigger */}
      <button
        type="button"
        disabled={disabled || availableOptions.length === 0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-900 border text-xs text-left transition-all cursor-pointer ${
          isOpen
            ? 'border-amber-500/70 ring-1 ring-amber-500/30'
            : 'border-zinc-700/80 hover:border-zinc-600'
        } ${disabled || availableOptions.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 text-zinc-400">
          <Search className="w-3.5 h-3.5" />
          <span className="text-zinc-500">
            {availableOptions.length === 0
              ? isPersian
                ? 'همهٔ موارد انتخاب شده‌اند'
                : 'All available items selected'
              : placeholder ||
                (isPersian
                  ? 'جستجو و افزودن ایستگاه میانی جدید…'
                  : 'Search & add intermediate waypoint…')}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-amber-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Suggestions Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-zinc-900/98 backdrop-blur-md border border-zinc-700/90 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-fadeIn">
          {/* Search Input Box */}
          <div className="p-2 border-b border-zinc-800/80 bg-zinc-950/50">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  searchPlaceholder ||
                  (isPersian ? 'نام ایستگاه یا مکان را تایپ کنید…' : 'Type waypoint/location name…')
                }
                className="w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl pl-8 pr-7 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/60"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Suggestions List */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin"
            style={{ scrollbarWidth: 'thin' }}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">
                {emptyMessage ||
                  (query
                    ? isPersian
                      ? 'موردی با این عبارت یافت نشد'
                      : 'No matching items found'
                    : isPersian
                    ? 'گزینه‌ای برای افزودن نمانده است'
                    : 'No more items to add')}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isHighlighted = idx === highlightedIndex;
                const OptIcon = opt.icon || DefaultIcon;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleAdd(opt.id)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      isHighlighted
                        ? 'bg-amber-500/15 text-zinc-100'
                        : 'text-zinc-300 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      {OptIcon && (
                        <span className="p-1 rounded-lg bg-zinc-800 text-zinc-400 shrink-0 mt-0.5">
                          <OptIcon className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold truncate">{opt.name}</span>
                          {opt.badge && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                                opt.badgeColor ||
                                'bg-zinc-800 text-zinc-400 border border-zinc-700/50'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.subtext && (
                          <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5 leading-relaxed">
                            {opt.subtext}
                          </p>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-amber-400 border border-amber-500/20 shrink-0 font-medium">
                      {isPersian ? '+ افزودن' : '+ Add'}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
