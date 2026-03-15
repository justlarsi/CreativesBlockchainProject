from django.contrib.auth.models import AbstractUser
from django.db import models


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
