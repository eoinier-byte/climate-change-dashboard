"""Load the processed pipeline CSVs into County, ClimateProjection and SeaLevelProjection (CCD-270).

    python manage.py load_data                        # both files from pipeline/data/processed/
    python manage.py load_data path/to/sea_level.csv  # only the files given

The file type is decided from its header (climate files have `variable`, sea-level files have `rise_cm`).

Two kinds of problem, handled differently:
- Row errors (empty or null value, non-numeric value, out of bounds, unknown county): the row is skipped,
  counted and reported with its line number. The rest of the file still loads.
- Contract errors (unit doesn't match the variable, value outside the model's choices, period fails
  validate_period, required column missing, file missing, database error): CommandError, and the whole load
  is rolled back, because the file no longer matches the data contract in docs/data-flow.md.
"""

import csv
from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import DatabaseError, transaction

from climate.models import ClimateProjection, County, DataSource, SeaLevelProjection
from common.enums import Scenario, Season, Unit, Variable
from common.validators import validate_period

DEFAULT_DIR = settings.BASE_DIR.parent / 'pipeline' / 'data' / 'processed'
DEFAULT_FILES = ('climate_data.csv', 'sea_level.csv')

# The 26 counties of the Republic of Ireland as (name, has_coastline). No local authorities (Fingal etc.).
# has_coastline: the county borders the open sea, or a sea estuary below the point where it meets a river
# (the Shannon Estuary). Tidal rivers above that point don't count. Judgement calls under this definition:
# - Leitrim: True. A short stretch of open coast at Tullaghan on Donegal Bay.
# - Limerick: True. No open-sea coast, only the Shannon Estuary shore.
# - Kilkenny and Tipperary: False. They only touch the tidal Suir/Barrow rivers, upstream of Waterford Harbour.
COUNTIES = (
    ('Carlow', False),
    ('Cavan', False),
    ('Clare', True),
    ('Cork', True),
    ('Donegal', True),
    ('Dublin', True),
    ('Galway', True),
    ('Kerry', True),
    ('Kildare', False),
    ('Kilkenny', False),
    ('Laois', False),
    ('Leitrim', True),
    ('Limerick', True),
    ('Longford', False),
    ('Louth', True),
    ('Mayo', True),
    ('Meath', True),
    ('Monaghan', False),
    ('Offaly', False),
    ('Roscommon', False),
    ('Sligo', True),
    ('Tipperary', False),
    ('Waterford', True),
    ('Westmeath', False),
    ('Wexford', True),
    ('Wicklow', True),
)
COASTLINE = dict(COUNTIES)

# Data contract for sea_level.csv (docs/data-model.md): the file has no unit or season column.
SEA_LEVEL_UNIT = Unit.CM.value  # the column is rise_cm
SEA_LEVEL_SEASON = Season.ANNUAL.value  # UKCP18 time-mean sea level is one value per year

# Each variable has exactly one unit (docs/data-flow.md).
UNIT_FOR_VARIABLE = {Variable.TEMPERATURE: Unit.DEG_C, Variable.PRECIPITATION: Unit.MM}

# Plausibility bounds (inclusive). A value outside them is skipped as a row error.
# Seasonal/annual mean air temperature in Ireland: the data is 4-18 degC; -10/30 leaves a wide margin.
TEMPERATURE_BOUNDS_DEGC = (Decimal('-10'), Decimal('30'))
# Precipitation is a seasonal or annual TOTAL in mm, never negative; wettest Irish uplands get ~3,000 mm a year.
PRECIPITATION_BOUNDS_MM = (Decimal('0'), Decimal('5000'))
# UKCP18 rise since 1981-2000: small negatives allowed (land uplift); 300 cm is above high-end 2100 estimates.
SEA_LEVEL_BOUNDS_CM = (Decimal('-50'), Decimal('300'))
BOUNDS = {
    Variable.TEMPERATURE: TEMPERATURE_BOUNDS_DEGC,
    Variable.PRECIPITATION: PRECIPITATION_BOUNDS_MM,
    'sea_level': SEA_LEVEL_BOUNDS_CM,
}

# Cell text that means "no value". Compared after strip() and lower().
NULL_TOKENS = {'', 'null', 'none', 'nan', 'na', 'n/a'}

CLIMATE_COLUMNS = ('county', 'variable', 'scenario', 'period', 'season', 'value', 'unit')
SEA_LEVEL_COLUMNS = ('county', 'scenario', 'year', 'rise_cm', 'source')

# Sea level has no baseline rows: the rise is measured from the 1981-2000 mean (docs/variables.md).
SEA_LEVEL_SCENARIOS = {Scenario.RCP26.value, Scenario.RCP45.value, Scenario.RCP85.value}


class RowError(Exception):
    """The row is skipped and reported; the load carries on."""


def normalise_county(name: str) -> str | None:
    """Return the canonical county name, or None if it isn't one of the 26 (whitespace and case ignored)."""
    key = ' '.join(name.split()).casefold()
    for canonical, _ in COUNTIES:
        if canonical.casefold() == key:
            return canonical
    return None


@dataclass
class FileResult:
    path: Path
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    reasons: dict[str, list[int]] = field(default_factory=lambda: defaultdict(list))

    def skip(self, line: int, reason: str) -> None:
        self.skipped += 1
        self.reasons[reason].append(line)


class Command(BaseCommand):
    help = 'Load the processed climate and sea-level CSVs into the database (idempotent, one transaction).'

    def add_arguments(self, parser):
        parser.add_argument(
            'paths',
            nargs='*',
            type=Path,
            help=f'CSV files to load. Default: {", ".join(DEFAULT_FILES)} in {DEFAULT_DIR}',
        )

    def handle(self, *args, paths, **options):
        paths = paths or [DEFAULT_DIR / name for name in DEFAULT_FILES]
        for path in paths:
            if not path.is_file():
                raise CommandError(f'File not found: {path}')

        sources = {s.code: s for s in DataSource.objects.filter(code__in=['translate', 'ukcp18'])}
        missing = {'translate', 'ukcp18'} - sources.keys()
        if missing:
            raise CommandError(
                f'DataSource {", ".join(sorted(missing))} missing. Run `python manage.py loaddata data_sources` first.'
            )

        self.counties = {}
        try:
            with transaction.atomic():
                results = [self.load_file(path, sources) for path in paths]
        except DatabaseError as exc:
            raise CommandError(f'Database error, nothing was loaded: {exc}') from exc

        self.print_summary(results)
        self.warn_empty_counties()

    # Loading

    def load_file(self, path: Path, sources: dict[str, DataSource]) -> FileResult:
        result = FileResult(path)
        with path.open(newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            header = set(reader.fieldnames or [])
            if 'variable' in header:
                columns, load_row, source = CLIMATE_COLUMNS, self.load_climate_row, sources['translate']
            elif 'rise_cm' in header:
                columns, load_row, source = SEA_LEVEL_COLUMNS, self.load_sea_level_row, sources['ukcp18']
            else:
                raise CommandError(f'{path}: not a climate or sea-level file (header: {sorted(header)})')
            missing = [c for c in columns if c not in header]
            if missing:
                raise CommandError(f'{path}: required column missing: {", ".join(missing)}')

            for row in reader:
                line = reader.line_num
                try:
                    created = load_row(row, source, f'{path.name} line {line}')
                except RowError as exc:
                    result.skip(line, str(exc))
                    continue
                if created:
                    result.inserted += 1
                else:
                    result.updated += 1
        return result

    def load_climate_row(self, row: dict, source: DataSource, where: str) -> bool:
        values = required(row, CLIMATE_COLUMNS)
        variable = choice(values['variable'], Variable, 'variable', where)
        scenario = choice(values['scenario'], Scenario, 'scenario', where)
        season = choice(values['season'].lower(), Season, 'season', where)
        period = period_or_error(values['period'], where)
        unit = values['unit']
        if unit != UNIT_FOR_VARIABLE[variable]:
            raise CommandError(f'{where}: unit {unit!r} does not match variable {variable!r}')

        county = self.county(values['county'])
        value = in_bounds(number(values['value'], 'value'), BOUNDS[variable], f'{variable} value', unit)

        _, created = ClimateProjection.objects.update_or_create(
            county=county,
            variable=variable,
            scenario=scenario,
            period=period,
            season=season,
            defaults={'value': value, 'unit': unit, 'data_source': source},
        )
        return created

    def load_sea_level_row(self, row: dict, source: DataSource, where: str) -> bool:
        values = required(row, SEA_LEVEL_COLUMNS)
        scenario = values['scenario']
        if scenario not in SEA_LEVEL_SCENARIOS:
            raise CommandError(f'{where}: scenario {scenario!r} not in {sorted(SEA_LEVEL_SCENARIOS)}')
        # An optional unit column must agree with the contract; it never overrides it.
        if 'unit' in row and (row['unit'] or '').strip() != SEA_LEVEL_UNIT:
            raise CommandError(f'{where}: unit {row["unit"]!r} is not {SEA_LEVEL_UNIT!r}')

        county = self.county(values['county'])
        year = number(values['year'], 'year')
        if year != year.to_integral_value():
            raise RowError("non-numeric value in 'year' (not a whole year)")
        value = in_bounds(number(values['rise_cm'], 'rise_cm'), BOUNDS['sea_level'], 'rise_cm', SEA_LEVEL_UNIT)

        _, created = SeaLevelProjection.objects.update_or_create(
            county=county,
            scenario=scenario,
            year=int(year),
            defaults={
                'value': value,
                'unit': SEA_LEVEL_UNIT,
                'season': SEA_LEVEL_SEASON,
                'provenance': values['source'],
                'data_source': source,
            },
        )
        return created

    def county(self, raw: str) -> County:
        name = normalise_county(raw)
        if name is None:
            raise RowError('unknown county')
        if name not in self.counties:
            county, created = County.objects.get_or_create(name=name, defaults={'has_coastline': COASTLINE[name]})
            if not created and county.has_coastline != COASTLINE[name]:
                self.stderr.write(
                    self.style.WARNING(
                        f'County {name} has has_coastline={county.has_coastline} in the DB, '
                        f'expected {COASTLINE[name]}. Not changed.'
                    )
                )
            self.counties[name] = county
        return self.counties[name]

    # Reporting

    def print_summary(self, results: list[FileResult]) -> None:
        total = FileResult(Path('TOTAL'))
        for result in results:
            self.print_result(str(result.path), result)
            total.inserted += result.inserted
            total.updated += result.updated
            total.skipped += result.skipped
        self.print_result('TOTAL', total)

    def print_result(self, label: str, result: FileResult) -> None:
        self.stdout.write(f'{label}: inserted {result.inserted}, updated {result.updated}, skipped {result.skipped}')
        for reason, lines in sorted(result.reasons.items()):
            more = f' (+{len(lines) - 5} more)' if len(lines) > 5 else ''
            self.stdout.write(f'  skipped {len(lines)}: {reason}, lines {", ".join(map(str, lines[:5]))}{more}')

    def warn_empty_counties(self) -> None:
        loaded = set(ClimateProjection.objects.values_list('county__name', flat=True).distinct())
        empty = [name for name, _ in COUNTIES if name not in loaded]
        if empty:
            self.stderr.write(self.style.WARNING(f'No climate rows for {len(empty)} counties: {", ".join(empty)}'))


# Row helpers. RowError = skip the row; CommandError = contract broken, roll back.


def required(row: dict, columns: tuple[str, ...]) -> dict[str, str]:
    values = {}
    for column in columns:
        value = (row.get(column) or '').strip()
        if value.lower() in NULL_TOKENS:
            raise RowError(f'empty or null value in {column!r}')
        values[column] = value
    return values


def choice(value: str, choices, column: str, where: str) -> str:
    if value not in choices.values:
        raise CommandError(f'{where}: {column} {value!r} not in {choices.values}')
    return value


def period_or_error(value: str, where: str) -> str:
    try:
        validate_period(value)
    except ValidationError as exc:
        raise CommandError(f'{where}: period {value!r} is invalid: {" ".join(exc.messages)}') from exc
    return value


def number(value: str, column: str) -> Decimal:
    try:
        result = Decimal(value)
    except InvalidOperation:
        raise RowError(f'non-numeric value in {column!r}') from None
    if not result.is_finite():
        raise RowError(f'non-numeric value in {column!r}')
    return result


def in_bounds(value: Decimal, bounds: tuple[Decimal, Decimal], label: str, unit: str) -> Decimal:
    low, high = bounds
    if not low <= value <= high:
        raise RowError(f'{label} out of bounds [{low}, {high}] {unit}')
    return value
