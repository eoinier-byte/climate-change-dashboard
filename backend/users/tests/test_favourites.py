from http import HTTPStatus

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from climate.models import County
from users.models import User

PASSWORD = 'Str0ng-pass-123'


class FavouriteCountiesModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)
        cls.cork = County.objects.create(name='Cork')

    def test_same_county_is_stored_once(self):
        self.user.counties.add(self.cork)
        self.user.counties.add(self.cork)
        self.assertEqual(self.user.counties.count(), 1)

    def test_database_refuses_a_duplicate_row(self):
        through = User.counties.through
        through.objects.create(user=self.user, county=self.cork)
        with self.assertRaises(IntegrityError), transaction.atomic():
            through.objects.create(user=self.user, county=self.cork)


class FavouriteCountiesViewTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)
        cls.other = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)
        cls.cork, cls.clare, cls.kerry = (County.objects.create(name=name) for name in ('Cork', 'Clare', 'Kerry'))

    def setUp(self):
        self.client.force_authenticate(self.user)

    list_url = reverse('users:fav_counties-list')

    @staticmethod
    def detail_url(slug):
        return reverse('users:fav_counties-detail', args=[slug])

    def slugs(self, response):
        return sorted(county['slug'] for county in response.json())

    def test_list_is_empty_at_first(self):
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json(), [])

    def test_list_shows_the_users_counties(self):
        self.user.counties.add(self.cork, self.kerry)
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(self.slugs(response), ['cork', 'kerry'])
        self.assertEqual(set(response.json()[0]), {'name', 'slug', 'has_coastline'})

    def test_add(self):
        response = self.client.post(self.list_url, {'county': 'cork'}, format='json')
        self.assertEqual(response.status_code, HTTPStatus.CREATED)
        self.assertEqual(response.json()['slug'], 'cork')
        self.assertEqual(list(self.user.counties.values_list('slug', flat=True)), ['cork'])

    def test_add_twice_is_not_an_error(self):
        self.client.post(self.list_url, {'county': 'cork'}, format='json')
        response = self.client.post(self.list_url, {'county': 'cork'}, format='json')
        self.assertEqual(response.status_code, HTTPStatus.CREATED)
        self.assertEqual(self.user.counties.count(), 1)

    def test_add_is_not_case_sensitive(self):
        response = self.client.post(self.list_url, {'county': 'Cork'}, format='json')
        self.assertEqual(response.status_code, HTTPStatus.CREATED)
        self.assertEqual(list(self.user.counties.values_list('slug', flat=True)), ['cork'])

    def test_add_unknown_county_is_404(self):
        response = self.client.post(self.list_url, {'county': 'atlantis'}, format='json')
        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
        self.assertEqual(self.user.counties.count(), 0)

    def test_add_without_a_county_is_400(self):
        for body in ({}, {'county': ''}):
            with self.subTest(body=body):
                response = self.client.post(self.list_url, body, format='json')
                self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
                self.assertIn('county', response.json())
        self.assertEqual(self.user.counties.count(), 0)

    def test_remove(self):
        self.user.counties.add(self.cork, self.clare)
        response = self.client.delete(self.detail_url('cork'))
        self.assertEqual(response.status_code, HTTPStatus.NO_CONTENT)
        self.assertEqual(list(self.user.counties.values_list('slug', flat=True)), ['clare'])

    def test_remove_a_county_that_is_not_a_favourite(self):
        response = self.client.delete(self.detail_url('kerry'))
        self.assertEqual(response.status_code, HTTPStatus.NO_CONTENT)

    def test_remove_unknown_county_is_404(self):
        response = self.client.delete(self.detail_url('atlantis'))
        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)

    def test_users_only_see_and_change_their_own(self):
        self.other.counties.add(self.clare)
        self.assertEqual(self.slugs(self.client.get(self.list_url)), [])

        self.client.delete(self.detail_url('clare'))
        self.assertEqual(list(self.other.counties.values_list('slug', flat=True)), ['clare'])

    def test_signed_out_is_403(self):
        client = APIClient()
        requests = {
            'list': lambda: client.get(self.list_url),
            'add': lambda: client.post(self.list_url, {'county': 'cork'}, format='json'),
            'remove': lambda: client.delete(self.detail_url('cork')),
        }
        for name, send in requests.items():
            with self.subTest(name):
                self.assertEqual(send().status_code, HTTPStatus.FORBIDDEN)

    def test_methods_not_allowed(self):
        self.assertEqual(self.client.get(self.detail_url('cork')).status_code, HTTPStatus.METHOD_NOT_ALLOWED)
        self.assertEqual(self.client.put(self.detail_url('cork'), {}).status_code, HTTPStatus.METHOD_NOT_ALLOWED)
