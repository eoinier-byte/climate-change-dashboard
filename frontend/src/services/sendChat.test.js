// Tests for sendChat (CCD-386, CCD-388): the POST it makes, reading the streamed answer
// line by line (even when a line is split between two chunks), errors and mock mode.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, sendChat } from './api';

const BASE = 'http://api.test/api';
const QUESTION = [{ role: 'user', content: 'Will Cork get hotter?' }];

// A fake streamed Response: each string in "chunks" arrives as one piece of data
function streamResponse(chunks) {
  const encoder = new TextEncoder();
  let next = 0;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () =>
          next < chunks.length
            ? { done: false, value: encoder.encode(chunks[next++]) }
            : { done: true, value: undefined },
      }),
    },
  };
}

let fetchMock;

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', BASE);
  vi.stubEnv('VITE_USE_MOCKS', 'false');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('sendChat', () => {
  it('POSTs the messages and context as JSON to /agent/chat/', async () => {
    fetchMock.mockResolvedValue(streamResponse([]));
    await sendChat(QUESTION, { county: 'cork' }, { onEvent: vi.fn() });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/agent/chat/`);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual({ messages: QUESTION, context: { county: 'cork' } });
  });

  it('leaves context out when there is none', async () => {
    fetchMock.mockResolvedValue(streamResponse([]));
    await sendChat(QUESTION, undefined, { onEvent: vi.fn() });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ messages: QUESTION });
  });

  it('calls onEvent once per line, even when a line is split between two chunks', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        '{"type":"text","text":"Hel',
        'lo"}\n{"type":"text","text":" there"}\n',
        '{"type":"done","sources":[]}', // the last line has no line break after it
      ]),
    );
    const onEvent = vi.fn();
    await sendChat(QUESTION, undefined, { onEvent });

    expect(onEvent.mock.calls.map(([event]) => event)).toEqual([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: ' there' },
      { type: 'done', sources: [] },
    ]);
  });

  it('throws an ApiError with the server message for 429 (too many questions)', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ detail: 'Sign in to keep chatting with Boreas.' }),
    });
    const error = await sendChat(QUESTION, undefined, { onEvent: vi.fn() }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(429);
    expect(error.message).toBe('Sign in to keep chatting with Boreas.');
  });

  it('throws a readable ApiError when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await sendChat(QUESTION, undefined, { onEvent: vi.fn() }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBeNull();
    expect(error.message).toMatch(/Could not reach the server/);
  });

  it('plays back the example answer in mock mode, without calling the server', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'true');
    vi.stubEnv('VITE_MOCK_DELAY_MS', '1'); // keep the test fast
    const onEvent = vi.fn();
    await sendChat(QUESTION, undefined, { onEvent });

    const types = onEvent.mock.calls.map(([event]) => event.type);
    expect(types[0]).toBe('tool');
    expect(types).toContain('text');
    expect(types.at(-1)).toBe('done');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});