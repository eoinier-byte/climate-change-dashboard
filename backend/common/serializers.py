from rest_framework import serializers

from climate.models import County


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
