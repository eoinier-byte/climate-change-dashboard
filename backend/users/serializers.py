from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.validators import validate_email
from django.db import transaction
from rest_framework import serializers

from common.serializers import PasswordSerializer
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
            raise serializers.ValidationError('A user with this email already exists.')
        return email

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})

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
                raise serializers.ValidationError({'detail': 'Invalid login or password.'})
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
        raise serializers.ValidationError({'detail': 'Invalid login or password.'})


class ResetEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(write_only=True)


class UpdateEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(write_only=True)

    @transaction.atomic
    def save(self, **kwargs):
        user = self.context['request'].user

        (EmailVerification.objects.filter(user=user, type=EmailVerification.VERIFY_EMAIL, used=False).update(used=True))

        user.pending_email = self.validated_data['email']
        user.save(update_fields=['pending_email'])
        return user

    def validate_email(self, value):
        email = value.lower()
        user = self.context['request'].user

        if user.email.lower() == email:
            raise serializers.ValidationError('The new email must be different from your current one.')

        if User.objects.filter(email__iexact=email).exclude(id=user.id).exists():
            raise serializers.ValidationError('A user with this email already exists.')

        return email


class ResetPasswordSerializer(PasswordSerializer): ...


class UpdatePasswordSerializer(PasswordSerializer):
    old_password = serializers.CharField(style={'input_type': 'password'}, write_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs['old_password'] == attrs['new_password']:
            raise serializers.ValidationError(
                {'new_password': 'The new password must be different from the current one.'}
            )
        return attrs

    def validate_old_password(self, value):
        user = self.context['user']
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value


class ProfileSerializer(serializers.Serializer): ...
