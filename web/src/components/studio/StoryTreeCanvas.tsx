'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { StoryManifest, StoryChapter, StoryBeat } from '@/lib/types';
import {
  GitBranch,
  MapPin,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookOpen,
  ArrowRight,
  LayoutGrid,
  Move,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
} from 'lucide-react';

interface StoryBeatChoice {
  id: string;
  text: string;
  style: 'defensive' | 'agile' | 'aggressive' | 'diplomatic' | 'inquisitive';
  riskLevel: 'low' | 'medium' | 'high';
  targetDC?: number;
  requiredStatId?: string;
  targetSceneId?: string;
}

interface StoryBeatNode {
  sceneId: string;
  locationId: string;
  narrativeText: string;
  imageUrl?: string;
  choices: StoryBeatChoice[];
}

interface StoryTreeCanvasProps {
  story: StoryManifest;
  isPersian?: boolean;
  /** Plan 07: when provided, the canvas edits this chapter's scenes (controlled) instead of the flat beat list. */
  chapter?: StoryChapter;
  /** Plan 07: commit handler for chapter-scene edits in controlled mode. */
  onScenesChange?: (scenes: StoryBeat[]) => void;
}

// Helper: Calculate automatic hierarchical tree layout via BFS
function calculateTreeLayout(beatsList: StoryBeatNode[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  if (beatsList.length === 0) return positions;

  const rootId = beatsList[0].sceneId;
  const levels: Record<string, number> = {};
  const queue: string[] = [rootId];
  levels[rootId] = 0;

  // BFS to determine depth levels
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentLevel = levels[currentId];
    const beat = beatsList.find((b) => b.sceneId === currentId);

    if (beat) {
      beat.choices.forEach((choice) => {
        if (choice.targetSceneId && levels[choice.targetSceneId] === undefined) {
          levels[choice.targetSceneId] = currentLevel + 1;
          queue.push(choice.targetSceneId);
        }
      });
    }
  }

  // Assign levels to any disconnected nodes
  let maxLevel = Math.max(...Object.values(levels), 0);
  beatsList.forEach((b) => {
    if (levels[b.sceneId] === undefined) {
      maxLevel++;
      levels[b.sceneId] = maxLevel;
    }
  });

  // Group nodes by level
  const nodesByLevel: Record<number, string[]> = {};
  Object.entries(levels).forEach(([nodeId, lvl]) => {
    if (!nodesByLevel[lvl]) nodesByLevel[lvl] = [];
    nodesByLevel[lvl].push(nodeId);
  });

  // Assign coordinate positions
  const canvasCenterX = 600;
  const levelHeight = 360;
  const nodeWidth = 420;

  Object.entries(nodesByLevel).forEach(([lvlStr, nodeIds]) => {
    const lvl = parseInt(lvlStr);
    const count = nodeIds.length;
    const totalWidth = (count - 1) * nodeWidth;
    const startX = canvasCenterX - totalWidth / 2;
    const y = 120 + lvl * levelHeight;

    nodeIds.forEach((id, idx) => {
      positions[id] = {
        x: count === 1 ? canvasCenterX : startX + idx * nodeWidth,
        y,
      };
    });
  });

  return positions;
}

export function StoryTreeCanvas({ story, isPersian = false, chapter, onScenesChange }: StoryTreeCanvasProps) {
  const isChapterMode = !!chapter;

  const [localBeats, setLocalBeats] = useState<StoryBeatNode[]>(() => {
    if (story.initialStoryBeats && story.initialStoryBeats.length > 0) {
      return story.initialStoryBeats as StoryBeatNode[];
    }
    return [
      {
        sceneId: story.initialSceneId || 'scene_prologue',
        locationId: story.worldBible.locations?.[0]?.id || 'loc_prologue',
        narrativeText: story.synopsis || 'The story begins in darkness...',
        choices: [
          {
            id: 'choice_1',
            text: isPersian ? 'بررسی محیط اطراف با دقت' : 'Carefully inspect the surroundings',
            style: 'inquisitive',
            riskLevel: 'low',
            targetDC: 10,
            requiredStatId: 'cunning',
            targetSceneId: 'scene_next',
          },
        ],
      },
    ];
  });

  // In chapter mode the beats are owned by the parent saga state; in flat mode
  // they are local component state.
  const beats: StoryBeatNode[] =
    isChapterMode && chapter ? ((chapter.scenes || []) as StoryBeatNode[]) : localBeats;

  // Unified mutation wrapper: routes edits to the saga (controlled) or local state.
  const commitBeats = (
    next: StoryBeatNode[] | ((prev: StoryBeatNode[]) => StoryBeatNode[])
  ) => {
    if (isChapterMode) {
      const value = typeof next === 'function' ? next(beats) : next;
      onScenesChange?.(value as StoryBeat[]);
    } else {
      setLocalBeats(next);
    }
  };

  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    beats[0]?.sceneId || 'scene_prologue'
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 30 });

  // Custom Drag Positions for Nodes
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>(
    () => calculateTreeLayout(beats)
  );

  // Dragging states
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // Plan responsiveness: fullscreen editing + two-finger pinch-zoom.
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Mobile: inspector renders as a bottom sheet instead of stacking below.
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchBaseRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
    zoom: number;
    panX: number;
    panY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // Plan responsiveness — fit the tree to narrow viewports on first paint
  // (a 360px node at zoom 1 overflows a 375px phone screen).
  const getFitZoom = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 1;
    if (rect.width >= 768) return 1; // desktop keeps native scale
    return Math.min(Math.max(Number((rect.width / 460).toFixed(2)), 0.35), 1);
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setZoom(getFitZoom());
    // Run once after mount when the canvas has a measurable box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Re-seed beats + layout from the story when it changes.
  // Intentional setState-in-effect: re-derives from `story` on change, but beats
  // are also mutated by tree edits and positions by drag, so a pure useMemo
  // derivation is impractical.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!isChapterMode && story.initialStoryBeats && story.initialStoryBeats.length > 0) {
      const loadedBeats = story.initialStoryBeats as StoryBeatNode[];
      setLocalBeats(loadedBeats);
      setSelectedSceneId(loadedBeats[0]?.sceneId || 'scene_prologue');
      setNodePositions(calculateTreeLayout(loadedBeats));
    }
  }, [story, isChapterMode]);

  // Plan 07: re-seed layout when switching between chapters.
  // Keyed on scene-id signature so intra-chapter drag positions survive commits.
  const chapterSceneKey = chapter ? (chapter.scenes || []).map((s) => s.sceneId).join('|') : '';
  const [lastChapterKey, setLastChapterKey] = useState(chapterSceneKey);
  useEffect(() => {
    if (isChapterMode && chapter && lastChapterKey !== chapterSceneKey) {
      setLastChapterKey(chapterSceneKey);
      const scenes = (chapter.scenes || []) as StoryBeatNode[];
      setNodePositions(calculateTreeLayout(scenes));
      setSelectedSceneId(scenes[0]?.sceneId || '');
      setPan({ x: 40, y: 30 });
      setZoom(getFitZoom());
    }
  }, [chapterSceneKey, isChapterMode, chapter, lastChapterKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedBeat = useMemo(
    () => beats.find((b) => b.sceneId === selectedSceneId) || beats[0],
    [beats, selectedSceneId]
  );

  // Auto-Arrange Tree
  const handleAutoArrange = () => {
    setNodePositions(calculateTreeLayout(beats));
    setPan({ x: 40, y: 30 });
    setZoom(1);
  };

  // Derived Branch Edges from Choices (from parent beat -> targetSceneId)
  const branchEdges = useMemo(() => {
    const edgesList: Array<{
      id: string;
      sourceId: string;
      targetId: string;
      choiceText: string;
      dcLabel: string;
      color: string;
    }> = [];

    beats.forEach((beat) => {
      beat.choices.forEach((choice) => {
        if (choice.targetSceneId && nodePositions[choice.targetSceneId]) {
          const color =
            choice.riskLevel === 'high'
              ? '#EF4444'
              : choice.riskLevel === 'medium'
              ? '#F59E0B'
              : '#10B981';

          const dcLabel = choice.targetDC
            ? `DC ${choice.targetDC} [${choice.requiredStatId || 'might'}]`
            : choice.riskLevel.toUpperCase();

          edgesList.push({
            id: `edge-${beat.sceneId}-${choice.id}-${choice.targetSceneId}`,
            sourceId: beat.sceneId,
            targetId: choice.targetSceneId,
            choiceText: choice.text,
            dcLabel,
            color,
          });
        }
      });
    });

    return edgesList;
  }, [beats, nodePositions]);

  // Mouse Dragging & Panning Handlers
  const handleCanvasMouseDown = (e: React.PointerEvent) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (activePointersRef.current.size === 2) {
      // Second finger down → switch from pan/node-drag to pinch-zoom.
      setIsDraggingCanvas(false);
      setDraggedNodeId(null);
      const pts = [...activePointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      pinchBaseRef.current = {
        dist,
        midX: (pts[0].x + pts[1].x) / 2,
        midY: (pts[0].y + pts[1].y) / 2,
        zoom,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleNodeMouseDown = (e: React.PointerEvent, sceneId: string) => {
    e.stopPropagation();
    setDraggedNodeId(sceneId);
    setSelectedSceneId(sceneId);
  };

  // Plan responsiveness — Pointer Events unify mouse + touch; two active
  // pointers drive anchored pinch-zoom instead of panning.
  const handleMouseMove = (e: React.PointerEvent) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const base = pinchBaseRef.current;
    if (base && activePointersRef.current.size >= 2) {
      const pts = [...activePointersRef.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;

      const nextZoom = Math.min(
        Math.max(Number((base.zoom * (dist / base.dist)).toFixed(2)), 0.35),
        2.5
      );
      const scale = nextZoom / base.zoom;
      // Keep the world point under the pinch midpoint anchored.
      setZoom(nextZoom);
      setPan({
        x: midX - (base.midX - base.panX) * scale,
        y: midY - (base.midY - base.panY) * scale,
      });
      return;
    }

    if (isDraggingCanvas) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else if (draggedNodeId) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = (e.clientX - rect.left - pan.x) / zoom;
      const mouseY = (e.clientY - rect.top - pan.y) / zoom;

      setNodePositions((prev) => ({
        ...prev,
        [draggedNodeId]: { x: mouseX, y: mouseY },
      }));
    }
  };

  const handleMouseUp = (e?: React.PointerEvent) => {
    if (e) activePointersRef.current.delete(e.pointerId);
    pinchBaseRef.current = null;

    if (activePointersRef.current.size === 1 && !draggedNodeId) {
      // Pinch ended with one finger still down → resume panning seamlessly.
      const remaining = [...activePointersRef.current.values()][0];
      setIsDraggingCanvas(true);
      setDragStart({ x: remaining.x - pan.x, y: remaining.y - pan.y });
      return;
    }
    if (activePointersRef.current.size === 0) {
      setIsDraggingCanvas(false);
      setDraggedNodeId(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(Math.max(Number((prev + zoomDelta).toFixed(2)), 0.35), 2.2));
  };

  // Beat Operations
  const handleAddBeat = () => {
    const newId = `scene_${Date.now().toString().slice(-4)}`;
    const parentPos = nodePositions[selectedSceneId] || { x: 600, y: 120 };

    const newBeat: StoryBeatNode = {
      sceneId: newId,
      locationId: story.worldBible.locations?.[0]?.id || 'loc_dungeon_cell',
      narrativeText: isPersian
        ? 'بخش جدیدی از روایت داستانی...'
        : 'A new chapter in the unfolding tale...',
      choices: [
        {
          id: `choice_${Date.now().toString().slice(-3)}_1`,
          text: isPersian ? 'پیشروی محتاطانه' : 'Advance cautiously',
          style: 'defensive',
          riskLevel: 'medium',
          targetDC: 12,
          requiredStatId: 'agility',
        },
      ],
    };

    // Position new node nicely below the active selected scene
    setNodePositions((prev) => ({
      ...prev,
      [newId]: {
        x: parentPos.x + (Math.random() - 0.5) * 80,
        y: parentPos.y + 360,
      },
    }));

    commitBeats((prev) => [...prev, newBeat]);
    setSelectedSceneId(newId);
    // Mobile: surface the editor sheet immediately for the freshly added beat.
    setIsInspectorOpen(true);
  };

  const handleUpdateNarrative = (text: string) => {
    commitBeats((prev) =>
      prev.map((b) => (b.sceneId === selectedSceneId ? { ...b, narrativeText: text } : b))
    );
  };

  const handleUpdateLocation = (locId: string) => {
    commitBeats((prev) =>
      prev.map((b) => (b.sceneId === selectedSceneId ? { ...b, locationId: locId } : b))
    );
  };

  const handleUpdateImageUrl = (url: string) => {
    commitBeats((prev) =>
      prev.map((b) =>
        b.sceneId === selectedSceneId ? { ...b, imageUrl: url.trim() || undefined } : b
      )
    );
  };

  const handleAddChoice = () => {
    if (!selectedBeat) return;
    const newChoiceId = `choice_${Date.now().toString().slice(-3)}`;
    const nextCandidate = beats.find((b) => b.sceneId !== selectedSceneId);

    const newChoice: StoryBeatChoice = {
      id: newChoiceId,
      text: isPersian ? 'اقدام جدید بازیکن...' : 'New player decision...',
      style: 'inquisitive',
      riskLevel: 'medium',
      targetDC: 12,
      requiredStatId: 'cunning',
      targetSceneId: nextCandidate?.sceneId,
    };

    commitBeats((prev) =>
      prev.map((b) =>
        b.sceneId === selectedSceneId ? { ...b, choices: [...b.choices, newChoice] } : b
      )
    );
  };

  const handleUpdateChoice = (choiceId: string, updatedFields: Partial<StoryBeatChoice>) => {
    commitBeats((prev) =>
      prev.map((b) => {
        if (b.sceneId !== selectedSceneId) return b;
        return {
          ...b,
          choices: b.choices.map((c) => (c.id === choiceId ? { ...c, ...updatedFields } : c)),
        };
      })
    );
  };

  const handleDeleteBeat = (sceneId: string) => {
    const nextBeats = beats
      .filter((b) => b.sceneId !== sceneId)
      .map((b) => ({
        ...b,
        choices: b.choices.map((c) =>
          c.targetSceneId === sceneId ? { ...c, targetSceneId: undefined } : c
        ),
      }));

    commitBeats(nextBeats);
    setNodePositions((prev) => {
      const next = { ...prev };
      delete next[sceneId];
      return next;
    });

    if (selectedSceneId === sceneId) {
      setSelectedSceneId(nextBeats[0]?.sceneId || '');
    }
  };

  const handleDeleteChoice = (choiceId: string) => {
    commitBeats((prev) =>
      prev.map((b) => {
        if (b.sceneId !== selectedSceneId) return b;
        return {
          ...b,
          choices: b.choices.filter((c) => c.id !== choiceId),
        };
      })
    );
  };

  const getRiskBadge = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'high':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
            {isPersian ? 'خطر بالا' : 'High'}
          </span>
        );
      case 'medium':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
            {isPersian ? 'خطر متوسط' : 'Medium'}
          </span>
        );
      case 'low':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {isPersian ? 'ایمن' : 'Low'}
          </span>
        );
    }
  };

  const t = {
    addScene: isPersian ? '+ ایجاد صحنه جدید' : '+ Add New Beat',
    autoArrange: isPersian ? 'چیدمان هوشمند درخت' : 'Auto-Arrange Tree',
    editorTitle: isPersian ? 'ویرایشگر صحنه و شاخه‌های انتخاب' : 'Beat & Decision Inspector',
    sceneId: isPersian ? 'شناسه صحنه:' : 'Scene Identifier:',
    location: isPersian ? 'مکان وقوع:' : 'Location Context:',
    narrativeProse: isPersian ? 'متن روایت داستانی:' : 'Literary Narrative Prose:',
    choicesTitle: isPersian ? 'شاخه‌های تصمیم بازیکن (Choices)' : 'Player Decision Branches',
    addChoice: isPersian ? '+ افزودن انتخاب جدید' : '+ Add Choice Branch',
    targetDc: isPersian ? 'سختی تاس (DC):' : 'Target DC:',
    requiredStat: isPersian ? 'مهارت مورد نیاز:' : 'Attribute Check:',
    risk: isPersian ? 'سطح خطر:' : 'Risk Level:',
    leadsTo: isPersian ? 'هدایت به صحنه مقصد:' : 'Leads to Destination:',
    zoomIn: isPersian ? 'بزرگ‌نمایی' : 'Zoom In',
    zoomOut: isPersian ? 'کوچک‌نمایی' : 'Zoom Out',
    reset: isPersian ? 'بازنشانی نما' : 'Reset View',
    legend: isPersian ? 'شاخه‌های تصمیم:' : 'Decision Branches:',
    editScene: isPersian ? 'ویرایش صحنه' : 'Edit Scene',
    closeEditor: isPersian ? 'بستن ویرایشگر' : 'Close editor',
    fsEnter: isPersian ? 'حالت تمام‌صفحه' : 'Fullscreen canvas',
    fsExit: isPersian ? 'خروج از تمام‌صفحه' : 'Exit fullscreen',
  };

    const inspectorBody = (
      <>
        {selectedBeat ? (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <GitBranch className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-zinc-100">{t.editorTitle}</h3>
              </div>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl">
                {selectedBeat.sceneId}
              </span>
              <button
                onClick={() => handleDeleteBeat(selectedBeat.sceneId)}
                title={isPersian ? 'حذف این صحنه' : 'Delete this scene'}
                className="text-zinc-500 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-rose-500/10"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsInspectorOpen(false)}
                title={t.closeEditor}
                className="md:hidden text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
              >
                ✕
              </button>
            </div>

            {/* Scene ID & Location Picker */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  {t.location}
                </label>
                <select
                  value={selectedBeat.locationId}
                  onChange={(e) => handleUpdateLocation(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                >
                  {(story.worldBible.locations || []).map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Narrative Prose Editor */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  {t.narrativeProse}
                </label>
                <textarea
                  rows={4}
                  value={selectedBeat.narrativeText}
                  onChange={(e) => handleUpdateNarrative(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-2xl p-3.5 text-xs text-zinc-100 leading-relaxed placeholder-zinc-600 focus:outline-none focus:border-amber-500/80"
                />
              </div>

              {/* Scene Image URL (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    {isPersian ? 'تصویر صحنه (اختیاری):' : 'Scene Image URL (Optional):'}
                  </label>
                  {selectedBeat.imageUrl && (
                    <button
                      type="button"
                      onClick={() => handleUpdateImageUrl('')}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-normal"
                    >
                      {isPersian ? 'حذف تصویر' : 'Clear'}
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/... or https://..."
                  value={selectedBeat.imageUrl || ''}
                  onChange={(e) => handleUpdateImageUrl(e.target.value)}
                  className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500/80"
                />
                {selectedBeat.imageUrl && (
                  <div className="mt-2 relative rounded-xl overflow-hidden border border-zinc-800 h-28 bg-zinc-950">
                    <img
                      src={selectedBeat.imageUrl}
                      alt="Scene Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Choice Branches Configurator */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  {t.choicesTitle}
                </span>
                <button
                  onClick={handleAddChoice}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> {t.addChoice}
                </button>
              </div>

              <div className="space-y-3">
                {selectedBeat.choices.map((choice, cIdx) => (
                  <div
                    key={choice.id}
                    className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3 hover:border-zinc-700 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        #{cIdx + 1}
                      </span>
                      <button
                        onClick={() => handleDeleteChoice(choice.id)}
                        className="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Choice Action Text */}
                    <input
                      type="text"
                      value={choice.text}
                      onChange={(e) => handleUpdateChoice(choice.id, { text: e.target.value })}
                      placeholder="Choice action text..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                    />

                    {/* Target Destination Scene */}
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1 font-bold">
                        {t.leadsTo}
                      </label>
                      <select
                        value={choice.targetSceneId || ''}
                        onChange={(e) =>
                          handleUpdateChoice(choice.id, { targetSceneId: e.target.value })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-amber-300 font-mono"
                      >
                        <option value="">-- None (Endpoint) --</option>
                        {beats
                          .filter((b) => b.sceneId !== selectedBeat.sceneId)
                          .map((b) => (
                            <option key={b.sceneId} value={b.sceneId}>
                              {b.sceneId} ({b.locationId})
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Parameters Grid */}
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      {/* Risk Level */}
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">{t.risk}</label>
                        <select
                          value={choice.riskLevel}
                          onChange={(e) =>
                            handleUpdateChoice(choice.id, {
                              riskLevel: e.target.value as 'low' | 'medium' | 'high',
                            })
                          }
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-zinc-200"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>

                      {/* Target DC */}
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">
                          {t.targetDc}
                        </label>
                        <input
                          type="number"
                          value={choice.targetDC || 12}
                          onChange={(e) =>
                            handleUpdateChoice(choice.id, {
                              targetDC: parseInt(e.target.value) || 10,
                            })
                          }
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-zinc-200 font-mono"
                        />
                      </div>

                      {/* Required Attribute */}
                      <div>
                        <label className="text-[10px] text-zinc-500 block mb-1">
                          {t.requiredStat}
                        </label>
                        <select
                          value={choice.requiredStatId || 'might'}
                          onChange={(e) =>
                            handleUpdateChoice(choice.id, { requiredStatId: e.target.value })
                          }
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-zinc-200"
                        >
                          {(story.rpgSystem.stats || []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <BookOpen className="w-12 h-12 text-zinc-700 mb-3" />
            <h4 className="text-sm font-bold text-zinc-400">Select a Beat</h4>
          </div>
        )}

        <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
          <span>{chapter ? `${chapter.chapterNumber}. ${chapter.title}` : story.title}</span>
          <span className="font-mono">{beats.length} Beats Defined</span>
        </div>
      </>
    );

  return (
    <>
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-[80] bg-[#080a14]'
          // z-0 creates a stacking context: every descendant (inspector sheet,
          // floating buttons, transformed layers) is trapped BELOW the page
          // bars (banner/tabs z-40) and popups, no matter its inner z-index.
          : 'relative z-0 w-full h-[72vh] md:h-[840px]'
      } rounded-3xl border border-zinc-800/80 overflow-hidden shadow-2xl flex flex-col md:flex-row select-none`}
    >
      {/* Visual Flowchart Canvas */}
      <div
        ref={canvasRef}
        onPointerDown={handleCanvasMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onPointerLeave={handleMouseUp}
        onPointerCancel={handleMouseUp}
        onWheel={handleWheel}
        className="relative flex-1 h-full cursor-grab active:cursor-grabbing overflow-hidden bg-gradient-to-b from-[#080a14] via-[#0a0c1b] to-[#06070e] touch-none md:touch-auto"
      >
        {/* Background Grid */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#F59E0B 1.2px, transparent 1.2px)`,
            backgroundSize: `${34 * zoom}px ${34 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* Top Control Bar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between gap-3 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* Add Scene Button */}
            <button
              onClick={handleAddBeat}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl shadow-amber-500/20 transition-all transform hover:scale-105"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{t.addScene}</span>
            </button>

            {/* Auto-Arrange Layout */}
            <button
              onClick={handleAutoArrange}
              className="flex items-center gap-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/80 text-amber-400 px-3.5 py-2.5 rounded-2xl text-xs font-bold shadow-xl backdrop-blur-md transition-all"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{t.autoArrange}</span>
            </button>
          </div>

          {/* Zoom / Reset Controls */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-700/80 rounded-2xl p-1 shadow-xl backdrop-blur-md pointer-events-auto">
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2.0))}
              title={t.zoomIn}
              className="p-2 rounded-xl text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-all"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
              title={t.zoomOut}
              className="p-2 rounded-xl text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-all"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 40, y: 30 });
              }}
              title={t.reset}
              className="p-2 rounded-xl text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsFullscreen((v) => !v)}
              title={isFullscreen ? t.fsExit : t.fsEnter}
              className="p-2 rounded-xl text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-all"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Transformable Canvas Surface */}
        <div
          className="absolute inset-0 transition-transform duration-75 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG Connection Edges Layer */}
          <svg className="absolute top-0 left-0 w-[3400px] h-[3400px] pointer-events-none overflow-visible z-0">
            <defs>
              <marker
                id="arrow-amber"
                viewBox="0 0 10 10"
                refX="26"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B" />
              </marker>
              <marker
                id="arrow-green"
                viewBox="0 0 10 10"
                refX="26"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#10B981" />
              </marker>
              <marker
                id="arrow-red"
                viewBox="0 0 10 10"
                refX="26"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
              </marker>
            </defs>

            {branchEdges.map((edge) => {
              const srcPos = nodePositions[edge.sourceId];
              const tgtPos = nodePositions[edge.targetId];
              if (!srcPos || !tgtPos) return null;

              const isHighlighted =
                selectedSceneId === edge.sourceId || selectedSceneId === edge.targetId;

              // Node box dimensions
              const srcY = srcPos.y + 110;
              const tgtY = tgtPos.y - 110;

              const midY = (srcY + tgtY) / 2;
              const pathD = `M ${srcPos.x} ${srcY} C ${srcPos.x} ${midY}, ${tgtPos.x} ${midY}, ${tgtPos.x} ${tgtY}`;

              return (
                <g key={edge.id}>
                  {/* Outer Glow */}
                  {isHighlighted && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth={8}
                      strokeOpacity={0.35}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Main Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={isHighlighted ? 3.5 : 2.2}
                    strokeOpacity={isHighlighted ? 1 : 0.75}
                    markerEnd={
                      edge.color === '#EF4444'
                        ? 'url(#arrow-red)'
                        : edge.color === '#10B981'
                        ? 'url(#arrow-green)'
                        : 'url(#arrow-amber)'
                    }
                  />

                  {/* DC Check Pill Badge on Line */}
                  <g transform={`translate(${(srcPos.x + tgtPos.x) / 2}, ${midY})`}>
                    <rect
                      x={-54}
                      y={-11}
                      width={108}
                      height={22}
                      rx={11}
                      fill="#0C0E1B"
                      stroke={edge.color}
                      strokeWidth={isHighlighted ? 2 : 1.2}
                    />
                    <text
                      x={0}
                      y={4}
                      fill={edge.color}
                      fontSize="9.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="select-none font-mono"
                    >
                      {edge.dcLabel}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Story Beat Nodes */}
          {beats.map((beat, idx) => {
            const isSelected = selectedSceneId === beat.sceneId;
            const pos = nodePositions[beat.sceneId] || { x: 600, y: 120 + idx * 360 };

            return (
              <div
                key={beat.sceneId}
                onPointerDown={(e) => handleNodeMouseDown(e, beat.sceneId)}
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute w-[360px] cursor-grab active:cursor-grabbing transition-transform duration-75 z-10 ${
                  isSelected ? 'scale-105 z-30' : 'hover:scale-[1.02]'
                }`}
              >
                <div
                  className={`p-5 rounded-3xl border-2 backdrop-blur-xl shadow-2xl transition-all ${
                    isSelected
                      ? 'bg-zinc-900 border-amber-400 ring-4 ring-amber-400/30 shadow-amber-500/20'
                      : 'bg-zinc-950/90 border-zinc-800/90 hover:border-zinc-600'
                  }`}
                >
                  {/* Top Meta */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-mono text-zinc-300 font-bold">
                        {beat.sceneId}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-sky-400 bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {beat.locationId}
                    </span>
                    {isSelected && (
                      <button
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBeat(beat.sceneId);
                        }}
                        title={isPersian ? 'حذف این صحنه' : 'Delete this scene'}
                        className="text-zinc-500 hover:text-rose-400 transition-colors p-1 rounded-lg hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Scene Image Thumbnail (if present) */}
                  {beat.imageUrl && (
                    <div className="mb-3 rounded-2xl overflow-hidden h-28 border border-zinc-800/80 bg-zinc-950">
                      <img
                        src={beat.imageUrl}
                        alt={beat.sceneId}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Prose Preview */}
                  <p className="text-xs text-zinc-300 line-clamp-3 leading-relaxed mb-3 font-serif">
                    {beat.narrativeText}
                  </p>

                  {/* Choices List */}
                  <div className="space-y-1.5 pt-3 border-t border-zinc-800/80">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">
                      {isPersian ? 'شاخه‌های خروجی این صحنه:' : 'Exit Branches:'} ({beat.choices.length})
                    </span>
                    {beat.choices.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 gap-2"
                      >
                        <span className="truncate max-w-[180px] flex items-center gap-1.5">
                          <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                          {c.text}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {c.targetDC && (
                            <span className="text-[9.5px] font-mono font-bold text-amber-300 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                              DC {c.targetDC}
                            </span>
                          )}
                          {getRiskBadge(c.riskLevel)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Legend (hidden on phones to declutter) */}
        <div className="hidden sm:flex absolute bottom-4 left-4 z-20 items-center gap-3 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl px-4 py-2 text-[11px] text-zinc-400 backdrop-blur-md pointer-events-auto shadow-lg">
          <span className="font-bold text-zinc-300">{t.legend}</span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> {isPersian ? 'مسیر کم‌خطر' : 'Low Risk Branch'}
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> {isPersian ? 'مسیر مهارت‌آزمایی' : 'DC Skill Check'}
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> {isPersian ? 'مسیر پرخطر / نبرد' : 'High Risk Branch'}
          </span>
        </div>

        {/* Mobile: floating editor trigger — canvas keeps the full screen */}
        {!isInspectorOpen && (
          <button
            type="button"
            onClick={() => setIsInspectorOpen(true)}
            className="md:hidden absolute bottom-4 right-4 z-30 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl shadow-amber-500/30 transition-all cursor-pointer"
          >
            <GitBranch className="w-3.5 h-3.5" />
            {t.editScene}
          </button>
        )}
      </div>

      {/* Beat Inspector: side panel on desktop (mobile uses the portal sheet below) */}
      <div className="hidden md:flex md:w-[440px] bg-[#0a0c18] border-t-0 md:border-t-0 md:border-l border-zinc-800/80 p-6 flex-col justify-between overflow-y-auto z-30 shadow-2xl">
        {inspectorBody}
      </div>
      {/* Mobile inspector sheet - portaled to document.body so it escapes
          every stacking context (canvas z-0 trap, nav, blurred bars). */}
      {isInspectorOpen &&
        createPortal(
          <div className="md:hidden fixed inset-x-0 bottom-0 z-[95] max-h-[72vh] rounded-t-3xl bg-[#0a0c18] border-t border-zinc-800/80 p-6 flex flex-col overflow-y-auto shadow-2xl animate-fadeIn">
            <button
              type="button"
              onClick={() => setIsInspectorOpen(false)}
              className="self-end text-zinc-400 hover:text-white text-sm p-1 mb-1 cursor-pointer"
              title={t.closeEditor}
            >
              {'\u2715'}
            </button>
            {inspectorBody}
          </div>,
          document.body
        )}
      </div>
      </>
    );
  }