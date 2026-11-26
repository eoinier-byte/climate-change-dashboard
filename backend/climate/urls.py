from django.urls import path
from rest_framework.routers import SimpleRouter

from climate.views import (
    ClimateProjectionListView,
    CountyAnalogueListView,
    CountyViewSet,
    HealthView,
    ImpactIndicatorListView,
    MapView,
    MetaView,
    SeaLevelView,
)

app_name = 'climate'

router = SimpleRouter()
router.register('counties', CountyViewSet, basename='county')

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('meta/', MetaView.as_view(), name='meta'),
    path('sea-level/<slug:slug>/', SeaLevelView.as_view(), name='sea_level'),
    path('projections/', ClimateProjectionListView.as_view(), name='projections'),
    path('map/', MapView.as_view(), name='map'),
    path('counties/<slug:slug>/impacts/', ImpactIndicatorListView.as_view(), name='impacts'),
    path('counties/<slug:slug>/analogues/', CountyAnalogueListView.as_view(), name='analogues'),
    *router.urls,
]
