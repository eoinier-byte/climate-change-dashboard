import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formErrorsFrom } from '../auth/formErrors';
import { validateNewPassword } from '../auth/validation';
import FormField from '../components/FormField';
import Loading from '../components/Loading';
import { checkResetLink, resetPassword } from '../services/api';
import { ROUTES } from '../routes';
import '../styles/auth.css';

const FIELDS = ['new_password', 'new_password2'];

// The page the "reset your password" email links to: /recovery/{user_id}/{code} (CCD-435).
// First it asks the server whether the link can still be used (the check does not use it up), then shows the
// form. A link works once, so after a 404 or 410 the visitor is offered a new one.
export default function ResetPassword() {
  const { userId, code } = useParams();
  const [link, setLink] = useState('checking'); // checking | ok | gone | error
  const [values, setValues] = useState({ new_password: '', new_password2: '' });
  const [errors, setErrors] = useState({});
  const [formMessages, setFormMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    checkResetLink(userId, code, { signal: controller.signal })
      .then(() => setLink('ok'))
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        setLink(error?.status === 404 || error?.status === 410 ? 'gone' : 'error');
      });
    return () => controller.abort();
  }, [userId, code]);

  if (link === 'checking') return <main className="auth-page"><Loading message="Checking your link…" /></main>;

  if (link === 'gone') {
    return (
      <main className="auth-page">
        <h1>This link has expired</h1>
        <p>Links work once and last 1 hour. Ask for a new one and we will email it to you.</p>
        <p>
          <Link to={ROUTES.forgotPassword} className="btn">
            Ask for a new link
          </Link>
        </p>
      </main>
    );
  }

  if (link === 'error') {
    return (
      <main className="auth-page">
        <h1>We could not check your link</h1>
        <p>Check your internet connection and reload the page. If it keeps happening, ask for a new link.</p>
        <p>
          <Link to={ROUTES.forgotPassword}>Ask for a new link</Link>
        </p>
      </main>
    );
  }

  if (done) {
    return (
      <main className="auth-page">
        <div role="status">
          <h1>Password changed</h1>
          <p>You can now log in with your new password.</p>
        </div>
        <p>
          <Link to={ROUTES.login} className="btn">
            Log in
          </Link>
        </p>
      </main>
    );
  }

  const change = (event) => setValues({ ...values, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    const problems = validateNewPassword(values);
    setErrors(problems);
    setFormMessages([]);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    try {
      await resetPassword(userId, code, values);
      setDone(true);
    } catch (error) {
      if (error?.status === 404 || error?.status === 410) {
        setLink('gone'); // used or expired while the form was open
        return;
      }
      const { form, fields } = formErrorsFrom(error, { fields: FIELDS });
      setErrors(fields);
      setFormMessages(form);
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <h1>Choose a new password</h1>
      <p>This link works once. After you save, any other reset links we sent you stop working.</p>

      <form className="auth-form" onSubmit={submit} noValidate>
        {formMessages.length > 0 && (
          <div className="auth-form__error" role="alert">
            {formMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
        <FormField
          id="reset-new"
          name="new_password"
          type="password"
          label="New password"
          hint="At least 8 characters, not a common password, not only numbers."
          autoComplete="new-password"
          value={values.new_password}
          onChange={change}
          error={errors.new_password}
        />
        <FormField
          id="reset-new2"
          name="new_password2"
          type="password"
          label="Repeat the new password"
          autoComplete="new-password"
          value={values.new_password2}
          onChange={change}
          error={errors.new_password2}
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </main>
  );
}
