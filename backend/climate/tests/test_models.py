from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.test import TestCase

from climate.models import County
from climate.tests.base import AnalogueTestCase, ProjectionTestCase
from common.enums import Scenario, Season, Variable


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


class CityClimateTestCase(AnalogueTestCase):
    def test_str(self):
        self.assertEqual(str(self.city), 'Brest, France')

    def test_uniqueness(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.create_city(name='Brest', country='France')

    def test_same_name_in_another_country(self):
        self.create_city(name='Brest', country='Belarus')


class CountyAnalogueTestCase(AnalogueTestCase):
    def test_str(self):
        self.assertEqual(str(self.create_analogue()), 'Cork-rcp45-2071-2100-1: Brest, France')

    def test_uniqueness(self):
        self.create_analogue()
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.create_analogue(city=self.create_city(name='Plymouth', country='United Kingdom'))

    def test_differs_by_one_key_field(self):
        self.create_analogue()
        cases = {
            'county': County.objects.create(name='Kerry'),
            'scenario': Scenario.RCP85,
            'period': '2021-2050',
            'rank': 2,
        }
        for field, value in cases.items():
            with self.subTest(field=field):
                # A city appears once per list, so another rank needs another city
                city = self.create_city(name='Plymouth', country='United Kingdom') if field == 'rank' else self.city
                self.create_analogue(city=city, **{field: value})

    def test_same_city_twice_in_one_list(self):
        self.create_analogue(rank=1)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.create_analogue(rank=2)

    def test_baseline_has_no_analogue(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.create_analogue(scenario=Scenario.BASELINE, period='1976-2005')

    def test_rank_starts_at_1(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.create_analogue(rank=0)

    def test_city_in_use_cannot_be_deleted(self):
        self.create_analogue()
        with self.assertRaises(ProtectedError):
            self.city.delete()
