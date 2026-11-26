from datetime import date
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase

from climate.models import CityClimate, ClimateProjection, County, CountyAnalogue, DataSource, SeaLevelProjection
from common.enums import Scenario, Season, Unit, Variable


class ProjectionTestCase(TestCase):
    def setUp(self):
        cache.clear()
        super().setUp()

    @classmethod
    def setUpTestData(cls):
        cls.county = County.objects.create(name='Cork', has_coastline=True)
        common = {
            'organisation': 'Test',
            'licence': 'CC BY 4.0',
            'attribution': 'Test',
            'url': 'https://example.com',
            'accessed_on': date(2026, 10, 1),
        }
        cls.translate = DataSource.objects.create(
            code='translate', name='TRANSLATE', baseline_period='1976-2005', **common
        )
        cls.ukcp18 = DataSource.objects.create(code='ukcp18', name='UKCP18', baseline_period='1981-2000', **common)

    def create_climate_projection(self, **fields):
        return ClimateProjection.objects.create(
            **{
                'county': self.county,
                'data_source': self.translate,
                'variable': Variable.TEMPERATURE,
                'scenario': Scenario.RCP45,
                'period': '2021-2050',
                'season': Season.WINTER,
                'value': Decimal('6.123'),
                'unit': Unit.DEG_C,
                **fields,
            }
        )

    def create_sea_level_projection(self, **fields):
        return SeaLevelProjection.objects.create(
            **{
                'county': self.county,
                'data_source': self.ukcp18,
                'scenario': Scenario.RCP85,
                'year': 2050,
                'season': Season.ANNUAL,
                'value': Decimal('21.500'),
                'unit': Unit.CM,
                'provenance': 'UKCP18',
                **fields,
            }
        )


class AnalogueTestCase(ProjectionTestCase):
    """ProjectionTestCase plus a WorldClim source and a city, for the climate analogues (CCD-354)."""

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.worldclim = DataSource.objects.create(
            code='worldclim',
            name='WorldClim 2.1',
            baseline_period='1970-2000',
            organisation='Test',
            url='https://example.com',
            accessed_on=date(2026, 11, 21),
        )
        cls.city = cls.create_city(name='Brest', country='France')

    @classmethod
    def create_city(cls, **fields):
        return CityClimate.objects.create(
            **{
                'latitude': Decimal('48.390'),
                'longitude': Decimal('-4.495'),
                'summer_temp': Decimal('16.200'),
                'winter_temp': Decimal('7.300'),
                'annual_precip': Decimal('1210.000'),
                'data_source': cls.worldclim,
                **fields,
            }
        )

    def create_analogue(self, **fields):
        return CountyAnalogue.objects.create(
            **{
                'county': self.county,
                'city': self.city,
                'scenario': Scenario.RCP45,
                'period': '2071-2100',
                'rank': 1,
                'similarity': Decimal('0.812'),
                'county_summer_temp': Decimal('16.020'),
                'county_winter_temp': Decimal('7.110'),
                'county_annual_precip': Decimal('1352.400'),
                **fields,
            }
        )
