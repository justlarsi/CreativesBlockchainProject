from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('infringement', '0001_initial'),
        ('works', '0004_step7_blockchain_registration_fields_and_statuses'),
    ]

    operations = [
        migrations.CreateModel(
            name='LegalDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'document_type',
                    models.CharField(
                        choices=[
                            ('dmca', 'DMCA Takedown Notice'),
                            ('cease_and_desist', 'Cease and Desist Letter'),
                        ],
                        max_length=24,
                    ),
                ),
                ('file', models.FileField(upload_to='legal/documents/%Y/%m/%d/')),
                ('proof_snapshot', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'alert',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='legal_documents',
                        to='infringement.infringementalert',
                    ),
                ),
                (
                    'creator',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='legal_documents',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    'work',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name='legal_documents',
                        to='works.creativework',
                    ),
                ),
            ],
            options={
                'db_table': 'legal_document',
                'ordering': ['-created_at'],
            },
        ),
    ]

