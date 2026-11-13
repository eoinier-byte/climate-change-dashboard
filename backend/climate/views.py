from http import HTTPStatus

from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import OuterRef, Subquery, Value
from rest_framework import viewsets
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from climate.filters import ClimateProjectionFilterSet
from climate.models import ClimateProjection, County, DataSource, SeaLevelProjection
from climate.serializers import (
    ClimateProjectionSerializer,
    CountyDetailSerializer,
    MapSerializer,
    SeaLevelSeriesSerializer,
)
from common.enums import Scenario, Season, Variable
from common.serializers import CountySerializer
from common.utils import validate_choice

# Create your views here.


class CountyViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = County.objects.order_by('name')
    lookup_field = 'slug'

    def get_serializer_class(self):
        return CountyDetailSerializer if self.action == 'retrieve' else CountySerializer


class HealthView(APIView):
    def get(self, request):
        return Response({'status': 'ok'})


class MetaView(APIView):
    def get(self, request):
        groups = ClimateProjection.objects.aggregate(
            scenarios=ArrayAgg('scenario', distinct=True, order_by='scenario', default=Value([])),
            periods=ArrayAgg('period', distinct=True, order_by='period', default=Value([])),
            seasons=ArrayAgg('season', distinct=True, order_by='season', default=Value([])),
            variables=ArrayAgg('variable', distinct=True, order_by='variable', default=Value([])),
        )
        sea_level = SeaLevelProjection.objects.aggregate(
            years=ArrayAgg('year', distinct=True, order_by='year', default=Value([])),
        )
        return Response(
            {
                **groups,
                'sea_level_years': sea_level['years'],
                'sources': DataSource.objects.order_by('code').values(
                    'code', 'name', 'organisation', 'baseline_period', 'licence', 'url'
                )
                or [],
            }
        )


class SeaLevelView(RetrieveAPIView):
    queryset = County.objects.prefetch_related('sealevelprojections__data_source')
    serializer_class = SeaLevelSeriesSerializer
    lookup_field = 'slug'


class ClimateProjectionListView(ListAPIView):
    queryset = ClimateProjection.objects.select_related('county', 'data_source')
    serializer_class = ClimateProjectionSerializer
    filterset_class = ClimateProjectionFilterSet

    def get_queryset(self):
        baseline = ClimateProjection.objects.filter(
            county=OuterRef('county'),
            variable=OuterRef('variable'),
            season=OuterRef('season'),
            scenario=Scenario.BASELINE,
        ).values('value')[:1]
        return ClimateProjection.objects.select_related('county', 'data_source').annotate(
            baseline_value=Subquery(baseline)
        )


class MapView(ListAPIView):
    queryset = ClimateProjection.objects.select_related('county')
    serializer_class = MapSerializer

    def get(self, request, *args, **kwargs):
        variable = request.GET.get('variable')
        scenario = request.GET.get('scenario')
        season = request.GET.get('season')
        period = request.GET.get('period')

        errors = {}
        validate_choice('variable', variable, Variable.values, errors)
        validate_choice('scenario', scenario, Scenario.values, errors)
        validate_choice('season', season, Season.values, errors)
        validate_choice('period', period, ClimateProjection.objects.values_list('period', flat=True).distinct(), errors)

        if errors:
            return Response(data=errors, status=HTTPStatus.BAD_REQUEST)

        queryset = self.get_queryset()
        values = [county.value for county in queryset]
        payload = {
            'variable': variable,
            'scenario': scenario,
            'season': season,
            'period': period,
            'unit': queryset[0].unit if queryset else None,
            'min': min(values, default=None),
            'max': max(values, default=None),
            'results': queryset,
        }
        return Response(self.get_serializer(payload).data, status=HTTPStatus.OK)

    def get_queryset(self):
        queryset = super().get_queryset()
        variable = self.request.GET.get('variable')
        scenario = self.request.GET.get('scenario')
        season = self.request.GET.get('season')
        period = self.request.GET.get('period')

        return (
            queryset.filter(variable=variable, scenario=scenario, season=season, period=period)
            .only('value', 'unit', 'county__name', 'county__slug', 'county__has_coastline')
            .order_by('county__name')
        )
