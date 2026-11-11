import django_filters

from climate.models import ClimateProjection, County
from common.enums import Scenario, Season, Variable
from common.utils import distinct


class ClimateProjectionFilterSet(django_filters.FilterSet):
    county = django_filters.ModelChoiceFilter(field_name='county', to_field_name='slug', queryset=County.objects.all())
    period = django_filters.ChoiceFilter(choices=[(period, period) for period in distinct('period', ClimateProjection)])
    scenario = django_filters.ChoiceFilter(choices=Scenario)
    season = django_filters.ChoiceFilter(choices=Season)
    variable = django_filters.ChoiceFilter(choices=Variable)

    class Meta:
        model = ClimateProjection
        fields = ['scenario', 'period', 'season', 'variable', 'county']
