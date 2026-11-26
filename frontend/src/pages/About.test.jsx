// Tests for the About page (CCD-372, CCD-389, CCD-390, CCD-410).
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import About from './About';
import { DATA_SOURCES } from '../data/dataSources';
import { MAP_SCENARIOS } from '../hooks/useMapView';

// The section under a heading, e.g. section('How the flood map works')
function section(name) {
  return screen.getByRole('heading', { level: 2, name }).closest('section');
}

describe('About page', () => {
  it('has the title About and says projections are not forecasts', () => {
    render(<About />);
    expect(screen.getByRole('heading', { level: 1, name: 'About' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Projections, not forecasts' })).toBeTruthy();
  });

  it('every link in "On this page" goes to a section that exists', () => {
    render(<About />);
    const contents = screen.getByRole('navigation', { name: 'On this page' });
    const links = within(contents).getAllByRole('link');
    expect(links).toHaveLength(6);
    links.forEach((link) => {
      const id = link.getAttribute('href').replace('#', '');
      expect(document.getElementById(id)).not.toBeNull();
    });
  });

  it('explains the three scenarios with the same names as the map switch', () => {
    render(<About />);
    const scenarios = section('The three scenarios');
    // One name line (<dt>) per scenario, in the same order as the map switch, e.g. "Middle path (RCP4.5)"
    const names = Array.from(scenarios.querySelectorAll('dt')).map((dt) => dt.textContent);
    expect(names).toEqual(MAP_SCENARIOS.map(({ plain, rcp }) => `${plain} (${rcp})`));
    // Every scenario has an explanation, none left empty
    const explanations = scenarios.querySelectorAll('dd');
    expect(explanations).toHaveLength(3);
    explanations.forEach((dd) => expect(dd.textContent.length).toBeGreaterThan(20));
  });

  it('explains how the climate analogue is worked out, and that it is not a probability', () => {
    render(<About />);
    const text = section('How the climate analogue works').textContent;
    expect(text).toContain('summer temperature');
    expect(text).toContain('winter temperature');
    expect(text).toContain('yearly rainfall');
    expect(text).toContain('changes from a baseline');
    expect(text).toContain('not a probability');
  });

  it('states the flood map limits: tides, storm surges and flood defences', () => {
    render(<About />);
    const text = section('How the flood map works').textContent;
    expect(text).toContain('tides');
    expect(text).toContain('storm surges');
    expect(text).toContain('flood defences');
  });

  it('lists every data source with its licence and a working link', () => {
    render(<About />);
    const sources = section('Data sources and licences');
    DATA_SOURCES.forEach((source) => {
      // Find this source's own card by its heading, then check the links inside that card only
      // (two sources share the Open Government Licence, so the link name alone is not unique)
      const card = within(sources).getByRole('heading', { level: 3, name: source.name }).closest('li');
      expect(within(card).getByRole('link', { name: source.licence }).getAttribute('href')).toBe(source.licenceUrl);
      expect(within(card).getByRole('link', { name: 'Go to the data or paper' }).getAttribute('href')).toBe(source.link);
    });
  });
});

describe('DATA_SOURCES', () => {
  it('has every detail filled in for each source', () => {
    const fields = ['name', 'provider', 'usedFor', 'licence', 'licenceUrl', 'credit', 'link'];
    DATA_SOURCES.forEach((source) => {
      fields.forEach((field) => expect(source[field], `${source.name}: ${field}`).toBeTruthy());
    });
  });

  it('only uses secure https links', () => {
    DATA_SOURCES.forEach((source) => {
      expect(source.licenceUrl).toMatch(/^https:\/\//);
      expect(source.link).toMatch(/^https:\/\//);
    });
  });

  it('includes WorldClim and Natural Earth, added for the climate analogue', () => {
    const names = DATA_SOURCES.map((source) => source.name).join(' ');
    expect(names).toContain('WorldClim');
    expect(names).toContain('Natural Earth');
  });
});