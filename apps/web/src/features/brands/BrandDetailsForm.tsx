import { MAX_ALIASES, type Brand } from '@pv/shared';
import { Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { Card } from '../../components/ui/PageHeader';
import { useMe } from '../../lib/api/auth';
import { useUpdateBrand } from '../../lib/api/brands';
import { errorMessage, fieldErrors, hasCode } from '../../lib/errors';
import { LocationFields } from '../runs/LocationFields';
import { PlatformPicker } from '../runs/PlatformPicker';
import {
  buildBrandPatch,
  formFromBrand,
  validateBrandForm,
  type BrandFormValues,
} from './brandForm';
import { CategoriesEditor } from './CategoriesEditor';
import { ChipInput } from './ChipInput';

/** Brand settings (F-18): details, aliases, categories and run defaults, via PATCH. */
export function BrandDetailsForm({ brand, readOnly }: { brand: Brand; readOnly: boolean }) {
  const { data: me } = useMe();
  const allowed = me?.workspace.limits.platforms ?? [];
  const [form, setForm] = useState<BrandFormValues>(() => formFromBrand(brand));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = useUpdateBrand(brand.id);

  const set = <K extends keyof BrandFormValues>(key: K, value: BrandFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const patch = buildBrandPatch(brand, form, allowed);
  const dirty = Object.keys(patch).length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const local = validateBrandForm(form);
    setErrors(local);
    if (Object.keys(local).length > 0 || !dirty) return;
    update.mutate(patch, {
      onSuccess: () => toast.success('Brand saved'),
      onError: (err) => {
        if (hasCode(err, 'BRAND_EXISTS')) {
          setErrors({ websiteUrl: errorMessage(err, 'You already track a brand on this domain') });
          return;
        }
        if (hasCode(err, 'PLATFORM_NOT_IN_PLAN')) {
          setErrors({ 'defaults.platforms': errorMessage(err) });
          return;
        }
        const fields = fieldErrors(err);
        setErrors(fields);
        if (Object.keys(fields).length === 0) toast.error(errorMessage(err));
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Card title="Brand details">
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Brand name" error={errors.name}>
              {(p) => (
                <Input
                  {...p}
                  value={form.name}
                  maxLength={100}
                  invalid={Boolean(errors.name)}
                  onChange={(e) => set('name', e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Website"
              error={errors.websiteUrl}
              hint="Changing the website changes the domain we look for in AI answers."
            >
              {(p) => (
                <Input
                  {...p}
                  value={form.websiteUrl}
                  maxLength={2048}
                  inputMode="url"
                  invalid={Boolean(errors.websiteUrl)}
                  onChange={(e) => set('websiteUrl', e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field
            label="Summary"
            error={errors.summary}
            hint="Used to write prompts for this brand."
          >
            {(p) => (
              <Textarea
                {...p}
                rows={4}
                maxLength={4000}
                value={form.summary}
                onChange={(e) => set('summary', e.target.value)}
              />
            )}
          </Field>
          <ChipInput
            label="Aliases"
            value={form.aliases}
            onChange={(aliases) => set('aliases', aliases)}
            max={MAX_ALIASES}
            hint="Other names AI assistants might use for this brand."
            error={errors.aliases}
            disabled={readOnly}
          />
          <CategoriesEditor
            value={form.categories}
            onChange={(categories) => set('categories', categories)}
            errors={errors}
            disabled={readOnly}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Default location & language">
          <LocationFields
            value={form.defaults}
            onChange={(loc) => set('defaults', { ...form.defaults, ...loc })}
            errors={errors['defaults.city'] ? { city: errors['defaults.city'] } : {}}
          />
        </Card>
        <Card title="Default platforms">
          <PlatformPicker
            value={form.defaults.platforms}
            onChange={(platforms) => set('defaults', { ...form.defaults, platforms })}
            allowed={allowed}
            error={errors['defaults.platforms']}
          />
        </Card>
      </div>

      {!readOnly && (
        <div className="flex items-center justify-end gap-3">
          {dirty && (
            <span className="text-sm text-gray-500 dark:text-gray-400">Unsaved changes</span>
          )}
          <Button
            variant="ghost"
            disabled={!dirty || update.isPending}
            onClick={() => {
              setForm(formFromBrand(brand));
              setErrors({});
            }}
          >
            Discard
          </Button>
          <Button
            type="submit"
            icon={<Save className="w-4 h-4" />}
            loading={update.isPending}
            disabled={!dirty}
          >
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}
