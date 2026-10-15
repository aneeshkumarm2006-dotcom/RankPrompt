// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { RunStatusBadge } from './Badge';

describe('RunStatusBadge', () => {
  it('labels run statuses', () => {
    renderWithProviders(<RunStatusBadge status="partial" />);
    expect(screen.getByText('Partial')).toBeTruthy();
  });
});
