import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { EntityType } from './ActionProtocol';
import { applyWorldChange, EntityMutators, summarizeChangeFields, WorldActionChange } from './oracleActions';

describe('oracleActions — applyWorldChange & summaries', () => {
  it('routes create/update/delete to the right mutators', () => {
    const calls: string[] = [];
    const mutators = {
      faction: {
        add: (e: { name: string }) => calls.push(`add:${e.name}`),
        edit: (id: string, u: { publicGoals?: string }) => calls.push(`edit:${id}:${u.publicGoals}`),
        del: (id: string) => calls.push(`del:${id}`),
      },
    } as unknown as Record<EntityType, EntityMutators>;

    applyWorldChange(
      { op: 'create', entity: 'faction', label: 'Faction: X', newData: { name: 'X' } },
      mutators
    );
    applyWorldChange(
      { op: 'update', entity: 'faction', label: 'Faction: Lead-Soled Brotherhood', oldData: {}, newData: { id: 'fac_1', publicGoals: 'March further' }, targetId: 'fac_1' },
      mutators
    );
    applyWorldChange(
      { op: 'delete', entity: 'faction', label: 'Faction: Lead-Soled Brotherhood', targetId: 'fac_1' },
      mutators
    );

    assert.deepEqual(calls, ['add:X', 'edit:fac_1:March further', 'del:fac_1']);
  });

  it('throws when no mutators are registered for the entity', () => {
    assert.throws(() =>
      applyWorldChange({ op: 'create', entity: 'npc', label: 'x', newData: {} }, {} as unknown as Record<EntityType, EntityMutators>)
    );
  });

  it('summarizes changed fields for updates and created shapes', () => {
    const change: WorldActionChange = {
      op: 'update',
      entity: 'faction',
      label: '',
      oldData: { id: 'a', name: 'Same', publicGoals: 'Old', secretAgendas: '' },
      newData: { id: 'a', name: 'Same', publicGoals: 'New', secretAgendas: 'Dominate', scope: 'mythic' },
    };
    const summary = summarizeChangeFields(change);
    assert.ok(summary.includes('publicGoals'));
    assert.ok(summary.includes('secretAgendas'));
    assert.ok(summary.includes('scope'));
    assert.ok(!summary.includes('name'));
    assert.ok(!summary.includes('id'));

    const createSummary = summarizeChangeFields({
      op: 'create',
      entity: 'faction',
      label: '',
      newData: { id: 'b', name: 'N', scope: 'mythic' },
    });
    assert.equal(createSummary, 'name, scope');
  });
});
