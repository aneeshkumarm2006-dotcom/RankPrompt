import type { Brand, Prompt } from '@pv/shared';
import { ArrowRight, Plus, Save, Sparkles } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/PageHeader';
import { useMe } from '../../../lib/api/auth';
import { useAddPrompts } from '../../../lib/api/prompts';
import { errorMessage } from '../../../lib/errors';
import { pluralize } from '../../../lib/format';
import { DraftRow } from './DraftRow';
import { draftCategoryOptions, draftErrors, draftsToBody } from './drafts';
import { SavedPrompts } from './SavedPrompts';
import { draftKey, type Draft } from './useWizard';

/**
 * Step 3: review drafts (edit, recategorise, delete, add custom ones), then save them to the
 * prompt library (F-09). Saved prompts persist, so a resume never regenerates them.
 */
export function StepPrompts({
  brand,
  saved,
  drafts,
  setDrafts,
  onSaved,
  onGenerateMore,
  onContinue,
}: {
  brand: Brand;
  /** The brand's active prompts. */
  saved: Prompt[];
  drafts: Draft[];
  setDrafts: (update: (drafts: Draft[]) => Draft[]) => void;
  /** After a save; resolves once the prompt list is fresh. */
  onSaved: () => Promise<unknown>;
  onGenerateMore: () => void;
  onContinue: () => void;
}) {
  const { data: me } = useMe();
  const max = me?.workspace.limits.maxPromptsPerRun ?? 25;
  const add = useAddPrompts(brand.id);
  const [filter, setFilter] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const categories = draftCategoryOptions(brand, drafts);
  const errors = showErrors ? draftErrors(drafts) : {};
  const full = drafts.length >= max;
  const shown = filter ? drafts.filter((d) => d.category === filter) : drafts;

  const patch = (key: string, p: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...p } : d)));

  const addCustom = () => {
    if (full) return;
    const category = filter ?? categories[0] ?? 'General';
    setDrafts((ds) => [...ds, { key: draftKey(), text: '', category, source: 'manual' }]);
  };

  const save = async () => {
    setShowErrors(true);
    if (Object.keys(draftErrors(drafts)).length > 0) return;
    setSaving(true);
    try {
      const created = await add.mutateAsync(draftsToBody(drafts));
      const skipped = drafts.length - created.length;
      toast.success(
        `Saved ${pluralize(created.length, 'prompt')}` +
          (skipped > 0 ? ` (${skipped} already in your library)` : ''),
      );
      setDrafts(() => []);
      setShowErrors(false);
      await onSaved();
      onContinue();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {saved.length > 0 && <SavedPrompts brandId={brand.id} prompts={saved} />}

      <Card
        title={saved.length > 0 ? 'New prompts' : 'Review your prompts'}
        actions={
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {drafts.length}/{max}
          </span>
        }
      >
        {drafts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {saved.length > 0
              ? 'Generate more prompts or write your own to add them to this brand.'
              : 'Write the questions customers would ask an AI assistant, or go back and generate them.'}
          </p>
        ) : (
          <>
            {categories.length > 1 && (
              <div
                className="flex flex-wrap gap-2 mb-4"
                role="group"
                aria-label="Filter by category"
              >
                {[null, ...categories].map((c) => (
                  <button
                    key={c ?? '__all'}
                    type="button"
                    aria-pressed={filter === c}
                    onClick={() => setFilter(c)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      filter === c
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-dark-700'
                    }`}
                  >
                    {c ?? 'All'}
                  </button>
                ))}
              </div>
            )}
            <ul className="space-y-3 mb-4">
              {shown.map((d) => (
                <DraftRow
                  key={d.key}
                  index={drafts.indexOf(d)}
                  draft={d}
                  categories={categories}
                  error={errors[d.key]}
                  onChange={(p) => patch(d.key, p)}
                  onRemove={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
                />
              ))}
            </ul>
          </>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={addCustom}
            disabled={full}
          >
            Add your own prompt
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Sparkles className="w-4 h-4" />}
            onClick={onGenerateMore}
          >
            Generate {drafts.length > 0 || saved.length > 0 ? 'more' : 'prompts'}
          </Button>
          {full && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Your plan runs up to {max} prompts at a time.{' '}
              <Link to="/app/billing" className="text-action-600 hover:underline">
                Upgrade
              </Link>
            </span>
          )}
        </div>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
        {drafts.length > 0 ? (
          <Button
            size="lg"
            icon={<Save className="w-5 h-5" />}
            onClick={() => void save()}
            loading={saving}
          >
            Save {pluralize(drafts.length, 'prompt')} and continue
          </Button>
        ) : (
          <Button size="lg" onClick={onContinue} disabled={saved.length === 0}>
            Continue to run setup <ArrowRight className="w-5 h-5" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
