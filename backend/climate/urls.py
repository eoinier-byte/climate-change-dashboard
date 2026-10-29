from rest_framework.routers import SimpleRouter

from climate.views import CountyViewSet

app_name = 'climate'

router = SimpleRouter()
router.register('counties', CountyViewSet, basename='county')

urlpatterns = router.urls
