import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SCENARIO_COLORS } from './scenarioColors';
import { FONT_FAMILY, TEXT_COLOR } from '../components/charts/chartOptions';

// Read theme.css straight from disk (Vitest would turn an imported CSS file into an empty string)
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'theme.css'), 'utf8');

// Read a colour variable such as --color-text out of theme.css
function token(name) {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`${name} not found in theme.css`);
  return match[1].toLowerCase();
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme colours meet WCAG AA (4.5:1 for text)', () => {
  const pairs = [
    ['--color-text', '--color-bg'],
    ['--color-text', '--color-surface'],
    ['--color-text-muted', '--color-bg'],
    ['--color-text-muted', '--color-surface'],
    ['--color-primary', '--color-bg'],
    ['--color-primary', '--color-surface'],
    ['--color-on-primary', '--color-primary'],
    ['--color-on-primary', '--color-primary-dark'],
    ['--color-rcp26', '--color-bg'],
    ['--color-rcp45', '--color-bg'],
    ['--color-rcp85', '--color-bg'],
  ];

  it.each(pairs)('%s on %s', (foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('scenario colours', () => {
  it.each(Object.entries(SCENARIO_COLORS))('%s in JavaScript matches theme.css', (key, hex) => {
    expect(token(`--color-${key}`)).toBe(hex.toLowerCase());
  });
});

// Chart.js can't read CSS variables, so chartOptions.js keeps its own copies (CCD-160).
// These tests fail if theme.css changes and the chart copies don't (or the other way round).
describe('chart settings match theme.css', () => {
  it('chart text colour is --color-text-muted', () => {
    expect(TEXT_COLOR.toLowerCase()).toBe(token('--color-text-muted'));
  });

  it('chart font is --font-body', () => {
    const match = css.match(/--font-body:\s*([^;]+);/);
    expect(match).not.toBeNull();
    expect(FONT_FAMILY).toBe(match[1].trim());
  });
});