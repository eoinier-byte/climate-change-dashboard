from datetime import date
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from django.conf import settings
from django.db.models import Q
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Table, TableStyle

from climate.models import DataSource
from climate.serializers import ClimateSeriesSerializer, SeaLevelSeriesSerializer
from common.enums import Scenario, Season, Unit, Variable

PRIMARY_HEX = '#0b5d4b'
PRIMARY = colors.HexColor(PRIMARY_HEX)
TEXT = colors.HexColor('#1b2a24')
MUTED = colors.HexColor('#4a5a53')
SURFACE = colors.HexColor('#f3f5f4')
BORDER = colors.HexColor('#c9d1cd')

SCENARIO_COLORS = {Scenario.RCP26: '#2e7d32', Scenario.RCP45: '#b45309', Scenario.RCP85: '#c62828'}
SCENARIO_NAMES = {
    Scenario.RCP26: 'low emissions future',
    Scenario.RCP45: 'medium emissions future',
    Scenario.RCP85: 'high emissions future',
}

MARGIN = 18 * mm
HEADER_HEIGHT = 20 * mm
FOOTER_HEIGHT = 12 * mm

BASE = getSampleStyleSheet()
TITLE = ParagraphStyle('ReportTitle', parent=BASE['Title'], alignment=TA_LEFT, textColor=TEXT)
HEADING = ParagraphStyle('ReportHeading', parent=BASE['Heading2'], textColor=PRIMARY)
BODY = ParagraphStyle('ReportBody', parent=BASE['BodyText'], textColor=TEXT)
SMALL = ParagraphStyle('ReportSmall', parent=BASE['BodyText'], fontSize=8.5, leading=11, textColor=MUTED)

TABLE_STYLE = TableStyle(
    [
        ('BACKGROUND', (0, 0), (-1, 0), SURFACE),
        ('GRID', (0, 0), (-1, -1), 0.6, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 2 * mm),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2 * mm),
    ]
)


def dashboard_link(county) -> str:
    return f'{settings.DOMAIN_NAME.rstrip("/")}/county/{county.slug}'


def link(url: str) -> str:
    return f'<link href="{escape(url)}" color="{PRIMARY_HEX}">{escape(url)}</link>'


def years(period: str) -> str:
    return period.replace('-', '–')


def amount(value, variable: str, unit: str) -> str:
    digits = 1 if variable == Variable.TEMPERATURE else 0
    return f'{Decimal(value):,.{digits}f} {unit}'


def change(value, unit: str) -> str:
    number = f'{Decimal(str(value)):+.1f}'
    return f'{number}{unit}' if unit == '%' else f'{number} {unit}'


def no_data(count: int) -> list:
    return [Paragraph('No data', SMALL)] * count


def projections_table(climate: dict, scenario: str) -> Table:
    color = SCENARIO_COLORS[scenario]
    reference = next(iter(climate.values()))
    periods = list(reference['periods'])
    baseline_period = reference['baseline_period']

    header = ['']
    for period in periods:
        label = f'{Scenario.BASELINE.label}<br/>' if period == baseline_period else ''
        header.append(Paragraph(f'<b>{label}{years(period)}</b>', SMALL))
    rows = [header]

    for variable, data in climate.items():
        cells = [Paragraph(f'<b>{variable.label}</b><br/>{Season.ANNUAL.label}', BODY)]
        series = data['scenarios'].get(scenario)
        if data['baseline'] is None or not series:
            rows.append(cells + no_data(len(periods)))
            continue
        for index, period in enumerate(data['periods']):
            text = amount(series['values'][index], variable, data['unit'])
            if period != baseline_period:
                text += (
                    f'<br/><font color="{color}"><b>{change(series["change"][index], data["change_unit"])}</b></font>'
                )
            cells.append(Paragraph(text, BODY))
        rows.append(cells)

    table = Table(rows, colWidths=[34 * mm] + [None] * len(periods), hAlign='LEFT')
    table.setStyle(TABLE_STYLE)
    return table


def sea_level_section(county, sea_level: dict | None, scenario: str) -> list:
    flowables = [Paragraph('Sea level', HEADING)]
    if sea_level is None:
        text = f'County {escape(county.name)} has no coastline, so sea-level rise does not apply.'
        return flowables + [Paragraph(text, BODY)]

    series = sea_level['series'].get(scenario)
    if not series:
        return flowables + [Paragraph('There are no sea-level projections for this county yet.', BODY)]

    color = SCENARIO_COLORS[scenario]
    unit = Unit(sea_level['unit']).label
    header = [Paragraph(f'<b>{year}</b>', SMALL) for year in sea_level['years']]
    values = [
        Paragraph(f'<font color="{color}"><b>{Decimal(value):+.0f} {unit}</b></font>', BODY)
        for value in series['values']
    ]
    table = Table([header, values], colWidths=[f'{100 / len(header)}%'] * len(header), hAlign='LEFT')
    table.setStyle(TABLE_STYLE)
    note = f'Rise in mean sea level compared with the {years(sea_level["baseline_period"])} average.'
    return flowables + [table, Paragraph(note, SMALL)]


def sources_section(climate: dict, sea_level: dict | None, scenario: str) -> list:
    names = {data['source'] for data in climate.values() if data['source']}
    codes = set()
    if sea_level and scenario in sea_level['series']:
        codes.add(sea_level['series'][scenario]['source'])

    flowables = [Paragraph('Data sources', HEADING)]
    for source in DataSource.objects.filter(Q(name__in=names) | Q(code__in=codes)).order_by('code'):
        lines = [f'<b>{escape(source.name)}</b>', escape(source.organisation), escape(source.attribution)]
        if source.licence:
            lines.append(f'Licence: {escape(source.licence)}')
        lines.append(link(source.url))
        flowables.append(Paragraph('<br/>'.join(line for line in lines if line), SMALL))
    return flowables


def about_section(scenario: str, baseline_period: str) -> KeepTogether:
    text = (
        'These are projections from climate models, not forecasts. Each number is an average over 30 years '
        f'for one possible future, the {SCENARIO_NAMES[scenario]}, compared with {years(baseline_period)}. '
        f'The change in {Variable.PRECIPITATION.label.lower()} is shown in per cent.'
    )
    if scenario == Scenario.RCP85:
        text += f' The {SCENARIO_NAMES[scenario]} is not certain to happen.'
    return KeepTogether([Paragraph('About these numbers', HEADING), Paragraph(text, BODY)])


def draw_page(county):
    def draw(canvas, doc):
        width, height = A4
        canvas.saveState()
        canvas.setFillColor(PRIMARY)
        canvas.rect(0, height - HEADER_HEIGHT, width, HEADER_HEIGHT, stroke=0, fill=1)
        canvas.setFillColor(colors.white)
        canvas.setFont('Helvetica-Bold', 13)
        canvas.drawString(MARGIN, height - HEADER_HEIGHT / 2 - 4.5, settings.SITE_NAME)
        canvas.setFont('Helvetica', 9.5)
        canvas.drawRightString(width - MARGIN, height - HEADER_HEIGHT / 2 - 3.5, 'County climate report')

        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.6)
        canvas.line(MARGIN, FOOTER_HEIGHT, width - MARGIN, FOOTER_HEIGHT)
        canvas.setFillColor(MUTED)
        canvas.setFont('Helvetica', 8)
        canvas.drawString(MARGIN, FOOTER_HEIGHT - 4.5 * mm, dashboard_link(county))
        canvas.drawRightString(width - MARGIN, FOOTER_HEIGHT - 4.5 * mm, f'Page {doc.page}')
        canvas.restoreState()

    return draw


def build_report_pdf(county, scenario: str) -> bytes:
    scenario = Scenario(scenario)
    climate = {
        variable: ClimateSeriesSerializer(county, context={'variable': variable, 'season': Season.ANNUAL}).data
        for variable in Variable
    }
    sea_level = SeaLevelSeriesSerializer(county).data if county.has_coastline else None
    baseline_period = next(iter(climate.values()))['baseline_period'] or ''
    color = SCENARIO_COLORS[scenario]

    story = [
        Paragraph(f'County {escape(county.name)}', TITLE),
        Paragraph(f'<font color="{color}"><b>{scenario.label}</b></font>, the {SCENARIO_NAMES[scenario]}', BODY),
        Paragraph(
            f'Generated on {date.today():%d %B %Y}. See every scenario and season on the dashboard: '
            f'{link(dashboard_link(county))}',
            SMALL,
        ),
        Paragraph(f'{Variable.TEMPERATURE.label} and {Variable.PRECIPITATION.label.lower()}', HEADING),
        projections_table(climate, scenario),
        Paragraph(f'Coloured numbers are the change from {years(baseline_period)} under the chosen future.', SMALL),
        *sea_level_section(county, sea_level, scenario),
        about_section(scenario, baseline_period),
        *sources_section(climate, sea_level, scenario),
    ]

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=HEADER_HEIGHT + 10 * mm,
        bottomMargin=FOOTER_HEIGHT + 8 * mm,
        title=f'{settings.SITE_NAME}: County {county.name} climate report',
        author=settings.SITE_NAME,
    )
    page = draw_page(county)
    doc.build(story, onFirstPage=page, onLaterPages=page)
    return buffer.getvalue()
