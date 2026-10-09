/**
 * PixiSpatialIndex: R-Tree spatial indexing powered by RBush
 * Provides sub-millisecond point and radius queries for 50,000+ interactive
 * map features, settlements, waypoints, and terrain objects.
 */

import RBush from 'rbush';

export interface SpatialItem<T = any> {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  type: 'location' | 'terrain' | 'trade_route' | 'waypoint' | 'placement';
  data: T;
}

export class PixiSpatialIndex {
  private tree: RBush<SpatialItem>;

  constructor(maxEntries = 16) {
    this.tree = new RBush<SpatialItem>(maxEntries);
  }

  /**
   * Clears all items from the index
   */
  public clear(): void {
    this.tree.clear();
  }

  /**
   * Bulk loads items for optimal tree balance
   */
  public load(items: SpatialItem[]): void {
    this.tree.load(items);
  }

  /**
   * Inserts a single spatial item
   */
  public insert(item: SpatialItem): void {
    this.tree.insert(item);
  }

  /**
   * Removes a spatial item
   */
  public remove(item: SpatialItem): void {
    this.tree.remove(item);
  }

  /**
   * Queries items intersecting an axis-aligned bounding box
   */
  public searchBBox(minX: number, minY: number, maxX: number, maxY: number): SpatialItem[] {
    return this.tree.search({ minX, minY, maxX, maxY });
  }

  /**
   * Queries items whose bounding boxes intersect a circle
   */
  public searchRadius(centerX: number, centerY: number, radius: number): SpatialItem[] {
    const candidateItems = this.tree.search({
      minX: centerX - radius,
      minY: centerY - radius,
      maxX: centerX + radius,
      maxY: centerY + radius,
    });

    const r2 = radius * radius;
    return candidateItems.filter((item: SpatialItem) => {
      // Find closest point on item bbox to center
      const closestX = Math.max(item.minX, Math.min(centerX, item.maxX));
      const closestY = Math.max(item.minY, Math.min(centerY, item.maxY));
      const dx = centerX - closestX;
      const dy = centerY - closestY;
      return dx * dx + dy * dy <= r2;
    });
  }

  /**
   * Finds the single nearest item to a given point within maxRadius
   */
  public findNearest(centerX: number, centerY: number, maxRadius = 40): SpatialItem | null {
    const items = this.searchRadius(centerX, centerY, maxRadius);
    if (items.length === 0) return null;

    let nearestItem: SpatialItem | null = null;
    let minDistanceSq = Infinity;

    for (const item of items) {
      const itemCenterX = (item.minX + item.maxX) / 2;
      const itemCenterY = (item.minY + item.maxY) / 2;
      const dx = centerX - itemCenterX;
      const dy = centerY - itemCenterY;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        nearestItem = item;
      }
    }

    return nearestItem;
  }
}
