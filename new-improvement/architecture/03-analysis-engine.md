# 03: Analysis engine (`packages/engine`)

This package is pure TypeScript. It doesn't touch Mongo or Express. Its inputs are a prompt, a location and a brand matcher; its output is a scored check. The worker calls it, and the CLI calls it directly. The proven code that this is based on is in [reference/luna-prototype.md](../reference/luna-prototype.md).

## Pipeline for one check

```
ask(adapter) ──► AnswerRaw {answer, citations[], model, usage, latencyMs, raw, noAnswer?}
   │
   ├─ clean(answer) ──► prose (inline citations, markdown links and bare URLs stripped)
   ├─ extract(prose) ──► vendors[] (ordered; shared extractor for every platform)
   └─ match(prose, vendors, citations, brandMatcher, competitorMatchers[])
          ──► { brand:{mentioned, rank, cited, citedUrl, snippet}, competitors:[…], suggested:[…] }
```

`engineVersion` = `engine@<semver>+extract:<model>:<promptHash>`. It is stamped on every run.

## Adapter interface

```ts
export interface AskInput { prompt: string; country: string /*ISO2*/; city?: string; language: string }
export interface Citation { url: string; domain: string; title?: string; position: number }
export interface AnswerRaw {
  answer: string;            // markdown/plain text as returned
  citations: Citation[];     // cleaned + deduped, in first-seen order
  model: string;             // model that actually answered (fallbacks!)
  usage: Record<string, number>;  // provider token/search counts for cost calc
  costMicros: number;        // computed by cost.ts from usage + price table
  latencyMs: number;
  raw: unknown;              // provider response (stored 30 days)
  noAnswer?: boolean;        // e.g. no AI Overview shown
}
export interface PlatformAdapter {
  platform: Platform;
  providerKey: 'openai'|'perplexity'|'gemini'|'anthropic'|'dataforseo';
  ask(input: AskInput, signal: AbortSignal): Promise<AnswerRaw>;
}
```

**Errors.** Adapters throw `ProviderError { kind, status?, retryAfterMs?, message }` with one of these kinds:
- `rate_limited` (429)
- `transient` (5xx, network, timeout)
- `refused` (the model declined)
- `bad_request` (any other 4xx)
- `quota` (billing or quota exhausted)

The queue's retry policy is based on `kind` (see 04).

**Timeouts.** Each adapter call has a hard timeout of 120 s through `AbortSignal`. The only exception is Claude's `pause_turn` loop, which gets a 180 s budget in total.

## Platform adapters

All model names come from env. The defaults are listed below.

### ChatGPT (`chatgpt`, OpenAI Responses API)
```ts
POST https://api.openai.com/v1/responses  (via the openai SDK: client.responses.create)
{ model: env.OPENAI_ANSWER_MODEL /* 'gpt-5.6-luna' */,
  tools: [{ type: 'web_search', user_location: { type: 'approximate', country, ...(city && { city }) } }],
  input: prompt }
```
- **Answer text:** `output_text`, or failing that, the joined `output_text` parts of `message` items.
- **Citations:** take the `annotations` of type `url_citation` and keep `{url, title}`.
  - Strip the `utm_source=openai` query parameter.
  - Dedupe by normalised URL.
- **Language:** the luna runs passed only the raw prompt. When the run's language isn't English, prepend nothing, because prompts are generated in that language already.

### Perplexity (`perplexity`, Agent API, D-020)
Sonar Chat Completions ended on 2026-09-27. The adapter calls the Agent API, whose `fast` preset is Perplexity's replacement for Sonar Pro.
```ts
POST https://api.perplexity.ai/v1/agent
{ preset: env.PERPLEXITY_PRESET /* 'fast' */,
  input: prompt,
  tools: [{ type: 'web_search', user_location: { type: 'approximate', country, ...(city && { city }) } }] }
```
- **Answer:** the `output_text` parts of the `message` item in `output[]`.
- **Citations:** the `results` of the `search_results` items, each with a numeric `id`.
  - Keep only the sources whose `[web:<id>]` marker appears in the answer.
  - If the answer has no markers, keep them all.
- **Cost:** `usage.cost.total_cost`, when the response includes it.
- **Legacy shape:** `parsePerplexity` still reads Sonar bodies (`choices[0].message.content`, `search_results` or `citations`, positional `[n]` markers), so old raw answers stay readable.
- **Rate limit:** per-minute (see 04). The Agent API allows about 1 request/s at tier 0, and parallel bursts caused 429s in the luna runs.

### Gemini (`gemini`, Google Search grounding)
```ts
POST https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent   (or @google/genai)
{ systemInstruction: { parts: [{ text: `The user is located in ${countryName}${city ? `, ${city}` : ''}.` }] },
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  tools: [{ google_search: {} }] }
```
- **Answer:** join the `text` of `candidates[0].content.parts`.
- **Citations:** `candidates[0].groundingMetadata.groundingChunks[].web` gives `{uri, title}`.
  - The `uri` is a Google redirect URL. The `title` holds the source domain.
  - Set `domain` from the title when it parses as a domain. Otherwise resolve the domain from the redirect target, which is optional and done in a cached HEAD request.
- **Location:** the API has no location parameter, so the location goes in the system instruction.
- **Quota:** the free key is capped at 20 requests a day, so production needs a paid key.

### Claude (`claude`, Anthropic Messages API + server web search)
```ts
import Anthropic from '@anthropic-ai/sdk';
const params = {
  model: env.CLAUDE_MODEL /* 'claude-opus-5-5' */,
  max_tokens: 16000,
  output_config: { effort: env.CLAUDE_EFFORT /* 'low' — set explicitly; Opus 5.5 default is 'medium' */ },
  tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: env.CLAUDE_WEB_SEARCH_MAX_USES /* 2 */,
            user_location: { type: 'approximate', country, ...(city && { city }) } }],
  messages: [{ role: 'user', content: prompt }],
};
// loop: resend while stop_reason === 'pause_turn' (append assistant content), max 5 continuations
```
- **Opus 5.5 constraints:**
  - Thinking can't be disabled. Control cost with `effort`.
  - Do **not** send `tool_choice: {type:'any'|'tool'}`; it returns a 400.
  - Prefill isn't supported.
- **`stop_reason`:**
  - `'refusal'` throws `ProviderError{kind:'refused'}`. The check fails and is refunded.
  - `'max_tokens'` means the answer was truncated: keep it, and set `usage.truncated=1`.
- **Answer:** join the `text` blocks.
- **Citations:**
  - The `citations[]` on text blocks, of type `web_search_result_location`, carrying `{url, title, cited_text}`.
  - Plus the URLs in `web_search_tool_result.content[]`. Order: cited first, then the rest.
- **Search errors:** a web-search error comes back as HTTP 200, with a `web_search_tool_result` whose `content` is an error object instead of a list. Check for this before indexing. If the model still produced an answer, treat it as normal. Otherwise treat it as `transient`.
- **Refusal fallbacks (optional):** the server-side refusal fallback (`fallbacks: "default"` with beta `server-side-fallback-2026-07-01`) can be enabled. If it is, record the model that actually answered (`model` from the response).
- **Cost:** tokens at Opus 5.5 rates, plus web search per search. Search results count as input tokens. **Measure this in P2** (Q-001). It is expected to be the most expensive check.

### Google AI Overviews (`google_aio`, DataForSEO SERP)
```ts
POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced   (Basic auth: login:password)
[{ keyword: prompt, location_code: countryToDfsLocation(country /*, city*/), language_code, device: 'desktop',
   load_async_ai_overview: env.DATAFORSEO_LOAD_ASYNC_AIO /* Q-002 */ }]
```
- **Answer:** find the item in `tasks[0].result[0].items` with `type === 'ai_overview'`. Its text (markdown or the concatenated element texts) is the answer, and its `references[]` become the citations.
- **No overview:** if the item is missing, return `noAnswer: true` with empty text. That is **not** a failure (see 05).
- **To do in P2:** confirm the exact field names against a live response and save it as a fixture. Map ISO2 country (and city, if supported) to DataForSEO `location_code` using a cached `serp/google/locations` lookup.
- **Cost:** per SERP request, plus extra for async AI Overview loading.

## Cleaning (`clean.ts`)

These rules were proven in the Canadim run (`proseOf`):
1. Remove inline citation groups ` ([text](url))`.
2. Remove markdown links whose text is a bare domain. Replace other markdown links with their text.
3. Remove bare URLs.
4. For Perplexity, keep the `[n]` markers in the stored answer but remove them from the prose.

All brand-mention checks run on the **prose**, never on the raw answer. In v1 (the NDEX run), brands whose name is part of their own domain got false mentions because of this.

## Extraction (`extract.ts`)

There is one extractor for every platform, so results stay comparable (D-010).
```ts
client.responses.create({
  model: env.OPENAI_EXTRACT_MODEL /* 'gpt-5.4-mini' */,
  input: `List every distinct company, product or service provider that the answer below recommends or names as an option for the user, in the order they are first presented (first = top recommendation). Use the company's common name. Exclude: generic descriptions, government bodies, regulators, laws/programs, courts, media outlets, universities, and sources that are only cited. Answer:\n\n${prose}`,
  text: { format: { type: 'json_schema', name: 'vendors', strict: true,
    schema: { type: 'object', additionalProperties: false,
              properties: { vendors: { type: 'array', items: { type: 'string' } } }, required: ['vendors'] } } },
});
```
- **Empty prose** (`noAnswer`) means the extractor is skipped and `vendors = []`.
- **Retries:** extraction is retried twice. If it still fails, the check is `failed` (code `extract_failed`) and refunded. The raw answer is still kept.
- **Dedupe:** case-insensitive. Canonical-name merging is a later improvement, behind a per-brand alias list.

## Matching (`match.ts`)

```ts
// No `-` in the class: `\-` outside a class is a syntax error with the `u` flag (D-021).
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const hasAlias = (text: string, aliases: string[]) =>
  aliases.some(a => new RegExp(`(^|[^\\p{L}\\p{N}])${esc(a.toLowerCase())}([^\\p{L}\\p{N}]|$)`, 'u').test(text.toLowerCase()));
rank      = vendors.findIndex(v => hasAlias(v, aliases)) + 1 || null
mentioned = hasAlias(prose, aliases) || rank !== null
cited     = citations.some(c => sameSite(c.domain, brand.domain))   // tldts: registrable domain equal, or subdomain
citedUrl  = first such citation url
snippet   = first sentence of prose containing an alias (≤ 600 chars)
```
- **Competitors:** use the same functions, run for each tracked competitor.
- **Suggested competitors:** vendors that match neither the brand nor any tracked competitor.
- **Aliases:**
  - Always include the brand name.
  - Users can add variants.
  - Brand analysis proposes some, such as "SS&C Black Diamond" for "Black Diamond".
  - Aliases shorter than 3 characters are rejected, to avoid false matches.

## Cost tracking (`cost.ts`)

- **Price table:** `prices.ts`, versioned, holding per-model input/output token prices and per-search or per-request fees.
- **Each check stores** `costMicros = answerCost + extractCost`. Runs sum these.
- **Provider spend cap:** the daily spend per provider is tracked in `provider_spend` (date and provider). Once it passes `PROVIDER_DAILY_CAP_USD_<P>`, the worker stops claiming that provider's jobs and alerts. Jobs wait; they don't fail.

## CLI (`pnpm engine …`)

This replaces the throwaway luna scripts.
```
pnpm engine ask   --platform claude --country US "best wealth management software"
pnpm engine run   --brand "NDEX Systems" --domain ndexsystems.com --aliases "NDEX" \
                  --competitors competitors.json --prompts prompts.csv --platforms chatgpt,perplexity \
                  --country US --concurrency 6 --out ./out/ndex-us
pnpm engine export --in ./out/ndex-us --xlsx "Downloads/<Client>/ChatGPT Rankings/01 - NDEX (US).xlsx"
```
- **Resumable:** results are written after each check, and a re-run skips checks that are already done.
- **No DB access:** it doesn't write to the DB. Loading results into the app goes through an admin import script that the user runs, because production DB writes are user-run.

## Test fixtures (P2)

Record real responses into `packages/engine/test/fixtures/<platform>/*.json` and assert on the matcher output. Required cases:
1. A brand whose name is part of its domain (`orion.com`, `canadim.com`), with inline citations. It must not get a false mention.
2. Markdown link text equal to a domain.
3. Perplexity `[n]` markers, where some sources are unused.
4. Gemini redirect URIs whose titles are domains.
5. A query with no AI Overview, giving `noAnswer`.
6. Claude `pause_turn` continuation, a web-search error block, and a refusal.
7. Unicode brand names and aliases with punctuation (`SS&C`).
8. An empty vendor list, and a brand present in the text but not in the vendors (mentioned, rank null).

Fixture format, provenance and how to re-record: [`packages/engine/test/fixtures/README.md`](../../packages/engine/test/fixtures/README.md). Ready-made inputs: the stored v1/luna report JSONs in `C:\Users\anees\Desktop\NDEX Systems\*\raw-json\` and `C:\Users\anees\Downloads\Canadim\ChatGPT Rankings\raw-json\`.
