import uuid
from datetime import timedelta

from django.core import mail
from django.test import TestCase, override_settings
from django.utils.timezone import now

from users.models import EmailVerification, User


@override_settings(DOMAIN_NAME='http://frontend.test/')
class EmailVerificationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='alice',
            email='alice@example.com',
            password='Str0ng-pass-123',
            pending_email='new@example.com',
        )

    def make(self, email_type, expires_in=timedelta(hours=1)):
        return EmailVerification.objects.create(
            code=uuid.uuid4(), user=self.user, expiration=now() + expires_in, type=email_type
        )

    def test_is_expired(self):
        self.assertFalse(self.make(EmailVerification.REGISTER).is_expired())
        self.assertTrue(self.make(EmailVerification.REGISTER, expires_in=timedelta(seconds=-1)).is_expired())

    def test_str(self):
        self.assertEqual(str(self.make(EmailVerification.RESET_PASSWORD)), 'alice-reset')

    def test_each_type_sends_one_email_with_its_link(self):
        cases = [
            (EmailVerification.RESET_PASSWORD, 'password reset request', '/recovery/', 'alice@example.com'),
            (EmailVerification.REGISTER, 'please verify your email address', '/verify-email/', 'alice@example.com'),
            (EmailVerification.VERIFY_EMAIL, 'confirm your new email address', '/email-updated/', 'new@example.com'),
        ]
        for email_type, subject, path, recipient in cases:
            with self.subTest(email_type=email_type):
                mail.outbox = []
                record = self.make(email_type)

                record.send_email()

                self.assertEqual(len(mail.outbox), 1)
                message = mail.outbox[0]
                self.assertEqual(message.to, [recipient])
                self.assertIn(subject, message.subject)
                self.assertIn(f'http://frontend.test{path}{self.user.id}/{record.code}', message.body)
                self.assertIn('Dear alice', message.body)

    def test_greeting_uses_name_when_set(self):
        self.user.name = 'Alice Smith'
        self.user.save()

        self.make(EmailVerification.REGISTER).send_email()

        self.assertIn('Dear Alice Smith', mail.outbox[0].body)

    def test_unknown_type_raises(self):
        record = self.make(EmailVerification.REGISTER)
        record.type = 'something-else'

        with self.assertRaises((ValueError, KeyError)):
            record.send_email()
        self.assertEqual(mail.outbox, [])
