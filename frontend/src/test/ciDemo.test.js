// CCD-417 demo ONLY: a test that fails on purpose, to show CI blocks a pull request.
// Push it, screenshot the red check and the blocked merge button, then DELETE this file.
import { expect, it } from 'vitest';

it('fails on purpose to show CI blocks the PR (delete me)', () => {
  expect(1 + 1).toBe(3);
});
