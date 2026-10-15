import {
  CREDIT_GRANTS,
  submitSurveyBodySchema,
  type SurveyAnswers,
  type SurveyStatus,
} from '@pv/shared';
import { Router } from 'express';
import { Types } from 'mongoose';
import { isDuplicateKeyError } from '../../db/errors';
import { withTransaction } from '../../db/transaction';
import { ctxOf, type Ctx } from '../../http/context';
import { AppError } from '../../http/errors';
import { validate } from '../../http/validate';
import { applyCreditChange } from '../credits/service';
import { surveysRepo } from './repo';

async function status(ctx: Ctx): Promise<SurveyStatus> {
  const survey = await surveysRepo.findByUser(ctx.userId);
  return { completed: survey !== null, completedAt: survey?.creditedAt.toISOString() ?? null };
}

/**
 * The survey reward (06 § Survey, F-31): the answers and the +50 purchased credits are written in
 * one transaction, once per user. A second submission is 409 and grants nothing.
 */
async function submit(ctx: Ctx, answers: SurveyAnswers): Promise<{ creditsAwarded: number }> {
  const userId = new Types.ObjectId(ctx.userId);
  const workspaceId = new Types.ObjectId(ctx.workspaceId);
  try {
    await withTransaction(async (session) => {
      await surveysRepo.insert(session, { userId, workspaceId, answers, creditedAt: new Date() });
      await applyCreditChange(session, {
        workspaceId,
        bucket: 'purchased',
        delta: CREDIT_GRANTS.survey,
        reason: 'survey',
        refType: 'user',
        refId: ctx.userId,
        note: 'Survey reward',
        actorUserId: userId,
      });
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new AppError('CONFLICT', 'You have already completed the survey');
    }
    throw err;
  }
  return { creditsAwarded: CREDIT_GRANTS.survey };
}

/** `GET /survey`, `POST /survey` (08 § Billing and credits). Mounted behind requireAuth. */
export function surveyRoutes(): Router {
  const router = Router();

  router.get('/survey', async (req, res) => {
    res.json(await status(ctxOf(req)));
  });

  router.post(
    '/survey',
    validate({ body: submitSurveyBodySchema }, async ({ body }, req, res) => {
      res.status(201).json(await submit(ctxOf(req), body.answers));
    }),
  );

  return router;
}
