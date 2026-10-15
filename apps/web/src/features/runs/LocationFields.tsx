import { COUNTRIES, LANGUAGES, type CountryCode, type LanguageCode, type Scope } from '@pv/shared';
import { Globe, MapPin } from 'lucide-react';
import { Field, Input, Select } from '../../components/ui/Field';

export interface LocationValue {
  scope: Scope;
  country: CountryCode;
  city: string | null;
  language: LanguageCode;
}

/** v1 Reports.jsx step 1: local/national toggle, city, country and language (F-06). */
export function LocationFields({
  value,
  onChange,
  errors = {},
}: {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  errors?: Partial<Record<keyof LocationValue, string>>;
}) {
  const set = <K extends keyof LocationValue>(key: K, v: LocationValue[K]) =>
    onChange({ ...value, [key]: v });

  const scopeButton = (scope: Scope, label: string, Icon: typeof Globe) => (
    <button
      type="button"
      aria-pressed={value.scope === scope}
      onClick={() => onChange({ ...value, scope, city: scope === 'national' ? null : value.city })}
      className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl transition-all ${
        value.scope === scope
          ? 'bg-action-600 text-white'
          : 'bg-gray-100 dark:bg-dark-800 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-700'
      }`}
    >
      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
      <span className="text-sm sm:text-base font-medium">{label}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      <div>
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Search scope
        </span>
        <div className="flex gap-3" role="group" aria-label="Search scope">
          {scopeButton('local', 'Local Search', MapPin)}
          {scopeButton('national', 'National Search', Globe)}
        </div>
        <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">
          {value.scope === 'local'
            ? "Target customers in your city or region (e.g. 'Best dentist in Dallas')."
            : 'Target customers nationwide.'}
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${value.scope === 'local' ? 'sm:grid-cols-2' : ''}`}>
        {value.scope === 'local' && (
          <Field label="City / Location" error={errors.city}>
            {(p) => (
              <Input
                {...p}
                value={value.city ?? ''}
                onChange={(e) => set('city', e.target.value === '' ? null : e.target.value)}
                placeholder="e.g. Toronto, New York, London"
                invalid={Boolean(errors.city)}
              />
            )}
          </Field>
        )}
        <Field
          label={value.scope === 'local' ? 'Country' : 'Target Country'}
          error={errors.country}
        >
          {(p) => (
            <Select
              {...p}
              value={value.country}
              onChange={(e) => set('country', e.target.value as CountryCode)}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Language" error={errors.language}>
        {(p) => (
          <Select
            {...p}
            value={value.language}
            onChange={(e) => set('language', e.target.value as LanguageCode)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}
