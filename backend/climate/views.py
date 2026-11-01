from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from climate.models import County, DataSource, ClimateProjection, SeaLevelProjection
from climate.serializers import CountyDetailSerializer, SeaLevelProjectionSerializer
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
            'sea-level-years': distinct('year', SeaLevelProjection),
            'sources': DataSource.objects.order_by('code').values(
                'code', 'name', 'organisation', 'baseline_period', 'licence', 'url'
            ),
        })


class SeaLevelViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = (SeaLevelProjection.objects
                .select_related('county', 'data_source')
                .order_by('county__name', 'scenario', 'year'))
    serializer_class = SeaLevelProjectionSerializer
