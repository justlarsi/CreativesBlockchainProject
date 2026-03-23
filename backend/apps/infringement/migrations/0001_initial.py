from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('works', '0004_step7_blockchain_registration_fields_and_statuses'),
    ]

    operations = [
        migrations.CreateModel(
            name='InfringementAlert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_url', models.URLField(max_length=1000)),
                ('source_platform', models.CharField(blank=True, default='', max_length=100)),
                ('source_fingerprint', models.CharField(db_index=True, max_length=64)),
                ('similarity_score', models.FloatField(default=0.0)),
                ('severity', models.CharField(choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('critical', 'Critical')], default='low', max_length=16)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('confirmed', 'Confirmed'), ('false_positive', 'False positive'), ('resolved', 'Resolved')], default='pending', max_length=20)),
                ('evidence', models.JSONField(blank=True, default=dict)),
                ('detection_reason', models.CharField(blank=True, default='', max_length=255)),
                ('resolution_notes', models.TextField(blank=True, default='')),
                ('first_detected_at', models.DateTimeField(auto_now_add=True)),
                ('last_detected_at', models.DateTimeField(auto_now_add=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('creator', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='infringement_alerts', to=settings.AUTH_USER_MODEL)),
                ('work', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='infringement_alerts', to='works.creativework')),
            ],
            options={
                'db_table': 'infringement_alerts',
                'ordering': ['-last_detected_at', '-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='infringementalert',
            constraint=models.UniqueConstraint(condition=Q(status__in=['pending', 'confirmed']), fields=('work', 'source_fingerprint'), name='uniq_open_infringement_alert_per_work_source'),
        ),
    ]


