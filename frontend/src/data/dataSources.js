// Every data source the dashboard uses, for the About page (CCD-390).
// Taken from DATA_SOURCES.md in the project root: keep the two in step when a source is added.
//
// Each source has:
//   name       - what people see as the heading
//   provider   - who made the data
//   usedFor    - what it is used for on this site
//   licence    - the licence or reuse terms, in plain words
//   licenceUrl - where the licence or terms are written
//   credit     - the attribution or citation the provider asks for
//   link       - where to find the data or the paper

// The Open Government Licence link is used by two sources
const OGL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';

export const DATA_SOURCES = [
  {
    name: 'Climate projections: TRANSLATE',
    provider: "Met Éireann's TRANSLATE project, through the EPA Climate Ireland portal",
    usedFor: 'Temperature and rainfall projections for every county',
    licence: 'Free to use (no named licence; published "as is")',
    licenceUrl: 'https://www.climateireland.ie/data-explorer/faqs/',
    credit:
      "O'Brien, E. and Nolan, P. (2023). TRANSLATE: standardized climate projections for Ireland. Frontiers in Climate, 5, 1166828.",
    link: 'https://doi.org/10.3389/fclim.2023.1166828',
  },
  {
    name: 'Sea level: UKCP18',
    provider: 'Met Office (UK)',
    usedFor: 'Sea-level rise to 2100 for the 15 coastal counties',
    licence: 'Open Government Licence v3.0',
    licenceUrl: OGL,
    credit: 'Contains Met Office UKCP18 data licensed under the Open Government Licence v3.0.',
    link: 'https://opennetzero.org/met-office/time-mean-sea-level-projections-to-2100-cm',
  },
  {
    name: 'County boundaries',
    provider: 'Tailte Éireann',
    usedFor: 'The county outlines on the maps, and which county each data point belongs to',
    licence: 'CC BY 4.0',
    licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
    credit: '© Tailte Éireann, Counties – National Statutory Boundaries – 2019 – Generalised 20m, licensed under CC BY 4.0.',
    link: 'https://data.gov.ie/dataset/counties-national-statutory-boundaries-2019-generalised-20m1',
  },
  {
    name: 'Land height: Copernicus DEM GLO-90',
    provider: 'European Space Agency (Copernicus)',
    usedFor: 'The height of the land, for the flood map',
    licence: 'ESA Copernicus Contributing Mission Data Access Licence (non-commercial use)',
    licenceUrl:
      'https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM',
    credit:
      'Produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.',
    link: 'https://doi.org/10.5270/ESA-c5d3d65',
  },
  {
    name: 'Northern Ireland outline',
    provider: 'Ordnance Survey of Northern Ireland (OSNI)',
    usedFor: 'Where the land ends and the sea starts on the flood map, near the border',
    licence: 'Open Government Licence v3.0',
    licenceUrl: OGL,
    credit: '© Ordnance Survey of Northern Ireland, OSNI Open Data – Largescale Boundaries – NI Outline.',
    link: 'https://www.opendatani.gov.uk/dataset/osni-open-data-largescale-boundaries-ni-outline',
  },
  {
    name: "Today's climate in Europe: WorldClim 2.1",
    provider: 'WorldClim (S.E. Fick and R.J. Hijmans)',
    usedFor: "Today's climate (1970–2000 averages) in European cities and in each county, for the climate analogue",
    licence: 'Free for academic and other non-commercial use',
    licenceUrl: 'https://www.worldclim.org/about.html',
    credit:
      'Fick, S.E. and R.J. Hijmans, 2017. WorldClim 2: new 1km spatial resolution climate surfaces for global land areas. International Journal of Climatology 37 (12): 4302-4315.',
    link: 'https://doi.org/10.1002/joc.5086',
  },
  {
    name: 'City locations: Natural Earth',
    provider: 'Natural Earth (NACIS)',
    usedFor: 'Where each city in the climate analogue is',
    licence: 'Public domain',
    licenceUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    credit: 'Made with Natural Earth.',
    link: 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/',
  },
];