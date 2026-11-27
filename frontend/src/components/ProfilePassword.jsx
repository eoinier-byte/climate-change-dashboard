import { useState } from 'react';
import { formErrorsFrom } from '../auth/formErrors';
import { validatePasswordChange } from '../auth/validation';
import { changePassword } from '../services/api';
import FormField from './FormField';

const FIELDS = ['old_password', 'new_password', 'new_password2'];
const EMPTY = { old_password: '', new_password: '', new_password2: '' };

// "Password" on the account page (CCD-433). The user stays signed in here; other devices are signed out.
export default function ProfilePassword() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formMessages, setFormMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const change = (event) => setValues({ ...values, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    const problems = validatePasswordChange(values);
    setErrors(problems);
    setFormMessages([]);
    setSaved(false);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    try {
      await changePassword(values);
      setValues(EMPTY);
      setSaved(true);
    } catch (error) {
      const { form, fields } = formErrorsFrom(error, { fields: FIELDS });
      setErrors(fields);
      setFormMessages(form);
      setValues({ ...values, old_password: '' });
    }
    setBusy(false);
  };

  return (
    <section className="account-section" aria-labelledby="account-password-title">
      <h2 id="account-password-title">Password</h2>
      <form onSubmit={submit} noValidate>
        {formMessages.length > 0 && (
          <div className="auth-form__error" role="alert">
            {formMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
        <FormField
          id="account-old-password"
          name="old_password"
          type="password"
          label="Current password"
          autoComplete="current-password"
          value={values.old_password}
          onChange={change}
          error={errors.old_password}
        />
        <FormField
          id="account-new-password"
          name="new_password"
          type="password"
          label="New password"
          hint="At least 8 characters, not a common password."
          autoComplete="new-password"
          value={values.new_password}
          onChange={change}
          error={errors.new_password}
        />
        <FormField
          id="account-new-password2"
          name="new_password2"
          type="password"
          label="Repeat the new password"
          autoComplete="new-password"
          value={values.new_password2}
          onChange={change}
          error={errors.new_password2}
        />
        <p className="auth-field__hint">You stay signed in here. Other devices are signed out.</p>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
        {saved && <p role="status">Your password is changed.</p>}
      </form>
    </section>
  );
}
