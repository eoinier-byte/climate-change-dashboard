// Tests for the period choice on the county page (CCD-406).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PeriodFilter from './PeriodFilter';

const PERIODS = ['2021-2050', '2071-2100'];

describe('PeriodFilter', () => {
  it('shows each period with a plain-language name, and the chosen one selected', () => {
    render(<PeriodFilter periods={PERIODS} selected="2071-2100" onChange={() => {}} />);

    expect(screen.getByRole('radio', { name: 'Mid-century (2021-2050)' }).checked).toBe(false);
    expect(screen.getByRole('radio', { name: 'End of century (2071-2100)' }).checked).toBe(true);
  });

  it('calls onChange with the period that was picked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PeriodFilter periods={PERIODS} selected="2071-2100" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: 'Mid-century (2021-2050)' }));

    expect(onChange).toHaveBeenCalledWith('2021-2050');
  });

  it('has a visible group label', () => {
    render(<PeriodFilter periods={PERIODS} selected="2071-2100" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Seasonal charts show' })).toBeTruthy();
  });
});