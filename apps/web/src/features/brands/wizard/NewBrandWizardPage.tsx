import { Archive } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { buttonClass } from '../../../components/ui/Button';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { PageSpinner } from '../../../components/ui/Spinner';
import { useMe } from '../../../lib/api/auth';
import { StepBrand } from './StepBrand';
import { StepCategories } from './StepCategories';
import { StepIndicator } from './StepIndicator';
import { StepPrompts } from './StepPrompts';
import { StepRun } from './StepRun';
import { FALLBACK_CATEGORY } from './drafts';
import { draftKey, useWizard } from './useWizard';

/**
 * `/app/brands/new` (F-06..F-12, 09 § Wizard): brand + analysis → categories → prompts → run.
 * `?brandId=` resumes a brand that has no run yet (F-10).
 */
export function NewBrandWizardPage() {
  const [params] = useSearchParams();
  // A different brand (or none) starts the wizard state afresh.
  return <BrandWizard key={params.get('brandId') ?? 'new'} />;
}

function BrandWizard() {
  const w = useWizard();
  const { data: me } = useMe();
  const max = me?.workspace.limits.maxPromptsPerRun ?? 25;
  const { brand } = w;

  let body;
  if (w.isLoading) {
    body = <PageSpinner label="Loading your brand…" />;
  } else if (w.error) {
    body = (
      <div className="space-y-4">
        <ErrorState error={w.error} title="Could not load this brand" />
        <div className="text-center">
          <Link to="/app/brands/new" className={buttonClass('outline')}>
            Start a new brand
          </Link>
        </div>
      </div>
    );
  } else if (brand?.archivedAt) {
    body = (
      <EmptyState
        icon={Archive}
        title="This brand is archived"
        message="Archived brands can't be changed. Its past runs and reports are still available."
        action={
          <Link to="/app/brands" className={buttonClass('primary')}>
            Back to my brands
          </Link>
        }
      />
    );
  } else if (w.step === 1 || !brand) {
    body = <StepBrand onCreated={w.onBrandCreated} />;
  } else if (w.step === 2) {
    body = (
      <StepCategories
        brand={brand}
        onDrafts={(drafts) => {
          w.setDrafts((ds) => [...ds, ...drafts].slice(0, max));
          w.goTo(3);
        }}
        onSkip={() => {
          if (w.drafts.length === 0) {
            const category = brand.categories[0]?.name ?? FALLBACK_CATEGORY;
            w.setDrafts([{ key: draftKey(), text: '', category, source: 'manual' }]);
          }
          w.goTo(3);
        }}
      />
    );
  } else if (w.step === 3) {
    body = (
      <StepPrompts
        brand={brand}
        saved={w.prompts}
        drafts={w.drafts}
        setDrafts={w.setDrafts}
        onSaved={() => w.refetchPrompts()}
        onGenerateMore={() => w.goTo(2)}
        onContinue={() => w.goTo(4)}
      />
    );
  } else {
    body = <StepRun brand={brand} prompts={w.prompts} onBack={() => w.goTo(3)} />;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <header className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-800 dark:text-white mb-2">
          {brand ? `Set up ${brand.name}` : 'Check your brand’s visibility'}
        </h1>
        <p className="text-xl sm:text-2xl md:text-3xl font-black">
          <span className="gradient-text">in AI Assistants</span>
        </p>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-3">
          Find out if ChatGPT, Perplexity, Gemini and Claude recommend you, and what to do if they
          don’t.
        </p>
      </header>

      <StepIndicator current={w.step} />
      {body}
    </div>
  );
}
