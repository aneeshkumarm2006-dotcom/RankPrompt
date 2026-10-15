import { Schema, type Aggregate, type MongooseQueryMiddleware, type Query } from 'mongoose';

declare module 'mongoose' {
  interface QueryOptions {
    /** Opt out of the workspace-scope check. System code only (worker, scheduler, Stripe), reviewed. */
    crossWorkspace?: boolean;
  }
  interface AggregateOptions {
    /** Opt out of the workspace-scope check. System code only (worker, scheduler, Stripe), reviewed. */
    crossWorkspace?: boolean;
  }
}

export class WorkspaceScopeError extends Error {
  override name = 'WorkspaceScopeError';
}

const SCOPED_QUERY_OPS: MongooseQueryMiddleware[] = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'countDocuments',
  'distinct',
];

const hasWorkspaceId = (filter: Record<string, unknown> | undefined): boolean =>
  filter?.workspaceId !== undefined && filter.workspaceId !== null;

/**
 * Workspace isolation, layer 2 (07): on an owned collection, every query and aggregate must be
 * filtered by `workspaceId` (top-level key of the filter, or of the first `$match` stage). Anything
 * else throws `WorkspaceScopeError`, unless the caller opts out with `{ crossWorkspace: true }`.
 * Also adds a required, indexed `workspaceId` path if the schema doesn't declare one.
 */
export function workspaceScope(schema: Schema): void {
  if (!schema.path('workspaceId')) {
    schema.add({ workspaceId: { type: Schema.Types.ObjectId, required: true, index: true } });
  }

  schema.pre(
    SCOPED_QUERY_OPS,
    { query: true, document: false },
    function (this: Query<unknown, unknown>) {
      if (this.getOptions().crossWorkspace) return;
      if (!hasWorkspaceId(this.getFilter())) {
        // `op` exists at runtime on every query but is missing from Mongoose's typings.
        const op = (this as unknown as { op?: string }).op ?? 'query';
        throw new WorkspaceScopeError(
          `${this.model.modelName}.${op}() needs workspaceId in its filter`,
        );
      }
    },
  );

  // Cannot be filtered at all, so it is only allowed for system code.
  schema.pre('estimatedDocumentCount', function (this: Query<unknown, unknown>) {
    if (this.getOptions().crossWorkspace) return;
    throw new WorkspaceScopeError(
      `${this.model.modelName}.estimatedDocumentCount() is cross-workspace; pass { crossWorkspace: true }`,
    );
  });

  schema.pre('aggregate', function (this: Aggregate<unknown>) {
    if (this.options.crossWorkspace) return;
    const first = this.pipeline()[0];
    const match =
      first && '$match' in first ? (first.$match as Record<string, unknown>) : undefined;
    if (!hasWorkspaceId(match)) {
      throw new WorkspaceScopeError(
        'aggregate() must start with a $match on workspaceId, or pass { crossWorkspace: true }',
      );
    }
  });
}
