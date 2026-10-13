// @ts-nocheck
import dotenv from 'dotenv';
dotenv.config();

process.env.ENABLE_DB = 'true';
process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';

import crypto from 'node:crypto';
import { StoryRepository } from '../src/lib/db/repositories/storyRepository';
import { SessionRepository } from '../src/lib/db/repositories/sessionRepository';
import { migrateStoryManifestToUnifiedGraph } from '../src/lib/engines/world/graphMigration';
import { computeMaxResources } from '../src/lib/engines/game/vitalScaling';
import { addToPurse } from '../src/lib/engines/game/currencyEngine';
import { PromptAssembler } from '../src/lib/engines/narrative/PromptAssembler';
import { GeminiAdapter } from '../src/lib/providers/GeminiAdapter';
import { ActionValidator } from '../src/lib/engines/validator/ActionValidator';
import { GameEngine } from '../src/lib/engines/game/GameEngine';
import { generateValidatedScene } from '../src/lib/engines/narrative/narrativeTurn';
import { reconcilePlayerResources } from '../src/lib/engines/game/resourcePools';
import { artifactToGameItem } from '../src/lib/play/artifactItems';
import { getActiveNpcsForLocation } from '../src/lib/engines/world/tradeRoutes';
import {
  buildWorldContextBlocks,
  formatNpcCombatSummary,
  formatEquippedItemsForContext,
  formatAbilitiesForContext,
  formatTraitsForContext,
  formatItemInteractionsCatalogForContext,
} from '../src/lib/engines/narrative/worldContext';
import { PlayerState, ChoiceOption, PlaythroughSession } from '../src/lib/types/gameplay';
import { WorkingContextEnvelope } from '../src/lib/types/memory';

const geminiAdapter = new GeminiAdapter();

interface TurnAuditRecord {
  turnNumber: number;
  chosenChoice: ChoiceOption;
  resolution: {
    diceRoll: number;
    statBonus: number;
    modifierSum: number;
    totalScore: number;
    targetDC?: number;
    outcome: string;
    modifiersApplied: any[];
    consequenceSummary: string;
  };
  prose: string;
  nextChoices: ChoiceOption[];
  auditIssues: string[];
}

function selectMightOrConfrontationChoice(choices: ChoiceOption[]): ChoiceOption {
  console.log('\n--- Available Choices ---');
  choices.forEach((c, i) => {
    console.log(`[${i + 1}] (Stat: ${c.requiredStatId || 'diceless'}, DC: ${c.targetDC ?? 'N/A'}, Risk: ${c.riskLevel || 'medium'})`);
    console.log(`    "${c.text}"`);
  });

  // 1. Explicitly Might
  const mightChoices = choices.filter(c => c.requiredStatId === 'might');
  if (mightChoices.length > 0) {
    const combatMight = mightChoices.find(c =>
      /گزمه|سپر|شمشیر|حمله|درگیری|پیشروی|شکستن|نیرو|زور|مهار|دفاع|معبر|یورش/.test(c.text)
    );
    const sel = combatMight || mightChoices[0];
    console.log(`\n=> Selected Might Choice: "${sel.text}"`);
    return sel;
  }

  // 2. Confrontation keywords
  const confrontKeywords = /گزمه|سرباز|سپر|شمشیر|حمله|درگیری|پیشروی|نیرو|یورش|سد|معبر/;
  const confrontChoice = choices.find(c => confrontKeywords.test(c.text));
  if (confrontChoice) {
    console.log(`\n=> Selected Sentry Confrontation Choice: "${confrontChoice.text}"`);
    return confrontChoice;
  }

  // Fallback
  console.log(`\n=> Selected First Choice: "${choices[0].text}"`);
  return choices[0];
}

async function generateOpeningChoicesHelper(story: any, initialBeat: any, playerState: PlayerState): Promise<ChoiceOption[]> {
  const wb = story.worldBible ?? {};
  const locationId = initialBeat.locationId || playerState.currentLocationId || wb.locations?.[0]?.id || 'loc_default';
  const location = wb.locations?.find((l: any) => l.id === locationId) || wb.locations?.[0] || { id: locationId, name: 'Citadel', description: '' };
  const { activeNpcs: activeNPCs, activeNpcIds, caravanAffiliationByNpcId } = getActiveNpcsForLocation(
    locationId,
    wb,
    story.language === 'en' ? 'en' : 'fa'
  );
  const world = buildWorldContextBlocks(story, {
    scopeTier: 'regional',
    locationIds: [locationId],
    npcIds: activeNpcIds,
  });

  const activeNpcDossiers: WorkingContextEnvelope['activeNpcDossiers'] = activeNPCs.map((n: any) => {
    const isMentionedInProse = [String(initialBeat.narrativeText || '')].some(
      (s) => s.includes(n.name) || (n.title && s.includes(n.title))
    );
    return {
      id: n.id,
      name: n.name,
      trust: n.initialTrust ?? 0,
      knownSecrets: [],
      speechStyle: n.speechStyle || 'neutral',
      vitalsLine: formatNpcCombatSummary(n) || undefined,
      presenceStatus: isMentionedInProse ? ('present' as const) : ('nearby_resident' as const),
      caravanAffiliation: caravanAffiliationByNpcId.get(n.id),
    };
  });

  const context: WorkingContextEnvelope = {
    storyTitle: story.title,
    worldLaws: world.laws,
    currentLocationName: location.name,
    currentLocationDescription: location.description || '',
    activeNpcDossiers,
    relevantMemories: [],
    playerStatus: {
      stats: playerState.stats || {},
      resources: playerState.resources || {},
      equippedItems: formatEquippedItemsForContext(playerState, story),
      characterName: playerState.characterName,
      archetypeName: playerState.archetypeName,
      abilities: formatAbilitiesForContext(playerState, story),
      traits: formatTraitsForContext(playerState, story),
      itemInteractionsCatalog: formatItemInteractionsCatalogForContext(playerState, story),
    },
    statsConfig: story.rpgSystem?.stats,
    universalBaseValue: (story.rpgSystem as any)?.universalBaseValue,
    recentSceneSnippets: [String(initialBeat.narrativeText || '')].filter(Boolean),
    languageDirective: 'fa',
    authoredSystemPrompt: world.authoredSystemPrompt,
    worldSummary: world.worldSummary,
    themeNotes: world.themeNotes,
    factions: world.factions?.slice(0, 3),
    factionRelations: world.factionRelations?.slice(0, 3),
    timeline: world.timeline?.slice(0, 2),
    artifacts: world.artifacts?.slice(0, 3),
    bestiary: world.bestiary?.slice(0, 3),
    religions: world.religions?.slice(0, 2),
    dramaBonds: world.dramaBonds?.slice(0, 3),
    locations: world.locations?.slice(0, 3),
    npcs: world.npcs?.slice(0, 4),
    tradeRoutes: world.tradeRoutes?.slice(0, 2),
  };

  const promptPayload = PromptAssembler.buildNarrativePrompt(context);
  const generated = await geminiAdapter.generateScene(promptPayload);
  return ActionValidator.sanitizeChoices(
    generated.choices,
    playerState,
    story.worldBible,
    story.storyNpcOverrides
  );
}

async function main() {
  console.log('================================================================');
  console.log('   StoryForge Ashes of Zarvan (خاکسترِ زروان) Live Engine Playtest ');
  console.log('   Archetype: شمشیردار هیرام | Background: محافظ کاروانِ دشت     ');
  console.log('   Direct Engine & Model Integration (`gemini-3.6-flash`)       ');
  console.log('================================================================\n');

  const rawStory = await StoryRepository.getStoryById('story_mt4ofllt');
  if (!rawStory) {
    console.error('Story not found in database: story_mt4ofllt');
    process.exit(1);
  }

  const story = migrateStoryManifestToUnifiedGraph(rawStory);
  console.log(`Story loaded: "${story.title}" (${story.id})`);

  // Setup character
  const characterSetup = {
    characterName: 'برزین',
    archetypeId: 'arch_hiram_bladebearer',
    backgroundId: 'bg_hiram_guard',
  };

  const initialStats: Record<string, number> = {};
  for (const s of story.rpgSystem.stats) {
    initialStats[s.id] = s.baseValue;
  }

  const selectedArch = story.rpgSystem.archetypes?.find((a: any) => a.id === characterSetup.archetypeId);
  const selectedBg = story.rpgSystem.backgrounds?.find((b: any) => b.id === characterSetup.backgroundId);

  let archetypeName = selectedArch?.name;
  let backgroundName = selectedBg?.name;
  const traits: string[] = [];
  let startingEquipment: any = { mainHand: 'iron_dagger' };
  const startingInventory = JSON.parse(JSON.stringify(story.rpgSystem.startingInventory || []));
  let initialPurse: Record<string, number> = {};

  if (selectedArch) {
    if (selectedArch.statBonuses) {
      for (const [k, v] of Object.entries(selectedArch.statBonuses)) {
        initialStats[k] = (initialStats[k] || 10) + (v as number);
      }
    }
    if (selectedArch.startingPurse) initialPurse = addToPurse(initialPurse, selectedArch.startingPurse);
    if (selectedArch.startingEquipment) startingEquipment = { ...startingEquipment, ...selectedArch.startingEquipment };
    if (selectedArch.bonusItems) {
      for (const bi of selectedArch.bonusItems) startingInventory.push(JSON.parse(JSON.stringify(bi)));
    }
  }

  if (selectedBg) {
    if (selectedBg.trait) traits.push(selectedBg.trait);
    if (selectedBg.statBonuses) {
      for (const [k, v] of Object.entries(selectedBg.statBonuses)) {
        initialStats[k] = (initialStats[k] || 10) + (v as number);
      }
    }
    if (selectedBg.startingPurse) initialPurse = addToPurse(initialPurse, selectedBg.startingPurse);
  }

  const vaultArtifacts: any[] = story.worldBible?.artifacts || [];
  const equippedArtifacts: any[] = [];
  for (const slot of ['mainHand', 'offHand', 'armor', 'relic'] as const) {
    const ref = startingEquipment[slot];
    const art = ref ? vaultArtifacts.find((a: any) => a.id === ref || a.name === ref) : undefined;
    if (art) {
      startingEquipment[slot] = art.id;
      equippedArtifacts.push(art);
      if (!startingInventory.some((i: any) => i.id === art.id)) {
        startingInventory.push(artifactToGameItem(art));
      }
    }
  }

  const maxResources = computeMaxResources(initialStats, story.rpgSystem, {
    archetype: selectedArch,
    background: selectedBg,
    equippedArtifacts,
  });

  const initialResources: Record<string, number> = {};
  for (const res of story.rpgSystem.resources || []) {
    initialResources[res.id] = maxResources[res.id] ?? res.max ?? 1;
  }

  const openingBeat = story.initialStoryBeats?.[0] || {
    sceneId: 'scene_start',
    locationId: story.worldBible?.locations?.[0]?.id || '',
    narrativeText: '',
    choices: [],
  };

  const initialTraitIds: string[] = [];
  for (const t of selectedBg?.traits ?? []) {
    if (t?.id) initialTraitIds.push(t.id);
  }

  let playerState: PlayerState = {
    characterName: characterSetup.characterName,
    archetypeId: characterSetup.archetypeId,
    archetypeName,
    backgroundId: characterSetup.backgroundId,
    backgroundName,
    traits: traits.length > 0 ? traits : undefined,
    traitIds: initialTraitIds.length > 0 ? initialTraitIds : undefined,
    stats: initialStats,
    resources: initialResources,
    maxResources,
    purse: initialPurse,
    inventory: startingInventory,
    equipment: startingEquipment,
    abilities: selectedArch?.startingAbilities || [],
    discoveredLocationIds: openingBeat.locationId ? [openingBeat.locationId] : [],
    discoveredCreatureIds: [],
    relationships: {},
    activeQuestIds: ['quest_prologue'],
    completedQuestIds: [],
    currentLocationId: openingBeat.locationId,
  };

  console.log(`Character: ${playerState.characterName} (${archetypeName} - ${backgroundName})`);
  console.log('Stats:', playerState.stats);
  console.log('Resources:', playerState.resources);
  console.log('Starting Abilities:', playerState.abilities);
  console.log('Equipped:', playerState.equipment);

  console.log('\nGenerating opening choices via model...');
  const openingChoices = await generateOpeningChoicesHelper(story, openingBeat, playerState);

  console.log(`\n[Opening Scene Prose]:`);
  console.log(openingBeat.narrativeText?.trim());

  let currentChoices = openingChoices;
  let turnNumber = 2;
  const history: TurnAuditRecord[] = [];
  const TOTAL_TURNS = 3;

  for (let turn = 1; turn <= TOTAL_TURNS; turn++) {
    console.log(`\n================================================================`);
    console.log(`                   TURN ${turn} (Turn Number: ${turnNumber})`);
    console.log(`================================================================`);

    // Audit choice texts for roll check leaks
    for (const c of currentChoices) {
      if (/\(بررسی مهارت|\(تاس|\[DC|\(roll check/i.test(c.text)) {
        console.warn(`[WARNING: CHOICE TAG LEAK DETECTED]: "${c.text}"`);
      }
    }

    const chosen = selectMightOrConfrontationChoice(currentChoices);

    // 1. Resolve action check with GameEngine
    const resolution = GameEngine.resolveActionCheck(
      chosen.text,
      playerState,
      story.rpgSystem,
      {
        statId: chosen.requiredStatId,
        riskLevel: (chosen.riskLevel as any) || 'medium',
        targetDC: chosen.targetDC,
        isPersian: true,
        worldBible: story.worldBible,
        currentLocationId: playerState.currentLocationId,
        turnNumber,
        actionStyle: 'aggressive',
      }
    );

    console.log('\n--- Deterministic Engine Resolution ---');
    console.log(`Roll: ${resolution.diceRoll} + ${resolution.statBonus} (Bonus) + ${resolution.modifierSum} (Mod Sum) = ${resolution.totalScore} vs DC ${resolution.targetDC}`);
    console.log(`Outcome: ${resolution.outcome}`);
    console.log(`Modifiers Applied:`, resolution.modifiersApplied?.map((m: any) => `${m.name || m.source} (${m.value >= 0 ? '+' : ''}${m.value})`) || 'None');
    console.log(`Consequence: ${resolution.consequenceSummary}`);

    // Apply state mutation
    let updatedPlayerState = GameEngine.applyStateMutation(
      playerState,
      resolution.stateDiff,
      story.rpgSystem
    );

    // Generate validated narrative scene
    console.log('\nCalling GeminiAdapter.generateValidatedScene...');
    const sceneOutcome = await generateValidatedScene(
      {
        story,
        playerState: updatedPlayerState,
        resolution,
        playerActionText: chosen.text,
        ledger: {
          factionReputations: [],
          npcStatuses: [],
          keyItems: [],
          chapterSummaries: [],
          openPlotThreads: [],
          worldBibleVersion: 1,
        },
        sessionTurns: history.map((h) => ({
          turnNumber: h.turnNumber,
          narrativeProse: h.prose,
          playerActionText: h.chosenChoice.text,
          presentedChoices: h.nextChoices,
        })),
        sessionMemories: [],
        currentChapterId: story.saga?.chapters?.[0]?.id,
        previousLocationId: playerState.currentLocationId,
      },
      geminiAdapter,
      (choices) =>
        ActionValidator.sanitizeChoices(
          choices,
          updatedPlayerState,
          story.worldBible,
          story.storyNpcOverrides
        )
    );

    if (sceneOutcome.status !== 'ok') {
      console.error(`Narrative generation failed with status: ${sceneOutcome.status}`);
      break;
    }

    const prose = sceneOutcome.narrativeProse;
    const nextChoices = sceneOutcome.presentedChoices;

    console.log('\n--- Generated Narrative Prose ---');
    console.log(prose.trim());

    // Audit Checks for this turn
    const auditIssues: string[] = [];

    // Check 1: Choice tag leaks on next choices
    for (const nc of nextChoices) {
      if (/\(بررسی مهارت|\(تاس|\[DC|\(roll check/i.test(nc.text)) {
        auditIssues.push(`CHOICE_TAG_LEAK: "${nc.text}" contains check tag`);
      }
    }

    // Check 2: Comedic guard collapse in turn 1
    if (turn === 1) {
      if (/خیس کرد|شلوار|پا به فرار|فرار همه گزمه/i.test(prose)) {
        auditIssues.push('COMEDIC_GUARD_REACTION: Sentries wet themselves or completely fled instantly.');
      }
    }

    // Check 3: Modifier leakage (e.g. missile shield defense in social or non-missile check)
    if (resolution.modifiersApplied?.length) {
      for (const m of resolution.modifiersApplied) {
        if (m.name?.includes('پرتابه') && !/پرتابه|تیر|کمان|سنگ/.test(chosen.text)) {
          auditIssues.push(`MISSILE_MODIFIER_LEAK: "${m.name}" applied without missile context`);
        }
      }
    }

    history.push({
      turnNumber,
      chosenChoice: chosen,
      resolution: {
        diceRoll: resolution.diceRoll,
        statBonus: resolution.statBonus,
        modifierSum: resolution.modifierSum,
        totalScore: resolution.totalScore,
        targetDC: resolution.targetDC,
        outcome: resolution.outcome,
        modifiersApplied: resolution.modifiersApplied,
        consequenceSummary: resolution.consequenceSummary,
      },
      prose,
      nextChoices,
      auditIssues,
    });

    playerState = updatedPlayerState;
    currentChoices = nextChoices;
    turnNumber++;
  }

  console.log('\n\n================================================================');
  console.log('              FINAL PLAYTEST AUDIT & EVALUATION REPORT          ');
  console.log('================================================================');
  history.forEach((h, idx) => {
    console.log(`\nTurn ${idx + 1}:`);
    console.log(`- Action Chosen: "${h.chosenChoice.text}" [Stat: ${h.chosenChoice.requiredStatId || 'None'}, DC: ${h.chosenChoice.targetDC ?? 'N/A'}]`);
    console.log(`- Dice Roll: ${h.resolution.diceRoll} + ${h.resolution.statBonus} (Bonus) + ${h.resolution.modifierSum} (Mod Sum) = ${h.resolution.totalScore} vs DC ${h.resolution.targetDC}`);
    console.log(`- Outcome: ${h.resolution.outcome}`);
    console.log(`- Modifiers Applied: ${h.resolution.modifiersApplied?.map((m: any) => m.name || m.source).join(', ') || 'None'}`);
    console.log(`- Audit Issues: ${h.auditIssues.length === 0 ? 'None (Clean)' : h.auditIssues.join(' | ')}`);
    console.log(`- Next Presented Choices (${h.nextChoices.length}):`);
    h.nextChoices.forEach((c) => {
      console.log(`    * [${c.requiredStatId || 'diceless'}${c.targetDC ? ' DC ' + c.targetDC : ''}] ${c.text}`);
    });
  });
}

main().catch(console.error);
