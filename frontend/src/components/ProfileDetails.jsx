import { useRef, useState } from 'react';
import { checkAvatarFile, initialsOf } from '../auth/profileHelpers';
import { formErrorsFrom } from '../auth/formErrors';
import { validateProfile } from '../auth/validation';
import { changeAvatar, deleteAvatar, updateProfile } from '../services/api';
import FormField from './FormField';

// "Your details" on the account page (CCD-327, CCD-432): the photo, the username and the name.
// Props: user (the profile), onSaved (asks the page to load the profile again)
export default function ProfileDetails({ user, onSaved }) {
  const fileInput = useRef(null);
  const [values, setValues] = useState({ username: user.username ?? '', name: user.name ?? '' });
  const [errors, setErrors] = useState({});
  const [formMessages, setFormMessages] = useState([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoMessage, setPhotoMessage] = useState(''); // an error about the photo
  const [photoBusy, setPhotoBusy] = useState(false);

  const change = (event) => {
    setValues({ ...values, [event.target.name]: event.target.value });
    setSaved(false);
  };

  const save = async (event) => {
    event.preventDefault();
    const problems = validateProfile(values);
    setErrors(problems);
    setFormMessages([]);
    setSaved(false);
    if (Object.keys(problems).length > 0) return;

    setBusy(true);
    try {
      await updateProfile({ username: values.username.trim(), name: values.name.trim() });
      await onSaved();
      setSaved(true);
    } catch (error) {
      const { form, fields } = formErrorsFrom(error, { fields: ['username', 'name'] });
      setErrors(fields);
      setFormMessages(form);
    }
    setBusy(false);
  };

  const pickPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // so choosing the same file again still counts
    if (!file) return;
    const problem = checkAvatarFile(file);
    if (problem) {
      setPhotoMessage(problem);
      return;
    }
    setPhotoBusy(true);
    setPhotoMessage('');
    try {
      await changeAvatar(file);
      await onSaved();
    } catch (error) {
      setPhotoMessage(formErrorsFrom(error, { fields: ['avatar'] }).fields.avatar ?? formErrorsFrom(error).form.join(' '));
    }
    setPhotoBusy(false);
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    setPhotoMessage('');
    try {
      await deleteAvatar();
      await onSaved();
    } catch (error) {
      setPhotoMessage(formErrorsFrom(error).form.join(' '));
    }
    setPhotoBusy(false);
  };

  return (
    <section className="account-section" aria-labelledby="account-details-title">
      <h2 id="account-details-title">Your details</h2>

      <div className="account-photo">
        {user.avatar ? (
          <img className="account-avatar" src={user.avatar} alt="Your photo" />
        ) : (
          <span className="account-avatar" aria-hidden="true">
            {initialsOf(user)}
          </span>
        )}
        <div className="account-photo__buttons">
          <button type="button" className="btn btn--secondary" disabled={photoBusy} onClick={() => fileInput.current.click()}>
            {user.avatar ? 'Change photo' : 'Add photo'}
          </button>
          {user.avatar && (
            <button type="button" className="link-button" disabled={photoBusy} onClick={removePhoto}>
              Remove photo
            </button>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          hidden
          aria-label="Choose a photo"
          accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
          onChange={pickPhoto}
        />
      </div>
      <p className="auth-field__hint">JPEG, PNG or HEIC, at least 100 × 100 pixels, up to 50 MB. Replacing your photo removes the old one.</p>
      {photoMessage && (
        <p className="auth-field__error" role="alert">
          {photoMessage}
        </p>
      )}

      <form onSubmit={save} noValidate>
        {formMessages.length > 0 && (
          <div className="auth-form__error" role="alert">
            {formMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}
        <FormField id="account-username" name="username" label="Username" autoComplete="username" value={values.username} onChange={change} error={errors.username} />
        <FormField id="account-name" name="name" label="Name" autoComplete="name" value={values.name} onChange={change} error={errors.name} />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <p role="status">Your details are saved.</p>}
      </form>
    </section>
  );
}
