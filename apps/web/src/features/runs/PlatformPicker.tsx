import { PLATFORMS, type Platform } from '@pv/shared';
import { Lock } from 'lucide-react';
import { Link } from 'react-router';
import { Checkbox } from '../../components/ui/Field';
import { PlatformLabel } from '../../components/ui/PlatformIcon';

/**
 * Platform checkboxes. Platforms outside the plan are shown locked with an upgrade hint
 * (09 § Wizard); the server enforces it too (403 PLATFORM_NOT_IN_PLAN).
 */
export function PlatformPicker({
  value,
  onChange,
  allowed,
  error,
}: {
  value: Platform[];
  onChange: (next: Platform[]) => void;
  allowed: readonly Platform[];
  error?: string | undefined;
}) {
  const toggle = (p: Platform, on: boolean) =>
    onChange(
      on ? PLATFORMS.filter((x) => x === p || value.includes(x)) : value.filter((x) => x !== p),
    );

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        AI Platforms
      </legend>
      <div className="space-y-3">
        {PLATFORMS.map((p) => {
          const locked = !allowed.includes(p);
          return (
            <div key={p} className="flex items-center justify-between gap-3">
              <Checkbox
                checked={!locked && value.includes(p)}
                disabled={locked}
                onChange={(on) => toggle(p, on)}
                label={<PlatformLabel platform={p} />}
              />
              {locked && (
                <Link
                  to="/app/billing"
                  className="inline-flex items-center gap-1 text-xs text-action-600 dark:text-action-400 hover:underline"
                >
                  <Lock className="w-3 h-3" /> Upgrade
                </Link>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </fieldset>
  );
}
