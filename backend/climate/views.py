from http import HTTPStatus

from django.contrib.postgres.aggregates import ArrayAgg
from django.core.cache import cache
from django.db.models import OuterRef, Subquery, Value
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import viewsets
from rest_framework.generics import ListAPIView, RetrieveAPIView, get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from climate.filters import ClimateProjectionFilterSet, CountyAnalogueFilterSet, ImpactIndicatorFilterSet
from climate.models import ClimateProjection, County, CountyAnalogue, DataSource, ImpactIndicator, SeaLevelProjection
from climate.serializers import (
    ClimateProjectionSerializer,
    CountyAnalogueSerializer,
    CountyDetailSerializer,
    ImpactIndicatorSerializer,
    MapSerializer,
    SeaLevelSeriesSerializer,
)
from common.cache import ClimateCacheKey
from common.enums import Scenario
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
        ck = ClimateCacheKey()
        meta_ck = ck.meta()

        data = cache.get(meta_ck)
        if data:
            return Response(data, status=HTTPStatus.OK)

        group_ck = ck.groups()
        groups = cache.get_or_set(group_ck, lambda: ClimateProjection.objects.aggregate_groups(), ck.TIMEOUT)

        sea_level = SeaLevelProjection.objects.aggregate(
            years=ArrayAgg('year', distinct=True, order_by='year', default=Value([])),
        )

        data = {
            **groups,
            'sea_level_years': sea_level['years'],
            'sources': list(
                DataSource.objects.order_by('code').values(
                    'code', 'name', 'organisation', 'baseline_period', 'licence', 'url'
                )
            ),
        }
        cache.set(meta_ck, data, ck.TIMEOUT)
        return Response(data, status=HTTPStatus.OK)


class SeaLevelView(RetrieveAPIView):
    queryset = County.objects.prefetch_related('sealevelprojections__data_source')
    serializer_class = SeaLevelSeriesSerializer
    lookup_field = 'slug'


class ClimateProjectionListView(ListAPIView):
    queryset = ClimateProjection.objects.select_related('county', 'data_source')
    serializer_class = ClimateProjectionSerializer
    filterset_class = ClimateProjectionFilterSet

    def get_queryset(self):
        return ClimateProjection.objects.with_baseline_value().select_related('county', 'data_source')


class MapView(ListAPIView):
    queryset = ClimateProjection.objects.select_related('county')
    serializer_class = MapSerializer

    def get(self, request, *args, **kwargs):
        ck = ClimateCacheKey()

        variable = request.GET.get('variable')
        scenario = request.GET.get('scenario')
        season = request.GET.get('season')
        period = request.GET.get('period')

        proj_ck = ClimateCacheKey.map(variable, scenario, season, period)

        data = cache.get(proj_ck)
        if data:
            return Response(data, status=HTTPStatus.OK)

        errors = {}
        group_ck = ck.groups()
        groups = cache.get_or_set(group_ck, lambda: ClimateProjection.objects.aggregate_groups(), ck.TIMEOUT)

        validate_choice('variable', variable, groups['variables'], errors)
        validate_choice('scenario', scenario, groups['scenarios'], errors)
        validate_choice('season', season, groups['seasons'], errors)
        validate_choice('period', period, groups['periods'], errors)

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
        data = self.get_serializer(payload).data
        cache.set(proj_ck, data, ClimateCacheKey.TIMEOUT)

        return Response(data, status=HTTPStatus.OK)

    def get_queryset(self):
        variable = self.request.GET.get('variable')
        scenario = self.request.GET.get('scenario')
        season = self.request.GET.get('season')
        period = self.request.GET.get('period')

        return (
            super()
            .get_queryset()
            .filter(variable=variable, scenario=scenario, season=season, period=period)
            .only('value', 'unit', 'county__name', 'county__slug', 'county__has_coastline')
            .order_by('county__name')
        )


class ImpactIndicatorListView(ListAPIView):
    serializer_class = ImpactIndicatorSerializer
    filterset_class = ImpactIndicatorFilterSet

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return ImpactIndicator.objects.none()

        county = get_object_or_404(County, slug=self.kwargs['slug'])
        baseline = ImpactIndicator.objects.filter(
            county=OuterRef('county'),
            indicator=OuterRef('indicator'),
            scenario=Scenario.BASELINE,
        ).values('value')[:1]
        return (
            ImpactIndicator.objects.filter(county=county)
            .select_related('county', 'data_source')
            .annotate(baseline_value=Subquery(baseline))
            .order_by('indicator', 'scenario', 'period')
        )


@extend_schema(
    summary='Climate analogues of a county',
    description=(
        "The 3 European cities whose present climate (WorldClim 2.1, 1970-2000) is closest to the county's "
        'projected climate for one scenario and period, ordered by rank (1 = closest). CCD-358.'
    ),
    responses={
        200: CountyAnalogueSerializer(many=True),
        400: OpenApiResponse(description='scenario or period missing or invalid (baseline is not valid)'),
        404: OpenApiResponse(description='Unknown county'),
    },
)
class CountyAnalogueListView(ListAPIView):
    serializer_class = CountyAnalogueSerializer
    filterset_class = CountyAnalogueFilterSet

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return CountyAnalogue.objects.none()

        county = get_object_or_404(County, slug=self.kwargs['slug'])
        return (
            CountyAnalogue.objects.filter(county=county).select_related('county', 'city__data_source').order_by('rank')
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        translate = DataSource.objects.filter(code='translate').first()
        context['change_baseline_period'] = translate.baseline_period if translate else None
        return context
