/**
 * mapTextureLibrary.ts
 *
 * Loads the Cartographer's material tiles at runtime.
 *
 * The tiles are committed to `public/textures/<theme>/` — the app never
 * depends on the network for them. Loading is best-effort: if a tile is
 * missing (offline, a bad deploy, a 404) the library simply has no texture
 * for that material and the renderer falls back to the flat theme colour.
 * The map always draws.
 */

import { Assets, Texture } from 'pixi.js';
import { MAP_MATERIALS, type MapMaterialKey } from '../texturePalette';

export class MapTextureLibrary {
  private textures = new Map<MapMaterialKey, Texture>();
  private pending: Promise<void> | null = null;
  private failed = false;

  /** The theme whose material set is loaded. */
  private theme = 'parchment';

  /**
   * Starts loading the material tiles. Safe to call repeatedly — the work
   * happens once. Resolves when every tile has either loaded or failed.
   */
  public load(theme = 'parchment'): Promise<void> {
    if (this.pending && this.theme === theme) return this.pending;
    this.theme = theme;
    this.pending = this.loadAll(theme);
    return this.pending;
  }

  private async loadAll(theme: string): Promise<void> {
    this.failed = false;
    const materials = Object.values(MAP_MATERIALS);
    await Promise.all(
      materials.map(async (material) => {
        const url = `/textures/${theme}/${material.key}.webp`;
        try {
          const texture = await Assets.load({
            alias: `cartographer-${theme}-${material.key}`,
            src: url,
          });
          this.textures.set(material.key, texture);
        } catch (error) {
          this.failed = true;
          console.warn(
            `[cartographer] material "${material.key}" could not be loaded — the map falls back to flat colours for it.`,
            error
          );
        }
      })
    );
  }

  /** The texture of a material, or null when it is not (yet) available. */
  public get(material: MapMaterialKey): Texture | null {
    return this.textures.get(material) ?? null;
  }

  /** True when at least one material has loaded. */
  public get isReady(): boolean {
    return this.textures.size > 0;
  }

  /** True when a material failed to load (the map is in fallback mode for it). */
  public get hasFailures(): boolean {
    return this.failed;
  }

  /** Releases the loaded textures. */
  public destroy(): void {
    for (const [key, texture] of this.textures) {
      void Assets.unload(`cartographer-${this.theme}-${key}`).catch(() => {
        texture.destroy(true);
      });
    }
    this.textures.clear();
    this.pending = null;
  }
}
