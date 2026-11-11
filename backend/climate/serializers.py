from decimal import Decimal
from typing import Any

from django.conf import settings
from rest_framework import serializers

from climate.models import ClimateProjection, County, SeaLevelProjection
from common.enums import Scenario, Season, Unit, Variable
from common.serializers import CountySerializer, ProjectionSerializer
from common.utils import change_from_baseline


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
    class Meta:
        model = SeaLevelProjection
        fields = (*ProjectionSerializer.Meta.fields, 'year', 'provenance')


class ClimateProjectionSerializer(ProjectionSerializer):
    county = serializers.SlugRelatedField(slug_field='slug', read_only=True)

    class Meta:
        model = ClimateProjection
        fields = (*ProjectionSerializer.Meta.fields, 'variable', 'period', 'season')


class ClimateSeriesSerializer(serializers.ModelSerializer):
    county = serializers.CharField(source='name')
    variable = serializers.SerializerMethodField()
    season = serializers.SerializerMethodField()
    unit = serializers.SerializerMethodField()
    change_unit = serializers.SerializerMethodField()
    baseline_period = serializers.SerializerMethodField()
    baseline = serializers.SerializerMethodField()
    periods = serializers.SerializerMethodField()
    scenarios = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()

    class Meta:
        model = County
        fields = (
            'county',
            'slug',
            'variable',
            'season',
            'unit',
            'change_unit',
            'baseline_period',
            'baseline',
            'periods',
            'scenarios',
            'source',
        )

    def to_representation(self, obj):
        self._projections = self._load_projections(obj)
        return super().to_representation(obj)

    def _load_projections(self, obj) -> list[ClimateProjection]:
        variable, season = self.get_variable(obj), self.get_season(obj)
        if 'climateprojections' in getattr(obj, '_prefetched_objects_cache', {}):
            rows = [p for p in obj.climateprojections.all() if p.variable == variable and p.season == season]
        else:
            rows = obj.climateprojections.select_related('data_source').filter(variable=variable, season=season)
        return sorted(rows, key=lambda p: (p.scenario, p.period))

    def _get_projections(self, obj) -> list[ClimateProjection]:
        return self._projections

    def _base(self, obj) -> ClimateProjection | None:
        return next((proj for proj in self._get_projections(obj) if proj.scenario == Scenario.BASELINE), None)

    def get_variable(self, obj) -> str:
        return self.context.get('variable', Variable.TEMPERATURE.value)

    def get_season(self, obj) -> str:
        return self.context.get('season', Season.ANNUAL.value)

    def get_unit(self, obj) -> str | None:
        base = self._base(obj)
        return str(Unit(base.unit).label) if base else None

    def get_change_unit(self, obj) -> str | None:
        return '%' if self.get_variable(obj) == Variable.PRECIPITATION.value else self.get_unit(obj)

    def get_baseline_period(self, obj) -> str | None:
        base = self._base(obj)
        return base.period if base else None

    def get_baseline(self, obj) -> Decimal | None:
        base = self._base(obj)
        return base.value if base else None

    def get_periods(self, obj) -> list[str]:
        return sorted({p.period for p in self._get_projections(obj)})

    def get_scenarios(self, obj) -> dict[str, Any]:
        base = self._base(obj)
        if not base:
            return {}
        series = {}
        for proj in self._get_projections(obj):
            if proj.scenario == Scenario.BASELINE:
                continue
            scenario = series.setdefault(
                proj.scenario,
                {
                    'label': Scenario(proj.scenario).label,
                    'values': [base.value],
                    'change': [0],
                },
            )
            scenario['values'].append(proj.value)
            scenario['change'].append(change_from_baseline(proj.value, base.value, proj.variable))
        return series

    def get_source(self, obj):
        base = self._base(obj)
        return base.data_source.name if base else None


class SeaLevelSeriesSerializer(serializers.ModelSerializer):
    county = serializers.CharField(source='name')
    unit = serializers.SerializerMethodField()
    baseline_period = serializers.SerializerMethodField()
    years = serializers.SerializerMethodField()
    series = serializers.SerializerMethodField()

    class Meta:
        model = County
        fields = ('county', 'slug', 'has_coastline', 'unit', 'baseline_period', 'years', 'series')

    @staticmethod
    def _get_projections(obj) -> list[SeaLevelProjection]:
        return sorted(obj.sealevelprojections.all(), key=lambda proj: (proj.scenario, proj.year))

    def get_unit(self, obj) -> str | None:
        projections = self._get_projections(obj)
        return projections[0].unit if projections else None

    def get_baseline_period(self, obj) -> str | None:
        projections = self._get_projections(obj)
        return projections[0].data_source.baseline_period if projections else None

    def get_years(self, obj) -> list[int]:
        return sorted({proj.year for proj in self._get_projections(obj)})

    def get_series(self, obj) -> dict[str, Any]:
        series = {}
        for proj in self._get_projections(obj):
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
