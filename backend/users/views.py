from functools import cached_property
from http import HTTPStatus

from django.contrib.auth import logout, update_session_auth_hash
from django.db import transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import permissions, serializers, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.generics import GenericAPIView, get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from climate.models import County
from climate.serializers import CountySerializer
from common.exceptions import Gone
from common.serializers import DetailSerializer
from common.views import AuthView
from users.models import EmailVerification, User
from users.serializers import (
    AvatarSerializer,
    ProfileSerializer,
    ResetEmailSerializer,
    ResetPasswordSerializer,
    UpdateEmailSerializer,
    UpdatePasswordSerializer,
    UserLoginSerializer,
    UserRegisterSerializer,
)
from users.tasks import async_send_email


@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfView(APIView):
    @extend_schema(responses={HTTPStatus.OK: DetailSerializer})
    def get(self, request):
        return Response({'detail': 'CSRF cookie set.'})


class UserRegisterView(AuthView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'register'
    serializer_class = UserRegisterSerializer


class UserLoginView(AuthView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'
    serializer_class = UserLoginSerializer


class RecoveryView(GenericAPIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'email'
    serializer_class = ResetEmailSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = User.objects.filter(email__iexact=serializer.validated_data['email']).first()
        if user:
            async_send_email.delay(user.id, EmailVerification.RESET_PASSWORD)

        return Response({'detail': 'If an account with this email exists, a password reset link has been sent to it.'})


class EmailVerificationView(APIView):
    @extend_schema(
        request=None,
        responses={
            HTTPStatus.ACCEPTED: DetailSerializer,
            HTTPStatus.NOT_FOUND: DetailSerializer,
            HTTPStatus.CONFLICT: DetailSerializer,
            HTTPStatus.GONE: DetailSerializer,
        },
    )
    @transaction.atomic
    def post(self, request, *args, **kwargs):
        record = EmailVerification.objects.select_for_update().find_record(
            code=kwargs['code'],
            user_id=kwargs['user_id'],
            types=(EmailVerification.VERIFY_EMAIL, EmailVerification.REGISTER),
        )

        if record is None:
            return Response({'detail': 'This verification link is invalid.'}, status=HTTPStatus.NOT_FOUND)

        user = record.user
        if record.used:
            return Response({'detail': 'This verification link has already been used.'}, status=HTTPStatus.GONE)

        record.used = True
        record.save()

        if record.is_expired():
            return Response({'detail': 'This verification link has expired.'}, status=HTTPStatus.GONE)

        if record.type == EmailVerification.VERIFY_EMAIL:
            if not user.pending_email:
                return Response({'detail': 'This verification link is no longer valid.'}, status=HTTPStatus.GONE)

            if User.objects.filter(email__iexact=user.pending_email).exclude(id=user.id).exists():
                user.pending_email = None
                user.save()
                return Response({'detail': 'A user with this email already exists.'}, status=HTTPStatus.CONFLICT)

            user.email, user.pending_email = user.pending_email, None

        user.is_verified = True
        user.save()

        return Response({'detail': 'Your email has been verified.'}, status=HTTPStatus.ACCEPTED)


class PasswordResetView(GenericAPIView):
    serializer_class = ResetPasswordSerializer

    @cached_property
    def record(self):
        return EmailVerification.objects.find_record(
            code=self.kwargs['code'], user_id=self.kwargs['user_id'], types=(EmailVerification.RESET_PASSWORD,)
        )

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)

        if self.record is None:
            raise NotFound('This password reset link is invalid.')
        if self.record.used:
            raise Gone('This password reset link has already been used.')
        if self.record.is_expired():
            raise Gone('This password reset link has expired.')

    def get(self, request, *args, **kwargs):
        return Response({'detail': 'This password reset link is valid.'}, status=HTTPStatus.OK)

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'user': self.record.user})
        serializer.is_valid(raise_exception=True)
        if not EmailVerification.objects.filter(id=self.record.id, used=False).update(used=True):
            raise Gone('This password reset link has already been used.')

        serializer.save()

        EmailVerification.objects.filter(user_id=self.kwargs['user_id'], type=EmailVerification.RESET_PASSWORD).update(
            used=True
        )

        return Response({'detail': 'Your password has been reset.'}, status=HTTPStatus.OK)


class ProfileViewSet(viewsets.GenericViewSet):
    serializer_classes = {
        'me': ProfileSerializer,
        'update_me': ProfileSerializer,
        'change_password': UpdatePasswordSerializer,
        'change_email': UpdateEmailSerializer,
        'change_avatar': AvatarSerializer,
    }
    throttle_scopes = {
        'change_email': 'email',
        'change_password': 'password',
    }
    permission_classes = [permissions.IsAuthenticated]

    def get_throttles(self):
        self.throttle_scope = self.throttle_scopes.get(self.action)
        if self.throttle_scope:
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        return self.serializer_classes.get(self.action)

    @extend_schema(request=None, responses={HTTPStatus.NO_CONTENT: None})
    @action(detail=False, methods=['delete'], url_path='me/delete')
    def delete_me(self, request):
        user = request.user
        logout(request)
        user.delete()
        return Response(status=HTTPStatus.NO_CONTENT)

    @extend_schema(request=None, responses={HTTPStatus.NO_CONTENT: None})
    @action(detail=False, methods=['delete'], url_path='me/delete-avatar')
    def delete_avatar(self, request):
        if self.request.user.avatar:
            self.request.user.avatar.delete()
        return Response(status=HTTPStatus.NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        serializer = self.get_serializer(self.request.user)
        return Response(serializer.data, status=HTTPStatus.OK)

    @action(detail=False, methods=['patch', 'put'], url_path='me/update')
    def update_me(self, request):
        partial = request.method == 'PATCH'
        serializer = self.get_serializer(request.user, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=HTTPStatus.OK)

    @action(detail=False, methods=['patch', 'put'], url_path='me/change-avatar')
    def change_avatar(self, request):
        partial = request.method == 'PATCH'
        serializer = self.get_serializer(request.user, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=HTTPStatus.OK)

    @action(detail=False, methods=['patch', 'put'], url_path='me/change-password')
    def change_password(self, request):
        serializer = self.get_serializer(data=request.data, context={'user': request.user})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        update_session_auth_hash(request, request.user)

        return Response({'detail': 'Your password has been changed.'}, status=HTTPStatus.OK)

    @action(detail=False, methods=['patch', 'put'], url_path='me/change-email')
    def change_email(self, request):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        user = request.user

        transaction.on_commit(lambda: async_send_email.delay(user.id, EmailVerification.VERIFY_EMAIL))

        return Response(
            data={
                'email': user.pending_email,
                'detail': 'A confirmation link has been sent to your new email address.',
            },
            status=HTTPStatus.ACCEPTED,
        )


class FavouriteCountiesViewSet(viewsets.GenericViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CountySerializer
    lookup_field = 'slug'

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return County.objects.none()
        return self.request.user.counties.order_by('name')

    def list(self, request):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=HTTPStatus.OK)

    @extend_schema(
        request=inline_serializer('FavouriteCountyRequest', {'county': serializers.SlugField()}),
        responses={
            HTTPStatus.CREATED: CountySerializer,
            HTTPStatus.BAD_REQUEST: OpenApiResponse(description='No county given.'),
            HTTPStatus.NOT_FOUND: OpenApiResponse(description='Unknown county.'),
        },
    )
    def create(self, request):
        slug = request.data.get('county')
        if not slug:
            raise ValidationError({'county': ['This field is required.']})
        county = get_object_or_404(County, slug=str(slug).lower())
        request.user.counties.add(county)
        return Response(self.get_serializer(county).data, status=HTTPStatus.CREATED)

    @extend_schema(
        responses={
            HTTPStatus.NO_CONTENT: None,
            HTTPStatus.NOT_FOUND: OpenApiResponse(description='Unknown county.'),
        },
    )
    def destroy(self, request, slug=None):
        county = get_object_or_404(County, slug=slug.lower())
        request.user.counties.remove(county)
        return Response(status=HTTPStatus.NO_CONTENT)


@extend_schema(request=None, responses={HTTPStatus.OK: DetailSerializer})
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({'detail': 'You have signed out.'})
