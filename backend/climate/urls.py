from django.urls import path
from rest_framework.routers import SimpleRouter

from climate.views import CountyViewSet, MetaView, SeaLevelViewSet

app_name = 'climate'

router = SimpleRouter()
router.register('counties', CountyViewSet, basename='county')
router.register('sea-level', SeaLevelViewSet, basename='sea_level')

urlpatterns = [
    path('meta/', MetaView.as_view(), name='meta'),
    *router.urls,
]
