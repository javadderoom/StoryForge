'use client';

import React, { useState, useMemo, useRef } from 'react';
import { WorldBible, WorldLocation, NPCDossier, Faction, WorldLaw } from '@/lib/types';
import { useStudioStory } from '@/lib/context/StudioStoryContext';
import {
  MapPin,
  User,
  Users,
  Shield,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Globe,
  Heart,
  Lock,
  Plus,
  Trash2,
  Link2,
  Sparkles,
  Award,
  Skull,
  Sun,
} from 'lucide-react';
import { WorldArtifact, WorldCreature, WorldDeity } from '@/lib/types';

export type NodeType = 'location' | 'npc' | 'faction' | 'law' | 'artifact' | 'creature' | 'deity';

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  type: NodeType;
  x: number;
  y: number;
  data: WorldLocation | NPCDossier | Faction | WorldLaw | WorldArtifact | WorldCreature | WorldDeity;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  color: string;
  dashed?: boolean;
}

interface LoreGraphCanvasProps {
  worldBible: WorldBible;
  isPersian?: boolean;
}

export function LoreGraphCanvas({ worldBible, isPersian = false }: LoreGraphCanvasProps) {
  const { addRelation, deleteRelation } = useStudioStory();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 30 });

  // Relation creation state
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkTargetId, setNewLinkTargetId] = useState('');
  const [newLinkType, setNewLinkType] = useState<'path' | 'residence' | 'territory' | 'rival' | 'ally'>('path');

  // Dragging state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  // Plan responsiveness: fullscreen + pinch-zoom + mobile inspector sheet.
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Type Filters
  const [visibleTypes, setVisibleTypes] = useState<Record<NodeType, boolean>>({
    location: true,
    npc: true,
    faction: true,
    law: true,
    artifact: true,
    creature: true,
    deity: true,
  });

  const canvasRef = useRef<HTMLDivElement>(null);

  // Build clean deterministic graph layout
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodesList: GraphNode[] = [];
    const edgesList: GraphEdge[] = [];

    const locs = worldBible.locations || [];
    const npcs = worldBible.npcs || [];
    const factions = worldBible.factions || [];
    const laws = worldBible.laws || [];

    // 1. Factions (Top Row: Y = 90)
    const seenFactionPairs = new Set<string>();

    // 1a. Explicit 5-state spectrum relations
    (worldBible.factionRelations || []).forEach((rel) => {
      const edgeKey = [rel.sourceFactionId, rel.targetFactionId].sort().join('--');
      if (seenFactionPairs.has(edgeKey)) return;
      seenFactionPairs.add(edgeKey);

      // Skip unnoted neutral relations to keep canvas readable
      if (rel.value === 'neutral' && !rel.note) return;

      let color = '#94A3B8';
      let label = isPersian ? 'بی‌طرف' : 'Neutral';
      let dashed = true;

      if (rel.value === 'allied') {
        color = '#10B981'; // Emerald
        label = isPersian ? 'متحد رسمی' : 'Sworn Ally';
        dashed = false;
      } else if (rel.value === 'favorable') {
        color = '#38BDF8'; // Sky Blue
        label = isPersian ? 'هم‌پیمان پنهان' : 'Favorable';
        dashed = true;
      } else if (rel.value === 'rival') {
        color = '#F59E0B'; // Amber
        label = isPersian ? 'رقیب' : 'Rival';
        dashed = true;
      } else if (rel.value === 'hostile') {
        color = '#EF4444'; // Red
        label = isPersian ? 'دشمن خونی' : 'Blood Enemy';
        dashed = false;
      }

      edgesList.push({
        id: `edge-fac-rel-${edgeKey}`,
        source: rel.sourceFactionId,
        target: rel.targetFactionId,
        label: rel.note ? `${label}: ${rel.note}` : label,
        color,
        dashed,
      });
    });

    factions.forEach((fac, idx) => {
      const x = 240 + idx * 360;
      const y = 90;
      nodesList.push({
        id: fac.id,
        label: fac.name,
        sublabel: fac.alignment,
        type: 'faction',
        x,
        y,
        data: fac,
      });

      // Faction territories
      (fac.territoryIds || []).forEach((tId) => {
        edgesList.push({
          id: `edge-fac-terr-${fac.id}-${tId}`,
          source: fac.id,
          target: tId,
          label: isPersian ? 'قلمرو حاکمیت' : 'Controls Territory',
          color: '#A855F7', // Purple
        });
      });

      // Fallback: Legacy alliances if not in factionRelations
      (fac.alliedFactionIds || []).forEach((aId) => {
        const edgeKey = [fac.id, aId].sort().join('--');
        if (!seenFactionPairs.has(edgeKey)) {
          seenFactionPairs.add(edgeKey);
          edgesList.push({
            id: `edge-fac-ally-${edgeKey}`,
            source: fac.id,
            target: aId,
            label: isPersian ? 'متحد رسمی' : 'Sworn Ally',
            color: '#10B981', // Emerald Green
            dashed: false,
          });
        }
      });

      // Fallback: Legacy rivalries if not in factionRelations
      (fac.rivalFactionIds || []).forEach((rId) => {
        const edgeKey = [fac.id, rId].sort().join('--');
        if (!seenFactionPairs.has(edgeKey)) {
          seenFactionPairs.add(edgeKey);
          edgesList.push({
            id: `edge-fac-rival-${edgeKey}`,
            source: fac.id,
            target: rId,
            label: isPersian ? 'دشمن خونی' : 'Blood Enemy',
            color: '#EF4444', // Red
            dashed: false,
          });
        }
      });
    });

    // 2. Locations (Middle Row: Y = 280)
    const seenPaths = new Set<string>();
    locs.forEach((loc, idx) => {
      const x = 160 + idx * 300;
      const y = 280;
      nodesList.push({
        id: loc.id,
        label: loc.name,
        sublabel: loc.region,
        type: 'location',
        x,
        y,
        data: loc,
      });

      // Location Paths
      (loc.connectedLocationIds || []).forEach((tId) => {
        const edgeKey = [loc.id, tId].sort().join('--');
        if (!seenPaths.has(edgeKey)) {
          seenPaths.add(edgeKey);
          edgesList.push({
            id: `edge-loc-path-${edgeKey}`,
            source: loc.id,
            target: tId,
            label: isPersian ? 'مسیر پیوسته' : 'Connected Path',
            color: '#38BDF8', // Cyan
          });
        }
      });
    });

    // 3. NPCs (Row between locations & laws: Y = 460)
    npcs.forEach((npc, idx) => {
      const x = 200 + idx * 340;
      const y = 460;
      nodesList.push({
        id: npc.id,
        label: npc.name,
        sublabel: npc.title,
        type: 'npc',
        x,
        y,
        data: npc,
      });

      // NPC in Location
      if (npc.currentLocationId) {
        edgesList.push({
          id: `edge-npc-loc-${npc.id}-${npc.currentLocationId}`,
          source: npc.id,
          target: npc.currentLocationId,
          label: isPersian ? 'محل استقرار' : 'Stationed At',
          color: '#F59E0B', // Amber
        });
      }

      // NPC in Faction
      if (npc.factionId) {
        edgesList.push({
          id: `edge-npc-fac-${npc.id}-${npc.factionId}`,
          source: npc.id,
          target: npc.factionId,
          label: isPersian ? 'عضو جناح' : 'Member Of',
          color: '#818CF8', // Indigo
        });
      }
    });

    // 4. Laws (Bottom Row: Y = 620 - Global Standalone World Laws)
    laws.forEach((law, idx) => {
      const x = 220 + idx * 380;
      const y = 620;
      nodesList.push({
        id: law.id,
        label: law.rule,
        sublabel: law.category,
        type: 'law',
        x,
        y,
        data: law,
      });
    });

    // 5. Mythic Relics & Artifacts (Y = 360 - Stationed with Holders)
    const artifacts = worldBible.artifacts || [];
    artifacts.forEach((art, idx) => {
      const x = 280 + idx * 380;
      const y = 370;
      nodesList.push({
        id: art.id,
        label: art.name,
        sublabel: isPersian ? `عتیقه ${art.rarity}` : `${art.rarity} Relic`,
        type: 'artifact',
        x,
        y,
        data: art,
      });

      if (art.currentHolderId && art.currentHolderId !== 'unknown') {
        edgesList.push({
          id: `edge-art-holder-${art.id}-${art.currentHolderId}`,
          source: art.id,
          target: art.currentHolderId,
          label: isPersian ? 'مقر نگهداری' : 'Held At',
          color: '#F59E0B', // Amber
        });
      }
    });

    // 6. Bestiary Creatures (Y = 490 - Stationed at Habitat Locations)
    const creatures = worldBible.bestiary || [];
    creatures.forEach((c, idx) => {
      const x = 200 + idx * 360;
      const y = 490;
      nodesList.push({
        id: c.id,
        label: c.name,
        sublabel: isPersian ? `هیولا (خطر ${c.dangerLevel})` : `${c.speciesCategory} (D:${c.dangerLevel})`,
        type: 'creature',
        x,
        y,
        data: c,
      });

      (c.habitatLocationIds || []).forEach((locId) => {
        edgesList.push({
          id: `edge-creature-habitat-${c.id}-${locId}`,
          source: c.id,
          target: locId,
          label: isPersian ? 'زیستگاه' : 'Habitat',
          color: '#F43F5E', // Rose
        });
      });
    });

    // 7. Pantheons & Deities (Y = 20 - Celestial Orbit)
    const religions = worldBible.religions || [];
    religions.forEach((d, idx) => {
      const x = 320 + idx * 400;
      const y = 20;
      nodesList.push({
        id: d.id,
        label: d.name,
        sublabel: isPersian ? `ایزد ${d.domain}` : `${d.domain} Deity`,
        type: 'deity',
        x,
        y,
        data: d,
      });

      (d.affiliatedFactionIds || []).forEach((fId) => {
        edgesList.push({
          id: `edge-deity-fac-${d.id}-${fId}`,
          source: d.id,
          target: fId,
          label: isPersian ? 'آیین جناح' : 'Patron Of',
          color: '#F59E0B', // Gold
        });
      });

      (d.holyLocationIds || []).forEach((lId) => {
        edgesList.push({
          id: `edge-deity-loc-${d.id}-${lId}`,
          source: d.id,
          target: lId,
          label: isPersian ? 'معبد مقدس' : 'Holy Site',
          color: '#A855F7', // Purple
        });
      });
    });

    // 8. Interpersonal Drama Bonds (NPC Chords)
    const dramaBonds = worldBible.dramaBonds || [];
    dramaBonds.forEach((bond) => {
      const color = bond.affinity < 0 ? '#F43F5E' : bond.affinity > 0 ? '#10B981' : '#A855F7';
      edgesList.push({
        id: `edge-drama-${bond.id}`,
        source: bond.sourceNpcId,
        target: bond.targetNpcId,
        label: `${bond.relationTypeId} (${bond.affinity > 0 ? `+${bond.affinity}` : bond.affinity})`,
        color,
      });
    });

    // 9. Custom Lore Relations (Author Defined)
    const relTypeMap = new Map((worldBible.ontology?.relationTypes || []).map((r) => [r.id, r]));
    (worldBible.customRelations || []).forEach((cRel) => {
      const relMeta = relTypeMap.get(cRel.relationTypeId);
      edgesList.push({
        id: `edge-custom-${cRel.id}`,
        source: cRel.sourceId,
        target: cRel.targetId,
        label: cRel.customLabel || relMeta?.name || cRel.relationTypeId,
        color: relMeta?.color || '#38BDF8',
      });
    });

    // Build an id-or-name -> nodeId resolver so relations authored with a
    // human-readable name (e.g. by the AI adviser) still attach to the right
    // graph node instead of being silently dropped.
    const nodeAlias = new Map<string, string>();
    nodesList.forEach((n) => {
      nodeAlias.set(n.id, n.id);
      if (n.label) nodeAlias.set(n.label.toLowerCase(), n.id);
    });
    const resolveRef = (ref: string): string =>
      nodeAlias.get(ref) || nodeAlias.get((ref || '').toLowerCase()) || ref;

    const remappedEdges = edgesList
      .map((e) => ({
        ...e,
        source: resolveRef(e.source),
        target: resolveRef(e.target),
      }))
      .filter((e) => e.source !== e.target);

    return { initialNodes: nodesList, initialEdges: remappedEdges };
  }, [worldBible, isPersian]);

  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const edges = initialEdges;

  // Update when story changes while preserving custom dragged positions.
  // Intentional setState-in-effect: merges new story data with persisted drag
  // positions. Positions are mutated imperatively during drag, so a pure
  // useMemo derivation is impractical.
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    setNodes((prevNodes) => {
      const posMap = new Map(prevNodes.map((n) => [n.id, { x: n.x, y: n.y }]));
      return initialNodes.map((n) => {
        const existingPos = posMap.get(n.id);
        return existingPos ? { ...n, x: existingPos.x, y: existingPos.y } : n;
      });
    });
  }, [initialNodes]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Filters
  const visibleNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (!visibleTypes[n.type]) return false;
      if (searchQuery.trim().length === 0) return true;
      const q = searchQuery.toLowerCase();
      return (
        n.label.toLowerCase().includes(q) ||
        (n.sublabel && n.sublabel.toLowerCase().includes(q)) ||
        n.id.toLowerCase().includes(q)
      );
    });
  }, [nodes, visibleTypes, searchQuery]);

  const visibleNodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    visibleNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [visibleNodes]);

  // Filter edges where BOTH source and target nodes exist and are visible
  const visibleEdges = useMemo(() => {
    return edges.filter((e) => visibleNodeMap.has(e.source) && visibleNodeMap.has(e.target));
  }, [edges, visibleNodeMap]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [selectedNodeId, nodes]);

  const candidateNodes = useMemo(
    () => nodes.filter((n) => n.id !== selectedNodeId),
    [nodes, selectedNodeId]
  );

  const handleCreateRelation = () => {
    if (!selectedNodeId || !newLinkTargetId) return;
    addRelation({
      sourceId: selectedNodeId,
      targetId: newLinkTargetId,
      relationType: newLinkType,
    });
    setIsAddingLink(false);
  };

  // Pointer Handlers for Pan, Drag & Pinch (mouse + touch — Plan responsiveness)
  const handleCanvasMouseDown = (e: React.PointerEvent) => {
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (activePointersRef.current.size === 2) {
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

  const handleNodeMouseDown = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    setSelectedNodeId(nodeId);
  };

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
        Math.max(Number((base.zoom * (dist / base.dist)).toFixed(2)), 0.4),
        2.5
      );
      const scale = nextZoom / base.zoom;
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

      setNodes((prev) =>
        prev.map((n) => (n.id === draggedNodeId ? { ...n, x: mouseX, y: mouseY } : n))
      );
    }
  };

  const handleMouseUp = (e?: React.PointerEvent) => {
    if (e) activePointersRef.current.delete(e.pointerId);
    pinchBaseRef.current = null;

    if (activePointersRef.current.size === 1 && !draggedNodeId) {
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
    setZoom((prev) => Math.min(Math.max(Number((prev + zoomDelta).toFixed(2)), 0.4), 2.5));
  };

  const getNodeStyles = (type: NodeType) => {
    switch (type) {
      case 'location':
        return {
          bg: 'bg-sky-950/90',
          border: 'border-sky-500',
          badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
          glow: 'shadow-sky-500/20',
          text: 'text-sky-400',
        };
      case 'npc':
        return {
          bg: 'bg-amber-950/90',
          border: 'border-amber-500',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          glow: 'shadow-amber-500/20',
          text: 'text-amber-400',
        };
      case 'faction':
        return {
          bg: 'bg-purple-950/90',
          border: 'border-purple-500',
          badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          glow: 'shadow-purple-500/20',
          text: 'text-purple-400',
        };
      case 'law':
        return {
          bg: 'bg-rose-950/90',
          border: 'border-rose-500',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          glow: 'shadow-rose-500/20',
          text: 'text-rose-400',
        };
      case 'artifact':
        return {
          bg: 'bg-amber-950/90',
          border: 'border-amber-400',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          glow: 'shadow-amber-500/30 ring-1 ring-amber-400/40',
          text: 'text-amber-300',
        };
      case 'creature':
        return {
          bg: 'bg-rose-950/90',
          border: 'border-rose-500',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          glow: 'shadow-rose-500/30 ring-1 ring-rose-500/30',
          text: 'text-rose-400',
        };
      case 'deity':
        return {
          bg: 'bg-amber-950/90',
          border: 'border-amber-400',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          glow: 'shadow-amber-500/40 ring-1 ring-amber-300/40',
          text: 'text-amber-300',
        };
    }
  };

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case 'location':
        return <MapPin className="w-4 h-4 text-sky-400" />;
      case 'npc':
        return <User className="w-4 h-4 text-amber-400" />;
      case 'faction':
        return <Users className="w-4 h-4 text-purple-400" />;
      case 'law':
        return <Shield className="w-4 h-4 text-rose-400" />;
      case 'artifact':
        return <Sparkles className="w-4 h-4 text-amber-300" />;
      case 'creature':
        return <Skull className="w-4 h-4 text-rose-400" />;
      case 'deity':
        return <Sun className="w-4 h-4 text-amber-300" />;
    }
  };

  const t = {
    searchPlaceholder: isPersian ? 'جستجو در موجودیت‌های گراف...' : 'Search graph lore...',
    zoomIn: isPersian ? 'بزرگ‌نمایی' : 'Zoom In',
    zoomOut: isPersian ? 'کوچک‌نمایی' : 'Zoom Out',
    reset: isPersian ? 'بازنشانی گراف' : 'Reset View',
    editScene: isPersian ? 'ویرایش گره' : 'Edit Node',
    closeEditor: isPersian ? 'بستن' : 'Close',
    fsEnter: isPersian ? 'حالت تمام‌صفحه' : 'Fullscreen canvas',
    fsExit: isPersian ? 'خروج از تمام‌صفحه' : 'Exit fullscreen',
    inspectorTitle: isPersian ? 'اطلاعات گره انتخابی' : 'Selected Lore Node',
    noSelection: isPersian ? 'روی هر گره کلیک کنید تا ارتباطات و مشخصات آن نمایش یابد' : 'Click any node to view relations & secrets',
    locations: isPersian ? 'مکان‌ها' : 'Locations',
    npcs: isPersian ? 'شخصیت‌ها' : 'NPCs',
    factions: isPersian ? 'جناح‌ها' : 'Factions',
    laws: isPersian ? 'قوانین جهان' : 'World Laws',
    artifacts: isPersian ? 'عتیقه‌ها' : 'Relics',
    creatures: isPersian ? 'هیولاها' : 'Bestiary',
    deities: isPersian ? 'ایزدان و ادیان' : 'Pantheon',
    connections: isPersian ? 'پیوندهای شبکه:' : 'Active Links:',
    trust: isPersian ? 'اعتماد اولیه:' : 'Initial Trust:',
    speech: isPersian ? 'دستورالعمل گفتار:' : 'Speech Style:',
    secrets: isPersian ? 'اسرار پنهان:' : 'Hidden Secrets:',
    atmosphere: isPersian ? 'فضاسازی و اتمسفر:' : 'Atmosphere:',
    dangerLevel: isPersian ? 'سطح خطر:' : 'Danger Level:',
    legend: isPersian ? 'راهنمای پیوندها:' : 'Legend:',
    path: isPersian ? 'مسیر پیوسته' : 'Path',
    residence: isPersian ? 'محل استقرار' : 'Stationed',
    territory: isPersian ? 'قلمرو حاکمیت' : 'Territory',
    rival: isPersian ? 'دشمن خونی' : 'Rival',
    law: isPersian ? 'قانون حاکم' : 'Governs',
  };

  return (
    <div
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-[80] bg-[#090a14]'
          // z-0 traps all descendants below page bars & popups (see StoryTreeCanvas).
          : 'relative z-0 w-full h-[72vh] md:h-[780px]'
      } rounded-3xl border border-zinc-800/80 overflow-hidden shadow-2xl flex flex-col md:flex-row select-none`}
    >
      {/* Canvas Area */}
      <div
        ref={canvasRef}
        onPointerDown={handleCanvasMouseDown}
        onPointerMove={handleMouseMove}
        onPointerUp={handleMouseUp}
        onPointerLeave={handleMouseUp}
        onPointerCancel={handleMouseUp}
        onWheel={handleWheel}
        className="relative flex-1 h-full cursor-grab active:cursor-grabbing overflow-hidden bg-gradient-to-b from-[#090a14] via-[#0b0c1b] to-[#07080f] touch-none md:touch-auto"
      >
        {/* Dot Grid */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#818CF8 1.2px, transparent 1.2px)`,
            backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* Top Control Bar */}
        <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
          {/* Search Box */}
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700/80 rounded-2xl px-3.5 py-2 shadow-xl backdrop-blur-md pointer-events-auto w-64 md:w-72">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-700/80 rounded-2xl p-1.5 shadow-xl backdrop-blur-md pointer-events-auto">
            {(['faction', 'location', 'npc', 'artifact', 'creature', 'deity', 'law'] as NodeType[]).map((type) => {
              const active = visibleTypes[type];
              const styles = getNodeStyles(type);
              return (
                <button
                  key={type}
                  onClick={() => setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }))}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${active
                      ? `${styles.badge} shadow-sm`
                      : 'text-zinc-500 hover:text-zinc-400 opacity-40'
                    }`}
                >
                  <span>{getNodeIcon(type)}</span>
                  <span>
                    {type === 'location'
                      ? t.locations
                      : type === 'npc'
                        ? t.npcs
                        : type === 'faction'
                          ? t.factions
                          : type === 'artifact'
                            ? t.artifacts
                            : type === 'creature'
                              ? t.creatures
                              : type === 'deity'
                                ? t.deities
                                : t.laws}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Zoom / Reset */}
          <div className="flex items-center gap-1 bg-zinc-900/90 border border-zinc-700/80 rounded-2xl p-1 shadow-xl backdrop-blur-md pointer-events-auto">
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2.2))}
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
                setNodes(initialNodes);
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
          {/* SVG Connection Edges */}
          <svg className="absolute top-0 left-0 w-[3000px] h-[3000px] pointer-events-none overflow-visible z-0">
            <defs>
              <marker
                id="arrow-cyan"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
              </marker>
              <marker
                id="arrow-amber"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#F59E0B" />
              </marker>
              <marker
                id="arrow-purple"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#A855F7" />
              </marker>
              <marker
                id="arrow-red"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#EF4444" />
              </marker>
              <marker
                id="arrow-rose"
                viewBox="0 0 10 10"
                refX="28"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#FB7185" />
              </marker>
            </defs>

            {visibleEdges.map((edge) => {
              const srcNode = visibleNodeMap.get(edge.source);
              const tgtNode = visibleNodeMap.get(edge.target);
              if (!srcNode || !tgtNode) return null;

              const isHighlighted =
                selectedNodeId === edge.source || selectedNodeId === edge.target;

              const midX = (srcNode.x + tgtNode.x) / 2;
              const midY = (srcNode.y + tgtNode.y) / 2;

              // Arc curve
              const dx = tgtNode.x - srcNode.x;
              const dy = tgtNode.y - srcNode.y;
              const cx = midX - dy * 0.12;
              const cy = midY + dx * 0.12;

              const pathD = `M ${srcNode.x} ${srcNode.y} Q ${cx} ${cy} ${tgtNode.x} ${tgtNode.y}`;

              return (
                <g key={edge.id}>
                  {/* Outer Glow on Highlight */}
                  {isHighlighted && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth={8}
                      strokeOpacity={0.4}
                      strokeLinecap="round"
                    />
                  )}

                  {/* Main Link Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={isHighlighted ? 3.5 : 2.2}
                    strokeOpacity={isHighlighted ? 1 : 0.75}
                    strokeDasharray={edge.dashed ? '6,6' : edge.label.includes('دشمن') || edge.label.includes('Rival') ? '6,6' : 'none'}
                  />

                  {/* Relationship Label Pill Badge */}
                  <g transform={`translate(${cx}, ${cy})`}>
                    <rect
                      x={-Math.max(46, edge.label.length * 3.5 + 8)}
                      y={-11}
                      width={Math.max(92, edge.label.length * 7 + 16)}
                      height={22}
                      rx={11}
                      fill="#0D1022"
                      stroke={edge.color}
                      strokeWidth={isHighlighted ? 2 : 1.2}
                      strokeOpacity={isHighlighted ? 1 : 0.85}
                    />
                    <text
                      x={0}
                      y={4}
                      fill={edge.color}
                      fontSize="9.5"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="select-none font-sans"
                    >
                      {edge.label}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Interactive Graph Nodes */}
          {visibleNodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const styles = getNodeStyles(node.type);

            return (
              <div
                key={node.id}
                onPointerDown={(e) => handleNodeMouseDown(e, node.id)}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute cursor-pointer transition-all duration-150 z-10 ${isSelected ? 'scale-110 z-30' : 'hover:scale-105'
                  }`}
              >
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 backdrop-blur-xl shadow-2xl transition-all ${styles.bg
                    } ${styles.border} ${isSelected
                      ? `ring-4 ring-amber-400 ${styles.glow} bg-zinc-900`
                      : 'hover:border-white/70'
                    }`}
                >
                  <div className="p-2 rounded-xl bg-black/50 border border-white/10 shrink-0">
                    {getNodeIcon(node.type)}
                  </div>
                  <div className="text-left select-none">
                    <div className="text-xs font-bold text-zinc-100 max-w-[150px] truncate">
                      {node.label}
                    </div>
                    {node.sublabel && (
                      <div className="text-[10.5px] text-zinc-400 max-w-[140px] truncate font-medium">
                        {node.sublabel}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Legend (hidden on phones to declutter) */}
        <div className="hidden sm:flex absolute bottom-4 left-4 z-20 flex-wrap items-center gap-3 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl px-4 py-2 text-[11px] text-zinc-400 backdrop-blur-md pointer-events-auto shadow-lg max-w-2xl">
          <span className="font-bold text-zinc-300">{t.legend}</span>
          {(worldBible.ontology?.relationTypes || [
            { id: 'path', name: t.path, color: '#38BDF8' },
            { id: 'residence', name: t.residence, color: '#F59E0B' },
            { id: 'faction_allied', name: isPersian ? 'متحد رسمی' : 'Sworn Ally', color: '#10B981' },
            { id: 'faction_favorable', name: isPersian ? 'هم‌پیمان پنهان' : 'Favorable', color: '#38BDF8' },
            { id: 'faction_neutral', name: isPersian ? 'بی‌طرف / عمل‌گرا' : 'Neutral', color: '#94A3B8' },
            { id: 'faction_rival', name: isPersian ? 'رقیب' : 'Rival', color: '#F59E0B' },
            { id: 'faction_hostile', name: isPersian ? 'دشمن خونی' : 'Blood Enemy', color: '#EF4444' },
            { id: 'territory', name: t.territory, color: '#A855F7' },
          ]).map((rt) => (
            <span key={rt.id} className="flex items-center gap-1.5" style={{ color: rt.color }}>
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: rt.color }} /> {rt.name}
            </span>
          ))}
        </div>

        {/* Mobile: floating editor trigger — canvas keeps the full screen */}
        {!isInspectorOpen && selectedNode && (
          <button
            type="button"
            onClick={() => setIsInspectorOpen(true)}
            className="md:hidden absolute bottom-4 right-4 z-30 flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl shadow-indigo-500/30 transition-all cursor-pointer"
          >
            {t.editScene}
          </button>
        )}
      </div>

      {/* Node Inspector: side panel on desktop, bottom sheet on mobile */}
      <div
        className={`bg-[#0b0d1a] border-t md:border-t-0 md:border-l border-zinc-800/80 p-6 flex-col justify-between overflow-y-auto shadow-2xl ${
          isInspectorOpen
            ? 'fixed inset-x-0 bottom-0 z-[90] max-h-[72vh] rounded-t-3xl flex animate-fadeIn'
            : 'hidden'
        } md:static md:flex md:max-h-none md:w-96 md:rounded-none`}
      >
        {selectedNode ? (
          <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                {getNodeIcon(selectedNode.type)}
                <span>{selectedNode.type.toUpperCase()}</span>
                <span className="text-[10px] text-zinc-500 font-mono ml-auto">
                  {selectedNode.id}
                </span>
                <button
                  onClick={() => setIsInspectorOpen(false)}
                  title={t.closeEditor}
                  className="md:hidden p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>
              <h3 className="text-lg font-bold text-zinc-100">{selectedNode.label}</h3>
              {selectedNode.sublabel && (
                <p className="text-xs text-amber-400 font-medium mt-0.5">
                  {selectedNode.sublabel}
                </p>
              )}
            </div>

            {/* Connected Links List & Relation Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {t.connections} ({edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id).length})
                </span>
                <button
                  onClick={() => {
                    setIsAddingLink(!isAddingLink);
                    setNewLinkTargetId(candidateNodes[0]?.id || '');
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isPersian ? '+ پیوند جدید' : '+ Add Link'}</span>
                </button>
              </div>

              {/* Add Relation Form */}
              {isAddingLink && (
                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-amber-500/40 space-y-3 animate-fadeIn">
                  <span className="text-xs font-bold text-amber-300 block">
                    {isPersian ? 'ایجاد پیوند با موجودیت دیگر:' : 'Establish Link with Entity:'}
                  </span>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1">
                      {isPersian ? 'موجودیت مقصد:' : 'Target Entity:'}
                    </label>
                    <select
                      value={newLinkTargetId}
                      onChange={(e) => setNewLinkTargetId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                    >
                      {candidateNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          [{n.type.toUpperCase()}] {n.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 block mb-1">
                      {isPersian ? 'نوع پیوند:' : 'Relation Type:'}
                    </label>
                    <select
                      value={newLinkType}
                      onChange={(e) =>
                        setNewLinkType(
                          e.target.value as any
                        )
                      }
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
                    >
                      {(worldBible.ontology?.relationTypes || [
                        { id: 'path', name: isPersian ? 'مسیر ارتباطی (بین ۲ مکان)' : 'Travel Path (Location <-> Location)' },
                        { id: 'residence', name: isPersian ? 'محل استقرار (شخصیت در مکان)' : 'Stationed At (NPC -> Location)' },
                        { id: 'ally', name: isPersian ? 'عضو ارشد جناح (شخصیت در جناح)' : 'Faction Member (NPC -> Faction)' },
                        { id: 'faction_allied', name: isPersian ? 'متحد رسمی (بین ۲ جناح)' : 'Sworn Ally (Faction <-> Faction)' },
                        { id: 'faction_favorable', name: isPersian ? 'هم‌پیمان پنهان (بین ۲ جناح)' : 'Favorable (Faction <-> Faction)' },
                        { id: 'faction_neutral', name: isPersian ? 'بی‌طرف / عمل‌گرا (بین ۲ جناح)' : 'Neutral (Faction <-> Faction)' },
                        { id: 'faction_rival', name: isPersian ? 'رقیب ایدئولوژیک (بین ۲ جناح)' : 'Rival (Faction <-> Faction)' },
                        { id: 'faction_hostile', name: isPersian ? 'دشمن خونی / جنگ علنی (بین ۲ جناح)' : 'Blood Enemy (Faction <-> Faction)' },
                        { id: 'territory', name: isPersian ? 'قلمرو حاکمیت (جناح در مکان)' : 'Territory (Faction -> Location)' },
                      ]).map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => setIsAddingLink(false)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold transition-colors"
                    >
                      {isPersian ? 'انصراف' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleCreateRelation}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-zinc-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all"
                    >
                      {isPersian ? 'ثبت پیوند' : 'Create Link'}
                    </button>
                  </div>
                </div>
              )}

              {/* Active Links List */}
              <div className="space-y-1.5">
                {edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((e) => {
                    const otherId = e.source === selectedNode.id ? e.target : e.source;
                    const otherNode = nodes.find((n) => n.id === otherId);
                    return (
                      <div
                        key={e.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 hover:border-zinc-700 transition-all gap-2"
                      >
                        <div
                          onClick={() => setSelectedNodeId(otherId)}
                          className="flex items-center gap-2 cursor-pointer truncate flex-1"
                        >
                          <span className="truncate max-w-[130px] font-medium text-zinc-200 hover:text-amber-400">
                            {otherNode?.label || otherId}
                          </span>
                          <span
                            className="text-[9.5px] font-bold px-2 py-0.5 rounded-lg border font-mono shrink-0"
                            style={{
                              color: e.color,
                              backgroundColor: `${e.color}15`,
                              borderColor: `${e.color}40`,
                            }}
                          >
                            {e.label}
                          </span>
                        </div>

                        {/* Delete Relation Button */}
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            deleteRelation(e.source, e.target, e.label);
                          }}
                          title={isPersian ? 'حذف پیوند' : 'Delete Link'}
                          className="p-1 text-zinc-500 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Entity Specific Details */}
            {selectedNode.type === 'location' && (
              <div className="space-y-4 text-xs text-zinc-300">
                <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/70">
                  <p className="text-zinc-300 leading-relaxed">
                    {(selectedNode.data as WorldLocation).description}
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                  <span className="text-sky-300 font-bold">{t.dangerLevel}</span>
                  <span className="font-mono text-sky-400 font-bold">
                    ★ {(selectedNode.data as WorldLocation).dangerLevel} / 5
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                    {t.atmosphere}
                  </span>
                  <p className="text-zinc-400 italic">
                    &ldquo;{(selectedNode.data as WorldLocation).atmosphere}&rdquo;
                  </p>
                </div>
              </div>
            )}

            {selectedNode.type === 'npc' && (
              <div className="space-y-4 text-xs text-zinc-300">
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-300 font-bold flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/20" />
                    {t.trust}
                  </span>
                  <span className="font-mono text-amber-400 font-bold">
                    {(selectedNode.data as NPCDossier).initialTrust}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/70 space-y-1">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                    {t.speech}
                  </span>
                  <p className="text-zinc-300 italic leading-relaxed">
                    &ldquo;{(selectedNode.data as NPCDossier).speechStyle}&rdquo;
                  </p>
                </div>

                {/* Secrets */}
                <div>
                  <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] block mb-2">
                    {t.secrets}
                  </span>
                  <div className="space-y-2">
                    {((selectedNode.data as NPCDossier).secrets || []).map((s) => (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs text-rose-200/90"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-rose-400 font-mono flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            {isPersian ? `اعتماد ≥ ${s.requiredTrustLevel}` : `Trust ≥ ${s.requiredTrustLevel}`}
                          </span>
                        </div>
                        <p className="text-zinc-300">{s.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedNode.type === 'faction' && (
              <div className="space-y-4 text-xs text-zinc-300">
                <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800/70">
                  <p className="text-zinc-300 leading-relaxed">
                    {(selectedNode.data as Faction).description}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-1">
                  <span className="text-purple-300 font-bold text-[10px] uppercase tracking-wider">
                    {isPersian ? 'اهداف عمومی:' : 'Public Goals:'}
                  </span>
                  <p className="text-zinc-300">{(selectedNode.data as Faction).publicGoals}</p>
                </div>
              </div>
            )}

            {selectedNode.type === 'law' && (
              <div className="space-y-4 text-xs text-zinc-300">
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-200">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/30 inline-block mb-2">
                    {(selectedNode.data as WorldLaw).category}
                  </span>
                  <p className="text-zinc-200 font-semibold mb-1">
                    {(selectedNode.data as WorldLaw).rule}
                  </p>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    {(selectedNode.data as WorldLaw).description}
                  </p>
                </div>
              </div>
            )}

            {selectedNode.type === 'artifact' && (
              <div className="space-y-4 text-xs text-zinc-300">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                      {(selectedNode.data as WorldArtifact).rarity}
                    </span>
                    <span className="text-[10.5px] font-mono text-zinc-400">
                      {(selectedNode.data as WorldArtifact).originEra}
                    </span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed mb-2">
                    {(selectedNode.data as WorldArtifact).description}
                  </p>
                  {(selectedNode.data as WorldArtifact).curseOrCost && (
                    <div className="p-2 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-[11px] mt-2">
                      <span className="font-bold text-red-400">{isPersian ? 'نفرین: ' : 'Curse: '}</span>
                      {(selectedNode.data as WorldArtifact).curseOrCost}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedNode.type === 'creature' && (
              <div className="space-y-4 text-xs text-zinc-300">
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/30">
                      {(selectedNode.data as WorldCreature).speciesCategory}
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-400">
                      ★ {(selectedNode.data as WorldCreature).dangerLevel} / 5
                    </span>
                  </div>
                  <p className="text-zinc-300 leading-relaxed mb-2">
                    {(selectedNode.data as WorldCreature).loreDescription}
                  </p>
                  <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-300">
                    <span className="font-bold text-amber-400 block mb-1">
                      {isPersian ? 'تاکتیک نبرد:' : 'Tactics:'}
                    </span>
                    {(selectedNode.data as WorldCreature).behavioralTactics}
                  </div>
                </div>
              </div>
            )}

            {selectedNode.type === 'deity' && (
              <div className="space-y-4 text-xs text-zinc-300">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                      {(selectedNode.data as WorldDeity).domain}
                    </span>
                    <span className="text-[10.5px] text-zinc-400">
                      {(selectedNode.data as WorldDeity).sacredSymbol}
                    </span>
                  </div>
                  <p className="text-zinc-300 italic mb-2">
                    &ldquo;{(selectedNode.data as WorldDeity).coreDogma}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <Globe className="w-12 h-12 text-zinc-700 mb-3" />
            <h4 className="text-sm font-bold text-zinc-400">{t.inspectorTitle}</h4>
            <p className="text-xs text-zinc-600 mt-1 max-w-[200px]">{t.noSelection}</p>
          </div>
        )}

        <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between text-[11px] text-zinc-500">
          <span>{worldBible.worldName}</span>
          <span className="font-mono">{nodes.length} Nodes &bull; {edges.length} Links</span>
        </div>
      </div>
    </div>
  );
}
