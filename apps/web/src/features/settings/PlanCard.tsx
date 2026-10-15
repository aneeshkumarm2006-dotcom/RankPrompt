import { PLANS, type Me } from '@pv/shared';
import { Crown } from 'lucide-react';
import { Link } from 'react-router';
import { buttonClass } from '../../components/ui/Button';
import { Card } from '../../components/ui/PageHeader';
import { PlatformLabel } from '../../components/ui/PlatformIcon';
import { number } from '../../lib/format';

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3 text-sm">
    <span className="text-gray-600 dark:text-gray-400">{label}</span>
    <span className="font-semibold text-gray-800 dark:text-white">{value}</span>
  </div>
);

/** Plan and credit summary with links to billing and credits (F-28; real data only). */
export function PlanCard({ workspace }: { workspace: Me['workspace'] }) {
  const { plan, credits, limits } = workspace;
  return (
    <Card
      title={
        <span className="inline-flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-500" aria-hidden /> Plan &amp; credits
        </span>
      }
    >
      <div className="space-y-2">
        <Row label="Plan" value={PLANS[plan.tier].name} />
        <Row
          label="Credits"
          value={`${number(credits.total)} (${number(credits.plan)} plan + ${number(credits.purchased)} purchased)`}
        />
        <Row label="Brands" value={`${number(limits.brandsUsed)} of ${number(limits.brands)}`} />
        <Row label="Prompts per run" value={`up to ${number(limits.maxPromptsPerRun)}`} />
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">AI platforms</p>
        <div className="flex flex-wrap gap-2">
          {limits.platforms.map((p) => (
            <span
              key={p}
              className="px-2 py-1 bg-gray-50 dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded text-xs text-gray-800 dark:text-gray-200"
            >
              <PlatformLabel platform={p} short />
            </span>
          ))}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/app/billing" className={buttonClass('primary', 'sm')}>
          Plans &amp; billing
        </Link>
        <Link to="/app/credits" className={buttonClass('outline', 'sm')}>
          Credit activity
        </Link>
      </div>
    </Card>
  );
}
