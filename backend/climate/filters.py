import django_filters

from climate.models import ClimateProjection, County, CountyAnalogue, ImpactIndicator
from common.enums import Scenario, Season, Variable
from common.utils import get_period_choices


class ClimateProjectionFilterSet(django_filters.FilterSet):
    county = django_filters.ModelChoiceFilter(field_name='county', to_field_name='slug', queryset=County.objects.all())
    period = django_filters.ChoiceFilter(choices=lambda: get_period_choices(ClimateProjection))
    scenario = django_filters.ChoiceFilter(choices=Scenario)
    season = django_filters.ChoiceFilter(choices=Season)
    variable = django_filters.ChoiceFilter(choices=Variable)

    class Meta:
        model = ClimateProjection
        fields = ['scenario', 'period', 'season', 'variable', 'county']


class ImpactIndicatorFilterSet(django_filters.FilterSet):
    scenario = django_filters.ChoiceFilter(choices=Scenario)
    period = django_filters.ChoiceFilter(choices=lambda: get_period_choices(ImpactIndicator))

    class Meta:
        model = ImpactIndicator
        fields = ['scenario', 'period']


# The analogues exist only for projections: the baseline is the present, so it is not a valid choice (CCD-358).
ANALOGUE_SCENARIOS = [(s.value, s.label) for s in Scenario if s != Scenario.BASELINE]
ANALOGUE_PERIODS = [('2021-2050', '2021-2050'), ('2071-2100', '2071-2100')]


class CountyAnalogueFilterSet(django_filters.FilterSet):
    scenario = django_filters.ChoiceFilter(choices=ANALOGUE_SCENARIOS, required=True)
    period = django_filters.ChoiceFilter(choices=ANALOGUE_PERIODS, required=True)

    class Meta:
        model = CountyAnalogue
        fields = ['scenario', 'period']
