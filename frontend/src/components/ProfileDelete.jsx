import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formErrorsFrom } from '../auth/formErrors';
import { useAuth } from '../hooks/useAuth';
import { deleteAccount } from '../services/api';
import { ROUTES } from '../routes';

// "Delete account" on the account page (CCD-448). Deleting cannot be undone, so the button only opens a
// question, "Yes, delete my account" does the deleting, and focus starts on "Cancel". The server deletes the
// account and the photo and ends the session in the same request (DELETE /auth/profile/me/delete/, 204),
// so the page forgets the user without asking the server again, then goes to the home page.
export default function ProfileDelete() {
  const { forget } = useAuth();
  const navigate = useNavigate();
  const cancelButton = useRef(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([]);

  // Put the cursor on the safe choice when the question appears
  useEffect(() => {
    if (asking) cancelButton.current?.focus();
  }, [asking]);

  const confirm = async () => {
    setBusy(true);
    setMessages([]);
    try {
      await deleteAccount();
    } catch (error) {
      setMessages(formErrorsFrom(error).form);
      setBusy(false);
      return;
    }
    forget();
    navigate(ROUTES.home);
  };

  return (
    <section className="account-section account-section--danger" aria-labelledby="account-delete-title">
      <h2 id="account-delete-title">Delete account</h2>
      <p>This removes your account and your photo for good. You will be signed out.</p>

      {!asking ? (
        <button type="button" className="btn btn--danger-outline" onClick={() => setAsking(true)}>
          Delete my account…
        </button>
      ) : (
        <div className="account-notice account-notice--danger" role="group" aria-label="Confirm deleting your account">
          <strong>Are you sure? This cannot be undone.</strong>
          {messages.length > 0 && (
            <div className="auth-form__error" role="alert">
              {messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}
          <div className="auth-actions">
            <button type="button" className="btn btn--danger" disabled={busy} onClick={confirm}>
              {busy ? 'Deleting…' : 'Yes, delete my account'}
            </button>
            <button type="button" className="btn btn--secondary" ref={cancelButton} disabled={busy} onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
