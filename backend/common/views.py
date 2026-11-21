from http import HTTPStatus

from django.contrib.auth import login
from django.db import transaction
from rest_framework.authentication import SessionAuthentication
from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from common.utils import send_email
from users.models import EmailVerification
from users.serializers import UserRegisterSerializer


class EnforceCsrfMixin:
    def initial(self, request, *args, **kwargs):
        SessionAuthentication().enforce_csrf(request)
        super().initial(request, *args, **kwargs)


class AuthView(EnforceCsrfMixin, GenericAPIView):
    http_method_names = ['post']

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})

        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTPStatus.BAD_REQUEST)

        if isinstance(serializer, UserRegisterSerializer):
            user = serializer.save()
            message = 'User registered successfully'
            status = HTTPStatus.CREATED
            transaction.on_commit(lambda: send_email(user.id, EmailVerification.REGISTER))
        else:
            user = serializer.validated_data['user']
            message = 'User signed in successfully'
            status = HTTPStatus.OK

        login(request, user)
        return Response({'detail': message}, status=status)
