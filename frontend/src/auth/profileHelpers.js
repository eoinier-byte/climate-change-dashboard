// Small pure helpers for the account page (CCD-327).

// The letters shown in the circle when there is no photo: the first letters of the name's first two words,
// or the first two characters of the username. "Ronel Mombo" -> "RM", "ronel" -> "RO".
export function initialsOf({ name, username } = {}) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const single = words[0] ?? (username ?? '').trim();
  return Array.from(single).slice(0, 2).join('').toUpperCase() || '?';
}

// What the API allows for a photo (docs/api.md, "Avatars"). The server checks the size in pixels.
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
export const AVATAR_MAX_BYTES = 50 * 1024 * 1024;

export function checkAvatarFile(file) {
  // Some systems send no type for HEIC files, so the file name is checked as well
  const okName = /\.(jpe?g|png|heic|heif)$/i.test(file.name ?? '');
  if (!AVATAR_TYPES.includes(file.type) && !okName) return 'Choose a JPEG, PNG or HEIC photo.';
  if (file.size > AVATAR_MAX_BYTES) return 'The photo is too large. Choose one up to 50 MB.';
  return null;
}
