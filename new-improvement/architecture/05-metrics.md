# 05: Metrics (the only definitions)

All metric code lives in `packages/shared/src/metrics.ts`. The server computes the metrics; the UI and the PDF only display them. Any change to a definition bumps `METRICS_VERSION`, which is stamped on every run.

In v1, "visible" meant three different things in three places:
- `found || websiteFound || brandMentioned` in ReportView
- `found` alone in PerformanceSummary and the trend
- `successRate`, which was really the fraction of n8n HTTP calls that succeeded

v1 also averaged per-platform percentages. **All of that is gone.**

## Terms

| Term | Definition |
|---|---|
| Check | One prompt on one platform within one run |
| Answered | A check with `status = 'ok'` |
| Excluded | `no_answer`, `failed` and `canceled` checks. They are never part of a denominator, except for AI Overview presence |
| Mentioned | `brand.mentioned`. The brand name or an alias appears as a whole word in the cleaned prose, or the brand is in the vendor list (see 03) |
| Rank | `brand.rank`. 1-based position in the vendor list, or `null` |
| Cited | `brand.cited`. A citation's domain equals the brand domain or is a subdomain of it |

Every metric is returned as `Metric = { num: number; den: number; rate: number | null }`. `rate` is `num/den`, or `null` when `den = 0`. The UI shows "—" for `null`, never 0%.

## Metric list

| Metric | num | den | Notes |
|---|---|---|---|
| **Visibility** | answered checks where the brand is mentioned | answered checks | The headline number. Also called "mention rate"; there is only one metric. |
| **Citation rate** | answered checks where the brand is cited | answered checks | Shown separately. A citation alone does **not** count as visible. |
| **Prompt coverage** | prompts with ≥1 answered check where the brand is mentioned | prompts with ≥1 answered check | Answers "on how many questions do we show up anywhere?" |
| **Top-3 rate** | answered checks with `rank ≤ 3` | answered checks | |
| **Average rank** | sum of ranks where rank ≠ null | count of ranks ≠ null | Shown together with its count ("avg #2.4 across 31 answers"). A missing rank is never filled in as 0 or as N+1. |
| **Share of voice** | brand mentions | brand mentions + mentions of each tracked competitor | Counted over answered checks. Each company counts at most once per check. |
| **AI Overview presence** | `google_aio` checks with `status = ok` | `google_aio` checks with status `ok` or `no_answer` | Only on the AI Overview tile and platform row. |

**Competitors:** the same functions are applied to each tracked competitor's `{mentioned, rank, cited}` on the same checks. That gives competitor visibility, average rank and share of voice.

**Suggested competitors:** the vendors that appear most often and match neither the brand nor a tracked competitor. For each one we report: `name`, `mentions` (number of checks), `bestRank`, `avgRank`.

## Breakdowns

Every metric can be computed for any subset of checks. The standard breakdowns are:
- **total**: all checks in the run
- **by platform**
- **by category**
- **by prompt**: the per-platform matrix shown in the results table

**Totals are pooled from the checks.** They are never averages of the platform rates.
Example: ChatGPT 10/20 and Claude 1/2 gives a total of 11/22 = 50%, **not** (50% + 50%) / 2.

## Run aggregates (`runs.aggregates`, written at finalize)

```ts
{
  total: { visibility, citationRate, promptCoverage, top3Rate, avgRank, shareOfVoice },
  byPlatform: Record<Platform, { visibility, citationRate, top3Rate, avgRank, aioPresence?: Metric }>,
  byCategory: Record<string, { visibility, citationRate }>,
  competitors: { competitorId, name, visibility, avgRank, shareOfVoice, citationRate }[],
  suggestedCompetitors: { name, mentions, bestRank, avgRank }[],   // top 10
  topCitedDomains: { domain, count, platforms: Platform[], isBrand: boolean }[] // top 20
}
```
The aggregates can always be recomputed from `run_results`. Admin script `recompute-aggregates --run <id>`.

## Trends (`GET /brands/:id/insights/trend`)

- **One point per completed or partial run:** `{ runId, date, trigger, visibility (total), byPlatform visibility, promptSetHash, platformsHash }`.
- **Comparability:** when `promptSetHash` or `platformsHash` changes between two neighbouring points, the UI draws a marker ("prompt set changed"), because those two points aren't directly comparable.
- **Deltas** ("+6 pts vs last run") are computed only over the **prompts and platforms both runs share**. The response returns `{num, den}` for that intersection.

## Sources (`GET /brands/:id/insights/sources`)

These are the real citations across all answered checks in a time range. For each domain: count, share of all citations, which platforms cite it, and the example URLs and prompts. The brand's own domain is flagged. This replaces v1's "citations" page, which only showed the brand's own matched URLs.
