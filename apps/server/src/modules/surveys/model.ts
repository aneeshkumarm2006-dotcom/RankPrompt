import type { SurveyAnswers } from '@pv/shared';
import mongoose, { Schema, type Types } from 'mongoose';

/**
 * `surveys` (02, 06 § Survey): one per user, ever. Keyed by the user, like `sessions`, so it has
 * no workspace-scope plugin; `workspaceId` records which workspace got the credits.
 */
export interface SurveyDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  answers: SurveyAnswers;
  creditedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const surveySchema = new Schema<SurveyDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    workspaceId: { type: Schema.Types.ObjectId, required: true },
    answers: { type: Schema.Types.Mixed, required: true },
    creditedAt: { type: Date, required: true },
  },
  { timestamps: true },
);
surveySchema.index({ userId: 1 }, { unique: true });

export const SurveyModel = mongoose.model<SurveyDoc>('Survey', surveySchema, 'surveys');
