// Tests for the AI-generated summary block (CCD-285)
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AiCommentary from './AiCommentary';
import { ApiError, getCommentary } from '../services/api';
import { mockGet } from '../mocks/mockResponses';

// Replace the real API call with a fake, so the tests never need the backend. ApiError is
// kept real, to build a 503 the way services/api.js does.
vi.mock('../services/api', async (importOriginal) => ({
  ...(await importOriginal()),
  getCommentary: vi.fn(),
}));

const ALL = ['rcp26', 'rcp45', 'rcp85'];

function renderBlock({ slug = 'cork', selected = ALL } = {}) {
  return render(<AiCommentary slug={slug} selected={selected} />);
}

describe('AiCommentary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCommentary.mockImplementation(async (slug, scenario) => mockGet(`/agent/commentary/${slug}/${scenario}/`).body);
  });

  it('is labelled "AI-generated summary" and says the AI wrote it', async () => {
    renderBlock();
    expect(screen.getByRole('heading', { name: /AI-generated summary/ })).toBeTruthy();
    expect(await screen.findByText(/Written by an AI/)).toBeTruthy();
    // The label is still there once the text has loaded
    expect(screen.getByRole('heading', { name: /AI-generated summary/ })).toBeTruthy();
  });

  it('shows a loading message until the summary arrives', async () => {
    getCommentary.mockImplementation(() => new Promise(() => {})); // never answers
    renderBlock();
    expect(screen.getByRole('status').textContent).toMatch(/Writing the summary/);
  });

  it('shows the summary and every detail line for a coastal county', async () => {
    renderBlock();
    expect(await screen.findByText(/Cork is projected to get warmer and wetter/)).toBeTruthy();
    const labels = screen.getAllByRole('listitem').map((item) => item.querySelector('strong').textContent);
    expect(labels).toEqual(['Temperature:', 'Rainfall:', 'Scenarios:', 'Climate analogue:', 'Sea level:']);
  });

  it('has no sea-level line for an inland county', async () => {
    renderBlock({ slug: 'offaly' });
    await screen.findByText(/Offaly is projected to get warmer and wetter/);
    const labels = screen.getAllByRole('listitem').map((item) => item.querySelector('strong').textContent);
    expect(labels).toEqual(['Temperature:', 'Rainfall:', 'Scenarios:', 'Climate analogue:']);
    expect(screen.queryByText(/Sea level/)).toBeNull();
  });

  it('is hidden when no summary is available (503)', async () => {
    getCommentary.mockRejectedValue(new ApiError('API error 503 for /agent/commentary/cork/rcp45/', { status: 503 }));
    renderBlock();
    // While it waits, the block is there; once the 503 arrives, the heading goes too
    expect(screen.getByRole('status')).toBeTruthy();
    await vi.waitFor(() => expect(screen.queryByRole('heading')).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('follows the page: the highest ticked scenario, and a new one is requested when it changes', async () => {
    const { rerender } = renderBlock({ selected: ['rcp26', 'rcp45'] });
    await screen.findByText(/medium emissions future/);
    expect(getCommentary).toHaveBeenLastCalledWith('cork', 'rcp45', expect.anything());
    expect(screen.getByText(/RCP4.5: Middle path/)).toBeTruthy();

    rerender(<AiCommentary slug="cork" selected={['rcp26']} />);
    await screen.findByText(/low emissions future/);
    expect(getCommentary).toHaveBeenLastCalledWith('cork', 'rcp26', expect.anything());
  });

  it('shows the loading message again, not the old text, when the scenario changes', async () => {
    const { rerender } = renderBlock({ selected: ['rcp45'] });
    await screen.findByText(/medium emissions future/);

    getCommentary.mockImplementation(() => new Promise(() => {}));
    rerender(<AiCommentary slug="cork" selected={['rcp85']} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText(/medium emissions future/)).toBeNull();
  });
});
