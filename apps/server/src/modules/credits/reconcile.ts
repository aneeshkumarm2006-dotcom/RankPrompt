import type { Types } from 'mongoose';
import type { Logger } from '../../config/logger';
import type { ErrorReporter } from '../../config/sentry';
import { withTransaction } from '../../db/transaction';
import { workspacesRepo } from '../workspaces/repo';
import { ledgerRepo } from './repo';
import type { BucketSplit } from './service';

export interface LedgerMismatch {
  workspaceId: string;
  ledger: BucketSplit;
  balance: BucketSplit;
}

export interface ReconcileReport {
  checked: number;
  mismatches: LedgerMismatch[];
}

const BATCH = 500;

/**
 * Nightly reconciliation (06): for every workspace, the ledger's deltas per bucket must add up
 * to `workspaces.credits`. Each batch reads balances and sums in one snapshot transaction, so a
 * credit change committing meanwhile can't show up as a false mismatch. A mismatch is logged at
 * error level and sent to Sentry (when set); it is never fixed automatically.
 */
export async function reconcileLedger(deps: {
  logger: Logger;
  reporter: ErrorReporter;
  batchSize?: number;
}): Promise<ReconcileReport> {
  const batch = deps.batchSize ?? BATCH;
  const report: ReconcileReport = { checked: 0, mismatches: [] };
  let after: Types.ObjectId | null = null;

  for (;;) {
    const cursor: Types.ObjectId | null = after;
    const { count, last, mismatches } = await withTransaction(async (session) => {
      const page = await workspacesRepo.balancesPage(session, cursor, batch);
      const sums = await ledgerRepo.sumsFor(
        session,
        page.map((ws) => ws._id),
      );
      const found: LedgerMismatch[] = [];
      for (const ws of page) {
        const ledger = sums.get(ws._id.toHexString()) ?? { plan: 0, purchased: 0 };
        if (ledger.plan !== ws.credits.plan || ledger.purchased !== ws.credits.purchased) {
          found.push({
            workspaceId: ws._id.toHexString(),
            ledger,
            balance: { plan: ws.credits.plan, purchased: ws.credits.purchased },
          });
        }
      }
      return { count: page.length, last: page.at(-1)?._id ?? null, mismatches: found };
    });
    report.checked += count;
    report.mismatches.push(...mismatches);
    if (count < batch || !last) break;
    after = last;
  }

  for (const m of report.mismatches) {
    deps.logger.error(m, 'credit ledger does not match the balance');
    deps.reporter.capture(new Error('credit ledger does not match the balance'), { ...m });
  }
  deps.logger.info(
    { checked: report.checked, mismatches: report.mismatches.length },
    'ledger reconciliation',
  );
  return report;
}
