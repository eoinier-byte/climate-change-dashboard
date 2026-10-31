from rest_framework import serializers

from climate.models import SeaLevelProjection, County
from common.models import Scenario, Season
from common.serializers import ProjectionSerializer, CountySerializer


class CountyDetailSerializer(CountySerializer):
    summary = serializers.SerializerMethodField()

    @staticmethod
    def get_summary(obj):
        rows = (obj.climateprojections
                .filter(scenario=Scenario.RCP45.value, period='2071-2100', season=Season.ANNUAL.value))
        return {p.variable: {'value': p.value, 'units': p.unit} for p in rows}

    class Meta:
        model = County
        fields = (*CountySerializer.Meta.fields, 'summary')


class SeaLevelProjectionSerializer(ProjectionSerializer):
    county = serializers.SlugRelatedField(slug_field='slug', read_only=True)

    class Meta:
        model = SeaLevelProjection
        fields = (*ProjectionSerializer.Meta.fields, 'county', 'year', 'provenance', 'value')
