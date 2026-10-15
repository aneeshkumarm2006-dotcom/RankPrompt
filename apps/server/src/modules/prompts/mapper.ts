import type { Prompt } from '@pv/shared';
import type { PromptDoc } from './repo';

export function toPrompt(doc: PromptDoc): Prompt {
  return {
    id: doc._id.toHexString(),
    brandId: doc.brandId.toHexString(),
    text: doc.text,
    category: doc.category,
    source: doc.source,
    replacesId: doc.replacesId?.toHexString() ?? null,
    archivedAt: doc.archivedAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  };
}
