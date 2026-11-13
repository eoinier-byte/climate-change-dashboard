import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import CountySearch from './CountySearch';
import { COUNTIES } from '../data/counties';
import { ROUTES } from '../routes';

function renderSearch() {
  render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={<CountySearch />} />
        <Route path={ROUTES.county} element={<p>County page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const input = () => screen.getByLabelText('Find a county');

describe('county search', () => {
  it('lists all 26 counties as suggestions', () => {
    renderSearch();
    expect(COUNTIES).toHaveLength(26);
    const list = document.getElementById(input().getAttribute('list'));
    const options = list.querySelectorAll('option');
    expect(options).toHaveLength(26);
  });

  it('opens the county dashboard when a county is chosen', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(input(), 'Cork');
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByText('County page')).toBeTruthy();
  });

  it('ignores capital letters and extra spaces, and works with Enter', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(input(), '  wiCKlow {Enter}');
    expect(screen.getByText('County page')).toBeTruthy();
  });

  it('shows an error for a name that is not a county and stays on the page', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.type(input(), 'Atlantis');
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('alert').textContent).toMatch(/26 counties/);
    expect(screen.queryByText('County page')).toBeNull();
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('clears the error when the person types again', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('alert')).toBeTruthy();
    await user.type(input(), 'C');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
