from django.urls import path
from rest_framework.routers import SimpleRouter

from climate.views import ClimateProjectionListView, CountyViewSet, HealthView, MetaView, SeaLevelView

app_name = 'climate'

router = SimpleRouter()
router.register('counties', CountyViewSet, basename='county')

urlpatterns = [
    path('health/', HealthView.as_view(), name='health'),
    path('meta/', MetaView.as_view(), name='meta'),
    path('sea-level/<slug:slug>/', SeaLevelView.as_view(), name='sea_level'),
    path('projections/', ClimateProjectionListView.as_view(), name='projections'),
    *router.urls,
]
