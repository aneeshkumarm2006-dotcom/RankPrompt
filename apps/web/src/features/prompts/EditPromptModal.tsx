import type { PatchPromptBody, Prompt } from '@pv/shared';
import { Info } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Field, Textarea } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { useEditPrompt } from '../../lib/api/prompts';
import { errorMessage } from '../../lib/errors';
import { CategoryPicker } from './CategoryPicker';
import { PROMPT_MAX, PROMPT_MIN } from './promptLibrary';

/** Only the fields that changed; null when nothing did. */
export function promptPatch(
  prompt: Pick<Prompt, 'text' | 'category'>,
  text: string,
  category: string,
): PatchPromptBody | null {
  const t = text.trim();
  const c = category.trim();
  const patch: PatchPromptBody = {};
  if (t !== prompt.text) patch.text = t;
  if (c !== prompt.category) patch.category = c;
  return Object.keys(patch).length > 0 ? patch : null;
}

function EditPromptForm({
  brandId,
  prompt,
  categories,
  onDone,
}: {
  brandId: string;
  prompt: Prompt;
  categories: string[];
  onDone: () => void;
}) {
  const edit = useEditPrompt(brandId);
  const [text, setText] = useState(prompt.text);
  const [category, setCategory] = useState(prompt.category);
  const trimmed = text.trim();
  const textChanged = trimmed !== prompt.text;
  const textError =
    trimmed.length < PROMPT_MIN
      ? `At least ${PROMPT_MIN} characters`
      : trimmed.length > PROMPT_MAX
        ? `At most ${PROMPT_MAX} characters`
        : undefined;
  const categoryError = category.trim() ? undefined : 'Choose or name a category';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (textError || categoryError) return;
    const patch = promptPatch(prompt, text, category);
    if (!patch) {
      onDone();
      return;
    }
    edit.mutate(
      { id: prompt.id, ...patch },
      {
        onSuccess: () => {
          toast.success(patch.text ? 'Saved as a new version' : 'Prompt updated');
          onDone();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Prompt" error={textError}>
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            invalid={Boolean(textError)}
          />
        )}
      </Field>
      {textChanged && (
        <p className="flex gap-2 text-sm rounded-xl p-3 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          Changing the text starts a new version of this prompt. Past results stay with the old
          version, which is archived, so trends never mix two different questions.
        </p>
      )}
      <CategoryPicker
        categories={categories}
        value={category}
        onChange={setCategory}
        error={categoryError}
      />
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onDone} disabled={edit.isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={edit.isPending}
          disabled={Boolean(textError || categoryError)}
        >
          Save
        </Button>
      </div>
    </form>
  );
}

/** Edit a prompt's text and/or category (D-014: a text change makes a new prompt). */
export function EditPromptModal({
  brandId,
  prompt,
  categories,
  onClose,
}: {
  brandId: string;
  prompt: Prompt | null;
  categories: string[];
  onClose: () => void;
}) {
  return (
    <Modal open={prompt !== null} onClose={onClose} title="Edit prompt" size="lg">
      {prompt && (
        <EditPromptForm
          key={prompt.id}
          brandId={brandId}
          prompt={prompt}
          categories={categories}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}
