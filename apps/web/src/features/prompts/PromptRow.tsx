import type { Prompt } from '@pv/shared';
import { Archive, ChevronDown, ChevronRight, CornerDownRight, Pencil } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { formatDate, pluralize } from '../../lib/format';
import { PromptHistory, type HistoryEntry } from './PromptHistory';

/** One library prompt, expandable to its result history (F-22). */
export function PromptRow({
  prompt,
  replacedBy,
  history,
  historyLoading,
  onEdit,
  onArchive,
}: {
  prompt: Prompt;
  /** The newer version, when this prompt's text was edited (D-014). */
  replacedBy: Prompt | undefined;
  history: HistoryEntry[];
  historyLoading: boolean;
  onEdit: (prompt: Prompt) => void;
  onArchive: (prompt: Prompt) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const archived = prompt.archivedAt !== null;

  return (
    <li className={archived ? 'opacity-60' : ''}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-6 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex items-start gap-2 flex-1 min-w-0 text-left group"
        >
          {open ? (
            <ChevronDown className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" aria-hidden />
          ) : (
            <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" aria-hidden />
          )}
          <span className="min-w-0">
            <span
              className={`block text-gray-800 dark:text-gray-200 group-hover:text-action-600 ${
                archived ? 'line-through decoration-gray-400' : ''
              }`}
            >
              {prompt.text}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {historyLoading ? 'Loading history…' : pluralize(history.length, 'report')}
              </span>
              <span aria-hidden>·</span>
              <span>Added {formatDate(prompt.createdAt)}</span>
            </span>
          </span>
        </button>
        <div className="flex flex-wrap items-center gap-2 pl-6 sm:pl-0">
          <Badge tone={prompt.source === 'generated' ? 'purple' : 'gray'}>
            {prompt.source === 'generated' ? 'Generated' : 'Manual'}
          </Badge>
          {prompt.replacesId && <Badge tone="blue">Edited version</Badge>}
          {archived ? (
            <Badge tone="orange">Archived {formatDate(prompt.archivedAt)}</Badge>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<Pencil className="w-4 h-4" aria-hidden />}
                onClick={() => onEdit(prompt)}
                aria-label={`Edit prompt: ${prompt.text}`}
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Archive className="w-4 h-4" aria-hidden />}
                onClick={() => onArchive(prompt)}
                aria-label={`Archive prompt: ${prompt.text}`}
              >
                Archive
              </Button>
            </>
          )}
        </div>
      </div>
      {archived && replacedBy && (
        <p className="flex items-start gap-1.5 px-4 sm:px-6 pb-3 pl-10 sm:pl-12 text-xs text-gray-500 dark:text-gray-400">
          <CornerDownRight className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
          <span>
            Replaced by: <span className="italic">{replacedBy.text}</span>
          </span>
        </p>
      )}
      {open && (
        <div
          id={panelId}
          className="mx-4 sm:mx-6 mb-4 p-4 rounded-xl bg-gray-50 dark:bg-dark-900 border border-gray-200 dark:border-dark-700"
        >
          {historyLoading ? <Spinner size="sm" /> : <PromptHistory history={history} />}
        </div>
      )}
    </li>
  );
}
