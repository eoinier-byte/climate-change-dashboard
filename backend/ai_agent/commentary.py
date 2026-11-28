import json

from django.conf import settings
from pydantic import BaseModel, ConfigDict, Field

from ai_agent.utils import get_client
from climate.models import County, DataSource
from climate.serializers import ClimateSeriesSerializer, CountyAnalogueSerializer, SeaLevelSeriesSerializer
from common.enums import Scenario, Season, Variable

UNAVAILABLE = 'The north wind has gone chasing Orithyia across the sky. The summary will be back when he returns.'
RULES = (
    '<role>\n'
    'You write the short climate summary shown at the top of a county page on the Climate Futures '
    'Dashboard, a website showing how the climate of each Irish county is projected to change. The '
    'readers are members of the public, rarely scientists. The page labels your text as an AI-generated '
    'summary.\n'
    '</role>\n\n'
    '<data>\n'
    'The user message holds the county data as JSON: temperature and precipitation for the baseline and '
    'every emissions future and period, by season, with the change from the baseline; the climate '
    'analogues; and sea-level rise when the county has a coastline. It also names the emissions future '
    'to write about.\n'
    '</data>\n\n'
    '<numbers>\n'
    'People may act on what you write, and every figure must trace back to this data. Use only numbers '
    'that appear in it, with their units. Never add numbers or facts from your own knowledge, even when '
    'you feel sure. Do not calculate new numbers such as differences, sums or averages: to compare two '
    'values, give both. Rounding to one decimal place is fine.\n\n'
    'Temperature change is in °C and precipitation change in %. Sea-level rise is in cm.\n'
    '</numbers>\n\n'
    '<style>\n'
    'Write plain English in short sentences and everyday words, one or two sentences per field. No '
    'Markdown, lists or headings.\n\n'
    'Call RCP2.6, RCP4.5 and RCP8.5 the low, medium and high emissions futures. Describe 2021-2050 as '
    '"around mid-century", 2071-2100 as "by the end of the century" and the baseline as "the late 20th '
    'century".\n\n'
    'These are projections, not forecasts: say "projected", never "will be" as a certainty. Give the '
    'numbers as they are, neither softening nor dramatising them.\n'
    '</style>\n\n'
    '<fields>\n'
    'Write about the chosen emissions future unless a field says otherwise.\n'
    '- summary: the main change for the county in one or two sentences.\n'
    '- temperature: the annual change by the end of the century and the season that warms the most.\n'
    '- precipitation: the annual change by the end of the century and the season with the biggest change.\n'
    '- scenarios: how the end-of-century annual temperature change under the chosen future compares with '
    'the low and high emissions futures.\n'
    "- analogue: the European city ranked closest (rank 1) whose present climate matches the county's "
    'projected climate by the end of the century.\n'
    '- sea_level: sea-level rise by the end of the century; null when the data has no sea level.\n'
    'If the data does not cover a field, say so plainly instead of guessing.\n'
    '</fields>'
)
RETRY_TIMEOUT = 20.0
RETRIES = 1


class Commentary(BaseModel):
    model_config = ConfigDict(extra='forbid')

    summary: str = Field(description='The main change for the county, one or two sentences.')
    temperature: str = Field(description='Annual temperature change and the season that warms the most.')
    precipitation: str = Field(description='Annual precipitation change and the season with the biggest change.')
    scenarios: str = Field(description='The chosen emissions future compared with the low and high ones.')
    analogue: str = Field(description="The closest European city to the county's end-of-century climate.")
    sea_level: str | None = Field(description='Sea-level rise by the end of the century, or null for an inland county.')


def build_payload(county_slug: str, scenario: Scenario) -> dict:
    county = County.objects.prefetch_related('climateprojections__data_source').get(slug=county_slug.lower())
    translate = DataSource.objects.filter(code='translate').first()
    analogues = (
        county.analogues.filter(scenario=scenario).select_related('city__data_source').order_by('period', 'rank')
    )
    return {
        'county': county.name,
        'scenario': scenario,
        'climate': {
            variable: {
                season: ClimateSeriesSerializer(county, context={'variable': variable, 'season': season}).data
                for season in Season
            }
            for variable in Variable
        },
        'sea_level': SeaLevelSeriesSerializer(county).data if county.has_coastline else None,
        'analogues': CountyAnalogueSerializer(
            analogues, many=True, context={'change_baseline_period': translate.baseline_period if translate else None}
        ).data,
    }


def build_prompt(payload: dict) -> list[dict]:
    data = json.dumps(payload, ensure_ascii=False, default=str)
    scenario = Scenario(payload['scenario']).label
    return [
        {
            'role': 'user',
            'content': (
                f'<county_data>\n{data}\n</county_data>\n\n'
                f'Write the summary for {payload["county"]} under the {scenario} emissions future.'
            ),
        }
    ]


def generate_commentary(slug: str, scenario: Scenario) -> Commentary | None:
    payload = build_payload(slug, scenario)
    response = (
        get_client()
        .with_options(timeout=RETRY_TIMEOUT, max_retries=RETRIES)
        .messages.parse(
            model=settings.ASSISTANT_MODEL,
            max_tokens=settings.ASSISTANT_TOKENS,
            system=RULES,
            messages=build_prompt(payload),
            output_format=Commentary,
            output_config={'effort': 'low'},
        )
    )
    if response.stop_reason != 'end_turn':
        return None
    return response.parsed_output
