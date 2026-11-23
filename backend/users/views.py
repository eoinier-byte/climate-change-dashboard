from http import HTTPStatus

from django.contrib.auth import logout
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.views import AuthView
from users.models import EmailVerification, User
from users.serializers import (
    PasswordSerializer,
    ProfileSerializer,
    ResetEmailSerializer,
    UpdateEmailSerializer,
    UserLoginSerializer,
    UserRegisterSerializer,
)
from users.tasks import async_send_email


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    def get(self, request):
        return Response({'detail': 'CSRF cookie set'})


class UserRegisterView(AuthView):
    serializer_class = UserRegisterSerializer


class UserLoginView(AuthView):
    serializer_class = UserLoginSerializer


class RecoveryView(GenericAPIView):
    serializer_class = ResetEmailSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = User.objects.filter(email__iexact=serializer.validated_data['email']).first()
        if user:
            async_send_email.delay(user.id, EmailVerification.RESET_PASSWORD)

        return Response({'detail': 'If this email is registered, you will receive a link.', **serializer.data})


class EmailVerificationView(APIView):
    @transaction.atomic
    def post(self, request, *args, **kwargs):
        record = (
            EmailVerification.objects.select_for_update()
            .select_related('user')
            .filter(
                code=kwargs['code'],
                user_id=kwargs['user_id'],
                type__in=(EmailVerification.VERIFY_EMAIL, EmailVerification.REGISTER),
            )
            .first()
        )
        if record is None:
            return Response({'detail': 'Email Verification does not exist'}, status=HTTPStatus.NOT_FOUND)

        user = record.user
        if record.used:
            return Response({'detail': 'Email Verification link is used'}, status=HTTPStatus.GONE)

        record.used = True
        record.save()

        if record.is_expired():
            return Response({'detail': 'Email Verification link has expired'}, status=HTTPStatus.GONE)

        if record.type == EmailVerification.VERIFY_EMAIL:
            if not user.pending_email:
                return Response({'detail': 'Email Verification link is used'}, status=HTTPStatus.GONE)

            if User.objects.filter(email__iexact=user.pending_email).exclude(id=user.id).exists():
                user.pending_email = None
                user.save()
                return Response({'detail': 'Email already exists'}, status=HTTPStatus.CONFLICT)

            user.email, user.pending_email = user.pending_email, None

        user.is_verified = True
        user.save()

        return Response({'detail': 'Your email is verified'}, status=HTTPStatus.ACCEPTED)


class PasswordResetView(APIView): ...


class ProfileViewSet(viewsets.ModelViewSet):
    serializer_classes = {
        'profile': ProfileSerializer,
        'password': PasswordSerializer,
        'change_email': UpdateEmailSerializer,
    }
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return self.serializer_classes[self.action]

    @action(detail=False, methods=['post'], url_path='change-email')
    def change_email(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        user = request.user

        transaction.on_commit(lambda: async_send_email.delay(user.id, EmailVerification.VERIFY_EMAIL))

        return Response(
            data={
                'email': user.pending_email,
                'detail': '⚠️ We have sent a confirmation email to your address. Please check your '
                'inbox and click the link to confirm.',
            },
            status=HTTPStatus.ACCEPTED,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'detail': 'Logout successful'})
