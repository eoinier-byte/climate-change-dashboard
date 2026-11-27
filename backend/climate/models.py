from django.contrib.postgres.aggregates import ArrayAgg
from django.db import models
from django.db.models import OuterRef, QuerySet, Subquery, Value
from django.utils.text import slugify

from common.enums import Indicator, Scenario, Variable
from common.models import BaseProjection
from common.validators import validate_period

# Create your models here.


class ClimateProjectionQuerySet(models.query.QuerySet):
    def county_rows(self, slug: str, variable: str, season: str) -> 'QuerySet[ClimateProjection]':
        return (
            self.select_related('county', 'data_source')
            .filter(county__slug=slug, variable=variable, season=season)
            .order_by('scenario', 'period')
        )

    def aggregate_groups(
        self, scenarios: bool = True, periods: bool = True, seasons: bool = True, variables: bool = True
    ) -> dict[str, list[str]]:
        params = {}
        if scenarios:
            params['scenarios'] = ArrayAgg('scenario', distinct=True, order_by='scenario', default=Value([]))
        if periods:
            params['periods'] = ArrayAgg('period', distinct=True, order_by='period', default=Value([]))
        if seasons:
            params['seasons'] = ArrayAgg('season', distinct=True, order_by='season', default=Value([]))
        if variables:
            params['variables'] = ArrayAgg('variable', distinct=True, order_by='variable', default=Value([]))

        return self.aggregate(**params)

    def with_baseline_value(self):
        baseline = ClimateProjection.objects.filter(
            county=OuterRef('county'),
            variable=OuterRef('variable'),
            season=OuterRef('season'),
            scenario=Scenario.BASELINE,
        ).values('value')[:1]
        return self.annotate(baseline_value=Subquery(baseline))


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

    objects = ClimateProjectionQuerySet.as_manager()

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


class CityClimate(models.Model):
    """A European city's present-day climate (WorldClim 2.1, 1970-2000), for the climate analogues."""

    name = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    latitude = models.DecimalField(max_digits=6, decimal_places=3)
    longitude = models.DecimalField(max_digits=6, decimal_places=3)
    summer_temp = models.DecimalField(max_digits=6, decimal_places=3)  # mean of June-August, degC
    winter_temp = models.DecimalField(max_digits=6, decimal_places=3)  # mean of December-February, degC
    annual_precip = models.DecimalField(max_digits=8, decimal_places=3)  # total of 12 months, mm
    data_source = models.ForeignKey('DataSource', on_delete=models.PROTECT, related_name='cities')

    class Meta:
        verbose_name_plural = 'city climates'
        constraints = [
            models.UniqueConstraint(fields=['name', 'country'], name='uniq_city_climate'),
        ]

    def __str__(self):
        return f'{self.name}, {self.country}'


class CountyAnalogue(models.Model):
    """One of the closest cities to a county's projected climate for a scenario and period (rank 1 = closest)."""

    county = models.ForeignKey('County', on_delete=models.PROTECT, related_name='analogues')
    city = models.ForeignKey(CityClimate, on_delete=models.PROTECT, related_name='analogues')
    scenario = models.CharField(max_length=10, choices=Scenario)
    period = models.CharField(max_length=9, validators=[validate_period])
    rank = models.PositiveSmallIntegerField()
    similarity = models.DecimalField(max_digits=4, decimal_places=3)  # 1 / (1 + distance), 0 to 1
    # The county's projected climate the cities were compared with (WorldClim + modelled change)
    county_summer_temp = models.DecimalField(max_digits=6, decimal_places=3)
    county_winter_temp = models.DecimalField(max_digits=6, decimal_places=3)
    county_annual_precip = models.DecimalField(max_digits=8, decimal_places=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['county', 'scenario', 'period', 'rank'], name='uniq_county_analogue'),
            # A city can appear only once in a county's list for one scenario and period
            models.UniqueConstraint(fields=['county', 'scenario', 'period', 'city'], name='uniq_county_analogue_city'),
            # The baseline is the present, not a projection, so it has no analogue
            models.CheckConstraint(condition=~models.Q(scenario=Scenario.BASELINE), name='analogue_not_baseline'),
            models.CheckConstraint(condition=models.Q(rank__gte=1), name='analogue_rank_from_1'),
        ]

    def __str__(self):
        return f'{self.county}-{self.scenario}-{self.period}-{self.rank}: {self.city}'


class ImpactIndicator(BaseProjection):
    indicator = models.CharField(max_length=30, choices=Indicator)
    period = models.CharField(max_length=9, validators=[validate_period])
    value = models.DecimalField(max_digits=8, decimal_places=3)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['county', 'indicator', 'scenario', 'period'],
                name='uniq_impact_indicator',
            ),
        ]
