// Checks a form in the browser before it is sent (CCD-328), so a typing mistake gets an answer at once.
// The server checks everything again and has the last word (for example "email already used",
// "password too common"): its messages are shown by formErrors.js.
//
// Each function returns an object with one message per field that is wrong, e.g.
//   { email: 'Enter a valid email address, like name@example.com.' }
// An empty object means the form can be sent.

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_USERNAME_LENGTH = 150; // Django's limit

// Django allows letters, numbers and . @ + - _ in a username (no spaces)
const USERNAME_PATTERN = /^[\p{L}\p{N}_.@+-]+$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLogin({ login, password }) {
  const errors = {};
  if (!login.trim()) errors.login = 'Enter your username or email.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

export function validateRegister({ username, email, password, password2 }) {
  const errors = {};

  const name = username.trim();
  if (!name) errors.username = 'Choose a username.';
  else if (name.length > MAX_USERNAME_LENGTH) errors.username = `Use ${MAX_USERNAME_LENGTH} characters or fewer.`;
  else if (!USERNAME_PATTERN.test(name)) errors.username = 'Use only letters, numbers and . @ + - _ (no spaces).';

  const address = email.trim();
  if (!address) errors.email = 'Enter your email address.';
  else if (!EMAIL_PATTERN.test(address)) errors.email = 'Enter a valid email address, like name@example.com.';

  if (!password) errors.password = 'Choose a password.';
  else if (password.length < MIN_PASSWORD_LENGTH) errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;

  if (!password2) errors.password2 = 'Type the password again.';
  else if (password2 !== password) errors.password2 = 'The two passwords do not match.';

  return errors;
}
