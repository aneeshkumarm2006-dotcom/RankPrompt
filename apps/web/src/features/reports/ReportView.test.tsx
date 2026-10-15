// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { publicReportFixture } from './__fixtures__/publicReport';
import { ReportView } from './ReportView';
import { fromPublicReport } from './viewModel';

/** The MetricTile card that holds `label`. */
const tile = (label: string): HTMLElement => {
  const el = screen.getByText(label).closest<HTMLElement>('div[class*="p-5"]');
  if (!el) throw new Error(`no tile ${label}`);
  return el;
};

function renderReport(props: { readOnly?: boolean; onFilterChange?: () => void } = {}) {
  const report = fromPublicReport(publicReportFixture());
  return renderWithProviders(
    <ReportView
      report={report}
      filter={{}}
      onFilterChange={props.onFilterChange ?? vi.fn()}
      readOnly={props.readOnly ?? false}
      actions={<button type="button">Share</button>}
    />,
  );
}

describe('ReportView', () => {
  it('shows each ratio tile as a percentage with num/den', () => {
    renderReport();
    const visibility = tile('Visibility');
    expect(within(visibility).getByText('33%')).toBeTruthy();
    expect(within(visibility).getByText('1/3')).toBeTruthy();
    expect(within(tile('Prompt coverage')).getByText('1/2')).toBeTruthy();
    expect(within(tile('Share of voice')).getByText('1/4')).toBeTruthy();
    expect(within(tile('Top-3 rate')).getByText('0%')).toBeTruthy();
  });

  it('shows a missing average rank as "—", never 0 or #undefined', () => {
    renderReport();
    const avg = tile('Average rank');
    expect(within(avg).getByText('—')).toBeTruthy();
    expect(within(avg).getByText('0 answers ranked')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/#undefined|#0\b/);
  });

  it('renders the prompt × platform matrix with "—" for a missing rank', () => {
    renderReport();
    const cell = screen.getByRole('button', { name: /ChatGPT: mentioned, no rank, cited/ });
    expect(within(cell).getByText('—')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Perplexity: Failed/ })).toBeTruthy();
  });

  it('opens the answer with its line breaks, citations and competitor results', () => {
    renderReport();
    fireEvent.click(screen.getByRole('button', { name: /ChatGPT: mentioned, no rank, cited/ }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(
        (_, el) => el?.tagName === 'P' && el.textContent === 'Line one\nLine two',
      ),
    ).toBeTruthy();
    expect(within(dialog).getByText('Acme CRM')).toBeTruthy();
    expect(within(dialog).getByText('Your site')).toBeTruthy();
    expect(within(dialog).getByText('Globex')).toBeTruthy();
  });

  it('shows the safe message for a failed check', () => {
    renderReport();
    fireEvent.click(screen.getByRole('button', { name: /Perplexity: Failed/ }));
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toMatch(/failed/);
  });

  it('hides owner actions in read-only mode', () => {
    renderReport({ readOnly: true });
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('shows owner actions otherwise', () => {
    renderReport();
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });

  it('reports filter changes', () => {
    const onFilterChange = vi.fn();
    renderReport({ onFilterChange });
    fireEvent.change(screen.getByLabelText('Platform'), { target: { value: 'perplexity' } });
    expect(onFilterChange).toHaveBeenCalledWith({ platform: 'perplexity' });
  });
});
