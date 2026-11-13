from datetime import date
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase

from climate.models import ClimateProjection, County, DataSource, SeaLevelProjection
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
