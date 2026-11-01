from decimal import Decimal

from django.test import override_settings

from climate.models import ClimateProjection
from climate.serializers import CountyDetailSerializer
from climate.tests.base import ProjectionTestCase
from common.models import Scenario, Season, Unit, Variable
from common.serializers import ProjectionSerializer


class ProjectionSerializerTestCase(ProjectionTestCase):
    class Dummy(ProjectionSerializer):
        class Meta(ProjectionSerializer.Meta):
            model = ClimateProjection

    def test_climate_projection(self):
        data = self.Dummy(self.create_climate_projection()).data
        self.assertEqual(
            data,
            {'scenario': 'rcp45', 'baseline': '1976-2005', 'units': 'degC', 'source': 'translate'},
        )

    def test_sea_level_projection(self):
        data = self.Dummy(self.create_sea_level_projection()).data
        self.assertEqual(
            data,
            {'scenario': 'rcp85', 'baseline': '1981-2000', 'units': 'cm', 'source': 'ukcp18'},
        )


class CountyDetailSerializerTestCase(ProjectionTestCase):
    EMPTY_SUMMARY = {'scenario': 'baseline', 'period': '1976-2005', 'season': 'annual', 'source': None}

    def test_summary(self):
        self.create_climate_projection(scenario=Scenario.BASELINE, period='1976-2005', season=Season.ANNUAL)
        self.create_climate_projection(
            variable=Variable.PRECIPITATION,
            scenario=Scenario.BASELINE,
            period='1976-2005',
            season=Season.ANNUAL,
            value=Decimal('1368.800'),
            unit=Unit.MM,
        )
        data = CountyDetailSerializer(self.county).data
        self.assertEqual(
            data['summary'],
            {
                'scenario': 'baseline',
                'period': '1976-2005',
                'season': 'annual',
                'source': 'translate',
                'temperature': {'value': Decimal('6.123'), 'unit': '°C'},
                'precipitation': {'value': Decimal('1368.800'), 'unit': 'mm'},
            },
        )

    def test_summary_ignores_other_projections(self):
        self.create_climate_projection(scenario=Scenario.RCP45, period='1976-2005', season=Season.ANNUAL)
        self.create_climate_projection(scenario=Scenario.BASELINE, period='2021-2050', season=Season.ANNUAL)
        self.create_climate_projection(scenario=Scenario.BASELINE, period='1976-2005', season=Season.WINTER)
        self.assertEqual(CountyDetailSerializer(self.county).data['summary'], self.EMPTY_SUMMARY)

    @override_settings(SUMMARY_SCENARIO='rcp85', SUMMARY_PERIOD='2071-2100', SUMMARY_SEASON='winter')
    def test_summary_defaults_from_settings(self):
        self.create_climate_projection(scenario=Scenario.RCP85, period='2071-2100', season=Season.WINTER)
        summary = CountyDetailSerializer(self.county).data['summary']
        self.assertEqual((summary['scenario'], summary['period'], summary['season']), ('rcp85', '2071-2100', 'winter'))
        self.assertEqual(summary['temperature'], {'value': Decimal('6.123'), 'unit': '°C'})

    def test_fields(self):
        data = CountyDetailSerializer(self.county).data
        self.assertEqual(
            data,
            {'id': self.county.id, 'name': 'Cork', 'slug': 'cork', 'has_coastline': True, 'summary': self.EMPTY_SUMMARY},
        )
