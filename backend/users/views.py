from django.contrib.auth import logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.utils import send_email
from common.views import AuthView
from users.models import EmailVerification, User
from users.serializers import EmailSerializer, UserLoginSerializer, UserRegisterSerializer


class UserRegisterView(AuthView):
    serializer_class = UserRegisterSerializer


class UserLoginView(AuthView):
    serializer_class = UserLoginSerializer


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    def get(self, request):
        return Response({'detail': 'CSRF cookie set'})


class RecoveryView(GenericAPIView):
    serializer_class = EmailSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = User.objects.filter(email__iexact=serializer.validated_data['email']).first()
        if user:
            send_email(user.id, EmailVerification.RESET_PASSWORD)

        return Response({'detail': 'If this email is registered, you will receive a link.'})


class EmailVerificationView(APIView): ...


class VerificationMessageView(APIView): ...


class PasswordResetView(APIView): ...


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'detail': 'Logout successful'})
