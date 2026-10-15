import type { EmailPrefs } from '@pv/shared';
import { DateTime } from 'luxon';
import { button, facts, muted, p, page, type Html } from './layout';
import type { EmailMessage } from './mailer';

/**
 * Every email template (10 § Email), typed by its data. A template returns blocks, and one
 * renderer turns them into both the HTML and the plain-text fallback, so the two never drift.
 * Data travels through the `send_email` job as JSON: dates are ISO strings.
 */

interface ScheduleEmailData {
  name: string;
  brandName: string;
  scheduleLabel: string;
  /** "Weekly on Monday at 09:00 America/Toronto". */
  timing: string;
  timezone: string;
  platforms: string[];
  /** "All active prompts" or "12 fixed prompts". */
  prompts: string;
  creditsPerRun: number;
  nextRunAt: string | null;
  scheduleLink: string;
}

export interface EmailTemplates {
  verify_email: { name: string; link: string };
  reset_password: { name: string; link: string };
  welcome: { name: string; appLink: string };
  schedule_created: ScheduleEmailData;
  schedule_updated: ScheduleEmailData & { changes: string[] };
  scheduled_run_completed: {
    name: string;
    brandName: string;
    scheduleLabel: string;
    /** Brand visibility in %, one decimal, or null when nothing was answered. */
    visibilityPct: number | null;
    /** Points vs the schedule's previous run (shared prompts and platforms), or null. */
    deltaPts: number | null;
    answered: number;
    mentioned: number;
    citedPct: number | null;
    avgRank: number | null;
    failed: number;
    refunded: number;
    runLink: string;
    settingsLink: string;
  };
  run_skipped_low_credits: {
    name: string;
    brandName: string;
    scheduleLabel: string;
    needed: number;
    balance: number;
    skipsInARow: number;
    billingLink: string;
    scheduleLink: string;
  };
  schedule_paused: {
    name: string;
    brandName: string;
    scheduleLabel: string;
    billingLink: string;
    scheduleLink: string;
  };
  schedule_platforms_dropped: {
    name: string;
    brandName: string;
    scheduleLabel: string;
    dropped: string[];
    kept: string[];
    billingLink: string;
    scheduleLink: string;
  };
  low_credits: {
    name: string;
    balance: number;
    allowance: number;
    billingLink: string;
    settingsLink: string;
  };
  payment_failed: { name: string; billingLink: string };
}

export type EmailTemplate = keyof EmailTemplates;

/** Non-essential templates a user can turn off in settings (10 § Opt-out). Everything else sends. */
export const OPTIONAL_TEMPLATES: Partial<Record<EmailTemplate, keyof EmailPrefs>> = {
  scheduled_run_completed: 'runCompleted',
  low_credits: 'lowCredits',
};

type Block =
  | { p: string }
  | { muted: string }
  | { button: string; href: string }
  | { facts: (readonly [string, string])[] };

interface Draft {
  subject: string;
  heading: string;
  blocks: Block[];
  hasSecretLink?: boolean;
}

const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Monday 20 October 2026 at 09:00 (America/Toronto)". */
export function formatInZone(iso: string | null, timezone: string): string {
  if (!iso) return 'Not scheduled';
  const dt = DateTime.fromISO(iso, { zone: timezone });
  if (!dt.isValid) return iso;
  return `${dt.toFormat("cccc d LLLL yyyy 'at' HH:mm")} (${timezone})`;
}

const scheduleName = (d: { scheduleLabel: string; brandName: string }) =>
  d.scheduleLabel ? `"${d.scheduleLabel}" for ${d.brandName}` : `the ${d.brandName} schedule`;

const scheduleFacts = (d: ScheduleEmailData): Block => ({
  facts: [
    ['Brand', d.brandName],
    ['When', d.timing],
    ['Next run', formatInZone(d.nextRunAt, d.timezone)],
    ['Platforms', d.platforms.join(', ')],
    ['Prompts', d.prompts],
    ['Credits per run', pluralize(d.creditsPerRun, 'credit')],
  ],
});

const DRAFTS: { [T in EmailTemplate]: (d: EmailTemplates[T]) => Draft } = {
  verify_email: (d) => ({
    subject: 'Confirm your email for PromptVerse',
    heading: 'Confirm your email',
    hasSecretLink: true,
    blocks: [
      { p: `Hi ${d.name},` },
      { p: 'Confirm your email address to finish setting up your PromptVerse account.' },
      { button: 'Confirm email', href: d.link },
      { muted: 'The link expires in 24 hours. If you did not sign up, you can ignore this email.' },
    ],
  }),

  reset_password: (d) => ({
    subject: 'Reset your PromptVerse password',
    heading: 'Reset your password',
    hasSecretLink: true,
    blocks: [
      { p: `Hi ${d.name},` },
      { p: 'Someone (hopefully you) asked to reset your PromptVerse password. Choose a new one:' },
      { button: 'Choose a new password', href: d.link },
      {
        muted:
          'The link expires in 1 hour and signs you out everywhere. If you did not ask for this, you can ignore this email.',
      },
    ],
  }),

  welcome: (d) => ({
    subject: 'Welcome to PromptVerse',
    heading: 'Welcome to PromptVerse',
    blocks: [
      { p: `Hi ${d.name},` },
      {
        p: 'Your email is confirmed. Add a brand, pick the questions your buyers ask, and see how often ChatGPT, Perplexity, Gemini, Claude and Google AI Overviews mention you.',
      },
      { button: 'Open PromptVerse', href: d.appLink },
      { muted: 'Tip: once a report looks right, schedule it to track your visibility over time.' },
    ],
  }),

  schedule_created: (d) => ({
    subject: `Scheduled report created for ${d.brandName}`,
    heading: 'Your scheduled report is set up',
    blocks: [
      { p: `Hi ${d.name},` },
      { p: `We'll run ${scheduleName(d)} automatically. Here's the setup:` },
      scheduleFacts(d),
      { button: 'View schedule', href: d.scheduleLink },
      {
        muted:
          'Each run reserves its credits when it starts. If the balance is too low, that run is skipped and we email you; after 3 skips in a row the schedule pauses.',
      },
    ],
  }),

  schedule_updated: (d) => ({
    subject: `Scheduled report updated for ${d.brandName}`,
    heading: 'Your scheduled report changed',
    blocks: [
      { p: `Hi ${d.name},` },
      { p: `${scheduleName(d)} was updated (${d.changes.join(', ')}). It now runs like this:` },
      scheduleFacts(d),
      { button: 'View schedule', href: d.scheduleLink },
    ],
  }),

  scheduled_run_completed: (d) => {
    const vis = d.visibilityPct === null ? 'n/a' : `${d.visibilityPct}%`;
    const delta =
      d.deltaPts === null
        ? 'No earlier run to compare'
        : `${d.deltaPts > 0 ? '+' : ''}${d.deltaPts} pts vs the previous run`;
    return {
      subject: `${d.brandName}: ${vis} AI visibility in your scheduled report`,
      heading: `${d.brandName} report is ready`,
      blocks: [
        { p: `Hi ${d.name},` },
        { p: `The scheduled run ${scheduleName(d)} has finished.` },
        {
          facts: [
            ['Visibility', vis],
            ['Change', delta],
            ['Mentioned', `${d.mentioned} of ${pluralize(d.answered, 'answer')}`],
            ['Website cited', d.citedPct === null ? 'n/a' : `${d.citedPct}%`],
            ['Average rank', d.avgRank === null ? 'Not ranked' : String(d.avgRank)],
            ...(d.failed > 0
              ? ([
                  ['Failed checks', `${d.failed} (${pluralize(d.refunded, 'credit')} refunded)`],
                ] as const)
              : []),
          ],
        },
        { button: 'Open the report', href: d.runLink },
        { muted: `Don't want these summaries? Turn them off in settings: ${d.settingsLink}` },
      ],
    };
  },

  run_skipped_low_credits: (d) => ({
    subject: `Scheduled run skipped for ${d.brandName}: not enough credits`,
    heading: 'A scheduled run was skipped',
    blocks: [
      { p: `Hi ${d.name},` },
      {
        p: `We skipped ${scheduleName(d)} because it needs ${pluralize(d.needed, 'credit')} and your balance is ${d.balance}.`,
      },
      {
        p:
          d.skipsInARow >= 3
            ? 'This was the third skip in a row, so the schedule is now paused.'
            : `That's ${pluralize(d.skipsInARow, 'skip')} in a row. After 3 the schedule pauses itself.`,
      },
      { button: 'Top up credits', href: d.billingLink },
      { muted: `Manage the schedule: ${d.scheduleLink}` },
    ],
  }),

  schedule_paused: (d) => ({
    subject: `Scheduled report paused for ${d.brandName}`,
    heading: 'Your scheduled report is paused',
    blocks: [
      { p: `Hi ${d.name},` },
      {
        p: `${scheduleName(d)} was skipped 3 times in a row for lack of credits, so we paused it. Nothing more will run or be charged until you resume it.`,
      },
      { button: 'Top up credits', href: d.billingLink },
      { p: 'Then resume the schedule from its page:' },
      { button: 'Resume schedule', href: d.scheduleLink },
    ],
  }),

  schedule_platforms_dropped: (d) => ({
    subject: `Some platforms were left out of your ${d.brandName} schedule`,
    heading: 'Platforms left out of a scheduled run',
    blocks: [
      { p: `Hi ${d.name},` },
      {
        p: `Your plan no longer includes ${d.dropped.join(', ')}, so ${scheduleName(d)} runs without ${d.dropped.length === 1 ? 'it' : 'them'}.`,
      },
      {
        p: d.kept.length
          ? `It still runs on ${d.kept.join(', ')}.`
          : 'No platform is left, so its runs are skipped until you change it or upgrade.',
      },
      { button: 'See plans', href: d.billingLink },
      { muted: `Edit the schedule: ${d.scheduleLink}` },
    ],
  }),

  low_credits: (d) => ({
    subject: `You have ${pluralize(d.balance, 'credit')} left`,
    heading: 'Your credits are running low',
    blocks: [
      { p: `Hi ${d.name},` },
      {
        p:
          d.allowance > 0
            ? `You have ${pluralize(d.balance, 'credit')} left of this period's ${d.allowance}. Scheduled runs that need more are skipped.`
            : `You have ${pluralize(d.balance, 'credit')} left. Scheduled runs that need more are skipped.`,
      },
      { button: 'Top up or upgrade', href: d.billingLink },
      { muted: `Don't want these warnings? Turn them off in settings: ${d.settingsLink}` },
    ],
  }),

  payment_failed: (d) => ({
    subject: 'Your PromptVerse payment failed',
    heading: 'Your payment failed',
    blocks: [
      { p: `Hi ${d.name},` },
      {
        p: 'We could not take the payment for your PromptVerse subscription. Stripe will retry it over the next few days.',
      },
      {
        p: 'You can keep running reports with the plan credits you have left. To keep your plan, update your card:',
      },
      { button: 'Update payment details', href: d.billingLink },
    ],
  }),
};

function toHtml(block: Block): Html {
  if ('p' in block) return p(block.p);
  if ('muted' in block) return muted(block.muted);
  if ('button' in block) return button(block.button, block.href);
  return facts(block.facts);
}

function toText(block: Block): string {
  if ('p' in block) return block.p;
  if ('muted' in block) return block.muted;
  if ('button' in block) return `${block.button}: ${block.href}`;
  return block.facts.map(([k, v]) => `${k}: ${v}`).join('\n');
}

export const isEmailTemplate = (name: string): name is EmailTemplate => name in DRAFTS;

/** Renders a template to subject, HTML and plain text. */
export function renderEmail<T extends EmailTemplate>(
  template: T,
  to: string,
  data: EmailTemplates[T],
): EmailMessage {
  const draft = (DRAFTS[template] as (d: EmailTemplates[T]) => Draft)(data);
  const preheader = draft.blocks.map(toText).find((t, i) => i > 0 && t.length > 0) ?? '';
  return {
    template,
    to,
    subject: draft.subject,
    text: [...draft.blocks.map(toText), '', '— PromptVerse'].join('\n\n'),
    html: page({ preheader, heading: draft.heading, body: draft.blocks.map(toHtml) }),
    ...(draft.hasSecretLink ? { hasSecretLink: true } : {}),
  };
}
