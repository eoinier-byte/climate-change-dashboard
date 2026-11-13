from django.conf import settings
from django.core.cache import cache


class BaseCacheKey:
    _VERSION: str
    _DOMAIN: str
    TIMEOUT = 60 if settings.DEBUG else 60 * 60

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        for attr in ('_VERSION', '_DOMAIN'):
            if not isinstance(getattr(cls, attr, None), str):
                raise TypeError(f'{cls.__name__} must define {attr} as a string')

    @classmethod
    def _data_version_key(cls) -> str:
        return f'{cls._DOMAIN}:data-version'

    @classmethod
    def data_version(cls) -> int:
        return cache.get_or_set(cls._data_version_key(), 1, timeout=None)

    @classmethod
    def bump(cls) -> None:
        try:
            cache.incr(cls._data_version_key())
        except ValueError:
            cache.set(cls._data_version_key(), 2, timeout=None)

    @classmethod
    def _build(cls, *parts) -> str:
        return ':'.join([cls._VERSION, f'd{cls.data_version()}', cls._DOMAIN, *map(str, parts)])


class ClimateCacheKey(BaseCacheKey):
    _VERSION = 'v1'
    _DOMAIN = 'climate'

    @classmethod
    def meta(cls) -> str:
        return cls._build('meta')

    @classmethod
    def groups(cls) -> str:
        return cls._build('groups')

    @classmethod
    def map(cls, variable: str | None, scenario: str | None, season: str | None, period: str | None) -> str:
        return cls._build('map', variable, scenario, season, period)
