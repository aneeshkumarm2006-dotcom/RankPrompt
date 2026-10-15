import { describe, expect, it } from 'vitest';
import { createChatGPTAdapter } from '../src/adapters/chatgpt';
import { createAnthropicClient, createClaudeAdapter } from '../src/adapters/claude';
import { createGeminiAdapter } from '../src/adapters/gemini';
import { createGoogleAioAdapter, dfsKind } from '../src/adapters/googleAio';
import { createPerplexityAdapter } from '../src/adapters/perplexity';
import { runCheck } from '../src/check';
import { ProviderError } from '../src/errors';
import { buildMatcher } from '../src/match';
import { createOpenAIClient } from '../src/openai';
import { fixedExtractor, loadFixture, never, replayFetch } from './helpers';

const chatgpt = (fetch: typeof globalThis.fetch) =>
  createChatGPTAdapter({ client: createOpenAIClient('sk-test', fetch), model: 'gpt-5.6-luna' });
const claude = (fetch: typeof globalThis.fetch, refusalFallback = true) =>
  createClaudeAdapter({
    client: createAnthropicClient('sk-ant-test', fetch),
    model: 'claude-opus-5-5',
    effort: 'low',
    maxUses: 2,
    refusalFallback,
  });

describe('chatgpt adapter', () => {
  it('sends web_search with user_location and parses text, citations and usage', async () => {
    const f = loadFixture('chatgpt/ndex-wealth-platforms.json');
    const { fetch, requests } = replayFetch(f.http);
    const res = await chatgpt(fetch).ask({ ...f.input, city: 'Boston' }, never());
    expect(requests[0]?.url).toBe('https://api.openai.com/v1/responses');
    expect(requests[0]?.body).toEqual({
      model: 'gpt-5.6-luna',
      tools: [
        {
          type: 'web_search',
          user_location: { type: 'approximate', country: 'US', city: 'Boston' },
        },
      ],
      input: f.input.prompt,
    });
    expect(res.answer).toMatch(/^As of \*\*September 28, 2026\*\*/);
    expect(res.model).toBe('gpt-5.6-luna');
    // utm_source=openai stripped, duplicates removed, first-seen order.
    expect(res.citations[0]).toEqual({
      url: 'https://www.advyzon.com/',
      domain: 'advyzon.com',
      title: 'Home - Advyzon',
      position: 1,
    });
    expect(res.citations.every((c) => !c.url.includes('utm_source'))).toBe(true);
    expect(new Set(res.citations.map((c) => c.url)).size).toBe(res.citations.length);
    expect(res.usage).toEqual({
      inputTokens: 12000,
      cachedInputTokens: 2000,
      outputTokens: 1500,
      reasoningTokens: 400,
      webSearches: 2,
    });
    // 10,000 × $0.20 + 2,000 × $0.02 + 1,500 × $1.20 per M, + 2 searches × $0.01
    expect(res.costMicros).toBe(2000 + 40 + 1800 + 20_000);
  });

  it('maps HTTP errors to ProviderError kinds', async () => {
    const cases: [number, unknown, string, Record<string, string>?][] = [
      [
        429,
        { error: { message: 'Rate limit reached', code: 'rate_limit_exceeded' } },
        'rate_limited',
        { 'retry-after': '7' },
      ],
      [
        429,
        { error: { message: 'You exceeded your current quota', code: 'insufficient_quota' } },
        'quota',
      ],
      [500, { error: { message: 'boom' } }, 'transient'],
      [400, { error: { message: 'bad tool' } }, 'bad_request'],
    ];
    for (const [status, body, kind, headers] of cases) {
      const { fetch } = replayFetch([{ status, body, ...(headers ? { headers } : {}) }]);
      const err = await chatgpt(fetch)
        .ask({ prompt: 'x', country: 'US', language: 'en' }, never())
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ProviderError);
      expect((err as ProviderError).kind).toBe(kind);
      if (headers) expect((err as ProviderError).retryAfterMs).toBe(7000);
    }
  });
});

describe('perplexity adapter', () => {
  it('calls the Agent API and keeps only [web:n]-referenced sources (case 3)', async () => {
    const f = loadFixture('perplexity/ndex-agent.json');
    const { fetch, requests } = replayFetch(f.http);
    const res = await createPerplexityAdapter({ apiKey: 'pplx', preset: 'fast', fetch }).ask(
      f.input,
      never(),
    );
    expect(requests[0]?.url).toBe('https://api.perplexity.ai/v1/agent');
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer pplx');
    expect(requests[0]?.body).toMatchObject({
      preset: 'fast',
      input: f.input.prompt,
      tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'US' } }],
    });
    const used = f.meta.usedMarkers as number[];
    expect(res.citations).toHaveLength(used.length);
    expect(res.citations.some((c) => c.url.includes('unused-source'))).toBe(false);
    expect(res.answer).toContain('[web:7]'); // markers stay in the stored answer
    expect(res.model).toBe('openai/gpt-5.6-luna');
    expect(res.costMicros).toBe(4308); // provider-reported usage.cost wins
  });

  it('still parses the legacy Sonar shape with positional [n] markers', async () => {
    const f = loadFixture('perplexity/ndex-sonar-legacy.json');
    const { fetch } = replayFetch(f.http);
    const res = await createPerplexityAdapter({ apiKey: 'pplx', preset: 'fast', fetch }).ask(
      f.input,
      never(),
    );
    const used = f.meta.usedMarkers as number[];
    expect(res.citations).toHaveLength(used.length);
    expect(res.citations.some((c) => c.url.includes('unused-source'))).toBe(false);
    // First-seen marker order: the answer cites [7] first.
    expect(res.citations[0]?.url).toBe(
      'https://www.layer3labs.io/comparisons/best-crm-for-financial-advisors',
    );
    expect(res.model).toBe('sonar-pro');
    expect(res.costMicros).toBe(15_200);
  });

  it('turns 429 into rate_limited', async () => {
    const { fetch } = replayFetch([
      { status: 429, body: { error: { message: 'request_rate_limit_exceeded' } } },
    ]);
    const err = (await createPerplexityAdapter({ apiKey: 'p', preset: 'fast', fetch })
      .ask({ prompt: 'x', country: 'US', language: 'en' }, never())
      .catch((e: unknown) => e)) as ProviderError;
    expect(err.kind).toBe('rate_limited');
  });
});

describe('gemini adapter', () => {
  it('puts the location in the system instruction and takes domains from titles (case 4)', async () => {
    const f = loadFixture('gemini/redirect-titles.json');
    const { fetch, requests } = replayFetch(f.http);
    const resolved: string[] = [];
    const adapter = createGeminiAdapter({
      apiKey: 'g',
      model: 'gemini-2.5-flash',
      fetch,
      resolveRedirect: (url) => {
        resolved.push(url);
        return Promise.resolve(f.redirects?.[url] ?? null);
      },
    });
    const res = await adapter.ask(f.input, never());
    expect(requests[0]?.url).toContain('/models/gemini-2.5-flash:generateContent');
    expect(requests[0]?.headers.get('x-goog-api-key')).toBe('g');
    expect(requests[0]?.body).toMatchObject({
      systemInstruction: { parts: [{ text: 'The user is located in Canada.' }] },
      tools: [{ google_search: {} }],
    });
    expect(res.answer).toContain('Canadim also publishes');
    expect(res.citations.map((c) => c.domain)).toEqual([
      'canadim.com',
      'visaplace.com',
      'college-ic.ca',
    ]);
    expect(resolved).toHaveLength(1); // only the non-domain title needed a HEAD
    expect(res.citations[2]?.url).toBe(
      'https://college-ic.ca/protecting-the-public/find-an-immigration-consultant',
    );
    expect(res.usage).toMatchObject({
      inputTokens: 922,
      outputTokens: 600,
      groundedPrompts: 1,
      webSearches: 1,
    });

    const brand = buildMatcher({ name: 'Canadim', domain: 'canadim.com' });
    const check = await runCheck({
      adapter: createGeminiAdapter({
        apiKey: 'g',
        model: 'gemini-2.5-flash',
        fetch: replayFetch(f.http).fetch,
        resolveRedirect: null,
      }),
      extractor: fixedExtractor([
        'Visa Place',
        'Matthew Jeffery Immigration Law',
        'Bellissimo Law Group',
      ]),
      input: f.input,
      brand,
      competitors: [],
      signal: never(),
    });
    expect(check.match.brand).toMatchObject({ mentioned: true, rank: null, cited: true });
  });

  it('a safety block is a refusal', async () => {
    const f = loadFixture('gemini/safety-block.json');
    const err = (await createGeminiAdapter({
      apiKey: 'g',
      model: 'gemini-2.5-flash',
      fetch: replayFetch(f.http).fetch,
      resolveRedirect: null,
    })
      .ask(f.input, never())
      .catch((e: unknown) => e)) as ProviderError;
    expect(err.kind).toBe('refused');
  });
});

describe('claude adapter (case 6)', () => {
  it('continues after pause_turn by resending the assistant content, and keeps all citations', async () => {
    const f = loadFixture('claude/pause-turn.json');
    const { fetch, requests } = replayFetch(f.http);
    const res = await claude(fetch).ask(f.input, never());
    expect(requests).toHaveLength(2);
    const first = requests[0]?.body as Record<string, unknown>;
    expect(requests[0]?.url).toContain('/v1/messages');
    expect(requests[0]?.headers.get('anthropic-beta')).toBe('server-side-fallback-2026-07-01');
    expect(first).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low' },
      fallbacks: 'default',
      tools: [
        {
          type: 'web_search_20260209',
          name: 'web_search',
          max_uses: 2,
          user_location: { type: 'approximate', country: 'CA' },
        },
      ],
    });
    expect(first).not.toHaveProperty('tool_choice');
    expect(first).not.toHaveProperty('thinking');
    const second = requests[1]?.body as { messages: { role: string; content: unknown }[] };
    expect(second.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect((second.messages[1]?.content as unknown[]).length).toBe(4); // the paused turn, unchanged

    expect(res.answer).toBe(
      'Here are well-regarded options in Toronto. 1. **Canadim** is a Montreal-based firm with a large Express Entry practice.\n2. **VisaPlace** is a Toronto immigration law firm.\n\nAlways confirm a consultant is licensed with the College.',
    );
    // Cited first, then the remaining search results; deduped.
    expect(res.citations.map((c) => c.url)).toEqual([
      'https://www.canadim.com/immigrate/express-entry/',
      'https://www.visaplace.com/',
      'https://college-ic.ca/',
    ]);
    expect(res.usage).toMatchObject({
      inputTokens: 7200,
      cachedInputTokens: 1500,
      outputTokens: 500,
      webSearches: 2,
      continuations: 1,
    });
    // (5700 × $4 + 1500 × $0.20 + 500 × $20) / 1M + 2 × $0.01
    expect(res.costMicros).toBe(22_800 + 300 + 10_000 + 20_000);
    expect(res.model).toBe('claude-opus-5-5');
  });

  it('a web search error block with an answer is a normal answer', async () => {
    const f = loadFixture('claude/search-error.json');
    const res = await claude(replayFetch(f.http).fetch, false).ask(f.input, never());
    expect(res.answer).toMatch(/^I could not search the web/);
    expect(res.citations).toEqual([]);
    expect(res.usage.searchErrors).toBe(1);
  });

  it('a web search error and no text is transient', async () => {
    const f = loadFixture('claude/search-error.json');
    const body = structuredClone(f.http[0]?.body) as { content: { type: string }[] };
    body.content = body.content.filter((b) => b.type !== 'text');
    const err = (await claude(replayFetch([{ status: 200, body }]).fetch)
      .ask(f.input, never())
      .catch((e: unknown) => e)) as ProviderError;
    expect(err.kind).toBe('transient');
    expect(err.message).toContain('too_many_requests');
  });

  it('a refusal throws refused with the category', async () => {
    const f = loadFixture('claude/refusal.json');
    const err = (await claude(replayFetch(f.http).fetch)
      .ask(f.input, never())
      .catch((e: unknown) => e)) as ProviderError;
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.kind).toBe('refused');
    expect(err.message).toContain('cyber');
  });

  it('maps 529 overloaded to transient and 429 to rate_limited', async () => {
    for (const [status, kind] of [
      [529, 'transient'],
      [429, 'rate_limited'],
    ] as const) {
      const { fetch } = replayFetch([
        { status, body: { type: 'error', error: { type: 'overloaded_error', message: 'x' } } },
      ]);
      const err = (await claude(fetch)
        .ask({ prompt: 'x', country: 'US', language: 'en' }, never())
        .catch((e: unknown) => e)) as ProviderError;
      expect(err.kind).toBe(kind);
    }
  });
});

describe('google_aio adapter', () => {
  const aio = (fetch: typeof globalThis.fetch, loadAsyncAio = false) =>
    createGoogleAioAdapter({ login: 'l', password: 'p', loadAsyncAio, fetch });

  it('an unloaded async overview stub is noAnswer and flagged (live response, Q-002)', async () => {
    const f = loadFixture('google_aio/live-async-stub.json');
    const { fetch, requests } = replayFetch(f.http);
    const res = await aio(fetch).ask(f.input, never());
    expect(requests[0]?.url).toBe(
      'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
    );
    expect(requests[0]?.headers.get('authorization')).toBe(
      `Basic ${Buffer.from('l:p').toString('base64')}`,
    );
    expect(requests[0]?.body).toEqual([
      {
        keyword: f.input.prompt,
        location_code: 2840,
        language_code: 'en',
        device: 'desktop',
        load_async_ai_overview: false,
      },
    ]);
    expect(res).toMatchObject({ noAnswer: true, answer: '', citations: [] });
    expect(res.usage).toMatchObject({ serpRequests: 1, aioNotLoaded: 1 });
    expect(res.costMicros).toBe(2000);
  });

  it('no ai_overview item is noAnswer, not a failure (case 5)', async () => {
    const f = loadFixture('google_aio/no-overview.json');
    const res = await aio(replayFetch(f.http).fetch).ask(f.input, never());
    expect(res.noAnswer).toBe(true);
    expect(res.usage.aioNotLoaded).toBeUndefined();
  });

  it('a loaded overview gives the answer and its references', async () => {
    const f = loadFixture('google_aio/with-overview.json');
    const res = await aio(replayFetch(f.http).fetch, true).ask(f.input, never());
    expect(res.noAnswer).toBeUndefined();
    expect(res.answer).toMatch(/^The best wealth management software/);
    expect(res.citations.map((c) => c.domain)).toEqual([
      'masttro.com',
      'sscblackdiamond.com',
      'addepar.com',
      'kitces.com',
    ]);
    expect(res.costMicros).toBe(4000);
  });

  it('noAnswer skips the extractor and scores nothing', async () => {
    const f = loadFixture('google_aio/live-async-stub.json');
    let called = false;
    const check = await runCheck({
      adapter: aio(replayFetch(f.http).fetch),
      extractor: {
        ...fixedExtractor([]),
        extract: (prose) => (
          (called = prose !== ''),
          Promise.resolve({ vendors: [], model: 'x', usage: {}, costMicros: 0, raw: null })
        ),
      },
      input: f.input,
      brand: buildMatcher({ name: 'Addepar', domain: 'addepar.com' }),
      competitors: [],
      signal: never(),
    });
    expect(check.status).toBe('no_answer');
    expect(called).toBe(false);
    expect(check.match.brand).toMatchObject({ mentioned: false, cited: false, rank: null });
  });

  it('maps DataForSEO status codes', async () => {
    expect(dfsKind(40200)).toBe('quota');
    expect(dfsKind(40202)).toBe('rate_limited');
    expect(dfsKind(50000)).toBe('transient');
    expect(dfsKind(40501)).toBe('bad_request');
    const body = {
      status_code: 20000,
      tasks: [{ status_code: 40102, status_message: 'No Search Results.', cost: 0.002 }],
    };
    const res = await aio(replayFetch([{ status: 200, body }]).fetch).ask(
      { prompt: 'x', country: 'GB', language: 'en' },
      never(),
    );
    expect(res.noAnswer).toBe(true);
  });

  it('resolves a city through the cached locations list, else uses the country code', async () => {
    const locations = {
      tasks: [
        {
          result: [
            {
              location_code: 1002451,
              location_name: 'Toronto,Ontario,Canada',
              location_type: 'City',
            },
          ],
        },
      ],
    };
    const serp = loadFixture('google_aio/no-overview.json').http[0] as {
      status: number;
      body: unknown;
    };
    const { fetch, requests } = replayFetch([{ status: 200, body: locations }, serp, serp]);
    const adapter = aio(fetch);
    await adapter.ask({ prompt: 'a', country: 'CA', city: 'Toronto', language: 'fr' }, never());
    await adapter.ask({ prompt: 'b', country: 'CA', city: 'toronto', language: 'fr' }, never());
    expect(requests.map((r) => r.url.split('/v3/')[1])).toEqual([
      'serp/google/locations/ca',
      'serp/google/organic/live/advanced',
      'serp/google/organic/live/advanced',
    ]);
    expect(requests[1]?.body).toMatchObject([{ location_code: 1002451, language_code: 'fr' }]);
  });
});
