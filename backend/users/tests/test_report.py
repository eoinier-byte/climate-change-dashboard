from decimal import Decimal
from unittest.mock import patch

from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Table

from climate.models import County
from climate.tests.base import ProjectionTestCase
from common.enums import Scenario, Season, Unit, Variable
from users.report import build_report_pdf

BASELINE = '1976-2005'


def texts(flowables) -> list[str]:
    found = []
    for flowable in flowables:
        if isinstance(flowable, Paragraph):
            found.append(flowable.getPlainText())
        elif isinstance(flowable, Table):
            found += texts(cell for row in flowable._cellvalues for cell in row)
        elif isinstance(flowable, KeepTogether):
            found += texts(flowable._content)
        elif isinstance(flowable, (list, tuple)):
            found += texts(flowable)
    return found


class ReportPdfTests(ProjectionTestCase):
    def setUp(self):
        super().setUp()
        self.inland = County.objects.create(name='Offaly')
        for county in (self.county, self.inland):
            self.create_series(county, Variable.TEMPERATURE, Unit.DEG_C, '9.810', '10.710', '12.520')
            self.create_series(county, Variable.PRECIPITATION, Unit.MM, '1366.160', '1402.490', '1474.710')
        for year, value in ((2050, '28.630'), (2100, '75.400')):
            self.create_sea_level_projection(scenario=Scenario.RCP85, year=year, value=Decimal(value))

    def create_series(self, county, variable, unit, baseline, mid, end):
        common = {'county': county, 'variable': variable, 'unit': unit, 'season': Season.ANNUAL}
        self.create_climate_projection(scenario=Scenario.BASELINE, period=BASELINE, value=Decimal(baseline), **common)
        self.create_climate_projection(scenario=Scenario.RCP85, period='2021-2050', value=Decimal(mid), **common)
        self.create_climate_projection(scenario=Scenario.RCP85, period='2071-2100', value=Decimal(end), **common)

    def report_text(self, county, scenario=Scenario.RCP85) -> str:
        original = SimpleDocTemplate.build
        story = []

        def build(doc, flowables, **kwargs):
            story.extend(flowables)
            return original(doc, flowables, **kwargs)

        with patch.object(SimpleDocTemplate, 'build', autospec=True, side_effect=build):
            pdf = build_report_pdf(county, scenario)
        self.assertTrue(pdf.startswith(b'%PDF'))
        return '\n'.join(texts(story))

    def test_builds_a_pdf_for_coastal_and_inland_counties(self):
        for county in (self.county, self.inland):
            with self.subTest(county.name):
                pdf = build_report_pdf(county, Scenario.RCP85)
                self.assertTrue(pdf.startswith(b'%PDF'))
                self.assertTrue(pdf.rstrip().endswith(b'%%EOF'))

    def test_shows_the_county_and_the_scenario(self):
        text = self.report_text(self.county)
        self.assertIn('County Cork', text)
        self.assertIn('RCP8.5, the high emissions future', text)

    def test_shows_baseline_values_and_changes(self):
        text = self.report_text(self.county)
        for expected in ('9.8 °C', '10.7 °C', '+0.9 °C', '12.5 °C', '+2.7 °C', '1,366 mm', '+2.7%', '+7.9%'):
            with self.subTest(expected):
                self.assertIn(expected, text)
        self.assertIn('Baseline1976–2005', text)

    def test_coastal_county_has_sea_level_and_both_sources(self):
        text = self.report_text(self.county)
        self.assertIn('+29 cm', text)
        self.assertIn('+75 cm', text)
        self.assertIn('compared with the 1981–2000 average', text)
        self.assertIn(self.translate.name, text)
        self.assertIn(self.ukcp18.name, text)

    def test_inland_county_has_no_sea_level_and_one_source(self):
        text = self.report_text(self.inland)
        self.assertIn('County Offaly has no coastline', text)
        self.assertNotIn(' cm', text)
        self.assertIn(self.translate.name, text)
        self.assertNotIn(self.ukcp18.name, text)

    def test_high_emissions_note_only_for_rcp85(self):
        self.assertIn('is not certain to happen', self.report_text(self.county, Scenario.RCP85))
        self.assertNotIn('is not certain to happen', self.report_text(self.county, Scenario.RCP45))

    def test_scenario_without_data_says_so(self):
        text = self.report_text(self.county, Scenario.RCP26)
        self.assertIn('No data', text)
        self.assertIn('There are no sea-level projections for this county yet.', text)
