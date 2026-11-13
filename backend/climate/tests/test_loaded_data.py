"""Verify imported records (CCD-271): load the real processed CSVs and check the tables match them.

Uses the committed pipeline/data/processed/*.csv, so CI checks the real data. Results of the same checks on the
local database are in docs/validation-log.md.
"""

import csv
import random
from collections import Counter
from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.db.models import CharField, Count, UniqueConstraint
from django.test import TestCase

from climate.management.commands.load_data import DEFAULT_DIR
from climate.models import ClimateProjection, County, SeaLevelProjection

LOADED_MODELS = (County, ClimateProjection, SeaLevelProjection)


def read_csv(name):
    with (DEFAULT_DIR / name).open(newline='', encoding='utf-8') as f:
        return list(csv.DictReader(f))


class LoadedDataTestCase(TestCase):
    fixtures = ['data_sources']

    @classmethod
    def setUpTestData(cls):
        cls.climate_csv = read_csv('climate_data.csv')
        cls.sea_csv = read_csv('sea_level.csv')
        call_command('load_data', stdout=StringIO(), stderr=StringIO())

    def test_total_rows_match_csv(self):
        self.assertEqual(ClimateProjection.objects.count(), len(self.climate_csv))
        self.assertEqual(SeaLevelProjection.objects.count(), len(self.sea_csv))

    def test_counts_per_county_scenario_variable_match_csv(self):
        expected = Counter((r['county'], r['scenario'], r['variable']) for r in self.climate_csv)
        actual = Counter(
            {
                (row['county__name'], row['scenario'], row['variable']): row['n']
                for row in ClimateProjection.objects.values('county__name', 'scenario', 'variable').annotate(
                    n=Count('id')
                )
            }
        )
        self.assertEqual(actual, expected)

    def test_sea_level_counts_per_county_scenario_match_csv(self):
        expected = Counter((r['county'], r['scenario']) for r in self.sea_csv)
        actual = Counter(
            {
                (row['county__name'], row['scenario']): row['n']
                for row in SeaLevelProjection.objects.values('county__name', 'scenario').annotate(n=Count('id'))
            }
        )
        self.assertEqual(actual, expected)

    def test_no_null_or_empty_values(self):
        for model in LOADED_MODELS:
            for field in model._meta.concrete_fields:
                with self.subTest(model=model.__name__, field=field.name):
                    self.assertFalse(model.objects.filter(**{f'{field.attname}__isnull': True}).exists())
                    if isinstance(field, CharField):
                        self.assertFalse(model.objects.filter(**{f'{field.attname}__regex': r'^\s*$'}).exists())

    def test_no_duplicate_natural_keys(self):
        for model in (ClimateProjection, SeaLevelProjection):
            constraints = [c for c in model._meta.constraints if isinstance(c, UniqueConstraint)]
            self.assertTrue(constraints, f'{model.__name__} has no unique constraint on its natural key')
            for constraint in constraints:
                with self.subTest(model=model.__name__, key=constraint.fields):
                    duplicates = model.objects.values(*constraint.fields).annotate(n=Count('id')).filter(n__gt=1)
                    self.assertEqual(list(duplicates), [])

    def test_five_csv_rows_match_database(self):
        # Fixed seed, so the same five rows are checked every run (they are listed in docs/validation-log.md).
        for row in random.Random(2026).sample(self.climate_csv, 5):
            with self.subTest(row=row):
                stored = ClimateProjection.objects.get(
                    county__name=row['county'],
                    variable=row['variable'],
                    scenario=row['scenario'],
                    period=row['period'],
                    season=row['season'].lower(),
                )
                self.assertEqual(
                    (stored.value, stored.unit, stored.scenario), (Decimal(row['value']), row['unit'], row['scenario'])
                )
