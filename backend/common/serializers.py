from rest_framework import serializers


class ProvenanceMixin(serializers.Serializer):
    scenario = serializers.CharField(read_only=True)
    baseline = serializers.CharField(source='data_source.baseline_period', read_only=True)
    units = serializers.CharField(source='unit', read_only=True)
    source = serializers.CharField(source='data_source.code', read_only=True)
