import { describe, expect, it } from 'vitest';
import { validateEmail, validateLogin, validateNewPassword, validatePasswordChange, validateProfile, validateRegister } from './validation';

const goodRegistration = { username: 'ronel', email: 'ronel@example.com', password: 'a-long-password', password2: 'a-long-password' };

describe('validateLogin (CCD-328)', () => {
  it('accepts a username or an email with a password', () => {
    expect(validateLogin({ login: 'ronel', password: 'x' })).toEqual({});
    expect(validateLogin({ login: 'ronel@example.com', password: 'x' })).toEqual({});
  });

  it('asks for both when they are empty, and treats spaces alone as empty', () => {
    expect(validateLogin({ login: '   ', password: '' })).toEqual({
      login: 'Enter your username or email.',
      password: 'Enter your password.',
    });
  });
});

describe('validateRegister (CCD-328)', () => {
  it('accepts a good registration', () => {
    expect(validateRegister(goodRegistration)).toEqual({});
  });

  it('asks for every field when the form is empty', () => {
    expect(Object.keys(validateRegister({ username: '', email: '', password: '', password2: '' }))).toEqual([
      'username',
      'email',
      'password',
      'password2',
    ]);
  });

  it.each([
    ['has a space', 'ro nel'],
    ['has a slash', 'ro/nel'],
  ])('refuses a username that %s', (_name, username) => {
    expect(validateRegister({ ...goodRegistration, username }).username).toMatch(/letters, numbers/i);
  });

  it('accepts the characters Django allows, including accented letters', () => {
    ['ronel.m', 'ronel_m-1', 'ronel@home', 'a+b', 'Ciarán'].forEach((username) => {
      expect(validateRegister({ ...goodRegistration, username }).username).toBeUndefined();
    });
  });

  it('refuses a username over 150 characters', () => {
    expect(validateRegister({ ...goodRegistration, username: 'a'.repeat(151) }).username).toMatch(/150/);
    expect(validateRegister({ ...goodRegistration, username: 'a'.repeat(150) }).username).toBeUndefined();
  });

  it.each(['ronel', 'ronel@', '@example.com', 'ronel@example', 'ro nel@example.com'])('refuses the email "%s"', (email) => {
    expect(validateRegister({ ...goodRegistration, email }).email).toMatch(/valid email/i);
  });

  it('refuses a password under 8 characters, and accepts exactly 8', () => {
    expect(validateRegister({ ...goodRegistration, password: '1234567', password2: '1234567' }).password).toMatch(/at least 8/i);
    expect(validateRegister({ ...goodRegistration, password: 'abcd1234', password2: 'abcd1234' }).password).toBeUndefined();
  });

  it('says when the two passwords differ, but not when the second is still empty', () => {
    expect(validateRegister({ ...goodRegistration, password2: 'something-else' }).password2).toMatch(/do not match/i);
    expect(validateRegister({ ...goodRegistration, password2: '' }).password2).toMatch(/type the password again/i);
  });
});

describe('validateProfile (CCD-432)', () => {
  it('accepts a username, with or without a name', () => {
    expect(validateProfile({ username: 'ronel', name: '' })).toEqual({});
    expect(validateProfile({ username: 'ronel', name: 'Ronel Mombo' })).toEqual({});
  });

  it('refuses an empty username, spaces in it, and one over 150 characters', () => {
    expect(validateProfile({ username: '  ' }).username).toMatch(/choose a username/i);
    expect(validateProfile({ username: 'ro nel' }).username).toMatch(/no spaces/i);
    expect(validateProfile({ username: 'a'.repeat(151) }).username).toMatch(/150/);
  });
});

describe('validateEmail (CCD-433, CCD-434)', () => {
  it('accepts an address and refuses an empty or malformed one', () => {
    expect(validateEmail({ email: ' a@example.com ' })).toEqual({});
    expect(validateEmail({ email: '' }).email).toMatch(/enter your email/i);
    expect(validateEmail({ email: 'nope' }).email).toMatch(/valid email/i);
  });
});

describe('validateNewPassword and validatePasswordChange (CCD-433, CCD-435)', () => {
  const good = { new_password: 'a-long-password', new_password2: 'a-long-password' };

  it('accepts two matching passwords of 8 or more characters', () => {
    expect(validateNewPassword(good)).toEqual({});
    expect(validatePasswordChange({ ...good, old_password: 'old' })).toEqual({});
  });

  it('refuses a short password, an empty repeat and a mismatch', () => {
    expect(validateNewPassword({ new_password: '1234567', new_password2: '1234567' }).new_password).toMatch(/at least 8/i);
    expect(validateNewPassword({ ...good, new_password2: '' }).new_password2).toMatch(/again/i);
    expect(validateNewPassword({ ...good, new_password2: 'different-one' }).new_password2).toMatch(/do not match/i);
  });

  it('asks for the current password when changing it', () => {
    expect(validatePasswordChange({ ...good, old_password: '' }).old_password).toMatch(/current password/i);
  });
});
