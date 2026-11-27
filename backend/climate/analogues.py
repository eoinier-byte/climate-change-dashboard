"""Climate analogues (CCD-357): which cities' present climate is closest to a county's projected climate.

The county and the cities must be compared on the same observed dataset (WorldClim 2.1, 1970-2000).
Our TRANSLATE projections are a different dataset, so only their CHANGE is used (the delta method):

    temperature:   county future = county WorldClim + (projected future - projected baseline)
    precipitation: county future = county WorldClim x (projected future / projected baseline)

Each of the three variables is standardised with the mean and standard deviation across the cities,
so 1 degC and 1 mm don't weigh differently. The mean cancels when two standardised values are
subtracted ((a - mean) / std - (b - mean) / std = (a - b) / std), so only the standard deviation is
needed. Distance is Euclidean; similarity = 1 / (1 + distance), so 1 means identical and it falls
towards 0 as the climates differ.
"""

from math import sqrt
from statistics import pstdev

VARIABLES = ('summer_temp', 'winter_temp', 'annual_precip')
TOP = 3  # cities kept for each county, scenario and period


def project(worldclim: dict, baseline: dict, future: dict) -> dict:
    """The county's future climate: its WorldClim values moved by the modelled change."""
    return {
        'summer_temp': worldclim['summer_temp'] + (future['summer_temp'] - baseline['summer_temp']),
        'winter_temp': worldclim['winter_temp'] + (future['winter_temp'] - baseline['winter_temp']),
        'annual_precip': worldclim['annual_precip'] * (future['annual_precip'] / baseline['annual_precip']),
    }


def scales(cities: dict) -> dict:
    """The (population) standard deviation of each variable across the cities."""
    result = {}
    for variable in VARIABLES:
        std = pstdev(city[variable] for city in cities.values())
        if std == 0:
            raise ValueError(f'All cities have the same {variable}, so it cannot be standardised')
        result[variable] = std
    return result


def distance(a: dict, b: dict, scale: dict) -> float:
    """Euclidean distance between two climates after standardising each variable."""
    return sqrt(sum(((a[v] - b[v]) / scale[v]) ** 2 for v in VARIABLES))


def closest(target: dict, cities: dict, scale: dict, top: int = TOP) -> list[tuple]:
    """
    The `top` cities closest to `target`, closest first, as (city key, similarity).
    Equal distances are ordered by the city key, so the result is always the same.
    """
    ranked = sorted((distance(target, climate, scale), key) for key, climate in cities.items())
    return [(key, 1 / (1 + d)) for d, key in ranked[:top]]
