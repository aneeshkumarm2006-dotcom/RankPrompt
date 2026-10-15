import { useState } from 'react';
import { Field, Input, Select } from '../../components/ui/Field';

const NEW = '__new__';

/** Pick an existing category or type a new one. `value` is the chosen or typed name. */
export function CategoryPicker({
  categories,
  value,
  onChange,
  error,
}: {
  categories: string[];
  value: string;
  onChange: (category: string) => void;
  error?: string | undefined;
}) {
  const [typing, setTyping] = useState(categories.length === 0 || !categories.includes(value));
  return (
    <div className="space-y-3">
      <Field label="Category" error={typing ? undefined : error}>
        {(props) => (
          <Select
            {...props}
            value={typing ? NEW : value}
            onChange={(e) => {
              if (e.target.value === NEW) {
                setTyping(true);
                onChange('');
              } else {
                setTyping(false);
                onChange(e.target.value);
              }
            }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={NEW}>New category…</option>
          </Select>
        )}
      </Field>
      {typing && (
        <Field label="New category name" error={error}>
          {(props) => (
            <Input
              {...props}
              value={value}
              maxLength={100}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g. Pricing"
              invalid={Boolean(error)}
            />
          )}
        </Field>
      )}
    </div>
  );
}
