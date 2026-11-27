import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { formErrorsFrom } from '../auth/formErrors';
import { validateLogin } from '../auth/validation';
import FormField from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../routes';
import '../styles/auth.css';

const FIELDS = ['login', 'password'];

// The login page (CCD-325). The server accepts a username or an email in "login".
// After logging in (or when already signed in), a visitor goes back to the page they came from, or to the home page.
export default function Login() {
  const { status, signIn } = useAuth();
  const location = useLocation();
  const from = location.state?.from; // set by pages that need a login, e.g. the account page
  const backTo = from ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : ROUTES.home;
  const [values, setValues] = useState({ login: '', password: '' });
  const [errors, setErrors] = useState({}); // one message per field
  const [formMessages, setFormMessages] = useState([]); // messages about the whole form
  const [busy, setBusy] = useState(false);

  if (status === 'signedIn') return <Navigate to={backTo} replace />;

  const change = (event) => setValues({ ...values, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    const problems = validateLogin(values);
    setErrors(problems);
    setFormMessages([]);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    try {
      await signIn({ login: values.login.trim(), password: values.password });
    } catch (error) {
      const { form, fields } = formErrorsFrom(error, { fields: FIELDS });
      setErrors(fields);
      setFormMessages(form);
      setValues({ ...values, password: '' }); // a failed password is cleared; the username stays
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <h1>Log in</h1>
      <p>
        New here? <Link to={ROUTES.register}>Create an account</Link>.
      </p>

      <form className="auth-form" onSubmit={submit} noValidate>
        {formMessages.length > 0 && (
          <div className="auth-form__error" role="alert">
            {formMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}

        <FormField
          id="login-name"
          name="login"
          label="Username or email"
          autoComplete="username"
          value={values.login}
          onChange={change}
          error={errors.login}
        />
        <FormField
          id="login-password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          value={values.password}
          onChange={change}
          error={errors.password}
        />

        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p>
        <Link to={ROUTES.forgotPassword}>Forgot your password?</Link>
      </p>
    </main>
  );
}
