from decimal import Decimal

from django.db import migrations, models
import django.core.validators


WEI_MULTIPLIER = Decimal('1000000000000000000')


def backfill_price_wei(apps, schema_editor):
    MarketplaceListing = apps.get_model('marketplace', 'MarketplaceListing')
    for listing in MarketplaceListing.objects.all().iterator():
        if listing.price_wei and listing.price_wei > 0:
            continue
        listing.price_wei = int((listing.price_amount * WEI_MULTIPLIER).to_integral_value())
        listing.save(update_fields=['price_wei'])


class Migration(migrations.Migration):

    dependencies = [
        ('marketplace', '0001_step8_marketplace_listing'),
    ]

    operations = [
        migrations.AddField(
            model_name='marketplacelisting',
            name='price_wei',
            field=models.BigIntegerField(default=0, validators=[django.core.validators.MinValueValidator(0)]),
        ),
        migrations.RunPython(backfill_price_wei, migrations.RunPython.noop),
    ]

