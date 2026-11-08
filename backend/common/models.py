from django.db import models

from common.enums import Scenario, Season, Unit


class BaseProjection(models.Model):
    county = models.ForeignKey('County', on_delete=models.PROTECT, related_name='%(class)ss')
    data_source = models.ForeignKey('DataSource', on_delete=models.PROTECT, related_name='%(class)ss')
    scenario = models.CharField(max_length=10, choices=Scenario)
    season = models.CharField(max_length=10, choices=Season)
    unit = models.CharField(max_length=10, choices=Unit)

    def __str__(self):
        return f'{self.county}-{self.scenario}-{self.season}'

    class Meta:
        abstract = True
