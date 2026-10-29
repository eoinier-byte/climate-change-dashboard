from django.db import IntegrityError, transaction
from django.test import TestCase

from climate.models import County
from climate.tests.base import ProjectionTestCase
from common.models import Scenario, Season, Variable


class CountyTestCase(TestCase):
    def test_slugify(self):
        county = County.objects.create(name='County')
        self.assertEqual(county.slug, 'county')


class ClimateProjectionTestCase(ProjectionTestCase):
    def test_uniqueness(self):
        self.create_climate_projection()
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.create_climate_projection(value=1)

    def test_differs_by_one_key_field(self):
        self.create_climate_projection()
        cases = {
            'county': County.objects.create(name='Kerry'),
            'variable': Variable.PRECIPITATION,
            'scenario': Scenario.RCP85,
            'period': '2071-2100',
            'season': Season.SUMMER,
        }
        for field, value in cases.items():
            with self.subTest(field=field):
                self.create_climate_projection(**{field: value})


class SeaLevelProjectionTestCase(ProjectionTestCase):
    def test_uniqueness(self):
        self.create_sea_level_projection()
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.create_sea_level_projection(value=1)

    def test_differs_by_one_key_field(self):
        self.create_sea_level_projection()
        cases = {
            'county': County.objects.create(name='Kerry', has_coastline=True),
            'scenario': Scenario.RCP26,
            'year': 2100,
        }
        for field, value in cases.items():
            with self.subTest(field=field):
                self.create_sea_level_projection(**{field: value})
