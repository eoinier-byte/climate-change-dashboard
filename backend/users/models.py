from typing import Iterable

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.mail import send_mail
from django.db import models
from django.utils.timezone import now

# Create your models here.


class EmailVerificationQuerySet(models.query.QuerySet):
    def find_record(self, user_id: int, code: str, types: Iterable[str]) -> 'EmailVerification | None':
        return self.select_related('user').filter(code=code, user_id=user_id, type__in=types).first()


class User(AbstractUser):
    email = models.EmailField(unique=True)
    pending_email = models.EmailField(blank=True, null=True)
    name = models.CharField(max_length=50, blank=True, null=True)
    avatar = models.ImageField(upload_to='users', blank=True, null=True)
    is_verified = models.BooleanField(default=False)

    first_name = None
    last_name = None

    def __str__(self):
        return f'{self.id}-{self.username}'


class EmailVerification(models.Model):
    RESET_PASSWORD = 'reset'
    VERIFY_EMAIL = 'verification'
    REGISTER = 'registration'

    TYPE_CHOICES = (
        (RESET_PASSWORD, 'Password reset'),
        (VERIFY_EMAIL, 'Email verification'),
        (REGISTER, 'Registration'),
    )

    FRONTEND_PATHS = {
        RESET_PASSWORD: '/recovery',
        REGISTER: '/verify-email',
        VERIFY_EMAIL: '/email-updated',
    }

    code = models.UUIDField(editable=False, unique=True)
    user = models.ForeignKey('users.User', on_delete=models.CASCADE)
    expiration = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    type = models.CharField(max_length=40, choices=TYPE_CHOICES, default=None)
    used = models.BooleanField(default=False)

    objects = EmailVerificationQuerySet.as_manager()

    def _wrap_message(self, message: str) -> str:
        return (
            f'Dear {self.user.name or self.user.username},\n\n'
            f'{message}'
            'Kind regards,\n'
            f'The {settings.SITE_NAME} Team\n\n'
            'This is an automated message. Please do not reply to this email.\n'
        )

    def _build_link(self) -> str:
        path = self.FRONTEND_PATHS[self.type]
        return f'{settings.DOMAIN_NAME.rstrip("/")}{path}/{self.user.id}/{self.code}'

    @property
    def recipient(self) -> str:
        if self.type == self.VERIFY_EMAIL:
            return self.user.pending_email
        return self.user.email

    def send_email(self) -> None:
        link = self._build_link()
        if self.type == self.RESET_PASSWORD:
            subject = f'{settings.SITE_NAME}: password reset request'
            message = self._wrap_message(
                f'We have received a request to reset the password for your {settings.SITE_NAME} account.\n\n'
                'To set a new password, please follow the link below:\n'
                f'{link}\n\n'
                'If you did not request a password reset, no action is required. '
                'Your password will remain unchanged.\n\n'
            )

        elif self.type == self.REGISTER:
            subject = f'{settings.SITE_NAME}: please verify your email address'
            message = self._wrap_message(
                f'Thank you for registering with {settings.SITE_NAME}.\n\n'
                'To complete your registration, please verify your email address by following the link below:\n'
                f'{link}\n\n'
                f'If you did not create an account with {settings.SITE_NAME}, please disregard this email.\n\n'
            )

        elif self.type == self.VERIFY_EMAIL:
            subject = f'{settings.SITE_NAME}: confirm your new email address'
            message = self._wrap_message(
                f'We have received a request to change the email address associated with your '
                f'{settings.SITE_NAME} account.\n\n'
                'To confirm this change, please follow the link below:\n'
                f'{link}\n\n'
                'If you did not request this change, please disregard this email. '
                'Your current email address will remain unchanged.\n\n'
            )
        else:
            raise ValueError('Message type is invalid')

        send_mail(
            subject=subject,
            message=message,
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[self.recipient],
        )

    def is_expired(self) -> bool:
        return self.expiration < now()

    def __str__(self) -> str:
        return f'{self.user.username}-{self.type}'
