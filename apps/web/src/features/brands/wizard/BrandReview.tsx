import {
  DEFAULT_BRAND_DEFAULTS,
  MAX_ALIASES,
  MAX_CATEGORIES,
  type AnalyzeBrandResponse,
  type Brand,
  type Category,
  type Platform,
} from '@pv/shared';
import { AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { BrandAvatar } from '../../../components/ui/BrandAvatar';
import { Button } from '../../../components/ui/Button';
import { Field, Textarea } from '../../../components/ui/Field';
import { Card } from '../../../components/ui/PageHeader';
import { useMe } from '../../../lib/api/auth';
import { useCreateBrand } from '../../../lib/api/brands';
import { errorMessage, fieldErrors, hasCode } from '../../../lib/errors';
import { prettyUrl } from '../../../lib/format';
import { LocationFields, type LocationValue } from '../../runs/LocationFields';
import { PlatformPicker } from '../../runs/PlatformPicker';
import { categoryErrors, cleanCategories, cleanDefaults, validateDefaults } from '../brandForm';
import { ChipInput } from '../ChipInput';
import { CategoryPicker } from './CategoryPicker';

type CreateError = { kind: 'limit' | 'exists' | 'other'; message: string };

/**
 * Step 1, second half: edit what the analysis found (summary, categories, aliases), set run
 * defaults, then create the brand (09 § Wizard: creation happens at the end of step 1).
 */
export function BrandReview({
  name,
  websiteUrl,
  analysis,
  onBack,
  onCreated,
}: {
  name: string;
  websiteUrl: string;
  /** Null when the user continued without an analysis (provider down or rate-limited). */
  analysis: AnalyzeBrandResponse | null;
  onBack: () => void;
  onCreated: (brand: Brand) => void;
}) {
  const { data: me } = useMe();
  const allowed = me?.workspace.limits.platforms ?? [];
  const create = useCreateBrand();

  const [summary, setSummary] = useState(analysis?.summary ?? '');
  const [categories, setCategories] = useState<Category[]>(() =>
    (analysis?.categories ?? [])
      .slice(0, MAX_CATEGORIES)
      .map((c) => ({ ...c, source: 'generated' as const })),
  );
  const [aliases, setAliases] = useState<string[]>(() =>
    (analysis?.suggestedAliases ?? []).slice(0, MAX_ALIASES),
  );
  const [location, setLocation] = useState<LocationValue>({
    scope: DEFAULT_BRAND_DEFAULTS.scope,
    country: DEFAULT_BRAND_DEFAULTS.country,
    city: DEFAULT_BRAND_DEFAULTS.city,
    language: DEFAULT_BRAND_DEFAULTS.language,
  });
  // null = "every platform the plan allows", until the user changes the selection.
  const [picked, setPicked] = useState<Platform[] | null>(null);
  const platforms = picked ?? allowed;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createError, setCreateError] = useState<CreateError | null>(null);

  const site = analysis?.websiteUrl ?? websiteUrl;
  const domain = analysis?.domain ?? null;

  const submit = () => {
    const defaults = cleanDefaults({ ...location, platforms }, allowed);
    const local = validateDefaults(defaults);
    if (Object.keys(categoryErrors(categories)).length > 0) {
      local.categories = 'Category names must be unique';
    }
    setErrors(local);
    setCreateError(null);
    if (Object.keys(local).length > 0) return;

    create.mutate(
      {
        name,
        websiteUrl: site,
        summary: summary.trim(),
        categories: cleanCategories(categories),
        aliases,
        defaults,
      },
      {
        onSuccess: onCreated,
        onError: (err) => {
          if (hasCode(err, 'BRAND_LIMIT_REACHED')) {
            setCreateError({ kind: 'limit', message: errorMessage(err) });
          } else if (hasCode(err, 'BRAND_EXISTS')) {
            setCreateError({ kind: 'exists', message: errorMessage(err) });
          } else if (hasCode(err, 'PLATFORM_NOT_IN_PLAN')) {
            setErrors({ 'defaults.platforms': errorMessage(err) });
          } else {
            const fields = fieldErrors(err);
            setErrors(fields);
            const first = Object.values(fields)[0];
            setCreateError({ kind: 'other', message: first ?? errorMessage(err) });
          }
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start gap-4 mb-4">
          <BrandAvatar name={name} domain={domain} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white break-words">
              {name}
            </h2>
            <a
              href={/^https?:\/\//.test(site) ? site : `https://${site}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-action-600 dark:text-action-400 hover:underline break-all"
            >
              {prettyUrl(site)} <ExternalLink className="w-3.5 h-3.5" aria-hidden />
            </a>
          </div>
        </div>
        {!analysis && (
          <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
            We couldn’t analyse the website, so fill in the details yourself. You can edit them
            later in brand settings.
          </p>
        )}
        <Field label="Brand summary" hint="Used to write prompts. Edit anything that’s off.">
          {(p) => (
            <Textarea
              {...p}
              rows={5}
              maxLength={4000}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What does the brand sell, and to whom?"
            />
          )}
        </Field>
      </Card>

      <Card>
        <CategoryPicker
          options={analysis?.categories ?? []}
          value={categories}
          onChange={setCategories}
          error={errors.categories}
        />
      </Card>

      <Card>
        <ChipInput
          label="Aliases"
          value={aliases}
          onChange={setAliases}
          max={MAX_ALIASES}
          suggestions={analysis?.suggestedAliases ?? []}
          hint="Other names AI assistants might use for this brand. They count as mentions."
          error={errors.aliases}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Default location & language">
          <LocationFields
            value={location}
            onChange={setLocation}
            errors={errors['defaults.city'] ? { city: errors['defaults.city'] } : {}}
          />
        </Card>
        <Card title="Default platforms">
          <PlatformPicker
            value={platforms}
            onChange={setPicked}
            allowed={allowed}
            error={errors['defaults.platforms']}
          />
        </Card>
      </div>

      {createError && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-xl border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
          <div className="text-sm space-y-1">
            <p>{createError.message}</p>
            {createError.kind === 'limit' && (
              <Link to="/app/billing" className="font-medium underline">
                Upgrade your plan to add more brands
              </Link>
            )}
            {createError.kind === 'exists' && (
              <Link to="/app/brands" className="font-medium underline">
                Go to your brands
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="lg" onClick={onBack} disabled={create.isPending}>
          ← Back
        </Button>
        <Button size="lg" onClick={submit} loading={create.isPending}>
          Create brand <ArrowRight className="w-5 h-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
