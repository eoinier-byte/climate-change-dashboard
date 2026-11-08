from django.core.exceptions import ValidationError


def validate_period(period: str) -> None:
    if not period:
        raise ValidationError('Period is required.')

    years = period.split('-')
    if len(years) != 2:
        raise ValidationError('Period must be in the format YYYY-YYYY, e.g. 1981-2010.')

    start, end = years
    if not (start.isdecimal() and end.isdecimal() and len(start) == 4 and len(end) == 4):
        raise ValidationError('Both years must be four digits, e.g. 1981-2010.')

    if int(start) >= int(end):
        raise ValidationError('Start year must be earlier than end year.')
