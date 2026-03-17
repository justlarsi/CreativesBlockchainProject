from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q


class User(AbstractUser):
    """
    Custom user model for CreativeChain.

    Extends AbstractUser to enforce unique email and add profile fields.
    AbstractUser already enforces unique username.
    """

    # Override email to enforce uniqueness (AbstractUser has it as non-unique by default)
    email = models.EmailField(unique=True, db_index=True)

    # Profile
    bio = models.TextField(blank=True, default='')

    # Email verification (deferred to a future step; field exists for forward compatibility)
    is_email_verified = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    EMAIL_FIELD = 'email'
    REQUIRED_FIELDS = ['email']   # email is required alongside username

    class Meta:
        db_table = 'accounts_user'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return self.username


class Wallet(models.Model):
    """Wallets linked to a user account through signed ownership proof."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wallets')
    address = models.CharField(max_length=42)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_wallet'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'address'], name='unique_wallet_per_user'),
            models.UniqueConstraint(
                fields=['user'],
                condition=Q(is_primary=True),
                name='unique_primary_wallet_per_user',
            ),
        ]

    def __str__(self) -> str:
        return f'{self.user_id}:{self.address}'


class WalletChallenge(models.Model):
    """Single-use challenge for wallet ownership verification."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wallet_challenges')
    wallet_address = models.CharField(max_length=42)
    nonce = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'accounts_wallet_challenge'
        ordering = ['-created_at']

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

