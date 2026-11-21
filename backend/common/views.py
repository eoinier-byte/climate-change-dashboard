from http import HTTPStatus

from django.contrib.auth import login
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView

from users.serializers import UserRegisterSerializer


class EnforceCsrfMixin:
    def initial(self, request, *args, **kwargs):
        SessionAuthentication().enforce_csrf(request)
        super().initial(request, *args, **kwargs)


class AuthView(EnforceCsrfMixin, APIView):
    http_method_names = ['post']
    serializer_class = None

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})

        if not serializer.is_valid():
            return Response(serializer.errors, status=HTTPStatus.BAD_REQUEST)

        if isinstance(serializer, UserRegisterSerializer):
            user = serializer.save()
            message = 'User registered successfully'
            status = HTTPStatus.CREATED
        else:
            user = serializer.validated_data['user']
            message = 'User signed in successfully'
            status = HTTPStatus.OK

        login(request, user)
        return Response({'detail': message}, status=status)
