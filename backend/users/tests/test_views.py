import io
import shutil
import tempfile
import uuid
from datetime import timedelta
from http import HTTPStatus
from pathlib import Path

from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse
from django.utils.timezone import now
from PIL import Image
from rest_framework.test import APIClient

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
    message = {'detail': 'If an account with this email exists, a password reset link has been sent to it.'}

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def test_known_email_gets_reset_link(self):
        response = self.post('recovery', {'email': 'Bob@Example.com'})

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json(), self.message)
        record = EmailVerification.objects.get(user=self.user)
        self.assertEqual(record.type, EmailVerification.RESET_PASSWORD)
        self.assertFalse(record.used)
        self.assertFalse(record.is_expired())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(f'http://frontend.test/recovery/{self.user.id}/{record.code}', mail.outbox[0].body)

    def test_unknown_email_gets_same_answer_and_no_email(self):
        response = self.post('recovery', {'email': 'nobody@example.com'})

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json(), self.message)
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
            return self.client.patch(
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


class PasswordResetViewTests(TestCase):
    new_password = 'N3w-Str0ng-pass-456'

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)
        cls.other = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def make(self, email_type=EmailVerification.RESET_PASSWORD, expires_in=timedelta(hours=1), user=None, used=False):
        return EmailVerification.objects.create(
            code=uuid.uuid4(), user=user or self.user, expiration=now() + expires_in, type=email_type, used=used
        )

    def url(self, code):
        return reverse('users:reset', kwargs={'user_id': self.user.id, 'code': code})

    def reset(self, code, password=None, password2=None):
        password = password or self.new_password
        data = {'new_password': password, 'new_password2': password2 or password}
        return self.client.post(self.url(code), data, content_type='application/json')

    def assert_password_unchanged(self, user=None):
        user = user or self.user
        user.refresh_from_db()
        self.assertTrue(user.check_password(PASSWORD))

    def test_get_confirms_valid_link_without_using_it(self):
        record = self.make()

        response = self.client.get(self.url(record.code))

        self.assertEqual(response.status_code, HTTPStatus.OK)
        record.refresh_from_db()
        self.assertFalse(record.used)

    def test_unknown_or_foreign_code_is_not_found(self):
        cases = {
            'unknown code': uuid.uuid4(),
            'code of another user': self.make(user=self.other).code,
            'email verification code': self.make(EmailVerification.REGISTER).code,
        }
        for name, code in cases.items():
            with self.subTest(name):
                self.assertEqual(self.client.get(self.url(code)).status_code, HTTPStatus.NOT_FOUND)
                self.assertEqual(self.reset(code).status_code, HTTPStatus.NOT_FOUND)

        self.assert_password_unchanged()
        self.assert_password_unchanged(self.other)

    def test_used_and_expired_links_are_gone(self):
        for record in (self.make(used=True), self.make(expires_in=timedelta(seconds=-1))):
            with self.subTest(used=record.used):
                self.assertEqual(self.client.get(self.url(record.code)).status_code, HTTPStatus.GONE)
                self.assertEqual(self.reset(record.code).status_code, HTTPStatus.GONE)

        self.assert_password_unchanged()

    def test_sets_new_password_and_uses_all_reset_links(self):
        record = self.make()
        older = self.make()
        verification = self.make(EmailVerification.REGISTER)

        response = self.reset(record.code)

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))
        for link, used in ((record, True), (older, True), (verification, False)):
            link.refresh_from_db()
            self.assertEqual(link.used, used)

    def test_link_works_only_once(self):
        record = self.make()
        self.reset(record.code)

        response = self.reset(record.code, password='An0ther-pass-789')

        self.assertEqual(response.status_code, HTTPStatus.GONE)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))

    def test_invalid_password_keeps_link_usable(self):
        cases = {
            'mismatch': (self.new_password, 'Different-pass-789'),
            'too common': ('password', None),
            'numeric': ('1234567890', None),
            'similar to username': ('alice7319', None),
        }
        record = self.make()
        for name, (password, password2) in cases.items():
            with self.subTest(name):
                response = self.reset(record.code, password, password2)

                self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
                record.refresh_from_db()
                self.assertFalse(record.used)

        self.assert_password_unchanged()
        self.assertEqual(self.reset(record.code).status_code, HTTPStatus.OK)

    def test_changes_link_owner_not_signed_in_user(self):
        self.client.force_login(self.other)

        response = self.reset(self.make().code)

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))
        self.assert_password_unchanged(self.other)

    def test_signs_out_existing_sessions(self):
        session = Client()
        session.force_login(self.user)

        self.reset(self.make().code)

        self.assertEqual(session.post(reverse('users:logout')).status_code, HTTPStatus.FORBIDDEN)


class ChangePasswordTests(TestCase):
    new_password = 'N3w-Str0ng-pass-456'

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)

    def setUp(self):
        self.client.force_login(self.user)

    def change(self, old=PASSWORD, new=None, new2=None):
        new = new or self.new_password
        data = {'old_password': old, 'new_password': new, 'new_password2': new2 or new}
        return self.client.patch(reverse('users:profile-change-password'), data, content_type='application/json')

    def assert_password_unchanged(self):
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_needs_a_session(self):
        self.client.logout()

        response = self.change()

        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assert_password_unchanged()

    def test_changes_password_and_keeps_current_session(self):
        response = self.change()

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(self.new_password))
        self.assertEqual(self.client.post(reverse('users:logout')).status_code, HTTPStatus.OK)

    def test_signs_out_other_sessions(self):
        other_session = Client()
        other_session.force_login(self.user)

        self.change()

        self.assertEqual(other_session.post(reverse('users:logout')).status_code, HTTPStatus.FORBIDDEN)

    def test_rejects_invalid_input(self):
        cases = {
            'wrong current password': ('Wrong-pass-123', self.new_password, None, 'old_password'),
            'same as current': (PASSWORD, PASSWORD, None, 'new_password'),
            'mismatch': (PASSWORD, self.new_password, 'Different-pass-789', 'new_password'),
        }
        for name, (old, new, new2, field) in cases.items():
            with self.subTest(name):
                response = self.change(old, new, new2)

                self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
                self.assertIn(field, response.json())

        self.assert_password_unchanged()

    def test_rejects_weak_password(self):
        for password in ('password', '1234567890', 'alice7319'):
            with self.subTest(password=password):
                self.assertEqual(self.change(new=password).status_code, HTTPStatus.BAD_REQUEST)

        self.assert_password_unchanged()


def make_image(name='avatar.png', size=(300, 300), image_format='PNG'):
    buffer = io.BytesIO()
    Image.new('RGB', size, 'red').save(buffer, image_format)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=f'image/{image_format.lower()}')


class ProfileTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username='alice', email='alice@example.com', password=PASSWORD, name='Alice', is_verified=True
        )
        User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def setUp(self):
        self.client.force_login(self.user)

    def update(self, data, method='patch'):
        return getattr(self.client, method)(reverse('users:profile-update-me'), data, content_type='application/json')

    def test_needs_a_session(self):
        self.client.logout()

        self.assertEqual(self.client.get(reverse('users:profile-me')).status_code, HTTPStatus.FORBIDDEN)
        self.assertEqual(self.update({'name': 'Mallory'}).status_code, HTTPStatus.FORBIDDEN)

    def test_me_returns_own_profile(self):
        response = self.client.get(reverse('users:profile-me'))

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(
            response.json(),
            {
                'username': 'alice',
                'name': 'Alice',
                'email': 'alice@example.com',
                'avatar': None,
                'is_verified': True,
                'pending_email': None,
            },
        )

    def test_patch_updates_name_and_username(self):
        response = self.update({'name': 'Alice Smith', 'username': 'alice.smith'})

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json()['name'], 'Alice Smith')
        self.user.refresh_from_db()
        self.assertEqual(self.user.name, 'Alice Smith')
        self.assertEqual(self.user.username, 'alice.smith')

    def test_put_requires_username(self):
        response = self.update({'name': 'Alice Smith'}, method='put')

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertIn('username', response.json())

    def test_read_only_fields_are_ignored(self):
        response = self.update(
            {'email': 'mallory@example.com', 'is_verified': False, 'pending_email': 'mallory@example.com'}
        )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'alice@example.com')
        self.assertTrue(self.user.is_verified)
        self.assertIsNone(self.user.pending_email)

    def test_rejects_invalid_username_and_name(self):
        cases = {
            'taken username': {'username': 'bob'},
            'invalid username': {'username': 'not valid!'},
            'name too long': {'name': 'x' * 51},
        }
        for case, data in cases.items():
            with self.subTest(case):
                response = self.update(data)

                self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
                self.assertIn(next(iter(data)), response.json())

        self.user.refresh_from_db()
        self.assertEqual((self.user.username, self.user.name), ('alice', 'Alice'))


class ProfileRoutesTests(TestCase):
    """The profile endpoints act on the signed-in user only; other users must not be reachable."""

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)
        cls.other = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)

    def setUp(self):
        self.client.force_login(self.user)

    def test_users_cannot_be_listed(self):
        response = self.client.get('/api/auth/profile/')

        self.assertEqual(response.status_code, HTTPStatus.NOT_FOUND)

    def test_other_user_cannot_be_read_changed_or_deleted(self):
        url = f'/api/auth/profile/{self.other.pk}/'
        requests = {
            'get': lambda: self.client.get(url),
            'patch': lambda: self.client.patch(url, {'username': 'hacked'}, content_type='application/json'),
            'delete': lambda: self.client.delete(url),
        }
        for method, send in requests.items():
            with self.subTest(method):
                self.assertEqual(send().status_code, HTTPStatus.NOT_FOUND)

        self.assertTrue(User.objects.filter(pk=self.other.pk, username='bob').exists())


MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class ChangeAvatarTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)

    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)

    def setUp(self):
        self.client = APIClient()
        self.client.force_login(self.user)

    def upload(self, image, method='patch'):
        with self.captureOnCommitCallbacks(execute=True):
            return getattr(self.client, method)(
                reverse('users:profile-change-avatar'), {'avatar': image}, format='multipart'
            )

    def avatar(self):
        self.user.refresh_from_db()
        return self.user.avatar

    def test_needs_a_session(self):
        self.client.logout()

        response = self.upload(make_image())

        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertFalse(self.avatar())

    def test_large_image_is_cropped_to_avatar_size(self):
        for size in ((300, 300), (800, 400), (250, 600)):
            with self.subTest(size=size):
                response = self.upload(make_image(size=size))

                self.assertEqual(response.status_code, HTTPStatus.OK)
                with Image.open(self.avatar().path) as saved:
                    self.assertEqual(saved.size, (User.AVATAR_WIDTH, User.AVATAR_HEIGHT))

    def test_small_image_is_kept_as_is(self):
        response = self.upload(make_image(size=(150, 150)))

        self.assertEqual(response.status_code, HTTPStatus.OK)
        with Image.open(self.avatar().path) as saved:
            self.assertEqual(saved.size, (150, 150))

    def test_heic_photo_is_stored_as_jpeg(self):
        for size in ((300, 300), (150, 120)):
            with self.subTest(size=size):
                response = self.upload(make_image('photo.heic', size=size, image_format='HEIF'))

                self.assertEqual(response.status_code, HTTPStatus.OK)
                avatar = self.avatar()
                self.assertEqual(Path(avatar.name).suffix, '.jpg')
                with Image.open(avatar.path) as saved:
                    self.assertEqual(saved.format, 'JPEG')
                    self.assertEqual(saved.size, (min(size[0], User.AVATAR_WIDTH), min(size[1], User.AVATAR_HEIGHT)))

        self.assertEqual(list(Path(MEDIA_ROOT).rglob('*.heic')), [])

    def test_put_works_like_patch(self):
        self.assertEqual(self.upload(make_image(), method='put').status_code, HTTPStatus.OK)
        self.assertTrue(self.avatar())

    def test_new_avatar_replaces_and_deletes_old_file(self):
        self.upload(make_image('first.png'))
        old_path = self.avatar().path

        self.upload(make_image('second.png'))

        new = self.avatar()
        self.assertNotEqual(new.path, old_path)
        self.assertFalse(Path(old_path).exists())
        self.assertTrue(Path(new.path).exists())

    def test_profile_shows_avatar_url(self):
        self.upload(make_image())

        response = self.client.get(reverse('users:profile-me'))

        self.assertTrue(response.json()['avatar'].endswith(Path(self.avatar().name).name))

    def test_rejects_too_small_image(self):
        size = (User.MIN_AVATAR_WIDTH - 1, User.MIN_AVATAR_HEIGHT)

        response = self.upload(make_image(size=size))

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertIn('avatar', response.json())
        self.assertFalse(self.avatar())

    def test_rejects_file_that_is_not_an_image(self):
        fake = SimpleUploadedFile('avatar.png', b'not an image', content_type='image/png')

        response = self.upload(fake)

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertFalse(self.avatar())

    def test_rejects_disallowed_extension(self):
        response = self.upload(make_image('avatar.gif', image_format='GIF'))

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assertFalse(self.avatar())

    def test_put_without_file_is_rejected(self):
        response = self.client.put(reverse('users:profile-change-avatar'), {}, format='multipart')

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class DeleteAvatarTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)
        self.client.force_login(self.user)

    def give_avatar(self):
        self.user.avatar.save('avatar.png', make_image(), save=True)
        return Path(self.user.avatar.path)

    def delete_avatar(self):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.delete(reverse('users:profile-delete-avatar'))

    def test_needs_a_session(self):
        path = self.give_avatar()
        self.client.logout()

        response = self.delete_avatar()

        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertTrue(path.exists())

    def test_removes_avatar_and_its_file(self):
        path = self.give_avatar()

        response = self.delete_avatar()

        self.assertEqual(response.status_code, HTTPStatus.NO_CONTENT)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar)
        self.assertFalse(path.exists())
        self.assertIsNone(self.client.get(reverse('users:profile-me')).json()['avatar'])

    def test_without_avatar_does_nothing(self):
        response = self.delete_avatar()

        self.assertEqual(response.status_code, HTTPStatus.NO_CONTENT)
        self.user.refresh_from_db()
        self.assertFalse(self.user.avatar)

    def test_new_avatar_can_be_uploaded_after_deletion(self):
        self.give_avatar()
        self.delete_avatar()
        client = APIClient()
        client.force_login(self.user)

        with self.captureOnCommitCallbacks(execute=True):
            response = client.patch(
                reverse('users:profile-change-avatar'), {'avatar': make_image('new.png')}, format='multipart'
            )

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.user.refresh_from_db()
        self.assertTrue(Path(self.user.avatar.path).exists())


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class DeleteAccountTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)
        self.other = User.objects.create_user(username='bob', email='bob@example.com', password=PASSWORD)
        self.client.force_login(self.user)

    def delete_account(self):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.delete(reverse('users:profile-delete-me'))

    def test_needs_a_session(self):
        self.client.logout()

        response = self.delete_account()

        self.assertEqual(response.status_code, HTTPStatus.FORBIDDEN)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_deletes_only_own_account_and_its_links(self):
        EmailVerification.objects.create(
            code=uuid.uuid4(), user=self.user, expiration=now() + timedelta(hours=1), type=EmailVerification.REGISTER
        )

        response = self.delete_account()

        self.assertEqual(response.status_code, HTTPStatus.NO_CONTENT)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
        self.assertFalse(EmailVerification.objects.filter(user_id=self.user.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.other.pk).exists())

    def test_removes_avatar_file(self):
        self.user.avatar.save('avatar.png', make_image(), save=True)
        path = Path(self.user.avatar.path)

        self.delete_account()

        self.assertFalse(path.exists())

    def test_ends_the_session(self):
        self.delete_account()

        self.assertNotIn('_auth_user_id', self.client.session)
        self.assertEqual(self.client.get(reverse('users:profile-me')).status_code, HTTPStatus.FORBIDDEN)

    def test_account_cannot_sign_in_afterwards(self):
        self.delete_account()

        response = Client().post(
            reverse('users:login'), {'login': 'alice', 'password': PASSWORD}, content_type='application/json'
        )

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
