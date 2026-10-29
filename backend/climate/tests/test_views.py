from http import HTTPStatus

from django.shortcuts import reverse
from rest_framework.test import APITestCase

from climate.models import County


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

    def test_detail(self):
        response = self.client.get(reverse('climate:county-detail', args=[self.county.id]))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json()['id'], self.county.id)
        self.assertEqual(response.json()['name'], 'Cork')

    def test_detail_unknown_id(self):
        response = self.client.get(reverse('climate:county-detail', args=[999999]))
        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
        self.assertIn('detail', response.json())

    def test_method_not_allowed(self):
        cases = (
            ('climate:county-list', [], ('post', 'put', 'patch', 'delete')),
            ('climate:county-detail', [self.county.id], ('put', 'patch', 'delete')),
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
