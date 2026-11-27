import json
import tempfile
from http import HTTPStatus
from pathlib import Path

from django.shortcuts import reverse
from django.test import SimpleTestCase, override_settings
from drf_spectacular.generators import SchemaGenerator
from rest_framework.test import APITestCase

from climate.flood import flood_region, flood_regions
from climate.models import County

INDEX = {
    'slug': 'cork',
    'bounds': [[51.4, -10.2], [52.4, -7.8]],
    'cell_size_m': 90.0,
    'levels': [
        {'level_m': 0.0, 'file': 'level_000.png', 'flooded_cells': 10, 'flooded_area_km2': 0.081},
        {'level_m': 0.1, 'file': 'level_010.png', 'flooded_cells': 12, 'flooded_area_km2': 0.0972},
    ],
    'attribution': 'Copernicus DEM',
    'model_limits': 'Indicative only.',
}


class FakeFloodDirMixin:
    def setUp(self):
        super().setUp()
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.flood_dir = Path(folder.name)
        self.write_region('cork', INDEX)
        (self.flood_dir / 'no_index').mkdir()
        settings = override_settings(FLOOD_DIR=self.flood_dir)
        settings.enable()
        self.addCleanup(settings.disable)

    def write_region(self, slug, index):
        region = self.flood_dir / slug
        region.mkdir()
        (region / 'index.json').write_text(json.dumps(index), encoding='utf-8')
        for level in index['levels']:
            (region / level['file']).write_bytes(b'\x89PNG')


class FloodFilesTestCase(FakeFloodDirMixin, SimpleTestCase):
    def test_regions_are_folders_with_an_index(self):
        self.write_region('clare', {**INDEX, 'slug': 'clare'})
        self.assertEqual(flood_regions(), ['clare', 'cork'])

    def test_region_reads_its_index(self):
        self.assertEqual(flood_region('cork'), INDEX)

    def test_unknown_region_is_none(self):
        self.assertIsNone(flood_region('offaly'))
        self.assertIsNone(flood_region('no_index'))


class FloodViewSetTestCase(FakeFloodDirMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        for name, coastal in [('Cork', True), ('Clare', True), ('Offaly', False)]:
            County.objects.create(name=name, has_coastline=coastal)

    def test_list_has_only_counties_with_a_flood_map(self):
        response = self.client.get(reverse('climate:flood-list'))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual([county['slug'] for county in response.json()], ['cork'])
        self.assertEqual(response.json()[0]['name'], 'Cork')

    def test_list_skips_folders_without_a_county(self):
        self.write_region('atlantis', {**INDEX, 'slug': 'atlantis'})
        response = self.client.get(reverse('climate:flood-list'))
        self.assertEqual([county['slug'] for county in response.json()], ['cork'])

    def test_list_is_sorted_by_name(self):
        self.write_region('clare', {**INDEX, 'slug': 'clare'})
        response = self.client.get(reverse('climate:flood-list'))
        self.assertEqual([county['name'] for county in response.json()], ['Clare', 'Cork'])

    def test_detail(self):
        response = self.client.get(reverse('climate:flood-detail', args=['cork']))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        data = response.json()
        self.assertEqual(data['slug'], 'cork')
        self.assertEqual(data['bounds'], INDEX['bounds'])
        self.assertEqual(data['cell_size_m'], 90.0)
        self.assertEqual(data['attribution'], 'Copernicus DEM')
        self.assertEqual(data['model_limits'], 'Indicative only.')
        self.assertEqual(
            data['levels'][1],
            {
                'level_m': 0.1,
                'url': 'http://testserver/static/flood/cork/level_010.png',
                'flooded_cells': 12,
                'flooded_area_km2': 0.0972,
            },
        )

    def test_detail_does_not_expose_file_names(self):
        response = self.client.get(reverse('climate:flood-detail', args=['cork']))
        self.assertNotIn('file', response.json()['levels'][0])

    def test_detail_slug_is_case_insensitive(self):
        response = self.client.get(reverse('climate:flood-detail', args=['CORK']))
        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json()['levels'][0]['url'], 'http://testserver/static/flood/cork/level_000.png')

    def test_unknown_region_is_404(self):
        for slug in ['atlantis', 'offaly', 'no_index']:
            with self.subTest(slug):
                response = self.client.get(reverse('climate:flood-detail', args=[slug]))
                self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
                self.assertEqual(response.json()['detail'], 'There is no flood map for this county.')

    def test_post_not_allowed(self):
        response = self.client.post(reverse('climate:flood-list'))
        self.assertEqual(response.status_code, HTTPStatus.METHOD_NOT_ALLOWED)

    def test_in_the_swagger_schema(self):
        schema = SchemaGenerator().get_schema(request=None, public=True)
        self.assertIn('get', schema['paths']['/api/flood/'])
        detail = schema['paths']['/api/flood/{slug}/']['get']
        self.assertEqual(set(detail['responses']), {'200', '404'})
