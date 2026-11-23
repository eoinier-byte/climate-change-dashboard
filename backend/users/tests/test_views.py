import uuid
from datetime import timedelta
from http import HTTPStatus

from django.core import mail
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils.timezone import now

from users.models import EmailVerification, User

PASSWORD = 'Str0ng-pass-123'


class AuthTestCase(TestCase):
    """The client enforces CSRF like a browser, so every POST needs the token from /csrf/."""

    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)

    def csrf_token(self):
        self.client.get(reverse('users:token'))
        return self.client.cookies['csrftoken'].value

    def post(self, name, data=None, with_csrf=True):
        headers = {'HTTP_X_CSRFTOKEN': self.csrf_token()} if with_csrf else {}
        return self.client.post(reverse(f'users:{name}'), data or {}, content_type='application/json', **headers)

    def is_signed_in(self):
        return '_auth_user_id' in self.client.session


class CsrfViewTests(AuthTestCase):
    def test_sets_csrf_cookie(self):
        response = self.client.get(reverse('users:token'))

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertIn('csrftoken', response.cookies)


@override_settings(DOMAIN_NAME='http://frontend.test')
class RegisterTests(AuthTestCase):
    data = {'username': 'alice', 'email': 'alice@example.com', 'password': PASSWORD, 'password2': PASSWORD}

    def test_registers_signs_in_and_sends_verification_email(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.post('register', self.data)

        self.assertEqual(response.status_code, HTTPStatus.CREATED)
        user = User.objects.get(username='alice')
        self.assertTrue(user.check_password(PASSWORD))
        self.assertFalse(user.is_verified)
        self.assertTrue(self.is_signed_in())

        record = EmailVerification.objects.get(user=user)
        self.assertEqual(record.type, EmailVerification.REGISTER)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['alice@example.com'])
        self.assertIn(f'http://frontend.test/verify-email/{user.id}/{record.code}', mail.outbox[0].body)

    def test_rejects_without_csrf_token(self):
        response = self.post('register', self.data, with_csrf=False)

        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertFalse(User.objects.exists())

    def test_rejects_mismatched_passwords(self):
        response = self.post('register', {**self.data, 'password2': 'Other-pass-123'})

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertIn('password', response.json())
        self.assertFalse(User.objects.exists())

    def test_rejects_taken_email_and_username(self):
        User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)

        response = self.post('register', self.data)

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertIn('email', response.json())
        self.assertIn('username', response.json())


class LoginTests(AuthTestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def test_signs_in_with_username(self):
        response = self.post('login', {'login': 'bob', 'password': PASSWORD})

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertIn('sessionid', response.cookies)
        self.assertTrue(self.is_signed_in())

    def test_signs_in_with_email_in_any_case(self):
        response = self.post('login', {'login': 'Bob@Example.com', 'password': PASSWORD})

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertTrue(self.is_signed_in())

    def test_same_error_for_wrong_password_and_unknown_email(self):
        wrong_password = self.post('login', {'login': 'bob@example.com', 'password': 'Wrong-pass-123'})
        unknown_email = self.post('login', {'login': 'nobody@example.com', 'password': PASSWORD})

        self.assertEqual(wrong_password.status_code, HTTPStatus.BAD_REQUEST)
        self.assertEqual(unknown_email.status_code, HTTPStatus.BAD_REQUEST)
        self.assertEqual(wrong_password.json(), unknown_email.json())
        self.assertFalse(self.is_signed_in())

    def test_rejects_without_csrf_token(self):
        response = self.post('login', {'login': 'bob', 'password': PASSWORD}, with_csrf=False)

        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertFalse(self.is_signed_in())


class LogoutTests(AuthTestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def test_signs_out(self):
        self.client.force_login(self.user)

        response = self.post('logout')

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertFalse(self.is_signed_in())

    def test_rejects_without_csrf_token(self):
        self.client.force_login(self.user)

        response = self.post('logout', with_csrf=False)

        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertTrue(self.is_signed_in())

    def test_needs_a_session(self):
        response = self.post('logout')

        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)


@override_settings(DOMAIN_NAME='http://frontend.test')
class RecoveryTests(AuthTestCase):
    message = {'detail': 'If this email is registered, you will receive a link.'}

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def test_known_email_gets_reset_link(self):
        response = self.post('recovery', {'email': 'Bob@Example.com'})

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json(), {**self.message, 'email': 'Bob@Example.com'})
        record = EmailVerification.objects.get(user=self.user)
        self.assertEqual(record.type, EmailVerification.RESET_PASSWORD)
        self.assertFalse(record.used)
        self.assertFalse(record.is_expired())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(f'http://frontend.test/recovery/{self.user.id}/{record.code}', mail.outbox[0].body)

    def test_unknown_email_gets_same_answer_and_no_email(self):
        response = self.post('recovery', {'email': 'nobody@example.com'})

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json(), {**self.message, 'email': 'nobody@example.com'})
        self.assertFalse(EmailVerification.objects.exists())
        self.assertEqual(mail.outbox, [])

    def test_rejects_invalid_email(self):
        response = self.post('recovery', {'email': 'not-an-email'})

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertEqual(mail.outbox, [])


class EmailVerificationViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)
        cls.other = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def make(self, email_type=EmailVerification.REGISTER, expires_in=timedelta(hours=1), user=None, used=False):
        return EmailVerification.objects.create(
            code=uuid.uuid4(), user=user or self.user, expiration=now() + expires_in, type=email_type, used=used
        )

    def get(self, user_id, code, method='post'):
        url = reverse('users:verify', kwargs={'user_id': user_id, 'code': code})
        return getattr(self.client, method)(url)

    def assert_not_verified(self, user=None):
        user = user or self.user
        user.refresh_from_db()
        self.assertFalse(user.is_verified)

    def set_pending(self, email):
        User.objects.filter(pk=self.user.pk).update(pending_email=email)

    def test_registration_link_verifies_current_email(self):
        self.set_pending('new@example.com')
        record = self.make(EmailVerification.REGISTER)

        response = self.get(self.user.id, record.code)

        self.assertEqual(response.status_code, HTTPStatus.ACCEPTED)
        self.user.refresh_from_db()
        record.refresh_from_db()
        self.assertTrue(self.user.is_verified)
        self.assertTrue(record.used)
        self.assertEqual(self.user.email, 'alice@example.com')
        self.assertEqual(self.user.pending_email, 'new@example.com')

    def test_email_change_link_moves_pending_email(self):
        self.set_pending('new@example.com')
        record = self.make(EmailVerification.VERIFY_EMAIL)

        response = self.get(self.user.id, record.code)

        self.assertEqual(response.status_code, HTTPStatus.ACCEPTED)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'new@example.com')
        self.assertIsNone(self.user.pending_email)
        self.assertTrue(self.user.is_verified)

    def test_email_change_link_without_pending_email_is_gone(self):
        record = self.make(EmailVerification.VERIFY_EMAIL)

        response = self.get(self.user.id, record.code)

        self.assertEqual(response.status_code, HTTPStatus.GONE)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'alice@example.com')
        self.assertFalse(self.user.is_verified)

    def test_email_taken_meanwhile_is_conflict(self):
        self.set_pending('Bob@Example.com')
        record = self.make(EmailVerification.VERIFY_EMAIL)

        response = self.get(self.user.id, record.code)

        self.assertEqual(response.status_code, HTTPStatus.CONFLICT)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'alice@example.com')
        self.assertIsNone(self.user.pending_email)

    def test_expired_and_used_links_keep_pending_email(self):
        self.set_pending('new@example.com')
        expired = self.make(EmailVerification.VERIFY_EMAIL, expires_in=timedelta(seconds=-1))
        used = self.make(EmailVerification.VERIFY_EMAIL, used=True)

        for record in (expired, used):
            with self.subTest(used=record.used):
                self.assertEqual(self.get(self.user.id, record.code).status_code, HTTPStatus.GONE)

        self.user.refresh_from_db()
        self.assertEqual(self.user.pending_email, 'new@example.com')
        self.assertEqual(self.user.email, 'alice@example.com')

    def test_unknown_code_is_not_found(self):
        response = self.get(self.user.id, uuid.uuid4())

        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
        self.assert_not_verified()

    def test_code_of_another_user_is_not_found(self):
        record = self.make(user=self.other)

        response = self.get(self.user.id, record.code)

        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
        self.assert_not_verified()
        self.assert_not_verified(self.other)

    def test_expired_link_is_gone_and_marked_used(self):
        record = self.make(expires_in=timedelta(seconds=-1))

        response = self.get(self.user.id, record.code)

        self.assertEqual(response.status_code, HTTPStatus.GONE)
        record.refresh_from_db()
        self.assertTrue(record.used)
        self.assert_not_verified()

    def test_used_link_cannot_be_reused(self):
        record = self.make(used=True)

        response = self.get(self.user.id, record.code)

        self.assertEqual(response.status_code, HTTPStatus.GONE)
        self.assert_not_verified()

    def test_password_reset_code_does_not_verify_email(self):
        record = self.make(EmailVerification.RESET_PASSWORD)

        response = self.get(self.user.id, record.code)

        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)
        self.assert_not_verified()
        record.refresh_from_db()
        self.assertFalse(record.used)

    def test_get_is_not_allowed(self):
        record = self.make()

        response = self.get(self.user.id, record.code, method='get')

        self.assertEqual(response.status_code, HTTPStatus.METHOD_NOT_ALLOWED)
        self.assert_not_verified()
        record.refresh_from_db()
        self.assertFalse(record.used)


@override_settings(DOMAIN_NAME='http://frontend.test')
class ChangeEmailTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='alice', email='alice@example.com', password=PASSWORD, is_verified=True
        )
        User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def setUp(self):
        self.client.force_login(self.user)

    def change(self, email):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(
                reverse('users:profile-change-email'), {'email': email}, content_type='application/json'
            )

    def test_needs_a_session(self):
        self.client.logout()

        response = self.change('new@example.com')

        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertEqual(mail.outbox, [])

    def test_keeps_current_email_until_confirmed_and_mails_new_address(self):
        response = self.change('New@Example.com')

        self.assertEqual(response.status_code, HTTPStatus.ACCEPTED)
        self.assertEqual(response.json()['email'], 'new@example.com')
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'alice@example.com')
        self.assertEqual(self.user.pending_email, 'new@example.com')
        self.assertTrue(self.user.is_verified)
        record = EmailVerification.objects.get(user=self.user)
        self.assertEqual(record.type, EmailVerification.VERIFY_EMAIL)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['new@example.com'])
        self.assertIn(f'http://frontend.test/email-updated/{self.user.id}/{record.code}', mail.outbox[0].body)

    def test_new_request_invalidates_earlier_link(self):
        self.change('first@example.com')
        first = EmailVerification.objects.get(user=self.user)

        self.change('second@example.com')

        first.refresh_from_db()
        self.assertTrue(first.used)
        response = self.client.post(reverse('users:verify', kwargs={'user_id': self.user.id, 'code': first.code}))
        self.assertEqual(response.status_code, HTTPStatus.GONE)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'alice@example.com')
        self.assertEqual(self.user.pending_email, 'second@example.com')

    def test_link_from_email_confirms_change(self):
        self.change('new@example.com')
        record = EmailVerification.objects.get(user=self.user)

        response = self.client.post(reverse('users:verify', kwargs={'user_id': self.user.id, 'code': record.code}))

        self.assertEqual(response.status_code, HTTPStatus.ACCEPTED)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'new@example.com')
        self.assertIsNone(self.user.pending_email)

    def test_rejected_email_sends_nothing(self):
        for email in ('Alice@Example.com', 'Bob@Example.com', 'not-an-email'):
            with self.subTest(email=email):
                response = self.change(email)

                self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
                self.user.refresh_from_db()
                self.assertIsNone(self.user.pending_email)
                self.assertEqual(mail.outbox, [])
