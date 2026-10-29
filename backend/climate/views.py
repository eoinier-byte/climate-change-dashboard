from rest_framework import viewsets

from climate.models import County
from climate.serializers import CountySerializer

# Create your views here.


class CountyViewSet(viewsets.ModelViewSet):
    queryset = County.objects.order_by('name')
    serializer_class = CountySerializer
    http_method_names = ('get',)
