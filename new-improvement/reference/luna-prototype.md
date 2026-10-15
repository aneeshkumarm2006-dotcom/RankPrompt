# Luna prototype: the proven in-house pipeline

Before v2, AI-visibility projects for clients were run with standalone Node scripts, outside the app and without n8n. They worked at real scale:
- **NDEX Systems** (2026-09-28): 9 projects, 324 prompts. ChatGPT and Perplexity, plus a partial Gemini run.
- **Canadim** (2026-10-05): ChatGPT, US and CA.

`packages/engine` is a hardened, typed version of this code. The snippets below come verbatim from the session transcripts. The scratchpad copies were deleted.

**Sources** (JSONL line numbers, under `C:\Users\anees\.claude\projects\D--Completed-Sites---Davnoot-RankPrompt\`):
- `1afe5851-6361-43bc-aa37-417dae87c89c.jsonl` (NDEX):
  - 256/401: `run.mjs`
  - 417: `save.mjs`
  - 490: `export.mjs`
  - 576: Perplexity
  - 760/777: Gemini
  - 661: resume and `CONC`
- `d0610fa4-8b4f-45e6-8ca6-453cd25d92e3.jsonl` (Canadim):
  - 217: Semrush CSV to prompts
  - 235: `run.mjs` with `proseOf`
  - 304: `firms.mjs`
  - 312/378: `build.mjs`
  - 314: `save.mjs`
  - 336: `reextract.mjs`
  - 392: `export.mjs`

**Real stored outputs, usable as fixtures:**
- `C:\Users\anees\Desktop\NDEX Systems\{ChatGPT,Perplexity} Rankings\raw-json\*.json`
- `C:\Users\anees\Downloads\Canadim\ChatGPT Rankings\raw-json\*.json`

No n8n workflow export was found anywhere on the machine. The n8n logic is only visible through what v1 sends to it and gets back from it.

## OpenAI Responses (ChatGPT check)
```js
const MODEL = 'gpt-5.6-luna';
const EXTRACT_MODEL = 'gpt-5.4-mini';

async function openai(body, tries = 6) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (r.ok) return j;
      if (i >= tries) throw new Error(`${r.status} ${j.error?.message}`);
    } catch (e) {
      if (i >= tries) throw e;
    }
    await new Promise(res => setTimeout(res, 5000 * i));
  }
}
const j = await openai({ model: MODEL, tools: [{ type: 'web_search', user_location: { type: 'approximate', country } }], input: prompt });

const textOf = j => j.output_text ?? j.output.filter(o => o.type === 'message').flatMap(o => o.content)
  .filter(c => c.type === 'output_text').map(c => c.text).join('\n');
const citationsOf = j => j.output.filter(o => o.type === 'message').flatMap(o => o.content)
  .flatMap(c => c.annotations || []).filter(a => a.type === 'url_citation').map(a => ({ url: a.url, title: a.title }));
```
- **Request:** no system prompt and no reasoning parameters. `country` was `'US'` or `'CA'` and no city was ever set.
- **Response output items:** `reasoning`, `web_search_call`, `message`.
- **Citation cleanup:** URLs carry `?utm_source=openai`. Strip it with `u.replace(/[?&]utm_source=openai$/, '')`, then dedupe. The prototype didn't dedupe.

## Extraction (vendor list)
```js
input: `List every distinct software vendor/product company recommended or named in the answer below, in the order they are first presented as options (first = top recommendation). Use the company name (e.g. "Orion", "Addepar"). Exclude custodians/banks unless recommended as a software option. Answer:\n\n${answer}`,
text: { format: { type: 'json_schema', name: 'vendors', strict: true, schema: {
  type: 'object', additionalProperties: false,
  properties: { vendors: { type: 'array', items: { type: 'string' } } }, required: ['vendors'] } } },
```
- **Canadim used a domain-specific prompt.** Re-extraction (`reextract.mjs`) excluded:
  - generic descriptions
  - government bodies, regulators, programs and laws
  - courts, media, universities and employers
- **Safety-net regex:** `NOT_A_FIRM = /^(ircc|cbsa|uscis|...|law society|...|department of state)/i`.
- **v2:** uses one generic extraction prompt for all platforms (see architecture/03).

## Citation stripping before mention checks (`proseOf`, Canadim)
```js
const proseOf = a => a
  .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, '')
  .replace(/\[([^\]]*)\]\(https?:[^)]*\)/g, (m, t) => (/^[\w.-]+\.[a-z]{2,}$/i.test(t.trim()) ? '' : t))
  .replace(/https?:\/\/\S+/g, '');
```
**Lesson:** the NDEX run didn't strip citations. Brands whose name appears in their own domain (orion.com, addepar.com) probably got inflated mention counts.

## Scoring
```js
const esc = s => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const hasAlias = (text, entity) => entity.aliases.some(a => new RegExp(`(^|[^a-z0-9])${esc(a)}([^a-z0-9]|$)`).test(text.toLowerCase()));
const rankIn = (vendors, entity) => { const i = vendors.findIndex(v => hasAlias(v, entity)); return i === -1 ? null : i + 1; };
const snippetFor = (text, entity) => text.split(/(?<=[.!?\n])\s+/).find(s => hasAlias(s, entity))?.trim().slice(0, 600) || null;

const brandMention = hasAlias(prose, proj);
const cite = citations.find(c => c.url.toLowerCase().includes(proj.domain));
const websiteFound = !!cite || answer.toLowerCase().includes(proj.domain);
const rank = rankIn(vendors, proj);
// found = brandMention || websiteFound ; website = matchedUrl = cite?.url
```
- **Competitor ranks** use the same `rankIn`. Different names for the same firm were merged with a canonical map (`build.mjs`):
  ```js
  const canon = v => CANON.find(([re]) => re.test(v.trim()))?.[1] ?? v.trim();
  export const dedupeFirms = vs => [...new Map(vs.map(v => [canon(v).toLowerCase(), canon(v)])).values()];
  ```
- **v2 changes:**
  - Domain matching uses registrable-domain equality via `tldts` instead of `url.includes(domain)`.
  - "Visible" means mentioned only (see 05).
  - The regex is Unicode-aware.

## Perplexity
```js
const j = await perplexity({ model: 'sonar-pro', messages: [{ role: 'user', content: prompt }],
                             web_search_options: { user_location: { country } } });
const answer = j.choices[0].message.content;
const results = j.search_results?.length ? j.search_results : (j.citations || []).map(url => ({ url, title: null }));
const used = new Set([...answer.matchAll(/\[(\d+)\]/g)].map(m => Number(m[1]) - 1));
const citations = results.filter((_, k) => !used.size || used.has(k)).map(s => ({ url: s.url, title: s.title }));
```
- **Endpoint:** `https://api.perplexity.ai/chat/completions`.
- **Response keys:** `choices, citations, created, id, model, object, search_results, usage`.
- **Rate limit:** 9 processes × 4 concurrent requests hit 429 `request_rate_limit_exceeded` (193 of 324 succeeded). Resuming at a concurrency of 1 finished the remaining 131 in about 12 minutes with no failures. **v2 uses an RPM bucket instead.**

## Gemini
```js
// POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent  (header x-goog-api-key)
const j = await gemini({
  systemInstruction: { parts: [{ text: `The user is located in ${COUNTRY_NAME[country]}.` }] },
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  tools: [{ google_search: {} }],
});
const answer = (cand?.content?.parts || []).map(p => p.text || '').join('');
const citations = (cand.groundingMetadata?.groundingChunks || []).filter(g => g.web).map(g => ({ url: g.web.uri, title: g.web.title }));
// website match tested against `${c.url} ${c.title}` because uri is a Google redirect and title is the domain
```
- **Free-tier quota:** `GenerateRequestsPerDayPerProjectPerModel-FreeTier` is limited to 20 requests a day.
- **Models:** the flash-lite models returned 404 (retired for new users) or 429.
- **Outcome:** no Gemini report was ever saved. **v2 needs a paid key.**

## Concurrency and throughput (measured)
- **Pattern:** a worker pool (`Promise.all` over N workers pulling `next++`).
- **Resume:** results are rewritten after each prompt, and a re-run only fills `null` slots.
- **OpenAI:** 324 prompts in about 4 minutes, with 36 requests in flight across processes and no failures. Each prompt is one luna call plus one extraction call.
- **Cost:** OpenAI and Perplexity cost wasn't logged. **v2 logs `usage` and `costMicros` per check.**

## How results were stored (v1 shape, for reference only)

`reportData[]` item:
```json
{ "prompt": "...", "category": "Portfolio Management Software", "success": true,
  "competitorRanks": { "NDEX Systems": null, "Advyzon": 6, "Black Diamond": 3, "Addepar": 4 },
  "response": [{ "src": "chatgpt", "found": true, "index": 1, "aianswer": "## Short answer ...", "model": "gpt-5.6-luna",
    "details": { "brandMentionFound": true, "websiteFound": true, "website": "https://orion.com/...", "matchedUrl": "...", "snippet": "..." } }],
  "allBrandsRanked": ["Orion", "Envestnet Tamarac", "SS&C Black Diamond", "Addepar"],
  "citations": [{ "url": "...", "title": "..." }] }
```
- **Ignored by the v1 UI:** item-level `citations`, `allBrandsRanked`, `competitorRanks` and `model`. v2 makes all of these first-class fields of `run_results`.
- **Ignored `gemini` src:** `ReportView` only counted `src ∈ {chatgpt, perplexity, google_ai_overviews}`, so `gemini` results were dropped.
