import type { Run } from '@pv/shared';
import { useRun, useRunResults } from '../../lib/api/runs';

/**
 * Loads what "schedule this setup" (`?fromRun=<runId>`) needs: the run, and the prompt ids it
 * checked (one platform's results list every prompt once, so one page is enough).
 */
export function useFromRunPrefill(runId: string | null): {
  run: Run | undefined;
  promptIds: string[];
  ready: boolean;
  failed: boolean;
} {
  const run = useRun(runId ?? undefined);
  const platform = run.data?.config.platforms[0];
  const results = useRunResults(
    runId ?? undefined,
    platform ? { platform } : {},
    Boolean(run.data),
  );
  const promptIds = results.data?.pages.flatMap((p) => p.items.map((r) => r.promptId)) ?? [];
  return {
    run: run.data,
    promptIds,
    ready: Boolean(runId) && Boolean(run.data) && (results.isSuccess || results.isError),
    failed: Boolean(runId) && run.isError,
  };
}
