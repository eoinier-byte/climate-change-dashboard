// Tests for the shared chart settings (CCD-160, CCD-167), including the colour contrast check.
import { describe, expect, it } from 'vitest';
import { buildChartOptions, formatValue, tooltipLabel } from './chartOptions';
import { SCENARIO_COLORS } from '../../styles/scenarioColors';

describe('formatValue', () => {
  it('puts % right next to the number', () => {
    expect(formatValue(5.2, '%')).toBe('5.2%');
  });

  it('puts a space before other units', () => {
    expect(formatValue(10.527, '°C')).toBe('10.53 °C');
    expect(formatValue('42.702', 'cm')).toBe('42.7 cm');
  });

  it('rounds long numbers to 2 decimal places', () => {
    expect(formatValue(10.527000001, 'mm')).toBe('10.53 mm');
  });
});

describe('tooltipLabel', () => {
  it('shows the scenario name, the value and the unit', () => {
    const context = { dataset: { label: 'RCP4.5' }, parsed: { y: 11.282 } };
    expect(tooltipLabel(context, '°C')).toBe('RCP4.5: 11.28 °C');
  });
});

describe('buildChartOptions', () => {
  it('puts the unit on the side axis and in the tooltip', () => {
    const options = buildChartOptions({ yTitle: '% change from 1976-2005', unit: '%' });

    expect(options.scales.y.title.text).toBe('% change from 1976-2005');
    const label = options.plugins.tooltip.callbacks.label({ dataset: { label: 'RCP8.5' }, parsed: { y: 22.1 } });
    expect(label).toBe('RCP8.5: 22.1%');
  });

  it('resizes with its box and fills the box height (CCD-180)', () => {
    const options = buildChartOptions({ yTitle: 'cm', unit: 'cm' });
    expect(options.responsive).toBe(true);
    expect(options.maintainAspectRatio).toBe(false);
  });

  it('has the legend underneath and the Chart.js title off (ChartCard shows the title)', () => {
    const options = buildChartOptions({ yTitle: 'cm', unit: 'cm' });
    expect(options.plugins.legend.position).toBe('bottom');
    expect(options.plugins.title.display).toBe(false);
  });
});

// Colour contrast check (CCD-160 step 3), using the WCAG formula.
// Lines and bars are "graphics", which need at least 3:1 against the background (WCAG 1.4.11).
// Our scenario colours also pass 4.5:1, the level for normal text.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(hexA, hexB) {
  const [light, dark] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

describe('scenario colour contrast', () => {
  // The chart background (--color-bg) and the panel background (--color-surface)
  const backgrounds = { white: '#ffffff', surface: '#f3f5f4' };

  Object.entries(SCENARIO_COLORS).forEach(([scenario, colour]) => {
    Object.entries(backgrounds).forEach(([name, background]) => {
      it(`${scenario} (${colour}) has at least 4.5:1 contrast on ${name}`, () => {
        expect(contrast(colour, background)).toBeGreaterThanOrEqual(4.5);
      });
    });
  });
});