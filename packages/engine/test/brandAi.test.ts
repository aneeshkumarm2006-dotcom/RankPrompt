import { describe, expect, it } from 'vitest';
import {
  cleanAnalysis,
  cleanDrafts,
  createFakeBrandAI,
  createOpenAIBrandAI,
  locationPhrase,
  promptInstructions,
  type PromptDraftInput,
} from '../src/brandAi';
import { ProviderError } from '../src/errors';
import { createOpenAIClient } from '../src/openai';
import { replayFetch } from './helpers';

const input: PromptDraftInput = {
  brand: {
    name: 'Canadim',
    domain: 'canadim.com',
    summary: 'Immigration law firm.',
    aliases: ['Canadim Law'],
  },
  categories: [
    { name: 'Immigration Consulting', description: 'Visas and PR' },
    { name: 'Study Permits' },
  ],
  count: 3,
  scope: 'national',
  country: 'CA',
  city: null,
  language: 'en',
};

const response = (json: unknown, extra: Record<string, unknown> = {}) => ({
  id: 'resp_1',
  object: 'response',
  created_at: 0,
  status: 'completed',
  model: 'gpt-5.4-mini-2026-03-01',
  output: [
    ...((extra.searches as unknown[]) ?? []),
    {
      type: 'message',
      id: 'msg_1',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: JSON.stringify(json), annotations: [] }],
    },
  ],
  usage: {
    input_tokens: 1000,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens: 200,
    output_tokens_details: { reasoning_tokens: 0 },
    total_tokens: 1200,
  },
});

describe('locationPhrase (fixes the v1 city bug)', () => {
  it('uses "city, country" for a local scope and the country otherwise', () => {
    expect(locationPhrase({ scope: 'local', country: 'CA', city: 'Toronto' })).toBe(
      'Toronto, Canada',
    );
    expect(locationPhrase({ scope: 'national', country: 'CA', city: 'Toronto' })).toBe('Canada');
    expect(locationPhrase({ scope: 'local', country: 'US', city: null })).toBe('United States');
  });

  it('puts the location, language and the no-brand rule in the instructions', () => {
    const text = promptInstructions({ ...input, scope: 'local', city: 'Montreal', language: 'fr' });
    expect(text).toContain('Montreal, Canada');
    expect(text).toContain('French');
    expect(text).toContain('Never mention "Canadim"');
    expect(text).toContain('- Immigration Consulting: Visas and PR');
  });
});

describe('cleanDrafts', () => {
  it('drops branded, duplicate, numbered and empty drafts, maps categories and caps the count', () => {
    const drafts = cleanDrafts(
      [
        { text: '1. Best immigration lawyers in Canada?', category: 'immigration consulting' },
        { text: 'Is Canadim any good?', category: 'Study Permits' },
        { text: 'What does canadim.com charge?', category: 'Study Permits' },
        { text: 'Reviews of Canadim Law', category: 'Study Permits' },
        { text: 'best immigration lawyers in canada?', category: 'Study Permits' },
        { text: '"How do I get a study permit?"', category: 'Unknown Category' },
        { text: '  ', category: 'Study Permits' },
        { text: 'Cheapest PR pathway?', category: 'Study Permits' },
        { text: 'One too many?', category: 'Study Permits' },
      ],
      input,
    );
    expect(drafts).toEqual([
      { text: 'Best immigration lawyers in Canada?', category: 'Immigration Consulting' },
      { text: 'How do I get a study permit?', category: 'Immigration Consulting' },
      { text: 'Cheapest PR pathway?', category: 'Study Permits' },
    ]);
  });
});

describe('cleanAnalysis', () => {
  it('keeps at most 10 unique categories and drops the name from the aliases', () => {
    const out = cleanAnalysis(
      {
        summary: '  A firm.  ',
        categories: [
          ...Array.from({ length: 12 }, (_, i) => ({ name: `Cat ${i}`, description: 'd' })),
          { name: 'cat 0', description: 'dup' },
        ],
        aliases: ['Canadim', 'Canadim Law', ' canadim law ', ''],
      },
      'Canadim',
    );
    expect(out.summary).toBe('A firm.');
    expect(out.categories).toHaveLength(10);
    expect(out.aliases).toEqual(['Canadim Law']);
  });
});

describe('createOpenAIBrandAI', () => {
  it('analyzes with web_search and a strict schema, and prices the call', async () => {
    const replay = replayFetch([
      {
        status: 200,
        body: response(
          {
            summary: 'Canadim is an immigration law firm.',
            categories: [{ name: 'Immigration Consulting', description: 'Visas' }],
            aliases: ['Canadim Law'],
          },
          { searches: [{ type: 'web_search_call', id: 'ws_1', status: 'completed' }] },
        ),
      },
    ]);
    const ai = createOpenAIBrandAI({
      client: createOpenAIClient('sk-test', replay.fetch),
      model: 'gpt-5.4-mini',
    });
    const out = await ai.analyze(
      { name: 'Canadim', websiteUrl: 'https://canadim.com', domain: 'canadim.com' },
      new AbortController().signal,
    );
    expect(out).toMatchObject({
      summary: 'Canadim is an immigration law firm.',
      categories: [{ name: 'Immigration Consulting', description: 'Visas' }],
      aliases: ['Canadim Law'],
    });
    expect(out.costMicros).toBeGreaterThan(10_000); // includes the $0.01 web search

    const sent = replay.requests[0]?.body as {
      tools: { type: string }[];
      text: { format: { type: string; strict: boolean } };
    };
    expect(sent.tools).toEqual([{ type: 'web_search' }]);
    expect(sent.text.format).toMatchObject({ type: 'json_schema', strict: true });
  });

  it('generates drafts without web search and cleans them', async () => {
    const replay = replayFetch([
      {
        status: 200,
        body: response({
          prompts: [
            { text: 'Best immigration consultants in Canada?', category: 'Immigration Consulting' },
            { text: 'Is Canadim legit?', category: 'Immigration Consulting' },
          ],
        }),
      },
    ]);
    const ai = createOpenAIBrandAI({
      client: createOpenAIClient('sk-test', replay.fetch),
      model: 'gpt-5.4-mini',
    });
    const out = await ai.generatePrompts(input, new AbortController().signal);
    expect(out.drafts).toEqual([
      { text: 'Best immigration consultants in Canada?', category: 'Immigration Consulting' },
    ]);
    expect((replay.requests[0]?.body as { tools?: unknown }).tools).toBeUndefined();
  });

  it('maps provider failures to ProviderError', async () => {
    const replay = replayFetch([{ status: 429, body: { error: { message: 'slow down' } } }]);
    const ai = createOpenAIBrandAI({
      client: createOpenAIClient('sk-test', replay.fetch),
      model: 'gpt-5.4-mini',
    });
    await expect(ai.generatePrompts(input, new AbortController().signal)).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});

describe('createFakeBrandAI', () => {
  it('is deterministic and honours the count', async () => {
    const ai = createFakeBrandAI();
    const a = await ai.generatePrompts({ ...input, count: 7 }, new AbortController().signal);
    const b = await ai.generatePrompts({ ...input, count: 7 }, new AbortController().signal);
    expect(a.drafts).toHaveLength(7);
    expect(a).toEqual(b);
  });
});
