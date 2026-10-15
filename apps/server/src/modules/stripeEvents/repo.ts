import { isDuplicateKeyError } from '../../db/errors';
import { op } from '../../db/trusted';
import { StripeEventModel, type StripeEventDoc } from './model';

export type { StripeEventDoc };

/** What a delivery should do: handle the event, or answer at once. */
export type EventClaim = 'claimed' | 'done' | 'in_progress';

export const stripeEventsRepo = {
  /**
   * Claims an event for this delivery (06 § Webhook processing, step 2). The first delivery
   * inserts it as `processing`. A later one gets `done` when it was handled, `in_progress` while
   * another delivery holds a fresh claim, and takes it over (attempts + 1) when the earlier
   * attempt failed or its claim is older than `staleMs` (that instance probably died).
   */
  async claim(
    event: { id: string; type: string },
    staleMs: number,
    now = new Date(),
  ): Promise<EventClaim> {
    try {
      await StripeEventModel.create({
        eventId: event.id,
        type: event.type,
        status: 'processing',
        attempts: 1,
        claimedAt: now,
        receivedAt: now,
      });
      return 'claimed';
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }
    const taken = await StripeEventModel.findOneAndUpdate(
      {
        eventId: event.id,
        $or: [
          { status: 'failed' },
          { status: 'processing', claimedAt: op({ $lt: new Date(now.getTime() - staleMs) }) },
        ],
      },
      { $set: { status: 'processing', claimedAt: now, error: null }, $inc: { attempts: 1 } },
      { new: true },
    )
      .lean<StripeEventDoc>()
      .exec();
    if (taken) return 'claimed';
    const row = await StripeEventModel.findOne({ eventId: event.id }, { status: 1 })
      .lean<Pick<StripeEventDoc, 'status'>>()
      .exec();
    return row?.status === 'done' ? 'done' : 'in_progress';
  },

  async markDone(eventId: string): Promise<void> {
    await StripeEventModel.updateOne(
      { eventId },
      { $set: { status: 'done', processedAt: new Date(), error: null } },
    ).exec();
  },

  async markFailed(eventId: string, error: string): Promise<void> {
    await StripeEventModel.updateOne(
      { eventId },
      { $set: { status: 'failed', error: error.slice(0, 2000) } },
    ).exec();
  },

  findByEventId(eventId: string): Promise<StripeEventDoc | null> {
    return StripeEventModel.findOne({ eventId }).lean<StripeEventDoc>().exec();
  },
};
