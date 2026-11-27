import '../styles/auth.css';

// One labelled input for the account forms (CCD-328).
//
// Props: id (required, ties the label to the input), label, error (text or nothing), hint (help text shown under
// the label); every other prop (name, type, value, onChange, autoComplete, ...) goes to the <input>.
// A field with an error is marked aria-invalid and linked to its message, so a screen reader reads both.
export default function FormField({ id, label, error, hint, ...inputProps }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {hint && (
        <p id={`${id}-hint`} className="auth-field__hint">
          {hint}
        </p>
      )}
      <input
        id={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {error && (
        <p id={`${id}-error`} className="auth-field__error">
          {error}
        </p>
      )}
    </div>
  );
}
