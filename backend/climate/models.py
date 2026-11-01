from django.db import models
from django.utils.text import slugify

from common.models import BaseProjection, Variable
from common.validators import validate_period

# Create your models here.


class County(models.Model):
    name = models.CharField(max_length=50, unique=True)
    slug = models.SlugField(unique=True)
    has_coastline = models.BooleanField(default=False)

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class DataSource(models.Model):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=200)
    organisation = models.CharField(max_length=200, blank=True)
    baseline_period = models.CharField(max_length=9, validators=[validate_period])
    licence = models.CharField(max_length=200, blank=True)
    attribution = models.TextField(blank=True)
    url = models.URLField(max_length=500)
    accessed_on = models.DateField()

    def __str__(self):
        return self.name


class ClimateProjection(BaseProjection):
    variable = models.CharField(max_length=20, choices=Variable)
    period = models.CharField(max_length=9, validators=[validate_period])
    value = models.DecimalField(max_digits=8, decimal_places=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['county', 'variable', 'scenario', 'period', 'season'],
                name='uniq_climate_projection',
            ),
        ]


class SeaLevelProjection(BaseProjection):
    year = models.PositiveSmallIntegerField()
    provenance = models.CharField(max_length=50)
    value = models.DecimalField(max_digits=6, decimal_places=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['county', 'scenario', 'year'],
                name='uniq_sea_level_projection',
            ),
        ]