from django.contrib import admin

from .models import ContentHash, CreativeWork


@admin.register(CreativeWork)
class CreativeWorkAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'owner', 'category', 'status', 'mime_type', 'file_size', 'created_at')
    list_filter = ('category', 'status', 'created_at')
    search_fields = ('title', 'owner__username', 'owner__email', 'original_filename')


@admin.register(ContentHash)
class ContentHashAdmin(admin.ModelAdmin):
    list_display = ('id', 'work', 'hash_type', 'hash_value_short', 'created_at')
    list_filter = ('hash_type', 'created_at')
    search_fields = ('work__title', 'hash_value')
    readonly_fields = ('created_at',)

    @admin.display(description='Hash value (first 20 chars)')
    def hash_value_short(self, obj):
        return obj.hash_value[:20] + '…' if len(obj.hash_value) > 20 else obj.hash_value


