"""Tests for the load_data management command (CCD-270).

All CSV numbers below are SYNTHETIC TEST DATA, made up for these tests. They are not EPA, TRANSLATE or UKCP18 figures.
"""

import json
import tempfile
from decimal import Decimal
from io import StringIO
from pathlib import Path
from unittest import mock

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import DatabaseError
from django.test import TestCase

from climate.management.commands.load_data import COUNTIES
from climate.models import ClimateProjection, County, DataSource, SeaLevelProjection

CLIMATE_HEADER = 'county,variable,scenario,period,season,value,unit'
# Synthetic test data: 2 counties, 4 climate rows.
CLIMATE_ROWS = [
    'Cork,temperature,baseline,1976-2005,Annual,10.000,degC',
    'Cork,precipitation,baseline,1976-2005,Annual,1000.000,mm',
    'Kerry,temperature,rcp45,2021-2050,Winter,7.000,degC',
    'Kerry,precipitation,rcp85,2071-2100,Summer,200.000,mm',
]
SEA_HEADER = 'county,scenario,year,rise_cm,source'
# Synthetic test data: 2 sea-level rows.
SEA_ROWS = [
    'Cork,rcp45,2050,20.000,UKCP18',
    'Kerry,rcp85,2100,50.000,"UKCP18, estimated from Clare"',
]


def counts():
    return (County.objects.count(), ClimateProjection.objects.count(), SeaLevelProjection.objects.count())


class LoadDataTestCase(TestCase):
    # CI runs `manage.py test` on an empty database; this loads climate/fixtures/data_sources.json for each test.
    fixtures = ['data_sources']

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)

    def write(self, name, header, rows):
        path = self.dir / name
        path.write_text('\n'.join([header, *rows]) + '\n', encoding='utf-8')
        return path

    def climate(self, rows=CLIMATE_ROWS, header=CLIMATE_HEADER):
        return self.write('climate_data.csv', header, rows)

    def sea(self, rows=SEA_ROWS, header=SEA_HEADER):
        return self.write('sea_level.csv', header, rows)

    def load(self, *paths):
        out, err = StringIO(), StringIO()
        call_command('load_data', *map(str, paths), stdout=out, stderr=err)
        return out.getvalue(), err.getvalue()


class IdempotencyTests(LoadDataTestCase):
    def test_second_run_creates_nothing(self):
        files = (self.climate(), self.sea())
        self.load(*files)
        after_first = counts()
        self.assertEqual(after_first, (2, 4, 2))

        out, _ = self.load(*files)
        self.assertEqual(counts(), after_first)
        self.assertIn('TOTAL: inserted 0, updated 6, skipped 0', out)

    def test_update_changes_value_not_count(self):
        self.load(self.climate(), self.sea())
        before = counts()

        changed = [CLIMATE_ROWS[0].replace('10.000', '11.500'), *CLIMATE_ROWS[1:]]
        self.load(self.climate(changed))

        self.assertEqual(counts(), before)
        row = ClimateProjection.objects.get(county__name='Cork', variable='temperature', scenario='baseline')
        self.assertEqual(row.value, Decimal('11.500'))

    def test_stored_fields(self):
        self.load(self.climate(), self.sea())
        climate = ClimateProjection.objects.get(county__name='Kerry', variable='temperature')
        self.assertEqual((climate.season, climate.unit, climate.data_source.code), ('winter', 'degC', 'translate'))

        sea = SeaLevelProjection.objects.get(county__name='Kerry')
        self.assertEqual((sea.season, sea.unit, sea.provenance), ('annual', 'cm', 'UKCP18, estimated from Clare'))
        # The sea-level baseline is stored through the data source.
        self.assertEqual(sea.data_source.baseline_period, '1981-2000')


class CountyTests(LoadDataTestCase):
    def test_name_normalised_and_coastline_from_constant(self):
        rows = [
            '  cork ,temperature,baseline,1976-2005,Annual,10.000,degC',
            'CARLOW,temperature,baseline,1976-2005,Annual,10.000,degC',
        ]
        self.load(self.climate(rows))
        self.assertTrue(County.objects.get(name='Cork').has_coastline)
        self.assertFalse(County.objects.get(name='Carlow').has_coastline)

    def test_26_counties_15_coastal(self):
        self.assertEqual(len(COUNTIES), 26)
        self.assertEqual(sum(coastal for _, coastal in COUNTIES), 15)

    def test_warns_about_counties_without_climate_rows(self):
        _, err = self.load(self.climate())
        self.assertIn('No climate rows for 24 counties', err)
        self.assertIn('Carlow', err)
        self.assertNotIn('Cork,', err)


class RowErrorTests(LoadDataTestCase):
    def test_bad_rows_skipped_valid_rows_loaded(self):
        rows = [
            *CLIMATE_ROWS,  # lines 2-5
            'Cork,temperature,rcp26,2021-2050,Spring,,degC',  # line 6: empty
            'Cork,temperature,rcp26,2021-2050,Summer,warm,degC',  # line 7: non-numeric
            'Atlantis,temperature,rcp26,2021-2050,Autumn,9.000,degC',  # line 8: unknown county
            'Fingal,temperature,rcp26,2021-2050,Autumn,9.000,degC',  # line 9: local authority, not a county
            'Cork,precipitation,rcp26,2021-2050,Spring,-5.000,mm',  # line 10: out of bounds
            'Cork,temperature,rcp26,2021-2050,Winter,NaN,degC',  # line 11: null token
        ]
        sea_rows = [*SEA_ROWS, 'Narnia,rcp26,2050,10.000,UKCP18']
        out, _ = self.load(self.climate(rows), self.sea(sea_rows))

        self.assertEqual(ClimateProjection.objects.count(), 4)
        self.assertEqual(SeaLevelProjection.objects.count(), 2)
        self.assertIn("skipped 2: empty or null value in 'value', lines 6, 11", out)
        self.assertIn("skipped 1: non-numeric value in 'value', lines 7", out)
        self.assertIn('skipped 2: unknown county, lines 8, 9', out)
        self.assertIn('skipped 1: precipitation value out of bounds [0, 5000] mm, lines 10', out)
        self.assertIn('skipped 1: unknown county, lines 4', out)  # sea-level file
        self.assertIn('TOTAL: inserted 6, updated 0, skipped 7', out)


class ContractErrorTests(LoadDataTestCase):
    def assert_rolled_back(self, *paths, message):
        with self.assertRaisesMessage(CommandError, message):
            self.load(*paths)
        self.assertEqual(counts(), (0, 0, 0))

    def test_single_unit_mismatch_rolls_back_everything(self):
        # Valid rows come first and are written before the bad row is reached.
        rows = [*CLIMATE_ROWS, 'Cork,temperature,rcp45,2021-2050,Annual,11.000,mm']
        self.assert_rolled_back(self.sea(), self.climate(rows), message="unit 'mm' does not match")

    def test_other_contract_errors(self):
        cases = {
            'scenario': ('Cork,temperature,rcp60,2021-2050,Annual,11.000,degC', "scenario 'rcp60' not in"),
            'period': ('Cork,temperature,rcp45,2050-2021,Annual,11.000,degC', "period '2050-2021' is invalid"),
            'season': ('Cork,temperature,rcp45,2021-2050,Monsoon,11.000,degC', "season 'monsoon' not in"),
        }
        for name, (bad_row, message) in cases.items():
            with self.subTest(name):
                self.assert_rolled_back(self.climate([*CLIMATE_ROWS, bad_row]), message=message)

    def test_missing_column(self):
        header = CLIMATE_HEADER.replace(',unit', '')
        rows = [row.rsplit(',', 1)[0] for row in CLIMATE_ROWS]
        self.assert_rolled_back(self.climate(rows, header), message='required column missing: unit')

    def test_sea_level_unit_column_must_be_cm(self):
        header = SEA_HEADER + ',unit'
        self.load(self.sea([row + ',cm' for row in SEA_ROWS], header))
        self.assertEqual(SeaLevelProjection.objects.count(), 2)

        SeaLevelProjection.objects.all().delete()
        County.objects.all().delete()
        self.assert_rolled_back(self.sea([row + ',mm' for row in SEA_ROWS], header), message="unit 'mm' is not 'cm'")

    def test_sea_level_baseline_scenario_rejected(self):
        self.assert_rolled_back(self.sea(['Cork,baseline,2050,0.000,UKCP18']), message="scenario 'baseline'")


class FailureTests(LoadDataTestCase):
    def test_database_error_part_way_rolls_back(self):
        real = ClimateProjection.objects.update_or_create
        calls = []

        def fail_on_third(*args, **kwargs):
            calls.append(1)
            if len(calls) == 3:
                raise DatabaseError('simulated failure')
            return real(*args, **kwargs)

        with mock.patch.object(ClimateProjection.objects, 'update_or_create', side_effect=fail_on_third):
            with self.assertRaisesMessage(CommandError, 'simulated failure'):
                self.load(self.sea(), self.climate())
        self.assertEqual(len(calls), 3)
        self.assertEqual(counts(), (0, 0, 0))

    def test_missing_file(self):
        with self.assertRaisesMessage(CommandError, 'File not found'):
            self.load(self.dir / 'nope.csv')

    def test_missing_data_source(self):
        DataSource.objects.filter(code='ukcp18').delete()
        with self.assertRaisesMessage(CommandError, 'python manage.py loaddata data_sources'):
            self.load(self.climate())


class DataSourceFixtureTests(TestCase):
    def test_licence_and_attribution_copied_verbatim_from_data_sources_md(self):
        doc = (settings.BASE_DIR.parent / 'DATA_SOURCES.md').read_text(encoding='utf-8')
        fixture = settings.BASE_DIR / 'climate' / 'fixtures' / 'data_sources.json'
        for entry in json.loads(fixture.read_text(encoding='utf-8')):
            for name in ('name', 'organisation', 'licence', 'attribution', 'url'):
                with self.subTest(code=entry['fields']['code'], field=name):
                    self.assertIn(entry['fields'][name], doc)
