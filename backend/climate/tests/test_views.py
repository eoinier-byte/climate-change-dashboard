from decimal import Decimal
from http import HTTPStatus

from django.shortcuts import reverse
from rest_framework.test import APITestCase

from climate.models import County, SeaLevelProjection
from climate.tests.base import ProjectionTestCase
from common.models import Scenario, Season, Unit, Variable


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
