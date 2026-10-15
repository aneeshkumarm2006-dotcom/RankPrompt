import { randomUUID } from 'node:crypto';
import type { CreditBucket } from '@pv/shared';
import type { ClientSession, Types } from 'mongoose';
import { AppError } from '../../http/errors';
import { workspacesRepo } from '../workspaces/repo';
import { ledgerRepo, type LedgerReason } from './repo';

export interface CreditChange {
  workspaceId: Types.ObjectId;
  bucket: CreditBucket;
  /** Positive grants, negative spends. Never 0. */
  delta: number;
  reason: LedgerReason;
  refType: string;
  refId: string;
  note: string;
  actorUserId?: Types.ObjectId | null;
}

/**
 * The only way a credit balance changes (06): an atomic `$inc` on the workspace plus a ledger row,
 * both inside the caller's transaction. A negative change never takes a bucket below zero. The
 * ledger's unique `(reason, bucket, refType, refId)` key makes a repeated change fail with a
 * duplicate-key error, which aborts the transaction instead of applying it twice.
 */
export async function applyCreditChange(
  session: ClientSession,
  change: CreditChange,
): Promise<{ plan: number; purchased: number }> {
  if (!Number.isInteger(change.delta) || change.delta === 0) {
    throw new Error(`credit delta must be a non-zero integer, got ${change.delta}`);
  }
  const balance = await workspacesRepo.incCredits(
    session,
    change.workspaceId,
    change.bucket,
    change.delta,
    change.delta < 0 ? -change.delta : undefined,
  );
  if (!balance) throw new AppError('INSUFFICIENT_CREDITS', 'Not enough credits');
  await ledgerRepo.insert(session, {
    workspaceId: change.workspaceId,
    delta: change.delta,
    bucket: change.bucket,
    reason: change.reason,
    refType: change.refType,
    refId: change.refId,
    balanceAfter: { plan: balance.plan, purchased: balance.purchased },
    note: change.note,
    actorUserId: change.actorUserId ?? null,
  });
  return balance;
}

export interface BucketSplit {
  plan: number;
  purchased: number;
}

const insufficient = (required: number, balance: BucketSplit) =>
  new AppError('INSUFFICIENT_CREDITS', `This run needs ${required} credits`, {
    required,
    available: balance.plan + balance.purchased,
  });

/**
 * Reserves a run's credits (04 § Creating a run, 06): plan credits first, then purchased. Every
 * bucket used gets its own `run_reserve` ledger row under `run/<refId>`. Throws
 * `INSUFFICIENT_CREDITS` (402) when the two buckets together can't cover it, which aborts the
 * caller's transaction. Returns the split, so refunds can go back to the right buckets.
 */
export async function reserveForRun(
  session: ClientSession,
  r: {
    workspaceId: Types.ObjectId;
    refId: string;
    cost: number;
    note: string;
    actorUserId: Types.ObjectId | null;
  },
): Promise<BucketSplit> {
  const balance = await workspacesRepo.credits(session, r.workspaceId);
  if (!balance) throw new AppError('NOT_FOUND', 'Workspace not found');
  const plan = Math.min(r.cost, Math.max(0, balance.plan));
  const purchased = r.cost - plan;
  if (purchased > balance.purchased) throw insufficient(r.cost, balance);
  for (const [bucket, amount] of [
    ['plan', plan],
    ['purchased', purchased],
  ] as const) {
    if (amount === 0) continue;
    try {
      await applyCreditChange(session, {
        workspaceId: r.workspaceId,
        bucket,
        delta: -amount,
        reason: 'run_reserve',
        refType: 'run',
        refId: r.refId,
        note: r.note,
        actorUserId: r.actorUserId,
      });
    } catch (err) {
      if (err instanceof AppError && err.code === 'INSUFFICIENT_CREDITS') {
        throw insufficient(r.cost, balance);
      }
      throw err;
    }
  }
  return { plan, purchased };
}

/**
 * Splits a refund over the buckets a run was charged from (06): purchased first, because those
 * were spent last, never more than each bucket gave.
 */
export function refundSplit(amount: number, reserved: BucketSplit, refunded: BucketSplit) {
  const purchased = Math.min(amount, Math.max(0, reserved.purchased - refunded.purchased));
  const plan = Math.min(amount - purchased, Math.max(0, reserved.plan - refunded.plan));
  if (plan + purchased !== amount) {
    throw new Error(`refund of ${amount} exceeds what the run reserved`);
  }
  return { plan, purchased };
}

/**
 * Refunds failed and canceled checks at finalize, inside the finalize transaction. The ledger's
 * unique `(run_refund, bucket, run, refId)` key means a second finalize of the same generation
 * fails with a duplicate key instead of refunding twice.
 */
export async function refundForRun(
  session: ClientSession,
  r: { workspaceId: Types.ObjectId; refId: string; split: BucketSplit; note: string },
): Promise<void> {
  for (const bucket of ['purchased', 'plan'] as const) {
    const amount = r.split[bucket];
    if (amount === 0) continue;
    await applyCreditChange(session, {
      workspaceId: r.workspaceId,
      bucket,
      delta: amount,
      reason: 'run_refund',
      refType: 'run',
      refId: r.refId,
      note: r.note,
    });
  }
}

/** Admin adjustment (scripts only, 06): `admin_adjust` under `admin/<uuid>`. */
export async function adminAdjust(
  session: ClientSession,
  a: {
    workspaceId: Types.ObjectId;
    bucket: CreditBucket;
    delta: number;
    note: string;
    actorUserId?: Types.ObjectId | null;
  },
): Promise<{ plan: number; purchased: number }> {
  return applyCreditChange(session, {
    workspaceId: a.workspaceId,
    bucket: a.bucket,
    delta: a.delta,
    reason: 'admin_adjust',
    refType: 'admin',
    refId: randomUUID(),
    note: a.note,
    actorUserId: a.actorUserId ?? null,
  });
}

/** Ledger = balance, per bucket (06 § reconciliation). */
export async function ledgerMatchesBalance(workspaceId: Types.ObjectId): Promise<{
  ok: boolean;
  ledger: BucketSplit;
  balance: BucketSplit;
}> {
  const [ledger, ws] = await Promise.all([
    ledgerRepo.sums(workspaceId),
    workspacesRepo.findById(workspaceId),
  ]);
  const balance = ws?.credits ?? { plan: 0, purchased: 0 };
  return {
    ok: ledger.plan === balance.plan && ledger.purchased === balance.purchased,
    ledger,
    balance: { plan: balance.plan, purchased: balance.purchased },
  };
}
