import { Gift } from 'lucide-react';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useMe } from '../../lib/api/auth';
import { usePlans } from '../../lib/api/meta';
import { CreditBalance } from './CreditBalance';
import { LedgerTable } from './LedgerTable';
import { ReferralCard } from './ReferralCard';
import { SurveyCard } from './SurveyCard';

/** `/app/credits`: balance, ways to earn credits, and the ledger (F-28, F-31; v1 EarnCredits). */
export function CreditsPage() {
  const me = useMe();
  const plans = usePlans();
  const grants = plans.data?.grants;

  if (me.isPending) return <PageSpinner />;
  if (!me.data) return <ErrorState error={me.error} onRetry={() => void me.refetch()} />;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Credits"
        description="Your balance, free ways to earn more, and every credit movement."
        icon={<Gift className="w-8 h-8 text-primary-500" aria-hidden />}
      />
      <CreditBalance credits={me.data.workspace.credits} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 items-start">
        <SurveyCard reward={grants?.survey} />
        <ReferralCard reward={grants?.referral} />
      </div>
      <LedgerTable />
    </div>
  );
}
