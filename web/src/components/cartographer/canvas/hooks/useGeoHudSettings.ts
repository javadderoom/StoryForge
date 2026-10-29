import { useCallback, useState } from 'react';
import type { HighlandMode, BiomeType, BiomeDensity, BiomeDrawMode } from '../GeoToolHud';
import type { GeoSymbolCategory } from '@/lib/engines/world/pixi/symbolPalette';

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
  const [equippedTreeFamily, setEquippedTreeFamily] = useState<string>('oak');
  const [equippedMountainFamily, setEquippedMountainFamily] = useState<string>('alpine_massif');
  const [isSpeciesPickerOpen, setIsSpeciesPickerOpen] = useState<boolean>(false);
  const [speciesPickerCategory, setSpeciesPickerCategory] = useState<GeoSymbolCategory | 'all'>('all');

  const openSpeciesPicker = useCallback((cat: GeoSymbolCategory | 'all' = 'all') => {
    setSpeciesPickerCategory(cat);
    setIsSpeciesPickerOpen(true);
  }, []);

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
    equippedTreeFamily,
    setEquippedTreeFamily,
    equippedMountainFamily,
    setEquippedMountainFamily,
    isSpeciesPickerOpen,
    speciesPickerCategory,
    openSpeciesPicker,
    closeSpeciesPicker,
  };
}
