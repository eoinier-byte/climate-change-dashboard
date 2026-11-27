"""CCD-313 / CCD-312: no API response leaks a password, a password hash, or another user's data.

Covers the account endpoints that exist on main: register, login, profile (me), change-email and
change-password. Each test checks the success response and, where it applies, an error response,
because error bodies echo back field errors and are an easy place for a submitted value to leak.
"""

import json
from http import HTTPStatus

from django.test import Client, TestCase
from django.urls import reverse

from users.models import User

PASSWORD = 'Str0ng-pass-123'
NEW_PASSWORD = 'N3w-Str0ng-pass-456'
OTHER_PASSWORD = 'Oth3r-Str0ng-pass-789'

# Prefixes of the hash formats Django can store in users_user.password (algorithm$...)
HASH_PREFIXES = ('pbkdf2_sha256$', 'pbkdf2_sha1$', 'argon2', 'bcrypt$', 'bcrypt_sha256$', 'scrypt$', 'md5$')


def json_keys(data):
    """Every key in a JSON body, at any depth."""
    if isinstance(data, dict):
        for key, value in data.items():
            yield key
            yield from json_keys(value)
    elif isinstance(data, list):
        for item in data:
            yield from json_keys(item)


class NoPasswordInResponsesTests(TestCase):
    def setUp(self):
        # Enforce CSRF like a browser, as the auth views do (common.views.EnforceCsrfMixin)
        self.client = Client(enforce_csrf_checks=True)
        self.other = User.objects.create_user(username='bob', email='bob@example.com', password=OTHER_PASSWORD)

    # helpers

    def csrf_headers(self):
        self.client.get(reverse('users:token'))
        return {'HTTP_X_CSRFTOKEN': self.client.cookies['csrftoken'].value}

    def post(self, name, data):
        return self.client.post(reverse(name), data, content_type='application/json', **self.csrf_headers())

    def patch(self, name, data):
        return self.client.patch(reverse(name), data, content_type='application/json', **self.csrf_headers())

    def sign_in_alice(self):
        self.alice = User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)
        self.client.force_login(self.alice)

    def assert_no_secret(self, response, *plain_passwords, check_keys=True):
        """The body has no plain-text password, no stored hash, and (on success) no key named like a password."""
        body = response.content.decode()
        for plain in plain_passwords:
            self.assertNotIn(plain, body)
        for prefix in HASH_PREFIXES:
            self.assertNotIn(prefix, body)
        for user in User.objects.all():
            self.assertNotIn(user.password, body)
        if check_keys and body:
            keys = list(json_keys(json.loads(body)))
            self.assertFalse([k for k in keys if 'password' in k.lower()], f'password-like key in {keys}')

    def assert_no_other_user(self, response):
        body = response.content.decode()
        self.assertNotIn(self.other.email, body)
        self.assertNotIn(self.other.username, body)

    # register

    def test_register_response_has_no_password(self):
        data = {'username': 'alice', 'email': 'alice@example.com', 'password': PASSWORD, 'password2': PASSWORD}

        response = self.post('users:register', data)

        self.assertEqual(response.status_code, HTTPStatus.CREATED)
        self.assert_no_secret(response, PASSWORD)
        self.assert_no_other_user(response)

    def test_register_error_does_not_echo_the_password(self):
        data = {'username': 'alice', 'email': 'alice@example.com', 'password': PASSWORD, 'password2': NEW_PASSWORD}

        response = self.post('users:register', data)

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        # The error is keyed by the field name 'password', so only values and hashes are checked
        self.assert_no_secret(response, PASSWORD, NEW_PASSWORD, check_keys=False)

    # login

    def test_login_response_has_no_password(self):
        User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)

        response = self.post('users:login', {'login': 'alice', 'password': PASSWORD})

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assert_no_secret(response, PASSWORD)
        self.assert_no_other_user(response)

    def test_failed_login_does_not_echo_the_password(self):
        response = self.post('users:login', {'login': 'bob', 'password': 'Wr0ng-pass-000'})

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assert_no_secret(response, 'Wr0ng-pass-000', OTHER_PASSWORD)

    # profile

    def test_profile_has_no_password_and_only_own_data(self):
        self.sign_in_alice()

        response = self.client.get(reverse('users:profile-me'))

        self.assertEqual(response.status_code, HTTPStatus.OK)
        self.assertEqual(response.json()['email'], 'alice@example.com')
        self.assert_no_secret(response, PASSWORD)
        self.assert_no_other_user(response)

    # change-email

    def test_change_email_response_has_no_password(self):
        self.sign_in_alice()

        response = self.patch('users:profile-change-email', {'email': 'alice.new@example.com'})

        self.assertEqual(response.status_code, HTTPStatus.ACCEPTED)
        self.assert_no_secret(response, PASSWORD)
        self.assert_no_other_user(response)

    def test_change_email_to_taken_address_does_not_reveal_that_user(self):
        self.sign_in_alice()

        response = self.patch('users:profile-change-email', {'email': self.other.email})

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assert_no_secret(response, PASSWORD, OTHER_PASSWORD)
        self.assertNotIn(self.other.username, response.content.decode())

    # change-password

    def test_change_password_response_has_no_password(self):
        self.sign_in_alice()
        data = {'old_password': PASSWORD, 'new_password': NEW_PASSWORD, 'new_password2': NEW_PASSWORD}

        response = self.patch('users:profile-change-password', data)

        self.assertEqual(response.status_code, HTTPStatus.OK)
        # The success message is "Your password has been changed.", so the word itself is allowed in values
        self.assert_no_secret(response, PASSWORD, NEW_PASSWORD)

    def test_change_password_error_does_not_echo_either_password(self):
        self.sign_in_alice()
        data = {'old_password': 'Wr0ng-pass-000', 'new_password': NEW_PASSWORD, 'new_password2': NEW_PASSWORD}

        response = self.patch('users:profile-change-password', data)

        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)
        self.assert_no_secret(response, 'Wr0ng-pass-000', NEW_PASSWORD, PASSWORD, check_keys=False)
