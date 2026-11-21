from django.urls import path

from users.views import CsrfView, UserLoginView, UserRegisterView, logout_view

app_name = 'users'

urlpatterns = [
    path('register/', UserRegisterView.as_view(), name='register'),
    path('login/', UserLoginView.as_view(), name='login'),
    path('logout/', logout_view, name='logout'),
    path('csrf/', CsrfView.as_view(), name='token'),
]
