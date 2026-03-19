from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('works', '0003_step5_ipfs_pinning_fields_and_statuses'),
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
                    ('BLOCKCHAIN_REGISTRATION_PENDING', 'Blockchain registration pending'),
                    ('REGISTERED', 'Registered'),
                    ('BLOCKCHAIN_REGISTRATION_FAILED', 'Blockchain registration failed'),
                ],
                default='PENDING_UPLOAD',
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name='creativework',
            name='blockchain_block_number',
            field=models.BigIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='creativework',
            name='blockchain_error_message',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='creativework',
            name='blockchain_registration_timestamp',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='creativework',
            name='blockchain_tx_hash',
            field=models.CharField(blank=True, default='', max_length=66),
        ),
    ]

