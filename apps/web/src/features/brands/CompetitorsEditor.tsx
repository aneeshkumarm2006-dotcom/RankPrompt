import { MAX_ALIASES, MAX_COMPETITORS, type Brand, type CompetitorInput } from '@pv/shared';
import { Plus, Save, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { BrandAvatar } from '../../components/ui/BrandAvatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Card } from '../../components/ui/PageHeader';
import { useUpdateCompetitors } from '../../lib/api/brands';
import { errorMessage, fieldErrors, hasCode } from '../../lib/errors';
import { normText } from './brandForm';
import { ChipInput } from './ChipInput';

interface Row {
  key: string;
  /** Kept for existing competitors so past results stay linked (08 § PUT competitors). */
  id?: string;
  name: string;
  domain: string;
  aliases: string[];
}

let nextKey = 0;
const newKey = () => `new-${++nextKey}`;

const rowsFrom = (brand: Brand): Row[] =>
  brand.competitors.map((c) => ({
    key: c.id,
    id: c.id,
    name: c.name,
    domain: c.domain,
    aliases: c.aliases,
  }));

export function toCompetitorInputs(rows: readonly Row[]): CompetitorInput[] {
  return rows.map((r) => ({
    ...(r.id ? { id: r.id } : {}),
    name: normText(r.name),
    domain: r.domain.trim(),
    aliases: r.aliases,
  }));
}

function validate(rows: readonly Row[]): Record<string, string> {
  const errors: Record<string, string> = {};
  rows.forEach((r, i) => {
    if (!normText(r.name)) errors[`competitors.${i}.name`] = 'Enter a name';
    if (r.domain.trim().length < 3) errors[`competitors.${i}.domain`] = 'Enter a domain';
  });
  return errors;
}

/** Tracked competitors (F-18): name, domain and aliases per row, saved with one PUT. */
export function CompetitorsEditor({ brand, readOnly }: { brand: Brand; readOnly: boolean }) {
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(brand));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useUpdateCompetitors(brand.id);

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = () => {
    const local = validate(rows);
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    save.mutate(toCompetitorInputs(rows), {
      onSuccess: () => toast.success('Competitors saved'),
      onError: (err) => {
        const fields = fieldErrors(err);
        setErrors(fields);
        if (Object.keys(fields).length === 0 || hasCode(err, 'NOT_FOUND')) {
          toast.error(errorMessage(err));
        }
      },
    });
  };

  return (
    <Card
      title="Competitors"
      actions={
        !readOnly && (
          <Button
            size="sm"
            icon={<Save className="w-4 h-4" />}
            onClick={submit}
            loading={save.isPending}
          >
            Save competitors
          </Button>
        )
      }
    >
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Brands you compare against. Aliases help us spot them in AI answers.
      </p>
      {rows.length === 0 && (
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <Users className="w-5 h-5" aria-hidden /> No competitors tracked yet.
        </div>
      )}
      <ul className="space-y-3">
        {rows.map((r, i) => {
          const nameError = errors[`competitors.${i}.name`];
          const domainError = errors[`competitors.${i}.domain`];
          return (
            <li
              key={r.key}
              className="rounded-xl border border-gray-200 dark:border-dark-700 p-3 bg-gray-50 dark:bg-dark-900 space-y-2"
            >
              <div className="flex items-start gap-2">
                <div className="pt-1.5">
                  <BrandAvatar name={r.name || '?'} domain={r.domain.trim() || null} size="sm" />
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Input
                      aria-label={`Competitor ${i + 1} name`}
                      value={r.name}
                      maxLength={100}
                      placeholder="Name"
                      invalid={Boolean(nameError)}
                      onChange={(e) => update(r.key, { name: e.target.value })}
                      className="py-2"
                    />
                    {nameError && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{nameError}</p>
                    )}
                  </div>
                  <div>
                    <Input
                      aria-label={`Competitor ${i + 1} domain`}
                      value={r.domain}
                      maxLength={2048}
                      placeholder="example.com"
                      invalid={Boolean(domainError)}
                      onChange={(e) => update(r.key, { domain: e.target.value })}
                      className="py-2"
                    />
                    {domainError && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{domainError}</p>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Remove competitor ${r.name || i + 1}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden />
                  </button>
                )}
              </div>
              <div className="sm:pl-10">
                <ChipInput
                  compact
                  label={`Competitor ${i + 1} aliases`}
                  value={r.aliases}
                  onChange={(aliases) => update(r.key, { aliases })}
                  max={MAX_ALIASES}
                  placeholder="Aliases (optional), press Enter to add"
                  disabled={readOnly}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {!readOnly && rows.length < MAX_COMPETITORS && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          icon={<Plus className="w-4 h-4" />}
          onClick={() =>
            setRows((rs) => [...rs, { key: newKey(), name: '', domain: '', aliases: [] }])
          }
        >
          Add competitor
        </Button>
      )}
    </Card>
  );
}
