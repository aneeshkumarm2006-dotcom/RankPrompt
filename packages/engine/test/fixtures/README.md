# Engine fixtures

Each file is one recorded check that the adapter tests replay with a fake `fetch` (`test/helpers.ts`, `replayFetch`):

```jsonc
{
  "meta": {
    "platform": "chatgpt",
    "source": "…",
    "synthetic": "what was rebuilt, if anything",
    "vendors": ["…"],
  },
  "input": { "prompt": "…", "country": "US", "language": "en" },
  "http": [{ "status": 200, "body": {/* provider response, replayed in order */} }],
  "redirects": {/* gemini only: redirect URL → target, for the resolver */},
}
```

The 03 § Test fixtures cases map to these files:

| Case                                               | Fixture                                                           | Provenance                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Brand named in its own domain, inline citations | `chatgpt/fiserv-only-in-citations.json`                           | Real luna answer (NDEX US #14); envelope rebuilt               |
| 2. Markdown link text that is a domain             | `chatgpt/*` + `clean.test.ts`                                     | Real luna answers                                              |
| 3. Perplexity markers, some sources unused         | `perplexity/ndex-agent.json`, `perplexity/ndex-sonar-legacy.json` | Real answer and cited sources; unused sources are placeholders |
| 4. Gemini redirect URIs with domain titles         | `gemini/redirect-titles.json`                                     | Synthetic (documented shape)                                   |
| 5. No AI Overview → `noAnswer`                     | `google_aio/no-overview.json`, `google_aio/live-async-stub.json`  | Live DataForSEO response, 2026-10-14                           |
| 6. Claude `pause_turn`, search error, refusal      | `claude/*.json`                                                   | Synthetic (documented shape)                                   |
| 7. Unicode and punctuation (`SS&C`)                | `match.test.ts` + `chatgpt/ndex-wealth-platforms.json`            | Real answer                                                    |
| 8. Empty vendors; mentioned but not ranked         | `match.test.ts`                                                   | Unit cases                                                     |

**Re-recording** (TODO 2.11, once keys are in `apps/server/.env`). Each call costs real money:

```
pnpm engine ask --platform claude --country CA --record packages/engine/test/fixtures/claude/live.json "best immigration consultants in Toronto"
```

`--record` writes this format with the provider bodies as returned. Replace a synthetic fixture with a recorded one, then update the expectations in `adapters.test.ts`. Don't commit responses that contain secrets. Provider responses don't echo API keys, but check anyway.
