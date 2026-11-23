import uuid
from datetime import timedelta

from django.test import RequestFactory, TestCase
from django.utils.timezone import now

from users.models import EmailVerification, User
from users.serializers import UpdateEmailSerializer, UserRegisterSerializer

PASSWORD = 'Str0ng-pass-123'


class UpdateEmailSerializerTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='alice', email='alice@example.com', password=PASSWORD, is_verified=True
        )
        User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def serializer(self, email):
        request = RequestFactory().post('/')
        request.user = self.user
        return UpdateEmailSerializer(data={'email': email}, context={'request': request})

    def test_lowercases_new_email(self):
        serializer = self.serializer('New@Example.com')

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['email'], 'new@example.com')

    def test_rejects_current_email_when_verified(self):
        serializer = self.serializer('Alice@Example.com')

        self.assertFalse(serializer.is_valid())
        self.assertIn('email', serializer.errors)

    def test_rejects_email_of_another_user(self):
        serializer = self.serializer('Bob@Example.com')

        self.assertFalse(serializer.is_valid())
        self.assertIn('email', serializer.errors)

    def test_rejects_invalid_email(self):
        serializer = self.serializer('not-an-email')

        self.assertFalse(serializer.is_valid())
        self.assertIn('email', serializer.errors)

    def test_rejects_current_email_when_not_verified(self):
        User.objects.filter(pk=self.user.pk).update(is_verified=False)
        self.user.refresh_from_db()

        serializer = self.serializer('alice@example.com')

        self.assertFalse(serializer.is_valid())
        self.assertIn('email', serializer.errors)

    def test_save_stores_pending_email_only(self):
        serializer = self.serializer('new@example.com')
        serializer.is_valid(raise_exception=True)

        serializer.save()

        self.user.refresh_from_db()
        self.assertEqual(self.user.pending_email, 'new@example.com')
        self.assertEqual(self.user.email, 'alice@example.com')
        self.assertTrue(self.user.is_verified)

    def test_save_invalidates_earlier_email_change_links_only(self):
        old_change = EmailVerification.objects.create(
            code=uuid.uuid4(),
            user=self.user,
            expiration=now() + timedelta(hours=1),
            type=EmailVerification.VERIFY_EMAIL,
        )
        reset = EmailVerification.objects.create(
            code=uuid.uuid4(),
            user=self.user,
            expiration=now() + timedelta(hours=1),
            type=EmailVerification.RESET_PASSWORD,
        )
        serializer = self.serializer('new@example.com')
        serializer.is_valid(raise_exception=True)

        serializer.save()

        old_change.refresh_from_db()
        reset.refresh_from_db()
        self.assertTrue(old_change.used)
        self.assertFalse(reset.used)


class UserRegisterSerializerTests(TestCase):
    data = {'username': 'carol', 'email': 'Carol@Example.com', 'password': PASSWORD, 'password2': PASSWORD}

    def test_lowercases_email(self):
        serializer = UserRegisterSerializer(data=self.data)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['email'], 'carol@example.com')

    def test_rejects_email_taken_in_another_case(self):
        User.objects.create_user(username='other', email='carol@example.com', password=PASSWORD)

        serializer = UserRegisterSerializer(data=self.data)

        self.assertFalse(serializer.is_valid())
        self.assertIn('email', serializer.errors)
