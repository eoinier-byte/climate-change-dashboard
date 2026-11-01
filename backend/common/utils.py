from django.db.models import Model


def distinct(field: str, model: type[Model]) -> list:
    return sorted(model.objects.values_list(field, flat=True).distinct())