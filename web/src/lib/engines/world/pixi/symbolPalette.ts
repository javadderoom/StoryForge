/**
 * StoryForge Cartographer - Geo Symbol Palette & Taxonomy Registry
 *
 * Provides a unified, extensible catalog of ready-to-use cartography symbol assets
 * (Azgaar FMG Relief vectors + Kenney Cartography Pack sprites) categorized into
 * flora species, relief types, stones, and landmarks.
 */

export type GeoSymbolCategory =
  | 'tree'
  | 'mountain'
  | 'hill'
  | 'stone_rock'
  | 'grass_flora'
  | 'landmark';

export interface GeoSymbolDefinition {
  id: string;
  name: { en: string; fa: string };
  category: GeoSymbolCategory;
  family: string;
  src: string;
  baseWidth: number;
  baseHeight: number;
  anchor: { x: number; y: number };
}

export interface GeoSymbolFamily {
  id: string;
  category: GeoSymbolCategory;
  name: { en: string; fa: string };
  description: { en: string; fa: string };
  thumbnail: string;
  defaultSpacing: number;
  defaultScale: number;
  variants: GeoSymbolDefinition[];
}

export const GEO_SYMBOL_FAMILIES: Record<string, GeoSymbolFamily> = {
  // --- TREES & WOODLANDS ---
  oak: {
    id: 'oak',
    category: 'tree',
    name: { en: 'Ancient Oak & Broadleaf', fa: 'بلوط کهنسال و پهن‌برگ' },
    description: { en: 'Lush deciduous copse with deep foliage and gnarled trunks', fa: 'بیشه بلوط سرسبز با سایه‌روشن طبیعی' },
    thumbnail: '/symbols/cartography/trees/deciduous-1.svg',
    defaultSpacing: 32,
    defaultScale: 42,
    variants: [
      {
        id: 'deciduous_1',
        name: { en: 'Oak Grove I', fa: 'بیشه بلوط ۱' },
        category: 'tree',
        family: 'oak',
        src: '/symbols/cartography/trees/deciduous-1.svg',
        baseWidth: 50,
        baseHeight: 50,
        anchor: { x: 0.5, y: 0.95 },
      },
      {
        id: 'deciduous_2',
        name: { en: 'Oak Grove II', fa: 'بیشه بلوط ۲' },
        category: 'tree',
        family: 'oak',
        src: '/symbols/cartography/trees/deciduous-2.svg',
        baseWidth: 50,
        baseHeight: 50,
        anchor: { x: 0.5, y: 0.95 },
      },
      {
        id: 'tree_tall',
        name: { en: 'Tall Oak Stand', fa: 'تک‌درخت بلند' },
        category: 'tree',
        family: 'oak',
        src: '/symbols/cartography/trees/treeTall.png',
        baseWidth: 42,
        baseHeight: 52,
        anchor: { x: 0.5, y: 0.95 },
      },
    ],
  },

  conifer: {
    id: 'conifer',
    category: 'tree',
    name: { en: 'Alpine Pine & Conifer', fa: 'کاج و صنوبر کوهستانی' },
    description: { en: 'Tiered dark-green conifer spires with crag shadow facets', fa: 'کاج‌های دندانه‌دار کوهستانی با سایه دوقطبی' },
    thumbnail: '/symbols/cartography/trees/conifer-1.svg',
    defaultSpacing: 26,
    defaultScale: 38,
    variants: [
      {
        id: 'conifer_1',
        name: { en: 'Alpine Fir I', fa: 'صنوبر کوهستانی ۱' },
        category: 'tree',
        family: 'conifer',
        src: '/symbols/cartography/trees/conifer-1.svg',
        baseWidth: 42,
        baseHeight: 46,
        anchor: { x: 0.5, y: 0.95 },
      },
      {
        id: 'tree_pine',
        name: { en: 'Pine Sentinel', fa: 'تک‌کاج تیره' },
        category: 'tree',
        family: 'conifer',
        src: '/symbols/cartography/trees/treePine.png',
        baseWidth: 38,
        baseHeight: 48,
        anchor: { x: 0.5, y: 0.95 },
      },
      {
        id: 'tree_pines',
        name: { en: 'Pine Cluster', fa: 'خوشه کاج' },
        category: 'tree',
        family: 'conifer',
        src: '/symbols/cartography/trees/treePines.png',
        baseWidth: 52,
        baseHeight: 48,
        anchor: { x: 0.5, y: 0.95 },
      },
    ],
  },

  snow_pine: {
    id: 'snow_pine',
    category: 'tree',
    name: { en: 'Frozen Taiga & Snow Pine', fa: 'تایگای برفی و یخ‌زده' },
    description: { en: 'Glacial conifer spires crowned with frost and deep snow', fa: 'کاج‌های با کلاهک برف و شاخه‌های سفید' },
    thumbnail: '/symbols/cartography/trees/coniferSnow-1.svg',
    defaultSpacing: 26,
    defaultScale: 38,
    variants: [
      {
        id: 'conifer_snow_1',
        name: { en: 'Snow Fir', fa: 'صنوبر برفی' },
        category: 'tree',
        family: 'snow_pine',
        src: '/symbols/cartography/trees/coniferSnow-1.svg',
        baseWidth: 42,
        baseHeight: 46,
        anchor: { x: 0.5, y: 0.95 },
      },
    ],
  },

  palm: {
    id: 'palm',
    category: 'tree',
    name: { en: 'Desert Oasis & Coastal Palm', fa: 'نخل کویری و ساحلی' },
    description: { en: 'Swaying date palms with curved trunks and broad feather fronds', fa: 'نخل‌های گرمسیری با تنه منحنی و برگ‌های پهن' },
    thumbnail: '/symbols/cartography/trees/palm-1.svg',
    defaultSpacing: 34,
    defaultScale: 40,
    variants: [
      {
        id: 'palm_1',
        name: { en: 'Date Palm', fa: 'نخل خرما' },
        category: 'tree',
        family: 'palm',
        src: '/symbols/cartography/trees/palm-1.svg',
        baseWidth: 44,
        baseHeight: 48,
        anchor: { x: 0.5, y: 0.95 },
      },
      {
        id: 'acacia_1',
        name: { en: 'Savanna Acacia', fa: 'اقاقیای ساوانا' },
        category: 'tree',
        family: 'palm',
        src: '/symbols/cartography/trees/acacia-1.svg',
        baseWidth: 46,
        baseHeight: 44,
        anchor: { x: 0.5, y: 0.95 },
      },
      {
        id: 'cactus',
        name: { en: 'Desert Cactus', fa: 'کاکتوس کویر' },
        category: 'tree',
        family: 'palm',
        src: '/symbols/cartography/trees/cactus.png',
        baseWidth: 32,
        baseHeight: 42,
        anchor: { x: 0.5, y: 0.95 },
      },
    ],
  },

  dead_wood: {
    id: 'dead_wood',
    category: 'tree',
    name: { en: 'Withered & Cursed Wood', fa: 'درختان سوخته و مرداب' },
    description: { en: 'Gnarled bare limbs, twisted trunks, and spooky marsh boughs', fa: 'شاخه‌های پیچ‌خورده خشکیده و بدون برگ' },
    thumbnail: '/symbols/cartography/trees/deadTree-1.svg',
    defaultSpacing: 30,
    defaultScale: 38,
    variants: [
      {
        id: 'dead_tree_1',
        name: { en: 'Gnarled Snag I', fa: 'تنه خشکیده ۱' },
        category: 'tree',
        family: 'dead_wood',
        src: '/symbols/cartography/trees/deadTree-1.svg',
        baseWidth: 40,
        baseHeight: 44,
        anchor: { x: 0.5, y: 0.95 },
      },
      {
        id: 'dead_tree_2',
        name: { en: 'Gnarled Snag II', fa: 'تنه خشکیده ۲' },
        category: 'tree',
        family: 'dead_wood',
        src: '/symbols/cartography/trees/deadTree-2.svg',
        baseWidth: 40,
        baseHeight: 44,
        anchor: { x: 0.5, y: 0.95 },
      },
    ],
  },

  // --- MOUNTAINS & RIDGES ---
  alpine_massif: {
    id: 'alpine_massif',
    category: 'mountain',
    name: { en: 'Alpine Crag Massif', fa: 'رشته‌کوه صخره‌ای و سنگی' },
    description: { en: 'Sharp, dual-shaded crags with etched ridgelines and hatching', fa: 'قله‌های دندانه‌دار با خط‌الراس تیز و سایه هاشورخورده' },
    thumbnail: '/symbols/cartography/mountains/mount-1.svg',
    defaultSpacing: 46,
    defaultScale: 55,
    variants: [
      {
        id: 'mount_1',
        name: { en: 'Grand Crag Massif', fa: 'قله اصلی صخره‌ای' },
        category: 'mountain',
        family: 'alpine_massif',
        src: '/symbols/cartography/mountains/mount-1.svg',
        baseWidth: 64,
        baseHeight: 52,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'mount_2',
        name: { en: 'Steep Pinnacle', fa: 'تیغه تیز صخره‌ای' },
        category: 'mountain',
        family: 'alpine_massif',
        src: '/symbols/cartography/mountains/mount-2.svg',
        baseWidth: 64,
        baseHeight: 52,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'mount_3',
        name: { en: 'Twin Apex Massif', fa: 'قله دو شاخ' },
        category: 'mountain',
        family: 'alpine_massif',
        src: '/symbols/cartography/mountains/mount-3.svg',
        baseWidth: 68,
        baseHeight: 54,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'mount_4',
        name: { en: 'Highland Ridge', fa: 'رشته‌کوه ممتد' },
        category: 'mountain',
        family: 'alpine_massif',
        src: '/symbols/cartography/mountains/mount-4.svg',
        baseWidth: 70,
        baseHeight: 50,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'mount_5',
        name: { en: 'Craggy Spire', fa: 'ستون سنگی' },
        category: 'mountain',
        family: 'alpine_massif',
        src: '/symbols/cartography/mountains/mount-5.svg',
        baseWidth: 58,
        baseHeight: 48,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'mount_6',
        name: { en: 'Serrated Crest', fa: 'دیواره کنگره‌دار' },
        category: 'mountain',
        family: 'alpine_massif',
        src: '/symbols/cartography/mountains/mount-6.svg',
        baseWidth: 72,
        baseHeight: 52,
        anchor: { x: 0.5, y: 0.9 },
      },
    ],
  },

  snow_massif: {
    id: 'snow_massif',
    category: 'mountain',
    name: { en: 'Glacial Snow-Capped Range', fa: 'رشته‌کوه‌های برف‌گیر و یخی' },
    description: { en: 'Soaring high summits crowned with blinding-white glacier caps', fa: 'قله‌های مرتفع با کلاهک‌های برف دائم' },
    thumbnail: '/symbols/cartography/mountains/mountSnow-1.svg',
    defaultSpacing: 46,
    defaultScale: 58,
    variants: [
      {
        id: 'mount_snow_1',
        name: { en: 'Snow Massif I', fa: 'قله برفی ۱' },
        category: 'mountain',
        family: 'snow_massif',
        src: '/symbols/cartography/mountains/mountSnow-1.svg',
        baseWidth: 64,
        baseHeight: 54,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'mount_snow_2',
        name: { en: 'Snow Massif II', fa: 'قله برفی ۲' },
        category: 'mountain',
        family: 'snow_massif',
        src: '/symbols/cartography/mountains/mountSnow-2.svg',
        baseWidth: 64,
        baseHeight: 54,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'mount_snow_3',
        name: { en: 'Snow Massif III', fa: 'قله برفی ۳' },
        category: 'mountain',
        family: 'snow_massif',
        src: '/symbols/cartography/mountains/mountSnow-3.svg',
        baseWidth: 68,
        baseHeight: 54,
        anchor: { x: 0.5, y: 0.9 },
      },
    ],
  },

  volcano: {
    id: 'volcano',
    category: 'mountain',
    name: { en: 'Volcanic Peak & Caldera', fa: 'کوه آتشفشانی و کاسه دهانه' },
    description: { en: 'Conical volcanic cone with central caldera crater', fa: 'مخروط آتشفشانی با دهانه مرکزی' },
    thumbnail: '/symbols/cartography/mountains/vulcan-1.svg',
    defaultSpacing: 55,
    defaultScale: 55,
    variants: [
      {
        id: 'vulcan_1',
        name: { en: 'Active Volcano', fa: 'آتشفشان فعال' },
        category: 'mountain',
        family: 'volcano',
        src: '/symbols/cartography/mountains/vulcan-1.svg',
        baseWidth: 62,
        baseHeight: 50,
        anchor: { x: 0.5, y: 0.9 },
      },
    ],
  },

  // --- HILLS & DUNES ---
  rolling_hills: {
    id: 'rolling_hills',
    category: 'hill',
    name: { en: 'Rolling Green Foothills', fa: 'تپه‌ماهورهای سرسبز و آرام' },
    description: { en: 'Soft rounded knolls bridging mountain slopes and lowlands', fa: 'تپه‌های ملایم و مدور با شیب‌های نرم' },
    thumbnail: '/symbols/cartography/hills/hill-1.svg',
    defaultSpacing: 38,
    defaultScale: 40,
    variants: [
      {
        id: 'hill_1',
        name: { en: 'Rolling Knoll I', fa: 'تپه ملایم ۱' },
        category: 'hill',
        family: 'rolling_hills',
        src: '/symbols/cartography/hills/hill-1.svg',
        baseWidth: 50,
        baseHeight: 36,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'hill_2',
        name: { en: 'Rolling Knoll II', fa: 'تپه ملایم ۲' },
        category: 'hill',
        family: 'rolling_hills',
        src: '/symbols/cartography/hills/hill-2.svg',
        baseWidth: 52,
        baseHeight: 38,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'hill_3',
        name: { en: 'Knoll Ridge', fa: 'پشته تپه' },
        category: 'hill',
        family: 'rolling_hills',
        src: '/symbols/cartography/hills/hill-3.svg',
        baseWidth: 54,
        baseHeight: 40,
        anchor: { x: 0.5, y: 0.9 },
      },
    ],
  },

  sand_dunes: {
    id: 'sand_dunes',
    category: 'hill',
    name: { en: 'Desert Sand Dunes', fa: 'تپه‌های شنی و رمل کویر' },
    description: { en: 'Wind-carved crescent barchan dunes with shaded slip-faces', fa: 'رمل‌های هلالی بادخورده با شیب‌های سایه‌دار' },
    thumbnail: '/symbols/cartography/hills/dune-1.svg',
    defaultSpacing: 34,
    defaultScale: 40,
    variants: [
      {
        id: 'dune_1',
        name: { en: 'Crescent Barchan', fa: 'رمل هلالی' },
        category: 'hill',
        family: 'sand_dunes',
        src: '/symbols/cartography/hills/dune-1.svg',
        baseWidth: 48,
        baseHeight: 32,
        anchor: { x: 0.5, y: 0.9 },
      },
    ],
  },

  // --- STONES & ROCKS ---
  stones: {
    id: 'stones',
    category: 'stone_rock',
    name: { en: 'Granite Boulders & Crags', fa: 'تخته‌سنگ‌ها و صخره‌های خارا' },
    description: { en: 'Weathered granite boulders and exposed bedrock clusters', fa: 'صخره‌های هوازده و تخته‌سنگ‌های جداافتاده' },
    thumbnail: '/symbols/cartography/hills/rocks.png',
    defaultSpacing: 28,
    defaultScale: 34,
    variants: [
      {
        id: 'rocks_a',
        name: { en: 'Boulder Pile', fa: 'توده تخته‌سنگ' },
        category: 'stone_rock',
        family: 'stones',
        src: '/symbols/cartography/hills/rocks.png',
        baseWidth: 38,
        baseHeight: 30,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'rocks_tall',
        name: { en: 'Standing Monolith', fa: 'صخره ایستاده' },
        category: 'stone_rock',
        family: 'stones',
        src: '/symbols/cartography/hills/rocksTall.png',
        baseWidth: 32,
        baseHeight: 42,
        anchor: { x: 0.5, y: 0.9 },
      },
    ],
  },

  // --- GRASS & GROUNDCOVER ---
  grass: {
    id: 'grass',
    category: 'grass_flora',
    name: { en: 'Marsh Reeds & Steppe Grass', fa: 'نیزار باتلاقی و بوته‌های استپ' },
    description: { en: 'Tufted grasses, wetland reeds, and prairie flora', fa: 'نیزارهای بلند باتلاقی و بوته‌های وحشی دشت' },
    thumbnail: '/symbols/cartography/grass/grass-1.svg',
    defaultSpacing: 24,
    defaultScale: 30,
    variants: [
      {
        id: 'grass_1',
        name: { en: 'Steppe Grass Tuft', fa: 'بوته علف استپی' },
        category: 'grass_flora',
        family: 'grass',
        src: '/symbols/cartography/grass/grass-1.svg',
        baseWidth: 36,
        baseHeight: 28,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'swamp_1',
        name: { en: 'Marsh Reeds', fa: 'نی‌های باتلاقی' },
        category: 'grass_flora',
        family: 'grass',
        src: '/symbols/cartography/grass/swamp-1.svg',
        baseWidth: 42,
        baseHeight: 34,
        anchor: { x: 0.5, y: 0.9 },
      },
    ],
  },

  // --- CIVILIZATION & LANDMARKS ---
  landmarks: {
    id: 'landmarks',
    category: 'landmark',
    name: { en: 'Fortresses, Ruins & Towers', fa: 'دژها، ویرانه‌ها و برج‌ها' },
    description: { en: 'Hand-inked castles, watchtowers, bridges, and ancient ruins', fa: 'قلعه‌های سنگی، برج‌های دیده‌بانی و پل‌ها' },
    thumbnail: '/symbols/cartography/landmarks/castle.png',
    defaultSpacing: 50,
    defaultScale: 46,
    variants: [
      {
        id: 'castle',
        name: { en: 'Citadel Fortress', fa: 'دژ و قلعه استوار' },
        category: 'landmark',
        family: 'landmarks',
        src: '/symbols/cartography/landmarks/castle.png',
        baseWidth: 46,
        baseHeight: 46,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'tower',
        name: { en: 'Watchtower', fa: 'برج دیده‌بانی' },
        category: 'landmark',
        family: 'landmarks',
        src: '/symbols/cartography/landmarks/tower.png',
        baseWidth: 34,
        baseHeight: 48,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'ruins',
        name: { en: 'Ancient Ruins', fa: 'ویرانه‌های کهن' },
        category: 'landmark',
        family: 'landmarks',
        src: '/symbols/cartography/landmarks/ruins.png',
        baseWidth: 44,
        baseHeight: 38,
        anchor: { x: 0.5, y: 0.9 },
      },
      {
        id: 'bridge',
        name: { en: 'Arched Bridge', fa: 'پل قوسی' },
        category: 'landmark',
        family: 'landmarks',
        src: '/symbols/cartography/landmarks/bridge.png',
        baseWidth: 46,
        baseHeight: 32,
        anchor: { x: 0.5, y: 0.9 },
      },
    ],
  },
};

export function getAllSymbolFamilies(): GeoSymbolFamily[] {
  return Object.values(GEO_SYMBOL_FAMILIES);
}

export function getFamiliesByCategory(category: GeoSymbolCategory): GeoSymbolFamily[] {
  return Object.values(GEO_SYMBOL_FAMILIES).filter((f) => f.category === category);
}

export function getFamilyById(id: string): GeoSymbolFamily | undefined {
  return GEO_SYMBOL_FAMILIES[id];
}

export function getSymbolById(symbolId: string): GeoSymbolDefinition | undefined {
  for (const fam of Object.values(GEO_SYMBOL_FAMILIES)) {
    const found = fam.variants.find((v) => v.id === symbolId);
    if (found) return found;
  }
  return undefined;
}

/**
 * Resolves the natural default symbol family for a biome or mountain feature.
 */
export function resolveDefaultFamilyForTerrain(type: string, hasSnowcaps?: boolean): string {
  if (type === 'mountain_range') {
    return hasSnowcaps ? 'snow_massif' : 'alpine_massif';
  }
  if (type === 'highland' || type === 'plateau') {
    return 'rolling_hills';
  }
  switch (type) {
    case 'forest':
      return 'oak';
    case 'jungle':
    case 'oasis':
      return 'palm';
    case 'tundra':
      return 'snow_pine';
    case 'swamp':
      return 'dead_wood';
    case 'desert':
      return 'sand_dunes';
    case 'plains':
      return 'oak';
    default:
      return 'oak';
  }
}
