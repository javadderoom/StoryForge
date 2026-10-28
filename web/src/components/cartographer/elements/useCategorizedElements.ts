import { useMemo } from 'react';
import {
  WorldBible,
  WorldMapData,
  CustomPlaceCategory,
  MapEntityPlacement,
} from '@/lib/types';
import { isObjectLocked, isObjectVisible } from '@/lib/engines/world/mapObjectOrder';
import { routeDifficultyLabel, routeKindLabel } from '@/lib/engines/world/mapRoutes';
import { resolvePlaceCategoryMeta } from '@/lib/engines/world/placeCategories';
import { ElementCategoryKey, ItemWrapper } from './types';

interface UseCategorizedElementsOptions {
  worldBible: WorldBible;
  mapData: WorldMapData;
  placeCategories?: CustomPlaceCategory[];
  isPersian: boolean;
  searchQuery: string;
}

export function useCategorizedElements({
  worldBible,
  mapData,
  placeCategories,
  isPersian,
  searchQuery,
}: UseCategorizedElementsOptions) {
  // Classify all elements into their respective categories
  const categorizedItems = useMemo<Record<ElementCategoryKey, ItemWrapper[]>>(() => {
    const terrainFeatures = mapData.terrainFeatures || [];
    const placements = mapData.placements || [];
    const locations = worldBible.locations || [];
    const routes = worldBible.tradeRoutes || [];
    const roads = mapData.routes || [];

    const result: Record<ElementCategoryKey, ItemWrapper[]> = {
      landmass: [],
      highland: [],
      mountain: [],
      water: [],
      valley: [],
      biome: [],
      settlement: [],
      road: [],
      route: [],
      pin: [],
    };

    // Classify terrain features
    for (const feat of terrainFeatures) {
      const isVis = isObjectVisible(feat);
      const isLck = isObjectLocked(feat);
      const label = feat.name || feat.type;

      if (feat.type === 'continent' || feat.type === 'island') {
        result.landmass.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: feat.type === 'continent' ? (isPersian ? 'قاره' : 'Continent') : (isPersian ? 'جزیره' : 'Island'),
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      } else if (feat.type === 'highland' || feat.type === 'plateau') {
        result.highland.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: feat.type === 'highland' ? (isPersian ? 'زمین مرتفع' : 'Highland') : (isPersian ? 'فلات کوهستانی' : 'Plateau'),
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      } else if (feat.type === 'mountain_range' || feat.type === 'peak' || feat.type === 'volcano') {
        const sub =
          feat.type === 'volcano'
            ? isPersian ? 'آتشفشان' : 'Volcano'
            : feat.type === 'peak'
            ? isPersian ? 'قله منفرد' : 'Peak'
            : isPersian ? 'رشته‌کوه' : 'Mountain Range';
        result.mountain.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: sub,
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      } else if (feat.type === 'river' || feat.type === 'lake' || feat.type === 'ocean' || feat.type === 'sea') {
        const sub =
          feat.type === 'river'
            ? isPersian ? 'رودخانه' : 'River'
            : feat.type === 'lake'
            ? isPersian ? 'دریاچه' : 'Lake'
            : isPersian ? 'پهنه آبی' : 'Sea / Ocean';
        result.water.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: sub,
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      } else if (feat.type === 'valley' || feat.type === 'canyon' || feat.type === 'chasm') {
        const sub =
          feat.type === 'chasm'
            ? isPersian ? 'شکاف عمیق' : 'Chasm'
            : feat.type === 'canyon'
            ? isPersian ? 'دره تنگ (کنیون)' : 'Canyon'
            : isPersian ? 'دره' : 'Valley';
        result.valley.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: sub,
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      } else {
        // Biomes: forest, jungle, desert, tundra, swamp, wasteland, plains, oasis, arcane_anomaly
        const sub =
          feat.type === 'forest'
            ? isPersian ? 'جنگل معتدل' : 'Forest'
            : feat.type === 'jungle'
            ? isPersian ? 'جنگل بارانی' : 'Jungle'
            : feat.type === 'desert'
            ? isPersian ? 'بیابان / کویر' : 'Desert'
            : feat.type === 'swamp'
            ? isPersian ? 'مرداب / باتلاق' : 'Swamp'
            : feat.type === 'tundra'
            ? isPersian ? 'توندرا' : 'Tundra'
            : feat.type === 'oasis'
            ? isPersian ? 'واحه بیابانی' : 'Oasis'
            : feat.type === 'wasteland'
            ? isPersian ? 'زمین‌های بایر' : 'Wasteland'
            : feat.type === 'plains'
            ? isPersian ? 'دشت' : 'Plains'
            : feat.type === 'arcane_anomaly'
            ? isPersian ? 'ناهنجاری اسرارآمیز' : 'Arcane Anomaly'
            : isPersian ? 'اقلیم طبیعی' : 'Biome Wash';
        result.biome.push({
          kind: 'terrain',
          id: feat.id,
          name: label,
          subtitle: sub,
          visible: isVis,
          locked: isLck,
          raw: feat,
        });
      }
    }

    // Settlements & semantic places. Plan 24 metadata is the single source of
    // truth the renderer and hit test already use, so the list agrees with the
    // map: a point place (settlement, stronghold, ruin, dungeon, custom pin)
    // belongs here, while a place drawn as a line/area (waterway, sea, plains
    // region, anomaly) is filed under its geographical bucket instead of
    // masquerading as a settlement.
    for (const loc of locations) {
      const isVis = isObjectVisible(loc);
      const isLck = isObjectLocked(loc);
      const meta = resolvePlaceCategoryMeta(loc.category, placeCategories);
      const categoryLabel =
        placeCategories?.find((category) => category.id === loc.category)?.name ||
        (loc.category
          ? loc.category.charAt(0).toUpperCase() + loc.category.slice(1)
          : isPersian ? 'سکونت‌گاه' : 'Settlement');
      const wrapper: ItemWrapper = {
        kind: 'location' as const,
        id: loc.id,
        name: loc.name || (isPersian ? 'مکان نامشخص' : 'Unnamed Location'),
        subtitle: categoryLabel,
        visible: isVis,
        locked: isLck,
        raw: loc,
      };

      if (meta.renderAs === 'settlement') {
        result.settlement.push(wrapper);
      } else if (meta.renderAs === 'water' || meta.renderAs === 'line') {
        result.water.push(wrapper);
      } else {
        result.biome.push(wrapper);
      }
    }

    // Caravan Routes
    for (const r of routes) {
      const isVis = isObjectVisible(r);
      const isLck = isObjectLocked(r);
      result.route.push({
        kind: 'route',
        id: r.id,
        name: r.name || (isPersian ? 'مسیر کاروان' : 'Trade Route'),
        subtitle: r.status
          ? r.status.charAt(0).toUpperCase() + r.status.slice(1)
          : isPersian ? 'مسیر کاروان' : 'Trade Route',
        visible: isVis,
        locked: isLck,
        raw: r,
      });
    }

    // Drawn roads and paths (Plan 25)
    for (const road of roads) {
      const isVis = isObjectVisible(road);
      const isLck = isObjectLocked(road);
      const kindLabel = routeKindLabel(road.kind, isPersian);
      const difficultyLabel = routeDifficultyLabel(road.difficulty, isPersian);
      result.road.push({
        kind: 'road',
        id: road.id,
        name: road.name || kindLabel,
        subtitle: `${kindLabel} · ${difficultyLabel}`,
        visible: isVis,
        locked: isLck,
        raw: road,
      });
    }

    // Placements / Lore Pins & Beasts
    for (const p of placements) {
      const isVis = isObjectVisible(p);
      const isLck = isObjectLocked(p);
      let label = p.customLabel;
      let subtitle = p.entityType.toUpperCase();

      if (p.entityType === 'npc') {
        const npc = worldBible.npcs?.find((n) => n.id === p.entityId);
        if (!label) label = npc?.name || (isPersian ? 'شخصیت داستانی' : 'NPC');
        subtitle = npc?.title || (isPersian ? 'پرونده شخصیت' : 'NPC Dossier');
      } else if (p.entityType === 'bestiary') {
        const creature = worldBible.bestiary?.find((b) => b.id === p.entityId);
        if (!label) label = creature?.name || (isPersian ? 'هیولا و جانور' : 'Beast');
        const dangerStr = creature ? `\u200E${creature.dangerLevel}/5` : '';
        const speciesStr = creature?.speciesCategory
          ? isPersian
            ? creature.speciesCategory === 'beast'
              ? 'جانور طبیعی'
              : creature.speciesCategory === 'monstrosity'
              ? 'هیولای دگرگون‌شده'
              : creature.speciesCategory === 'draconic'
              ? 'اژدهاگونه'
              : creature.speciesCategory
            : creature.speciesCategory
          : isPersian ? 'هیولا' : 'Beast';
        subtitle = isPersian
          ? `خطر ${dangerStr} · ${speciesStr}`
          : `Danger ${dangerStr} · ${speciesStr}`;
      } else if (p.entityType === 'artifact') {
        const artifact = worldBible.artifacts?.find((a) => a.id === p.entityId);
        if (!label) label = artifact?.name || (isPersian ? 'اثر باستانی' : 'Artifact');
        subtitle = artifact?.rarity ? artifact.rarity.toUpperCase() : (isPersian ? 'عتیقه باستانی' : 'Relic');
      } else if (p.entityType === 'timeline') {
        const event = worldBible.timeline?.find((t) => t.id === p.entityId);
        if (!label) label = event?.title || (isPersian ? 'رویداد تاریخی' : 'Historical Event');
        subtitle = event?.yearOrEra ? `${event.yearOrEra}` : (isPersian ? 'وقایع‌نگاری' : 'Chronicle');
      } else if (p.entityType === 'deity') {
        label = worldBible.religions?.find((r) => r.id === p.entityId)?.name || (isPersian ? 'زیارتگاه / ایزد' : 'Deity / Shrine');
      } else if (!label) {
        label = p.entityType;
      }

      result.pin.push({
        kind: 'placement',
        id: p.id,
        name: label,
        subtitle,
        visible: isVis,
        locked: isLck,
        raw: p,
      });
    }

    return result;
  }, [mapData.terrainFeatures, mapData.placements, mapData.routes, worldBible, placeCategories, isPersian]);

  // Total element count across all categories
  const totalCount = useMemo(() => {
    return Object.values(categorizedItems).reduce((sum, list) => sum + list.length, 0);
  }, [categorizedItems]);

  // Filter items per category according to search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categorizedItems;

    const filtered: Record<ElementCategoryKey, ItemWrapper[]> = {
      landmass: [],
      highland: [],
      mountain: [],
      water: [],
      valley: [],
      biome: [],
      settlement: [],
      road: [],
      route: [],
      pin: [],
    };

    for (const [key, items] of Object.entries(categorizedItems) as [ElementCategoryKey, ItemWrapper[]][]) {
      filtered[key] = items.filter(
        (it) => it.name.toLowerCase().includes(q) || it.subtitle.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [categorizedItems, searchQuery]);

  return {
    categorizedItems,
    filteredCategories,
    totalCount,
  };
}
