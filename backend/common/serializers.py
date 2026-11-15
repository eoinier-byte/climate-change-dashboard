from decimal import Decimal

from rest_framework import serializers

from climate.models import County
from common.utils import change_from_baseline


class CountySerializer(serializers.ModelSerializer):
    class Meta:
        model = County
        fields = ('id', 'name', 'slug', 'has_coastline')


class ProjectionSerializer(serializers.ModelSerializer):
    county = serializers.SlugRelatedField(slug_field='slug', read_only=True)
    scenario = serializers.CharField(read_only=True)
    baseline_period = serializers.CharField(source='data_source.baseline_period', read_only=True)
    units = serializers.CharField(source='unit', read_only=True)
    source = serializers.CharField(source='data_source.code', read_only=True)

    class Meta:
        fields = ('scenario', 'baseline_period', 'units', 'source', 'value', 'county')


class ProjectionChangeSerializer(ProjectionSerializer):
    var_field = None

    county = serializers.SlugRelatedField(slug_field='slug', read_only=True)
    baseline_value = serializers.DecimalField(max_digits=8, decimal_places=3, read_only=True)
    projected_value = serializers.DecimalField(source='value', max_digits=8, decimal_places=3, read_only=True)
    change = serializers.SerializerMethodField()

    class Meta:
        fields = (
            *ProjectionSerializer.Meta.fields,
            'period',
            'season',
            'baseline_value',
            'projected_value',
            'change',
        )

    def get_field_names(self, declared_fields, info):
        fields = super().get_field_names(declared_fields, info)
        if self.var_field and self.var_field not in fields:
            fields = (*fields, self.var_field)
        return fields

    def get_change(self, obj) -> Decimal | None:
        if obj.baseline_value is None:
            return None
        return change_from_baseline(obj.value, obj.baseline_value, getattr(obj, self.var_field))
