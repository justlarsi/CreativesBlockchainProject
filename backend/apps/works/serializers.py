from rest_framework import serializers

from .models import CreativeWork


class CreativeWorkSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(source='owner.id', read_only=True)

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
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'owner_id', 'status', 'original_filename', 'file_size', 'mime_type', 'file', 'created_at', 'updated_at']


class CreativeWorkMetadataCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreativeWork
        fields = ['id', 'title', 'description', 'category', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']


class CreativeWorkUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=True)

