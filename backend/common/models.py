from django.db import models


class Variable(models.TextChoices):
    TEMPERATURE = 'temperature', 'Temperature'
    PRECIPITATION = 'precipitation', 'Precipitation'


class Season(models.TextChoices):
    ANNUAL = 'annual', 'Annual'
    WINTER = 'winter', 'Winter'
    SPRING = 'spring', 'Spring'
    SUMMER = 'summer', 'Summer'
    AUTUMN = 'autumn', 'Autumn'


class Scenario(models.TextChoices):
    BASELINE = 'baseline', 'Baseline'
    RCP26 = 'rcp26', 'RCP2.6'
    RCP45 = 'rcp45', 'RCP4.5'
    RCP85 = 'rcp85', 'RCP8.5'


class Unit(models.TextChoices):
    DEG_C = 'degC', '°C'
    MM = 'mm', 'mm'
    CM = 'cm', 'cm'


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