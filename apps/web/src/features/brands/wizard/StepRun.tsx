import type { Brand, Prompt } from '@pv/shared';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { PageSpinner } from '../../../components/ui/Spinner';
import { useMe } from '../../../lib/api/auth';
import { RunConfigForm } from '../../runs/RunConfigForm';

/** Step 4: the shared run form (prompts, platforms, location, estimate, credit modals). */
export function StepRun({
  brand,
  prompts,
  onBack,
}: {
  brand: Brand;
  prompts: Prompt[];
  onBack: () => void;
}) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  // RunConfigForm seeds its state from the plan limits on mount, so wait for them.
  if (!me) return <PageSpinner />;

  return (
    <div className="space-y-6">
      <RunConfigForm
        brand={brand}
        prompts={prompts}
        submitLabel="Analyze visibility"
        onCreated={(run) => void navigate(`/app/runs/${run.id}`)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          ← Back to prompts
        </Button>
        <Link
          to={`/app/brands/${brand.id}`}
          className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
        >
          Skip for now, go to the dashboard
        </Link>
      </div>
    </div>
  );
}
