// Tests for the AI assistant chat panel (CCD-386, CCD-387, CCD-388): opening and closing, sending a
// question with the county it was asked on, the answer appearing as formatted text, sources, the
// label and links under an answer, and errors.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatPanel from './ChatPanel';
import { ApiError, sendChat } from '../services/api';
import { currentLocation, renderWithRouter } from '../test/renderWithRouter';

// Replace the real chat call with a fake, so the tests never need the backend or an AI key.
// ApiError is kept real, so a test can make the fake throw one.
vi.mock('../services/api', async (importOriginal) => {
  const real = await importOriginal();
  return { ApiError: real.ApiError, sendChat: vi.fn() };
});

const RAIN_45_MID = { variable: 'precipitation', season: 'annual', scenario: 'rcp45', period: '2021-2050' };
const TEMP_45_MID = { variable: 'temperature', season: 'annual', scenario: 'rcp45', period: '2021-2050' };

// A fake sendChat that "streams" the given events, then finishes
function answerWith(events) {
  vi.mocked(sendChat).mockImplementation(async (_messages, _context, { onEvent }) => {
    events.forEach((event) => onEvent(event));
  });
}

// Ask a question by typing it and pressing Enter
async function ask(user, question) {
  await user.type(screen.getByLabelText('Your question'), `${question}{Enter}`);
}

// Open the page at "url", open the panel and ask a question
async function openAndAsk(question, url = '/') {
  const user = userEvent.setup();
  renderWithRouter(<ChatPanel />, { url });
  await user.click(screen.getByRole('button', { name: 'Ask Boreas' }));
  await ask(user, question);
  return user;
}

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.mocked(sendChat).mockReset();
    answerWith([
      { type: 'tool', name: 'get_projections', input: { county: 'cork' } },
      { type: 'text', text: 'Summers in Cork ' },
      { type: 'text', text: 'are projected to get warmer.' },
      { type: 'done', sources: [{ name: 'About this data', url: '/about' }], map_action: null },
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
    await openAndAsk('Will Cork get hotter?', '/county/cork');

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
    await openAndAsk('Which county warms most?', '/about');
    await screen.findByText('Summers in Cork are projected to get warmer.');
    expect(vi.mocked(sendChat).mock.calls[0][1]).toBeUndefined();
  });

  it('sends the earlier conversation with a follow-up, cutting answers to 4,000 characters', async () => {
    const longAnswer = 'x'.repeat(4100);
    answerWith([{ type: 'text', text: longAnswer }, { type: 'done', sources: [] }]);
    const user = await openAndAsk('First question');
    await screen.findByText(longAnswer);

    await ask(user, 'Second question');

    const [messages] = vi.mocked(sendChat).mock.calls[1];
    expect(messages).toEqual([
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'x'.repeat(4000) },
      { role: 'user', content: 'Second question' },
    ]);
  });

  it('draws the answer from Markdown, so bold text and lists are formatted', async () => {
    answerWith([
      { type: 'text', text: '**Warmer** summers:\n\n- more hot days\n- fewer frosts' },
      { type: 'done', sources: [] },
    ]);
    await openAndAsk('What changes?');

    expect((await screen.findByText('Warmer')).tagName).toBe('STRONG');
    expect(screen.getByText('more hot days').tagName).toBe('LI');
    expect(screen.queryByText(/\*\*/)).toBeNull(); // no raw ** left on screen
  });

  it('shows what a rainfall answer is about, and links to the county page but not the Ireland map', async () => {
    answerWith([
      { type: 'tool', name: 'get_projections', input: { county: 'cork' } },
      { type: 'text', text: 'Cork gets a little wetter.' },
      { type: 'done', sources: [], map_action: RAIN_45_MID },
    ]);
    await openAndAsk('Will Cork get wetter?');

    expect(await screen.findByText('Rainfall · RCP4.5 · 2021–2050')).toBeTruthy();
    const links = within(screen.getByRole('list', { name: 'See it on the site' }));
    expect(links.getByRole('link', { name: "See it on Cork's page" }).getAttribute('href')).toBe(
      '/county/cork?rcp=45&period=2021-2050#rainfall-heading',
    );
    // The Ireland map only shows temperature
    expect(links.queryByRole('link', { name: /Ireland map/ })).toBeNull();
  });

  it('links a temperature answer to the county page and the Ireland map', async () => {
    answerWith([
      { type: 'tool', name: 'get_projections', input: { county: 'cork' } },
      { type: 'text', text: 'Cork gets warmer.' },
      { type: 'done', sources: [], map_action: TEMP_45_MID },
    ]);
    await openAndAsk('Will Cork get warmer?');

    expect(await screen.findByText('Temperature · RCP4.5 · 2021–2050')).toBeTruthy();
    const links = within(screen.getByRole('list', { name: 'See it on the site' }));
    expect(links.getByRole('link', { name: "See it on Cork's page" }).getAttribute('href')).toBe(
      '/county/cork?rcp=45&period=2021-2050#temperature-heading',
    );
    expect(links.getByRole('link', { name: 'Show RCP4.5, 2050 on the Ireland map' }).getAttribute('href')).toBe(
      '/?rcp=45&year=2050',
    );
  });

  it('opens the page when a link is clicked', async () => {
    answerWith([
      { type: 'text', text: 'Here is the map.' },
      { type: 'done', sources: [], map_action: TEMP_45_MID },
    ]);
    const user = await openAndAsk('Show me the map', '/about');

    await user.click(await screen.findByRole('link', { name: 'Show RCP4.5, 2050 on the Ireland map' }));
    expect(currentLocation()).toBe('/?rcp=45&year=2050');
  });

  it('shows no links before the answer is finished', async () => {
    // Text arrives, but "done" never does
    vi.mocked(sendChat).mockImplementation((_messages, _context, { onEvent }) => {
      onEvent({ type: 'text', text: 'Still writing' });
      return new Promise(() => {});
    });
    await openAndAsk('Will Cork get wetter?', '/county/cork');

    await screen.findByText('Still writing');
    expect(screen.queryByRole('list', { name: 'See it on the site' })).toBeNull();
  });

  it('shows "Looking up the data…" while the assistant looks something up', async () => {
    // Sends a "tool" event, then never finishes
    vi.mocked(sendChat).mockImplementation((_messages, _context, { onEvent }) => {
      onEvent({ type: 'tool', name: 'get_sea_level', input: { county: 'cork' } });
      return new Promise(() => {});
    });
    await openAndAsk('Will the sea rise?');

    expect(await screen.findByText('Looking up the data…')).toBeTruthy();
    // While an answer is coming in, nothing else can be sent
    expect(screen.getByRole('button', { name: 'Send' }).disabled).toBe(true);
  });

  it('shows the server message and a sign-in link when the chat limit is reached', async () => {
    vi.mocked(sendChat).mockRejectedValue(
      new ApiError('Sign in to keep chatting with Boreas.', { status: 429, path: '/agent/chat/' }),
    );
    await openAndAsk('One more question');

    expect((await screen.findByRole('alert')).textContent).toBe('Sign in to keep chatting with Boreas.');
    expect(screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')).toBe('/login');
    expect(screen.getByRole('link', { name: 'create an account' }).getAttribute('href')).toBe('/register');
  });

  it('shows the text of an "error" event, with no sign-in link', async () => {
    answerWith([{ type: 'error', text: 'Boreas could not catch that one.' }]);
    await openAndAsk('Hello');

    expect((await screen.findByRole('alert')).textContent).toBe('Boreas could not catch that one.');
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('opens links to other websites in a new tab, and our own pages in the same tab', async () => {
    answerWith([
      { type: 'text', text: 'Here are the sources.' },
      {
        type: 'done',
        sources: [
          { name: 'Climate Ireland', url: 'https://www.climateireland.ie/' },
          { name: 'About this data', url: '/about' },
        ],
      },
    ]);
    await openAndAsk('Where is this from?');

    const external = await screen.findByRole('link', { name: 'Climate Ireland' });
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');

    const internal = screen.getByRole('link', { name: 'About this data' });
    expect(internal.getAttribute('target')).toBeNull();
  });

  it('opens our own pages without reloading, so the chat history stays', async () => {
    answerWith([
      { type: 'text', text: 'See [how the data was made](/about).' },
      { type: 'done', sources: [{ name: 'About this data', url: '/about' }] },
    ]);
    const user = await openAndAsk('Where is this from?');

    // A link inside the answer goes to the page through the router (a plain <a> would reload the page)
    await user.click(await screen.findByRole('link', { name: 'how the data was made' }));
    expect(currentLocation()).toBe('/about');
    // The conversation is still there
    expect(screen.getByText('Where is this from?')).toBeTruthy();

    // The same for a source
    await user.click(screen.getByRole('link', { name: 'About this data' }));
    expect(currentLocation()).toBe('/about');
    expect(screen.getByText('Where is this from?')).toBeTruthy();
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