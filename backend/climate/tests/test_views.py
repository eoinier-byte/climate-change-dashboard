from decimal import Decimal
from http import HTTPStatus

from django.shortcuts import reverse
from rest_framework.test import APITestCase

from climate.models import ClimateProjection, County, SeaLevelProjection
from climate.tests.base import ProjectionTestCase
from common.enums import Scenario, Season, Unit, Variable


class CountyViewSetTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.counties = ['Kerry', 'Cork', 'Carlow']
        for name in cls.counties:
            County.objects.create(name=name)
        cls.county = County.objects.get(name='Cork')

    def test_list(self):
        response = self.client.get(reverse('climate:county-list'))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        names = [c['name'] for c in response.json()]
        self.assertEqual(names, sorted(self.counties))
        self.assertNotIn('summary', response.json()[0])

    def test_detail(self):
        response = self.client.get(reverse('climate:county-detail', args=[self.county.slug]))

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json()['id'], self.county.id)
        self.assertEqual(response.json()['name'], 'Cork')
        self.assertIn('summary', response.json())

    def test_detail_unknown_id(self):
        response = self.client.get(reverse('climate:county-detail', args=['test']))
        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
        self.assertIn('detail', response.json())

    def test_method_not_allowed(self):
        cases = (
            ('climate:county-list', [], ('post', 'put', 'patch', 'delete')),
            ('climate:county-detail', [self.county.slug], ('put', 'patch', 'delete')),
        )
        initial_count = County.objects.count()

        for url_name, args, methods in cases:
            url = reverse(url_name, args=args)
            for method in methods:
                with self.subTest(url=url_name, method=method):
                    response = getattr(self.client, method)(url, {'name': 'Test'})
                    self.assertEqual(response.status_code, HTTPStatus.METHOD_NOT_ALLOWED)
                    self.assertEqual(County.objects.count(), initial_count)
                    self.assertEqual(County.objects.get(id=self.county.id).name, self.county.name)


class SeaLevelViewTestCase(ProjectionTestCase, APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for scenario, year, value in (
            (Scenario.RCP85, 2100, '80.000'),
            (Scenario.RCP26, 2100, '40.000'),
            (Scenario.RCP85, 2050, '30.000'),
            (Scenario.RCP26, 2050, '20.000'),
        ):
            SeaLevelProjection.objects.create(
                county=cls.county,
                data_source=cls.ukcp18,
                scenario=scenario,
                year=year,
                season=Season.ANNUAL,
                value=Decimal(value),
                unit=Unit.CM,
                provenance='UKCP18',
            )
        cls.inland = County.objects.create(name='Offaly', has_coastline=False)
        cls.leitrim = County.objects.create(name='Leitrim', has_coastline=True)
        SeaLevelProjection.objects.create(
            county=cls.leitrim,
            data_source=cls.ukcp18,
            scenario=Scenario.RCP45,
            year=2050,
            season=Season.ANNUAL,
            value=Decimal('25.000'),
            unit=Unit.CM,
            provenance='UKCP18, estimated from Sligo',
        )

    @staticmethod
    def url(slug):
        return reverse('climate:sea_level', args=[slug])

    def test_coastal_county(self):
        response = self.client.get(self.url(self.county.slug))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(
            response.json(),
            {
                'county': 'Cork',
                'slug': 'cork',
                'has_coastline': True,
                'unit': 'cm',
                'baseline_period': '1981-2000',
                'years': [2050, 2100],
                'series': {
                    'rcp26': {'values': [20.0, 40.0], 'provenance': 'UKCP18', 'source': 'ukcp18'},
                    'rcp85': {'values': [30.0, 80.0], 'provenance': 'UKCP18', 'source': 'ukcp18'},
                },
            },
        )

    def test_only_requested_county(self):
        response = self.client.get(self.url(self.county.slug))
        self.assertNotIn('rcp45', response.json()['series'])

    def test_inland_county(self):
        response = self.client.get(self.url(self.inland.slug))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(
            response.json(),
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

    def test_estimated_provenance(self):
        response = self.client.get(self.url(self.leitrim.slug))
        self.assertEqual(
            response.json()['series']['rcp45']['provenance'],
            'UKCP18, estimated from Sligo',
        )

    def test_unknown_county(self):
        response = self.client.get(self.url('atlantis'))
        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
        self.assertIn('detail', response.json())

    def test_num_queries(self):
        with self.assertNumQueries(3):
            self.client.get(self.url(self.county.slug))

    def test_method_not_allowed(self):
        initial_count = SeaLevelProjection.objects.count()
        for method in ('post', 'put', 'patch', 'delete'):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.url(self.county.slug), {'has_coastline': False})
                self.assertEqual(response.status_code, HTTPStatus.METHOD_NOT_ALLOWED)
                self.assertEqual(SeaLevelProjection.objects.count(), initial_count)
                self.assertTrue(County.objects.get(id=self.county.id).has_coastline)


class MetaViewTestCase(ProjectionTestCase, APITestCase):
    def test_empty(self):
        response = self.client.get(reverse('climate:meta'))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        for key in ('scenarios', 'periods', 'seasons', 'variables', 'sea_level_years'):
            with self.subTest(key=key):
                self.assertEqual(data[key], [])

    def test_distinct_sorted_values(self):
        self.create_climate_projection(scenario=Scenario.RCP85, period='2071-2100')
        self.create_climate_projection(scenario=Scenario.RCP45, period='2071-2100')
        self.create_climate_projection(scenario=Scenario.RCP45, period='2021-2050', season=Season.ANNUAL)
        self.create_climate_projection(variable=Variable.PRECIPITATION, unit=Unit.MM)

        response = self.client.get(reverse('climate:meta'))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertEqual(data['scenarios'], ['rcp45', 'rcp85'])
        self.assertEqual(data['periods'], ['2021-2050', '2071-2100'])
        self.assertEqual(data['seasons'], ['annual', 'winter'])
        self.assertEqual(data['variables'], ['precipitation', 'temperature'])

    def test_sea_level_years(self):
        for scenario, year in ((Scenario.RCP85, 2100), (Scenario.RCP85, 2050), (Scenario.RCP26, 2050)):
            self.create_sea_level_projection(scenario=scenario, year=year)
        response = self.client.get(reverse('climate:meta'))
        self.assertEqual(response.json()['sea_level_years'], [2050, 2100])

    def test_sea_level_not_included(self):
        self.create_sea_level_projection(scenario=Scenario.RCP26)
        response = self.client.get(reverse('climate:meta'))
        self.assertNotIn('rcp26', response.json()['scenarios'])

    def test_sources(self):
        response = self.client.get(reverse('climate:meta'))
        self.assertEqual(
            response.json()['sources'],
            [
                {
                    'code': 'translate',
                    'name': 'TRANSLATE',
                    'organisation': 'Test',
                    'baseline_period': '1976-2005',
                    'licence': 'CC BY 4.0',
                    'url': 'https://example.com',
                },
                {
                    'code': 'ukcp18',
                    'name': 'UKCP18',
                    'organisation': 'Test',
                    'baseline_period': '1981-2000',
                    'licence': 'CC BY 4.0',
                    'url': 'https://example.com',
                },
            ],
        )

    def test_method_not_allowed(self):
        url = reverse('climate:meta')
        for method in ('post', 'put', 'patch', 'delete'):
            with self.subTest(method=method):
                response = getattr(self.client, method)(url, {})
                self.assertEqual(response.status_code, HTTPStatus.METHOD_NOT_ALLOWED)


class HealthViewTestCase(APITestCase):
    def test_ok(self):
        response = self.client.get(reverse('climate:health'))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_method_not_allowed(self):
        response = self.client.post(reverse('climate:health'))
        self.assertEqual(response.status_code, HTTPStatus.METHOD_NOT_ALLOWED)


class ClimateProjectionListViewTestCase(ProjectionTestCase, APITestCase):
    url = reverse('climate:projections')

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.kerry = County.objects.create(name='Kerry', has_coastline=True)
        base = {
            'county': cls.county,
            'data_source': cls.translate,
            'variable': Variable.TEMPERATURE,
            'scenario': Scenario.RCP45,
            'period': '2021-2050',
            'season': Season.WINTER,
            'value': Decimal('6.000'),
            'unit': Unit.DEG_C,
        }
        ClimateProjection.objects.create(**base)
        ClimateProjection.objects.create(
            **{**base, 'scenario': Scenario.RCP85, 'period': '2071-2100', 'season': Season.ANNUAL}
        )
        ClimateProjection.objects.create(
            **{
                **base,
                'variable': Variable.PRECIPITATION,
                'scenario': Scenario.BASELINE,
                'period': '1976-2005',
                'season': Season.ANNUAL,
                'value': Decimal('950.000'),
                'unit': Unit.MM,
            }
        )
        ClimateProjection.objects.create(**{**base, 'county': cls.kerry})

    def get(self, **params):
        return self.client.get(self.url, params)

    def test_no_filters_returns_all(self):
        response = self.get()
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(len(response.json()), 4)

    def test_row_shape(self):
        row = self.get(county='kerry').json()[0]
        self.assertEqual(
            row,
            {
                'scenario': 'rcp45',
                'baseline_period': '1976-2005',
                'units': 'degC',
                'source': 'translate',
                'value': '6.000',
                'county': 'kerry',
                'variable': 'temperature',
                'period': '2021-2050',
                'season': 'winter',
                'baseline_value': None,
                'projected_value': '6.000',
                'change': None,
            },
        )

    def test_each_filter(self):
        cases = (
            ('county', 'kerry', 1),
            ('variable', 'precipitation', 1),
            ('scenario', 'rcp85', 1),
            ('period', '2021-2050', 2),
            ('season', 'annual', 2),
        )
        for field, value, expected in cases:
            with self.subTest(field=field):
                response = self.get(**{field: value})
                self.assertEqual(response.status_code, HTTPStatus.OK)
                rows = response.json()
                self.assertEqual(len(rows), expected)
                self.assertTrue(all(row[field] == value for row in rows))

    def test_filters_combine(self):
        rows = self.get(county='cork', variable='temperature', season='winter').json()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['scenario'], 'rcp45')

    def test_no_match_returns_empty_list(self):
        response = self.get(county='kerry', scenario='rcp85')
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json(), [])

    def test_unknown_county_returns_400(self):
        cases = (
            ('county', 'atlantis'),
            ('variable', 'wind'),
            ('scenario', 'rcp60'),
            ('period', '2000-2001'),
            ('season', 'monsoon'),
        )
        for field, value in cases:
            with self.subTest(field=field):
                response = self.get(**{field: value})
                self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
                self.assertIn(field, response.json())

    def test_num_queries(self):
        with self.assertNumQueries(1):
            self.get()

    def test_method_not_allowed(self):
        initial_count = ClimateProjection.objects.count()
        for method in ('post', 'put', 'patch', 'delete'):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.url, {})
                self.assertEqual(response.status_code, HTTPStatus.METHOD_NOT_ALLOWED)
                self.assertEqual(ClimateProjection.objects.count(), initial_count)


class ClimateProjectionChangeTestCase(ProjectionTestCase, APITestCase):
    url = reverse('climate:projections')

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.kerry = County.objects.create(name='Kerry', has_coastline=True)
        temperature = {
            'county': cls.county,
            'data_source': cls.translate,
            'variable': Variable.TEMPERATURE,
            'season': Season.ANNUAL,
            'unit': Unit.DEG_C,
        }
        precipitation = {**temperature, 'variable': Variable.PRECIPITATION, 'unit': Unit.MM}
        for fields, scenario, period, value in (
            (temperature, Scenario.BASELINE, '1976-2005', '9.810'),
            (temperature, Scenario.RCP45, '2021-2050', '10.520'),
            (temperature, Scenario.RCP85, '2071-2100', '12.400'),
            (precipitation, Scenario.BASELINE, '1976-2005', '1366.160'),
            (precipitation, Scenario.RCP85, '2071-2100', '1474.710'),
        ):
            ClimateProjection.objects.create(**fields, scenario=scenario, period=period, value=Decimal(value))
        ClimateProjection.objects.create(
            **{**temperature, 'county': cls.kerry},
            scenario=Scenario.RCP85,
            period='2071-2100',
            value=Decimal('12.000'),
        )

    def get_row(self, **params):
        rows = self.client.get(self.url, params).json()
        self.assertEqual(len(rows), 1)
        return rows[0]

    def values(self, row):
        return row['baseline_value'], row['projected_value'], row['change']

    def test_temperature_change_in_degrees(self):
        row = self.get_row(county='cork', variable='temperature', scenario='rcp85')
        self.assertEqual(self.values(row), ('9.810', '12.400', 2.59))

    def test_each_period_uses_same_baseline(self):
        row = self.get_row(county='cork', variable='temperature', scenario='rcp45')
        self.assertEqual(self.values(row), ('9.810', '10.520', 0.71))

    def test_precipitation_change_in_percent(self):
        row = self.get_row(county='cork', variable='precipitation', scenario='rcp85')
        self.assertEqual(self.values(row), ('1366.160', '1474.710', 7.9))

    def test_baseline_row_has_zero_change(self):
        row = self.get_row(county='cork', variable='temperature', scenario='baseline')
        self.assertEqual(self.values(row), ('9.810', '9.810', 0))

    def test_missing_baseline_gives_none(self):
        row = self.get_row(county='kerry')
        self.assertEqual(self.values(row), (None, '12.000', None))

    def test_baseline_from_same_county_variable_and_season(self):
        rows = self.client.get(self.url, {'scenario': 'rcp85'}).json()
        baselines = {(row['county'], row['variable']): row['baseline_value'] for row in rows}
        self.assertEqual(
            baselines,
            {
                ('cork', 'temperature'): '9.810',
                ('cork', 'precipitation'): '1366.160',
                ('kerry', 'temperature'): None,
            },
        )

    def test_units_and_source_present(self):
        row = self.get_row(county='cork', variable='precipitation', scenario='rcp85')
        self.assertEqual((row['units'], row['source']), ('mm', 'translate'))

    def test_num_queries(self):
        with self.assertNumQueries(1):
            self.client.get(self.url)


class MapViewTestCase(ProjectionTestCase, APITestCase):
    url = reverse('climate:map')
    params = {'variable': 'temperature', 'scenario': 'rcp45', 'period': '2021-2050', 'season': 'annual'}

    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.kerry = County.objects.create(name='Kerry', has_coastline=True)
        cls.carlow = County.objects.create(name='Carlow', has_coastline=False)
        cls.base = {
            'data_source': cls.translate,
            'variable': Variable.TEMPERATURE,
            'scenario': Scenario.RCP45,
            'period': '2021-2050',
            'season': Season.ANNUAL,
            'unit': Unit.DEG_C,
        }
        for county, value in ((cls.county, '1.200'), (cls.kerry, '0.900'), (cls.carlow, '1.600')):
            ClimateProjection.objects.create(**cls.base, county=county, value=Decimal(value))
        for override in (
            {'variable': Variable.PRECIPITATION, 'unit': Unit.MM, 'value': Decimal('950.000')},
            {'scenario': Scenario.RCP85, 'value': Decimal('9.000')},
            {'period': '2071-2100', 'value': Decimal('9.000')},
            {'season': Season.WINTER, 'value': Decimal('9.000')},
        ):
            ClimateProjection.objects.create(**{**cls.base, 'county': cls.county, **override})

    def get(self, **overrides):
        return self.client.get(self.url, {**self.params, **overrides})

    def test_response_shape(self):
        response = self.get()
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(
            response.json(),
            {
                'variable': 'temperature',
                'scenario': 'rcp45',
                'period': '2021-2050',
                'season': 'annual',
                'unit': 'degC',
                'min': '0.900',
                'max': '1.600',
                'results': [
                    {
                        'county': {'name': 'Carlow', 'slug': 'carlow', 'has_coastline': False},
                        'value': '1.600',
                        'unit': 'degC',
                    },
                    {
                        'county': {'name': 'Cork', 'slug': 'cork', 'has_coastline': True},
                        'value': '1.200',
                        'unit': 'degC',
                    },
                    {
                        'county': {'name': 'Kerry', 'slug': 'kerry', 'has_coastline': True},
                        'value': '0.900',
                        'unit': 'degC',
                    },
                ],
            },
        )

    def test_one_row_per_county_sorted_by_name(self):
        names = [row['county']['name'] for row in self.get().json()['results']]
        self.assertEqual(names, ['Carlow', 'Cork', 'Kerry'])

    def test_each_parameter_filters(self):
        cases = (
            ('variable', 'precipitation', '950.000'),
            ('scenario', 'rcp85', '9.000'),
            ('period', '2071-2100', '9.000'),
            ('season', 'winter', '9.000'),
        )
        for field, value, expected in cases:
            with self.subTest(field=field):
                response = self.get(**{field: value})
                self.assertEqual(response.status_code, HTTPStatus.OK)
                data = response.json()
                self.assertEqual(data[field], value)
                self.assertEqual([row['value'] for row in data['results']], [expected])

    def test_valid_combination_without_data(self):
        response = self.get(variable='precipitation', season='winter')
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertEqual(data['results'], [])
        self.assertIsNone(data['unit'])
        self.assertIsNone(data['min'])
        self.assertIsNone(data['max'])

    def test_invalid_value_returns_400_with_allowed_values(self):
        cases = (
            ('variable', 'wind', 'precipitation, temperature'),
            ('scenario', 'rcp60', 'rcp45, rcp85'),
            ('period', '2000-2001', '2021-2050, 2071-2100'),
            ('season', 'monsoon', 'annual, winter'),
        )
        for field, value, allowed in cases:
            with self.subTest(field=field):
                response = self.get(**{field: value})
                self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
                errors = response.json()
                self.assertEqual(list(errors), [field])
                self.assertIn(value, errors[field])
                self.assertIn(allowed, errors[field])

    def test_value_valid_in_enum_but_absent_in_database(self):
        response = self.get(scenario='baseline')
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertIn('scenario', response.json())

    def test_missing_parameters(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertEqual(set(response.json()), {'variable', 'scenario', 'period', 'season'})

    def test_all_errors_reported_together(self):
        response = self.get(variable='wind', season='monsoon')
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertEqual(set(response.json()), {'variable', 'season'})

    def test_num_queries(self):
        with self.assertNumQueries(2):
            self.get()

    def test_cached_response_hits_no_database(self):
        first = self.get().json()
        with self.assertNumQueries(0):
            second = self.get().json()
        self.assertEqual(first, second)

    def test_rejected_request_is_not_cached(self):
        self.assertEqual(self.get(season='spring').status_code, HTTPStatus.BAD_REQUEST)
        ClimateProjection.objects.create(
            **{**self.base, 'season': Season.SPRING}, county=self.county, value=Decimal('5.000')
        )
        response = self.get(season='spring')
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual([row['value'] for row in response.json()['results']], ['5.000'])

    def test_cache_invalidated_when_projection_changes(self):
        self.get()
        ClimateProjection.objects.get(county=self.kerry).delete()
        names = [row['county']['name'] for row in self.get().json()['results']]
        self.assertEqual(names, ['Carlow', 'Cork'])

    def test_method_not_allowed(self):
        initial_count = ClimateProjection.objects.count()
        for method in ('post', 'put', 'patch', 'delete'):
            with self.subTest(method=method):
                response = getattr(self.client, method)(self.url, {})
                self.assertEqual(response.status_code, HTTPStatus.METHOD_NOT_ALLOWED)
                self.assertEqual(ClimateProjection.objects.count(), initial_count)


class MetaViewCacheTestCase(ProjectionTestCase, APITestCase):
    url = reverse('climate:meta')

    def test_cached_response_hits_no_database(self):
        self.client.get(self.url)
        with self.assertNumQueries(0):
            self.client.get(self.url)

    def test_cache_invalidated_when_projection_added(self):
        self.assertEqual(self.client.get(self.url).json()['scenarios'], [])
        self.create_climate_projection(scenario=Scenario.RCP85)
        self.assertEqual(self.client.get(self.url).json()['scenarios'], ['rcp85'])

    def test_cache_invalidated_when_sea_level_added(self):
        self.assertEqual(self.client.get(self.url).json()['sea_level_years'], [])
        self.create_sea_level_projection(year=2100)
        self.assertEqual(self.client.get(self.url).json()['sea_level_years'], [2100])
