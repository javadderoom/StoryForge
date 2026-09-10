import { GameItem } from '@/lib/types/rpg';
import { WorldArtifact } from '@/lib/types/world';

/**
 * Converts a vault artifact (/studio/artifacts) into a tangible GameItem so
 * archetypes can equip real items at session start. `mythic` maps down to
 * `legendary` (GameItem has no mythic tier); curse text is folded into the
 * description so players still see the cost of wielding it.
 */
export function artifactToGameItem(artifact: WorldArtifact): GameItem {
  const slot = artifact.slot || 'relic';
  const type: GameItem['type'] =
    slot === 'shield'
      ? 'shield'
      : slot === 'armor'
        ? 'armor'
        : slot === 'relic'
          ? 'relic'
          : 'weapon';
  const grip: GameItem['grip'] | undefined =
    slot === 'two_handed'
      ? 'two_handed'
      : slot === 'off_hand' || slot === 'shield'
        ? 'off_hand_only'
        : slot === 'main_hand'
          ? 'one_handed'
          : undefined;
  const description = [
    artifact.title ? `${artifact.title} — ${artifact.description}` : artifact.description,
    artifact.curseOrCost ? `⚠️ ${artifact.curseOrCost}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    id: artifact.id,
    name: artifact.name,
    description,
    type,
    quantity: 1,
    rarity: (artifact.rarity === 'mythic' ? 'legendary' : artifact.rarity) as GameItem['rarity'],
    grip,
    statModifiers: artifact.statModifiers,
    startsQuestId: artifact.startsQuestId,
    nonEquippable: artifact.nonEquippable,
  };
}
