import {
  CATEGORY_SOURCES,
  PLATFORMS,
  SCOPES,
  type CountryCode,
  type LanguageCode,
  type Platform,
  type Scope,
} from '@pv/shared';
import mongoose, { Schema, type Types } from 'mongoose';
import { workspaceScope } from '../../db/workspaceScope';

export interface CompetitorDoc {
  _id: Types.ObjectId;
  name: string;
  domain: string;
  aliases: string[];
}

/** `brands` (02 § Brands and prompts). Archived, never deleted: old runs still point at them. */
export interface BrandDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  name: string;
  /** Registrable domain (`canadim.com`), unique per workspace among non-archived brands. */
  domain: string;
  websiteUrl: string;
  /** Name variants for matching; always includes `name`. */
  aliases: string[];
  summary: string;
  categories: { name: string; description: string; source: (typeof CATEGORY_SOURCES)[number] }[];
  competitors: CompetitorDoc[];
  defaults: {
    country: CountryCode;
    city: string | null;
    language: LanguageCode;
    scope: Scope;
    platforms: Platform[];
  };
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<BrandDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    domain: { type: String, required: true },
    websiteUrl: { type: String, required: true },
    aliases: { type: [String], default: [] },
    summary: { type: String, default: '' },
    categories: {
      type: [
        new Schema(
          {
            name: { type: String, required: true },
            description: { type: String, default: '' },
            source: { type: String, enum: CATEGORY_SOURCES, default: 'custom' },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    competitors: {
      type: [
        new Schema({
          name: { type: String, required: true },
          domain: { type: String, required: true },
          aliases: { type: [String], default: [] },
        }),
      ],
      default: [],
    },
    defaults: {
      country: { type: String, required: true },
      city: { type: String, default: null },
      language: { type: String, required: true },
      scope: { type: String, enum: SCOPES, required: true },
      platforms: { type: [String], enum: PLATFORMS, required: true },
    },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
brandSchema.plugin(workspaceScope);
brandSchema.index(
  { workspaceId: 1, domain: 1 },
  // `$type: 'null'` rather than `archivedAt: null`, which partial indexes don't accept.
  { unique: true, partialFilterExpression: { archivedAt: { $type: 'null' } } },
);
brandSchema.index({ workspaceId: 1, createdAt: -1 });

export const BrandModel = mongoose.model<BrandDoc>('Brand', brandSchema, 'brands');
