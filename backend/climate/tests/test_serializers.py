from decimal import Decimal

from django.test import override_settings

from climate.models import ClimateProjection, County
from climate.serializers import ClimateSeriesSerializer, CountyDetailSerializer, SeaLevelSeriesSerializer
from climate.tests.base import ProjectionTestCase
from common.enums import Scenario, Season, Unit, Variable
from common.serializers import ProjectionSerializer


class ProjectionSerializerTestCase(ProjectionTestCase):
    class Dummy(ProjectionSerializer):
        class Meta(ProjectionSerializer.Meta):
            model = ClimateProjection

    def test_climate_projection(self):
        data = self.Dummy(self.create_climate_projection()).data
        self.assertEqual(
            data,
            {
                'scenario': 'rcp45',
                'baseline': '1976-2005',
                'units': 'degC',
                'source': 'translate',
                'value': '6.123',
                'county': 'cork',
            },
        )

    def test_sea_level_projection(self):
        data = self.Dummy(self.create_sea_level_projection()).data
        self.assertEqual(
            data,
            {
                'scenario': 'rcp85',
                'baseline': '1981-2000',
                'units': 'cm',
                'source': 'ukcp18',
                'value': '21.500',
                'county': 'cork',
            },
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
            {
                'id': self.county.id,
                'name': 'Cork',
                'slug': 'cork',
                'has_coastline': True,
                'summary': self.EMPTY_SUMMARY,
            },
        )


class ClimateSeriesSerializerTestCase(ProjectionTestCase):
    PERIODS = ['1976-2005', '2021-2050', '2071-2100']

    def create_series(self, variable, unit, baseline, scenarios, season=Season.ANNUAL, county=None):
        extra = {'variable': variable, 'unit': unit, 'season': season}
        if county:
            extra['county'] = county
        self.create_climate_projection(scenario=Scenario.BASELINE, period='1976-2005', value=Decimal(baseline), **extra)
        for scenario, (mid, end) in scenarios.items():
            self.create_climate_projection(scenario=scenario, period='2021-2050', value=Decimal(mid), **extra)
            self.create_climate_projection(scenario=scenario, period='2071-2100', value=Decimal(end), **extra)

    def create_temperature(self, **kwargs):
        self.create_series(
            Variable.TEMPERATURE,
            Unit.DEG_C,
            '9.810',
            {
                Scenario.RCP26: ('10.520', '10.540'),
                Scenario.RCP45: ('10.620', '11.280'),
                Scenario.RCP85: ('10.710', '12.520'),
            },
            **kwargs,
        )

    def create_precipitation(self):
        self.create_series(Variable.PRECIPITATION, Unit.MM, '1366.160', {Scenario.RCP85: ('1402.490', '1474.710')})

    def serialize(self, **context):
        return ClimateSeriesSerializer(self.county, context=context).data

    def test_temperature(self):
        self.create_temperature()
        data = self.serialize(variable='temperature', season='annual')
        self.assertEqual(
            {**data, 'periods': list(data['periods'])},
            {
                'county': 'Cork',
                'slug': 'cork',
                'variable': 'temperature',
                'season': 'annual',
                'unit': '°C',
                'change_unit': '°C',
                'baseline_period': '1976-2005',
                'baseline': Decimal('9.810'),
                'periods': self.PERIODS,
                'scenarios': {
                    'rcp26': {
                        'label': 'RCP2.6',
                        'values': [Decimal('9.810'), Decimal('10.520'), Decimal('10.540')],
                        'change': [0, Decimal('0.71'), Decimal('0.73')],
                    },
                    'rcp45': {
                        'label': 'RCP4.5',
                        'values': [Decimal('9.810'), Decimal('10.620'), Decimal('11.280')],
                        'change': [0, Decimal('0.81'), Decimal('1.47')],
                    },
                    'rcp85': {
                        'label': 'RCP8.5',
                        'values': [Decimal('9.810'), Decimal('10.710'), Decimal('12.520')],
                        'change': [0, Decimal('0.90'), Decimal('2.71')],
                    },
                },
                'source': 'TRANSLATE',
            },
        )

    def test_precipitation_change_is_percent_of_baseline(self):
        self.create_precipitation()
        data = self.serialize(variable='precipitation')
        self.assertEqual((data['unit'], data['change_unit']), ('mm', '%'))
        self.assertEqual(data['baseline'], Decimal('1366.160'))
        self.assertEqual(
            data['scenarios'],
            {
                'rcp85': {
                    'label': 'RCP8.5',
                    'values': [Decimal('1366.160'), Decimal('1402.490'), Decimal('1474.710')],
                    'change': [0, Decimal('2.7'), Decimal('7.9')],
                }
            },
        )

    def test_defaults_to_annual_temperature(self):
        self.create_temperature()
        self.create_precipitation()
        data = self.serialize()
        self.assertEqual((data['variable'], data['season'], data['unit']), ('temperature', 'annual', '°C'))
        self.assertEqual(data['baseline'], Decimal('9.810'))

    def test_periods_are_unique_and_in_order(self):
        self.create_temperature()
        self.assertEqual(list(self.serialize()['periods']), self.PERIODS)

    def test_filters_by_variable(self):
        self.create_temperature()
        self.create_precipitation()
        data = self.serialize(variable='precipitation')
        self.assertEqual(list(data['scenarios']), ['rcp85'])
        self.assertEqual(data['baseline'], Decimal('1366.160'))

    def test_filters_by_season(self):
        self.create_temperature(season=Season.ANNUAL)
        self.create_series(
            Variable.TEMPERATURE, Unit.DEG_C, '6.000', {Scenario.RCP85: ('6.500', '8.000')}, season=Season.WINTER
        )
        data = self.serialize(season='winter')
        self.assertEqual(data['season'], 'winter')
        self.assertEqual(data['baseline'], Decimal('6.000'))
        self.assertEqual(list(data['scenarios']), ['rcp85'])
        self.assertEqual(data['scenarios']['rcp85']['change'], [0, Decimal('0.50'), Decimal('2.00')])

    def test_ignores_other_counties(self):
        kerry = County.objects.create(name='Kerry', has_coastline=True)
        self.create_series(
            Variable.TEMPERATURE, Unit.DEG_C, '10.000', {Scenario.RCP85: ('11.000', '13.000')}, county=kerry
        )
        self.create_temperature()
        self.assertEqual(self.serialize()['baseline'], Decimal('9.810'))

    def test_no_data(self):
        data = self.serialize(variable='precipitation', season='summer')
        self.assertEqual(
            {**data, 'periods': list(data['periods'])},
            {
                'county': 'Cork',
                'slug': 'cork',
                'variable': 'precipitation',
                'season': 'summer',
                'unit': None,
                'change_unit': '%',
                'baseline_period': None,
                'baseline': None,
                'periods': [],
                'scenarios': {},
                'source': None,
            },
        )

    def test_num_queries(self):
        self.create_temperature()
        self.create_precipitation()
        for variable in ('temperature', 'precipitation'):
            with self.subTest(variable=variable), self.assertNumQueries(1):
                self.serialize(variable=variable)

    def test_num_queries_with_prefetch(self):
        self.create_temperature()
        county = County.objects.prefetch_related('climateprojections__data_source').get(pk=self.county.pk)
        with self.assertNumQueries(0):
            data = ClimateSeriesSerializer(county, context={'variable': 'temperature'}).data
        self.assertEqual(data['baseline'], Decimal('9.810'))
        self.assertEqual(list(data['scenarios']), ['rcp26', 'rcp45', 'rcp85'])

    def test_no_baseline_gives_empty_scenarios(self):
        self.create_climate_projection(scenario=Scenario.RCP85, period='2071-2100', season=Season.ANNUAL)
        data = self.serialize()
        self.assertIsNone(data['baseline'])
        self.assertEqual(data['scenarios'], {})


class SeaLevelSeriesSerializerTestCase(ProjectionTestCase):
    def test_coastal_county(self):
        # Created out of order on purpose: the response must still be sorted.
        for scenario, year, value in [
            (Scenario.RCP85, 2100, '75.400'),
            (Scenario.RCP26, 2050, '22.830'),
            (Scenario.RCP85, 2050, '28.630'),
            (Scenario.RCP26, 2100, '42.700'),
        ]:
            self.create_sea_level_projection(scenario=scenario, year=year, value=Decimal(value))
        data = SeaLevelSeriesSerializer(self.county).data
        self.assertEqual(
            {**data, 'years': list(data['years'])},
            {
                'county': 'Cork',
                'slug': 'cork',
                'has_coastline': True,
                'unit': 'cm',
                'baseline_period': '1981-2000',
                'years': [2050, 2100],
                'series': {
                    'rcp26': {
                        'values': [Decimal('22.830'), Decimal('42.700')],
                        'provenance': 'UKCP18',
                        'source': 'ukcp18',
                    },
                    'rcp85': {
                        'values': [Decimal('28.630'), Decimal('75.400')],
                        'provenance': 'UKCP18',
                        'source': 'ukcp18',
                    },
                },
            },
        )

    def test_years_are_unique_and_in_order(self):
        for scenario in (Scenario.RCP26, Scenario.RCP45, Scenario.RCP85):
            for year in (2100, 2050):
                self.create_sea_level_projection(scenario=scenario, year=year)
        self.assertEqual(list(SeaLevelSeriesSerializer(self.county).data['years']), [2050, 2100])

    def test_provenance_for_estimated_county(self):
        leitrim = County.objects.create(name='Leitrim', has_coastline=True)
        self.create_sea_level_projection(county=leitrim, provenance='estimated from Sligo')
        series = SeaLevelSeriesSerializer(leitrim).data['series']
        self.assertEqual(series['rcp85']['provenance'], 'estimated from Sligo')

    def test_inland_county(self):
        offaly = County.objects.create(name='Offaly', has_coastline=False)
        self.create_sea_level_projection()  # data for Cork must not leak into Offaly
        data = SeaLevelSeriesSerializer(offaly).data
        self.assertEqual(
            {**data, 'years': list(data['years'])},
            {
                'county': 'Offaly',
                'slug': 'offaly',
                'has_coastline': False,
                'unit': None,
                'baseline_period': None,
                'years': [],
                'series': {},
            },
        )
