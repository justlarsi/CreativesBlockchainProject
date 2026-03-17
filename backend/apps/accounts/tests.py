"""
Step 1 acceptance tests — Authentication and User Accounts.

Covers:
  - Register: success, duplicate email, duplicate username, weak password, missing fields
  - Login: success (tokens + user in response), wrong password, inactive account
  - Refresh: success (rotates tokens), invalid/expired token
  - Logout: success (blacklists token), missing refresh, invalid token, unauthenticated
  - Me (profile): GET authenticated, PATCH update, unauthenticated 401
  - Token enforcement: protected routes reject missing/invalid/expired tokens
"""
from django.contrib.auth import get_user_model
from eth_account import Account
from eth_account.messages import encode_defunct
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

AUTH_REGISTER = '/api/v1/auth/register/'
AUTH_LOGIN = '/api/v1/auth/login/'
AUTH_REFRESH = '/api/v1/auth/refresh/'
AUTH_LOGOUT = '/api/v1/auth/logout/'
AUTH_ME = '/api/v1/auth/me/'
AUTH_WALLETS = '/api/v1/auth/wallets/'
AUTH_WALLET_CHALLENGE = '/api/v1/auth/wallets/challenge/'
AUTH_WALLET_VERIFY = '/api/v1/auth/wallets/verify/'


def make_user(username='testuser', email='test@example.com', password='Str0ngPass!'):
    """Helper — create and return a User instance."""
    return User.objects.create_user(username=username, email=email, password=password)


def auth_header(user) -> dict:
    """Helper — return Authorization header dict for a user."""
    refresh = RefreshToken.for_user(user)
    return {'HTTP_AUTHORIZATION': f'Bearer {refresh.access_token}'}


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

class RegisterTests(APITestCase):
    def test_register_success_returns_201_with_tokens_and_user(self):
        payload = {
            'username': 'alice',
            'email': 'alice@example.com',
            'password': 'Str0ngPass!',
        }
        response = self.client.post(AUTH_REGISTER, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], 'alice@example.com')
        self.assertEqual(response.data['user']['username'], 'alice')

    def test_register_creates_user_in_db(self):
        payload = {'username': 'bob', 'email': 'bob@example.com', 'password': 'Str0ngPass!'}
        self.client.post(AUTH_REGISTER, payload, format='json')
        self.assertTrue(User.objects.filter(email='bob@example.com').exists())

    def test_register_email_is_normalised_to_lowercase(self):
        payload = {'username': 'carol', 'email': 'Carol@Example.COM', 'password': 'Str0ngPass!'}
        response = self.client.post(AUTH_REGISTER, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['user']['email'], 'carol@example.com')

    def test_register_duplicate_email_returns_400(self):
        make_user(username='existing', email='dup@example.com')
        payload = {'username': 'newuser', 'email': 'dup@example.com', 'password': 'Str0ngPass!'}
        response = self.client.post(AUTH_REGISTER, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('email', response.data)

    def test_register_duplicate_username_returns_400(self):
        make_user(username='taken', email='a@example.com')
        payload = {'username': 'taken', 'email': 'b@example.com', 'password': 'Str0ngPass!'}
        response = self.client.post(AUTH_REGISTER, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data)

    def test_register_short_password_returns_400(self):
        payload = {'username': 'dave', 'email': 'dave@example.com', 'password': 'abc'}
        response = self.client.post(AUTH_REGISTER, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_register_missing_email_returns_400(self):
        payload = {'username': 'eve', 'password': 'Str0ngPass!'}
        response = self.client.post(AUTH_REGISTER, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_username_returns_400(self):
        payload = {'email': 'eve@example.com', 'password': 'Str0ngPass!'}
        response = self.client.post(AUTH_REGISTER, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_missing_password_returns_400(self):
        payload = {'username': 'frank', 'email': 'frank@example.com'}
        response = self.client.post(AUTH_REGISTER, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_register_password_not_returned_in_response(self):
        payload = {'username': 'grace', 'email': 'grace@example.com', 'password': 'Str0ngPass!'}
        response = self.client.post(AUTH_REGISTER, payload, format='json')
        self.assertNotIn('password', response.data.get('user', {}))


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------

class LoginTests(APITestCase):
    def setUp(self):
        self.user = make_user(username='loginuser', email='login@example.com', password='Str0ngPass!')

    def test_login_success_returns_200_with_tokens_and_user(self):
        payload = {'username': 'loginuser', 'password': 'Str0ngPass!'}
        response = self.client.post(AUTH_LOGIN, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'loginuser')

    def test_login_wrong_password_returns_401(self):
        payload = {'username': 'loginuser', 'password': 'WrongPass!'}
        response = self.client.post(AUTH_LOGIN, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_nonexistent_user_returns_401(self):
        payload = {'username': 'ghost', 'password': 'Str0ngPass!'}
        response = self.client.post(AUTH_LOGIN, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_inactive_user_returns_401(self):
        self.user.is_active = False
        self.user.save()
        payload = {'username': 'loginuser', 'password': 'Str0ngPass!'}
        response = self.client.post(AUTH_LOGIN, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_missing_password_returns_400(self):
        payload = {'username': 'loginuser'}
        response = self.client.post(AUTH_LOGIN, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ---------------------------------------------------------------------------
# Token Refresh
# ---------------------------------------------------------------------------

class RefreshTests(APITestCase):
    def setUp(self):
        self.user = make_user(username='refreshuser', email='refresh@example.com')
        self.refresh = RefreshToken.for_user(self.user)

    def test_refresh_success_returns_new_access_token(self):
        payload = {'refresh': str(self.refresh)}
        response = self.client.post(AUTH_REFRESH, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)

    def test_refresh_rotates_refresh_token(self):
        """With ROTATE_REFRESH_TOKENS=True a new refresh token must be returned."""
        payload = {'refresh': str(self.refresh)}
        response = self.client.post(AUTH_REFRESH, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('refresh', response.data)
        self.assertNotEqual(response.data['refresh'], str(self.refresh))

    def test_refresh_invalid_token_returns_401(self):
        payload = {'refresh': 'not.a.valid.token'}
        response = self.client.post(AUTH_REFRESH, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_missing_token_returns_400(self):
        response = self.client.post(AUTH_REFRESH, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_refresh_blacklisted_token_returns_401(self):
        """After logout the same refresh token must be rejected."""
        self.refresh.blacklist()
        payload = {'refresh': str(self.refresh)}
        response = self.client.post(AUTH_REFRESH, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------

class LogoutTests(APITestCase):
    def setUp(self):
        self.user = make_user(username='logoutuser', email='logout@example.com')
        self.refresh = RefreshToken.for_user(self.user)

    def test_logout_success_returns_205(self):
        headers = auth_header(self.user)
        payload = {'refresh': str(self.refresh)}
        response = self.client.post(AUTH_LOGOUT, payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

    def test_logout_blacklists_refresh_token(self):
        """After logout, using the same refresh token must return 401."""
        headers = auth_header(self.user)
        payload = {'refresh': str(self.refresh)}
        self.client.post(AUTH_LOGOUT, payload, format='json', **headers)
        # Attempt refresh with the now-blacklisted token
        response = self.client.post(AUTH_REFRESH, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_missing_refresh_token_returns_400(self):
        headers = auth_header(self.user)
        response = self.client.post(AUTH_LOGOUT, {}, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_invalid_refresh_token_returns_400(self):
        headers = auth_header(self.user)
        payload = {'refresh': 'bad.token.value'}
        response = self.client.post(AUTH_LOGOUT, payload, format='json', **headers)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_unauthenticated_returns_401(self):
        payload = {'refresh': str(self.refresh)}
        response = self.client.post(AUTH_LOGOUT, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ---------------------------------------------------------------------------
# Me / Profile
# ---------------------------------------------------------------------------

class ProfileTests(APITestCase):
    def setUp(self):
        self.user = make_user(username='profileuser', email='profile@example.com')

    def test_me_get_returns_200_with_profile(self):
        response = self.client.get(AUTH_ME, **auth_header(self.user))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'profileuser')
        self.assertEqual(response.data['email'], 'profile@example.com')

    def test_me_get_unauthenticated_returns_401(self):
        response = self.client.get(AUTH_ME)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_patch_updates_allowed_fields(self):
        payload = {'first_name': 'Alice', 'last_name': 'Smith', 'bio': 'Creative person.'}
        response = self.client.patch(AUTH_ME, payload, format='json', **auth_header(self.user))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['first_name'], 'Alice')
        self.assertEqual(response.data['last_name'], 'Smith')
        self.assertEqual(response.data['bio'], 'Creative person.')

    def test_me_patch_cannot_change_email(self):
        payload = {'email': 'hacked@example.com'}
        self.client.patch(AUTH_ME, payload, format='json', **auth_header(self.user))
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'profile@example.com')

    def test_me_patch_cannot_change_username(self):
        payload = {'username': 'hacked'}
        self.client.patch(AUTH_ME, payload, format='json', **auth_header(self.user))
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'profileuser')

    def test_me_put_not_allowed(self):
        """PUT is disabled; only PATCH is supported."""
        response = self.client.put(AUTH_ME, {}, format='json', **auth_header(self.user))
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_me_response_does_not_contain_password(self):
        response = self.client.get(AUTH_ME, **auth_header(self.user))
        self.assertNotIn('password', response.data)


# ---------------------------------------------------------------------------
# Token enforcement on protected routes
# ---------------------------------------------------------------------------

class TokenEnforcementTests(APITestCase):
    def test_me_without_token_returns_401(self):
        response = self.client.get(AUTH_ME)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_with_invalid_token_returns_401(self):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer this.is.invalid')
        response = self.client.get(AUTH_ME)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_with_malformed_header_returns_401(self):
        self.client.credentials(HTTP_AUTHORIZATION='NotBearer sometoken')
        response = self.client.get(AUTH_ME)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_access_token_accepted_on_protected_endpoint(self):
        user = make_user(username='tokencheck', email='tc@example.com')
        refresh = RefreshToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        response = self.client.get(AUTH_ME)
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class WalletIntegrationTests(APITestCase):
    def setUp(self):
        self.user = make_user(username='walletuser', email='wallet@example.com', password='Str0ngPass!')
        self.auth = auth_header(self.user)

    def _create_signed_challenge(self, account, chain_id=80002):
        challenge_response = self.client.post(
            AUTH_WALLET_CHALLENGE,
            {'address': account.address},
            format='json',
            **self.auth,
        )
        self.assertEqual(challenge_response.status_code, status.HTTP_201_CREATED)
        message = challenge_response.data['message']
        signed = Account.sign_message(encode_defunct(text=message), private_key=account.key)
        verify_payload = {
            'challenge_id': challenge_response.data['challenge_id'],
            'signature': signed.signature.hex(),
            'chain_id': chain_id,
        }
        return verify_payload

    def test_wallet_verify_links_wallet_successfully(self):
        account = Account.create()
        verify_payload = self._create_signed_challenge(account)

        response = self.client.post(AUTH_WALLET_VERIFY, verify_payload, format='json', **self.auth)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['address'], account.address.lower())
        self.assertTrue(response.data['is_primary'])

    def test_wallet_verify_rejects_wrong_chain(self):
        account = Account.create()
        verify_payload = self._create_signed_challenge(account, chain_id=137)

        response = self.client.post(AUTH_WALLET_VERIFY, verify_payload, format='json', **self.auth)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Polygon Amoy', response.data['detail'])

    def test_wallet_verify_rejects_replayed_challenge(self):
        account = Account.create()
        verify_payload = self._create_signed_challenge(account)

        first = self.client.post(AUTH_WALLET_VERIFY, verify_payload, format='json', **self.auth)
        second = self.client.post(AUTH_WALLET_VERIFY, verify_payload, format='json', **self.auth)

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(second.data['detail'], 'Challenge already used.')

    def test_wallet_disconnect_removes_wallet(self):
        account = Account.create()
        verify_payload = self._create_signed_challenge(account)
        verify = self.client.post(AUTH_WALLET_VERIFY, verify_payload, format='json', **self.auth)
        wallet_id = verify.data['id']

        response = self.client.delete(f'{AUTH_WALLETS}{wallet_id}/', **self.auth)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        list_response = self.client.get(AUTH_WALLETS, **self.auth)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data['results']), 0)

    def test_set_primary_wallet_switches_primary(self):
        first = Account.create()
        second = Account.create()

        first_payload = self._create_signed_challenge(first)
        first_verify = self.client.post(AUTH_WALLET_VERIFY, first_payload, format='json', **self.auth)

        second_payload = self._create_signed_challenge(second)
        second_verify = self.client.post(AUTH_WALLET_VERIFY, second_payload, format='json', **self.auth)

        self.assertTrue(first_verify.data['is_primary'])
        self.assertFalse(second_verify.data['is_primary'])

        switch = self.client.post(
            f"{AUTH_WALLETS}{second_verify.data['id']}/set-primary/",
            {},
            format='json',
            **self.auth,
        )
        self.assertEqual(switch.status_code, status.HTTP_200_OK)
        self.assertTrue(switch.data['is_primary'])

