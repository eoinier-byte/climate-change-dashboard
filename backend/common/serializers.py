from rest_framework import serializers

from climate.models import County


class CountySerializer(serializers.ModelSerializer):
    class Meta:
        model = County
        fields = ('id', 'name', 'slug', 'has_coastline')


class ProjectionSerializer(serializers.ModelSerializer):
    scenario = serializers.CharField(read_only=True)
    baseline = serializers.CharField(source='data_source.baseline_period', read_only=True)
    units = serializers.CharField(source='unit', read_only=True)
    source = serializers.CharField(source='data_source.code', read_only=True)

    class Meta:
        fields = ('scenario', 'baseline', 'units', 'source')