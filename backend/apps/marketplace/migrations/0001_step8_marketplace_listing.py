from decimal import Decimal

from django.db import migrations, models
import django.db.models.deletion
import django.core.validators


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ('works', '0004_step7_blockchain_registration_fields_and_statuses'),
    ]

    operations = [
        migrations.CreateModel(
            name='MarketplaceListing',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_listed', models.BooleanField(db_index=True, default=False)),
                ('license_type', models.CharField(choices=[('personal', 'Personal'), ('commercial', 'Commercial'), ('exclusive', 'Exclusive')], max_length=20)),
                ('price_amount', models.DecimalField(decimal_places=2, max_digits=12, validators=[django.core.validators.MinValueValidator(Decimal('0.00'))])),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('work', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='marketplace_listing', to='works.creativework')),
            ],
            options={
                'db_table': 'marketplace_listing',
                'ordering': ['-created_at'],
            },
        ),
    ]

