import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ComingSoon from './ComingSoon';

it('shows the title and the Coming soon text', () => {
    render(<ComingSoon title="Compare" />);

    expect(screen.getByRole('heading', { name: 'Compare' })).toBeTruthy();
    expect(screen.getByText('Coming soon.')).toBeTruthy();
});