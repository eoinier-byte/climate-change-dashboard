from django.contrib.postgres.aggregates import ArrayAgg
from django.db.models import OuterRef, Subquery, Value
from rest_framework import viewsets
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from climate.filters import ClimateProjectionFilterSet
from climate.models import ClimateProjection, County, DataSource, SeaLevelProjection
from climate.serializers import ClimateProjectionSerializer, CountyDetailSerializer, SeaLevelSeriesSerializer
from common.enums import Scenario
from common.serializers import CountySerializer

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
