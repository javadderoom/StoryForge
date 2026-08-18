'use client';

import React, { useState } from 'react';
import { obsidianCitadelStory } from '@/content/stories/obsidian_citadel';
import { BookOpen, Shield, Sword, User, Sparkles, AlertCircle, CheckCircle, Dice5, Eye } from 'lucide-react';

export default function StoryForgeStudio() {
  const [activeTab, setActiveTab] = useState<'world' | 'rpg' | 'npcs' | 'sandbox'>('world');
  const [testAction, setTestAction] = useState('I try to summon a dragon to melt the iron gate');
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const story = obsidianCitadelStory;

  const handleTestSandbox = async () => {
    setLoading(true);
    try {
      const mockPlayerState = {
        stats: { might: 12, agility: 14, cunning: 10, arcana: 8 },
        resources: { hp: 100, stamina: 50, gold: 30 },
        inventory: story.rpgSystem.startingInventory,
        discoveredLocationIds: ['loc_dungeon_cell'],
        relationships: {
          npc_captain_rolan: { trust: 0, knownSecrets: [], notes: [] },
        },
        activeQuestIds: ['quest_prologue'],
        completedQuestIds: [],
        currentLocationId: 'loc_dungeon_cell',
      };

      const res = await fetch('/api/play/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId: story.id,
          playerActionText: testAction,
          actionStyle: 'free_text',
          riskLevel: 'high',
          playerState: mockPlayerState,
          turnNumber: 2,
        }),
      });

      const data = await res.json();
      setSandboxResult(data);
    } catch (err: any) {
      setSandboxResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 font-sans antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-[#0d0e15]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20 font-black text-white text-lg">
            ⚡
          </div>
          <div>
            <h1 className="font-bold text-lg text-zinc-100 tracking-tight flex items-center gap-2">
              StoryForge Studio
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                V1.0 Authoring Suite
              </span>
            </h1>
            <p className="text-xs text-zinc-400">World Bible, RPG System Rules & AI Simulation Sandbox</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('world')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'world' ? 'bg-zinc-800 text-amber-400 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> World Bible
          </button>
          <button
            onClick={() => setActiveTab('rpg')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'rpg' ? 'bg-zinc-800 text-amber-400 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sword className="w-3.5 h-3.5" /> RPG Mechanics
          </button>
          <button
            onClick={() => setActiveTab('npcs')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'npcs' ? 'bg-zinc-800 text-amber-400 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="w-3.5 h-3.5" /> NPC Dossiers
          </button>
          <button
            onClick={() => setActiveTab('sandbox')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'sandbox' ? 'bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-300 border border-amber-500/30' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> AI Sandbox
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* World Bible Tab */}
        {activeTab === 'world' && (
          <div className="space-y-8">
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100">{story.worldBible.worldName}</h2>
                  <p className="text-sm text-zinc-400 mt-1 max-w-3xl leading-relaxed">{story.worldBible.summary}</p>
                </div>
                <span className="text-xs bg-zinc-800 border border-zinc-700/60 text-zinc-300 px-3 py-1 rounded-lg">
                  World ID: {story.worldBible.worldId}
                </span>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-200/90 flex items-center gap-2">
                <span className="font-semibold text-amber-400">Artistic Tone:</span> {story.worldBible.themeNotes}
              </div>
            </div>

            {/* Laws & Prohibitions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-rose-400" /> Immutable World Laws ({story.worldBible.laws.length})
                </h3>
                <div className="space-y-3">
                  {story.worldBible.laws.map((law) => (
                    <div key={law.id} className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                          {law.category}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">{law.id}</span>
                      </div>
                      <h4 className="text-sm font-semibold text-zinc-200 mt-2">{law.rule}</h4>
                      <p className="text-xs text-zinc-400 mt-1">{law.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Factions */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" /> Factions & Allegiances ({story.worldBible.factions.length})
                </h3>
                <div className="space-y-3">
                  {story.worldBible.factions.map((fac) => (
                    <div key={fac.id} className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-zinc-200">{fac.name}</h4>
                        <span className="text-xs text-blue-400 font-medium">{fac.alignment}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{fac.description}</p>
                      <p className="text-xs text-zinc-500 mt-2">
                        <strong className="text-zinc-400">Goals:</strong> {fac.publicGoals}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RPG Rules Tab */}
        {activeTab === 'rpg' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Primary Stats */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sword className="w-4 h-4 text-amber-400" /> Primary Attributes
                </h3>
                <div className="space-y-3">
                  {story.rpgSystem.stats.map((stat) => (
                    <div key={stat.id} className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-200">{stat.name}</h4>
                        <p className="text-xs text-zinc-400">{stat.description}</p>
                      </div>
                      <span className="text-base font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                        {stat.baseValue}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vitals & Resources */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" /> Vitals & Pools
                </h3>
                <div className="space-y-3">
                  {story.rpgSystem.resources.map((res) => (
                    <div key={res.id} className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-zinc-200">{res.name}</span>
                        <span style={{ color: res.color }}>{res.current} / {res.max}</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(res.current / res.max) * 100}%`,
                            backgroundColor: res.color || '#3b82f6',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Starting Inventory */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-violet-400" /> Initial Equipment
                </h3>
                <div className="space-y-3">
                  {story.rpgSystem.startingInventory.map((item) => (
                    <div key={item.id} className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-zinc-200">{item.name}</h4>
                        <span className="text-xs text-zinc-400 font-mono">x{item.quantity}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* NPCs Tab */}
        {activeTab === 'npcs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {story.worldBible.npcs.map((npc) => (
              <div key={npc.id} className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-zinc-100">{npc.name}</h3>
                    <p className="text-xs text-amber-400 font-medium">{npc.title}</p>
                  </div>
                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-lg border border-zinc-700/50">
                    Trust: {npc.initialTrust}
                  </span>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/60">
                  <p className="text-xs text-zinc-400">
                    <strong className="text-zinc-300">Speech Directives:</strong> {npc.speechStyle}
                  </p>
                </div>

                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Hidden Secrets</h4>
                  {npc.secrets.map((s) => (
                    <div key={s.id} className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/15 text-xs text-rose-200/90">
                      🔒 {s.description} (Requires Trust ≥ {s.requiredTrustLevel})
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Sandbox & Guardrail Simulator Tab */}
        {activeTab === 'sandbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Action & Guardrail Tester
                </h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Enter any player choice or free-text action to test validation guardrails and deterministic outcome calculations.
                </p>

                <textarea
                  value={testAction}
                  onChange={(e) => setTestAction(e.target.value)}
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all resize-none"
                  placeholder="Describe your player action..."
                />

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setTestAction('I try to summon a dragon to melt the iron gate')}
                    className="text-[11px] text-zinc-400 bg-zinc-800/80 hover:bg-zinc-700/80 px-2.5 py-1 rounded-lg transition-all"
                  >
                    Test Dragon Extinction
                  </button>
                  <button
                    onClick={() => setTestAction('I unlock the door with a golden diamond key')}
                    className="text-[11px] text-zinc-400 bg-zinc-800/80 hover:bg-zinc-700/80 px-2.5 py-1 rounded-lg transition-all"
                  >
                    Test Item Hallucination
                  </button>
                </div>

                <button
                  onClick={handleTestSandbox}
                  disabled={loading}
                  className="w-full mt-4 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    'Simulating Turn...'
                  ) : (
                    <>
                      <Dice5 className="w-4 h-4" /> Simulate Action & Generate Turn
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Results Output */}
            <div className="lg:col-span-7">
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 min-h-[400px]">
                <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" /> Simulation Output & Inspection
                </h3>

                {!sandboxResult && !loading && (
                  <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-center">
                    <Dice5 className="w-10 h-10 mb-2 stroke-[1.5] text-zinc-600" />
                    <p className="text-xs">Click &quot;Simulate Action&quot; to test the deterministic engine & AI pipeline.</p>
                  </div>
                )}

                {loading && (
                  <div className="h-64 flex flex-col items-center justify-center text-amber-400/80 animate-pulse">
                    <Sparkles className="w-8 h-8 mb-2 animate-spin" />
                    <p className="text-xs">Validating lore guardrails, calculating dice resolution & calling AI...</p>
                  </div>
                )}

                {sandboxResult && !loading && (
                  <div className="space-y-4">
                    {/* Guardrail Status */}
                    {sandboxResult.isGuardrailViolation ? (
                      <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200">
                        <div className="flex items-center gap-2 font-semibold text-sm text-rose-400">
                          <AlertCircle className="w-4 h-4" /> Guardrail Blocked Action
                        </div>
                        <p className="text-xs mt-1 text-rose-300/90">{sandboxResult.rejectionReason}</p>
                        {sandboxResult.suggestedAction && (
                          <p className="text-xs mt-2 text-zinc-400">
                            <strong>Immersion Guidance:</strong> {sandboxResult.suggestedAction}
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 flex items-center justify-between">
                          <div className="flex items-center gap-2 font-semibold text-sm text-emerald-400">
                            <CheckCircle className="w-4 h-4" /> Guardrail Passed & Resolved
                          </div>
                          {sandboxResult.data?.resolution && (
                            <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                              {sandboxResult.data.resolution.outcome} (Roll: {sandboxResult.data.resolution.diceRoll})
                            </span>
                          )}
                        </div>

                        {/* Generated Narrative */}
                        {sandboxResult.data?.beat && (
                          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                            <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                              Generated Literary Prose
                            </h4>
                            <p className="text-sm text-zinc-200 leading-relaxed font-serif">
                              {sandboxResult.data.beat.narrativeProse}
                            </p>

                            {/* Generated Choices */}
                            <div className="mt-4 pt-4 border-t border-zinc-800/60">
                              <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                                Contextual Next Choices
                              </h5>
                              <div className="space-y-2">
                                {sandboxResult.data.beat.presentedChoices.map((choice: any, idx: number) => (
                                  <div
                                    key={idx}
                                    className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between"
                                  >
                                    <span>{choice.text}</span>
                                    <span
                                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                        choice.riskLevel === 'high'
                                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                          : choice.riskLevel === 'medium'
                                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      }`}
                                    >
                                      {choice.riskLevel} Risk
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
