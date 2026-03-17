from django.contrib import admin

from .models import CreativeWork


@admin.register(CreativeWork)
class CreativeWorkAdmin(admin.ModelAdmin):
	list_display = ('id', 'title', 'owner', 'category', 'status', 'mime_type', 'file_size', 'created_at')
	list_filter = ('category', 'status', 'created_at')
	search_fields = ('title', 'owner__username', 'owner__email', 'original_filename')
