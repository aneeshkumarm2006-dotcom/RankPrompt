import { Archive, ArrowRight, FileText, Info } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useBrandOutlet } from '../../app/layout/useBrandOutlet';
import { Button, buttonClass } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/PageHeader';
import { formatDate } from '../../lib/format';
import { ArchiveBrandDialog } from './ArchiveBrandDialog';
import { BrandDetailsForm } from './BrandDetailsForm';
import { CompetitorsEditor } from './CompetitorsEditor';

/** `/app/brands/:brandId/settings` (F-18). Prompts are edited in the prompt library only. */
export function BrandSettingsPage() {
  const brand = useBrandOutlet();
  const navigate = useNavigate();
  const [archiving, setArchiving] = useState(false);
  const readOnly = brand.archivedAt !== null;

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Brand settings" description={`${brand.name} · ${brand.domain}`} />

      {readOnly && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 p-4 rounded-xl border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
        >
          <Info className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm">
            This brand was archived on {formatDate(brand.archivedAt)}. Its settings are read-only;
            past runs and reports are still available.
          </p>
        </div>
      )}

      {/* A disabled fieldset turns every control read-only for an archived brand. */}
      <fieldset disabled={readOnly} className="space-y-6 min-w-0">
        <legend className="sr-only">Settings for {brand.name}</legend>
        {/* Remount after each save so the forms start from the server's values. */}
        <BrandDetailsForm key={`details-${brand.updatedAt}`} brand={brand} readOnly={readOnly} />
        <CompetitorsEditor
          key={`competitors-${brand.updatedAt}`}
          brand={brand}
          readOnly={readOnly}
        />
      </fieldset>

      <div className="mt-6 space-y-6">
        <Card title="Prompts">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
              Prompts are added, edited and archived in the prompt library, where each prompt keeps
              its history.
            </p>
            <Link
              to={`/app/brands/${brand.id}/prompts`}
              className={`${buttonClass('outline', 'sm')} shrink-0`}
            >
              Open prompt library <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </Card>

        {!readOnly && (
          <section className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-white dark:bg-dark-800 p-6">
            <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-1">
              Danger zone
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Archiving pauses this brand’s schedules and frees its slot in your plan. Runs and
                reports are kept.
              </p>
              <Button
                variant="danger"
                size="sm"
                icon={<Archive className="w-4 h-4" />}
                onClick={() => setArchiving(true)}
                className="shrink-0"
              >
                Archive brand
              </Button>
            </div>
          </section>
        )}
      </div>

      <ArchiveBrandDialog
        brand={archiving ? brand : null}
        onClose={() => setArchiving(false)}
        onArchived={() => void navigate('/app/brands')}
      />
    </div>
  );
}
