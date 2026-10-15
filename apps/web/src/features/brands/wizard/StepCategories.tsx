import { MAX_CATEGORIES, type Brand } from '@pv/shared';
import { ArrowRight, MapPin, PenLine, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { Checkbox, Input } from '../../../components/ui/Field';
import { Card } from '../../../components/ui/PageHeader';
import { useMe } from '../../../lib/api/auth';
import { useGeneratePrompts } from '../../../lib/api/prompts';
import { errorMessage, hasCode } from '../../../lib/errors';
import { languageLabel, locationLabel } from '../../../lib/format';
import { normText } from '../brandForm';
import { BusyOverlay } from './BusyOverlay';
import { draftKey, type Draft } from './useWizard';

/** v1 Step2BrandAnalysis offered 1 / 10 / 25 prompts; capped at the plan's prompts per run. */
export function promptCountChoices(maxPromptsPerRun: number): number[] {
  const choices = [1, 10, 25].filter((n) => n <= maxPromptsPerRun);
  return choices.length > 0 ? choices : [Math.max(1, maxPromptsPerRun)];
}

function generateErrorText(err: unknown): string {
  if (hasCode(err, 'UPSTREAM_UNAVAILABLE')) {
    return 'Our AI provider is unavailable right now. Try again in a minute, or write your own prompts.';
  }
  if (hasCode(err, 'RATE_LIMITED')) {
    return 'You’ve generated a lot of prompts in the last hour. Try again later, or write your own.';
  }
  return errorMessage(err);
}

/** Step 2: which categories to write prompts for, and how many (F-08, F-09). */
export function StepCategories({
  brand,
  onDrafts,
  onSkip,
}: {
  brand: Brand;
  /** Generated drafts, to review in step 3 (nothing is saved yet). */
  onDrafts: (drafts: Draft[]) => void;
  /** "Write your own prompts" instead (v1's custom tab). */
  onSkip: () => void;
}) {
  const { data: me } = useMe();
  const choices = promptCountChoices(me?.workspace.limits.maxPromptsPerRun ?? 25);
  const generate = useGeneratePrompts(brand.id);

  const [names, setNames] = useState<string[]>(() =>
    brand.categories.map((c) => c.name).slice(0, MAX_CATEGORIES),
  );
  const [extra, setExtra] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [picked, setCount] = useState<number | null>(null);
  const count = picked !== null && choices.includes(picked) ? picked : (choices.at(-1) ?? 1);
  const [empty, setEmpty] = useState(false);

  const all = [...brand.categories.map((c) => c.name), ...extra];
  const full = names.length >= MAX_CATEGORIES;
  const toggle = (name: string, on: boolean) =>
    setNames((ns) => (on ? [...ns, name] : ns.filter((n) => n !== name)));

  const addCustom = () => {
    const name = normText(custom);
    if (!name || full) return;
    if (!all.some((n) => n.toLowerCase() === name.toLowerCase())) setExtra((x) => [...x, name]);
    setNames((ns) => (ns.some((n) => n.toLowerCase() === name.toLowerCase()) ? ns : [...ns, name]));
    setCustom('');
  };

  const run = () => {
    setEmpty(false);
    const { scope, country, city, language } = brand.defaults;
    generate.mutate(
      { categories: names, count, scope, country, city, language },
      {
        onSuccess: ({ drafts }) => {
          if (drafts.length === 0) {
            setEmpty(true);
            return;
          }
          onDrafts(drafts.map((d) => ({ ...d, key: draftKey(), source: 'generated' as const })));
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <Card title="Generate prompts by category">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex items-start gap-2">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            Prompts are written for customers in{' '}
            <strong>{locationLabel(brand.defaults.country, brand.defaults.city)}</strong>, in{' '}
            <strong>{languageLabel(brand.defaults.language)}</strong> (
            <Link
              to={`/app/brands/${brand.id}/settings`}
              className="text-action-600 hover:underline"
            >
              change defaults
            </Link>
            ).
          </span>
        </p>

        <fieldset className="mb-6">
          <legend className="flex w-full items-center justify-between mb-3">
            <span className="font-medium text-gray-800 dark:text-white">Categories</span>
            <span className="text-sm font-semibold text-action-600 dark:text-action-400">
              {names.length}/{MAX_CATEGORIES} selected
            </span>
          </legend>
          {all.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              This brand has no categories yet. Add one below.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {all.map((name) => {
              const on = names.includes(name);
              const description = brand.categories.find((c) => c.name === name)?.description;
              return (
                <Checkbox
                  key={name}
                  checked={on}
                  disabled={!on && full}
                  onChange={(v) => toggle(name, v)}
                  label={name}
                  description={description || undefined}
                />
              );
            })}
          </div>
          {!full && (
            <div className="mt-4 flex gap-2">
              <Input
                aria-label="Another category"
                value={custom}
                maxLength={100}
                placeholder="Another category"
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                className="py-2"
              />
              <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={addCustom}>
                Add
              </Button>
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="font-medium text-gray-800 dark:text-white mb-3">
            Number of prompts to generate
          </legend>
          <div className="flex flex-wrap gap-3">
            {choices.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={count === n}
                onClick={() => setCount(n)}
                className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                  count === n
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-dark-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>
      </Card>

      {(generate.isError || empty) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {empty
            ? 'No prompts came back for these categories. Try again, or write your own.'
            : generateErrorText(generate.error)}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Button
          variant="secondary"
          size="lg"
          icon={<PenLine className="w-5 h-5" />}
          onClick={onSkip}
        >
          Write your own prompts
        </Button>
        <Button size="lg" onClick={run} loading={generate.isPending} disabled={names.length === 0}>
          Generate {count} prompt{count === 1 ? '' : 's'}{' '}
          <ArrowRight className="w-5 h-5" aria-hidden />
        </Button>
      </div>

      <BusyOverlay
        open={generate.isPending}
        title="Generating prompts"
        message={`Writing ${count} questions customers might ask an AI assistant about ${brand.name}’s market…`}
      />
    </div>
  );
}
