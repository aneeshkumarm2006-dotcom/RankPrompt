import {
  competitorInsightsSchema,
  insightsOverviewSchema,
  promptHistoryResponseSchema,
  sourcesResponseSchema,
  trendResponseSchema,
} from '@pv/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connectTestDb, dropTestDb, makeTestApp, signUp, type Client } from './helpers';
import { brandWithPrompts, createRun, testWorker, waitForRun } from './runHelpers';

const { app } = makeTestApp();

beforeAll(() => connectTestDb('insights_test'));
afterAll(() => dropTestDb());

describe('brand insights (05, 08 § Insights)', () => {
  let agent: Client;
  let brandId: string;
  let promptIds: string[];
  const runIds: string[] = [];

  beforeAll(async () => {
    ({ agent } = await signUp(app));
    ({ brandId, promptIds } = await brandWithPrompts(agent, 3));
    const worker = testWorker();
    worker.start();
    try {
      // Two runs on the same prompt set, then one with a prompt added.
      for (const ids of [promptIds.slice(0, 2), promptIds.slice(0, 2), promptIds]) {
        const run = await createRun(agent, { brandId, promptIds: ids });
        await waitForRun(agent, run.id);
        runIds.push(run.id);
      }
    } finally {
      await worker.drain(5_000);
    }
  });

  it('overview: the latest run and the delta over what both runs share', async () => {
    const overview = insightsOverviewSchema.parse(
      (await agent.get(`/api/brands/${brandId}/insights/overview`).expect(200)).body,
    );
    expect(overview.latestRun?.id).toBe(runIds[2]);
    expect(overview.previousRunId).toBe(runIds[1]);
    expect(overview.delta).toMatchObject({
      sharedPrompts: 2,
      sharedPlatforms: ['chatgpt', 'perplexity'],
    });
    // Same prompts, deterministic fake answers: no movement.
    expect(overview.delta?.deltaPts ?? 0).toBe(0);
    expect(overview.counts).toEqual({ runs: 3, activePrompts: 3, activeSchedules: 0 });
    expect(overview.nextScheduledRunAt).toBeNull();
  });

  it('trend: one point per run, marking where the prompt set changed', async () => {
    const trend = trendResponseSchema.parse(
      (await agent.get(`/api/brands/${brandId}/insights/trend`).expect(200)).body,
    );
    expect(trend.points.map((p) => p.runId)).toEqual(runIds);
    expect(trend.points.map((p) => p.comparableWithPrevious)).toEqual([true, true, false]);

    const chatgpt = trendResponseSchema.parse(
      (await agent.get(`/api/brands/${brandId}/insights/trend?platform=chatgpt`).expect(200)).body,
    );
    expect(chatgpt.points[0]?.visibility).toEqual(trend.points[0]?.byPlatform.chatgpt);
    const none = trendResponseSchema.parse(
      (await agent.get(`/api/brands/${brandId}/insights/trend?platform=claude`).expect(200)).body,
    );
    expect(none.points).toEqual([]);

    const future = new Date(Date.now() + 86_400_000).toISOString();
    const empty = trendResponseSchema.parse(
      (
        await agent
          .get(`/api/brands/${brandId}/insights/trend`)
          .query({ from: future, to: new Date(Date.now() + 2 * 86_400_000).toISOString() })
          .expect(200)
      ).body,
    );
    expect(empty.points).toEqual([]);
    await agent
      .get(`/api/brands/${brandId}/insights/trend`)
      .query({ from: future, to: new Date().toISOString() })
      .expect(400);
  });

  it('competitors: metrics, suggestions and the per-prompt rank matrix', async () => {
    const latest = competitorInsightsSchema.parse(
      (await agent.get(`/api/brands/${brandId}/insights/competitors`).expect(200)).body,
    );
    expect(latest.runId).toBe(runIds[2]);
    expect(latest.brand?.name).toBe('Acme Analytics');
    expect(latest.competitors.map((c) => c.name)).toEqual(['Globex', 'Initech']);
    expect(latest.matrix).toHaveLength(3);
    expect(latest.matrix[0]?.cells.map((c) => c.platform)).toEqual(['chatgpt', 'perplexity']);
    expect(latest.matrix[0]?.cells[0]?.competitorRanks).toHaveLength(2);
    // Vendors other than the brand and the two tracked competitors.
    for (const s of latest.suggestedCompetitors) {
      expect(['Acme Analytics', 'Globex', 'Initech']).not.toContain(s.name);
    }

    const first = competitorInsightsSchema.parse(
      (
        await agent
          .get(`/api/brands/${brandId}/insights/competitors?runId=${runIds[0]}`)
          .expect(200)
      ).body,
    );
    expect(first.runId).toBe(runIds[0]);
    expect(first.matrix).toHaveLength(2);
  });

  it('sources: cited domains with counts, shares and samples', async () => {
    const sources = sourcesResponseSchema.parse(
      (await agent.get(`/api/brands/${brandId}/insights/sources`).expect(200)).body,
    );
    expect(sources.totalCitations).toBeGreaterThan(0);
    const total = sources.domains.reduce((s, d) => s + d.count, 0);
    expect(total).toBe(sources.totalCitations);
    for (const d of sources.domains) {
      expect(d.share).toBeCloseTo(d.count / sources.totalCitations);
      expect(d.sampleUrls.length).toBeGreaterThan(0);
      expect(d.sampleUrls.length).toBeLessThanOrEqual(3);
      expect(d.samplePrompts.length).toBeLessThanOrEqual(3);
      expect(d.isBrand).toBe(false);
    }
    const perplexity = sourcesResponseSchema.parse(
      (await agent.get(`/api/brands/${brandId}/insights/sources?platform=perplexity`).expect(200))
        .body,
    );
    expect(perplexity.domains.every((d) => d.platforms.join() === 'perplexity')).toBe(true);
  });

  it('prompt history: each prompt across runs, per platform', async () => {
    const history = promptHistoryResponseSchema.parse(
      (await agent.get(`/api/brands/${brandId}/insights/prompts`).expect(200)).body,
    );
    expect(history.prompts.map((p) => p.promptId)).toEqual(promptIds);
    expect(history.prompts[0]?.history.map((h) => h.runId)).toEqual(runIds);
    expect(history.prompts[2]?.history.map((h) => h.runId)).toEqual([runIds[2]]);
    expect(Object.keys(history.prompts[0]?.history[0]?.perPlatform ?? {}).sort()).toEqual([
      'chatgpt',
      'perplexity',
    ]);

    // An edited prompt keeps its history under the old (archived) prompt.
    await agent
      .patch(`/api/prompts/${promptIds[0]}`)
      .send({ text: 'A brand new question?' })
      .expect(200);
    const after = promptHistoryResponseSchema.parse(
      (await agent.get(`/api/brands/${brandId}/insights/prompts`).expect(200)).body,
    );
    expect(after.prompts.find((p) => p.promptId === promptIds[0])?.archived).toBe(true);
  });

  it('a brand with no runs has empty insights', async () => {
    const other = await signUp(app);
    const made = await brandWithPrompts(other.agent, 1);
    const overview = insightsOverviewSchema.parse(
      (await other.agent.get(`/api/brands/${made.brandId}/insights/overview`).expect(200)).body,
    );
    expect(overview).toMatchObject({ latestRun: null, previousRunId: null, delta: null });
    const competitors = competitorInsightsSchema.parse(
      (await other.agent.get(`/api/brands/${made.brandId}/insights/competitors`).expect(200)).body,
    );
    expect(competitors).toEqual({
      runId: null,
      brand: null,
      competitors: [],
      suggestedCompetitors: [],
      matrix: [],
    });
  });
});
