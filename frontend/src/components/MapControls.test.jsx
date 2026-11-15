// Tests for the controls above the home page map (CCD-383). They only show the choices they are given
// and report changes; MapExplorer.test.jsx checks that the map follows.
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MapControls from './MapControls';

const onScenarioChange = vi.fn();
const onPeriodChange = vi.fn();
const onTogglePlay = vi.fn();

function renderControls(props = {}) {
  return render(
    <MapControls
      scenario="rcp85"
      period="2071-2100"
      playing={false}
      onScenarioChange={onScenarioChange}
      onPeriodChange={onPeriodChange}
      onTogglePlay={onTogglePlay}
      {...props}
    />,
  );
}

describe('MapControls', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('scenario switch', () => {
    it('has one radio button per scenario, in plain words with the RCP name', () => {
      renderControls();
      const group = screen.getByRole('group', { name: 'Scenario' });
      expect(group).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'If the world cuts emissions (RCP2.6)' })).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'Middle path (RCP4.5)' })).toBeTruthy();
      expect(screen.getByRole('radio', { name: 'If nothing is done (RCP8.5)' })).toBeTruthy();
    });

    it('has the chosen scenario selected', () => {
      renderControls({ scenario: 'rcp45' });
      expect(screen.getByRole('radio', { name: /Middle path/ }).checked).toBe(true);
      expect(screen.getByRole('radio', { name: /If nothing is done/ }).checked).toBe(false);
    });

    it('reports the scenario that is chosen', () => {
      renderControls();
      fireEvent.click(screen.getByRole('radio', { name: /If the world cuts emissions/ }));
      expect(onScenarioChange).toHaveBeenCalledWith('rcp26');
    });
  });

  describe('period slider', () => {
    it('is a slider with a name, over the available periods', () => {
      renderControls();
      const slider = screen.getByRole('slider', { name: /Period/ });
      expect(slider.min).toBe('0');
      expect(slider.max).toBe('1');
      expect(slider.step).toBe('1');
    });

    it('sits on the chosen period and says it in words for a screen reader', () => {
      renderControls({ period: '2021-2050' });
      const slider = screen.getByRole('slider');
      expect(slider.value).toBe('0');
      expect(slider.getAttribute('aria-valuetext')).toBe('Mid-century (2021–2050)');
      expect(screen.getByText('Period: Mid-century (2021–2050)')).toBeTruthy();
    });

    it('moves to the end of century', () => {
      renderControls({ period: '2021-2050' });
      expect(screen.getByRole('slider').value).toBe('0');
      fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } });
      expect(onPeriodChange).toHaveBeenCalledWith('2071-2100');
    });

    it('reports the earlier period when it is moved back', () => {
      renderControls();
      fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } });
      expect(onPeriodChange).toHaveBeenCalledWith('2021-2050');
    });
  });

  describe('play button', () => {
    it('says Play, and reports a press', () => {
      renderControls();
      fireEvent.click(screen.getByRole('button', { name: /Play/ }));
      expect(onTogglePlay).toHaveBeenCalledTimes(1);
    });

    it('says Pause while it is playing', () => {
      renderControls({ playing: true });
      expect(screen.getByRole('button', { name: /Pause/ })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Play/ })).toBeNull();
    });
  });
});
