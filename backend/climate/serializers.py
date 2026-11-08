from django.conf import settings
from rest_framework import serializers

from climate.models import County, SeaLevelProjection
from common.models import Unit
from common.serializers import CountySerializer, ProjectionSerializer


class CountyDetailSerializer(CountySerializer):
    summary = serializers.SerializerMethodField()

    @staticmethod
    def get_summary(obj):
        rows = obj.climateprojections.select_related('data_source').filter(
            scenario=settings.SUMMARY_SCENARIO, period=settings.SUMMARY_PERIOD, season=settings.SUMMARY_SEASON
        )
        summary = {
            'scenario': settings.SUMMARY_SCENARIO,
            'period': settings.SUMMARY_PERIOD,
            'season': settings.SUMMARY_SEASON,
            'source': None,
        }
        for p in rows:
            summary[p.variable] = {'value': p.value, 'unit': Unit(p.unit).label}
            summary['source'] = p.data_source.code
        return summary

    class Meta:
        model = County
        fields = (*CountySerializer.Meta.fields, 'summary')


class SeaLevelProjectionSerializer(ProjectionSerializer):
    county = serializers.SlugRelatedField(slug_field='slug', read_only=True)

    class Meta:
        model = SeaLevelProjection
        fields = (*ProjectionSerializer.Meta.fields, 'county', 'year', 'provenance', 'value')


class CountySeaLevelSerializer(serializers.ModelSerializer):
    county = serializers.CharField(source='name')
    unit = serializers.SerializerMethodField()
    baseline_period = serializers.SerializerMethodField()
    years = serializers.SerializerMethodField()
    series = serializers.SerializerMethodField()

    class Meta:
        model = County
        fields = ('county', 'slug', 'has_coastline', 'unit', 'baseline_period', 'years', 'series')

    @staticmethod
    def _rows(obj):
        return sorted(obj.sealevelprojections.all(), key=lambda proj: (proj.scenario, proj.year))

    def get_unit(self, obj):
        rows = self._rows(obj)
        return rows[0].unit if rows else None

    def get_baseline_period(self, obj):
        rows = self._rows(obj)
        return rows[0].data_source.baseline_period if rows else None

    def get_years(self, obj):
        return sorted({r.year for r in self._rows(obj)})

    def get_series(self, obj):
        series = {}
        for proj in self._rows(obj):
            scenario = series.setdefault(
                proj.scenario,
                {
                    'values': [],
                    'provenance': proj.provenance,
                    'source': proj.data_source.code,
                },
            )
            scenario['values'].append(proj.value)
        return series
