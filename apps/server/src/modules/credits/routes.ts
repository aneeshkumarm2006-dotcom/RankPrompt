import { z } from 'zod';
import {
  objectIdSchema,
  type LedgerEntry,
  type LedgerPage,
  type ReferralsResponse,
} from '@pv/shared';
import { Router } from 'express';
import { ctxOf, type Ctx } from '../../http/context';
import { AppError } from '../../http/errors';
import { validate } from '../../http/validate';
import { referralsRepo } from '../referrals/repo';
import { workspacesRepo } from '../workspaces/repo';
import { ledgerRepo, type LedgerDoc } from './repo';

const LEDGER_PAGE_SIZE = 50;

const ledgerQuerySchema = z.object({
  cursor: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(LEDGER_PAGE_SIZE),
});

const toEntry = (row: LedgerDoc): LedgerEntry => ({
  id: row._id.toHexString(),
  delta: row.delta,
  bucket: row.bucket,
  reason: row.reason,
  // Run rows use `run/<runId>` or `run/<runId>:<generation>` (D-023).
  runId: row.refType === 'run' ? (row.refId.split(':')[0] ?? null) : null,
  note: row.note,
  balanceAfter: row.balanceAfter,
  createdAt: row.createdAt.toISOString(),
});

async function ledgerPage(ctx: Ctx, cursor: string | undefined, limit: number) {
  const rows = await ledgerRepo.page(ctx.workspaceId, cursor, limit + 1);
  const items = rows.slice(0, limit).map(toEntry);
  const page: LedgerPage = {
    items,
    nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
  };
  return page;
}

async function referrals(ctx: Ctx, appUrl: string): Promise<ReferralsResponse> {
  const ws = await workspacesRepo.findById(ctx.workspaceId);
  if (!ws) throw new AppError('UNAUTHENTICATED', 'Please sign in');
  const [counts, creditsEarned] = await Promise.all([
    referralsRepo.countsForReferrer(ctx.workspaceId),
    ledgerRepo.referralCredits(ctx.workspaceId),
  ]);
  const link = new URL('/register', appUrl);
  link.searchParams.set('ref', ws.referralCode);
  return {
    code: ws.referralCode,
    link: link.toString(),
    referredCount: counts.referred,
    creditedCount: counts.credited,
    creditsEarned,
  };
}

/** `GET /credits/ledger`, `GET /referrals` (08 § Billing and credits). Mounted behind requireAuth. */
export function creditRoutes(deps: { appUrl: string }): Router {
  const router = Router();

  router.get(
    '/credits/ledger',
    validate({ query: ledgerQuerySchema }, async ({ query }, req, res) => {
      res.json(await ledgerPage(ctxOf(req), query.cursor, query.limit));
    }),
  );

  router.get('/referrals', async (req, res) => {
    res.json(await referrals(ctxOf(req), deps.appUrl));
  });

  return router;
}
