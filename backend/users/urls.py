from django.urls import include, path
from rest_framework.routers import DefaultRouter

from users.views import (
    CsrfView,
    EmailVerificationView,
    ProfileViewSet,
    RecoveryView,
    UserLoginView,
    UserRegisterView,
    logout_view,
)

app_name = 'users'

router = DefaultRouter()
router.register(r'profile', ProfileViewSet, basename='profile')

urlpatterns = [
    path('', include(router.urls)),
    path('register/', UserRegisterView.as_view(), name='register'),
    path('login/', UserLoginView.as_view(), name='login'),
    path('logout/', logout_view, name='logout'),
    path('recovery/', RecoveryView.as_view(), name='recovery'),
    path('csrf/', CsrfView.as_view(), name='token'),
    path('verify/<int:user_id>/<uuid:code>/', EmailVerificationView.as_view(), name='verify'),
]
