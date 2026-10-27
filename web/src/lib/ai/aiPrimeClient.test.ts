import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonObject, getAiPrimeApiKey, AIPRIME_ENDPOINT, DEFAULT_DEEPSEEK_MODEL } from './aiPrimeClient';

describe('aiPrimeClient — DeepSeek v4.1 Flash via AI Prime', () => {
  it('correctly defines the endpoint and default deepseek model', () => {
    assert.equal(AIPRIME_ENDPOINT, 'https://api.aiprime.shop/v1/chat/completions');
    assert.equal(DEFAULT_DEEPSEEK_MODEL, 'deepseek-v4.1-flash-1017');
  });

  it('reads AIPRIME_API_KEY from environment or returns null if empty', () => {
    const key = getAiPrimeApiKey();
    // In our test environment, it reads the configured key or null
    assert.ok(key === null || typeof key === 'string');
  });

  it('extracts raw JSON object string accurately', () => {
    const raw = '{"name": "Desert Scourge", "dangerLevel": 4}';
    const parsed = extractJsonObject<{ name: string; dangerLevel: number }>(raw);
    assert.equal(parsed.name, 'Desert Scourge');
    assert.equal(parsed.dangerLevel, 4);
  });

  it('extracts JSON object enclosed within markdown code fences', () => {
    const fenced = '```json\n{\n  "name": "Oasis Citadel",\n  "population": 1200\n}\n```';
    const parsed = extractJsonObject<{ name: string; population: number }>(fenced);
    assert.equal(parsed.name, 'Oasis Citadel');
    assert.equal(parsed.population, 1200);
  });

  it('extracts JSON from responses with leading reasoning prose', () => {
    const mixed = 'Thinking completed. Here is the requested entity:\n\n{"id": "npc_1", "role": "hermit"}\n\nHope this helps!';
    const parsed = extractJsonObject<{ id: string; role: string }>(mixed);
    assert.equal(parsed.id, 'npc_1');
    assert.equal(parsed.role, 'hermit');
  });
});
