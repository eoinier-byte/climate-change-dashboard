from django.core.cache import cache
from django.test import SimpleTestCase

from common.cache import BaseCacheKey, ClimateCacheKey


class ClimateCacheKeyTestCase(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_key_format(self):
        self.assertEqual(ClimateCacheKey.meta(), 'v1:d1:climate:meta')
        self.assertEqual(ClimateCacheKey.groups(), 'v1:d1:climate:groups')
        self.assertEqual(
            ClimateCacheKey.map('temperature', 'rcp45', 'annual', '2021-2050'),
            'v1:d1:climate:map:temperature:rcp45:annual:2021-2050',
        )

    def test_map_key_distinguishes_parameters(self):
        self.assertNotEqual(
            ClimateCacheKey.map('temperature', 'rcp45', 'annual', '2021-2050'),
            ClimateCacheKey.map('temperature', 'rcp85', 'annual', '2021-2050'),
        )

    def test_bump_changes_every_key(self):
        before = (ClimateCacheKey.meta(), ClimateCacheKey.map('t', 's', 'a', 'p'))
        ClimateCacheKey.bump()
        after = (ClimateCacheKey.meta(), ClimateCacheKey.map('t', 's', 'a', 'p'))
        self.assertEqual(ClimateCacheKey.data_version(), 2)
        for old, new in zip(before, after):
            with self.subTest(key=old):
                self.assertNotEqual(old, new)
                self.assertIn(':d2:', new)

    def test_bump_without_existing_version(self):
        ClimateCacheKey.bump()
        self.assertEqual(ClimateCacheKey.data_version(), 2)

    def test_bump_is_monotonic(self):
        for _ in range(3):
            ClimateCacheKey.bump()
        self.assertEqual(ClimateCacheKey.data_version(), 4)

    def test_subclass_must_define_version_and_domain(self):
        for attrs in ({}, {'_VERSION': 'v1'}, {'_DOMAIN': 'x'}):
            with self.subTest(attrs=attrs), self.assertRaises(TypeError):
                type('BrokenKey', (BaseCacheKey,), attrs)
