'use client';

import React, { useState, useMemo, useRef } from 'react';
import { WorldBible, WorldLocation, NPCDossier, Faction, WorldLaw } from '@/lib/types';
import {
  MapPin,
  User,
  Users,
  Shield,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Globe,
  Heart,
  Lock,
} from 'lucide-react';

export type NodeType = 'location' | 'npc' | 'faction' | 'law';

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  type: NodeType;
  x: number;
  y: number;
  data: WorldLocation | NPCDossier | Faction | WorldLaw;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  color: string;
}

interface LoreGraphCanvasProps {
  worldBible: WorldBible;
  isPersian?: boolean;
}

export function LoreGraphCanvas({ worldBible, isPersian = false }: LoreGraphCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 30 });

  // Dragging state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Type Filters
  const [visibleTypes, setVisibleTypes] = useState<Record<NodeType, boolean>>({
    location: true,
    npc: true,
    faction: true,
    law: true,
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

      // Faction rivalries
      (fac.rivalFactionIds || []).forEach((rId) => {
        if (fac.id < rId) {
          edgesList.push({
            id: `edge-fac-rival-${fac.id}-${rId}`,
            source: fac.id,
            target: rId,
            label: isPersian ? 'دشمن خونی' : 'Rival Enemy',
            color: '#EF4444', // Red
          });
        }
      });
    });

    // 2. Locations (Middle Row: Y = 280)
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
        if (loc.id < tId) {
          edgesList.push({
            id: `edge-loc-path-${loc.id}-${tId}`,
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

    // 4. Laws (Bottom Row: Y = 620)
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

      // Connect law to location or faction
      if (locs.length > idx) {
        edgesList.push({
          id: `edge-law-loc-${law.id}-${locs[idx].id}`,
          source: law.id,
          target: locs[idx].id,
          label: isPersian ? 'قانون حاکم' : 'Governs',
          color: '#FB7185', // Rose
        });
      }
    });

    return { initialNodes: nodesList, initialEdges: edgesList };
  }, [worldBible, isPersian]);

  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes);
  const edges = initialEdges;

  // Update when story changes
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes]);

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

  // Mouse Handlers for Pan & Drag
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    setSelectedNodeId(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggedNodeId(null);
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
    }
  };

  const t = {
    searchPlaceholder: isPersian ? 'جستجو در موجودیت‌های گراف...' : 'Search graph lore...',
    zoomIn: isPersian ? 'بزرگ‌نمایی' : 'Zoom In',
    zoomOut: isPersian ? 'کوچک‌نمایی' : 'Zoom Out',
    reset: isPersian ? 'بازنشانی گراف' : 'Reset View',
    inspectorTitle: isPersian ? 'اطلاعات گره انتخابی' : 'Selected Lore Node',
    noSelection: isPersian ? 'روی هر گره کلیک کنید تا ارتباطات و مشخصات آن نمایش یابد' : 'Click any node to view relations & secrets',
    locations: isPersian ? 'مکان‌ها' : 'Locations',
    npcs: isPersian ? 'شخصیت‌ها' : 'NPCs',
    factions: isPersian ? 'جناح‌ها' : 'Factions',
    laws: isPersian ? 'قوانین جهان' : 'World Laws',
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
    <div className="relative w-full h-[780px] rounded-3xl bg-[#090a14] border border-zinc-800/80 overflow-hidden shadow-2xl flex flex-col md:flex-row select-none">
      {/* Canvas Area */}
      <div
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="relative flex-1 h-full cursor-grab active:cursor-grabbing overflow-hidden bg-gradient-to-b from-[#090a14] via-[#0b0c1b] to-[#07080f]"
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
            {(['faction', 'location', 'npc', 'law'] as NodeType[]).map((type) => {
              const active = visibleTypes[type];
              const styles = getNodeStyles(type);
              return (
                <button
                  key={type}
                  onClick={() => setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }))}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                    active
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
                    strokeDasharray={edge.label.includes('دشمن') || edge.label.includes('Rival') ? '6,6' : 'none'}
                  />

                  {/* Relationship Label Pill Badge */}
                  <g transform={`translate(${cx}, ${cy})`}>
                    <rect
                      x={-46}
                      y={-11}
                      width={92}
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
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute cursor-pointer transition-all duration-150 z-10 ${
                  isSelected ? 'scale-110 z-30' : 'hover:scale-105'
                }`}
              >
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 backdrop-blur-xl shadow-2xl transition-all ${
                    styles.bg
                  } ${styles.border} ${
                    isSelected
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

        {/* Bottom Legend */}
        <div className="absolute bottom-4 left-4 z-20 flex flex-wrap items-center gap-3 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl px-4 py-2 text-[11px] text-zinc-400 backdrop-blur-md pointer-events-auto shadow-lg">
          <span className="font-bold text-zinc-300">{t.legend}</span>
          <span className="flex items-center gap-1.5 text-sky-400">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" /> {t.path}
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> {t.residence}
          </span>
          <span className="flex items-center gap-1.5 text-purple-400">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" /> {t.territory}
          </span>
          <span className="flex items-center gap-1.5 text-red-400">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> {t.rival}
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> {t.law}
          </span>
        </div>
      </div>

      {/* Right-Side Node Inspector Drawer */}
      <div className="w-full md:w-96 bg-[#0b0d1a] border-t md:border-t-0 md:border-l border-zinc-800/80 p-6 flex flex-col justify-between overflow-y-auto z-30 shadow-2xl">
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
              </div>
              <h3 className="text-lg font-bold text-zinc-100">{selectedNode.label}</h3>
              {selectedNode.sublabel && (
                <p className="text-xs text-amber-400 font-medium mt-0.5">
                  {selectedNode.sublabel}
                </p>
              )}
            </div>

            {/* Connected Links List */}
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                {t.connections}
              </span>
              <div className="space-y-1.5">
                {edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((e) => {
                    const otherId = e.source === selectedNode.id ? e.target : e.source;
                    const otherNode = nodes.find((n) => n.id === otherId);
                    return (
                      <div
                        key={e.id}
                        onClick={() => setSelectedNodeId(otherId)}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 cursor-pointer hover:border-zinc-600 transition-all"
                      >
                        <span className="truncate max-w-[140px] font-medium text-zinc-200">
                          {otherNode?.label || otherId}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-lg border font-mono"
                          style={{
                            color: e.color,
                            backgroundColor: `${e.color}15`,
                            borderColor: `${e.color}40`,
                          }}
                        >
                          {e.label}
                        </span>
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
