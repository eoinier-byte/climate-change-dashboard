import json

from anthropic import beta_tool

from climate.models import County
from climate.serializers import CountyProjectionsSerializer
from common.enums import Season, Variable


@beta_tool
def get_projections(county: str, var: Variable, season: Season = Season.ANNUAL) -> str:
    print('Call get_projections')
    var, season = Variable(var), Season(season)
    try:
        obj = County.objects.get(slug=county)
    except County.DoesNotExist:
        slugs = ', '.join(County.objects.values_list('slug', flat=True))
        return f'Unknown county {county}. Valid slugs: {slugs}'
    data = CountyProjectionsSerializer(obj, context={'variable': var, 'season': season}).data
    return json.dumps(data, default=str)
