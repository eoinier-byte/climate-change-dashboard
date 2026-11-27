import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { COUNTIES } from '../data/counties';
import { ROUTES } from '../routes';
import { sendChat } from '../services/api';
import { answerLabel, chatLinks } from './chatLinks';
import '../styles/chat.css';

// What the server accepts (ChatSerializer in the backend): at most 20 messages; a question can be
// 500 characters, and Boreas's own earlier answers up to 4,000 (Taras's change in CCD-442)
const MAX_QUESTION = 500;
const MAX_ANSWER = 4000;
const MAX_MESSAGES = 20;

// The AI assistant chat (CCD-386, CCD-387, story CCD-371).
// An "Ask Boreas" button sits in the bottom-right corner of every page. Clicking it opens a
// panel on the right where people type a question and see the answer appear as it is written.
// On a county page the panel tells the assistant which county the person is looking at.
// Under each answer: what it shows (e.g. "Rainfall · RCP4.5 · 2021–2050"), its sources, and links
// to the part of the site that shows it (see chatLinks.js).

// Links inside an answer: other websites open in a new tab, so the dashboard stays open
function AnswerLink({ href, children }) {
  const external = /^https?:\/\//.test(href ?? '');
  return (
    <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
      {children}
    </a>
  );
}

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  // The conversation so far. An answer also keeps what came with it:
  // { role: 'assistant', content, sources, mapAction, tools, pageCounty }
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(''); // what is typed in the box
  const [busy, setBusy] = useState(false); // true while an answer is coming in
  const [lookingUp, setLookingUp] = useState(false); // true while the assistant looks up data
  // A problem to show: { message, status } (status is e.g. 429, or null), or null when all is well
  const [error, setError] = useState(null);

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
      // Keep what was looked up: it tells chatLinks which county the answer is about
      updateLastMessage((message) => ({
        ...message,
        tools: [...message.tools, { name: event.name, input: event.input }],
      }));
    } else if (event.type === 'text') {
      setLookingUp(false);
      updateLastMessage((message) => ({ ...message, content: message.content + event.text }));
    } else if (event.type === 'done') {
      updateLastMessage((message) => ({
        ...message,
        sources: event.sources ?? [],
        mapAction: event.map_action ?? null,
      }));
    } else if (event.type === 'error') {
      setError({ message: event.text, status: null });
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;

    const history = [...messages, { role: 'user', content: question }];
    // Show the question, plus an empty answer that fills in as the text arrives.
    // pageCounty remembers where the question was asked, for the links under the answer.
    setMessages([...history, { role: 'assistant', content: '', tools: [], pageCounty: county }]);
    setDraft('');
    setError(null);
    setBusy(true);

    // What the server gets: only role and content, no empty answers (from earlier errors),
    // each cut to the server's limit for its role, and only the last 20
    const toSend = history
      .filter((message) => message.content)
      .map(({ role, content }) => ({
        role,
        content: content.slice(0, role === 'user' ? MAX_QUESTION : MAX_ANSWER),
      }))
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
      if (err?.name !== 'AbortError') setError({ message: err.message, status: err.status ?? null });
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

  // A signed-out person who used up their questions: offer to sign in (the server's 429 says "Sign in…")
  const needsSignIn = error?.status === 429 && error.message.startsWith('Sign in');

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

                // A question: shown as typed
                if (message.role === 'user') {
                  return (
                    <li key={index} className="chat-message chat-user">
                      {message.content}
                    </li>
                  );
                }

                // An empty answer: show what is happening while we wait, or nothing if it failed
                if (!message.content) {
                  if (!(isLast && busy)) return null;
                  return (
                    <li key={index} className="chat-message chat-assistant chat-status">
                      {lookingUp ? 'Looking up the data…' : 'Thinking…'}
                    </li>
                  );
                }

                // An answer: Boreas writes Markdown (bold, lists), so draw it as formatted text.
                // The label and links only appear once the answer is finished ("done" has arrived).
                const finished = message.sources !== undefined;
                const label = finished ? answerLabel(message.mapAction) : null;
                const links = finished ? chatLinks(message) : [];
                return (
                  <li key={index} className="chat-message chat-assistant">
                    <Markdown components={{ a: AnswerLink }}>{message.content}</Markdown>
                    {label && <p className="chat-meta">{label}</p>}
                    {message.sources?.length > 0 && (
                      <ul className="chat-sources" aria-label="Sources">
                        {message.sources.map((source) => (
                          <li key={source.url}>
                            <AnswerLink href={source.url}>{source.name}</AnswerLink>
                          </li>
                        ))}
                      </ul>
                    )}
                    {links.length > 0 && (
                      <ul className="chat-links" aria-label="See it on the site">
                        {links.map((link) => (
                          <li key={link.to}>
                            <Link to={link.to}>{link.label}</Link>
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
                {error.message}
              </p>
            )}
            {needsSignIn && (
              <p className="chat-signin">
                <Link to={ROUTES.login}>Sign in</Link> or <Link to={ROUTES.register}>create an account</Link> to
                ask more questions.
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
                maxLength={MAX_QUESTION}
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