import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseActionBlocks, normalizeEntityName } from './ActionParser';
import { normalizeEntity } from './ActionNormalizer';
import { resolveEntityTarget, getEntityArray } from './ActionProtocol';
import { applyWorldChange, prepareWorldChanges } from './oracleActions';
import type { WorldBible } from '@/lib/types/world';

describe('Oracle Ontology Actions & Category Management', () => {
  it('normalizes entity names for ontology types and Persian aliases', () => {
    assert.equal(normalizeEntityName('place_category'), 'place_category');
    assert.equal(normalizeEntityName('biome'), 'place_category');
    assert.equal(normalizeEntityName('دسته‌بندی زیست‌بوم'), 'place_category');
    assert.equal(normalizeEntityName('دسته‌بندی مکان'), 'place_category');
    assert.equal(normalizeEntityName('زیست‌بوم'), 'place_category');

    assert.equal(normalizeEntityName('law_category'), 'law_category');
    assert.equal(normalizeEntityName('دسته‌بندی قانون'), 'law_category');

    assert.equal(normalizeEntityName('npc_role'), 'npc_role');
    assert.equal(normalizeEntityName('نقش شخصیت'), 'npc_role');

    assert.equal(normalizeEntityName('domain'), 'domain');
    assert.equal(normalizeEntityName('حوزه کیهانی'), 'domain');

    assert.equal(normalizeEntityName('relation_type'), 'relation_type');
    assert.equal(normalizeEntityName('نوع پیوند'), 'relation_type');
  });

  it('parses structured storyforge-action code blocks for place_category', () => {
    const text = `
Here is the action to register the new capital category:
\`\`\`storyforge-action
{
  "op": "create",
  "entity": "place_category",
  "data": {
    "name": "پایتخت و کرسی حکومت",
    "description": "شهرها و کانون‌های مرکزی حکومت و فرمانروایی",
    "color": "#EAB308"
  }
}
\`\`\`
`;
    const actions = parseActionBlocks(text);
    assert.equal(actions.length, 1);
    assert.equal(actions[0].op, 'create');
    assert.equal(actions[0].entity, 'place_category');
    assert.equal(actions[0].data?.name, 'پایتخت و کرسی حکومت');
    assert.equal(actions[0].data?.color, '#EAB308');
  });

  it('normalizes ontology entity fields, Persian keys, and ID generation', () => {
    const rawPlaceCategory = {
      'نام': 'پایتخت و کرسی حکومت',
      'توضیح': 'تختگاه فرمانروایان و کاخ مرکزی',
      'کد رنگ': '#EAB308',
    };

    const norm = normalizeEntity('place_category', rawPlaceCategory);
    assert.equal(norm.name, 'پایتخت و کرسی حکومت');
    assert.equal(norm.description, 'تختگاه فرمانروایان و کاخ مرکزی');
    assert.equal(norm.color, '#EAB308');
    assert.ok(norm.id && typeof norm.id === 'string');

    const rawRelation = {
      name: 'Trade Embargo',
      description: 'Economic blockade',
      sourceCategory: 'faction',
      targetCategory: 'faction',
      isDirected: true,
    };
    const normRel = normalizeEntity('relation_type', rawRelation);
    assert.equal(normRel.id, 'trade_embargo');
    assert.equal(normRel.color, '#38BDF8');
    assert.equal(normRel.isDirected, true);
  });

  it('preserves custom location categories like "capital" without forcing to wilderness', () => {
    const rawLocation = {
      name: 'کهن‌دژ',
      description: 'شهری گسترده و پایتخت باستانی قلمرو',
      category: 'capital',
      dangerLevel: 2,
    };
    const normLoc = normalizeEntity('location', rawLocation);
    assert.equal(normLoc.category, 'capital');
  });

  it('resolves ontology targets by name or ID from worldBible.ontology', () => {
    const wb: Partial<WorldBible> = {
      ontology: {
        placeCategories: [
          { id: 'capital', name: 'پایتخت و کرسی حکومت', description: 'تختگاه حکومت', color: '#EAB308' },
          { id: 'settlement', name: 'شهرک و کانون مدنی', description: 'شهرها', color: '#F59E0B' },
        ],
        lawCategories: [
          { id: 'magic', name: 'قوانین جادو', description: 'قوانین متافیزیک', color: '#A855F7' },
        ],
        npcRoles: [
          { id: 'inquisitor', name: 'تفتیش‌گر اسناد', description: 'بازرسان', color: '#6366F1' },
        ],
        domains: [
          { id: 'light', name: 'نور و راستی', description: 'قلمرو خورشید', color: '#10B981' },
        ],
        relationTypes: [
          { id: 'trade_pact', name: 'پیمان تجاری', description: 'مبادله بازرگانی', color: '#38BDF8', isDirected: false, sourceCategory: 'faction', targetCategory: 'faction' },
        ],
      },
    };

    assert.equal(getEntityArray(wb as WorldBible, 'place_category').length, 2);
    assert.equal(getEntityArray(wb as WorldBible, 'law_category').length, 1);
    assert.equal(getEntityArray(wb as WorldBible, 'npc_role').length, 1);
    assert.equal(getEntityArray(wb as WorldBible, 'domain').length, 1);
    assert.equal(getEntityArray(wb as WorldBible, 'relation_type').length, 1);

    const foundPlace = resolveEntityTarget(wb as WorldBible, 'place_category', 'پایتخت');
    assert.ok(foundPlace);
    assert.equal(foundPlace.id, 'capital');

    const foundById = resolveEntityTarget(wb as WorldBible, 'place_category', 'settlement');
    assert.ok(foundById);
    assert.equal(foundById.name, 'شهرک و کانون مدنی');

    const foundDomain = resolveEntityTarget(wb as WorldBible, 'domain', 'نور و راستی');
    assert.ok(foundDomain);
    assert.equal(foundDomain.id, 'light');
  });

  it('prepares world changes for ontology categories with prepareWorldChanges', async () => {
    const actions = [
      {
        op: 'create' as const,
        entity: 'place_category' as const,
        data: {
          id: 'capital',
          name: 'پایتخت و کرسی حکومت',
          description: 'کانون فرمانروایی',
          color: '#EAB308',
        },
      },
    ];

    const { ready, failed } = await prepareWorldChanges({
      actions,
      worldBible: { ontology: { placeCategories: [] } } as any,
      worldContext: '',
      isPersian: true,
    });

    assert.equal(failed.length, 0);
    assert.equal(ready.length, 1);
    assert.equal(ready[0].op, 'create');
    assert.equal(ready[0].entity, 'place_category');
    assert.equal(ready[0].newData.id, 'capital');
    assert.equal(ready[0].newData.color, '#EAB308');
  });

  it('routes applyWorldChange to registered ontology mutators', () => {
    let addedPlaceCategory: any = null;
    let editedPlaceCategory: any = null;
    let deletedId: string | null = null;

    const mutators: any = {
      place_category: {
        add: (item: any) => { addedPlaceCategory = item; },
        edit: (id: string, item: any) => { editedPlaceCategory = { id, ...item }; },
        del: (id: string) => { deletedId = id; },
      },
    };

    applyWorldChange(
      {
        op: 'create',
        entity: 'place_category',
        label: 'Place Category: capital',
        newData: { id: 'capital', name: 'پایتخت', description: 'مرکز حکومت', color: '#EAB308' },
      },
      mutators
    );
    assert.equal(addedPlaceCategory?.id, 'capital');

    applyWorldChange(
      {
        op: 'update',
        entity: 'place_category',
        label: 'Place Category: capital',
        targetId: 'capital',
        newData: { id: 'capital', name: 'پایتخت سلطنتی', description: 'شرح نو', color: '#EAB308' },
      },
      mutators
    );
    assert.equal(editedPlaceCategory?.name, 'پایتخت سلطنتی');

    applyWorldChange(
      {
        op: 'delete',
        entity: 'place_category',
        label: 'Place Category: capital',
        targetId: 'capital',
      },
      mutators
    );
    assert.equal(deletedId, 'capital');
  });
});
