// Turns the error from a failed form request into messages a page can show (CCD-328).
//
// The API answers a rejected form with a 400 and the messages in the body (docs/api.md, "Accounts"):
//   { "detail": ["Invalid login or password."] }                  a message about the whole form
//   { "email": ["A user with this email already exists."] }       a message about one field
//   { "non_field_errors": ["This password is too common."] }      also about the whole form
// A value can be one text or a list of texts.
//
// formErrorsFrom(error, { fields }) returns
//   { form: [texts for the whole form], fields: { email: 'text', ... } }
// "fields" names the inputs the page has. A message under any other name goes to "form",
// so nothing the server says is lost. When the error has no readable body (the server was down,
// or answered with a page instead of JSON) "form" holds one plain-language message.

const asTexts = (value) => (Array.isArray(value) ? value : [value]).filter((text) => typeof text === 'string' && text !== '');

function fallbackMessage(error) {
  // An ApiError with status null means the request never reached the server (same rule as ErrorMessage.jsx)
  if (error?.name === 'ApiError' && error.status === null) {
    return 'We could not reach the server. Check your internet connection and try again.';
  }
  if (error?.status === 403) return 'Your session could not be checked. Reload the page and try again.';
  if (error?.status >= 500) return 'The server had a problem. Please try again in a moment.';
  return 'Something went wrong. Please try again.';
}

export function formErrorsFrom(error, { fields = [] } = {}) {
  const result = { form: [], fields: {} };
  const body = error?.body;

  if (body && typeof body === 'object' && !Array.isArray(body)) {
    Object.entries(body).forEach(([name, value]) => {
      const texts = asTexts(value);
      if (texts.length === 0) return;
      if (fields.includes(name)) result.fields[name] = texts.join(' ');
      else result.form.push(...texts);
    });
  }

  if (result.form.length === 0 && Object.keys(result.fields).length === 0) {
    result.form.push(fallbackMessage(error));
  }
  return result;
}
