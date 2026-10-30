import { useCallback, useState } from 'react';
import type { HighlandMode, BiomeType, BiomeDensity, BiomeDrawMode } from '../GeoToolHud';
import {
  type GeoSymbolCategory,
  resolveDefaultFamilyForTerrain,
  getFamilyById,
} from '@/lib/engines/world/pixi/symbolPalette';

export function useGeoHudSettings() {
  // Land Sculpt Brush controls
  const [sculptMode, setSculptMode] = useState<'paint' | 'carve'>('paint');
  const [brushSize, setBrushSize] = useState<number>(65);
  const [brushRoughness, setBrushRoughness] = useState<number>(0.35);

  // Geographical tools live HUD state
  const [highlandMode, setHighlandMode] = useState<HighlandMode>('plateau');
  const [cliffHeight, setCliffHeight] = useState<number>(36);
  const [terraceTiers, setTerraceTiers] = useState<number>(1);
  const [activeBiome, setActiveBiome] = useState<BiomeType>('forest');
  const [biomeDrawMode, setBiomeDrawMode] = useState<BiomeDrawMode>('area');
  const [biomeCorridorWidth, setBiomeCorridorWidth] = useState<number>(30);
  const [biomeDensity, setBiomeDensity] = useState<BiomeDensity>('medium');
  const [valleyWidth, setValleyWidth] = useState<number>(28);
  const [mountainScale, setMountainScale] = useState<number>(55);
  const [isMountainElevationLinked, setIsMountainElevationLinked] = useState<boolean>(true);
  const [mountainElevation, setMountainElevation] = useState<number>(2750);
  const [hasSnowcaps, setHasSnowcaps] = useState<boolean>(true);
  const [riverWidth, setRiverWidth] = useState<number>(11);

  // Ready-to-use Cartography Species Library state
  // Maintains per-biome designated symbol families (e.g. desert -> sand_dunes, swamp -> marsh_reeds)
  const DEFAULT_BIOME_FAMILIES: Record<string, string> = {
    forest: 'oak',
    jungle: 'palm',
    desert: 'sand_dunes',
    swamp: 'marsh_reeds',
    tundra: 'snow_pine',
    plains: 'grass',
    oasis: 'palm',
  };

  const [biomeFamilies, setBiomeFamilies] = useState<Record<string, string>>(DEFAULT_BIOME_FAMILIES);
  const [equippedMountainFamily, setEquippedMountainFamily] = useState<string>('alpine_massif');
  const [isSpeciesPickerOpen, setIsSpeciesPickerOpen] = useState<boolean>(false);
  const [speciesPickerCategory, setSpeciesPickerCategory] = useState<GeoSymbolCategory | 'all'>('all');

  const equippedBiomeFamily =
    biomeFamilies[activeBiome] ||
    resolveDefaultFamilyForTerrain(activeBiome);

  const setEquippedFamilyForActiveBiome = useCallback(
    (familyId: string) => {
      setBiomeFamilies((prev) => ({
        ...prev,
        [activeBiome]: familyId,
      }));
    },
    [activeBiome]
  );

  const openSpeciesPicker = useCallback(
    (cat?: GeoSymbolCategory | 'all') => {
      const activeFamilyId =
        biomeFamilies[activeBiome] || resolveDefaultFamilyForTerrain(activeBiome);
      const activeFam = getFamilyById(activeFamilyId);
      const targetCat = cat || activeFam?.category || 'all';
      setSpeciesPickerCategory(targetCat);
      setIsSpeciesPickerOpen(true);
    },
    [activeBiome, biomeFamilies]
  );

  const closeSpeciesPicker = useCallback(() => {
    setIsSpeciesPickerOpen(false);
  }, []);

  const handleMountainScaleChange = useCallback(
    (val: number) => {
      setMountainScale(val);
      if (isMountainElevationLinked) {
        setMountainElevation(Math.round(val * 50));
      }
    },
    [isMountainElevationLinked]
  );

  const handleMountainElevationChange = useCallback(
    (elev: number) => {
      setMountainElevation(elev);
      if (isMountainElevationLinked) {
        setMountainScale(Math.max(5, Math.min(100, Math.round(elev / 50))));
      }
    },
    [isMountainElevationLinked]
  );

  const toggleElevationLink = useCallback(() => {
    setIsMountainElevationLinked((v) => !v);
  }, []);

  const toggleSnowcaps = useCallback(() => {
    setHasSnowcaps((v) => !v);
  }, []);

  return {
    sculptMode,
    setSculptMode,
    brushSize,
    setBrushSize,
    brushRoughness,
    setBrushRoughness,
    highlandMode,
    setHighlandMode,
    cliffHeight,
    setCliffHeight,
    terraceTiers,
    setTerraceTiers,
    activeBiome,
    setActiveBiome,
    biomeDrawMode,
    setBiomeDrawMode,
    biomeCorridorWidth,
    setBiomeCorridorWidth,
    biomeDensity,
    setBiomeDensity,
    valleyWidth,
    setValleyWidth,
    mountainScale,
    setMountainScale,
    isMountainElevationLinked,
    mountainElevation,
    setMountainElevation,
    hasSnowcaps,
    setHasSnowcaps,
    riverWidth,
    setRiverWidth,
    handleMountainScaleChange,
    handleMountainElevationChange,
    toggleElevationLink,
    toggleSnowcaps,
    equippedBiomeFamily,
    equippedTreeFamily: equippedBiomeFamily, // backwards compatibility
    setEquippedTreeFamily: setEquippedFamilyForActiveBiome, // backwards compatibility
    setEquippedFamilyForActiveBiome,
    equippedMountainFamily,
    setEquippedMountainFamily,
    isSpeciesPickerOpen,
    speciesPickerCategory,
    openSpeciesPicker,
    closeSpeciesPicker,
  };
}
