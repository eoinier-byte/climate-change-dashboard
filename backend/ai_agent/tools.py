import json

from anthropic import beta_tool

from ai_agent.serializers import RankSerializer
from climate.models import ClimateProjection, County
from climate.serializers import ClimateSeriesSerializer, SeaLevelSeriesSerializer
from common.enums import Scenario, Season, Unit, Variable
from common.utils import get_change_unit

MAP_FIELDS = ('variable', 'season', 'scenario', 'period')


def find_county(county: str) -> tuple[County | str, bool]:
    try:
        return County.objects.get(slug__iexact=county), True
    except County.DoesNotExist:
        slugs = ', '.join(County.objects.values_list('slug', flat=True))
        return f'Unknown county {county}. Valid slugs: {slugs}', False


@beta_tool(
    description=(
        'Temperature or precipitation projections for one Irish county. Returns the 1976-2005 baseline '
        'and values for 2021-2050 and 2071-2100 under RCP2.6, RCP4.5 and RCP8.5, with the change from '
        'the baseline (in °C for temperature, in % for precipitation), units and data source. '
        'Use it for any question about how temperature or rainfall will change in a county. '
        'county is the county name, for example "Cork" or "dun-laoghaire-rathdown".'
    )
)
def get_projections(county: str, variable: Variable, season: Season = Season.ANNUAL) -> str:
    obj, found = find_county(county)
    if not found:
        return str(obj)

    data = ClimateSeriesSerializer(obj, context={'variable': variable, 'season': season}).data
    return json.dumps(data, default=str)


@beta_tool(
    description=(
        'Projected sea level rise for one Irish county, in cm relative to 1981-2000, for 2020-2100 '
        'under RCP2.6, RCP4.5 and RCP8.5. Values are the rise itself, not the absolute sea level. '
        'provenance says where the values come from; "estimated from <county>" means the county has '
        'no own data and a neighbouring county was used, so say this in the answer. '
        'Inland counties have has_coastline false and no series: say that sea level does not apply.'
    )
)
def get_sea_level(county: str) -> str:
    obj, found = find_county(county)
    if not found:
        return str(obj)

    data = SeaLevelSeriesSerializer(obj).data
    return json.dumps(data, default=str)


@beta_tool(
    description=(
        'Ranks Irish counties by projected change from the 1976-2005 baseline for one variable, '
        'season, scenario and period. Use it for questions that compare counties, such as which county '
        'will warm the most or get drier. Each result has the baseline, the projected value and the change '
        '(in °C for temperature, in % for precipitation). '
        'period is "2021-2050" (mid-century) or "2071-2100" (end of century). '
        'asc false puts the largest increase first, asc true the smallest increase or largest decrease first. '
        'limit is how many counties to return.'
    )
)
def rank_counties(
    variable: Variable, season: Season, scenario: Scenario, period: str, limit: int = -1, asc: bool = True
) -> str:
    queryset = (
        ClimateProjection.objects.with_baseline_value()
        .filter(variable=variable, scenario=scenario, season=season, period=period)
        .select_related('county', 'data_source')
    )

    if not queryset:
        periods = ClimateProjection.objects.exclude(scenario=Scenario.BASELINE).aggregate_groups(
            scenarios=False, seasons=False, variables=False
        )['periods']
        return f'No projections for period {period}. Valid periods: {", ".join(periods)}'

    sample = queryset[0]

    payload = {
        'variable': variable,
        'season': season,
        'scenario': scenario,
        'period': period,
        'unit': Unit(sample.unit).label,
        'change_unit': get_change_unit(variable, sample.unit),
        'baseline_period': sample.data_source.baseline_period,
        'source': sample.data_source.name,
        'results': queryset,
    }

    data = RankSerializer(payload, context={'limit': limit, 'asc': asc}).data
    return json.dumps(data, default=str)


@beta_tool(
    description=(
        'Offers the person a "Show on map" button that switches the dashboard map to the view your answer '
        'is about: the variable, season, emissions future and period you describe. It returns no data. '
        'Call it at most once per answer, only for answers about temperature or rainfall projections.'
    )
)
def show_on_map(variable: Variable, season: Season, scenario: str, period: str) -> str:
    error = map_view_error({'variable': variable, 'season': season, 'scenario': scenario, 'period': period})
    return error or 'The button is shown under your answer. Do not mention it.'


def map_view_error(view: dict) -> str | None:
    projections = ClimateProjection.objects.exclude(scenario=Scenario.BASELINE)
    if projections.filter(**{field: view.get(field) for field in MAP_FIELDS}).exists():
        return None
    groups = projections.aggregate_groups()
    return (
        f'The map has no view for {", ".join(str(view.get(field)) for field in MAP_FIELDS)}. '
        f'Valid scenarios: {", ".join(groups["scenarios"])}. Valid periods: {", ".join(groups["periods"])}.'
    )
