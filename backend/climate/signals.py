from django.db.models.signals import post_delete, post_save

from climate.models import ClimateProjection, County, DataSource, SeaLevelProjection
from common.cache import ClimateCacheKey

CACHED_MODELS = (ClimateProjection, SeaLevelProjection, County, DataSource)


def invalidate_climate_cache(sender, **kwargs):
    ClimateCacheKey.bump()


for model in CACHED_MODELS:
    post_save.connect(invalidate_climate_cache, sender=model, dispatch_uid=f'climate-cache-save-{model.__name__}')
    post_delete.connect(invalidate_climate_cache, sender=model, dispatch_uid=f'climate-cache-delete-{model.__name__}')
