import { describe, expect, it } from 'vitest';
import { formErrorsFrom } from './formErrors';

// An error like the one services/api.js throws: name, status and what the server said
const apiError = (status, body = null) => Object.assign(new Error(`API error ${status}`), { name: 'ApiError', status, body });

describe('formErrorsFrom (CCD-328)', () => {
  it('puts a message under a field the page has next to that field', () => {
    const error = apiError(400, { email: ['A user with this email already exists.'] });
    expect(formErrorsFrom(error, { fields: ['username', 'email'] })).toEqual({
      form: [],
      fields: { email: 'A user with this email already exists.' },
    });
  });

  it('puts "detail" messages on the whole form, whether they are a list or one text', () => {
    expect(formErrorsFrom(apiError(400, { detail: ['Invalid login or password.'] }), { fields: ['login'] }).form).toEqual([
      'Invalid login or password.',
    ]);
    expect(formErrorsFrom(apiError(400, { detail: 'Invalid login or password.' }), { fields: ['login'] }).form).toEqual([
      'Invalid login or password.',
    ]);
  });

  it('puts the password rules (non_field_errors) on the whole form', () => {
    const error = apiError(400, { non_field_errors: ['This password is too common.', 'This password is entirely numeric.'] });
    expect(formErrorsFrom(error, { fields: ['password'] }).form).toEqual([
      'This password is too common.',
      'This password is entirely numeric.',
    ]);
  });

  it('joins several messages for one field', () => {
    const error = apiError(400, { password: ['Too short.', 'Too common.'] });
    expect(formErrorsFrom(error, { fields: ['password'] }).fields.password).toBe('Too short. Too common.');
  });

  it('keeps a message under a name the page does not have, so nothing the server says is lost', () => {
    const error = apiError(400, { surname: ['Required.'] });
    expect(formErrorsFrom(error, { fields: ['username'] }).form).toEqual(['Required.']);
  });

  it('shows one plain message when the server could not be reached', () => {
    expect(formErrorsFrom(apiError(null), { fields: [] }).form).toEqual([
      'We could not reach the server. Check your internet connection and try again.',
    ]);
  });

  it('asks the user to reload for a 403 without a message (the CSRF check failed)', () => {
    expect(formErrorsFrom(apiError(403), { fields: [] }).form[0]).toMatch(/reload the page/i);
  });

  it('says the server had a problem for a 500, and never shows its own text', () => {
    const [message] = formErrorsFrom(apiError(500, null), { fields: [] }).form;
    expect(message).toMatch(/server had a problem/i);
    expect(message).not.toMatch(/API error/);
  });

  it('falls back to a general message for an unknown error', () => {
    expect(formErrorsFrom(new Error('boom'), { fields: [] }).form).toEqual([expect.stringMatching(/something went wrong/i)]);
    expect(formErrorsFrom(undefined).form).toHaveLength(1);
  });

  it('ignores empty messages and bodies that are not objects', () => {
    expect(formErrorsFrom(apiError(400, { email: [], detail: '' }), { fields: ['email'] }).form).toHaveLength(1);
    expect(formErrorsFrom(apiError(400, ['x']), { fields: [] }).form).toHaveLength(1);
  });
});
