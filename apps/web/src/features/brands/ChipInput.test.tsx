// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { addChip, ChipInput } from './ChipInput';

function Harness({
  initial = [],
  max = 3,
  suggestions = [],
}: {
  initial?: string[];
  max?: number;
  suggestions?: string[];
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <ChipInput
        label="Aliases"
        value={value}
        onChange={setValue}
        max={max}
        suggestions={suggestions}
      />
      <output data-testid="value">{value.join('|')}</output>
    </>
  );
}

const value = () => screen.getByTestId('value').textContent;

describe('addChip', () => {
  it('trims, skips blanks and case-insensitive repeats, and respects the max', () => {
    expect(addChip(['Acme'], '  Acme  Inc ', 3)).toEqual(['Acme', 'Acme Inc']);
    expect(addChip(['Acme'], 'ACME', 3)).toEqual(['Acme']);
    expect(addChip(['Acme'], '   ', 3)).toEqual(['Acme']);
    expect(addChip(['a', 'b'], 'c', 2)).toEqual(['a', 'b']);
  });
});

describe('ChipInput', () => {
  it('adds chips with Enter and comma, ignoring repeats', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    const input = screen.getByLabelText(/Aliases/);
    await user.type(input, 'Acme{Enter}Acme Co,acme{Enter}');
    expect(value()).toBe('Acme|Acme Co');
  });

  it('removes a chip with its button and the last one with Backspace', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={['One', 'Two', 'Three']} max={5} />);
    await user.click(screen.getByRole('button', { name: 'Remove Two' }));
    expect(value()).toBe('One|Three');
    await user.type(screen.getByLabelText(/Aliases/), '{Backspace}');
    expect(value()).toBe('One');
  });

  it('stops at the max and offers suggestions until then', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness initial={['One']} max={2} suggestions={['One', 'Two']} />);
    expect(screen.queryByRole('button', { name: 'One' })).toBeNull(); // already added
    await user.click(screen.getByRole('button', { name: 'Two' }));
    expect(value()).toBe('One|Two');
    expect(screen.getByLabelText<HTMLInputElement>(/Aliases/).disabled).toBe(true);
    expect(screen.getByText('2/2')).toBeTruthy();
  });
});
