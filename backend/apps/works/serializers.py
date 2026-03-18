from rest_framework import serializers

from .models import ContentHash, CreativeWork


class ContentHashSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentHash
        fields = ['id', 'hash_type', 'hash_value', 'created_at']
        read_only_fields = fields


class CreativeWorkSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(source='owner.id', read_only=True)
    content_hashes = ContentHashSerializer(many=True, read_only=True)

    class Meta:
        model = CreativeWork
        fields = [
            'id',
            'owner_id',
            'title',
            'description',
            'category',
            'status',
            'original_filename',
            'file_size',
            'mime_type',
            'file',
            'content_hashes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'owner_id', 'status', 'original_filename', 'file_size',
            'mime_type', 'file', 'content_hashes', 'created_at', 'updated_at',
        ]


class CreativeWorkMetadataCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreativeWork
        fields = ['id', 'title', 'description', 'category', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']


class CreativeWorkUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)

