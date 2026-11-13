import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../App.jsx';
import { ROUTES } from '../routes';

describe('chat panel slot', () => {
  it('is on every page, empty and hidden', () => {
    [ROUTES.home, ROUTES.about, '/nope'].forEach((path) => {
      const { unmount } = render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );
      const slot = document.getElementById('chat-panel-root');
      expect(slot).not.toBeNull();
      expect(slot.hidden).toBe(true);
      expect(slot.childElementCount).toBe(0);
      unmount();
    });
  });
});
