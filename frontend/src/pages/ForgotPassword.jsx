import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formErrorsFrom } from '../auth/formErrors';
import { validateEmail } from '../auth/validation';
import FormField from '../components/FormField';
import { requestPasswordReset } from '../services/api';
import { ROUTES } from '../routes';
import '../styles/auth.css';

// "Forgot your password?" (CCD-434). The server answers the same whether or not the address has an account,
// so the page never says which. The email's link opens /recovery/... (ResetPassword.jsx).
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [formMessages, setFormMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const problems = validateEmail({ email });
    setErrors(problems);
    setFormMessages([]);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (error) {
      const { form, fields } = formErrorsFrom(error, { fields: ['email'] });
      setErrors(fields);
      setFormMessages(form);
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <main className="auth-page">
        <div role="status">
          <h1>Check your email</h1>
          <p>If that address has an account, we have sent a link to it. It works once and lasts 1 hour.</p>
          <p className="auth-muted">Nothing arrived after a few minutes? Check your spam folder, or try again.</p>
        </div>
        <div className="auth-actions">
          <button type="button" className="btn btn--secondary" onClick={() => setSent(false)}>
            Try another address
          </button>
          <Link to={ROUTES.login}>Back to log in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <h1>Forgot your password?</h1>
      <p>Enter the email you registered with. We will send you a link to choose a new password. The link works once and lasts 1 hour.</p>

      <form className="auth-form" onSubmit={submit} noValidate>
        {formMessages.length > 0 && (
          <div className="auth-form__error" role="alert">
            {formMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
        <FormField
          id="forgot-email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Sending…' : 'Send link'}
        </button>
      </form>
      <p>
        <Link to={ROUTES.login}>Back to log in</Link>
      </p>
    </main>
  );
}
