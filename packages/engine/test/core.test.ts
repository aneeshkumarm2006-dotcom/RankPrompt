import { describe, expect, it } from 'vitest';
import { costMicros, isUnpriced, priceFor } from '../src/cost';
import { kindForStatus, parseRetryAfter } from '../src/errors';
import { createOpenAIExtractor, dedupeVendors, EXTRACT_PROMPT_HASH } from '../src/extract';
import { RATE_DECREASE_COOLDOWN_MS, RateLimiter } from '../src/limiter';
import { countryLocationCode, dfsLanguageCode } from '../src/locations';
import { createOpenAIClient } from '../src/openai';
import { MAX_ATTEMPTS, retryDecision } from '../src/retry';
import { engineVersion } from '../src/version';
import { COUNTRY_CODES } from '@pv/shared';
import { never, replayFetch } from './helpers';

describe('cost', () => {
  it('resolves dated snapshots and provider prefixes to a price', () => {
    expect(priceFor('gpt-5.6-luna-2026-09-15')).toEqual(priceFor('gpt-5.6-luna'));
    expect(priceFor('openai/gpt-5.6-luna')).toEqual(priceFor('gpt-5.6-luna'));
    expect(priceFor('mystery-model')).toBeUndefined();
    expect(isUnpriced('openai', 'mystery-model', {})).toBe(true);
  });

  it('prices tokens and per-call fees by provider', () => {
    expect(
      costMicros('gemini', 'gemini-2.5-flash', {
        inputTokens: 1000,
        outputTokens: 1000,
        groundedPrompts: 1,
      }),
    ).toBe(300 + 2500 + 35_000);
    expect(costMicros('dataforseo', 'google-ai-overview', { serpRequests: 1, asyncAio: 1 })).toBe(
      4000,
    );
    expect(
      costMicros('perplexity', 'sonar-pro', { inputTokens: 0, outputTokens: 1000, requests: 1 }),
    ).toBe(15_000 + 6000);
    expect(
      costMicros('perplexity', 'openai/gpt-5.6-luna', {
        providerCostMicros: 1234,
        inputTokens: 1e6,
      }),
    ).toBe(1234);
  });
});

describe('errors and retry policy', () => {
  it('classifies statuses', () => {
    expect(kindForStatus(429)).toBe('rate_limited');
    expect(kindForStatus(429, 'insufficient_quota')).toBe('quota');
    expect(kindForStatus(400, 'Your credit balance is too low')).toBe('quota');
    expect(kindForStatus(503)).toBe('transient');
    expect(kindForStatus(404)).toBe('bad_request');
    expect(parseRetryAfter('3')).toBe(3000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6000);
  });

  it('follows 04: transient backs off up to 5 attempts, refused/bad_request are terminal', () => {
    const fixed = () => 0.5;
    expect(retryDecision('transient', 1, undefined, fixed)).toEqual({
      retry: true,
      delayMs: 5000,
      countsAsAttempt: true,
    });
    expect(retryDecision('transient', MAX_ATTEMPTS, undefined, fixed).retry).toBe(false);
    expect(retryDecision('rate_limited', 9, 20_000, fixed)).toEqual({
      retry: true,
      delayMs: 300_000,
      countsAsAttempt: false,
    });
    expect(retryDecision('rate_limited', 1, 20_000, fixed)).toEqual({
      retry: true,
      delayMs: 20_000,
      countsAsAttempt: false,
    });
    expect(retryDecision('quota', 1).countsAsAttempt).toBe(false);
    expect(retryDecision('refused', 1).retry).toBe(false);
    expect(retryDecision('bad_request', 1).retry).toBe(false);
  });
});

describe('RateLimiter', () => {
  it('caps concurrency', async () => {
    const l = new RateLimiter({ concurrency: 2 });
    let active = 0;
    let peak = 0;
    const job = () =>
      l.run(async () => {
        peak = Math.max(peak, ++active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      });
    await Promise.all(Array.from({ length: 6 }, job));
    expect(peak).toBe(2);
  });

  it('spaces requests by RPM and halves the rate on 429 (AIMD)', async () => {
    let now = 0;
    const l = new RateLimiter({ concurrency: 1, rpm: 60 }, () => now);
    await l.run(() => Promise.resolve());
    expect(l.saturated).toBe(true); // bucket empty until a second passes
    now += 1000;
    expect(l.saturated).toBe(false);
    l.onRateLimited();
    expect(l.currentRpm).toBe(30);
    l.onSuccess();
    expect(l.currentRpm).toBe(31);
  });

  it('treats a burst of 429s as one signal', () => {
    let now = 0;
    const l = new RateLimiter({ concurrency: 12, rpm: 400 }, () => now);
    for (let i = 0; i < 12; i++) l.onRateLimited();
    expect(l.currentRpm).toBe(200);
    now += RATE_DECREASE_COOLDOWN_MS;
    l.onRateLimited();
    expect(l.currentRpm).toBe(100);
  });
});

describe('locations', () => {
  it('has a DataForSEO code for every supported country', () => {
    for (const c of COUNTRY_CODES) expect(countryLocationCode(c)).toBeGreaterThan(2000);
    expect(countryLocationCode('US')).toBe(2840);
    expect(countryLocationCode('CA')).toBe(2124);
    expect(dfsLanguageCode('zh', 'TW')).toBe('zh-TW');
    expect(dfsLanguageCode('pt', 'BR')).toBe('pt-BR');
  });
});

describe('extractor', () => {
  const ok = (vendors: unknown) => ({
    status: 200,
    body: {
      id: 'resp_x',
      object: 'response',
      created_at: 1,
      status: 'completed',
      model: 'gpt-5.4-mini',
      output: [
        {
          type: 'message',
          id: 'm',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: JSON.stringify({ vendors }), annotations: [] }],
        },
      ],
      usage: {
        input_tokens: 1000,
        output_tokens: 50,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 1050,
      },
    },
  });
  const extractor = (fetch: typeof globalThis.fetch) =>
    createOpenAIExtractor({
      client: createOpenAIClient('sk', fetch),
      model: 'gpt-5.4-mini',
      backoffMs: () => 0,
    });

  it('sends the strict json_schema and dedupes vendors', async () => {
    const { fetch, requests } = replayFetch([
      ok(['Orion', ' orion ', 'Addepar', '', 'SS&C  Black Diamond']),
    ]);
    const res = await extractor(fetch).extract('Some prose', never());
    expect(res.vendors).toEqual(['Orion', 'Addepar', 'SS&C Black Diamond']);
    expect(requests[0]?.body).toMatchObject({
      model: 'gpt-5.4-mini',
      text: { format: { type: 'json_schema', name: 'vendors', strict: true } },
    });
    expect(res.costMicros).toBe(750 + 225);
  });

  it('skips the call for empty prose', async () => {
    const { fetch, requests } = replayFetch([]);
    expect((await extractor(fetch).extract('  ', never())).vendors).toEqual([]);
    expect(requests).toHaveLength(0);
  });

  it('retries twice, then throws ExtractError (extract_failed)', async () => {
    const bad = { status: 500, body: { error: { message: 'boom' } } };
    const { fetch, requests } = replayFetch([bad, ok('not-an-array'), bad]);
    await expect(extractor(fetch).extract('prose', never())).rejects.toMatchObject({
      name: 'ExtractError',
      code: 'extract_failed',
    });
    expect(requests).toHaveLength(3);
  });

  it('recovers on a retry', async () => {
    const { fetch } = replayFetch([{ status: 500, body: {} }, ok(['Orion'])]);
    expect((await extractor(fetch).extract('prose', never())).vendors).toEqual(['Orion']);
  });

  it('dedupeVendors ignores non-strings', () => {
    expect(dedupeVendors(['A', 3, null, 'a', 'B'])).toEqual(['A', 'B']);
  });
});

it('engineVersion stamps the extractor model and prompt hash', () => {
  expect(engineVersion('gpt-5.4-mini')).toBe(
    `engine@0.1.0+extract:gpt-5.4-mini:${EXTRACT_PROMPT_HASH}`,
  );
  expect(EXTRACT_PROMPT_HASH).toMatch(/^[0-9a-f]{8}$/);
});
