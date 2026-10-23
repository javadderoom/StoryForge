import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PLACE_CATEGORY_META,
  FALLBACK_PLACE_CATEGORY_META,
  defaultPlaceCategoryMeta,
  isPointPlaceCategory,
  resolvePlaceCategoryMeta,
  withPlaceCategoryMeta,
} from './placeCategories';
import { CustomPlaceCategorySchema, MapTerrainFeatureSchema } from '@/lib/types/world';

describe('placeCategories — canonical metadata', () => {
  it('treats settlements, strongholds, ruins and dungeons as point places', () => {
    for (const id of ['settlement', 'stronghold', 'ruins', 'dungeon']) {
      assert.equal(defaultPlaceCategoryMeta(id).geometryKind, 'point');
      assert.equal(isPointPlaceCategory(id), true);
    }
  });

  it('treats plains and wilderness as area labels', () => {
    const meta = defaultPlaceCategoryMeta('plains');
    assert.equal(meta.geometryKind, 'area');
    assert.equal(meta.renderAs, 'label');
    assert.ok(meta.mapTerrainTypes.includes('plains'));
    assert.equal(isPointPlaceCategory('wilderness'), false);
  });

  it('treats waterways as lines and seas as water areas', () => {
    assert.equal(defaultPlaceCategoryMeta('waterway').geometryKind, 'line');
    assert.equal(defaultPlaceCategoryMeta('waterway').renderAs, 'line');
    assert.equal(defaultPlaceCategoryMeta('seas').renderAs, 'water');
  });

  it('falls back to a point pin for an unknown custom category', () => {
    assert.deepEqual(defaultPlaceCategoryMeta('author_invented'), FALLBACK_PLACE_CATEGORY_META);
    assert.equal(isPointPlaceCategory('author_invented'), true);
  });
});

describe('placeCategories — ontology overrides', () => {
  it('lets an ontology category override only the render mode', () => {
    const meta = resolvePlaceCategoryMeta('waterway', [
      { id: 'waterway', renderAs: 'label' },
    ]);
    assert.equal(meta.geometryKind, 'line');
    assert.equal(meta.renderAs, 'label');
    assert.deepEqual(meta.mapTerrainTypes, DEFAULT_PLACE_CATEGORY_META.waterway.mapTerrainTypes);
  });

  it('honours a custom category with explicit geometry', () => {
    assert.equal(
      isPointPlaceCategory('trade_port', [
        { id: 'trade_port', geometryKind: 'point', renderAs: 'settlement' },
      ]),
      true
    );
    assert.equal(
      isPointPlaceCategory('tundra_region', [
        { id: 'tundra_region', geometryKind: 'area', renderAs: 'label' },
      ]),
      false
    );
  });

  it('adds canonical metadata to a category definition', () => {
    const category = withPlaceCategoryMeta({
      id: 'waterway',
      name: 'Waterway',
      description: '',
      color: '#38BDF8',
    });
    assert.equal(category.geometryKind, 'line');
    assert.equal(category.renderAs, 'line');
  });
});

describe('placeCategories — schema', () => {
  it('accepts optional rendering metadata on a place category', () => {
    const parsed = CustomPlaceCategorySchema.parse({
      id: 'steppe',
      name: 'Steppe',
      geometryKind: 'area',
      renderAs: 'label',
      mapTerrainTypes: ['plains', 'wasteland'],
    });
    assert.equal(parsed.geometryKind, 'area');
    assert.deepEqual(parsed.mapTerrainTypes, ['plains', 'wasteland']);
  });

  it('accepts an optional locationId on a terrain feature', () => {
    const parsed = MapTerrainFeatureSchema.parse({
      id: 'terr_1',
      name: 'Ashen Ford',
      type: 'river',
      locationId: 'loc_ashen_ford',
    });
    assert.equal(parsed.locationId, 'loc_ashen_ford');
  });
});