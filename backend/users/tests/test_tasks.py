from datetime import timedelta

from django.core import mail
from django.test import TestCase, override_settings
from django.utils.timezone import now

from users.models import EmailVerification, User
from users.tasks import async_send_email

PASSWORD = 'Str0ng-pass-123'


@override_settings(DOMAIN_NAME='http://frontend.test')
class AsyncSendEmailTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='alice', email='alice@example.com', password=PASSWORD, pending_email='new@example.com'
        )

    def test_creates_one_hour_record_and_sends_link(self):
        before = now()

        async_send_email.delay(self.user.id, EmailVerification.REGISTER)

        record = EmailVerification.objects.get(user=self.user)
        self.assertEqual(record.type, EmailVerification.REGISTER)
        self.assertFalse(record.used)
        self.assertAlmostEqual(record.expiration, before + timedelta(hours=1), delta=timedelta(seconds=5))
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['alice@example.com'])
        self.assertIn(f'http://frontend.test/verify-email/{self.user.id}/{record.code}', mail.outbox[0].body)

    def test_each_call_gets_a_fresh_code(self):
        async_send_email.delay(self.user.id, EmailVerification.VERIFY_EMAIL)
        async_send_email.delay(self.user.id, EmailVerification.VERIFY_EMAIL)

        codes = set(EmailVerification.objects.values_list('code', flat=True))
        self.assertEqual(len(codes), 2)
        self.assertEqual([m.to for m in mail.outbox], [['new@example.com'], ['new@example.com']])
