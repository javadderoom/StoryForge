import { NPCDossier } from '@/lib/types/world';
import { buildEquippedItemProfiles, formatItemInteractionsForPrompt } from '@/lib/engines/game/itemInteractions';
import { describeRollModifier, getActivationCost, getActivationCooldown } from '@/lib/engines/game/abilityEffects';

/**
 * Compact combat summary for an NPC (`elite CR9 — HP 64/80, Rage 3/5`).
 * Empty string when the NPC has no stat calibration. The trailing directive
 * tells the narrator to treat vitals and pools as binding state.
 */
export function formatNpcCombatSummary(n: NPCDossier): string {
  const sc = n.statCalibration;
  if (!sc) return '';
  const basis = sc.crBasis?.trim() ? ` [threat: ${sc.crBasis.trim()}]` : '';
  const parts = [`HP ${sc.vitals?.health?.current ?? '?'}/${sc.vitals?.health?.max ?? '?'}`];
  if (sc.vitals?.stamina) parts.push(`Stamina ${sc.vitals.stamina.current}/${sc.vitals.stamina.max}`);
  if (sc.vitals?.mana) parts.push(`Mana ${sc.vitals.mana.current}/${sc.vitals.mana.max}`);
  for (const p of sc.resourcePools ?? []) parts.push(`${p.name} ${p.current}/${p.max}`);
  return `${sc.combatTier} CR${sc.challengeRating}${basis} — ${parts.join(', ')} (honor these vitals and pools when narrating harm, fatigue, and ability costs)`;
}

/**
 * Formats the protagonist's equipped gear and carrying inventory into rich,
 * contextual lines that convey the item's slot, specific authored powers/purpose,
 * and whether it is a permanent relic vs consumable, so the LLM doesn't misuse them.
 */
export function formatEquippedItemsForContext(
  playerState: { inventory?: any[]; equipment?: Record<string, any> | any },
  story?: any
): string[] {
  const isEnglish = story?.language === 'en';
  const artifacts: any[] = story?.worldBible?.artifacts || [];
  const inventory: any[] = playerState.inventory || [];
  const equipment = playerState.equipment || {};

  const slotLabelsFa: Record<string, string> = {
    mainHand: 'سلاح دست اصلی',
    offHand: 'دست دوم/سپر',
    armor: 'زره و پوشش',
    relic: 'یادگار/طلسم متصل',
  };
  const slotLabelsEn: Record<string, string> = {
    mainHand: 'Main Hand Weapon',
    offHand: 'Off Hand / Shield',
    armor: 'Armor',
    relic: 'Equipped Relic / Talisman',
  };

  const results: string[] = [];

  // 1. Process equipped slots first with full detail
  for (const [slotKey, itemRef] of Object.entries(equipment)) {
    if (!itemRef) continue;
    const invItem = inventory.find((i) =>
      typeof i === 'string' ? i === itemRef : (i.id === itemRef || i.name === itemRef)
    );
    const art = artifacts.find((a) => a.id === itemRef || a.name === itemRef);
    const name = (typeof invItem === 'object' && invItem?.name) || art?.name || (typeof invItem === 'string' ? invItem : itemRef);
    const slotLabel = isEnglish ? (slotLabelsEn[slotKey] || slotKey) : (slotLabelsFa[slotKey] || slotKey);

    const desc = art?.description || (typeof invItem === 'object' ? invItem?.description : '') || '';
    const powers: string[] = art?.powers || [];
    const isNonConsumable = typeof invItem === 'object' ? !invItem?.isConsumable : true;

    const details: string[] = [slotLabel];
    if (powers.length > 0) {
      details.push(isEnglish ? `Powers: ${powers.join(', ')}` : `کارکرد/قدرت: ${powers.join('، ')}`);
    } else if (desc) {
      details.push(desc.slice(0, 75));
    }
    if (slotKey === 'relic' && isNonConsumable) {
      details.push(isEnglish ? 'Permanent gear, non-consumable' : 'دائمی، غیرمصرفی');
    }

    results.push(`${name} [${details.join(' — ')}]`);
  }

  // 2. Process other unequipped carrying items in inventory
  const equippedRefs = new Set(Object.values(equipment).filter(Boolean));
  for (const item of inventory) {
    const itemId = typeof item === 'string' ? item : item?.id;
    const itemName = typeof item === 'string' ? item : (item?.name || item?.id || '');
    if (!itemName) continue;
    if (equippedRefs.has(itemId) || equippedRefs.has(itemName)) continue;

    const art = artifacts.find((a) => a.id === itemId || a.name === itemName);
    const typeLabel = (typeof item === 'object' && item?.type) || 'item';
    const desc = art?.description || (typeof item === 'object' ? item?.description : '') || '';
    const powers: string[] = art?.powers || [];
    const details: string[] = [typeLabel];
    if (powers.length > 0) {
      details.push(isEnglish ? `Powers: ${powers.join(', ')}` : `کارکرد: ${powers.join('، ')}`);
    } else if (desc) {
      details.push(desc.slice(0, 50));
    }
    results.push(`${itemName} [${details.join(' — ')}]`);
  }

  return results.length > 0 ? results : inventory.map((i) => (typeof i === 'string' ? i : i.name));
}

/**
 * Resolves playerState.abilities (which often store raw IDs like `ab_mtw16s8f`)
 * into detailed, human-readable descriptors with ability name, description, and combat/tactical effects.
 */
export function formatAbilitiesForContext(
  playerState: { abilities?: string[] },
  story?: any
): string[] {
  if (!playerState.abilities || playerState.abilities.length === 0) return [];
  const definedAbilities: any[] = story?.rpgSystem?.abilities || [];
  const isEnglish = story?.language === 'en';

  return playerState.abilities.map((abilityIdOrName) => {
    const defined = definedAbilities.find(
      (a: any) => a.id === abilityIdOrName || a.name === abilityIdOrName
    );
    if (!defined) {
      return abilityIdOrName;
    }

    const name = defined.name || abilityIdOrName;
    const typeLabel = defined.type
      ? isEnglish
        ? defined.type === 'active_spell'
          ? '[Active Spell]'
          : defined.type === 'active_technique'
          ? '[Active Technique]'
          : defined.type === 'passive_skill'
          ? '[Passive Skill]'
          : defined.type === 'passive_feat'
          ? '[Passive Feat]'
          : `[${defined.type}]`
        : defined.type === 'active_spell'
        ? '[ورد / جادوی فعال]'
        : defined.type === 'active_technique'
        ? '[تکنیک رزمی / اقدام فعال]'
        : defined.type === 'passive_skill'
        ? '[مهارت غیرفعال]'
        : defined.type === 'passive_feat'
        ? '[خصلت و ویژگی ذاتی]'
        : '[توانایی]'
      : '';
    const desc = defined.description || defined.effectSummary || '';
    const effect =
      defined.effectSummary && defined.description && defined.effectSummary !== defined.description
        ? isEnglish
          ? `Effect: ${defined.effectSummary}`
          : `اثر: ${defined.effectSummary}`
        : '';

    // The REAL, engine-resolved numbers. Without these the narrator guesses at
    // what an ability does; with them it dramatises the exact modifier the d20
    // already received.
    const mechanicalLines: string[] = [];
    const isActive =
      defined.type === 'active_spell' || defined.type === 'active_technique';
    const specs = isActive
      ? (defined.activation?.effects ?? [])
      : (defined.rollModifiers ?? []);
    for (const spec of specs) {
      mechanicalLines.push(describeRollModifier(spec, !isEnglish));
    }
    if (mechanicalLines.length > 0) {
      const joined = mechanicalLines.join(' | ');
      mechanicalLines.length = 0;
      mechanicalLines.push(
        isEnglish ? `Roll effect: ${joined}` : `اثر بر تاس: ${joined}`
      );
    }
    if (isActive) {
      const cost = getActivationCost(defined);
      const cooldown = getActivationCooldown(defined);
      if (cost) {
        mechanicalLines.push(
          isEnglish
            ? `Cost: ${cost.amount} ${cost.targetResourceId}`
            : `هزینه: ${cost.amount} ${cost.targetResourceId}`
        );
      }
      if (cooldown > 0) {
        mechanicalLines.push(
          isEnglish ? `Cooldown: ${cooldown} turn(s)` : `بازیابی: ${cooldown} نوبت`
        );
      }
      mechanicalLines.push(
        isEnglish
          ? 'Must be actively invoked by the player to take effect.'
          : 'برای اثرگذاری باید آگاهانه توسط بازیکن اجرا شود.'
      );
    }

    const parts = [
      isEnglish ? `"${name}"` : `«${name}»`,
      typeLabel,
      desc,
      effect,
      ...mechanicalLines,
    ].filter(Boolean);

    return parts.join(' — ');
  });
}

/**
 * Renders the character's background traits together with their authored
 * mechanical effects, resolved from the story's background definitions.
 */
export function formatTraitsForContext(
  playerState: { traitIds?: string[]; backgroundId?: string; traits?: string[] },
  story?: any
): Array<{ name: string; effects: string[] }> {
  const rpgSystem = story?.rpgSystem;
  const backgroundId = playerState?.backgroundId;
  const background = (rpgSystem?.backgrounds ?? []).find(
    (b: any) => b?.id === backgroundId || b?.name === backgroundId
  );

  const explicitIds = (playerState?.traitIds ?? []).filter(Boolean);
  const traits: any[] = background?.traits ?? [];
  const resolved = explicitIds.length > 0
    ? explicitIds
        .map((id) => traits.find((t: any) => t?.id === id || t?.name === id))
        .filter(Boolean)
    : traits;

  const isEnglish = story?.language === 'en';

  return resolved.map((trait: any) => ({
    name: trait?.name || trait?.id || '',
    effects: ((trait?.rollModifiers ?? []) as any[]).map((spec) =>
      describeRollModifier(spec, !isEnglish)
    ),
  }));
}

/**
 * Generates the structured item capabilities & interaction catalogue for the protagonist's
 * equipped gear, clarifying exact primary purposes, permitted interactions, forbidden misuses,
 * and passive bonuses so the AI narrator understands item fidelity.
 */
export function formatItemInteractionsCatalogForContext(
  playerState: any,
  story?: any
): string {
  const isEnglish = story?.language === 'en';
  const profiles = buildEquippedItemProfiles(playerState, story, isEnglish);
  return formatItemInteractionsForPrompt(profiles, isEnglish);
}
