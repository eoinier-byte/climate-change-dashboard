// Tests for the AI assistant chat panel (CCD-386, CCD-388): opening and closing, sending a
// question with the county it was asked on, the answer appearing, sources and errors.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPanel from './ChatPanel';
import { ApiError, sendChat } from '../services/api';
import { renderWithRouter } from '../test/renderWithRouter';

// Replace the real chat call with a fake, so the tests never need the backend or an AI key.
// ApiError is kept real, so a test can make the fake throw one.
vi.mock('../services/api', async (importOriginal) => {
  const real = await importOriginal();
  return { ApiError: real.ApiError, sendChat: vi.fn() };
});

// A fake sendChat that "streams" the given events, then finishes
function answerWith(events) {
  vi.mocked(sendChat).mockImplementation(async (_messages, _context, { onEvent }) => {
    events.forEach((event) => onEvent(event));
  });
}

// Open the panel and ask a question by typing it and pressing Enter
async function ask(user, question) {
  await user.type(screen.getByLabelText('Your question'), `${question}{Enter}`);
}

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.mocked(sendChat).mockReset();
    answerWith([
      { type: 'tool', name: 'get_projections', input: { county: 'cork' } },
      { type: 'text', text: 'Summers in Cork ' },
      { type: 'text', text: 'are projected to get warmer.' },
      { type: 'done', sources: [{ name: 'About this data', url: '/about' }] },
    ]);
  });

  it('starts closed: only the "Ask Boreas" button shows and the slot is hidden and empty', () => {
    renderWithRouter(<ChatPanel />);
    expect(screen.getByRole('button', { name: 'Ask Boreas' })).toBeTruthy();
    const slot = document.getElementById('chat-panel-root');
    expect(slot.hidden).toBe(true);
    expect(slot.childElementCount).toBe(0);
  });

  it('opens with the county name on a county page, and closes with × or Escape', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ChatPanel />, { url: '/county/cork' });

    await user.click(screen.getByRole('button', { name: 'Ask Boreas' }));
    expect(screen.getByText(/climate projections for Cork/)).toBeTruthy();
    expect(document.getElementById('chat-panel-root').hidden).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Close chat' }));
    expect(document.getElementById('chat-panel-root').hidden).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Ask Boreas' }));
    await user.keyboard('{Escape}');
    expect(document.getElementById('chat-panel-root').hidden).toBe(true);
  });

  it('sends the question with the county, then shows the answer and its sources', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ChatPanel />, { url: '/county/cork' });
    await user.click(screen.getByRole('button', { name: 'Ask Boreas' }));
    await ask(user, 'Will Cork get hotter?');

    // The question and the joined pieces of the answer are on screen
    expect(await screen.findByText('Summers in Cork are projected to get warmer.')).toBeTruthy();
    expect(screen.getByText('Will Cork get hotter?')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'About this data' }).getAttribute('href')).toBe('/about');

    // What went to the server
    const [messages, context] = vi.mocked(sendChat).mock.calls[0];
    expect(messages).toEqual([{ role: 'user', content: 'Will Cork get hotter?' }]);
    expect(context).toEqual({ county: 'cork' });
  });

  it('sends no county when the question is asked away from a county page', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ChatPanel />, { url: '/about' });
    await user.click(screen.getByRole('button', { name: 'Ask Boreas' }));
    await ask(user, 'Which county warms most?');

    await screen.findByText('Summers in Cork are projected to get warmer.');
    expect(vi.mocked(sendChat).mock.calls[0][1]).toBeUndefined();
  });

  it('sends the earlier conversation with a follow-up, cutting long answers to 500 characters', async () => {
    const user = userEvent.setup();
    const longAnswer = 'x'.repeat(600);
    answerWith([{ type: 'text', text: longAnswer }, { type: 'done', sources: [] }]);
    renderWithRouter(<ChatPanel />);
    await user.click(screen.getByRole('button', { name: 'Ask Boreas' }));

    await ask(user, 'First question');
    await screen.findByText(longAnswer);
    await ask(user, 'Second question');

    const [messages] = vi.mocked(sendChat).mock.calls[1];
    expect(messages).toEqual([
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'x'.repeat(500) },
      { role: 'user', content: 'Second question' },
    ]);
  });

  it('shows "Looking up the data…" while the assistant looks something up', async () => {
    const user = userEvent.setup();
    // Sends a "tool" event, then never finishes
    vi.mocked(sendChat).mockImplementation((_messages, _context, { onEvent }) => {
      onEvent({ type: 'tool', name: 'get_sea_level', input: { county: 'cork' } });
      return new Promise(() => {});
    });
    renderWithRouter(<ChatPanel />);
    await user.click(screen.getByRole('button', { name: 'Ask Boreas' }));
    await ask(user, 'Will the sea rise?');

    expect(await screen.findByText('Looking up the data…')).toBeTruthy();
    // While an answer is coming in, nothing else can be sent
    expect(screen.getByRole('button', { name: 'Send' }).disabled).toBe(true);
  });

  it('shows the server message when the chat limit is reached', async () => {
    const user = userEvent.setup();
    vi.mocked(sendChat).mockRejectedValue(
      new ApiError('Sign in to keep chatting with Boreas.', { status: 429, path: '/agent/chat/' }),
    );
    renderWithRouter(<ChatPanel />);
    await user.click(screen.getByRole('button', { name: 'Ask Boreas' }));
    await ask(user, 'One more question');

    expect((await screen.findByRole('alert')).textContent).toBe('Sign in to keep chatting with Boreas.');
  });

  it('shows the text of an "error" event', async () => {
    const user = userEvent.setup();
    answerWith([{ type: 'error', text: 'Boreas could not catch that one.' }]);
    renderWithRouter(<ChatPanel />);
    await user.click(screen.getByRole('button', { name: 'Ask Boreas' }));
    await ask(user, 'Hello');

    expect((await screen.findByRole('alert')).textContent).toBe('Boreas could not catch that one.');
  });

  it('cannot send an empty question', async () => {
    const user = userEvent.setup();
    renderWithRouter(<ChatPanel />);
    await user.click(screen.getByRole('button', { name: 'Ask Boreas' }));

    expect(screen.getByRole('button', { name: 'Send' }).disabled).toBe(true);
    await user.type(screen.getByLabelText('Your question'), '   {Enter}');
    expect(sendChat).not.toHaveBeenCalled();
  });
});