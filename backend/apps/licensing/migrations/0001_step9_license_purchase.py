from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('works', '0004_step7_blockchain_registration_fields_and_statuses'),
        ('marketplace', '0002_step9_add_price_wei'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='LicensePurchase',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('template', models.CharField(choices=[('personal', 'Personal'), ('commercial', 'Commercial'), ('exclusive', 'Exclusive')], max_length=20)),
                ('rights_scope', models.CharField(choices=[('non_commercial', 'Non-commercial'), ('commercial', 'Commercial')], max_length=20)),
                ('is_exclusive', models.BooleanField(db_index=True, default=False)),
                ('amount_wei', models.BigIntegerField()),
                ('tx_hash', models.CharField(blank=True, default='', max_length=66)),
                ('block_number', models.BigIntegerField(blank=True, null=True)),
                ('purchased_at', models.DateTimeField(blank=True, null=True)),
                ('status', models.CharField(choices=[('PENDING_CONFIRMATION', 'Pending confirmation'), ('ACTIVE', 'Active'), ('FAILED', 'Failed')], default='PENDING_CONFIRMATION', max_length=32)),
                ('error_message', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('buyer', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='purchased_licenses', to=settings.AUTH_USER_MODEL)),
                ('creator', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='sold_licenses', to=settings.AUTH_USER_MODEL)),
                ('work', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='licenses', to='works.creativework')),
            ],
            options={
                'db_table': 'licensing_license_purchase',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='licensepurchase',
            constraint=models.UniqueConstraint(condition=models.Q(('tx_hash__gt', '')), fields=('tx_hash',), name='licensing_unique_tx_hash'),
        ),
    ]

