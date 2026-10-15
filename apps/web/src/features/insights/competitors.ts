import type { Brand, CompetitorInput } from '@pv/shared';

/**
 * The full `PUT /brands/:id/competitors` list with one competitor added. Existing competitors
 * keep their ids (so past results stay linked to them) and aliases.
 */
export function withAddedCompetitor(
  existing: Brand['competitors'],
  added: { name: string; domain: string },
): CompetitorInput[] {
  return [
    ...existing.map((c) => ({ id: c.id, name: c.name, domain: c.domain, aliases: c.aliases })),
    { name: added.name.trim(), domain: added.domain.trim(), aliases: [] },
  ];
}

/** Client-side check matching `competitorInputSchema.domain` (required, at least 3 characters). */
export function domainError(domain: string): string | undefined {
  const d = domain.trim();
  if (!d) return 'Enter the competitor’s website';
  if (d.length < 3 || !d.includes('.')) return 'Enter a domain like example.com';
  return undefined;
}
