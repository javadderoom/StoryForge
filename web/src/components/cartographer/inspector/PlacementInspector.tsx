'use client';

import React from 'react';
import type {
  MapEntityPlacement,
  NPCDossier as NPCDossierType,
  WorldCreature,
  WorldArtifact,
  WorldDeity,
  TimelineEvent,
  StoryEncounter,
  WorldQuest,
  Faction,
  WorldLocation,
} from '@/lib/types';
import { BeastDossier } from './dossiers/BeastDossier';
import { NpcDossier } from './dossiers/NpcDossier';
import { ArtifactDossier } from './dossiers/ArtifactDossier';
import { TimelineDossier } from './dossiers/TimelineDossier';
import { DeityDossier } from './dossiers/DeityDossier';
import { EncounterDossier } from './dossiers/EncounterDossier';
import { QuestDossier } from './dossiers/QuestDossier';
import { FactionDossier } from './dossiers/FactionDossier';
import { GenericPinDossier } from './dossiers/GenericPinDossier';

export interface PlacementInspectorProps {
  pin: MapEntityPlacement;
  npcs: NPCDossierType[];
  locations?: WorldLocation[];
  factions?: Faction[];
  bestiary?: WorldCreature[];
  artifacts?: WorldArtifact[];
  timeline?: TimelineEvent[];
  religions?: WorldDeity[];
  encounters?: StoryEncounter[];
  quests?: WorldQuest[];
  isPersian: boolean;
  onUpdateCreature?: (id: string, updated: Partial<WorldCreature>) => void;
  onDeleteCreature?: (id: string) => void;
  onUpdateArtifact?: (id: string, updated: Partial<WorldArtifact>) => void;
  onUpdateTimelineEvent?: (id: string, updated: Partial<TimelineEvent>) => void;
  onUpdateNpc?: (id: string, updated: Partial<NPCDossierType>) => void;
  onUpdateEncounter?: (id: string, updated: Partial<StoryEncounter>) => void;
  onUpdateQuest?: (id: string, updated: Partial<WorldQuest>) => void;
  onUpdateFaction?: (id: string, updated: Partial<Faction>) => void;
  onDeletePlacement: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onClose: () => void;
}

export const PlacementInspector: React.FC<PlacementInspectorProps> = ({
  pin,
  npcs,
  locations = [],
  factions = [],
  bestiary,
  artifacts,
  timeline,
  religions,
  encounters,
  quests,
  isPersian,
  onUpdateCreature,
  onDeleteCreature,
  onUpdateArtifact,
  onUpdateTimelineEvent,
  onUpdateNpc,
  onUpdateEncounter,
  onUpdateQuest,
  onUpdateFaction,
  onDeletePlacement,
  onTogglePlacementVisibility,
  onTogglePlacementLock,
  onClose,
}) => {
  const creature = pin.entityType === 'bestiary' ? bestiary?.find((b) => b.id === pin.entityId) : null;
  const npc = pin.entityType === 'npc' ? npcs?.find((n) => n.id === pin.entityId) : null;
  const artifact = pin.entityType === 'artifact' ? artifacts?.find((a) => a.id === pin.entityId) : null;
  const event = pin.entityType === 'timeline' ? timeline?.find((e) => e.id === pin.entityId) : null;
  const deity = pin.entityType === 'deity' ? religions?.find((d) => d.id === pin.entityId) : null;
  const encounter = pin.entityType === 'encounter' ? encounters?.find((e) => e.id === pin.entityId) : null;
  const quest = pin.entityType === 'quest' ? quests?.find((q) => q.id === pin.entityId) : null;
  const faction = pin.entityType === 'faction_outpost' ? factions?.find((f) => f.id === pin.entityId) : null;

  if (pin.entityType === 'bestiary' && creature) {
    return (
      <BeastDossier
        pin={pin}
        creature={creature}
        isPersian={isPersian}
        onUpdateCreature={onUpdateCreature}
        onDeleteCreature={onDeleteCreature}
        onDeletePlacement={onDeletePlacement}
        onTogglePlacementVisibility={onTogglePlacementVisibility}
        onTogglePlacementLock={onTogglePlacementLock}
        onClose={onClose}
      />
    );
  }

  if (pin.entityType === 'npc' && npc) {
    return (
      <NpcDossier
        pin={pin}
        npc={npc}
        isPersian={isPersian}
        onUpdateNpc={onUpdateNpc}
        onDeletePlacement={onDeletePlacement}
        onTogglePlacementVisibility={onTogglePlacementVisibility}
        onTogglePlacementLock={onTogglePlacementLock}
        onClose={onClose}
      />
    );
  }

  if (pin.entityType === 'artifact' && artifact) {
    return (
      <ArtifactDossier
        pin={pin}
        artifact={artifact}
        isPersian={isPersian}
        onUpdateArtifact={onUpdateArtifact}
        onDeletePlacement={onDeletePlacement}
        onTogglePlacementVisibility={onTogglePlacementVisibility}
        onTogglePlacementLock={onTogglePlacementLock}
        onClose={onClose}
      />
    );
  }

  if (pin.entityType === 'timeline' && event) {
    return (
      <TimelineDossier
        pin={pin}
        event={event}
        isPersian={isPersian}
        onUpdateTimelineEvent={onUpdateTimelineEvent}
        onDeletePlacement={onDeletePlacement}
        onTogglePlacementVisibility={onTogglePlacementVisibility}
        onTogglePlacementLock={onTogglePlacementLock}
        onClose={onClose}
      />
    );
  }

  if (pin.entityType === 'deity' && deity) {
    return (
      <DeityDossier
        pin={pin}
        deity={deity}
        isPersian={isPersian}
        onDeletePlacement={onDeletePlacement}
        onTogglePlacementVisibility={onTogglePlacementVisibility}
        onTogglePlacementLock={onTogglePlacementLock}
        onClose={onClose}
      />
    );
  }

  if (pin.entityType === 'encounter' && encounter) {
    return (
      <EncounterDossier
        pin={pin}
        encounter={encounter}
        locations={locations}
        npcs={npcs}
        bestiary={bestiary ?? []}
        artifacts={artifacts ?? []}
        quests={quests ?? []}
        isPersian={isPersian}
        onUpdateEncounter={onUpdateEncounter}
        onDeletePlacement={onDeletePlacement}
        onTogglePlacementVisibility={onTogglePlacementVisibility}
        onTogglePlacementLock={onTogglePlacementLock}
        onClose={onClose}
      />
    );
  }

  if (pin.entityType === 'quest' && quest) {
    return (
      <QuestDossier
        pin={pin}
        quest={quest}
        locations={locations}
        npcs={npcs}
        isPersian={isPersian}
        onUpdateQuest={onUpdateQuest}
        onDeletePlacement={onDeletePlacement}
        onTogglePlacementVisibility={onTogglePlacementVisibility}
        onTogglePlacementLock={onTogglePlacementLock}
        onClose={onClose}
      />
    );
  }

  if (pin.entityType === 'faction_outpost' && faction) {
    return (
      <FactionDossier
        pin={pin}
        faction={faction}
        allFactions={factions}
        locations={locations}
        isPersian={isPersian}
        onUpdateFaction={onUpdateFaction}
        onDeletePlacement={onDeletePlacement}
        onTogglePlacementVisibility={onTogglePlacementVisibility}
        onTogglePlacementLock={onTogglePlacementLock}
        onClose={onClose}
      />
    );
  }

  return (
    <GenericPinDossier
      pin={pin}
      isPersian={isPersian}
      onDeletePlacement={onDeletePlacement}
      onTogglePlacementVisibility={onTogglePlacementVisibility}
      onTogglePlacementLock={onTogglePlacementLock}
      onClose={onClose}
    />
  );
};
