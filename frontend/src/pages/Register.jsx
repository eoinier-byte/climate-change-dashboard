import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { formErrorsFrom } from '../auth/formErrors';
import { MIN_PASSWORD_LENGTH, validateRegister } from '../auth/validation';
import FormField from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { ROUTES } from '../routes';
import '../styles/auth.css';

const FIELDS = ['username', 'email', 'password', 'password2'];

// The registration page (CCD-324). The server signs the new user in and emails a confirmation link
// (that link opens /verify-email/..., a later story). A visitor who is already signed in is sent home.
export default function Register() {
  const { status, register, refresh } = useAuth();
  const [values, setValues] = useState({ username: '', email: '', password: '', password2: '' });
  const [errors, setErrors] = useState({});
  const [formMessages, setFormMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [createdFor, setCreatedFor] = useState(null); // the email address, once the account exists

  if (status === 'signedIn' && !createdFor) return <Navigate to={ROUTES.home} replace />;

  if (createdFor) {
    return (
      <main className="auth-page">
        <h1>Check your email</h1>
        <p>
          Your account has been created and you are signed in. We sent a confirmation link to <strong>{createdFor}</strong>.
          Open it to confirm your email address.
        </p>
        <p>
          <Link to={ROUTES.home}>Back to the map</Link>
        </p>
      </main>
    );
  }

  const change = (event) => setValues({ ...values, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    const problems = validateRegister(values);
    setErrors(problems);
    setFormMessages([]);
    if (Object.keys(problems).length > 0) return;

    const details = {
      username: values.username.trim(),
      email: values.email.trim(),
      password: values.password,
      password2: values.password2,
    };

    setBusy(true);
    try {
      await register(details);
    } catch (error) {
      const { form, fields } = formErrorsFrom(error, { fields: FIELDS });
      setErrors(fields);
      setFormMessages(form);
      setBusy(false);
      return;
    }

    // The account exists and the server has signed the browser in. Show the message first,
    // then let the rest of the site learn that the user is signed in.
    setCreatedFor(details.email);
    try {
      await refresh();
    } catch {
      // Signed in on the server, but the profile could not be read now: the navigation bar catches up on the next page load
    }
  };

  return (
    <main className="auth-page">
      <h1>Register</h1>
      <p>
        Already have an account? <Link to={ROUTES.login}>Log in</Link>.
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
          id="register-username"
          name="username"
          label="Username"
          hint="Letters, numbers and . @ + - _ only."
          autoComplete="username"
          value={values.username}
          onChange={change}
          error={errors.username}
        />
        <FormField
          id="register-email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          value={values.email}
          onChange={change}
          error={errors.email}
        />
        <FormField
          id="register-password"
          name="password"
          type="password"
          label="Password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters, not a common password.`}
          autoComplete="new-password"
          value={values.password}
          onChange={change}
          error={errors.password}
        />
        <FormField
          id="register-password2"
          name="password2"
          type="password"
          label="Repeat the password"
          autoComplete="new-password"
          value={values.password2}
          onChange={change}
          error={errors.password2}
        />

        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </main>
  );
}
