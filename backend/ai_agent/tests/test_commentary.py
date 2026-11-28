import json
import re
from decimal import Decimal

from ai_agent.commentary import build_payload, build_prompt
from climate.models import County
from climate.tests.base import AnalogueTestCase
from common.enums import Scenario, Season, Variable


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
