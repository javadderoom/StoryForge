import { useCallback, useState } from 'react';
import type { HighlandMode, BiomeType, BiomeDensity } from '../GeoToolHud';

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
  const [biomeDensity, setBiomeDensity] = useState<BiomeDensity>('medium');
  const [valleyWidth, setValleyWidth] = useState<number>(28);
  const [mountainScale, setMountainScale] = useState<number>(55);
  const [isMountainElevationLinked, setIsMountainElevationLinked] = useState<boolean>(true);
  const [mountainElevation, setMountainElevation] = useState<number>(2750);
  const [hasSnowcaps, setHasSnowcaps] = useState<boolean>(true);
  const [riverWidth, setRiverWidth] = useState<number>(11);

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
        setMountainScale(Math.max(14, Math.min(100, Math.round(elev / 50))));
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
  };
}
