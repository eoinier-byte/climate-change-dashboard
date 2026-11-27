import { describe, expect, it } from 'vitest';
import { AVATAR_MAX_BYTES, checkAvatarFile, initialsOf } from './profileHelpers';

describe('initialsOf (CCD-327)', () => {
  it('uses the first letters of the first two words of the name', () => {
    expect(initialsOf({ name: 'Ronel Mombo', username: 'ronel' })).toBe('RM');
    expect(initialsOf({ name: '  ada  king  lovelace ', username: 'x' })).toBe('AK');
  });

  it('uses the first two letters of a one-word name, or of the username when there is no name', () => {
    expect(initialsOf({ name: 'Ronel', username: 'x' })).toBe('RO');
    expect(initialsOf({ name: '', username: 'ronel' })).toBe('RO');
    expect(initialsOf({ username: 'q' })).toBe('Q');
  });

  it('never returns nothing', () => {
    expect(initialsOf({})).toBe('?');
    expect(initialsOf()).toBe('?');
  });
});

describe('checkAvatarFile (CCD-327)', () => {
  const file = (name, type, size = 1000) => ({ name, type, size });

  it.each([
    ['me.jpg', 'image/jpeg'],
    ['me.png', 'image/png'],
    ['IMG_1.HEIC', ''], // some systems send no type for HEIC
  ])('accepts %s', (name, type) => {
    expect(checkAvatarFile(file(name, type))).toBeNull();
  });

  it('refuses other kinds of file', () => {
    expect(checkAvatarFile(file('doc.pdf', 'application/pdf'))).toMatch(/JPEG, PNG or HEIC/);
  });

  it('refuses a file over 50 MB, and accepts one of exactly 50 MB', () => {
    expect(checkAvatarFile(file('a.png', 'image/png', AVATAR_MAX_BYTES + 1))).toMatch(/too large/);
    expect(checkAvatarFile(file('a.png', 'image/png', AVATAR_MAX_BYTES))).toBeNull();
  });
});
