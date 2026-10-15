import type { Platform, Prompt, Schedule, ScheduleFrequency } from '@pv/shared';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useRunEstimate } from '../../lib/api/runs';
import { useCreateSchedule, useUpdateSchedule } from '../../lib/api/schedules';
import { errorMessage, fieldErrors } from '../../lib/errors';
import { EstimateBanner } from '../runs/EstimateBanner';
import { LocationFields } from '../runs/LocationFields';
import { PlatformPicker } from '../runs/PlatformPicker';
import { PromptSelection } from './PromptSelection';
import {
  estimatePromptIds,
  toScheduleFields,
  validateScheduleForm,
  type ScheduleFormErrors,
  type ScheduleFormValues,
} from './scheduleFormValues';
import { ScheduleTimingFields } from './ScheduleTimingFields';

const SectionTitle = ({ children }: { children: string }) => (
  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
    {children}
  </h3>
);

/** Create or edit a schedule (F-25). Mount it with a `key` so it starts from `initial`. */
export function ScheduleForm({
  brandId,
  schedule,
  initial,
  prompts,
  allowedFrequencies,
  allowedPlatforms,
  maxPrompts,
  onClose,
}: {
  brandId: string;
  /** Present when editing. */
  schedule?: Schedule | undefined;
  initial: ScheduleFormValues;
  /** The brand's active prompts. */
  prompts: Prompt[];
  allowedFrequencies: readonly ScheduleFrequency[];
  allowedPlatforms: readonly Platform[];
  maxPrompts: number;
  onClose: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<ScheduleFormErrors>({});
  const create = useCreateSchedule(brandId);
  const update = useUpdateSchedule(brandId);
  const saving = create.isPending || update.isPending;

  const set = (patch: Partial<ScheduleFormValues>) => setValues((v) => ({ ...v, ...patch }));

  const promptIds = estimatePromptIds(
    values,
    prompts.map((p) => p.id),
  );
  const estimate = useRunEstimate(
    promptIds.length > 0 && values.platforms.length > 0
      ? { brandId, promptIds, platforms: values.platforms }
      : null,
  );

  const onError = (err: unknown) => {
    const fields = fieldErrors(err);
    if (Object.keys(fields).length > 0) setErrors(fields);
    toast.error(errorMessage(err));
  };

  const submit = () => {
    const found = validateScheduleForm(values, brandId);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const fields = toScheduleFields(values);
    const done = () => {
      toast.success(schedule ? 'Schedule updated' : 'Schedule created');
      onClose();
    };
    if (schedule) update.mutate({ id: schedule.id, ...fields }, { onSuccess: done, onError });
    else create.mutate({ brandId, ...fields }, { onSuccess: done, onError });
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={schedule ? 'Edit schedule' : 'New schedule'}
      icon={
        <div className="w-10 h-10 bg-action-500/15 rounded-full flex items-center justify-center shrink-0">
          <CalendarClock className="w-5 h-5 text-action-600 dark:text-action-400" />
        </div>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {schedule ? 'Save changes' : 'Create schedule'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Label" hint="Optional. Tells schedules apart." error={errors.label}>
          {(p) => (
            <Input
              {...p}
              value={values.label}
              maxLength={100}
              placeholder="e.g. Weekly US check"
              onChange={(e) => set({ label: e.target.value })}
            />
          )}
        </Field>

        <section className="space-y-4">
          <SectionTitle>When</SectionTitle>
          <ScheduleTimingFields
            value={values}
            onChange={set}
            allowedFrequencies={allowedFrequencies}
            errors={errors}
          />
        </section>

        <section className="space-y-4">
          <SectionTitle>What</SectionTitle>
          <PlatformPicker
            value={values.platforms}
            onChange={(platforms) => set({ platforms })}
            allowed={allowedPlatforms}
            error={errors.platforms}
          />
          <PromptSelection
            brandId={brandId}
            prompts={prompts}
            mode={values.mode}
            promptIds={values.promptIds}
            max={maxPrompts}
            onChange={(sel) => set(sel)}
            error={errors['promptSelection.promptIds'] ?? errors.promptSelection}
          />
        </section>

        <section className="space-y-4">
          <SectionTitle>Where</SectionTitle>
          <LocationFields
            value={values.location}
            onChange={(location) => set({ location })}
            errors={{
              ...(errors.city ? { city: errors.city } : {}),
              ...(errors.country ? { country: errors.country } : {}),
              ...(errors.language ? { language: errors.language } : {}),
            }}
          />
        </section>

        <section className="space-y-2">
          <SectionTitle>Cost per run</SectionTitle>
          <EstimateBanner
            estimate={estimate.data}
            loading={estimate.isFetching && !estimate.data}
            promptCount={promptIds.length}
            platformCount={values.platforms.length}
          />
          {estimate.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">{errorMessage(estimate.error)}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Each scheduled run reserves its credits when it starts. After 3 runs skipped for lack of
            credits, the schedule pauses itself.
          </p>
        </section>
      </form>
    </Modal>
  );
}
