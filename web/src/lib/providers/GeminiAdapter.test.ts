import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeChoices,
  normalizeExtractedMemories,
  GeminiAdapter,
} from './GeminiAdapter';
import { GenerationPromptPayload } from '../engines/narrative/PromptAssembler';

describe('Plan 08 - AI Output Normalization (choice & memory guardrails)', () => {
  describe('normalizeChoices', () => {
    it('keeps valid choices and never empties the panel for stat drift', () => {
      const out = normalizeChoices(
        [
          { id: 'c1', text: 'Swing the axe', requiredStatId: 'might', targetDC: 12 },
          { id: 'c2', text: 'Hack the terminal', requiredStatId: 'hacking', targetDC: 14 }, // unknown stat -> binds to first valid stat
          { id: 'c3', text: 'Follow quietly' }, // no stat -> safe diceless continuation
        ],
        ['might', 'cunning'],
        true
      );
      assert.equal(out.length, 3);
      assert.equal(out[0].id, 'c1');
      assert.equal(out[0].requiredStatId, 'might');
      assert.equal(out[1].id, 'c2');
      assert.equal(out[1].requiredStatId, 'might'); // fallback, not dropped
      assert.equal(out[2].id, 'c3');
      assert.equal(out[2].requiredStatId, undefined);
      assert.equal(out[2].targetDC, undefined);
    });

    it('resolves synonyms and Persian statutory names to canonical stat ids', () => {
      const out = normalizeChoices(
        [
          { id: 's1', text: 'Punch the gate', requiredStatId: 'strength' }, // synonym of might
          { id: 's2', text: 'نگاهی موذیانه بینداز', stat: 'نیرو' }, // Persian name -> might
          { id: 's3', text: 'Cast a spell', check: { stat: 'arcana' } }, // Studio check.stat shape
        ],
        ['might', 'cunning', 'arcana', 'agility', 'charisma'],
        true
      );
      assert.equal(out.length, 3);
      assert.equal(out[0].requiredStatId, 'might');
      assert.equal(out[1].requiredStatId, 'might');
      assert.equal(out[2].requiredStatId, 'arcana');
    });

    it('maps story-authored stat display names via statIdAliases', () => {
      const out = normalizeChoices(
        [{ id: 'a1', text: 'جادوگری کن', requiredStatId: 'جادو' }],
        ['arcana'],
        true,
        false,
        { arcana: ['جادو', 'Magick'] }
      );
      assert.equal(out.length, 1);
      assert.equal(out[0].requiredStatId, 'arcana');
    });

    it('clamps out-of-range DCs and coerces invalid enums to safe defaults', () => {
      const out = normalizeChoices(
        [{ id: 'c1', text: 'Do the thing', requiredStatId: 'MIGHT', style: 'wild_style', riskLevel: 'extreme', targetDC: 99 }],
        ['might'],
        true
      );
      assert.equal(out.length, 1);
      assert.equal(out[0].targetDC, 30);
      assert.equal(out[0].style, 'tactical');
      assert.equal(out[0].riskLevel, 'medium');
    });

    it('accepts snake_case fallback fields and caps results at 4 choices', () => {
      const raw = [1, 2, 3, 4, 5, 6].map((i) => ({
        id: `c${i}`,
        text: `Choice ${i}`,
        required_stat_id: 'cunning',
        target_dc: 10 + i,
      }));
      const out = normalizeChoices(raw, ['cunning'], true);
      assert.equal(out.length, 4);
      assert.equal(out[0].requiredStatId, 'cunning');
    });

    it('calibrates DCs between 6 and 11 when isLowBase is true', () => {
      const out = normalizeChoices(
        [
          { id: 'c1', text: 'Sneak past guard', requiredStatId: 'stealth', riskLevel: 'low' },
          { id: 'c2', text: 'Climb the wall', requiredStatId: 'might', riskLevel: 'medium', targetDC: 14 },
          { id: 'c3', text: 'Break the gate', requiredStatId: 'might', riskLevel: 'high', targetDC: 18 },
        ],
        ['stealth', 'might'],
        true,
        true // isLowBase
      );
      assert.equal(out[0].targetDC, 7); // low default is 7
      assert.equal(out[1].targetDC, 10); // medium clamped to <= 10
      assert.equal(out[2].targetDC, 11); // high clamped to <= 11
    });
  });

  describe('normalizeExtractedMemories', () => {
    it('clamps importance, whitelists categories, and drops ephemeral memories', () => {
      const out = normalizeExtractedMemories([
        { category: 'character', importance: 42, summary: 'Valid major discovery' },
        { category: 'galactic', importance: 8, summary: 'Invalid category becomes story' },
        { category: 'recent', importance: 2, summary: 'Trivial chit chat detail' },
        { category: 'world', importance: 6, summary: 'no' }, // too short
        'garbage entry',
      ]);
      assert.equal(out.length, 2);
      assert.equal(out[0].importance, 10);
      assert.equal(out[0].category, 'character');
      assert.equal(out[1].category, 'story');
    });
  });

  describe('generateScene mock flag (Plan 08 canon guard)', () => {
    it('flags mock responses with isMock=true so callers can reject them', async () => {
      const adapter = new GeminiAdapter(undefined); // no API key -> mock path
      const prompt: GenerationPromptPayload = {
        systemPrompt: 'test',
        userPrompt: 'test',
        isEnglish: true,
        playerStatIds: { might: 12, cunning: 10 },
      };
      const res = await adapter.generateScene(prompt);
      assert.equal(res.isMock, true);
      // Mock choice stats must still pass normalization against valid stat ids.
      const mockWithStats = await new GeminiAdapter().generateScene({ ...prompt, playerStatIds: {} });
      assert.equal(mockWithStats.isMock, true);
    });
  });
});
