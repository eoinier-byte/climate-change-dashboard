import json
import re
from decimal import Decimal
from http import HTTPStatus
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import anthropic
import httpx2
from django.core.cache import cache
from django.shortcuts import reverse
from rest_framework.test import APIClient

from ai_agent.commentary import RULES, UNAVAILABLE, Commentary, build_payload, build_prompt
from climate.models import County
from climate.tests.base import AnalogueTestCase
from common.cache import AgentCacheKey
from common.enums import Scenario, Season, Variable

COMMENTARY = Commentary(
    summary='Cork is projected to get warmer.',
    temperature='About 1.5 °C warmer by the end of the century.',
    precipitation='About 5.2% wetter.',
    scenarios='Between 0.7 °C and 2.7 °C.',
    analogue='Like Brest today.',
    sea_level='About 52.7 cm higher.',
)


class BuildPayloadTests(AnalogueTestCase):
    def setUp(self):
        super().setUp()
        self.create_climate_projection(scenario=Scenario.BASELINE, period='1976-2005', value=Decimal('5.000'))
        self.create_climate_projection()
        self.create_sea_level_projection()

    def test_climate_has_every_variable_and_season(self):
        climate = build_payload('cork', Scenario.RCP45)['climate']

        self.assertEqual(set(climate), set(Variable))
        self.assertEqual(set(climate[Variable.TEMPERATURE]), set(Season))

    def test_climate_values_match_the_projections(self):
        winter = build_payload('cork', Scenario.RCP45)['climate'][Variable.TEMPERATURE][Season.WINTER]

        self.assertEqual(winter['baseline'], Decimal('5.000'))
        self.assertEqual(winter['scenarios'][Scenario.RCP45]['values'], [Decimal('5.000'), Decimal('6.123')])

    def test_analogues_are_only_for_the_chosen_scenario(self):
        self.create_analogue()
        self.create_analogue(scenario=Scenario.RCP85)

        analogues = build_payload('cork', Scenario.RCP45)['analogues']

        self.assertEqual([a['scenario'] for a in analogues], [Scenario.RCP45])
        self.assertEqual(analogues[0]['city'], 'Brest')

    def test_coastal_county_has_sea_level(self):
        sea_level = build_payload('cork', Scenario.RCP45)['sea_level']

        self.assertEqual(sea_level['years'], [2050])

    def test_inland_county_has_no_sea_level(self):
        County.objects.create(name='Offaly', has_coastline=False)

        self.assertIsNone(build_payload('offaly', Scenario.RCP45)['sea_level'])


class BuildPromptTests(AnalogueTestCase):
    def test_prompt_holds_the_data_and_names_the_scenario(self):
        self.create_climate_projection()
        payload = build_payload('cork', Scenario.RCP85)

        [message] = build_prompt(payload)
        data = re.search(r'<county_data>\n(.*)\n</county_data>', message['content'], re.S).group(1)

        self.assertEqual(message['role'], 'user')
        self.assertEqual(json.loads(data)['county'], 'Cork')
        self.assertIn('Cork under the RCP8.5 emissions future', message['content'])


class CommentViewTests(AnalogueTestCase):
    def setUp(self):
        super().setUp()
        self.api = APIClient()
        client = MagicMock()
        self.parse = client.with_options.return_value.messages.parse
        self.parse.return_value = SimpleNamespace(stop_reason='end_turn', parsed_output=COMMENTARY)
        patcher = patch('ai_agent.commentary.get_client', return_value=client)
        patcher.start()
        self.addCleanup(patcher.stop)

    def get(self, county='cork', scenario=Scenario.RCP45):
        return self.api.get(reverse('ai_agent:commentary', args=[county, scenario]))

    def test_returns_the_commentary(self):
        response = self.get()

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json(), {'commentary': COMMENTARY.model_dump()})
        self.assertEqual(self.parse.call_args.kwargs['system'], RULES)
        self.assertIs(self.parse.call_args.kwargs['output_format'], Commentary)

    def test_second_request_comes_from_the_cache(self):
        self.get()
        response = self.get()

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json(), {'commentary': COMMENTARY.model_dump()})
        self.parse.assert_called_once()

    def test_unknown_or_baseline_scenario_is_rejected(self):
        for scenario in ('rcp60', Scenario.BASELINE):
            with self.subTest(scenario=scenario):
                self.assertEqual(self.get(scenario=scenario).status_code, HTTPStatus.BAD_REQUEST)
        self.parse.assert_not_called()

    def test_unknown_county_is_not_found(self):
        self.assertEqual(self.get(county='atlantis').status_code, HTTPStatus.NOT_FOUND)
        self.parse.assert_not_called()

    def test_api_error_or_timeout_is_unavailable_and_not_cached(self):
        request = httpx2.Request('POST', 'https://api.anthropic.com')
        for error in (anthropic.APITimeoutError(request=request), anthropic.APIConnectionError(request=request)):
            with self.subTest(error=type(error).__name__):
                self.parse.side_effect = error

                response = self.get()

                self.assertEqual(response.status_code, HTTPStatus.SERVICE_UNAVAILABLE)
                self.assertEqual(response.json(), {'detail': UNAVAILABLE})
                self.assertIsNone(cache.get(AgentCacheKey.comment('cork', Scenario.RCP45)))

    def test_unfinished_answer_is_unavailable_and_not_cached(self):
        self.parse.return_value = SimpleNamespace(stop_reason='max_tokens', parsed_output=None)

        response = self.get()

        self.assertEqual(response.status_code, HTTPStatus.SERVICE_UNAVAILABLE)
        self.assertIsNone(cache.get(AgentCacheKey.comment('cork', Scenario.RCP45)))

    def test_works_again_after_a_failure(self):
        self.parse.side_effect = anthropic.APITimeoutError(request=httpx2.Request('POST', 'https://api.anthropic.com'))
        self.get()
        self.parse.side_effect = None

        self.assertEqual(self.get().status_code, HTTPStatus.OK)
