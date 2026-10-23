/**
 * Vintage Fantasy / Classic Parchment Theme Palette and Style Definitions
 * Mimics hand-drawn, illuminated manuscript cartography with sepia ink,
 * woodcut cross-hatching, and aged papyrus washes.
 */

export const VINTAGE_PARCHMENT = {
  // Base Paper & Water
  bgParchment: 0xf5ecd5,
  bgParchmentHex: '#f5ecd5',
  // Midpoint of the `ocean` material ramp, so the flat fallback and the
  // textured sea are the same colour.
  oceanWash: 0xa5bbc6,
  oceanWashHex: '#a5bbc6',
  landFill: 0xf9f3df,
  landFillHex: '#f9f3df',

  // Ink & Contours
  coastlineInk: 0x3a2818,
  coastlineHatch: 0x8c7355,
  coastlineGlow: 0xd6c49c,
  primaryInk: 0x2b1e16,
  secondaryInk: 0x5c4938,

  // Natural Elements
  mountainInk: 0x2d1f14,
  mountainCrag: 0x22160d,
  mountainShade: 0xb8a58a,
  mountainHighlight: 0xfffaee,
  mountainSnowcap: 0xfffaee,
  riverInk: 0x4a6b82,
  riverBankInk: 0x2c4355,
  riverWash: 0x94b1c2,
  riverHighlight: 0x769bb5,
  sandbarFill: 0xded2b6,
  biomeForest: 0x4d5f3e,
  biomeDesert: 0xd4a76a,
  biomeSwamp: 0x524b38,
  biomeTundra: 0xded8c8,
  valleyInk: 0x594636,

  // Routes & Infrastructure
  caravanActive: 0x2f6b48,
  caravanRaided: 0xb86228,
  caravanBlockaded: 0x8f2828,
  caravanSecret: 0x693d7a,
  caravanSeasonal: 0x386b8f,
  caravanWaypoint: 0xb8860b,

  // Settlements & Heraldry
  settlementBorder: 0x2d1f14,
  capitalGold: 0xc8963e,
  dungeonCrimson: 0x8a2b2b,
  fortressIron: 0x423c37,
  villageWood: 0x5c4228,
  labelBannerBg: 0xfffaee,
  labelBannerBorder: 0x5c4938,
  labelText: 0x1e130c,

  // Selection (Plan 23)
  // A wide cream under-stroke plus a thin amber line: readable on both the
  // pale paper and the indigo sea wash, and clearly not part of the map ink.
  selectionHalo: 0xfff7e2,
  selectionInk: 0xb45309,

  // Cartographic Frame & Grid
  gridRuling: 0xa8987e,
  gridRulingHex: '#a8987e',
  borderFrame: 0x332214,
  compassRoseInk: 0x3a2818,
  compassRoseGold: 0xba8c36,
} as const;

export type VintageTheme = typeof VINTAGE_PARCHMENT;
