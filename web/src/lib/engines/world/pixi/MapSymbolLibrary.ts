/**
 * MapSymbolLibrary.ts
 *
 * Preloads, caches, and compiles vector SVGs and PNG sprites from the Cartographer's
 * symbol library into Pixi.js Textures for ultra-fast GPU sprite instancing.
 */

import { Assets, Texture } from 'pixi.js';
import { getAllSymbolFamilies, type GeoSymbolDefinition } from './symbolPalette';

export class MapSymbolLibrary {
  private textures = new Map<string, Texture>();
  private pending: Promise<void> | null = null;
  private failed = false;

  public loadAll(): Promise<void> {
    if (this.pending) return this.pending;
    this.pending = this.executeLoadAll();
    return this.pending;
  }

  private async executeLoadAll(): Promise<void> {
    this.failed = false;
    const families = getAllSymbolFamilies();
    const allSymbols: GeoSymbolDefinition[] = [];
    for (const fam of families) {
      for (const variant of fam.variants) {
        allSymbols.push(variant);
      }
    }

    await Promise.all(
      allSymbols.map(async (symbol) => {
        try {
          const texture = await Assets.load({
            alias: `symbol-${symbol.id}`,
            src: symbol.src,
          });
          this.textures.set(symbol.id, texture);
        } catch (error) {
          this.failed = true;
          console.warn(`[MapSymbolLibrary] Symbol "${symbol.id}" could not be loaded from "${symbol.src}":`, error);
        }
      })
    );
  }

  public get(symbolId: string): Texture | null {
    return this.textures.get(symbolId) ?? null;
  }

  public get isReady(): boolean {
    return this.textures.size > 0;
  }

  public destroy(): void {
    for (const [id, texture] of this.textures) {
      void Assets.unload(`symbol-${id}`).catch(() => {
        texture.destroy(true);
      });
    }
    this.textures.clear();
    this.pending = null;
  }
}
