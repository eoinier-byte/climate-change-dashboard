from django.contrib.auth import logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.views import AuthView
from users.serializers import UserLoginSerializer, UserRegisterSerializer


class UserRegisterView(AuthView):
    serializer_class = UserRegisterSerializer


class UserLoginView(AuthView):
    serializer_class = UserLoginSerializer


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'detail': 'Logout successful'})


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    def get(self, request):
        return Response({'detail': 'CSRF cookie set'})
