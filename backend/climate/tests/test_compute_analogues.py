"""Tests for the climate analogues (CCD-357, CCD-359): the method in climate/analogues.py and the
compute_analogues command.

All numbers are SYNTHETIC TEST DATA, made up so the right answers can be worked out by hand.

The hand-made dataset: four cities, from cold and north to hot and south.

    city   latitude  summer  winter  annual mm
    Cold   60        13      2       1100
    Mild   50        15      6       1000
    Warm   45        18      8        900
    Hot    38        24      11       600

    Standard deviation across the cities: summer 4.153, winter 3.269, precipitation 187.083

Cork's WorldClim climate is 14 / 5.5 / 1000. Its projections (TRANSLATE) are:

    baseline 1976-2005  14.5 / 5.7 / 1370
    rcp26 2071-2100     15.0 / 6.2 / 1370   change +0.5 / +0.5 / x1.0  -> future 14.5 / 6.0 / 1000
    rcp85 2071-2100     18.5 / 8.2 / 1233   change +4.0 / +2.5 / x0.9  -> future 18.0 / 8.0 / 900

Under RCP8.5 Cork's future is exactly Warm (similarity 1). Next is Mild:
    distance = sqrt((3 / 4.153)^2 + (2 / 3.269)^2 + (100 / 187.083)^2) = 1.087, similarity 1 / 2.087 = 0.479
Under RCP2.6 Cork's future is closest to Mild, further north than Warm.
"""

import json
import tempfile
from decimal import Decimal
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, TestCase

from climate.analogues import closest, project, scales
from climate.models import CityClimate, ClimateProjection, County, CountyAnalogue, DataSource
from common.enums import Scenario, Season, Unit, Variable

CITIES = {
    'Cold': {'summer_temp': 13.0, 'winter_temp': 2.0, 'annual_precip': 1100.0},
    'Mild': {'summer_temp': 15.0, 'winter_temp': 6.0, 'annual_precip': 1000.0},
    'Warm': {'summer_temp': 18.0, 'winter_temp': 8.0, 'annual_precip': 900.0},
    'Hot': {'summer_temp': 24.0, 'winter_temp': 11.0, 'annual_precip': 600.0},
}
LATITUDES = {'Cold': '60.000', 'Mild': '50.000', 'Warm': '45.000', 'Hot': '38.000'}
CORK_WORLDCLIM = {'summer_temp': 14.0, 'winter_temp': 5.5, 'annual_precip': 1000.0}
CORK_PROJECTIONS = {
    (Scenario.BASELINE, '1976-2005'): (14.5, 5.7, 1370.0),
    (Scenario.RCP26, '2071-2100'): (15.0, 6.2, 1370.0),
    (Scenario.RCP85, '2071-2100'): (18.5, 8.2, 1233.0),
}


def climate(summer, winter, precip):
    return {'summer_temp': summer, 'winter_temp': winter, 'annual_precip': precip}


class MethodTests(SimpleTestCase):
    def test_project_adds_the_temperature_change_and_scales_precipitation(self):
        baseline = climate(14.5, 5.7, 1370.0)
        future = climate(18.5, 8.2, 1233.0)
        result = project(CORK_WORLDCLIM, baseline, future)
        self.assertAlmostEqual(result['summer_temp'], 18.0)
        self.assertAlmostEqual(result['winter_temp'], 8.0)
        self.assertAlmostEqual(result['annual_precip'], 900.0)

    def test_scales_are_the_standard_deviations_across_the_cities(self):
        scale = scales(CITIES)
        self.assertAlmostEqual(scale['summer_temp'], 4.153, places=3)
        self.assertAlmostEqual(scale['winter_temp'], 3.269, places=3)
        self.assertAlmostEqual(scale['annual_precip'], 187.083, places=3)

    def test_scales_reject_a_variable_that_never_changes(self):
        same = {name: {**values, 'annual_precip': 1000.0} for name, values in CITIES.items()}
        with self.assertRaisesMessage(ValueError, 'annual_precip'):
            scales(same)

    def test_expected_ranking_under_rcp85(self):
        ranking = closest(climate(18.0, 8.0, 900.0), CITIES, scales(CITIES))
        self.assertEqual([city for city, _ in ranking], ['Warm', 'Mild', 'Hot'])
        self.assertAlmostEqual(ranking[0][1], 1.0)
        self.assertAlmostEqual(ranking[1][1], 0.479, places=3)

    def test_expected_ranking_under_rcp26(self):
        ranking = closest(climate(14.5, 6.0, 1000.0), CITIES, scales(CITIES))
        self.assertEqual(ranking[0][0], 'Mild')

    def test_equal_distances_are_ordered_by_name(self):
        cities = {'B': climate(10, 0, 100), 'A': climate(10, 0, 100), 'C': climate(20, 10, 200)}
        ranking = closest(climate(10, 0, 100), cities, scales(cities), top=2)
        self.assertEqual([city for city, _ in ranking], ['A', 'B'])


class ComputeAnaloguesTests(TestCase):
    fixtures = ['data_sources', 'worldclim_source']

    @classmethod
    def setUpTestData(cls):
        cls.cork = County.objects.create(name='Cork', has_coastline=True)
        translate = DataSource.objects.get(code='translate')
        for (scenario, period), (summer, winter, precip) in CORK_PROJECTIONS.items():
            for variable, season, value, unit in (
                (Variable.TEMPERATURE, Season.SUMMER, summer, Unit.DEG_C),
                (Variable.TEMPERATURE, Season.WINTER, winter, Unit.DEG_C),
                (Variable.PRECIPITATION, Season.ANNUAL, precip, Unit.MM),
            ):
                ClimateProjection.objects.create(
                    county=cls.cork,
                    data_source=translate,
                    variable=variable,
                    scenario=scenario,
                    period=period,
                    season=season,
                    value=Decimal(str(value)),
                    unit=unit,
                )

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        self.cities = self.write_cities(CITIES)
        self.counties = self.dir / 'worldclim_counties.csv'
        self.counties.write_text(
            'county,summer_temp_c,winter_temp_c,annual_precip_mm,cells\nCork,14.000,5.500,1000.000,39\n',
            encoding='utf-8',
        )

    def write_cities(self, cities):
        lines = ['city,country,latitude,longitude,summer_temp_c,winter_temp_c,annual_precip_mm,note']
        for name, v in cities.items():
            lines.append(
                f'{name},Testland,{LATITUDES[name]},0.000,{v["summer_temp"]},{v["winter_temp"]},{v["annual_precip"]},'
            )
        path = self.dir / 'worldclim_cities.csv'
        path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        return path

    def run_command(self):
        out = StringIO()
        call_command('compute_analogues', cities=self.cities, counties=self.counties, stdout=out)
        return out.getvalue()

    def ranking(self, scenario):
        rows = CountyAnalogue.objects.filter(county=self.cork, scenario=scenario).order_by('rank')
        return [(row.rank, row.city.name, row.similarity) for row in rows]

    def test_expected_ranking_is_saved(self):
        self.run_command()
        self.assertEqual(
            self.ranking(Scenario.RCP85),
            [(1, 'Warm', Decimal('1.000')), (2, 'Mild', Decimal('0.479')), (3, 'Hot', Decimal('0.299'))],
        )
        self.assertEqual(self.ranking(Scenario.RCP26)[0][1], 'Mild')

    def test_county_projected_values_are_saved(self):
        self.run_command()
        row = CountyAnalogue.objects.get(county=self.cork, scenario=Scenario.RCP85, rank=1)
        self.assertEqual(
            (row.county_summer_temp, row.county_winter_temp, row.county_annual_precip),
            (Decimal('18.000'), Decimal('8.000'), Decimal('900.000')),
        )

    def test_cities_are_saved_with_the_worldclim_source(self):
        self.run_command()
        mild = CityClimate.objects.get(name='Mild')
        self.assertEqual(mild.data_source.code, 'worldclim')
        self.assertEqual(mild.data_source.baseline_period, '1970-2000')
        self.assertEqual(mild.latitude, Decimal('50.000'))
        self.assertEqual(CityClimate.objects.count(), 4)

    def test_warmer_scenario_gives_a_more_southern_city(self):
        out = self.run_command()
        rcp26 = CountyAnalogue.objects.get(county=self.cork, scenario=Scenario.RCP26, rank=1)
        rcp85 = CountyAnalogue.objects.get(county=self.cork, scenario=Scenario.RCP85, rank=1)
        self.assertGreater(rcp26.city.latitude, rcp85.city.latitude)
        self.assertIn('2071-2100: rcp26 50.00, rcp85 45.00', out)
        self.assertIn('OK: warmer scenarios give more southern cities', out)

    def test_running_twice_gives_the_same_rows(self):
        self.run_command()
        first = sorted(CountyAnalogue.objects.values_list('scenario', 'period', 'rank', 'city__name', 'similarity'))
        self.run_command()
        second = sorted(CountyAnalogue.objects.values_list('scenario', 'period', 'rank', 'city__name', 'similarity'))
        self.assertEqual(first, second)
        self.assertEqual(CountyAnalogue.objects.count(), 6)  # 2 future scenarios x 3 ranks
        self.assertEqual(CityClimate.objects.count(), 4)

    def test_a_city_removed_from_the_file_is_removed(self):
        self.run_command()
        self.cities = self.write_cities({name: v for name, v in CITIES.items() if name != 'Hot'})
        self.run_command()
        self.assertFalse(CityClimate.objects.filter(name='Hot').exists())
        self.assertEqual(self.ranking(Scenario.RCP85)[2][1], 'Cold')

    def test_missing_file(self):
        self.cities = self.dir / 'nope.csv'
        with self.assertRaisesMessage(CommandError, 'worldclim_baseline.py'):
            self.run_command()

    def test_missing_worldclim_source(self):
        DataSource.objects.filter(code='worldclim').delete()
        with self.assertRaisesMessage(CommandError, 'loaddata worldclim_source'):
            self.run_command()

    def test_missing_projection_changes_nothing(self):
        self.run_command()
        ClimateProjection.objects.filter(scenario=Scenario.RCP85, season=Season.WINTER).delete()
        with self.assertRaisesMessage(CommandError, 'Cork rcp85 2071-2100: projection or baseline missing'):
            self.run_command()
        self.assertEqual(CountyAnalogue.objects.count(), 6)  # the earlier rows are still there

    def test_empty_worldclim_file(self):
        self.counties.write_text('county,summer_temp_c,winter_temp_c,annual_precip_mm,cells\n', encoding='utf-8')
        with self.assertRaisesMessage(CommandError, 'no rows'):
            self.run_command()

    def test_county_with_projections_missing_from_the_worldclim_file(self):
        County.objects.create(name='Kerry', has_coastline=True)
        self.counties.write_text(
            'county,summer_temp_c,winter_temp_c,annual_precip_mm,cells\nKerry,14.000,6.000,1600.000,22\n',
            encoding='utf-8',
        )
        with self.assertRaisesMessage(CommandError, 'Counties with projections but missing from'):
            self.run_command()

    def test_unknown_county_in_the_worldclim_file(self):
        self.counties.write_text(
            'county,summer_temp_c,winter_temp_c,annual_precip_mm,cells\n'
            'Cork,14.000,5.500,1000.000,39\nAtlantis,14.000,5.500,1000.000,3\n',
            encoding='utf-8',
        )
        with self.assertRaisesMessage(CommandError, 'not in the database: Atlantis'):
            self.run_command()


class WorldClimSourceFixtureTests(SimpleTestCase):
    def test_copied_verbatim_from_data_sources_md(self):
        doc = (settings.BASE_DIR.parent / 'DATA_SOURCES.md').read_text(encoding='utf-8')
        fixture = settings.BASE_DIR / 'climate' / 'fixtures' / 'worldclim_source.json'
        [entry] = json.loads(fixture.read_text(encoding='utf-8'))
        self.assertEqual(entry['fields']['baseline_period'], '1970-2000')
        for name in ('name', 'organisation', 'licence', 'attribution', 'url'):
            with self.subTest(field=name):
                self.assertIn(entry['fields'][name], doc)
