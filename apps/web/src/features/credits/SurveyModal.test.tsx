// @vitest-environment jsdom
import { SURVEY_QUESTIONS } from '@pv/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { EMPTY_SURVEY_DRAFT, isAnswered, parseSurveyDraft, toggleChoice } from './surveyDraft';
import { SurveyModal } from './SurveyModal';

const fetchMock = vi.fn<typeof fetch>();
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('survey draft', () => {
  it('caps multiple choice at the max and requires answers per type', () => {
    expect(toggleChoice(['a', 'b', 'c'], 'd', 3)).toEqual(['a', 'b', 'c']);
    expect(toggleChoice(['a', 'b'], 'a', 3)).toEqual(['b']);
    const [usage, , ai, , scale, text] = SURVEY_QUESTIONS;
    expect(isAnswered(usage, EMPTY_SURVEY_DRAFT)).toBe(false);
    expect(isAnswered(ai, { ...EMPTY_SURVEY_DRAFT, aiFeatures: ['x'] })).toBe(true);
    expect(isAnswered(scale, { ...EMPTY_SURVEY_DRAFT, recommend: 0 })).toBe(true);
    expect(isAnswered(text, EMPTY_SURVEY_DRAFT)).toBe(true);
  });

  it('validates with surveyAnswersSchema', () => {
    expect(parseSurveyDraft(EMPTY_SURVEY_DRAFT)).toMatchObject({ ok: false });
    expect(
      parseSurveyDraft({
        usage: 'x',
        reportingFeature: 'y',
        aiFeatures: ['z'],
        blocker: 'w',
        recommend: 10,
        wishlist: '',
      }),
    ).toMatchObject({ ok: true, answers: { recommend: 10, wishlist: '' } });
  });
});

describe('SurveyModal', () => {
  it('walks through every question and submits valid answers', async () => {
    fetchMock.mockResolvedValue(json(200, { creditsAwarded: 50 }));
    const onClose = vi.fn();
    renderWithProviders(<SurveyModal onClose={onClose} />);
    const next = () => screen.getByRole('button', { name: /^Next/ });

    expect(screen.getByText('Question 1 of 6')).toBeTruthy();
    expect((next() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'To research competitors' }));
    fireEvent.click(next());

    fireEvent.click(screen.getByRole('button', { name: 'Track visibility over time' }));
    fireEvent.click(next());

    for (const o of ['AI tips to improve visibility', 'Prompt volume estimates', 'None of these']) {
      fireEvent.click(screen.getByRole('button', { name: o }));
    }
    // A fourth choice is ignored (max 3).
    fireEvent.click(
      screen.getByRole('button', { name: 'Keyword clusters based on prompt intent' }),
    );
    expect(
      screen
        .getByRole('button', { name: 'Keyword clusters based on prompt intent' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    fireEvent.click(next());

    fireEvent.click(screen.getByRole('button', { name: 'The interface is too complex' }));
    fireEvent.click(next());

    expect((next() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    fireEvent.click(next());

    expect(screen.getByText('Question 6 of 6')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/survey');
    expect(JSON.parse(init?.body as string)).toEqual({
      answers: {
        usage: 'To research competitors',
        reportingFeature: 'Track visibility over time',
        aiFeatures: ['AI tips to improve visibility', 'Prompt volume estimates', 'None of these'],
        blocker: 'The interface is too complex',
        recommend: 8,
        wishlist: '',
      },
    });
  });

  it('shows a friendly notice when the survey API is not built yet', async () => {
    fetchMock.mockResolvedValue(json(404, { error: { code: 'NOT_FOUND', message: 'Not found' } }));
    renderWithProviders(<SurveyModal onClose={vi.fn()} />);
    const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
    const next = () => fireEvent.click(screen.getByRole('button', { name: /^Next/ }));
    pick("I'm just testing it out");
    next();
    pick('None of these');
    next();
    pick('None of these');
    next();
    pick('Other');
    next();
    pick('0');
    next();
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText(/survey is being rebuilt/)).toBeTruthy();
  });
});
