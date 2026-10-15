import { SURVEY_QUESTIONS, surveyAnswersSchema, type SurveyAnswers } from '@pv/shared';

export type SurveyQuestion = (typeof SURVEY_QUESTIONS)[number];

/** Answers while the survey is being filled in. */
export interface SurveyDraft {
  usage: string;
  reportingFeature: string;
  aiFeatures: string[];
  blocker: string;
  recommend: number | null;
  wishlist: string;
}

export const EMPTY_SURVEY_DRAFT: SurveyDraft = {
  usage: '',
  reportingFeature: '',
  aiFeatures: [],
  blocker: '',
  recommend: null,
  wishlist: '',
};

/** Whether "Next" is allowed for this question (v1: the text question is optional). */
export function isAnswered(q: SurveyQuestion, draft: SurveyDraft): boolean {
  const value = draft[q.key];
  switch (q.type) {
    case 'multiple':
      return Array.isArray(value) && value.length > 0;
    case 'scale':
      return typeof value === 'number';
    case 'text':
      return true;
    default:
      return typeof value === 'string' && value.trim().length > 0;
  }
}

/** Toggles a multiple-choice option, never going past `max` selections. */
export function toggleChoice(selected: readonly string[], option: string, max: number): string[] {
  if (selected.includes(option)) return selected.filter((o) => o !== option);
  return selected.length < max ? [...selected, option] : [...selected];
}

/** Validates the whole draft with the shared schema. */
export function parseSurveyDraft(
  draft: SurveyDraft,
): { ok: true; answers: SurveyAnswers } | { ok: false; message: string } {
  const parsed = surveyAnswersSchema.safeParse(draft);
  if (parsed.success) return { ok: true, answers: parsed.data };
  const issue = parsed.error.issues[0];
  const key = issue?.path[0];
  const q = SURVEY_QUESTIONS.find((x) => x.key === key);
  return {
    ok: false,
    message: q ? `Please answer: ${q.question}` : 'Please answer every question.',
  };
}
