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


class SeaLevelViewSetTestCase(ProjectionTestCase, APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        kerry = County.objects.create(name='Kerry', has_coastline=True)
        cls.projections = [
            SeaLevelProjection.objects.create(
                county=county,
                data_source=cls.ukcp18,
                scenario=scenario,
                year=year,
                season=Season.ANNUAL,
                value=Decimal('10.000'),
                unit=Unit.CM,
                provenance='UKCP18',
            )
            for county, scenario, year in (
                (kerry, Scenario.RCP26, 2050),
                (cls.county, Scenario.RCP85, 2100),
                (cls.county, Scenario.RCP26, 2100),
                (cls.county, Scenario.RCP26, 2050),
            )
        ]
        cls.projection = cls.projections[0]

    def test_list(self):
        response = self.client.get(reverse('climate:sea_level-list'))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        rows = [(p['county'], p['scenario'], p['year']) for p in response.json()]
        self.assertEqual(
            rows,
            [
                ('cork', 'rcp26', 2050),
                ('cork', 'rcp26', 2100),
                ('cork', 'rcp85', 2100),
                ('kerry', 'rcp26', 2050),
            ],
        )

    def test_list_fields(self):
        response = self.client.get(reverse('climate:sea_level-list'))
        self.assertEqual(
            response.json()[0],
            {
                'scenario': 'rcp26',
                'baseline': '1981-2000',
                'units': 'cm',
                'source': 'ukcp18',
                'county': 'cork',
                'year': 2050,
                'provenance': 'UKCP18',
                'value': '10.000',
            },
        )

    def test_detail(self):
        response = self.client.get(reverse('climate:sea_level-detail', args=[self.projection.id]))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json()['county'], 'kerry')
        self.assertEqual(response.json()['year'], 2050)

    def test_detail_unknown_id(self):
        response = self.client.get(reverse('climate:sea_level-detail', args=[999999]))
        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
        self.assertIn('detail', response.json())

    def test_method_not_allowed(self):
        cases = (
            ('climate:sea_level-list', [], ('post', 'put', 'patch', 'delete')),
            ('climate:sea_level-detail', [self.projection.id], ('put', 'patch', 'delete')),
        )
        initial_count = SeaLevelProjection.objects.count()

        for url_name, args, methods in cases:
            url = reverse(url_name, args=args)
            for method in methods:
                with self.subTest(url=url_name, method=method):
                    response = getattr(self.client, method)(url, {'year': 1999})
                    self.assertEqual(response.status_code, HTTPStatus.METHOD_NOT_ALLOWED)
                    self.assertEqual(SeaLevelProjection.objects.count(), initial_count)
                    self.assertEqual(SeaLevelProjection.objects.get(id=self.projection.id).year, 2050)


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
