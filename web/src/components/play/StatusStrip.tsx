'use client';

import React from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { PlayerState } from '@/lib/types/gameplay';

export interface StatusStripProps {
  playerState?: PlayerState | null;
  loreLocations?: Array<{
    id: string;
    name: string;
    parentLocationId?: string;
    subZones?: Array<{ id: string; name: string }>;
  }>;
  turnNumber?: number;
  isRtl?: boolean;
}

export function StatusStrip({
  playerState,
  loreLocations = [],
  turnNumber = 0,
  isRtl = true,
}: StatusStripProps) {
  if (!playerState) return null;

  // 1. Resolve Location (Macro + Micro Subzone)
  const currentLoc = loreLocations.find((l) => l.id === playerState.currentLocationId);
  let resolvedLocationName: string | null = null;
  if (currentLoc) {
    if (playerState.currentSubZoneId && currentLoc.subZones) {
      const subZone = currentLoc.subZones.find((sz) => sz.id === playerState.currentSubZoneId);
      if (subZone) {
        resolvedLocationName = `${currentLoc.name} • ${subZone.name}`;
      } else {
        resolvedLocationName = currentLoc.name;
      }
    } else {
      resolvedLocationName = currentLoc.name;
    }
  } else if (playerState.currentLocationId) {
    resolvedLocationName = playerState.currentLocationId;
  }

  // 2. Resolve Active Travel (Plan 17 Phase 6)
  const travel = playerState.travel;
  let travelBadge: React.ReactNode = null;

  if (travel) {
    const elapsed = Math.min(travel.totalTurns, Math.max(0, turnNumber - travel.departedTurn));
    const turnsRemaining = Math.max(0, travel.totalTurns - elapsed);
    const progress = travel.totalTurns > 0 ? (travel.totalTurns - turnsRemaining) / travel.totalTurns : 1;
    const progressPercent = Math.round(progress * 100);

    const destLoc = loreLocations.find((l) => l.id === travel.destinationLocationId);
    const destName = destLoc?.name || travel.destinationLocationId;

    const originLoc = loreLocations.find((l) => l.id === travel.originLocationId);
    const originName = originLoc?.name || travel.originLocationId;

    const dayOnRoad = elapsed + 1;
    const totalDays = travel.totalTurns + 1;

    const label = isRtl
      ? `در راه «${destName}» • ${turnsRemaining} نوبت مانده`
      : `En route to “${destName}” • ${turnsRemaining} turns left`;

    const tooltip = isRtl
      ? `از «${originName}» به «${destName}» • روز ${dayOnRoad} از ${totalDays}`
      : `From “${originName}” to “${destName}” • Day ${dayOnRoad} of ${totalDays}`;

    travelBadge = (
      <div
        title={tooltip}
        className="group relative inline-flex flex-col rounded-full border border-amber-500/60 bg-amber-950/70 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)] backdrop-blur-md px-2.5 py-0.5 text-[11px] font-semibold transition-all hover:scale-105 select-none overflow-hidden"
      >
        <div className="flex items-center gap-1.5 pb-0.5">
          <Navigation className="h-3 w-3 shrink-0 text-amber-400" />
          <span>{label}</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber-950/90 overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  if (!resolvedLocationName && !travelBadge) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 pt-1"
      aria-label={isRtl ? 'موقعیت و مسیر سفر' : 'Location and Active Travel'}
    >
      {/* Travel rendered first (per Plan 17 §4.6) */}
      {travelBadge}

      {/* Location Badge */}
      {resolvedLocationName && (
        <div
          title={isRtl ? 'موقعیت مکانی و اقلیمی' : 'Current Location'}
          className="group relative inline-flex items-center gap-1.5 rounded-full border border-cyan-500/50 bg-cyan-950/60 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.2)] backdrop-blur-md px-2.5 py-0.5 text-[11px] font-semibold transition-all hover:scale-105 select-none"
        >
          <MapPin className="h-3 w-3 shrink-0 text-cyan-400" />
          <span>{resolvedLocationName}</span>
        </div>
      )}
    </div>
  );
}
