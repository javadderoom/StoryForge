/**
 * MapSymbolLibrary.ts
 *
 * Preloads, caches, and compiles vector SVGs and PNG sprites from the Cartographer's
 * symbol library into Pixi.js Textures for ultra-fast GPU sprite instancing.
 *
 * Uses a static global texture cache so textures are loaded ONCE and never re-allocated
 * across React component remounts or engine re-initializations.
 */

import { Assets, Texture } from 'pixi.js';
import { getAllSymbolFamilies, type GeoSymbolDefinition } from './symbolPalette';

// Module-level shared texture cache to prevent duplicate texture allocations in V8 & WebGL
const SHARED_TEXTURE_CACHE = new Map<string, Texture>();
let sharedPendingPromise: Promise<void> | null = null;

export class MapSymbolLibrary {
  public loadAll(): Promise<void> {
    if (SHARED_TEXTURE_CACHE.size > 0) {
      return Promise.resolve();
    }
    if (sharedPendingPromise) {
      return sharedPendingPromise;
    }
    sharedPendingPromise = this.executeLoadAll();
    return sharedPendingPromise;
  }

  private async executeLoadAll(): Promise<void> {
    const families = getAllSymbolFamilies();
    const allSymbols: GeoSymbolDefinition[] = [];
    for (const fam of families) {
      for (const variant of fam.variants) {
        allSymbols.push(variant);
      }
    }

    await Promise.all(
      allSymbols.map(async (symbol) => {
        if (SHARED_TEXTURE_CACHE.has(symbol.id)) return;
        try {
          const texture = await Assets.load({
            alias: `symbol-${symbol.id}`,
            src: symbol.src,
          });
          SHARED_TEXTURE_CACHE.set(symbol.id, texture);
        } catch (error) {
          console.warn(
            `[MapSymbolLibrary] Symbol "${symbol.id}" could not be loaded from "${symbol.src}":`,
            error
          );
        }
      })
    );
    sharedPendingPromise = null;
  }

  public get(symbolId: string): Texture | null {
    return SHARED_TEXTURE_CACHE.get(symbolId) ?? null;
  }

  public get isReady(): boolean {
    return SHARED_TEXTURE_CACHE.size > 0;
  }

  public destroy(): void {
    // Keep textures in SHARED_TEXTURE_CACHE for instant reuse across canvas sessions.
    // WebGL textures are preserved, preventing costly texture upload leaks.
  }
}
