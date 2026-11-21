import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any, Iterable

from django.db.models import Model
from django.utils.timezone import now

from common.enums import Variable
from users.models import EmailVerification


def distinct(field: str, model: type[Model]) -> list:
    return sorted(model.objects.values_list(field, flat=True).distinct())


def change_from_baseline(value: Decimal, base: Decimal, variable: str) -> Decimal:
    if variable == Variable.PRECIPITATION.value:
        return round((value - base) / base * 100, 1)
    return round(value - base, 2)


def get_period_choices(model: type[Model]) -> list[tuple[str, str]]:
    return [(period, period) for period in distinct('period', model)]


def validate_choice(field: str, val: Any, choices: Iterable[str], errors: dict) -> None:
    if val not in choices:
        errors[field] = f'Invalid {field}: {val}. Valid {field}s are: {", ".join(choices)}'


def send_email(user_id: int, email_type: str) -> None:
    record = EmailVerification.objects.create(
        code=uuid.uuid4(),
        user_id=user_id,
        expiration=now() + timedelta(hours=1),
        type=email_type,
    )
    record.send_email()
