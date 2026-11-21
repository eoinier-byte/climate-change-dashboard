from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.validators import validate_email
from rest_framework import serializers

from users.models import User


class UserRegisterSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(style={'input_type': 'password'}, write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2']
        extra_kwargs = {'password': {'write_only': True, 'style': {'input_type': 'password'}}}

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': "Password fields didn't match."})
        return attrs

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'], email=validated_data['email'], password=validated_data['password']
        )
        return user


class UserLoginSerializer(serializers.Serializer):
    login = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'}, validators=[validate_password])

    def validate(self, attrs):
        login = attrs['login']
        if '@' in login:
            try:
                user = User.objects.get(email=login)
            except User.DoesNotExist:
                raise serializers.ValidationError({'detail': 'Invalid login or password'})
            validate_email(login)
            username = user.username
        else:
            validate_username = UnicodeUsernameValidator()
            validate_username(login)
            username = login

        user = authenticate(self.context['request'], password=attrs['password'], username=username)

        if user:
            attrs['user'] = user
            return attrs
        raise serializers.ValidationError({'detail': 'Invalid login or password'})


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
