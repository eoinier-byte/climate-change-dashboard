import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';

const routes = [
  ['/', 'Home'], ['/counties', 'Choose your county'], ['/county/cork', 'County dashboard'],
  ['/compare', 'Compare scenarios'], ['/sea-level', 'Sea level'], ['/analogue', 'Climate analogue'],
  ['/nope', 'Page not found'],
];

describe('routes', () => {
  it.each(routes)('%s shows its page', (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
  });
});
