from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('licensing', '0001_step9_license_purchase'),
    ]

    operations = [
        migrations.AddField(
            model_name='licensepurchase',
            name='receipt_idempotency_key',
            field=models.CharField(blank=True, default='', max_length=128),
        ),
        migrations.AddConstraint(
            model_name='licensepurchase',
            constraint=models.UniqueConstraint(
                condition=models.Q(('receipt_idempotency_key__gt', '')),
                fields=('receipt_idempotency_key',),
                name='licensing_unique_receipt_idempotency_key',
            ),
        ),
    ]

