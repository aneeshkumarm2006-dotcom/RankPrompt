import type { AnalyzeBrandResponse, Brand } from '@pv/shared';
import { AlertCircle, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Field, Input } from '../../../components/ui/Field';
import { useMe } from '../../../lib/api/auth';
import { useAnalyzeBrand } from '../../../lib/api/brands';
import { errorMessage, fieldErrors, hasCode } from '../../../lib/errors';
import { normText } from '../brandForm';
import { BrandLimitBanner, isBrandLimitReached } from '../BrandLimitBanner';
import { BrandReview } from './BrandReview';
import { BusyOverlay } from './BusyOverlay';

/** Analysis failures worth offering "continue without it" for. */
const canSkip = (err: unknown) =>
  hasCode(err, 'UPSTREAM_UNAVAILABLE') || hasCode(err, 'RATE_LIMITED');

function analyzeErrorText(err: unknown): string {
  if (hasCode(err, 'UPSTREAM_UNAVAILABLE')) {
    return 'Our AI provider is unavailable right now. Try again in a minute, or continue and fill in the details yourself.';
  }
  if (hasCode(err, 'RATE_LIMITED')) {
    return 'You’ve analysed a lot of brands in the last hour. Try again later, or continue and fill in the details yourself.';
  }
  return errorMessage(err);
}

/** Step 1: brand name + website → `POST /brands/analyze` → review and create (F-06, F-07). */
export function StepBrand({ onCreated }: { onCreated: (brand: Brand) => void }) {
  const { data: me } = useMe();
  const analyze = useAnalyzeBrand();
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** `undefined` = still on the form; `null` = continuing without an analysis. */
  const [analysis, setAnalysis] = useState<AnalyzeBrandResponse | null | undefined>(undefined);
  const full = isBrandLimitReached(me);

  if (analysis !== undefined) {
    return (
      <BrandReview
        name={normText(name)}
        websiteUrl={websiteUrl.trim()}
        analysis={analysis}
        onBack={() => {
          analyze.reset();
          setAnalysis(undefined);
        }}
        onCreated={onCreated}
      />
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!normText(name)) local.name = 'Enter the brand name';
    if (websiteUrl.trim().length < 3) local.websiteUrl = 'Enter the website, e.g. example.com';
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    analyze.mutate(
      { name: normText(name), websiteUrl: websiteUrl.trim() },
      {
        onSuccess: setAnalysis,
        onError: (err) => setErrors(fieldErrors(err)),
      },
    );
  };

  return (
    <div className="space-y-6">
      {me && full && <BrandLimitBanner me={me} />}
      <form
        onSubmit={submit}
        noValidate
        className="bg-white dark:bg-dark-900 border border-gray-200 dark:border-dark-700 rounded-2xl p-4 sm:p-6 md:p-8 space-y-6"
      >
        <Field label="Brand name" error={errors.name}>
          {(p) => (
            <Input
              {...p}
              value={name}
              maxLength={100}
              autoComplete="organization"
              placeholder="PromptVerse"
              invalid={Boolean(errors.name)}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Website URL"
          error={errors.websiteUrl}
          hint="Just the domain is fine. We read the site to describe the brand."
        >
          {(p) => (
            <Input
              {...p}
              value={websiteUrl}
              maxLength={2048}
              inputMode="url"
              autoComplete="url"
              placeholder="promptverse.com"
              invalid={Boolean(errors.websiteUrl)}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          )}
        </Field>

        {analyze.isError && Object.keys(errors).length === 0 && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-xl border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
            <div className="text-sm space-y-2">
              <p>{analyzeErrorText(analyze.error)}</p>
              {canSkip(analyze.error) && (
                <Button variant="outline" size="sm" onClick={() => setAnalysis(null)}>
                  Continue without analysis
                </Button>
              )}
            </div>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          icon={<Sparkles className="w-5 h-5" />}
          loading={analyze.isPending}
          disabled={full}
        >
          Analyze brand
        </Button>
      </form>

      <BusyOverlay
        open={analyze.isPending}
        title="Analyzing your brand"
        message={`Reading ${websiteUrl.trim() || 'the website'} and drafting a summary, categories and aliases…`}
      />
    </div>
  );
}
