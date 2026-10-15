import { getPlan, type Me, type PatchMeBody } from '@pv/shared';
import type { Ctx } from '../../http/context';
import { AppError } from '../../http/errors';
import { brandsRepo } from '../brands/repo';
import { usersRepo, type UserDoc } from '../users/repo';
import { workspacesRepo, type WorkspaceDoc } from '../workspaces/repo';

type Ids = Pick<Ctx, 'userId' | 'workspaceId'>;

function toMe(user: UserDoc, ws: WorkspaceDoc, brandsUsed: number): Me {
  const plan = getPlan(ws.plan.tier);
  return {
    user: {
      id: user._id.toHexString(),
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      avatarUrl: user.avatarUrl,
      authMethods: [
        ...(user.passwordHash ? (['password'] as const) : []),
        ...(user.googleId ? (['google'] as const) : []),
      ],
      emailPrefs: {
        runCompleted: user.emailPrefs?.runCompleted ?? true,
        lowCredits: user.emailPrefs?.lowCredits ?? true,
      },
    },
    workspace: {
      id: ws._id.toHexString(),
      name: ws.name,
      plan: {
        tier: ws.plan.tier,
        status: ws.plan.status,
        currentPeriodEnd: ws.plan.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: ws.plan.cancelAtPeriodEnd,
        pendingTier: ws.plan.pendingTier,
      },
      credits: {
        plan: ws.credits.plan,
        purchased: ws.credits.purchased,
        total: ws.credits.plan + ws.credits.purchased,
      },
      limits: {
        brands: plan.limits.brands,
        brandsUsed,
        maxPromptsPerRun: plan.limits.maxPromptsPerRun,
        platforms: [...plan.limits.platforms],
      },
      referralCode: ws.referralCode,
    },
  };
}

/** `Me` (08): the user, their workspace, credits and plan limits. */
export async function getMe(ids: Ids): Promise<Me> {
  const [user, ws, brandsUsed] = await Promise.all([
    usersRepo.findById(ids.userId),
    workspacesRepo.findById(ids.workspaceId),
    brandsRepo.countActive(ids),
  ]);
  if (!user || !ws) throw new AppError('UNAUTHENTICATED', 'Please sign in');
  return toMe(user, ws, brandsUsed);
}

export async function updateMe(ctx: Ctx, patch: PatchMeBody): Promise<Me> {
  const set: Parameters<typeof usersRepo.updateProfile>[1] = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.avatarUrl !== undefined) set.avatarUrl = patch.avatarUrl;
  if (patch.emailPrefs !== undefined) set.emailPrefs = patch.emailPrefs;
  await usersRepo.updateProfile(ctx.userId, set);
  return getMe(ctx);
}
