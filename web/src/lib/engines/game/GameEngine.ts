import {
  PlayerState,
  CheckResolution,
  DiceOutcome,
  RiskLevel,
  StateMutationDiff,
  ChoiceOption,
} from '@/lib/types/gameplay';
import { RPGSystemSchema, GameItem } from '@/lib/types/rpg';
import { WorldBible, WorldStateLedger } from '@/lib/types/world';

export interface RollOptions {
  statId?: string;
  skillId?: string;
  targetDC?: number;
  riskLevel?: RiskLevel;
  environmentalModifier?: number;
  forcedDiceRoll?: number; // Useful for deterministic testing
}

export class GameEngine {
  /**
   * Rolls dice deterministically or via standard pseudo-random number generation.
   */
  public static rollDice(
    diceType: 'd20' | '2d6' | 'd100' = 'd20',
    forcedRoll?: number
  ): { roll: number; isNatMax: boolean; isNatMin: boolean } {
    if (forcedRoll !== undefined) {
      const max = diceType === 'd20' ? 20 : diceType === '2d6' ? 12 : 100;
      const min = diceType === '2d6' ? 2 : 1;
      return {
        roll: forcedRoll,
        isNatMax: forcedRoll >= max,
        isNatMin: forcedRoll <= min,
      };
    }

    switch (diceType) {
      case '2d6': {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const total = d1 + d2;
        return {
          roll: total,
          isNatMax: total === 12,
          isNatMin: total === 2,
        };
      }
      case 'd100': {
        const roll = Math.floor(Math.random() * 100) + 1;
        return {
          roll,
          isNatMax: roll === 100,
          isNatMin: roll === 1,
        };
      }
      case 'd20':
      default: {
        const roll = Math.floor(Math.random() * 20) + 1;
        return {
          roll,
          isNatMax: roll === 20,
          isNatMin: roll === 1,
        };
      }
    }
  }

  /**
   * Computes standard stat modifier.
   * For standard D20: (Stat - 10) / 2 (e.g. 14 -> +2, 8 -> -1)
   */
  public static getStatModifier(statValue: number): number {
    return Math.floor((statValue - 10) / 2);
  }

  /**
   * Dynamically infers the most relevant Stat ID from action text and active RPG system.
   */
  public static inferStatId(
    actionText: string,
    rpgSystem: RPGSystemSchema,
    riskLevel?: string
  ): string {
    const lower = actionText.toLowerCase();

    // 1. Direct match: check if any stat ID, stat Name, or skill is mentioned
    for (const stat of rpgSystem.stats) {
      if (
        lower.includes(stat.id.toLowerCase()) ||
        (stat.name && lower.includes(stat.name.toLowerCase()))
      ) {
        return stat.id;
      }
    }

    for (const skill of rpgSystem.skills) {
      if (
        lower.includes(skill.id.toLowerCase()) ||
        (skill.name && lower.includes(skill.name.toLowerCase()))
      ) {
        if (rpgSystem.stats.some((s) => s.id === skill.linkedStatId)) {
          return skill.linkedStatId;
        }
      }
    }

    // 2. Genre-agnostic keyword clusters matched strictly against active stats
    const availableStatIds = rpgSystem.stats.map((s) => s.id.toLowerCase());

    const keywordMappings: { keywords: RegExp; targetIds: string[] }[] = [
      // Physical force / melee / violence
      {
        keywords: /حمله|خنجر|شمشیر|مشت|زور|ضرب|strike|hit|attack|force|slash|might|break|fight|shoot|punch/,
        targetIds: ['might', 'strength', 'power', 'combat', 'athletics', 'force'],
      },
      // Speed / stealth / finesse / evasion
      {
        keywords: /پنهان|مخفی|فرار|چابک|sneak|hide|dodge|jump|run|agility|slip|flee|escape|acrobatics|stealth/,
        targetIds: ['agility', 'dexterity', 'speed', 'stealth', 'reflexes', 'finesse'],
      },
      // Wit / perception / investigation / mechanics / tech / lockpicking
      {
        keywords: /قفل|تله|کلید|lock|pick|trap|cunning|معما|دقت|examine|investigate|mechanism|hack|code|analyze|wit|search/,
        targetIds: ['cunning', 'wit', 'intellect', 'perception', 'hacking', 'tech', 'investigation', 'logic'],
      },
      // Magic / occult / essence / arcane / science
      {
        keywords: /افسون|جادو|ورد|طلسم|magic|spell|arcana|relic|curse|occult|channel|ritual|cyberware/,
        targetIds: ['arcana', 'magic', 'occult', 'spirit', 'sorcery', 'cyberware', 'mysticism'],
      },
      // Social / charm / empathy / deception / romance / diplomacy
      {
        keywords: /عشق|نگاه|همدلی|فریب|مذاکره|صحبت|لبخند|charm|persuade|talk|romance|empathy|deceive|lie|intimidate|diplomacy|passion|kiss|hug|confess/,
        targetIds: ['charm', 'empathy', 'passion', 'presence', 'charisma', 'persuasion', 'diplomacy', 'wit'],
      },
    ];

    for (const mapping of keywordMappings) {
      if (mapping.keywords.test(lower)) {
        const matchedStatId = mapping.targetIds.find((id) => availableStatIds.includes(id));
        if (matchedStatId) return matchedStatId;
      }
    }

    // 3. Fallback to available stats in this story
    if (rpgSystem.stats.length > 0) {
      if (riskLevel === 'high' && rpgSystem.stats.length > 1) {
        return rpgSystem.stats[0].id;
      }
      return rpgSystem.stats[rpgSystem.stats.length > 1 ? 1 : 0].id;
    }

    return 'might';
  }

  /**
   * Resolves a skill / stat check with deterministic outcome calculations.
   */
  public static resolveActionCheck(
    actionText: string,
    playerState: PlayerState,
    rpgSystem: RPGSystemSchema,
    options: RollOptions = {}
  ): CheckResolution {
    const diceType = rpgSystem.diceType || 'd20';
    const { roll, isNatMax, isNatMin } = this.rollDice(diceType, options.forcedDiceRoll);

    // Determine effective stat ID (dynamically infer from actionText and rpgSystem if omitted)
    const effectiveStatId = options.statId || this.inferStatId(actionText, rpgSystem, options.riskLevel);

    // Calculate stat bonus
    let statModifier = 0;
    if (effectiveStatId && playerState.stats[effectiveStatId] !== undefined) {
      statModifier = this.getStatModifier(playerState.stats[effectiveStatId]);
    }

    // Calculate skill bonus
    let skillBonus = 0;
    if (options.skillId) {
      const skill = rpgSystem.skills.find((s) => s.id === options.skillId);
      if (skill) {
        skillBonus = skill.bonusModifier;
      }
    }

    // Equipment & Inventory Tool modifier (equipped gear + relevant tools like lockpick_set)
    let equipmentModifier = 0;
    if (effectiveStatId) {
      const equippedIds = playerState.equipment
        ? [
            playerState.equipment.mainHand,
            playerState.equipment.offHand,
            playerState.equipment.armor,
            playerState.equipment.relic,
          ].filter(Boolean)
        : [];

      for (const item of playerState.inventory) {
        // Apply if item is actively equipped OR is a relevant tool (like lockpick_set for cunning)
        const isEquipped = equippedIds.includes(item.id);
        const isRelevantTool = item.type === 'quest_item';

        if ((isEquipped || isRelevantTool) && item.statModifiers && item.statModifiers[effectiveStatId]) {
          equipmentModifier += item.statModifiers[effectiveStatId];
        }
      }
    }

    // Check for tactical consumable or potion triggers in actionText
    let itemTacticalEnvMod = 0;
    const lowerAction = actionText.toLowerCase();
    const itemsRemovedIds: string[] = [];
    const initialResourceChanges: Record<string, number> = {};

    // Smoke pellet / distraction trigger
    if (/smoke|pellet|دود|مه|استتار/.test(lowerAction)) {
      const smokeItem = playerState.inventory.find(
        (i) => i.id === 'smoke_pellet' || i.name.toLowerCase().includes('smoke') || i.name.includes('دود')
      );
      if (smokeItem && smokeItem.quantity > 0) {
        itemTacticalEnvMod += 4; // Grant +4 environmental tactical advantage
        itemsRemovedIds.push(smokeItem.id);
      }
    }

    // Healing potion / tincture trigger
    if (/drink|potion|tincture|معجون|نوشیدن|درمان/.test(lowerAction)) {
      const potionItem = playerState.inventory.find(
        (i) => (i.healValue && i.healValue > 0) || i.id.includes('potion') || i.id.includes('tincture') || i.name.includes('معجون')
      );
      if (potionItem && potionItem.quantity > 0) {
        const healAmt = potionItem.healValue || 30;
        initialResourceChanges.hp = (initialResourceChanges.hp || 0) + healAmt;
        itemsRemovedIds.push(potionItem.id);
      }
    }

    const envMod = (options.environmentalModifier || 0) + itemTacticalEnvMod;
    const totalScore = roll + statModifier + skillBonus + equipmentModifier + envMod;

    // Default DC based on risk level if not explicitly provided
    const baseDC =
      options.targetDC !== undefined
        ? options.targetDC
        : options.riskLevel === 'high'
        ? 15
        : options.riskLevel === 'medium'
        ? 12
        : 9;

    let outcome: DiceOutcome;
    let consequenceSummary: string;
    const stateDiff: StateMutationDiff = {
      itemsRemovedIds: itemsRemovedIds.length > 0 ? itemsRemovedIds : undefined,
    };
    if (Object.keys(initialResourceChanges).length > 0) {
      stateDiff.resourceChanges = { ...initialResourceChanges };
    }

    if (isNatMin) {
      outcome = 'critical_failure';
      consequenceSummary = 'Disaster strikes: complete failure with severe complications or damage.';
      stateDiff.resourceChanges = { ...(stateDiff.resourceChanges || {}), hp: (stateDiff.resourceChanges?.hp || 0) - 15 };
    } else if (isNatMax) {
      outcome = 'critical_success';
      consequenceSummary = 'Flawless execution: effortless success with bonus insight or tactical advantage.';
    } else if (totalScore >= baseDC + 5) {
      outcome = 'critical_success';
      consequenceSummary = 'Decisive victory: achieved the objective with exceptional style and advantage.';
    } else if (totalScore >= baseDC) {
      outcome = 'success';
      consequenceSummary = 'Clear success: objective accomplished as intended.';
    } else if (totalScore >= baseDC - 3) {
      outcome = 'mixed_success';
      consequenceSummary = 'Mixed success: goal achieved, but with cost, minor injury, or alert raised.';
      stateDiff.resourceChanges = {
        ...(stateDiff.resourceChanges || {}),
        hp: (stateDiff.resourceChanges?.hp || 0) - 5,
        stamina: (stateDiff.resourceChanges?.stamina || 0) - 10,
      };
    } else {
      outcome = 'failure';
      consequenceSummary = 'The attempt failed: unexpected obstacle arose or opportunity lost.';
      stateDiff.resourceChanges = { ...(stateDiff.resourceChanges || {}), hp: (stateDiff.resourceChanges?.hp || 0) - 10 };
    }

    return {
      actionDescription: actionText,
      statId: effectiveStatId,
      statModifier: statModifier + skillBonus + equipmentModifier,
      diceRoll: roll,
      diceType,
      environmentalModifier: envMod,
      totalScore,
      difficultyClass: baseDC,
      outcome,
      consequenceSummary,
      stateDiff,
    };
  }

  /**
   * Applies state mutations cleanly to the PlayerState and returns an immutable updated state.
   */
  public static applyStateMutation(
    currentState: PlayerState,
    diff: StateMutationDiff,
    rpgSystem?: RPGSystemSchema
  ): PlayerState {
    const updated: PlayerState = JSON.parse(JSON.stringify(currentState));

    // 1. Apply Stat Changes
    if (diff.statChanges) {
      for (const [statId, delta] of Object.entries(diff.statChanges)) {
        const current = updated.stats[statId] || 10;
        updated.stats[statId] = Math.max(1, current + delta);
      }
    }

    // 2. Apply Resource Changes (HP, Stamina, Mana, Gold)
    if (diff.resourceChanges) {
      for (const [resourceId, delta] of Object.entries(diff.resourceChanges)) {
        const current = updated.resources[resourceId] !== undefined ? updated.resources[resourceId] : 100;
        let maxVal = 100;
        let minVal = 0;

        if (rpgSystem) {
          const resDef = rpgSystem.resources.find((r) => r.id === resourceId);
          if (resDef) {
            maxVal = resDef.max;
            minVal = resDef.min;
          }
        }

        updated.resources[resourceId] = Math.min(maxVal, Math.max(minVal, current + delta));
      }
    }

    // 3. Apply Inventory Additions
    if (diff.itemsAdded && diff.itemsAdded.length > 0) {
      for (const newItem of diff.itemsAdded) {
        const existing = updated.inventory.find((i) => i.id === newItem.id);
        if (existing) {
          existing.quantity += newItem.quantity;
        } else {
          updated.inventory.push({ ...newItem });
        }
      }
    }

    // 4. Apply Inventory Removals (decrement quantity by 1 if stacked)
    if (diff.itemsRemovedIds && diff.itemsRemovedIds.length > 0) {
      for (const removeId of diff.itemsRemovedIds) {
        const itemIndex = updated.inventory.findIndex((i) => i.id === removeId);
        if (itemIndex >= 0) {
          if (updated.inventory[itemIndex].quantity > 1) {
            updated.inventory[itemIndex].quantity -= 1;
          } else {
            updated.inventory.splice(itemIndex, 1);
          }
        }
      }
    }

    // 5. Apply Location Change
    if (diff.locationChange) {
      updated.currentLocationId = diff.locationChange;
      if (!updated.discoveredLocationIds.includes(diff.locationChange)) {
        updated.discoveredLocationIds.push(diff.locationChange);
      }
    }

    // 6. Apply Relationship Changes
    if (diff.relationshipChanges) {
      for (const [npcId, change] of Object.entries(diff.relationshipChanges)) {
        if (!updated.relationships[npcId]) {
          updated.relationships[npcId] = {
            trust: 0,
            knownSecrets: [],
            notes: [],
          };
        }

        const rel = updated.relationships[npcId];
        rel.trust = Math.min(100, Math.max(-100, rel.trust + change.trustDelta));

        if (change.newSecret && !rel.knownSecrets.includes(change.newSecret)) {
          rel.knownSecrets.push(change.newSecret);
        }
      }
    }

    return updated;
  }

  // ------------------------------------------------------------------
  // Plan 08 — Living World State Ledger derivation (Tier 3)
  // ------------------------------------------------------------------

  /**
   * Derives a Living World Ledger patch from a deterministic state mutation
   * diff, so NPC relationship shifts and story-critical item gains survive
   * beyond the current turn instead of evaporating.
   *
   * Heuristics (deterministic by design):
   * - `relationshipChanges` on NPCs with a known faction drift that faction's
   *   reputation score by the trust delta.
   * - Every touched NPC gets/updates a status entry (default: alive).
   * - Added items flagged as quest items or high rarity become key items.
   */
  public static deriveLedgerPatch(
    diff: StateMutationDiff,
    worldBible: WorldBible
  ): Partial<WorldStateLedger> {
    const npcById = new Map(worldBible.npcs.map((n) => [n.id, n]));

    const factionDeltas = new Map<string, { name: string; delta: number }>();
    const npcStatuses: WorldStateLedger['npcStatuses'] = [];

    for (const [npcId, change] of Object.entries(diff.relationshipChanges || {})) {
      const npc = npcById.get(npcId);
      npcStatuses.push({
        npcId,
        npcName: npc?.name || npcId,
        status: 'alive',
        note: change.newSecret ? `Learned secret: ${change.newSecret}` : undefined,
      });
      const factionId = npc?.factionId;
      if (factionId && change.trustDelta !== 0) {
        const entry = factionDeltas.get(factionId) || { name: '', delta: 0 };
        entry.delta += change.trustDelta;
        if (npc?.factionId) {
          entry.name = worldBible.factions.find((f) => f.id === factionId)?.name || factionId;
        }
        factionDeltas.set(factionId, entry);
      }
    }

    const factionReputations: WorldStateLedger['factionReputations'] = [];
    for (const [factionId, { name, delta }] of factionDeltas) {
      const stance =
        delta >= 25 ? 'friendly' : delta <= -25 ? 'hostile' : 'neutral';
      factionReputations.push({ factionId, factionName: name || factionId, score: delta, stance });
    }

    const keyItems: WorldStateLedger['keyItems'] = (diff.itemsAdded || [])
      .filter((item) => this.isStoryCriticalItem(item))
      .map((item) => ({
        itemId: item.id,
        name: item.name,
        description: item.description || '',
        isStoryCritical: true,
      }));

    const patch: Partial<WorldStateLedger> = {};
    if (factionReputations.length) patch.factionReputations = factionReputations;
    if (npcStatuses.length) patch.npcStatuses = npcStatuses;
    if (keyItems.length) patch.keyItems = keyItems;
    return patch;
  }

  private static isStoryCriticalItem(item: GameItem): boolean {
    return (
      item.type === 'quest_item' ||
      /quest|relic|artifact|seal|heirloom|ledger/i.test(item.id) ||
      /quest|relic|artifact|seal|heirloom|ledger/i.test(item.name)
    );
  }

  /**
   * Merges a derived ledger patch into the session's persisted Living World
   * Ledger. Entries are keyed by id so repeated turns accumulate deltas rather
   * than overwrite history; reputation scores are clamped to [-100, +100].
   */
  public static mergeLedgerPatch(
    base: WorldStateLedger | null | undefined,
    patch: Partial<WorldStateLedger>
  ): WorldStateLedger {
    const merged: WorldStateLedger = base
      ? JSON.parse(JSON.stringify(base))
      : { factionReputations: [], npcStatuses: [], keyItems: [], chapterSummaries: [], openPlotThreads: [] };

    for (const rep of patch.factionReputations || []) {
      const existing = merged.factionReputations.find((r) => r.factionId === rep.factionId);
      if (existing) {
        existing.score = Math.min(100, Math.max(-100, existing.score + rep.score));
        existing.stance = rep.stance;
        if (rep.note) existing.note = rep.note;
      } else {
        merged.factionReputations.push({ ...rep, note: rep.note });
      }
    }

    for (const npc of patch.npcStatuses || []) {
      const existing = merged.npcStatuses.find((n) => n.npcId === npc.npcId);
      if (existing) {
        existing.status = npc.status;
        if (npc.note) existing.note = npc.note;
      } else {
        merged.npcStatuses.push({ ...npc });
      }
    }

    for (const item of patch.keyItems || []) {
      if (!merged.keyItems.some((k) => k.itemId === item.itemId)) {
        merged.keyItems.push({ ...item });
      }
    }

    return merged;
  }
}
