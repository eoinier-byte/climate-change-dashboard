from decimal import Decimal

from django.db.models import Model

from climate.models import ClimateProjection
from common.enums import Variable


def distinct(field: str, model: type[Model]) -> list:
    return sorted(model.objects.values_list(field, flat=True).distinct())


def change_from_baseline(value: Decimal, base: Decimal, variable: str) -> Decimal:
    if variable == Variable.PRECIPITATION.value:
        return round((value - base) / base * 100, 1)
    return round(value - base, 2)


def get_period_choices():
    return [(period, period) for period in distinct('period', ClimateProjection)]
