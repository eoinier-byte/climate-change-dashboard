from django.apps import AppConfig


class ClimateConfig(AppConfig):
    name = 'climate'

    def ready(self):
        from climate import signals  # noqa: F401  (registers cache invalidation receivers)
