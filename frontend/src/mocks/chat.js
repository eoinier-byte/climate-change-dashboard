// Example answer for the AI chat (CCD-386), used when VITE_USE_MOCKS=true.
// It sends the same kinds of events as the real POST /api/agent/chat/, with short pauses
// between them, so the chat panel can be built and shown without the backend or an AI key.
//
// THIS IS AN EXAMPLE ANSWER, NOT REAL ADVICE OR REAL NUMBERS.

// Wait for a number of milliseconds
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "async function*" makes a generator: it hands back one event at a time with "yield",
// and sendChat reads them with "for await", just like lines arriving from the server.
export async function* mockChatEvents(messages) {
  const question = messages[messages.length - 1].content;
  const delay = Number(import.meta.env.VITE_MOCK_DELAY_MS) || 150;

  // 1. The assistant "looks up" some data
  yield { type: 'tool', name: 'get_projections', input: { county: 'cork' } };
  await wait(delay);

  // 2. The answer arrives in a few pieces
  const pieces = [
    'This is an example answer, because mock mode is on. ',
    `You asked: "${question}" `,
    'The real assistant would look up the projections for your county and explain them here.',
  ];
  for (const text of pieces) {
    yield { type: 'text', text };
    await wait(delay);
  }

  // 3. The answer is finished, with where the information came from
  yield { type: 'done', sources: [{ name: 'About this data', url: '/about' }] };
}