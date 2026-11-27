// Example answers for the AI chat (CCD-386, CCD-387), used when VITE_USE_MOCKS=true.
// They send the same kinds of events as the real POST /api/agent/chat/, with short pauses
// between them, so the chat panel can be built and shown without the backend or an AI key:
//   - a question with "sea", "flood" or "coast" in it: a sea-level answer (links to the flood map)
//   - a question with "rain" in it: a rainfall answer (links to the county page and the Ireland map)
//   - anything else: a temperature answer (the same links)
// The county is the page's county (context), or Cork.
//
// THESE ARE EXAMPLE ANSWERS, NOT REAL ADVICE OR REAL NUMBERS.

// Wait for a number of milliseconds
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// "cork" -> "Cork"
const nameOf = (slug) => slug.charAt(0).toUpperCase() + slug.slice(1);

// "async function*" makes a generator: it hands back one event at a time with "yield",
// and sendChat reads them with "for await", just like lines arriving from the server.
export async function* mockChatEvents(messages, context) {
  const question = messages[messages.length - 1].content;
  const county = context?.county ?? 'cork';
  const delay = Number(import.meta.env.VITE_MOCK_DELAY_MS) || 150;
  const asks = (...words) => words.some((word) => question.toLowerCase().includes(word));

  // Which kind of answer, and the "Show on map" view that comes with it (sea level has none)
  let tool = 'get_projections';
  let mapAction = { variable: 'temperature', season: 'annual', scenario: 'rcp45', period: '2021-2050' };
  let topic = 'warmer summers';
  if (asks('sea', 'flood', 'coast')) {
    tool = 'get_sea_level';
    mapAction = null;
    topic = 'a higher sea along the coast';
  } else if (asks('rain')) {
    mapAction = { ...mapAction, variable: 'precipitation' };
    topic = 'changes in rainfall';
  }

  // 1. The assistant "looks up" some data
  yield { type: 'tool', name: tool, input: { county } };
  await wait(delay);

  // 2. The answer arrives in a few pieces, written in Markdown like the real one
  const pieces = [
    '**This is an example answer**, because mock mode is on.\n\n',
    `You asked: "${question}"\n\n`,
    `For County ${nameOf(county)}, the real assistant would explain ${topic}:\n\n`,
    '- what changes, in plain words\n',
    '- by how much, under the middle path (RCP4.5)\n',
  ];
  for (const text of pieces) {
    yield { type: 'text', text };
    await wait(delay);
  }

  // 3. The answer is finished, with where the information came from and the map view
  yield { type: 'done', sources: [{ name: 'About this data', url: '/about' }], map_action: mapAction };
}