import json
from decimal import Decimal

from ai_agent.tools import get_projections, get_sea_level, rank_counties
from climate.models import County
from climate.tests.base import ProjectionTestCase
from common.enums import Scenario, Season, Unit, Variable


class ToolTestCase(ProjectionTestCase):
    @staticmethod
    def run_tool(tool, **arguments):
        return json.loads(tool.call(arguments))

    def create_temperature(self, county, baseline, end):
        common = {'county': county, 'variable': Variable.TEMPERATURE, 'season': Season.ANNUAL}
        self.create_climate_projection(
            scenario=Scenario.BASELINE, period='1976-2005', value=Decimal(baseline), **common
        )
        self.create_climate_projection(scenario=Scenario.RCP85, period='2071-2100', value=Decimal(end), **common)


class GetProjectionsTestCase(ToolTestCase):
    def setUp(self):
        super().setUp()
        self.create_temperature(self.county, '9.810', '12.810')

    def test_returns_series_with_units_and_source(self):
        data = self.run_tool(get_projections, county='cork', variable='temperature')
        self.assertEqual(data['county'], 'Cork')
        self.assertEqual(data['season'], 'annual')
        self.assertEqual((data['unit'], data['change_unit']), ('°C', '°C'))
        self.assertEqual(data['baseline_period'], '1976-2005')
        self.assertEqual(data['source'], 'TRANSLATE')
        self.assertEqual(Decimal(data['scenarios']['rcp85']['change'][-1]), Decimal('3.00'))

    def test_county_lookup_is_case_insensitive(self):
        data = self.run_tool(get_projections, county='CoRk', variable='temperature')
        self.assertEqual(data['slug'], 'cork')

    def test_precipitation_change_is_in_percent(self):
        common = {'variable': Variable.PRECIPITATION, 'season': Season.ANNUAL, 'unit': Unit.MM}
        self.create_climate_projection(scenario=Scenario.BASELINE, period='1976-2005', value=Decimal('1000'), **common)
        self.create_climate_projection(scenario=Scenario.RCP85, period='2071-2100', value=Decimal('1100'), **common)
        data = self.run_tool(get_projections, county='cork', variable='precipitation')
        self.assertEqual((data['unit'], data['change_unit']), ('mm', '%'))
        self.assertEqual(Decimal(data['scenarios']['rcp85']['change'][-1]), Decimal('10.0'))

    def test_unknown_county_lists_valid_slugs(self):
        result = get_projections.call({'county': 'atlantis', 'variable': 'temperature'})
        self.assertEqual(result, 'Unknown county atlantis. Valid slugs: cork')

    def test_invalid_variable_is_rejected(self):
        with self.assertRaises(ValueError):
            get_projections.call({'county': 'cork', 'variable': 'wind'})


class GetSeaLevelTestCase(ToolTestCase):
    def test_coastal_county(self):
        self.create_sea_level_projection(scenario=Scenario.RCP85, year=2100, value=Decimal('75.400'))
        data = self.run_tool(get_sea_level, county='Cork')
        self.assertTrue(data['has_coastline'])
        self.assertEqual(data['unit'], 'cm')
        self.assertEqual(data['baseline_period'], '1981-2000')
        self.assertEqual(data['years'], [2100])
        self.assertEqual(data['series']['rcp85']['values'], ['75.400'])
        self.assertEqual(data['series']['rcp85']['provenance'], 'UKCP18')
        self.assertEqual(data['series']['rcp85']['source'], 'ukcp18')

    def test_inland_county_has_no_series(self):
        County.objects.create(name='Offaly')
        data = self.run_tool(get_sea_level, county='offaly')
        self.assertFalse(data['has_coastline'])
        self.assertEqual(data['series'], {})

    def test_unknown_county_lists_valid_slugs(self):
        result = get_sea_level.call({'county': 'atlantis'})
        self.assertEqual(result, 'Unknown county atlantis. Valid slugs: cork')


class RankCountiesTestCase(ToolTestCase):
    ARGUMENTS = {'variable': 'temperature', 'season': 'annual', 'scenario': 'rcp85', 'period': '2071-2100'}

    def setUp(self):
        super().setUp()
        self.create_temperature(self.county, '9.810', '12.810')
        self.create_temperature(County.objects.create(name='Carlow'), '9.500', '11.500')
        self.create_temperature(County.objects.create(name='Kerry'), '10.200', '11.200')

    def rank(self, **arguments):
        return self.run_tool(rank_counties, **{**self.ARGUMENTS, **arguments})

    @staticmethod
    def slugs(data):
        return [item['county']['slug'] for item in data['results']]

    def test_largest_change_first(self):
        data = self.rank(asc=False)
        self.assertEqual(self.slugs(data), ['cork', 'carlow', 'kerry'])
        self.assertEqual(
            [Decimal(item['change']) for item in data['results']], [Decimal('3'), Decimal('2'), Decimal('1')]
        )

    def test_smallest_change_first(self):
        data = self.rank(asc=True)
        self.assertEqual(self.slugs(data), ['kerry', 'carlow', 'cork'])

    def test_limit_keeps_top_by_change(self):
        data = self.rank(asc=False, limit=2)
        self.assertEqual(self.slugs(data), ['cork', 'carlow'])

    def test_result_has_baseline_and_value(self):
        item = self.rank(asc=False, limit=1)['results'][0]
        self.assertEqual(Decimal(item['baseline_value']), Decimal('9.810'))
        self.assertEqual(Decimal(item['value']), Decimal('12.810'))

    def test_header_has_units_and_source(self):
        data = self.rank()
        self.assertEqual(
            {key: data[key] for key in ('variable', 'season', 'scenario', 'period')},
            self.ARGUMENTS,
        )
        self.assertEqual((data['unit'], data['change_unit']), ('°C', '°C'))
        self.assertEqual(data['baseline_period'], '1976-2005')
        self.assertEqual(data['source'], 'TRANSLATE')

    def test_unknown_period_lists_valid_periods(self):
        result = rank_counties.call({**self.ARGUMENTS, 'period': '2050'})
        self.assertEqual(result, 'No projections for period 2050. Valid periods: 2071-2100')

    def test_invalid_scenario_is_rejected(self):
        with self.assertRaises(ValueError):
            rank_counties.call({**self.ARGUMENTS, 'scenario': 'rcp60'})
