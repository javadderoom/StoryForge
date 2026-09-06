import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_ENTITIES,
  normalizeEntityName,
  parseActionBlocks,
  validateActionBlock,
  resolveEntityTarget,
  nameMatch,
  detectLoreGaps,
  buildAdviserSystemPrompt,
  ADVISER_PERSONAS,
} from './ActionProtocol';
import type { WorldBible } from '@/lib/types/world';

const sampleWb: WorldBible = {
  worldName: 'Test',
  summary: '',
  themeNotes: '',
  factions: [
    { id: 'fac_1', name: 'Lead-Soled Brotherhood', alignment: 'Lawful', description: 'x', publicGoals: 'y', territoryIds: [], rivalFactionIds: [] },
  ],
  locations: [],
  npcs: [],
  artifacts: [],
  bestiary: [],
  religions: [],
  timeline: [],
  laws: [{ id: 'law_1', rule: 'Blood magic petrifies the caster into basalt', description: 'z', category: 'magic' }],

} as unknown as WorldBible;

describe('ActionProtocol — entity normalization', () => {
  it('maps natural-language aliases to canonical entity types', () => {
    assert.equal(normalizeEntityName('religion'), 'deity');
    assert.equal(normalizeEntityName('gods'), 'deity');
    assert.equal(normalizeEntityName('guild'), 'faction');
    assert.equal(normalizeEntityName('faction'), 'faction');
    assert.equal(normalizeEntityName('not-a-thing'), null);
  });

  it('exposes the 8 allowed entities', () => {
    assert.equal(ALLOWED_ENTITIES.length, 8);
  });
});

describe('ActionProtocol — action block parsing', () => {
  it('extracts a valid create action from a fenced block', () => {
    const reply = 'Sure!\n```storyforge-action\n{"op":"create","entity":"faction","prompt":"A smuggler syndicate"}\n```';
    const blocks = parseActionBlocks(reply);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].op, 'create');
    assert.equal(blocks[0].entity, 'faction');
    assert.equal(blocks[0].prompt, 'A smuggler syndicate');
  });

  it('rejects malformed JSON blocks', () => {
    const reply = '```storyforge-action\n{not json}\n```';
    const blocks = parseActionBlocks(reply);
    assert.equal(blocks.length, 0);
  });

  it('ignores blocks with an invalid op', () => {
    const reply = '```storyforge-action\n{"op":"explode","entity":"faction","prompt":"x"}\n```';
    assert.equal(parseActionBlocks(reply).length, 0);
  });

  it('accepts update/delete blocks even without an explicit entity by deferring resolution', () => {
    const reply =
      '```storyforge-action\n{"op":"update","match":{"byName":"Lead-Soled Brotherhood"},"prompt":"Make them richer"}\n```';
    const blocks = parseActionBlocks(reply);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].op, 'update');
    assert.equal(blocks[0].match?.byName, 'Lead-Soled Brotherhood');
  });

  it('parses multiple distinct action blocks from a single message', () => {
    const reply = `Here are the updates for both factions:
\`\`\`storyforge-action
{"op":"update","entity":"faction","match":{"byName":"Golden Pillar"},"prompt":"Set relations with Awakening Network to hostile"}
\`\`\`
And for the second faction:
\`\`\`storyforge-action
{"op":"update","entity":"faction","match":{"byName":"Awakening Network"},"prompt":"Set relations with Golden Pillar to hostile"}
\`\`\``;
    const blocks = parseActionBlocks(reply);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].match?.byName, 'Golden Pillar');
    assert.equal(blocks[1].match?.byName, 'Awakening Network');
  });

  it('parses an array of action blocks inside a single fenced block', () => {
    const reply = `\`\`\`storyforge-action
[
  {"op":"update","entity":"faction","match":{"byName":"Golden Pillar"},"prompt":"Allied with Sands"},
  {"op":"update","entity":"faction","match":{"byName":"Awakening Network"},"prompt":"Hostile with Golden Pillar"}
]
\`\`\``;
    const blocks = parseActionBlocks(reply);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].match?.byName, 'Golden Pillar');
    assert.equal(blocks[1].match?.byName, 'Awakening Network');
  });

  it('parses fence tag variations such as storyforge_action and json', () => {
    const reply = `\`\`\`storyforge_action
{"op":"create","entity":"مکان","data":{"name":"گذرگاه هیرام","region":"ارژن"}}
\`\`\``;
    const blocks = parseActionBlocks(reply);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].op, 'create');
    assert.equal(blocks[0].entity, 'location');
    assert.equal(blocks[0].data?.name, 'گذرگاه هیرام');
  });

  it('handles unclosed fences and infers entity from nested data fields', () => {
    const reply = `درود نویسنده!
\`\`\`storyforge-action
{
  "op": "create",
  "data": {
    "name": "فلات صخره‌ای",
    "category": "wilderness",
    "specialRules": ["طوفان شن"]
  }
}`;
    const blocks = parseActionBlocks(reply);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].op, 'create');
    assert.equal(blocks[0].entity, 'location');
    assert.equal(blocks[0].data?.name, 'فلات صخره‌ای');
  });
});

describe('ActionProtocol — validation', () => {
  it('flags a create without a prompt', () => {
    const r = validateActionBlock({ op: 'create', entity: 'faction' });
    assert.equal(r.valid, false);
  });
  it('flags an update without match.byName', () => {
    const r = validateActionBlock({ op: 'update', entity: 'deity', prompt: 'x' });
    assert.equal(r.valid, false);
  });
  it('accepts a complete update', () => {
    const r = validateActionBlock({
      op: 'update',
      entity: 'deity',
      match: { byName: 'Foo' },
      prompt: 'x',
    });
    assert.equal(r.valid, true);
  });
});

describe('ActionProtocol — entity resolution', () => {
  it('resolves by exact, partial, and ordinal references', () => {
    const target = resolveEntityTarget(sampleWb, 'faction', 'Lead-Soled Brotherhood');
    assert.ok(target);
    assert.equal(target.id, 'fac_1');

    const partial = resolveEntityTarget(sampleWb, 'faction', 'Lead-Soled');
    assert.ok(partial);

    const ordinal = resolveEntityTarget(sampleWb, 'faction', 'first faction');
    assert.ok(ordinal);
  });

  it('returns undefined for a missing entity', () => {
    assert.equal(resolveEntityTarget(sampleWb, 'faction', 'Ghost Syndicate'), undefined);
  });

  it('nameMatch is case-insensitive and supports containment', () => {
    assert.equal(nameMatch('Blood magic petrifies', 'blood magic petrifies'), true);
    assert.equal(nameMatch('Lead-Soled', 'Lead-Soled Brotherhood'), true);
    assert.equal(nameMatch('Foo', 'Bar'), false);
  });

  it('matches Persian text across ZWNJ, Hamza, and letter variants', () => {
    // ZWNJ difference (سایه‌های vs سایههای)
    assert.equal(nameMatch('سپاه سایه‌های جاویدان', 'سپاه سایههای جاویدان'), true);
    // Hamza difference (فرقهٔ vs فرقه)
    assert.equal(nameMatch('فرقهٔ بدعت‌گذاران شفق', 'فرقه بدعتگذاران شفق'), true);
    // Arabic Kaf/Yeh vs Persian (ي/ی, ك/ک)
    assert.equal(nameMatch('محفل كشتار تاريكی', 'محفل کشتار تاریکی'), true);
  });
});


describe('ActionProtocol — persona system prompts', () => {
  it('builds the oracle prompt with world context and action protocol', () => {
    const p = buildAdviserSystemPrompt('oracle', false, {
      worldContext: 'FACTIONS:\n- Lead-Soled Brotherhood',
    });
    assert.match(p, /Lead-Soled Brotherhood/);
    assert.match(p, /storyforge-action/);
  });

  it('instructs personas about faction strategic fields (scope + secretAgendas)', () => {
    const en = buildAdviserSystemPrompt('oracle', false);
    assert.match(en, /secretAgendas/);
    assert.match(en, /"mythic"/);

    const fa = buildAdviserSystemPrompt('oracle', true);
    assert.match(fa, /secretAgendas/);
    assert.match(fa, /scope/);
  });

  it('builds a persona-specific prompt (cosmologist) and injects focused entity', () => {
    const p = buildAdviserSystemPrompt('cosmologist', false, {
      activeEntityContext: '{"id":"fac_1"}',
    });
    assert.match(p, /COSMOLOGIST/i);
    assert.match(p, /FOCUSED ENTITY/);
    assert.match(p, /fac_1/);
  });

  it('localizes the persona prompt to Persian', () => {
    const p = buildAdviserSystemPrompt('inquisitor', true);
    assert.match(p, /بازپرس/);
  });

  it('exposes five adviser personas', () => {
    assert.equal(Object.keys(ADVISER_PERSONAS).length, 5);
  });
});

describe('ActionProtocol — lore gap detection', () => {
  it('flags missing laws, npcs, and orphan factions', () => {
    const empty = { worldName: 'x', summary: '', themeNotes: '' } as unknown as WorldBible;
    const gaps = detectLoreGaps(empty, false);
    assert.ok(gaps.includes('No factions defined'));
    assert.ok(gaps.includes('No world laws defined'));
  });

  it('flags an orphan faction (no territory) and faith without a holy site', () => {
    const wb = {
      ...sampleWb,
      religions: [{ id: 'dei_1', name: 'Cult of Ash', holyLocationIds: [], affiliatedFactionIds: [] }],
    } as unknown as WorldBible;
    const gaps = detectLoreGaps(wb, false);
    assert.ok(gaps.some((g) => g.includes('faction(s) without territory')));
    assert.ok(gaps.some((g) => g.includes('faith(s) without a holy site')));
  });
});
