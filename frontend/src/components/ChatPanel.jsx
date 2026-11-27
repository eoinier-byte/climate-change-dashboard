import { useEffect, useRef, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { COUNTIES } from '../data/counties';
import { ROUTES } from '../routes';
import { sendChat } from '../services/api';
import '../styles/chat.css';

// The server accepts at most 20 messages of 500 characters each (ChatSerializer in the backend)
const MAX_LENGTH = 500;
const MAX_MESSAGES = 20;

// The AI assistant chat (CCD-386, story CCD-371).
// An "Ask Boreas" button sits in the bottom-right corner of every page. Clicking it opens a
// panel on the right where people type a question and see the answer appear as it is written.
// On a county page the panel tells the assistant which county the person is looking at.
export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  // The conversation so far, e.g. [{ role: 'user', content: '...' }, { role: 'assistant', content: '...', sources: [...] }]
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(''); // what is typed in the box
  const [busy, setBusy] = useState(false); // true while an answer is coming in
  const [lookingUp, setLookingUp] = useState(false); // true while the assistant looks up data
  const [error, setError] = useState('');

  const inputRef = useRef(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);

  // Which county page we are on, if any: "/county/cork" gives "cork"
  const { pathname } = useLocation();
  const county = matchPath(ROUTES.county, pathname)?.params.slug;
  const countyName = COUNTIES.find((c) => c.slug === county)?.name;

  // Put the cursor in the text box when the panel opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the newest message in view as the answer grows.
  // (The "?." after scrollIntoView is because the test browser does not have it.)
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, lookingUp]);

  // If the panel is removed from the page, stop any answer that is still coming in
  useEffect(() => () => abortRef.current?.abort(), []);

  // Change the last message (the answer being written) without touching the others
  function updateLastMessage(change) {
    setMessages((current) => {
      const copy = [...current];
      copy[copy.length - 1] = change(copy[copy.length - 1]);
      return copy;
    });
  }

  // Called for every event the server sends (see sendChat in services/api.js)
  function handleEvent(event) {
    if (event.type === 'tool') {
      setLookingUp(true);
    } else if (event.type === 'text') {
      setLookingUp(false);
      updateLastMessage((message) => ({ ...message, content: message.content + event.text }));
    } else if (event.type === 'done') {
      updateLastMessage((message) => ({ ...message, sources: event.sources ?? [] }));
    } else if (event.type === 'error') {
      setError(event.text);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;

    const history = [...messages, { role: 'user', content: question }];
    // Show the question, plus an empty answer that fills in as the text arrives
    setMessages([...history, { role: 'assistant', content: '' }]);
    setDraft('');
    setError('');
    setBusy(true);

    // What the server gets: only role and content, no empty answers (from earlier errors),
    // each cut to 500 characters (long answers would be refused), and only the last 20
    const toSend = history
      .filter((message) => message.content)
      .map(({ role, content }) => ({ role, content: content.slice(0, MAX_LENGTH) }))
      .slice(-MAX_MESSAGES);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await sendChat(toSend, county ? { county } : undefined, {
        signal: controller.signal,
        onEvent: handleEvent,
      });
    } catch (err) {
      // A cancelled answer is not an error worth showing
      if (err?.name !== 'AbortError') setError(err.message);
    } finally {
      setBusy(false);
      setLookingUp(false);
    }
  }

  // Enter sends the question, Shift+Enter starts a new line
  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form.requestSubmit();
    }
  }

  return (
    <>
      {!open && (
        <button type="button" className="chat-open" onClick={() => setOpen(true)}>
          Ask Boreas
        </button>
      )}

      {/* Ronel's slot from CCD-403: hidden and empty while the chat is closed */}
      <aside
        id="chat-panel-root"
        className="chat-slot"
        aria-label="Chat panel"
        hidden={!open}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
      >
        {open && (
          <div className="chat">
            <header className="chat-header">
              <h2>Ask Boreas</h2>
              <button
                type="button"
                className="chat-close"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                ×
              </button>
            </header>

            <p className="chat-intro">
              Ask about Ireland's climate projections{countyName ? ` for ${countyName}` : ''}.
              Answers use the data on this site.
            </p>

            <ol className="chat-messages" aria-live="polite">
              {messages.map((message, index) => {
                const isLast = index === messages.length - 1;
                // An empty answer: show what is happening while we wait, or nothing if it failed
                if (message.role === 'assistant' && !message.content) {
                  if (!(isLast && busy)) return null;
                  return (
                    <li key={index} className="chat-message chat-assistant chat-status">
                      {lookingUp ? 'Looking up the data…' : 'Thinking…'}
                    </li>
                  );
                }
                return (
                  <li key={index} className={`chat-message chat-${message.role}`}>
                    {message.content}
                    {message.sources?.length > 0 && (
                      <ul className="chat-sources" aria-label="Sources">
                        {message.sources.map((source) => (
                          <li key={source.url}>
                            <a href={source.url}>{source.name}</a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ol>
            <div ref={endRef} />

            {error && (
              <p className="chat-error" role="alert">
                {error}
              </p>
            )}

            <form className="chat-form" onSubmit={handleSubmit}>
              <label htmlFor="chat-question" className="chat-label">
                Your question
              </label>
              <textarea
                id="chat-question"
                ref={inputRef}
                rows={2}
                maxLength={MAX_LENGTH}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Will summers get hotter here?"
              />
              <button type="submit" disabled={busy || !draft.trim()}>
                Send
              </button>
            </form>
          </div>
        )}
      </aside>
    </>
  );
}