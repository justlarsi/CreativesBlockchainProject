from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User, Wallet


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'is_email_verified', 'created_at')
    list_filter = ('is_staff', 'is_superuser', 'is_active', 'is_email_verified')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-created_at',)

    fieldsets = UserAdmin.fieldsets + (
        ('CreativeChain', {'fields': ('bio', 'is_email_verified')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('CreativeChain', {'fields': ('email', 'bio')}),
    )


@admin.register(Wallet)
class WalletAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'address', 'is_primary', 'created_at')
    list_filter = ('is_primary', 'created_at')
    search_fields = ('address', 'user__username', 'user__email')
    ordering = ('-created_at',)

