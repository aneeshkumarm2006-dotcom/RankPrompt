import type { Brand, Me, Platform, Prompt, Run } from '@pv/shared';
import { Play } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useMe } from '../../lib/api/auth';
import { useCreateRun, useRunEstimate } from '../../lib/api/runs';
import { errorMessage, hasCode } from '../../lib/errors';
import { InsufficientCreditsModal, LOW_CREDITS_THRESHOLD, LowCreditsModal } from './CreditModals';
import { EstimateBanner } from './EstimateBanner';
import { LocationFields, type LocationValue } from './LocationFields';
import { PlatformPicker } from './PlatformPicker';
import { PromptPicker } from './PromptPicker';

/**
 * Run configuration (09 § Wizard step 4 and `/runs/new`): prompts, platforms and location, the
 * server estimate, and the low / insufficient credit modals (F-11, F-12).
 */
export interface RunConfigFormProps {
  brand: Brand;
  /** The brand's active prompts. */
  prompts: Prompt[];
  onCreated: (run: Run) => void;
  submitLabel?: string;
}

export function RunConfigForm(props: RunConfigFormProps) {
  const { data: me } = useMe();
  // The initial selections depend on the plan limits, so wait for them once.
  if (!me) return <PageSpinner />;
  return <RunConfigFormInner {...props} me={me} />;
}

function RunConfigFormInner({
  brand,
  prompts,
  onCreated,
  submitLabel = 'Run analysis',
  me,
}: RunConfigFormProps & { me: Me }) {
  const limits = me.workspace.limits;
  const allowed = limits.platforms;
  const max = limits.maxPromptsPerRun;

  const [promptIds, setPromptIds] = useState<string[]>(() =>
    prompts.slice(0, max).map((p) => p.id),
  );
  const [platforms, setPlatforms] = useState<Platform[]>(() => {
    const defaults = brand.defaults.platforms.filter((p) => allowed.includes(p));
    return defaults.length > 0 ? defaults : [...allowed];
  });
  const [location, setLocation] = useState<LocationValue>({
    scope: brand.defaults.scope,
    country: brand.defaults.country,
    city: brand.defaults.city,
    language: brand.defaults.language,
  });
  const [cityError, setCityError] = useState<string>();
  const [modal, setModal] = useState<'low' | 'insufficient' | null>(null);

  const estimate = useRunEstimate(
    promptIds.length > 0 && platforms.length > 0
      ? { brandId: brand.id, promptIds, platforms }
      : null,
  );
  const createRun = useCreateRun();

  const balance = estimate.data ? estimate.data.balance.plan + estimate.data.balance.purchased : 0;

  const start = () => {
    createRun.mutate(
      { brandId: brand.id, promptIds, platforms, ...location },
      {
        onSuccess: (run) => {
          toast.success('Run started');
          onCreated(run);
        },
        onError: (err) => {
          if (hasCode(err, 'INSUFFICIENT_CREDITS')) setModal('insufficient');
          else toast.error(errorMessage(err));
        },
      },
    );
  };

  const submit = () => {
    if (location.scope === 'local' && !location.city?.trim()) {
      setCityError('A local search needs a city');
      return;
    }
    setCityError(undefined);
    const e = estimate.data;
    if (!e) return;
    if (!e.sufficient) return setModal('insufficient');
    if (balance - e.credits <= LOW_CREDITS_THRESHOLD) return setModal('low');
    start();
  };

  return (
    <div className="space-y-6">
      <Card title="Prompts">
        <PromptPicker prompts={prompts} value={promptIds} onChange={setPromptIds} max={max} />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Location & language">
          <LocationFields
            value={location}
            onChange={setLocation}
            errors={cityError ? { city: cityError } : {}}
          />
        </Card>
        <Card title="Platforms">
          <PlatformPicker value={platforms} onChange={setPlatforms} allowed={allowed} />
        </Card>
      </div>

      <EstimateBanner
        estimate={estimate.data}
        loading={estimate.isFetching && !estimate.data}
        promptCount={promptIds.length}
        platformCount={platforms.length}
      />
      {estimate.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage(estimate.error)}</p>
      )}

      <div className="flex justify-end">
        <Button
          size="lg"
          icon={<Play className="w-5 h-5" />}
          onClick={submit}
          loading={createRun.isPending}
          disabled={!estimate.data || promptIds.length === 0 || platforms.length === 0}
        >
          {submitLabel}
        </Button>
      </div>

      <InsufficientCreditsModal
        open={modal === 'insufficient'}
        onClose={() => setModal(null)}
        needed={estimate.data?.credits ?? 0}
        available={balance}
      />
      <LowCreditsModal
        open={modal === 'low'}
        onClose={() => setModal(null)}
        onContinue={start}
        creditsAfter={Math.max(0, balance - (estimate.data?.credits ?? 0))}
        tier={me.workspace.plan.tier}
      />
    </div>
  );
}
