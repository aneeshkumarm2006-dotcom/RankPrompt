import { SCHEDULE_FREQUENCIES, WEEKDAY_NAMES, type ScheduleFrequency } from '@pv/shared';
import { Lock } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { Field, Select } from '../../components/ui/Field';
import type { ScheduleFormErrors, ScheduleFormValues } from './scheduleFormValues';
import { FREQUENCY_LABELS, hourLabel, ordinal, timezoneOptions } from './scheduleText';

type Timing = Pick<
  ScheduleFormValues,
  'frequency' | 'hour' | 'timezone' | 'weekday' | 'dayOfMonth'
>;

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** Frequency (only the plan's, others locked), hour, time zone and weekday / day of month. */
export function ScheduleTimingFields({
  value,
  onChange,
  allowedFrequencies,
  errors,
}: {
  value: Timing;
  onChange: (patch: Partial<Timing>) => void;
  allowedFrequencies: readonly ScheduleFrequency[];
  errors: ScheduleFormErrors;
}) {
  const zones = useMemo(() => timezoneOptions(value.timezone), [value.timezone]);
  const locked = SCHEDULE_FREQUENCIES.filter((f) => !allowedFrequencies.includes(f));

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Frequency
        </legend>
        <div className="flex gap-2" role="group" aria-label="Frequency">
          {SCHEDULE_FREQUENCIES.map((f) => {
            const disabled = !allowedFrequencies.includes(f);
            return (
              <button
                key={f}
                type="button"
                aria-pressed={value.frequency === f}
                disabled={disabled}
                onClick={() => onChange({ frequency: f })}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  value.frequency === f
                    ? 'bg-action-600 text-white'
                    : 'bg-gray-100 dark:bg-dark-800 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-700'
                }`}
              >
                {disabled && <Lock className="w-3 h-3" aria-hidden />}
                {FREQUENCY_LABELS[f]}
              </button>
            );
          })}
        </div>
        {locked.length > 0 && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {locked.map((f) => FREQUENCY_LABELS[f]).join(' and ')} schedules need a paid plan.{' '}
            <Link
              to="/app/billing"
              className="text-action-600 dark:text-action-400 hover:underline"
            >
              Upgrade
            </Link>
          </p>
        )}
        {errors.frequency && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.frequency}</p>
        )}
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {value.frequency === 'weekly' && (
          <Field label="Day of the week" error={errors.weekday}>
            {(p) => (
              <Select
                {...p}
                value={value.weekday}
                onChange={(e) => onChange({ weekday: Number(e.target.value) })}
              >
                {WEEKDAY_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {value.frequency === 'monthly' && (
          <Field
            label="Day of the month"
            hint="1–28, so every month has it."
            error={errors.dayOfMonth}
          >
            {(p) => (
              <Select
                {...p}
                value={value.dayOfMonth}
                onChange={(e) => onChange({ dayOfMonth: Number(e.target.value) })}
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {ordinal(d)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Time" error={errors.hour}>
          {(p) => (
            <Select
              {...p}
              value={value.hour}
              onChange={(e) => onChange({ hour: Number(e.target.value) })}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Time zone" error={errors.timezone}>
          {(p) => (
            <Select
              {...p}
              value={value.timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </div>
  );
}
