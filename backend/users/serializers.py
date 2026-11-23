from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.validators import validate_email
from django.db import transaction
from rest_framework import serializers

from users.models import EmailVerification, User


class UserRegisterSerializer(serializers.ModelSerializer):
    password2 = serializers.CharField(style={'input_type': 'password'}, write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2']
        extra_kwargs = {'password': {'write_only': True, 'style': {'input_type': 'password'}}}

    def validate_email(self, value):
        email = value.lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('user with this email already exists.')
        return email

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
            user = User.objects.filter(email__iexact=login).first()
            if user is None:
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


class ResetEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()


class UpdateEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def save(self, **kwargs):
        user = self.context['request'].user
        with transaction.atomic():
            (
                EmailVerification.objects.filter(user=user, type=EmailVerification.VERIFY_EMAIL, used=False).update(
                    used=True
                )
            )

            user.pending_email = self.validated_data['email']
            user.save(update_fields=['pending_email'])
        return user

    def validate_email(self, value):
        email = value.lower()
        user = self.context['request'].user

        if user.email.lower() == email:
            raise serializers.ValidationError('The new email must be different from your current one.')

        if User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
            raise serializers.ValidationError('Email already exists')

        return email


class PasswordSerializer(serializers.Serializer): ...


class ProfileSerializer(serializers.Serializer): ...
