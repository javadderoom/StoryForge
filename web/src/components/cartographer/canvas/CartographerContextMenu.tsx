'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  EnvironmentalContext,
} from '@/lib/engines/world/environmentalContext';
import { WorldBible, MapEntityPlacement, Faction } from '@/lib/types/world';
import { notify } from '@/lib/notify';
import {
  Sparkles,
  Compass,
  Mountain,
  Flame,
  Shield,
  User,
  Swords,
  Scroll,
  Sparkle,
  Castle,
  PenTool,
  MessageSquare,
  Trash2,
  Eye,
  Loader2,
  ChevronRight,
  Dice5,
  X,
} from 'lucide-react';

export interface CartographerContextMenuProps {
  x: number;
  y: number;
  worldPoint: { x: number; y: number };
  environmentalContext: EnvironmentalContext;
  worldBible: WorldBible;
  targetHitObject?: {
    kind: string;
    id: string;
    name?: string;
  } | null;
  isPersian: boolean;
  onClose: () => void;
  onSelectObject?: (ref: { kind: string; id: string }) => void;
  onDeleteObject?: (ref: { kind: string; id: string }) => void;
  onAskOracle?: (coord: { x: number; y: number }, envContext: EnvironmentalContext) => void;
  onAddGeneratedElement: (payload: {
    entityType: 'bestiary' | 'npc' | 'timeline' | 'artifact' | 'location';
    entity: any;
    placement: MapEntityPlacement;
  }) => void;
}

type MenuSection = 'main' | 'beast' | 'npc' | 'event' | 'artifact' | 'settlement' | 'custom';

export function CartographerContextMenu({
  x,
  y,
  worldPoint,
  environmentalContext,
  worldBible,
  targetHitObject,
  isPersian,
  onClose,
  onSelectObject,
  onDeleteObject,
  onAskOracle,
  onAddGeneratedElement,
}: CartographerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<MenuSection>('main');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');

  // Beast parameters
  const [beastDanger, setBeastDanger] = useState<number>(3);
  const [beastDc, setBeastDc] = useState<number>(15);
  const [beastRole, setBeastRole] = useState<string>('Apex Predator');

  // NPC parameters
  const [npcRole, setNpcRole] = useState<string>('Hermit / Dweller');
  const [npcDc, setNpcDc] = useState<number>(14);
  const [npcFactionId, setNpcFactionId] = useState<string>('');

  // Story Event parameters
  const [eventCategory, setEventCategory] = useState<string>('Ambush & Hazard');
  const [eventDc, setEventDc] = useState<number>(15);

  // Artifact parameters
  const [artifactRarity, setArtifactRarity] = useState<string>('rare');
  const [artifactDc, setArtifactDc] = useState<number>(16);

  // Settlement parameters
  const [settlementCategory, setSettlementCategory] = useState<string>('oasis_camp');
  const [settlementDanger, setSettlementDanger] = useState<number>(2);

  // Custom prompt
  const [customPrompt, setCustomPrompt] = useState<string>('');

  // Adjust menu position so it stays within viewport
  const [adjustedPos, setAdjustedPos] = useState({ left: x, top: y });

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 12;
    let left = x;
    let top = y;

    if (left + rect.width > window.innerWidth - padding) {
      left = window.innerWidth - rect.width - padding;
    }
    if (top + rect.height > window.innerHeight - padding) {
      top = window.innerHeight - rect.height - padding;
    }
    left = Math.max(padding, left);
    top = Math.max(padding, top);

    setAdjustedPos({ left, top });
  }, [x, y, activeSection]);

  // Close on outside click or escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [onClose]);

  const handleGenerate = async (
    entityType: 'beast' | 'npc' | 'story_event' | 'timeline' | 'artifact' | 'settlement',
    params: any
  ) => {
    setIsGenerating(true);
    setGenerationStatus(
      `Consulting DeepSeek in ${environmentalContext.biomeLabel}...`
    );

    try {
      const res = await fetch('/api/studio/cartographer/generate-element', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worldName: worldBible.worldName,
          worldTheme: worldBible.themeNotes,
          coordinates: worldPoint,
          environmentalContext,
          entityType,
          parameters: params,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Generation failed with status ${res.status}`);
      }

      const data = await res.json();
      if (!data.success || !data.entity || !data.placement) {
        throw new Error('Invalid response structure received from generation endpoint.');
      }

      onAddGeneratedElement({
        entityType: data.entityType,
        entity: data.entity,
        placement: data.placement,
      });

      notify.success(
        isPersian
          ? `عنصر «${data.entity.name || data.entity.title}» با توجه به زیست‌بوم ترسیم شد`
          : `Spawned ${data.entity.name || data.entity.title} at (${Math.round(worldPoint.x)}, ${Math.round(worldPoint.y)})`
      );
      onClose();
    } catch (err: any) {
      console.error('[Cartographer Context Menu Generation Error]:', err);
      notify.error(err?.message || 'Failed to generate element.');
    } finally {
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const factions = worldBible.factions ?? [];

  return (
    <div
      ref={menuRef}
      style={{ left: adjustedPos.left, top: adjustedPos.top }}
      className="fixed z-50 w-80 max-h-[85vh] flex flex-col bg-[#1a1410]/95 backdrop-blur-md border border-[#4a392a] text-[#eedec8] rounded-xl shadow-2xl overflow-hidden text-xs select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header: Environment Badge */}
      <div className="bg-[#241c16] border-b border-[#3d2f23] p-2.5 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-[#f1d6b0] text-[13px] truncate">
            <span>{environmentalContext.biomeEmoji}</span>
            <span className="truncate">
              {environmentalContext.featureName || environmentalContext.biomeLabel}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#96806e] hover:text-[#eedec8] p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-[#baa48d]">
          {environmentalContext.nearestSettlement ? (
            <span className="bg-[#15100c] px-1.5 py-0.5 rounded border border-[#3d2f23]/60">
              🧭 {environmentalContext.nearestSettlement.distanceKm}km {environmentalContext.nearestSettlement.cardinalDirection} of {environmentalContext.nearestSettlement.name}
            </span>
          ) : (
            <span className="bg-[#15100c] px-1.5 py-0.5 rounded border border-[#3d2f23]/60">
              🏕️ Deep Wilderness
            </span>
          )}
          <span className="bg-[#15100c] px-1.5 py-0.5 rounded border border-[#3d2f23]/60">
            ⛰️ {environmentalContext.elevation}m
          </span>
          <span className="text-[#847160] font-mono text-[9.5px]">
            ({Math.round(worldPoint.x)}, {Math.round(worldPoint.y)})
          </span>
        </div>
      </div>

      {/* Target Hit Object Actions (if right-clicked on existing pin/feature) */}
      {targetHitObject && (
        <div className="bg-[#2c2118]/80 border-b border-[#3d2f23] px-2 py-1.5 flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 text-[11px] text-[#f1d6b0] truncate">
            <span className="text-[#96806e]">Target:</span>
            <span className="font-medium truncate">{targetHitObject.name || targetHitObject.id}</span>
          </div>
          <div className="flex items-center gap-1">
            {onSelectObject && (
              <button
                onClick={() => {
                  onSelectObject({ kind: targetHitObject.kind, id: targetHitObject.id });
                  onClose();
                }}
                className="px-1.5 py-0.5 rounded bg-[#3b2d20] hover:bg-[#4a3928] text-[#eedec8] flex items-center gap-1"
                title="Select and inspect"
              >
                <Eye className="w-3 h-3 text-[#d1b084]" />
                <span>Inspect</span>
              </button>
            )}
            {onDeleteObject && (
              <button
                onClick={() => {
                  onDeleteObject({ kind: targetHitObject.kind, id: targetHitObject.id });
                  onClose();
                }}
                className="px-1.5 py-0.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 flex items-center gap-1"
                title="Delete object"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Generation Loading Overlay */}
      {isGenerating ? (
        <div className="p-6 flex flex-col items-center justify-center gap-3 text-center bg-[#18130f]">
          <Loader2 className="w-6 h-6 animate-spin text-[#d8ab6c]" />
          <div className="font-medium text-[#f1d6b0] text-[12px]">{generationStatus}</div>
          <p className="text-[10px] text-[#9c8774] leading-relaxed max-w-[220px]">
            Adapting morphology, ecological niche, and canon lore with DeepSeek...
          </p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-[60vh] p-1.5 flex flex-col gap-1">
          {/* MAIN MENU */}
          {activeSection === 'main' && (
            <>
              <div className="text-[10px] font-semibold text-[#8e7a68] uppercase tracking-wider px-2 py-0.5">
                AI In-Map Generation (DeepSeek)
              </div>

              {/* Beasts Submenu Entry */}
              <button
                onClick={() => setActiveSection('beast')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🐉</span>
                  <div>
                    <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
                      Beast & Monster
                    </div>
                    <div className="text-[10px] text-[#9c8774]">
                      Adapted predator, pack, or wild creature
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
              </button>

              {/* Stationed NPC Submenu Entry */}
              <button
                onClick={() => setActiveSection('npc')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">👤</span>
                  <div>
                    <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
                      Stationed NPC
                    </div>
                    <div className="text-[10px] text-[#9c8774]">
                      Hermit, nomad, scout, or trader
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
              </button>

              {/* Story Event Submenu Entry */}
              <button
                onClick={() => setActiveSection('event')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">⚔️</span>
                  <div>
                    <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
                      Story Encounter & Dilemma
                    </div>
                    <div className="text-[10px] text-[#9c8774]">
                      Ambush, natural hazard, or ancient mystery
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
              </button>

              {/* Relic & Artifact Submenu Entry */}
              <button
                onClick={() => setActiveSection('artifact')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">✨</span>
                  <div>
                    <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
                      Buried Relic & Artifact
                    </div>
                    <div className="text-[10px] text-[#9c8774]">
                      Enshrined wonder or hidden antiquity
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
              </button>

              {/* Frontier Settlement Submenu Entry */}
              <button
                onClick={() => setActiveSection('settlement')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">🏰</span>
                  <div>
                    <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
                      Frontier Settlement
                    </div>
                    <div className="text-[10px] text-[#9c8774]">
                      Oasis camp, watchtower, or haven
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
              </button>

              <div className="my-1 border-t border-[#3d2f23]/70" />

              {/* Custom Prompt */}
              <button
                onClick={() => setActiveSection('custom')}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center justify-between group transition-colors"
              >
                <div className="flex items-center gap-2">
                  <PenTool className="w-3.5 h-3.5 text-[#d8ab6c]" />
                  <div>
                    <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
                      Custom Prompt...
                    </div>
                    <div className="text-[10px] text-[#9c8774]">
                      Describe any specific creature or landmark
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#7c6a5a] group-hover:text-[#eedec8]" />
              </button>

              {/* Ask Oracle Here */}
              {onAskOracle && (
                <button
                  onClick={() => {
                    onAskOracle(worldPoint, environmentalContext);
                    onClose();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[#2e231a] text-[#eedec8] flex items-center gap-2 group transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#d48b4b]" />
                  <div>
                    <div className="font-medium text-[#f5ebd9] group-hover:text-[#ffd9a6]">
                      Ask Oracle About This Spot
                    </div>
                    <div className="text-[10px] text-[#9c8774]">
                      Consult world intelligence with local context
                    </div>
                  </div>
                </button>
              )}
            </>
          )}

          {/* SUBMENU: BEAST */}
          {activeSection === 'beast' && (
            <div className="flex flex-col gap-2 p-1">
              <div className="flex items-center justify-between border-b border-[#3d2f23] pb-1.5">
                <button
                  onClick={() => setActiveSection('main')}
                  className="text-[#baa48d] hover:text-[#eedec8] text-[11px] flex items-center gap-1"
                >
                  ← Back
                </button>
                <div className="font-semibold text-[#f1d6b0]">🐉 Beast Configuration</div>
              </div>

              {/* Danger Level */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Danger Level: {beastDanger}/5
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setBeastDanger(lvl)}
                      className={`py-1 rounded text-center font-bold text-[11px] border transition-colors ${
                        beastDanger === lvl
                          ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                          : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Encounter DC */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Challenge DC: {beastDc}
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {[10, 12, 14, 16, 18, 20].map((dc) => (
                    <button
                      key={dc}
                      type="button"
                      onClick={() => setBeastDc(dc)}
                      className={`py-1 rounded text-center font-semibold text-[10.5px] border transition-colors ${
                        beastDc === dc
                          ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                          : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
                      }`}
                    >
                      {dc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ecological Role */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Ecological Niche
                </label>
                <select
                  value={beastRole}
                  onChange={(e) => setBeastRole(e.target.value)}
                  className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
                >
                  <option value="Apex Predator">Apex Predator</option>
                  <option value="Pack Hunter">Pack Hunter</option>
                  <option value="Ambush Lurker">Ambush Lurker</option>
                  <option value="Subterranean Burrower">Subterranean Burrower</option>
                  <option value="Venomous Stalker">Venomous Stalker</option>
                  <option value="Docile Herbivore">Docile Herbivore</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    handleGenerate('beast', {
                      dangerLevel: beastDanger,
                      dc: beastDc,
                      role: beastRole,
                    })
                  }
                  className="w-full py-1.5 bg-[#d8ab6c] hover:bg-[#e4bb7e] text-[#1a1410] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate Adapted Beast</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleGenerate('beast', {
                      dangerLevel: 3,
                      dc: 15,
                      role: 'Wild Beast',
                    })
                  }
                  className="w-full py-1 bg-[#2e231a] hover:bg-[#3d2f23] text-[#baa48d] hover:text-[#eedec8] font-medium rounded-lg flex items-center justify-center gap-1.5 text-[11px] border border-[#4a392a] transition-colors"
                >
                  <Dice5 className="w-3.5 h-3.5 text-[#d8ab6c]" />
                  <span>🎲 Instant Surprise Beast</span>
                </button>
              </div>
            </div>
          )}

          {/* SUBMENU: NPC */}
          {activeSection === 'npc' && (
            <div className="flex flex-col gap-2 p-1">
              <div className="flex items-center justify-between border-b border-[#3d2f23] pb-1.5">
                <button
                  onClick={() => setActiveSection('main')}
                  className="text-[#baa48d] hover:text-[#eedec8] text-[11px] flex items-center gap-1"
                >
                  ← Back
                </button>
                <div className="font-semibold text-[#f1d6b0]">👤 Stationed NPC</div>
              </div>

              {/* Role */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Archetype / Role
                </label>
                <select
                  value={npcRole}
                  onChange={(e) => setNpcRole(e.target.value)}
                  className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
                >
                  <option value="Hermit / Dweller">Hermit / Dweller</option>
                  <option value="Nomad Outrider">Nomad Outrider</option>
                  <option value="Caravan Merchant">Caravan Merchant</option>
                  <option value="Desert Mystic">Biome Mystic / Shaman</option>
                  <option value="Outlaw / Bandit Scout">Outlaw / Bandit Scout</option>
                  <option value="Frontier Guard">Frontier Guard</option>
                  <option value="Expedition Scholar">Expedition Scholar</option>
                </select>
              </div>

              {/* Interaction DC */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Interaction DC: {npcDc}
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {[10, 12, 14, 16, 18].map((dc) => (
                    <button
                      key={dc}
                      type="button"
                      onClick={() => setNpcDc(dc)}
                      className={`py-1 rounded text-center font-semibold text-[10.5px] border transition-colors ${
                        npcDc === dc
                          ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                          : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
                      }`}
                    >
                      {dc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Faction Allegiance */}
              {factions.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                    Faction Allegiance
                  </label>
                  <select
                    value={npcFactionId}
                    onChange={(e) => setNpcFactionId(e.target.value)}
                    className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
                  >
                    <option value="">Independent / Solitary</option>
                    {factions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const matchedFaction = factions.find((f) => f.id === npcFactionId);
                    handleGenerate('npc', {
                      role: npcRole,
                      dc: npcDc,
                      factionId: npcFactionId || undefined,
                      factionName: matchedFaction?.name,
                    });
                  }}
                  className="w-full py-1.5 bg-[#d8ab6c] hover:bg-[#e4bb7e] text-[#1a1410] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Generate Stationed NPC</span>
                </button>
              </div>
            </div>
          )}

          {/* SUBMENU: EVENT / ENCOUNTER */}
          {activeSection === 'event' && (
            <div className="flex flex-col gap-2 p-1">
              <div className="flex items-center justify-between border-b border-[#3d2f23] pb-1.5">
                <button
                  onClick={() => setActiveSection('main')}
                  className="text-[#baa48d] hover:text-[#eedec8] text-[11px] flex items-center gap-1"
                >
                  ← Back
                </button>
                <div className="font-semibold text-[#f1d6b0]">⚔️ Story Encounter</div>
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Encounter Type
                </label>
                <select
                  value={eventCategory}
                  onChange={(e) => setEventCategory(e.target.value)}
                  className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
                >
                  <option value="Ambush & Threat">Ambush & Combat Threat</option>
                  <option value="Ancient Mystery">Ancient Geological Mystery</option>
                  <option value="Moral Dilemma">Moral Dilemma / Stranded Party</option>
                  <option value="Arcane Ritual">Arcane Ritual / Ley Flare</option>
                  <option value="Forgotten Ruins">Forgotten Ruins & Trap</option>
                  <option value="Environmental Hazard">Environmental Hazard & Sinkhole</option>
                </select>
              </div>

              {/* Challenge DC */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Resolution DC: {eventDc}
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {[10, 12, 14, 16, 18, 20].map((dc) => (
                    <button
                      key={dc}
                      type="button"
                      onClick={() => setEventDc(dc)}
                      className={`py-1 rounded text-center font-semibold text-[10.5px] border transition-colors ${
                        eventDc === dc
                          ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                          : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
                      }`}
                    >
                      {dc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() =>
                    handleGenerate('story_event', {
                      category: eventCategory,
                      dc: eventDc,
                    })
                  }
                  className="w-full py-1.5 bg-[#d8ab6c] hover:bg-[#e4bb7e] text-[#1a1410] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Generate Encounter Pin</span>
                </button>
              </div>
            </div>
          )}

          {/* SUBMENU: ARTIFACT */}
          {activeSection === 'artifact' && (
            <div className="flex flex-col gap-2 p-1">
              <div className="flex items-center justify-between border-b border-[#3d2f23] pb-1.5">
                <button
                  onClick={() => setActiveSection('main')}
                  className="text-[#baa48d] hover:text-[#eedec8] text-[11px] flex items-center gap-1"
                >
                  ← Back
                </button>
                <div className="font-semibold text-[#f1d6b0]">✨ Relic & Artifact</div>
              </div>

              {/* Rarity */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Rarity Tier
                </label>
                <select
                  value={artifactRarity}
                  onChange={(e) => setArtifactRarity(e.target.value)}
                  className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
                >
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                  <option value="mythic">Mythic</option>
                </select>
              </div>

              {/* Attunement DC */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Attunement DC: {artifactDc}
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {[12, 14, 16, 18, 20].map((dc) => (
                    <button
                      key={dc}
                      type="button"
                      onClick={() => setArtifactDc(dc)}
                      className={`py-1 rounded text-center font-semibold text-[10.5px] border transition-colors ${
                        artifactDc === dc
                          ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                          : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
                      }`}
                    >
                      {dc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() =>
                    handleGenerate('artifact', {
                      rarity: artifactRarity,
                      dc: artifactDc,
                    })
                  }
                  className="w-full py-1.5 bg-[#d8ab6c] hover:bg-[#e4bb7e] text-[#1a1410] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
                >
                  <Sparkle className="w-3.5 h-3.5" />
                  <span>Generate Buried Relic</span>
                </button>
              </div>
            </div>
          )}

          {/* SUBMENU: SETTLEMENT */}
          {activeSection === 'settlement' && (
            <div className="flex flex-col gap-2 p-1">
              <div className="flex items-center justify-between border-b border-[#3d2f23] pb-1.5">
                <button
                  onClick={() => setActiveSection('main')}
                  className="text-[#baa48d] hover:text-[#eedec8] text-[11px] flex items-center gap-1"
                >
                  ← Back
                </button>
                <div className="font-semibold text-[#f1d6b0]">🏰 Frontier Settlement</div>
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Settlement Type
                </label>
                <select
                  value={settlementCategory}
                  onChange={(e) => setSettlementCategory(e.target.value)}
                  className="bg-[#241c16] border border-[#3d2f23] rounded p-1.5 text-xs text-[#eedec8] focus:border-[#d8ab6c] outline-none"
                >
                  <option value="oasis_camp">Oasis Camp / Caravan Haven</option>
                  <option value="watchtower">Border Watchtower</option>
                  <option value="caravanserai">Walled Caravanserai</option>
                  <option value="mining_post">Mining Outpost / Quarry</option>
                  <option value="fortified_citadel">Fortified Citadel</option>
                </select>
              </div>

              {/* Danger Level */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] uppercase tracking-wide font-medium">
                  Danger Level: {settlementDanger}/5
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSettlementDanger(lvl)}
                      className={`py-1 rounded text-center font-bold text-[11px] border transition-colors ${
                        settlementDanger === lvl
                          ? 'bg-[#d8ab6c] text-[#1a1410] border-[#f1d6b0]'
                          : 'bg-[#241c16] text-[#baa48d] border-[#3d2f23] hover:border-[#7c6a5a]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() =>
                    handleGenerate('settlement', {
                      category: settlementCategory,
                      dangerLevel: settlementDanger,
                    })
                  }
                  className="w-full py-1.5 bg-[#d8ab6c] hover:bg-[#e4bb7e] text-[#1a1410] font-semibold rounded-lg flex items-center justify-center gap-1.5 shadow transition-colors"
                >
                  <Castle className="w-3.5 h-3.5" />
                  <span>Establish Settlement</span>
                </button>
              </div>
            </div>
          )}

          {/* SUBMENU: CUSTOM PROMPT */}
          {activeSection === 'custom' && (
            <div className="flex flex-col gap-2 p-1">
              <div className="flex items-center justify-between border-b border-[#3d2f23] pb-1.5">
                <button
                  onClick={() => setActiveSection('main')}
                  className="text-[#baa48d] hover:text-[#eedec8] text-[11px] flex items-center gap-1"
                >
                  ← Back
                </button>
                <div className="font-semibold text-[#f1d6b0]">✍️ Custom Prompt</div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9c8774] font-medium">
                  What would you like to spawn here?
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="e.g. A colossal obsidian scarab that burrows under sand dunes..."
                  rows={3}
                  className="w-full bg-[#241c16] border border-[#3d2f23] rounded-lg p-2 text-xs text-[#eedec8] placeholder:text-[#6e5d4e] focus:border-[#d8ab6c] outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={!customPrompt.trim()}
                  onClick={() =>
                    handleGenerate('beast', {
                      customPrompt,
                      dangerLevel: 3,
                    })
                  }
                  className="py-1.5 bg-[#3b2d20] hover:bg-[#4a3928] disabled:opacity-50 text-[#eedec8] font-medium rounded-lg text-center transition-colors"
                >
                  🐉 As Beast
                </button>
                <button
                  type="button"
                  disabled={!customPrompt.trim()}
                  onClick={() =>
                    handleGenerate('story_event', {
                      customPrompt,
                      category: 'Custom Event',
                    })
                  }
                  className="py-1.5 bg-[#3b2d20] hover:bg-[#4a3928] disabled:opacity-50 text-[#eedec8] font-medium rounded-lg text-center transition-colors"
                >
                  ⚔️ As Encounter
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
