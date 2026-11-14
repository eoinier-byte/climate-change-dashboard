// Tests for the "Show scenarios" tick boxes (CCD-158, CCD-165).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ScenarioFilter from './ScenarioFilter';

// Finds the tick box for a scenario by the start of its label, e.g. "RCP4.5"
function box(label) {
  return screen.getByRole('checkbox', { name: new RegExp(`^${label}`) });
}

describe('ScenarioFilter', () => {
  it('shows one tick box per scenario, ticked when selected', () => {
    render(<ScenarioFilter selected={['rcp26', 'rcp85']} onChange={() => {}} />);

    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(box('RCP2.6').checked).toBe(true);
    expect(box('RCP4.5').checked).toBe(false);
    expect(box('RCP8.5').checked).toBe(true);
  });

  it('removes a scenario when its box is unticked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ScenarioFilter selected={['rcp26', 'rcp45', 'rcp85']} onChange={onChange} />);

    await user.click(box('RCP4.5'));

    expect(onChange).toHaveBeenCalledWith(['rcp26', 'rcp85']);
  });

  it('adds a scenario back in the usual order', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ScenarioFilter selected={['rcp85']} onChange={onChange} />);

    await user.click(box('RCP2.6'));

    expect(onChange).toHaveBeenCalledWith(['rcp26', 'rcp85']);
  });

  it('does not let the last ticked scenario be unticked', () => {
    render(<ScenarioFilter selected={['rcp45']} onChange={() => {}} />);

    expect(box('RCP4.5').disabled).toBe(true);
    expect(box('RCP2.6').disabled).toBe(false);
  });

  it('describes each scenario in its label', () => {
    render(<ScenarioFilter selected={['rcp26', 'rcp45', 'rcp85']} onChange={() => {}} />);

    expect(screen.getByRole('checkbox', { name: 'RCP2.6 (strong climate action)' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'RCP8.5 (high emissions)' })).toBeTruthy();
  });
});