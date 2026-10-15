import { Types, type ClientSession } from 'mongoose';
import { SurveyModel, type SurveyDoc } from './model';

export type { SurveyDoc };

export const surveysRepo = {
  findByUser(userId: string): Promise<Pick<SurveyDoc, 'creditedAt'> | null> {
    return SurveyModel.findOne({ userId: new Types.ObjectId(userId) }, { creditedAt: 1 })
      .lean<Pick<SurveyDoc, 'creditedAt'>>()
      .exec();
  },

  /** Fails with a duplicate key on `userId` when the user already answered. */
  async insert(
    session: ClientSession,
    s: Pick<SurveyDoc, 'userId' | 'workspaceId' | 'answers' | 'creditedAt'>,
  ): Promise<void> {
    await SurveyModel.create([s], { session });
  },
};
