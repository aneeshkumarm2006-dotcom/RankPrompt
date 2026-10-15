import type { Schedule } from '@pv/shared';
import { Archive, CalendarClock, Info, Plus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { useBrandOutlet } from '../../app/layout/useBrandOutlet';
import { useMe } from '../../lib/api/auth';
import { usePlans } from '../../lib/api/meta';
import { usePrompts } from '../../lib/api/prompts';
import { useSchedules } from '../../lib/api/schedules';
import { ScheduleCreditsBanner } from './ScheduleCreditsBanner';
import { ScheduleForm } from './ScheduleForm';
import {
  ALL_FREQUENCIES,
  emptyFormValues,
  formValuesFromRun,
  formValuesFromSchedule,
  type ScheduleFormValues,
} from './scheduleFormValues';
import { ScheduleList } from './ScheduleList';
import { detectTimezone } from './scheduleText';
import { useFromRunPrefill } from './useFromRunPrefill';

type FormState = { key: string; schedule?: Schedule; initial: ScheduleFormValues } | null;

const Notice = ({ icon: Icon, children }: { icon: typeof Info; children: ReactNode }) => (
  <div
    role="status"
    className="rounded-xl p-4 mb-6 flex items-start gap-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-sm text-blue-800 dark:text-blue-300"
  >
    <Icon className="w-5 h-5 shrink-0" aria-hidden />
    <div>{children}</div>
  </div>
);

/** `/app/brands/:brandId/schedules` (F-25, 10). Supports `?fromRun=<runId>` prefill. */
export function SchedulesPage() {
  const brand = useBrandOutlet();
  const me = useMe();
  const plans = usePlans();
  const prompts = usePrompts(brand.id);
  const schedules = useSchedules(brand.id);
  const [params, setParams] = useSearchParams();
  const fromRunId = params.get('fromRun');
  const prefill = useFromRunPrefill(fromRunId);
  const [form, setForm] = useState<FormState>(null);

  const workspace = me.data?.workspace;
  const allowedPlatforms = workspace?.limits.platforms ?? [];
  const maxPrompts = workspace?.limits.maxPromptsPerRun ?? 0;
  const plan = plans.data?.plans.find((p) => p.tier === workspace?.plan.tier);
  const allowedFrequencies = plan?.limits.scheduleFrequencies ?? ALL_FREQUENCIES;
  const activePrompts = useMemo(
    () => (prompts.data ?? []).filter((p) => p.archivedAt === null),
    [prompts.data],
  );
  const readOnly = brand.archivedAt !== null;

  if (me.isPending || prompts.isPending) return <PageSpinner />;
  if (prompts.isError)
    return <ErrorState error={prompts.error} onRetry={() => void prompts.refetch()} />;

  const blank = () =>
    emptyFormValues(brand, {
      allowedPlatforms,
      frequencies: allowedFrequencies,
      timezone: detectTimezone(),
    });

  // "Schedule this setup": derived from the URL, so closing the form just drops the param.
  const fromRunForm: FormState =
    !form && !readOnly && prefill.ready && prefill.run
      ? {
          key: `fromRun:${prefill.run.id}`,
          initial: formValuesFromRun(
            blank(),
            prefill.run,
            prefill.run.brandId === brand.id ? prefill.promptIds : [],
            activePrompts.map((p) => p.id),
            allowedPlatforms,
          ),
        }
      : null;
  const shown = form ?? fromRunForm;

  const closeForm = () => {
    setForm(null);
    if (fromRunId) {
      const next = new URLSearchParams(params);
      next.delete('fromRun');
      setParams(next, { replace: true });
    }
  };

  const list = schedules.data ?? [];
  const active = list.filter((s) => s.isActive);

  return (
    <div>
      <PageHeader
        title="Scheduled reports"
        description="Run this brand's prompts automatically, daily, weekly or monthly."
        icon={<CalendarClock className="w-8 h-8 text-primary-500" aria-hidden />}
        actions={
          !readOnly && (
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setForm({ key: `new:${Date.now()}`, initial: blank() })}
            >
              New schedule
            </Button>
          )
        }
      />

      {readOnly && (
        <Notice icon={Archive}>
          This brand is archived, so its schedules are paused and can’t be changed.
        </Notice>
      )}
      {prefill.failed && (
        <Notice icon={Info}>We couldn’t load that run to prefill the form.</Notice>
      )}

      {workspace && (
        <ScheduleCreditsBanner
          balance={workspace.credits.total}
          neededPerCycle={active.reduce((sum, s) => sum + s.creditsPerRun, 0)}
          activeCount={active.length}
        />
      )}

      {schedules.isPending ? (
        <PageSpinner label="Loading schedules…" />
      ) : schedules.isError ? (
        <ErrorState error={schedules.error} onRetry={() => void schedules.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No schedules yet"
          message="Create a schedule to track this brand's AI visibility over time without starting each run by hand."
          action={
            !readOnly && (
              <Button
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setForm({ key: `new:${Date.now()}`, initial: blank() })}
              >
                Create a schedule
              </Button>
            )
          }
        />
      ) : (
        <ScheduleList
          brandId={brand.id}
          schedules={list}
          readOnly={readOnly}
          onEdit={(s) =>
            setForm({ key: `edit:${s.id}`, schedule: s, initial: formValuesFromSchedule(s) })
          }
        />
      )}

      {shown && (
        <ScheduleForm
          key={shown.key}
          brandId={brand.id}
          schedule={shown.schedule}
          initial={shown.initial}
          prompts={activePrompts}
          allowedFrequencies={allowedFrequencies}
          allowedPlatforms={allowedPlatforms}
          maxPrompts={maxPrompts}
          onClose={closeForm}
        />
      )}
    </div>
  );
}
