from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('works', '0002_step4_contenthash_processing_statuses'),
    ]

    operations = [
        migrations.AlterField(
            model_name='creativework',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING_UPLOAD', 'Pending upload'),
                    ('UPLOADED', 'Uploaded'),
                    ('VALIDATION_FAILED', 'Validation failed'),
                    ('UPLOAD_FAILED', 'Upload failed'),
                    ('PROCESSING', 'Processing'),
                    ('PROCESSING_COMPLETE', 'Processing complete'),
                    ('PROCESSING_FAILED', 'Processing failed'),
                    ('IPFS_PINNING_COMPLETE', 'IPFS pinning complete'),
                    ('IPFS_PINNING_FAILED', 'IPFS pinning failed'),
                ],
                default='PENDING_UPLOAD',
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name='creativework',
            name='ipfs_error_message',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='creativework',
            name='ipfs_metadata_cid',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='creativework',
            name='ipfs_pinned_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

