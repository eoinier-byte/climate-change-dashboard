from rest_framework import viewsets, status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import RetrieveAPIView
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet

from climate.models import County, DataSource, ClimateProjection, SeaLevelProjection
from climate.serializers import CountyDetailSerializer, SeaLevelProjectionSerializer, CountySeaLevelSerializer
from common.models import Scenario
from common.serializers import CountySerializer
from common.utils import distinct


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
        return Response({
            'scenarios': distinct('scenario', ClimateProjection),
            'periods': distinct('period', ClimateProjection),
            'seasons': distinct('season', ClimateProjection),
            'variables': distinct('variable', ClimateProjection),
            'sea_level_years': distinct('year', SeaLevelProjection),
            'sources': DataSource.objects.order_by('code').values(
                'code', 'name', 'organisation', 'baseline_period', 'licence', 'url'
            ),
        })


class SeaLevelView(RetrieveAPIView):
    queryset = County.objects.prefetch_related('sealevelprojections__data_source')
    serializer_class = CountySeaLevelSerializer
    lookup_field = 'slug'

