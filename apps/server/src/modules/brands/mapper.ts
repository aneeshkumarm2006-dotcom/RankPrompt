import type { Brand } from '@pv/shared';
import type { BrandDoc } from './repo';

/** Mongoose documents never leave the server: this is the API shape (01 § Dependency rules). */
export function toBrand(doc: BrandDoc): Brand {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    domain: doc.domain,
    websiteUrl: doc.websiteUrl,
    aliases: [...doc.aliases],
    summary: doc.summary,
    categories: doc.categories.map((c) => ({
      name: c.name,
      description: c.description,
      source: c.source,
    })),
    competitors: doc.competitors.map((c) => ({
      id: c._id.toHexString(),
      name: c.name,
      domain: c.domain,
      aliases: [...c.aliases],
    })),
    defaults: {
      country: doc.defaults.country,
      city: doc.defaults.city ?? null,
      language: doc.defaults.language,
      scope: doc.defaults.scope,
      platforms: [...doc.defaults.platforms],
    },
    archivedAt: doc.archivedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
