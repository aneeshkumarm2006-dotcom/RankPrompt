import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Field, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useAddPrompts } from '../../lib/api/prompts';
import { errorMessage } from '../../lib/errors';
import { pluralize } from '../../lib/format';
import { CategoryPicker } from './CategoryPicker';
import { parsePromptLines, promptLinesError } from './promptLibrary';

function AddPromptsForm({
  brandId,
  categories,
  onDone,
}: {
  brandId: string;
  categories: string[];
  onDone: () => void;
}) {
  const add = useAddPrompts(brandId);
  const [text, setText] = useState('');
  const [category, setCategory] = useState(categories[0] ?? '');
  const [submitted, setSubmitted] = useState(false);

  const lines = parsePromptLines(text);
  const textError = submitted ? promptLinesError(lines) : undefined;
  const categoryError = submitted && !category.trim() ? 'Choose or name a category' : undefined;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (promptLinesError(lines) || !category.trim()) return;
    const cat = category.trim();
    add.mutate(
      lines.map((l) => ({ text: l, category: cat, source: 'manual' as const })),
      {
        onSuccess: (created) => {
          const skipped = lines.length - created.length;
          toast.success(
            `Added ${pluralize(created.length, 'prompt')}${
              skipped > 0 ? ` (${pluralize(skipped, 'duplicate')} skipped)` : ''
            }`,
          );
          onDone();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field
        label="Prompts"
        error={textError}
        hint="One prompt per line. Prompts you already track are skipped."
      >
        {(props) => (
          <Textarea
            {...props}
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              'What is the best CRM for small agencies?\nWhich CRM integrates with Gmail?'
            }
            invalid={Boolean(textError)}
          />
        )}
      </Field>
      <CategoryPicker
        categories={categories}
        value={category}
        onChange={setCategory}
        error={categoryError}
      />
      <div className="flex items-center justify-between gap-3 pt-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {pluralize(lines.length, 'prompt')}
        </span>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onDone} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={add.isPending}>
            Add {lines.length > 1 ? `${lines.length} prompts` : 'prompt'}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Add one or several manual prompts to the library (F-22). */
export function AddPromptsModal({
  open,
  brandId,
  categories,
  onClose,
}: {
  open: boolean;
  brandId: string;
  categories: string[];
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Add prompts" size="lg">
      {open && <AddPromptsForm brandId={brandId} categories={categories} onDone={onClose} />}
    </Modal>
  );
}
