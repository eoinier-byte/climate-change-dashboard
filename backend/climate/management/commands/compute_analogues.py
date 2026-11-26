"""Compute the climate analogues (CCD-357): the 3 cities closest to each county's projected climate.

    python manage.py compute_analogues
    python manage.py compute_analogues --cities path/to/worldclim_cities.csv --counties path/to/worldclim_counties.csv

Reads the two WorldClim CSVs made by pipeline/worldclim_baseline.py (CCD-355) and the TRANSLATE projections
already loaded by load_data. The method is in climate/analogues.py.

Idempotent: everything happens in one transaction that replaces all CityClimate and CountyAnalogue rows,
so running it twice gives the same result. Any problem stops it with a CommandError and nothing changes.
"""

import csv
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
from statistics import fmean

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from climate.analogues import VARIABLES, closest, project, scales
from climate.models import CityClimate, ClimateProjection, County, CountyAnalogue, DataSource
from common.enums import Scenario, Season, Variable

DEFAULT_DIR = settings.BASE_DIR.parent / 'pipeline' / 'data' / 'processed'

# CSV column -> our variable name
CSV_COLUMNS = {'summer_temp_c': 'summer_temp', 'winter_temp_c': 'winter_temp', 'annual_precip_mm': 'annual_precip'}

# Which projection row gives each variable
PROJECTION_ROWS = {
    'summer_temp': (Variable.TEMPERATURE, Season.SUMMER),
    'winter_temp': (Variable.TEMPERATURE, Season.WINTER),
    'annual_precip': (Variable.PRECIPITATION, Season.ANNUAL),
}

THREE_PLACES = Decimal('0.001')


def to_decimal(value: float) -> Decimal:
    return Decimal(str(value)).quantize(THREE_PLACES)


def read_csv(path: Path, key_columns: tuple) -> list[dict]:
    """The rows of a WorldClim CSV, with the three variables as floats under our names."""
    if not path.is_file():
        raise CommandError(f'File not found: {path}. Run `python pipeline/worldclim_baseline.py` first.')
    with path.open(newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        missing = [c for c in (*key_columns, *CSV_COLUMNS) if c not in (reader.fieldnames or [])]
        if missing:
            raise CommandError(f'{path}: required column missing: {", ".join(missing)}')
        rows = []
        for row in reader:
            try:
                values = {name: float(row[column]) for column, name in CSV_COLUMNS.items()}
            except ValueError as exc:
                raise CommandError(f'{path}, line {reader.line_num}: {exc}') from exc
            rows.append({**{c: row[c] for c in key_columns}, **values})
    if not rows:
        raise CommandError(f'{path}: no rows')
    return rows


class Command(BaseCommand):
    help = 'Compute the 3 closest European cities for each county, scenario and period (idempotent).'

    def add_arguments(self, parser):
        parser.add_argument('--cities', type=Path, default=DEFAULT_DIR / 'worldclim_cities.csv')
        parser.add_argument('--counties', type=Path, default=DEFAULT_DIR / 'worldclim_counties.csv')

    def handle(self, *args, cities, counties, **options):
        source = DataSource.objects.filter(code='worldclim').first()
        if source is None:
            raise CommandError('DataSource worldclim missing. Run `python manage.py loaddata worldclim_source` first.')

        city_rows = read_csv(cities, ('city', 'country', 'latitude', 'longitude'))
        county_rows = read_csv(counties, ('county',))
        worldclim = {row['county']: row for row in county_rows}
        changes = self.projections()

        unknown = sorted(worldclim.keys() - set(County.objects.values_list('name', flat=True)))
        if unknown:
            raise CommandError(f'Counties in {counties} but not in the database: {", ".join(unknown)}')
        without_worldclim = sorted({county for county, _, _ in changes} - worldclim.keys())
        if without_worldclim:
            raise CommandError(f'Counties with projections but missing from {counties}: {", ".join(without_worldclim)}')

        try:
            scale = scales({i: row for i, row in enumerate(city_rows)})
        except ValueError as exc:
            raise CommandError(str(exc)) from exc

        with transaction.atomic():
            CountyAnalogue.objects.all().delete()
            CityClimate.objects.all().delete()
            city_objects = CityClimate.objects.bulk_create(
                CityClimate(
                    name=row['city'],
                    country=row['country'],
                    latitude=Decimal(row['latitude']),
                    longitude=Decimal(row['longitude']),
                    data_source=source,
                    **{v: to_decimal(row[v]) for v in VARIABLES},
                )
                for row in city_rows
            )
            # Keyed by "City, Country" so equal distances are ordered by name
            city_climates = {str(city): {v: float(getattr(city, v)) for v in VARIABLES} for city in city_objects}
            city_by_key = {str(city): city for city in city_objects}

            county_ids = dict(County.objects.values_list('name', 'id'))
            analogues = []
            for (county, scenario, period), (baseline, future) in sorted(changes.items()):
                target = project(worldclim[county], baseline, future)
                for rank, (key, similarity) in enumerate(closest(target, city_climates, scale), start=1):
                    analogues.append(
                        CountyAnalogue(
                            county_id=county_ids[county],
                            city=city_by_key[key],
                            scenario=scenario,
                            period=period,
                            rank=rank,
                            similarity=to_decimal(similarity),
                            **{f'county_{v}': to_decimal(target[v]) for v in VARIABLES},
                        )
                    )
            CountyAnalogue.objects.bulk_create(analogues)

        self.print_summary(len(city_objects), analogues)

    def projections(self) -> dict:
        """(county, scenario, period) -> (baseline values, future values) for every future scenario and period."""
        condition = Q()
        for variable, season in PROJECTION_ROWS.values():
            condition |= Q(variable=variable, season=season)
        values = defaultdict(dict)  # (county, scenario, period) -> {our variable: value}
        lookup = {rows: name for name, rows in PROJECTION_ROWS.items()}
        for row in ClimateProjection.objects.filter(condition).values(
            'county__name', 'scenario', 'period', 'variable', 'season', 'value'
        ):
            name = lookup[(row['variable'], row['season'])]
            values[(row['county__name'], row['scenario'], row['period'])][name] = float(row['value'])

        baselines = {county: v for (county, scenario, _), v in values.items() if scenario == Scenario.BASELINE}
        changes = {}
        for (county, scenario, period), future in values.items():
            if scenario == Scenario.BASELINE:
                continue
            baseline = baselines.get(county, {})
            missing = [v for v in VARIABLES if v not in future or v not in baseline]
            if missing:
                raise CommandError(
                    f'{county} {scenario} {period}: projection or baseline missing for {", ".join(missing)}. '
                    'Run `python manage.py load_data` first.'
                )
            changes[(county, scenario, period)] = (baseline, future)
        if not changes:
            raise CommandError('No projections in the database. Run `python manage.py load_data` first.')
        return changes

    def print_summary(self, city_count: int, analogues: list) -> None:
        self.stdout.write(f'{city_count} cities, {len(analogues)} analogue rows saved.')

        # Sanity check (CCD-357): a warmer scenario should give more southern cities.
        # Average latitude of the closest city (rank 1) for each period and scenario.
        latitudes = defaultdict(list)
        for row in analogues:
            if row.rank == 1:
                latitudes[(row.period, row.scenario)].append(float(row.city.latitude))
        self.stdout.write('Average latitude of the closest city:')
        for period in sorted({period for period, _ in latitudes}):
            means = [(s, fmean(latitudes[(period, s)])) for s in Scenario.values if (period, s) in latitudes]
            self.stdout.write(f'  {period}: ' + ', '.join(f'{s} {lat:.2f}' for s, lat in means))
            ordered = all(a[1] >= b[1] for a, b in zip(means, means[1:]))
            if ordered:
                self.stdout.write(self.style.SUCCESS('    OK: warmer scenarios give more southern cities'))
            else:
                self.stdout.write(self.style.WARNING('    Warning: a warmer scenario gives a more northern city'))
