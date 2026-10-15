import { ListPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useBrandOutlet } from '../../app/layout/useBrandOutlet';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useMe } from '../../lib/api/auth';
import { usePrompts } from '../../lib/api/prompts';
import { RunConfigForm } from './RunConfigForm';

/** `/app/brands/:brandId/runs/new`: run the brand's active prompts (09 § Routes). */
export function NewRunPage() {
  const brand = useBrandOutlet();
  const navigate = useNavigate();
  const prompts = usePrompts(brand.id);
  // RunConfigForm seeds its platforms from the plan once, so wait for `me` before mounting it.
  const me = useMe();

  let body;
  if (prompts.isPending || me.isPending) body = <PageSpinner label="Loading prompts…" />;
  else if (prompts.isError)
    body = <ErrorState error={prompts.error} onRetry={() => void prompts.refetch()} />;
  else {
    const active = prompts.data.filter((p) => p.archivedAt === null);
    body =
      active.length === 0 ? (
        <EmptyState
          icon={ListPlus}
          title="No prompts yet"
          message="Add prompts to the brand's library first; a run asks each one on every platform you pick."
          action={
            <Link to={`/app/brands/${brand.id}/prompts`} className={buttonClass('primary')}>
              Open the prompt library
            </Link>
          }
        />
      ) : (
        <RunConfigForm
          brand={brand}
          prompts={active}
          onCreated={(run) => void navigate(`/app/runs/${run.id}`)}
        />
      );
  }

  return (
    <>
      <PageHeader
        title="New run"
        description={`Check how AI platforms answer ${brand.name}'s prompts`}
      />
      {body}
    </>
  );
}
