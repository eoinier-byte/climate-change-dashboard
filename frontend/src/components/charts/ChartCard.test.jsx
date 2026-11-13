// Tests for the shared chart frame (CCD-160, CCD-167).
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ChartCard from './ChartCard';

describe('ChartCard', () => {
  it('shows the title, subtitle, chart, summary and source', () => {
    render(
      <ChartCard
        title="Temperature in Cork (annual), °C"
        subtitle="Each line starts at the 1976-2005 average"
        summary="By 2071-2100, compared with 1976-2005: RCP8.5 +2.71 °C."
        source="Climate Ireland TRANSLATE"
      >
        <div data-testid="the-chart" />
      </ChartCard>,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Temperature in Cork (annual), °C' })).toBeTruthy();
    expect(screen.getByText('Each line starts at the 1976-2005 average')).toBeTruthy();
    expect(screen.getByTestId('the-chart')).toBeTruthy();
    expect(screen.getByText(/RCP8.5 \+2.71 °C/)).toBeTruthy();
    expect(screen.getByText('Source: Climate Ireland TRANSLATE.')).toBeTruthy();
  });

  it('puts the summary and source in the figure caption, so screen readers link them to the chart', () => {
    render(
      <ChartCard title="A chart" summary="The summary." source="A source">
        <div />
      </ChartCard>,
    );

    const figure = screen.getByRole('figure');
    expect(figure.querySelector('figcaption').textContent).toBe('The summary. Source: A source.');
  });

  it('leaves the subtitle out when there is none', () => {
    const { container } = render(
      <ChartCard title="A chart" summary="The summary." source="A source">
        <div />
      </ChartCard>,
    );
    expect(container.querySelector('.chart-card__subtitle')).toBeNull();
  });
});