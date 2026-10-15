import { MAX_COMPETITORS, type Brand, type CompetitorInsights } from '@pv/shared';
import { Plus, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/PageHeader';
import { useUpdateCompetitors } from '../../lib/api/brands';
import { errorMessage, fieldErrors } from '../../lib/errors';
import { rank } from '../../lib/format';
import { domainError, withAddedCompetitor } from './competitors';

type Suggestion = CompetitorInsights['suggestedCompetitors'][number];

/** Asks for the domain (required by `competitorInputSchema`), then PUTs the full list. */
export function TrackCompetitorModal({
  brand,
  suggestion,
  onClose,
}: {
  brand: Brand;
  suggestion: Suggestion | null;
  onClose: () => void;
}) {
  const update = useUpdateCompetitors(brand.id);
  const [domain, setDomain] = useState('');
  const [touched, setTouched] = useState(false);
  const localError = touched ? domainError(domain) : undefined;
  // The new competitor is last in the PUT body.
  const domainPath = `competitors.${brand.competitors.length}.domain`;
  const error = localError ?? fieldErrors(update.error)[domainPath];

  const close = () => {
    setDomain('');
    setTouched(false);
    update.reset();
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!suggestion || domainError(domain)) return;
    update.mutate(withAddedCompetitor(brand.competitors, { name: suggestion.name, domain }), {
      onSuccess: () => {
        toast.success(`Now tracking ${suggestion.name}`);
        close();
      },
      onError: (err) => {
        if (!fieldErrors(err)[domainPath]) toast.error(errorMessage(err));
      },
    });
  };

  return (
    <Modal
      open={suggestion !== null}
      onClose={close}
      title={`Track ${suggestion?.name ?? 'competitor'}`}
      size="sm"
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Add their website so future reports can match them by name and by domain.
        </p>
        <Field label="Website domain" error={error} hint="For example competitor.com">
          {(props) => (
            <Input
              {...props}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="competitor.com"
              autoComplete="off"
              invalid={Boolean(error)}
            />
          )}
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={close} disabled={update.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={update.isPending}>
            Track competitor
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Vendors the AIs recommend that aren't tracked yet (F-42), with "Track". */
export function SuggestedCompetitors({
  brand,
  suggestions,
}: {
  brand: Brand;
  suggestions: Suggestion[];
}) {
  const [tracking, setTracking] = useState<Suggestion | null>(null);
  const full = brand.competitors.length >= MAX_COMPETITORS;
  return (
    <Card title="Suggested Competitors" className="mb-6">
      {suggestions.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No untracked vendors were recommended in this run.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-action-500" aria-hidden />
            Often recommended by AI platforms, but not tracked yet.
          </p>
          <ul className="divide-y divide-gray-200 dark:divide-dark-700">
            {suggestions.map((s) => (
              <li key={s.name} className="flex flex-wrap items-center gap-3 py-3">
                <span className="flex-1 min-w-0 font-medium text-gray-800 dark:text-gray-200 truncate">
                  {s.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {s.mentions} {s.mentions === 1 ? 'mention' : 'mentions'} · best {rank(s.bestRank)}{' '}
                  · avg {rank(s.avgRank)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Plus className="w-4 h-4" aria-hidden />}
                  disabled={full}
                  title={full ? `Up to ${MAX_COMPETITORS} competitors` : undefined}
                  onClick={() => setTracking(s)}
                >
                  Track
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <TrackCompetitorModal brand={brand} suggestion={tracking} onClose={() => setTracking(null)} />
    </Card>
  );
}
