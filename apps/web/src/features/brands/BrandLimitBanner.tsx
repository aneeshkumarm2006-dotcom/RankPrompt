import type { Me } from '@pv/shared';
import { AlertCircle, Building2, Crown } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClass } from '../../components/ui/Button';

/** True when the workspace has used every brand slot in its plan (F-36). */
export const isBrandLimitReached = (me: Me | null | undefined): boolean =>
  Boolean(me && me.workspace.limits.brandsUsed >= me.workspace.limits.brands);

/** v1 MyBrands limit banner, from `me.workspace.limits`. */
export function BrandLimitBanner({ me }: { me: Me }) {
  const { brands, brandsUsed } = me.workspace.limits;
  const full = brandsUsed >= brands;
  const remaining = Math.max(0, brands - brandsUsed);

  return (
    <div
      className={`mb-6 p-4 rounded-xl border ${
        full
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          {full ? (
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden />
          ) : (
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden />
          )}
          <div>
            <p
              className={`font-medium ${full ? 'text-amber-800 dark:text-amber-200' : 'text-blue-800 dark:text-blue-200'}`}
            >
              {brandsUsed} / {brands} brands used
              <span className="ml-2 text-sm font-normal capitalize">
                ({me.workspace.plan.tier} plan)
              </span>
            </p>
            <p
              className={`text-sm ${full ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}
            >
              {full
                ? 'You have reached your brand limit. Upgrade to add more brands.'
                : `${remaining} brand slot${remaining === 1 ? '' : 's'} remaining`}
            </p>
          </div>
        </div>
        {full && (
          <Link to="/app/billing" className={buttonClass('gradient', 'sm')}>
            <Crown className="w-4 h-4" aria-hidden />
            Upgrade plan
          </Link>
        )}
      </div>
    </div>
  );
}
