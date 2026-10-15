import type { Prompt } from '@pv/shared';
import { ListChecks, Plus, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router';
import { useBrandOutlet } from '../../app/layout/useBrandOutlet';
import { Button, buttonClass } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Checkbox } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/PageHeader';
import { PageSpinner } from '../../components/ui/Spinner';
import { usePromptHistory } from '../../lib/api/insights';
import { useArchivePrompt, usePrompts } from '../../lib/api/prompts';
import { errorMessage } from '../../lib/errors';
import { pluralize } from '../../lib/format';
import { CategorySelect, FilterBar } from '../insights/FilterSelects';
import { AddPromptsModal } from './AddPromptsModal';
import { EditPromptModal } from './EditPromptModal';
import { allCategories, groupPrompts, replacedByMap } from './promptLibrary';
import type { HistoryEntry } from './PromptHistory';
import { PromptRow } from './PromptRow';

const NO_HISTORY: HistoryEntry[] = [];

/** The brand's prompt library (F-22, D-014; v1 AllPrompts). */
export function PromptLibraryPage() {
  const brand = useBrandOutlet();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [archiving, setArchiving] = useState<Prompt | null>(null);

  const prompts = usePrompts(brand.id, showArchived);
  const history = usePromptHistory(brand.id);
  const archive = useArchivePrompt(brand.id);

  const list = useMemo(() => prompts.data ?? [], [prompts.data]);
  const categories = useMemo(
    () =>
      allCategories(
        brand.categories.map((c) => c.name),
        list,
      ),
    [brand.categories, list],
  );
  const groups = useMemo(
    () => groupPrompts(list, categories, { search, category }),
    [list, categories, search, category],
  );
  const replacedBy = useMemo(() => replacedByMap(list), [list]);
  const historyById = useMemo(
    () => new Map((history.data?.prompts ?? []).map((p) => [p.promptId, p.history])),
    [history.data],
  );
  const activeCount = list.filter((p) => p.archivedAt === null).length;
  const shownCount = groups.reduce((n, [, ps]) => n + ps.length, 0);
  // Pick lists in the modals: active categories only, brand ones first.
  const pickCategories = allCategories(
    brand.categories.map((c) => c.name),
    list.filter((p) => p.archivedAt === null),
  );

  const confirmArchive = () => {
    if (!archiving) return;
    archive.mutate(archiving.id, {
      onSuccess: () => {
        toast.success('Prompt archived');
        setArchiving(null);
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <>
      <PageHeader
        title="All Prompts"
        description={`${brand.name} · ${pluralize(activeCount, 'active prompt')}`}
        actions={
          <>
            <Link to={`/app/brands/new?brandId=${brand.id}`} className={buttonClass('outline')}>
              <Sparkles className="w-4 h-4" aria-hidden />
              Generate more
            </Link>
            <Button icon={<Plus className="w-4 h-4" aria-hidden />} onClick={() => setAdding(true)}>
              Add prompts
            </Button>
          </>
        }
      />

      <FilterBar>
        <div className="flex flex-col gap-1 flex-1 min-w-[14rem]">
          <label
            htmlFor="prompt-search"
            className="text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            Search
          </label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              aria-hidden
            />
            <input
              id="prompt-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts…"
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-dark-800 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-dark-600 focus:border-primary-500 focus:outline-none text-sm"
            />
          </div>
        </div>
        <CategorySelect value={category} categories={categories} onChange={setCategory} />
        <div className="sm:pb-2">
          <Checkbox checked={showArchived} onChange={setShowArchived} label="Show archived" />
        </div>
      </FilterBar>

      {prompts.isPending ? (
        <PageSpinner label="Loading prompts…" />
      ) : prompts.isError ? (
        <ErrorState error={prompts.error} onRetry={() => void prompts.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No prompts yet"
          message="Add the questions your customers ask AI assistants, or generate them from your brand."
          action={
            <Button icon={<Plus className="w-4 h-4" aria-hidden />} onClick={() => setAdding(true)}>
              Add prompts
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Showing {pluralize(shownCount, 'prompt')}
            {history.isError && ' · history could not be loaded'}
          </p>
          {groups.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">No prompts match these filters.</p>
          ) : (
            <div className="space-y-6">
              {groups.map(([cat, ps]) => (
                <section
                  key={cat}
                  aria-label={cat}
                  className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700"
                >
                  <h2 className="px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-dark-700 font-semibold text-gray-800 dark:text-white flex items-center justify-between">
                    <span>{cat}</span>
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                      {pluralize(ps.length, 'prompt')}
                    </span>
                  </h2>
                  <ul className="divide-y divide-gray-100 dark:divide-dark-700">
                    {ps.map((p) => (
                      <PromptRow
                        key={p.id}
                        prompt={p}
                        replacedBy={replacedBy.get(p.id)}
                        history={historyById.get(p.id) ?? NO_HISTORY}
                        historyLoading={history.isPending}
                        onEdit={setEditing}
                        onArchive={setArchiving}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <AddPromptsModal
        open={adding}
        brandId={brand.id}
        categories={pickCategories}
        onClose={() => setAdding(false)}
      />
      <EditPromptModal
        brandId={brand.id}
        prompt={editing}
        categories={pickCategories}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={archiving !== null}
        title="Archive prompt?"
        message={
          <>
            <p className="mb-2">“{archiving?.text}”</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              It won’t be included in new reports or schedules. Its past results and history are
              kept.
            </p>
          </>
        }
        confirmLabel="Archive"
        danger
        loading={archive.isPending}
        onConfirm={confirmArchive}
        onClose={() => setArchiving(null)}
      />
    </>
  );
}
