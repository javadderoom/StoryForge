import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NARRATOR_TIER_CONFIGS,
  NARRATOR_TIERS,
  getNarratorTierConfigs,
  invalidateNarratorTierCache,
  repairNarratorTierConfig,
  validateNarratorTierConfig,
  type NarratorTier,
} from './narratorModelRegistry';
import { ENGINE_TIER_COSTS, getNarrativeAdapter, isProviderConfigured } from './narrativeAdapterFactory';

describe('narrator model registry', () => {
  it('ships the exact routing that existed before the Studio section', () => {
    assert.equal(DEFAULT_NARRATOR_TIER_CONFIGS.normal.provider, 'gemini');
    assert.equal(DEFAULT_NARRATOR_TIER_CONFIGS.normal.model, 'gemini-3.5-flash-lite');

    assert.equal(DEFAULT_NARRATOR_TIER_CONFIGS.plus.provider, 'aiprime');
    assert.equal(DEFAULT_NARRATOR_TIER_CONFIGS.plus.model, 'gemini-3.8-flash');
    assert.equal(DEFAULT_NARRATOR_TIER_CONFIGS.plus.fallbackModel, 'gemini-2.5-flash');
    assert.equal(DEFAULT_NARRATOR_TIER_CONFIGS.plus.endpoint, 'https://api.aiprime.shop/v1/chat/completions');

    assert.equal(DEFAULT_NARRATOR_TIER_CONFIGS.advance.provider, 'sinox');
    assert.equal(DEFAULT_NARRATOR_TIER_CONFIGS.advance.model, 't-gemini-4-argon');
    assert.equal(DEFAULT_NARRATOR_TIER_CONFIGS.advance.reasoningEffort, 'low');
    assert.equal(DEFAULT_NARRATOR_TIER_CONFIGS.advance.thinkingBudgetTokens, 1024);
  });

  it('keeps the credit costs in sync with the engine tier costs', () => {
    for (const tier of NARRATOR_TIERS) {
      assert.ok(ENGINE_TIER_COSTS[tier] > 0, `${tier} has a credit cost`);
    }
  });

  describe('validation', () => {
    it('accepts a well-formed tier config', () => {
      const res = validateNarratorTierConfig({
        tier: 'plus',
        provider: 'aiprime',
        model: 'gemini-3.8-flash',
        fallbackModel: 'gemini-2.5-flash',
        endpoint: 'https://api.aiprime.shop/v1/chat/completions',
        temperature: 0.8,
      });
      assert.equal(res.ok, true);
      if (res.ok) assert.equal(res.value.temperature, 0.8);
    });

    it('rejects an unsafe model id, a non-http endpoint and an out-of-range temperature', () => {
      const res = validateNarratorTierConfig({
        tier: 'plus',
        provider: 'aiprime',
        model: 'bad model id/../etc',
        endpoint: 'file:///etc/passwd',
        temperature: 9,
      });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.ok(res.errors.model, 'model error reported');
        assert.ok(res.errors.endpoint, 'endpoint error reported');
        assert.ok(res.errors.temperature, 'temperature error reported');
      }
    });

    it('rejects an unknown provider or tier', () => {
      const badProvider = validateNarratorTierConfig({
        tier: 'plus',
        provider: 'openai',
        model: 'gpt-4',
      });
      assert.equal(badProvider.ok, false);

      const badTier = validateNarratorTierConfig({
        tier: 'legendary',
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite',
      });
      assert.equal(badTier.ok, false);
    });

    it('treats empty optional strings as "unset"', () => {
      const res = validateNarratorTierConfig({
        tier: 'normal',
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite',
        fallbackModel: '',
        endpoint: '',
      });
      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.fallbackModel, undefined);
        assert.equal(res.value.endpoint, undefined);
      }
    });
  });

  describe('repair', () => {
    it('keeps a valid persisted row intact', () => {
      const { config, repaired } = repairNarratorTierConfig({
        tier: 'advance',
        provider: 'sinox',
        model: 't-gemini-4-argon',
        endpoint: 'https://sinoxapi.com/v1/chat/completions',
        reasoningEffort: 'medium',
        thinkingBudgetTokens: 2048,
      });
      assert.equal(repaired, false);
      assert.equal(config.provider, 'sinox');
      assert.equal(config.reasoningEffort, 'medium');
      assert.equal(config.thinkingBudgetTokens, 2048);
    });

    it('falls back to the tier default when the row is unusable', () => {
      const { config, repaired } = repairNarratorTierConfig({
        tier: 'plus',
        provider: 'not-a-provider',
        model: '',
      });
      assert.equal(repaired, true);
      assert.equal(config.model, DEFAULT_NARRATOR_TIER_CONFIGS.plus.model);
      assert.equal(config.provider, DEFAULT_NARRATOR_TIER_CONFIGS.plus.provider);
    });

    it('drops provider-specific fields when the provider changed', () => {
      const { config } = repairNarratorTierConfig({
        tier: 'normal',
        provider: 'gemini',
        model: 'gemini-3.5-flash-lite',
        endpoint: 'https://api.aiprime.shop/v1/chat/completions',
        fallbackModel: 'gemini-2.5-flash',
        reasoningEffort: 'high',
      });
      assert.equal(config.endpoint, undefined, 'an AI Prime endpoint on a Gemini tier would break the request');
      assert.equal(config.fallbackModel, undefined);
      assert.equal(config.reasoningEffort, undefined, 'Gemini has no reasoning_effort knob');
    });

    it('keeps the thinking budget on Gemini (its native thinkingConfig) but not reasoning effort', () => {
      const { config, repaired } = repairNarratorTierConfig({
        tier: 'normal',
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        thinkingBudgetTokens: 2048,
      });
      assert.equal(repaired, false);
      assert.equal(config.thinkingBudgetTokens, 2048);
      assert.equal(config.reasoningEffort, undefined);
    });

    it('keeps reasoning effort and thinking budget on the OpenAI-compatible gateways', () => {
      const { config, repaired } = repairNarratorTierConfig({
        tier: 'plus',
        provider: 'aiprime',
        model: 'gemini-3.8-flash',
        fallbackModel: 'gemini-2.5-flash',
        endpoint: 'https://api.aiprime.shop/v1/chat/completions',
        reasoningEffort: 'medium',
        thinkingBudgetTokens: 4096,
      });
      assert.equal(repaired, false);
      assert.equal(config.reasoningEffort, 'medium');
      assert.equal(config.thinkingBudgetTokens, 4096);
      assert.equal(config.fallbackModel, 'gemini-2.5-flash');
    });
  });

  describe('effective routing', () => {
    it('serves the code defaults when no row is persisted', async () => {
      invalidateNarratorTierCache();
      const configs = await getNarratorTierConfigs({ force: true });
      for (const tier of NARRATOR_TIERS) {
        assert.equal(configs[tier].source, 'default');
        assert.equal(configs[tier].model, DEFAULT_NARRATOR_TIER_CONFIGS[tier].model);
        assert.equal(configs[tier].provider, DEFAULT_NARRATOR_TIER_CONFIGS[tier].provider);
      }
    });

    it('caches reads and re-reads after the cache is invalidated', async () => {
      invalidateNarratorTierCache();
      const first = await getNarratorTierConfigs();
      const second = await getNarratorTierConfigs();
      assert.equal(first, second, 'the second read is served from the cache');
      invalidateNarratorTierCache();
      const third = await getNarratorTierConfigs({ force: true });
      assert.notEqual(first, third, 'an invalidated cache re-reads the registry');
    });
  });

  describe('adapter wiring', () => {
    it('builds an adapter for every tier', async () => {
      for (const tier of NARRATOR_TIERS) {
        const adapter = await getNarrativeAdapter(tier);
        assert.ok(adapter, `${tier} adapter is built`);
      }
    });

    it('reports provider key status from the environment', () => {
      const previous = process.env.AIPRIME_API_KEY;
      delete process.env.AIPRIME_API_KEY;
      assert.equal(isProviderConfigured('aiprime'), false);
      process.env.AIPRIME_API_KEY = 'test-key';
      assert.equal(isProviderConfigured('aiprime'), true);
      if (previous === undefined) delete process.env.AIPRIME_API_KEY;
      else process.env.AIPRIME_API_KEY = previous;
    });

    it('falls back to the normal tier for an unknown tier', async () => {
      const adapter = await getNarrativeAdapter('legendary' as unknown as NarratorTier);
      assert.ok(adapter);
    });
  });
});
