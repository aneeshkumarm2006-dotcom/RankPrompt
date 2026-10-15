import type { Prompt } from '@pv/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/PageHeader';
import { pluralize } from '../../../lib/format';

const PREVIEW = 5;

/** The brand's saved prompts, read-only here: the prompt library edits them (F-18). */
export function SavedPrompts({ brandId, prompts }: { brandId: string; prompts: Prompt[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? prompts : prompts.slice(0, PREVIEW);

  return (
    <Card
      title={`Saved prompts (${prompts.length})`}
      actions={
        <Link
          to={`/app/brands/${brandId}/prompts`}
          className="text-sm text-action-600 dark:text-action-400 hover:underline"
        >
          Edit in prompt library
        </Link>
      }
    >
      <ul className="space-y-2">
        {shown.map((p) => (
          <li
            key={p.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50 dark:bg-dark-800 rounded-xl px-4 py-3"
          >
            <span className="text-sm text-gray-800 dark:text-gray-200">{p.text}</span>
            <Badge tone="purple" className="self-start sm:self-auto">
              {p.category}
            </Badge>
          </li>
        ))}
      </ul>
      {prompts.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className="mt-3 inline-flex items-center gap-1 text-sm text-action-600 dark:text-action-400 hover:underline"
        >
          {all ? (
            <>
              Show less <ChevronUp className="w-4 h-4" aria-hidden />
            </>
          ) : (
            <>
              View all {pluralize(prompts.length, 'prompt')}{' '}
              <ChevronDown className="w-4 h-4" aria-hidden />
            </>
          )}
        </button>
      )}
    </Card>
  );
}
