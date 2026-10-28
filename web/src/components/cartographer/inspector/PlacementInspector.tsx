'use client';

import React from 'react';
import type {
  MapEntityPlacement,
  NPCDossier as NPCDossierType,
  WorldCreature,
  WorldArtifact,
  WorldDeity,
  TimelineEvent,
} from '@/lib/types';
import { BeastDossier } from './dossiers/BeastDossier';
import { NpcDossier } from './dossiers/NpcDossier';
import { ArtifactDossier } from './dossiers/ArtifactDossier';
import { TimelineDossier } from './dossiers/TimelineDossier';
import { DeityDossier } from './dossiers/DeityDossier';
import { GenericPinDossier } from './dossiers/GenericPinDossier';

export interface PlacementInspectorProps {
  pin: MapEntityPlacement;
  npcs: NPCDossierType[];
  bestiary?: WorldCreature[];
  artifacts?: WorldArtifact[];
  timeline?: TimelineEvent[];
  religions?: WorldDeity[];
  isPersian: boolean;
  onUpdateCreature?: (id: string, updated: Partial<WorldCreature>) => void;
  onDeleteCreature?: (id: string) => void;
  onUpdateArtifact?: (id: string, updated: Partial<WorldArtifact>) => void;
  onUpdateTimelineEvent?: (id: string, updated: Partial<TimelineEvent>) => void;
  onUpdateNpc?: (id: string, updated: Partial<NPCDossierType>) => void;
  onDeletePlacement: (id: string) => void;
  onTogglePlacementVisibility?: (id: string) => void;
  onTogglePlacementLock?: (id: string) => void;
  onClose: () => void;
}

export const PlacementInspector: React.FC<PlacementInspectorProps> = ({
  pin,
  npcs,
  bestiary,
  artifacts,
  timeline,
  religions,
  isPersian,
  onUpdateCreature,
  onDeleteCreature,
  onUpdateArtifact,
  onUpdateTimelineEvent,
  onUpdateNpc,
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
