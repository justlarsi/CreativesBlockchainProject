from django.contrib import admin

from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
	list_display = ('id', 'action', 'entity_type', 'entity_id', 'user', 'created_at')
	search_fields = ('action', 'entity_type', 'entity_id', 'user__username', 'user__email')
	list_filter = ('action', 'entity_type', 'created_at')
	readonly_fields = ('created_at',)

