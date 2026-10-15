import type { Me } from '@pv/shared';
import { Coins, Crown, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router';
import { MetricTile } from '../../components/ui/MetricTile';
import { number } from '../../lib/format';

/** Plan / purchased / total, straight from `/me` (06: two buckets). */
export function CreditBalance({ credits }: { credits: Me['workspace']['credits'] }) {
  return (
    <section className="mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricTile
          label="Total credits"
          icon={Coins}
          accent="purple"
          value={number(credits.total)}
        />
        <MetricTile
          label="Plan credits"
          icon={Crown}
          accent="orange"
          value={number(credits.plan)}
          hint="Reset each billing cycle"
        />
        <MetricTile
          label="Purchased credits"
          icon={ShoppingBag}
          accent="green"
          value={number(credits.purchased)}
          hint="Never expire"
        />
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Runs use plan credits first, then purchased ones.{' '}
        <Link to="/app/billing" className="text-action-600 dark:text-action-400 hover:underline">
          Buy credits or change plan
        </Link>
      </p>
    </section>
  );
}
