import { useState } from 'react';
import { formErrorsFrom } from '../auth/formErrors';
import { validateEmail } from '../auth/validation';
import { changeEmail } from '../services/api';
import FormField from './FormField';

// "Email" on the account page (CCD-433): the current address, whether it is confirmed, and a form to change it.
// The server emails a link to the NEW address; the current one stays until that link is opened.
// Props: user (the profile), onSaved (asks the page to load the profile again)
export default function ProfileEmail({ user, onSaved }) {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [formMessages, setFormMessages] = useState([]);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const problems = validateEmail({ email });
    setErrors(problems);
    setFormMessages([]);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    try {
      await changeEmail(email.trim());
      setEmail('');
      await onSaved(); // the profile now has pending_email
    } catch (error) {
      const { form, fields } = formErrorsFrom(error, { fields: ['email'] });
      setErrors(fields);
      setFormMessages(form);
    }
    setBusy(false);
  };

  return (
    <section className="account-section" aria-labelledby="account-email-title">
      <h2 id="account-email-title">Email</h2>

      <p className="account-email">
        <span>{user.email}</span>
        <span className="account-badge">{user.is_verified ? '✓ Confirmed' : 'Not confirmed yet'}</span>
      </p>
      {!user.is_verified && (
        <p className="auth-field__hint">We sent a confirmation link when you registered. Check your inbox and spam folder. Links last 1 hour.</p>
      )}

      {user.pending_email && (
        <div className="account-notice" role="status">
          <strong>Waiting for you to confirm {user.pending_email}.</strong>
          <p>We sent a link to that address. Your current email stays until you open it. The link works once and lasts 1 hour.</p>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        {formMessages.length > 0 && (
          <div className="auth-form__error" role="alert">
            {formMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
        <FormField
          id="account-new-email"
          name="email"
          type="email"
          label="New email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <button type="submit" className="btn btn--secondary" disabled={busy}>
          {busy ? 'Sending…' : 'Send confirmation link'}
        </button>
      </form>
    </section>
  );
}
