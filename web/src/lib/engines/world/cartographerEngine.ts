import {
  WorldBible,
  WorldLocation,
  WorldTradeRoute,
  NPCDossier,
  WorldMapData,
  WorldMapSettings,
  MapTerrainFeature,
  MapTerrainType,
  MapPoint,
  MapEntityPlacement,
  MapStyleTheme,
} from '@/lib/types';

export const CANVAS_WIDTH = 2400;
export const CANVAS_HEIGHT = 1600;

export const THEME_PALETTES: Record<
  MapStyleTheme,
  {
    bg: string;
    oceanBg: string;
    landFill: string;
    landStroke: string;
    coastlineColor: string;
    mountainFill: string;
    mountainStroke: string;
    riverColor: string;
    riverWidth: number;
    valleyColor: string;
    gridColor: string;
    textPrimary: string;
    textSecondary: string;
    caravanRouteColor: string;
    borderDash: string;
  }
> = {
  parchment: {
    bg: '#f4ebd0',
    oceanBg: '#d9cdb0',
    landFill: '#f0e5c9',
    landStroke: '#8c7355',
    coastlineColor: '#bda685',
    mountainFill: '#997d66',
    mountainStroke: '#5a4632',
    riverColor: '#5c8096',
    riverWidth: 3.5,
    valleyColor: '#bfa98e',
    gridColor: 'rgba(120, 95, 65, 0.12)',
    textPrimary: '#3d2e1e',
    textSecondary: '#6e5843',
    caravanRouteColor: '#c2410c',
    borderDash: '6 4',
  },
  topographic: {
    bg: '#0f172a',
    oceanBg: '#082f49',
    landFill: '#134e4a',
    landStroke: '#2dd4bf',
    coastlineColor: '#0ea5e9',
    mountainFill: '#b45309',
    mountainStroke: '#fde047',
    riverColor: '#38bdf8',
    riverWidth: 3,
    valleyColor: '#064e3b',
    gridColor: 'rgba(56, 189, 248, 0.15)',
    textPrimary: '#f8fafc',
    textSecondary: '#94a3b8',
    caravanRouteColor: '#fbbf24',
    borderDash: '5 5',
  },
  dark_fantasy: {
    bg: '#09090b',
    oceanBg: '#090d16',
    landFill: '#18181b',
    landStroke: '#3f3f46',
    coastlineColor: '#a855f7',
    mountainFill: '#27272a',
    mountainStroke: '#f43f5e',
    riverColor: '#06b6d4',
    riverWidth: 3.2,
    valleyColor: '#1c1917',
    gridColor: 'rgba(168, 85, 247, 0.1)',
    textPrimary: '#f4f4f5',
    textSecondary: '#a1a1aa',
    caravanRouteColor: '#f97316',
    borderDash: '4 4',
  },
  satellite: {
    bg: '#020617',
    oceanBg: '#0369a1',
    landFill: '#15803d',
    landStroke: '#166534',
    coastlineColor: '#38bdf8',
    mountainFill: '#78716c',
    mountainStroke: '#d6d3d1',
    riverColor: '#0284c7',
    riverWidth: 2.8,
    valleyColor: '#14532d',
    gridColor: 'rgba(148, 163, 184, 0.2)',
    textPrimary: '#ffffff',
    textSecondary: '#cbd5e1',
    caravanRouteColor: '#eab308',
    borderDash: '8 4',
  },
  mystic_astral: {
    bg: '#030712',
    oceanBg: '#0b0f19',
    landFill: '#111827',
    landStroke: '#818cf8',
    coastlineColor: '#6366f1',
    mountainFill: '#1e1b4b',
    mountainStroke: '#c084fc',
    riverColor: '#38bdf8',
    riverWidth: 3,
    valleyColor: '#312e81',
    gridColor: 'rgba(129, 140, 248, 0.18)',
    textPrimary: '#e0e7ff',
    textSecondary: '#a5b4fc',
    caravanRouteColor: '#fb7185',
    borderDash: '6 6',
  },
};

export const DEFAULT_MAP_SETTINGS: WorldMapSettings = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  theme: 'parchment',
  gridType: 'hex',
  gridSize: 50,
  showGridCoordinates: true,
  visibleLayers: {
    terrain: true,
    water: true,
    mountains: true,
    valleys: true,
    biomes: true,
    settlements: true,
    caravanRoutes: true,
    npcs: true,
    bestiary: true,
    relics: true,
    deities: true,
    timeline: true,
    factionBorders: true,
    labels: true,
    grid: true,
  },
};

/**
 * Creates seed natural terrain (continents, mountain spines, winding rivers, valleys, biomes)
 * matching the world's themes.
 */
export function createSeedTerrainFeatures(isPersian: boolean): MapTerrainFeature[] {
  return [
    // 1. Primary Landmass (Continent)
    {
      id: 'terr_continent_prime',
      name: isPersian ? 'قاره کهن (سرزمین زروان)' : 'The Ancient Continent of Zarvan',
      type: 'continent',
      color: '#f0e5c9',
      polygon: [
        { x: 300, y: 350 },
        { x: 550, y: 220 },
        { x: 850, y: 180 },
        { x: 1250, y: 190 },
        { x: 1650, y: 240 },
        { x: 1950, y: 380 },
        { x: 2120, y: 620 },
        { x: 2050, y: 920 },
        { x: 1880, y: 1180 },
        { x: 1580, y: 1350 },
        { x: 1200, y: 1420 },
        { x: 800, y: 1380 },
        { x: 450, y: 1220 },
        { x: 280, y: 980 },
        { x: 220, y: 680 },
      ],
      description: isPersian
        ? 'فلات بزرگ و اصلی جهان با آبراهه‌های طبیعی و دشت‌های حاصلخیز'
        : 'The primary continental landmass cradling ancient empires and trade capitals',
      climateZone: 'temperate',
    },

    // 2. Mystic Southern Archipelago (Islands)
    {
      id: 'terr_island_moon',
      name: isPersian ? 'جزیره سیمرغ / مجمع‌الجزایر ماه' : 'Simurgh Isle',
      type: 'island',
      color: '#e2d4b7',
      polygon: [
        { x: 150, y: 1350 },
        { x: 240, y: 1300 },
        { x: 320, y: 1380 },
        { x: 280, y: 1480 },
        { x: 170, y: 1460 },
      ],
      description: isPersian ? 'جزیره‌ای رازآلود در مه اقیانوس باستانی' : 'Fog-shrouded sanctuary in the southern sea',
      climateZone: 'tropical',
    },
    {
      id: 'terr_island_pearl',
      name: isPersian ? 'مجمع‌الجزایر مروارید سیاه' : 'Black Pearl Islets',
      type: 'island',
      color: '#e2d4b7',
      polygon: [
        { x: 2150, y: 1100 },
        { x: 2280, y: 1050 },
        { x: 2320, y: 1180 },
        { x: 2220, y: 1240 },
      ],
      description: isPersian ? 'بندرگاه دزدان دریایی و قاچاقچیان ادویه' : 'Smugglers haven and pearl fishing waters',
      climateZone: 'tropical',
    },

    // 3. Central Great Lake (Water body)
    {
      id: 'terr_lake_mirror',
      name: isPersian ? 'دریاچه لاجوردین آینه' : 'Azure Mirror Lake',
      type: 'lake',
      color: '#4f728c',
      polygon: [
        { x: 1100, y: 650 },
        { x: 1280, y: 620 },
        { x: 1360, y: 720 },
        { x: 1310, y: 840 },
        { x: 1180, y: 860 },
        { x: 1080, y: 770 },
      ],
      description: isPersian ? 'دریاچه عظیم شیرین با منابع ماهیگیری و نیلوفرهای جادویی' : 'Crystalline inland sea feeding the royal aquifers',
      climateZone: 'temperate',
    },

    // 4. Major Mountain Spine (Alborz / Dragonspine Crest)
    {
      id: 'terr_mountains_spine',
      name: isPersian ? 'رشته‌کوه‌های البرز کهن / تیغ اژدها' : 'Dragonspine Mountain Chain',
      type: 'mountain_range',
      points: [
        { x: 500, y: 480 },
        { x: 780, y: 460 },
        { x: 1020, y: 520 },
        { x: 1420, y: 580 },
        { x: 1720, y: 720 },
        { x: 1920, y: 920 },
      ],
      elevation: 3800,
      width: 45,
      description: isPersian ? 'دیواره کوهستانی صعب‌العبور که شمال را از فلات خشک جدا می‌کند' : 'Impassable jagged peaks separating northern forests from the dry plains',
      climateZone: 'polar',
    },

    // 5. Mythic Mountain Peak (Volcano / High Summit)
    {
      id: 'terr_peak_damavand',
      name: isPersian ? 'قله اخگرین دماوند' : 'The Ashen Crown Peak',
      type: 'peak',
      x: 1040,
      y: 510,
      radius: 40,
      elevation: 4850,
      color: '#b91c1c',
      description: isPersian ? 'مرتفع‌ترین قله آتشفشانی؛ آشیانه سیمرغ و آتش ابدی' : 'The highest smoking volcanic pinnacle holding primordial embers',
      climateZone: 'polar',
    },
    {
      id: 'terr_peak_shattered',
      name: isPersian ? 'قله شکسته زال' : 'The Shattered Horn Peak',
      type: 'peak',
      x: 1430,
      y: 575,
      radius: 32,
      elevation: 3400,
      color: '#713f12',
      description: isPersian ? 'سنگی تیز و برف‌گیر، مشرف به شاهراه کاروان‌ها' : 'Glacial sentinel overlooking the Silk Pass',
      climateZone: 'polar',
    },

    // 6. Deep Valley / Canyon (Gorge)
    {
      id: 'terr_valley_chasm',
      name: isPersian ? 'دره شکافته زروان / تنگه صاعقه' : 'The Zarvan Rift Valley',
      type: 'canyon',
      points: [
        { x: 1380, y: 780 },
        { x: 1520, y: 880 },
        { x: 1680, y: 950 },
        { x: 1820, y: 1020 },
      ],
      width: 25,
      elevation: -250,
      color: '#78350f',
      description: isPersian ? 'دره‌ای عمیق با پرتگاه‌های سرخ که تنها با پل‌های معلق قابل عبور است' : 'Chasm gorge with ancient bridges, prone to windstorms and ambush',
      climateZone: 'arid',
    },

    // 7. Winding Rivers (From Mountain peaks down to Lake and Ocean)
    {
      id: 'terr_river_royal',
      name: isPersian ? 'رود شاهنشاهی زاینده‌نور' : 'The Luminescent Zayandeh River',
      type: 'river',
      points: [
        { x: 1040, y: 530 },
        { x: 1080, y: 590 },
        { x: 1130, y: 660 }, // into lake
      ],
      width: 4,
      color: '#38bdf8',
      description: isPersian ? 'رود تغذیه‌شده از برفابه‌های قله، منشأ برکت مزارع سلطنتی' : 'Sacred meltwater torrent cascading from snowcaps',
    },
    {
      id: 'terr_river_ocean_flow',
      name: isPersian ? 'رود اروند کبیر' : 'Arvand Deepwater River',
      type: 'river',
      points: [
        { x: 1330, y: 820 },
        { x: 1420, y: 940 },
        { x: 1540, y: 1120 },
        { x: 1590, y: 1350 }, // out to south sea
      ],
      width: 5,
      color: '#0284c7',
      description: isPersian ? 'شاهراه آبی که قایق‌های تجاری را به دریای آزاد متصل می‌کند' : 'Navigable river allowing galleys access to the southern gulf',
    },

    // 8. Great Forest Biome (Caspian / Hyrcanian green mantle)
    {
      id: 'terr_forest_ancient',
      name: isPersian ? 'جنگل کهن هیرکانی / بیشه رازها' : 'Hyrcanian Primeval Forest',
      type: 'forest',
      color: '#166534',
      polygon: [
        { x: 550, y: 260 },
        { x: 820, y: 220 },
        { x: 1080, y: 240 },
        { x: 1020, y: 440 },
        { x: 740, y: 410 },
        { x: 520, y: 430 },
      ],
      description: isPersian ? 'درختان کهنسال بلوط و راش با خزه‌های جادویی و جانوران شکاری' : 'Dense emerald canopy home to dryads and fierce predators',
      climateZone: 'temperate',
    },

    // 9. Great Desert Biome (Kavir / Sand dunes)
    {
      id: 'terr_desert_zarvan',
      name: isPersian ? 'کویر سرخ زروان / دشت لوت' : 'The Red Kavir of Zarvan',
      type: 'desert',
      color: '#d97706',
      polygon: [
        { x: 620, y: 880 },
        { x: 1050, y: 850 },
        { x: 1160, y: 1100 },
        { x: 920, y: 1280 },
        { x: 650, y: 1180 },
      ],
      description: isPersian ? 'دشت شنی تفتیده با توفان‌های نمک و کاروان‌های سرگردان' : 'Scorching dune sea crossed only along designated oasis trails',
      climateZone: 'arid',
    },

    // 10. Arcane Anomaly / Oasis
    {
      id: 'terr_anomaly_oasis',
      name: isPersian ? 'واحه زمردین خضر / چشمه حیات' : 'The Emerald Oasis of Khidr',
      type: 'oasis',
      x: 880,
      y: 1020,
      radius: 28,
      color: '#10b981',
      description: isPersian ? 'چشمه‌ای با نخل‌های همیشه سبز در دل کویر، محل استراحت کاروان‌ها' : 'Miraculous oasis waterhole refuge for dusty desert caravans',
      climateZone: 'arid',
    },
  ];
}

/**
 * Ensures all World Locations have coordinates on the map.
 * If some locations have no coordinates, allocates them evenly in thematic zones.
 */
export function ensureLocationCoordinates(
  locations: WorldLocation[],
  existingCoordinates: Map<string, MapPoint>
): WorldLocation[] {
  const predefinedAnchors: MapPoint[] = [
    { x: 1220, y: 740 }, // Imperial Capital by lake
    { x: 720, y: 380 },  // Northern Forest Citadel
    { x: 1540, y: 640 }, // Mountain Fortress / Pass
    { x: 880, y: 1020 }, // Desert Oasis Hub
    { x: 1590, y: 1240 },// Southern Coastal Trade Port
    { x: 1720, y: 920 }, // Canyon Stronghold
    { x: 420, y: 720 },  // Western Border Outpost
    { x: 1980, y: 480 }, // Eastern Mystic Citadel
    { x: 260, y: 1380 }, // Simurgh Island Sanctuary
    { x: 1040, y: 450 }, // Ashen Peak Monastery
  ];

  return locations.map((loc, idx) => {
    if (loc.coordinates && loc.coordinates.x > 0 && loc.coordinates.y > 0) {
      return loc;
    }

    const savedPoint = existingCoordinates.get(loc.id);
    if (savedPoint) {
      return { ...loc, coordinates: savedPoint };
    }

    // Allocate anchor or compute orbital slot
    const anchor = predefinedAnchors[idx % predefinedAnchors.length];
    const offset = Math.floor(idx / predefinedAnchors.length);
    const point = {
      x: anchor.x + (offset * 70 - 35),
      y: anchor.y + (offset * 50 - 25),
    };

    return {
      ...loc,
      coordinates: point,
      elevation: loc.elevation ?? (loc.category === 'stronghold' ? 1200 : loc.category === 'dungeon' ? -150 : 350),
    };
  });
}

/**
 * Initializes or repairs the world's Map Data.
 */
export function getOrInitializeWorldMapData(
  worldBible: WorldBible,
  isPersian: boolean
): WorldMapData {
  const existingMap = worldBible.mapData || worldBible.ontology?.mapData;

  const terrain =
    existingMap?.terrainFeatures && existingMap.terrainFeatures.length > 0
      ? existingMap.terrainFeatures
      : createSeedTerrainFeatures(isPersian);

  const settings: WorldMapSettings = {
    ...DEFAULT_MAP_SETTINGS,
    ...(existingMap?.settings || {}),
    visibleLayers: {
      ...DEFAULT_MAP_SETTINGS.visibleLayers,
      ...(existingMap?.settings?.visibleLayers || {}),
    },
  };

  const placements: MapEntityPlacement[] = existingMap?.placements ? [...existingMap.placements] : [];

  return {
    version: existingMap?.version || 1,
    settings,
    terrainFeatures: terrain,
    placements,
    notes: existingMap?.notes || '',
  };
}

/**
 * Calculates straight-line distance in map leagues/kilometers.
 */
export function calculateMapDistance(p1: MapPoint, p2: MapPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.round(Math.sqrt(dx * dx + dy * dy));
}

/**
 * Calculates estimated caravan travel duration in days based on distance and route danger.
 */
export function calculateCaravanTravelDays(distanceKm: number, dangerLevel: number = 2): number {
  // Base pace: ~35 km per travel day for pack beasts + terrain penalty
  const baseDays = distanceKm / 45;
  const dangerFriction = 1 + (dangerLevel - 1) * 0.15;
  return Math.max(1, Math.round(baseDays * dangerFriction));
}

/**
 * Generates smooth SVG path command string (Curved Catmull-Rom or cubic Bezier)
 * for river or caravan road polylines.
 */
export function pointsToSmoothSvgPath(points: MapPoint[]): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  return d;
}

/**
 * Converts polygon points to closed SVG path string.
 */
export function polygonToSvgPath(points: MapPoint[]): string {
  if (!points || points.length < 3) return '';
  return pointsToSmoothSvgPath([...points, points[0]]) + ' Z';
}

/**
 * Helper to compute default intermediate waypoints between two locations
 * bending naturally around mountains or straight across flatlands.
 */
export function generateDefaultCaravanWaypoints(
  start: MapPoint,
  end: MapPoint,
  count: number = 2
): MapPoint[] {
  const waypoints: MapPoint[] = [];
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const perpX = -dy;
  const perpY = dx;
  const len = Math.sqrt(perpX * perpX + perpY * perpY) || 1;

  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const midX = start.x + dx * t;
    const midY = start.y + dy * t;
    // Introduce a subtle natural bend
    const amplitude = 35 * Math.sin(t * Math.PI);
    waypoints.push({
      x: Math.round(midX + (perpX / len) * amplitude),
      y: Math.round(midY + (perpY / len) * amplitude),
    });
  }

  return waypoints;
}
