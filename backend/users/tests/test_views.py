from django.core import mail
from django.test import Client, TestCase, override_settings
from django.urls import reverse

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

        self.assertEqual(response.status_code, 200)
        self.assertIn('csrftoken', response.cookies)


@override_settings(DOMAIN_NAME='http://frontend.test')
class RegisterTests(AuthTestCase):
    data = {'username': 'alice', 'email': 'alice@example.com', 'password': PASSWORD, 'password2': PASSWORD}

    def test_registers_signs_in_and_sends_verification_email(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.post('register', self.data)

        self.assertEqual(response.status_code, 201)
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

        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.exists())

    def test_rejects_mismatched_passwords(self):
        response = self.post('register', {**self.data, 'password2': 'Other-pass-123'})

        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json())
        self.assertFalse(User.objects.exists())

    def test_rejects_taken_email_and_username(self):
        User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)

        response = self.post('register', self.data)

        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.json())
        self.assertIn('username', response.json())


class LoginTests(AuthTestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def test_signs_in_with_username(self):
        response = self.post('login', {'login': 'bob', 'password': PASSWORD})

        self.assertEqual(response.status_code, 200)
        self.assertIn('sessionid', response.cookies)
        self.assertTrue(self.is_signed_in())

    def test_signs_in_with_email(self):
        response = self.post('login', {'login': 'bob@example.com', 'password': PASSWORD})

        self.assertEqual(response.status_code, 200)
        self.assertTrue(self.is_signed_in())

    def test_same_error_for_wrong_password_and_unknown_email(self):
        wrong_password = self.post('login', {'login': 'bob@example.com', 'password': 'Wrong-pass-123'})
        unknown_email = self.post('login', {'login': 'nobody@example.com', 'password': PASSWORD})

        self.assertEqual(wrong_password.status_code, 400)
        self.assertEqual(unknown_email.status_code, 400)
        self.assertEqual(wrong_password.json(), unknown_email.json())
        self.assertFalse(self.is_signed_in())

    def test_rejects_without_csrf_token(self):
        response = self.post('login', {'login': 'bob', 'password': PASSWORD}, with_csrf=False)

        self.assertEqual(response.status_code, 403)
        self.assertFalse(self.is_signed_in())


class LogoutTests(AuthTestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def test_signs_out(self):
        self.client.force_login(self.user)

        response = self.post('logout')

        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.is_signed_in())

    def test_rejects_without_csrf_token(self):
        self.client.force_login(self.user)

        response = self.post('logout', with_csrf=False)

        self.assertEqual(response.status_code, 403)
        self.assertTrue(self.is_signed_in())

    def test_needs_a_session(self):
        response = self.post('logout')

        self.assertIn(response.status_code, (401, 403))


@override_settings(DOMAIN_NAME='http://frontend.test')
class RecoveryTests(AuthTestCase):
    message = {'detail': 'If this email is registered, you will receive a link.'}

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def test_known_email_gets_reset_link(self):
        response = self.post('recovery', {'email': 'Bob@Example.com'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), self.message)
        record = EmailVerification.objects.get(user=self.user)
        self.assertEqual(record.type, EmailVerification.RESET_PASSWORD)
        self.assertFalse(record.used)
        self.assertFalse(record.is_expired())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(f'http://frontend.test/recovery/{self.user.id}/{record.code}', mail.outbox[0].body)

    def test_unknown_email_gets_same_answer_and_no_email(self):
        response = self.post('recovery', {'email': 'nobody@example.com'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), self.message)
        self.assertFalse(EmailVerification.objects.exists())
        self.assertEqual(mail.outbox, [])

    def test_rejects_invalid_email(self):
        response = self.post('recovery', {'email': 'not-an-email'})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(mail.outbox, [])
