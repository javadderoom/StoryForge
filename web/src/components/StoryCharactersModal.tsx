'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Users, X, Swords, Plus, Trash2, Clock, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';
import { CatalogStory, StorySessionSummary, fetchStorySessions, deleteSession, getCoverUrl } from '@/lib/play/api';
import { audioService } from '@/lib/play/audioService';
import { notify } from '@/lib/notify';

interface StoryCharactersModalProps {
  isOpen: boolean;
  story: CatalogStory | null;
  activeSessionId?: string;
  isPersian?: boolean;
  onSelectSession: (sessionId: string) => void;
  onCreateNew: () => void;
  onClose: () => void;
}

export function StoryCharactersModal({
  isOpen,
  story,
  activeSessionId,
  isPersian = false,
  onSelectSession,
  onCreateNew,
  onClose,
}: StoryCharactersModalProps) {
  const [sessions, setSessions] = useState<StorySessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    if (!story) return;
    setLoading(true);
    try {
      const data = await fetchStorySessions(story.id);
      setSessions(data);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [story]);

  useEffect(() => {
    if (isOpen && story) {
      loadSessions();
    }
  }, [isOpen, story, loadSessions]);

  if (!isOpen || !story) return null;

  const handleDelete = async (s: StorySessionSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    audioService.playSfx('buttonClick');

    const confirmed = await notify.confirm(
      isPersian
        ? `آیا از حذف شخصیت «${s.characterName}» اطمینان دارید؟ تمام پیشرفت این ماجراجویی پاک خواهد شد و هیچ اعتباری مسترد نمی‌گردد.`
        : `Are you sure you want to delete character "${s.characterName}"? All progress for this character will be lost and no credits are refunded.`
    );

    if (!confirmed) return;

    setDeletingId(s.sessionId);
    try {
      const success = await deleteSession(s.sessionId);
      if (success) {
        notify.success(
          isPersian
            ? `شخصیت «${s.characterName}» با موفقیت حذف شد.`
            : `Character "${s.characterName}" deleted successfully.`
        );
        await loadSessions();
      } else {
        notify.error(isPersian ? 'خطا در حذف شخصیت.' : 'Failed to delete character.');
      }
    } catch {
      notify.error(isPersian ? 'خطا در ارتباط با سرور.' : 'Server connection error.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return isPersian ? 'همین الان' : 'Just now';
      if (mins < 60) return isPersian ? `${mins} دقیقه پیش` : `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return isPersian ? `${hours} ساعت پیش` : `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return isPersian ? `${days} روز پیش` : `${days}d ago`;
    } catch {
      return '';
    }
  };

  const cover = getCoverUrl(story.id, story.coverImageUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fadeIn">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-zinc-800/90 bg-[#10121c] p-6 shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide text-zinc-100">
                {isPersian ? 'شخصیت‌ها و ماجراهای شما' : 'Chronicle Characters'}
              </h2>
              <p className="text-xs text-amber-400/90 font-medium">
                {story.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Story Context Banner */}
        <div className="relative mt-4 flex items-center gap-3 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={story.title} className="h-12 w-12 rounded-xl object-cover shrink-0" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 text-xl shrink-0">
              <BookOpen className="h-5 w-5 text-amber-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-xs text-zinc-300 font-medium">{story.tagline || story.title}</p>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              {isPersian
                ? 'هر شخصیت ماجراجویی مستقل خود را در این قلمرو زندگی می‌کند.'
                : 'Each character explores their own distinct narrative path.'}
            </p>
          </div>
        </div>

        {/* Character List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {loading ? (
            <div className="py-16 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <p className="mt-3 text-xs text-zinc-400">
                {isPersian ? 'در حال فراخوانی شخصیت‌ها...' : 'Summoning character scrolls...'}
              </p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400 mb-3">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-zinc-200">
                {isPersian ? 'هنوز شخصیتی برای این داستان نساخته‌اید' : 'No characters forged yet'}
              </h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                {isPersian
                  ? 'اولین شخصیت خود را بسازید تا ماجراجویی در این جهان آغاز شود.'
                  : 'Forge your first character to begin your journey in this realm.'}
              </p>
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.sessionId === activeSessionId;
              const isDeleting = deletingId === s.sessionId;
              const timeLabel = formatRelativeTime(s.updatedAt || s.createdAt);

              return (
                <div
                  key={s.sessionId}
                  className={`group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border p-4 transition-all ${
                    isActive
                      ? 'border-amber-500/70 bg-gradient-to-r from-amber-500/15 via-zinc-900/90 to-zinc-900/80 shadow-lg shadow-amber-500/10'
                      : 'border-zinc-800/90 bg-zinc-900/70 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-base shrink-0">
                      {s.characterName ? s.characterName.slice(0, 1) : '?'}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-100 truncate">
                          {s.characterName}
                        </span>
                        {isActive && (
                          <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300 shrink-0">
                            {isPersian ? 'در حال بازی' : 'Active'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span className="text-amber-400 font-medium">
                          {s.archetypeName} • {s.backgroundName}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span dir="ltr" className="text-zinc-300 font-mono text-[11px]">
                          Lvl {s.level} | Turn {s.turnCount}
                        </span>
                        {timeLabel && (
                          <>
                            <span className="text-zinc-600">•</span>
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                              <Clock className="h-3 w-3" />
                              {timeLabel}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800/80">
                    <button
                      onClick={() => {
                        audioService.playSfx('buttonClick');
                        onSelectSession(s.sessionId);
                        onClose();
                      }}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-3.5 py-2 text-xs font-bold text-amber-300 transition-colors"
                    >
                      <Swords className="h-3.5 w-3.5" />
                      <span>{isPersian ? 'ادامه ماجراجویی' : 'Continue'}</span>
                    </button>
                    <button
                      onClick={(e) => handleDelete(s, e)}
                      disabled={isDeleting}
                      title={isPersian ? 'حذف شخصیت' : 'Delete Character'}
                      className="rounded-xl border border-zinc-800 p-2 text-zinc-500 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Actions */}
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <button
            onClick={() => {
              audioService.playSfx('buttonClick');
              onClose();
              onCreateNew();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-xs font-bold text-zinc-950 transition-all hover:bg-amber-400 active:scale-[0.99] shadow-lg shadow-amber-500/20"
          >
            <Plus className="h-4 w-4" />
            <span>{isPersian ? 'ساخت شخصیت جدید' : 'Forge New Character'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
