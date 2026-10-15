import { PROMPT_SOURCES, type PromptSource } from '@pv/shared';
import mongoose, { Schema, type Types } from 'mongoose';
import { workspaceScope } from '../../db/workspaceScope';

/**
 * `prompts` (02, D-014): a brand's prompt library. `text` never changes: editing it archives the
 * prompt and creates a new one that `replacesId` the old.
 */
export interface PromptDoc {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  brandId: Types.ObjectId;
  text: string;
  category: string;
  source: PromptSource;
  replacesId: Types.ObjectId | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const promptSchema = new Schema<PromptDoc>(
  {
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    brandId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, required: true, immutable: true },
    category: { type: String, required: true },
    source: { type: String, enum: PROMPT_SOURCES, required: true },
    replacesId: { type: Schema.Types.ObjectId, default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
promptSchema.plugin(workspaceScope);
promptSchema.index({ workspaceId: 1, brandId: 1, archivedAt: 1, createdAt: 1 });

export const PromptModel = mongoose.model<PromptDoc>('Prompt', promptSchema, 'prompts');
